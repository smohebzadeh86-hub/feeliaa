// CRUD برای مراجعین — همیشه محدود به تراپیستِ واردشده
import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../auth/guard.js';
import { getOwnedClient, getOwnedClientAny } from '../../db/ownership.js';
import { logEvent } from '../../obs/eventLog.js';
import { recordAudit } from '../../obs/audit.js';
import {
  listClientsWithStats, clearRecordingConsent, listRecoveredSessions, clientCodeExists, insertClient, getClientRow,
  listClientSessions, updateClientAlias, updateClientStatus, setClientPinned, updateClientCategory, countClientCascade,
  deleteOwnedClient, restoreOwnedClient, listDeletedClients,
} from './clients.repository.js';
import { treatmentUnits, TreatmentUnitValidationError } from '../treatment-unit/index.js';

const VALID_CATEGORIES = ['child', 'teen', 'adult'];
const VALID_GENDERS = ['f', 'm'];
const VALID_STATUSES = ['active', 'inactive'];
const MAX_STATUS_REASON_LEN = 200;

// دلیلِ غیرفعال‌بودن: trim؛ خالی (مثلاً گزینه‌ی «نامشخص») = null
function cleanStatusReason(reason: unknown): string | null {
  return typeof reason === 'string' && reason.trim() ? reason.trim() : null;
}

// تولید کد یکتا: CL-XXXX
function generateClientCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CL-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function clientRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /api/clients — لیست مراجعینِ همین تراپیست
  app.get('/api/clients', async (request) => {
    return { clients: await listClientsWithStats(request.therapistId) };
  });

  // DELETE /api/clients/:id/recording-consent — لغوِ رضایتِ یک‌باره‌ی ضبط/رونویسی (migration 024).
  // مراجع رضایتش را پس گرفت ⇒ از جلسه/آپلودِ بعدی دوباره پرسیده می‌شود. جلسه‌ها و متن‌هایِ قبلی دست‌نخورده می‌مانند.
  app.delete('/api/clients/:id/recording-consent', async (request, reply) => {
    const { id } = request.params as { id: string };
    if ((await clearRecordingConsent(id, request.therapistId)) === 0) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }
    logEvent({ event: 'client.consent_revoked', therapistId: request.therapistId, clientId: id });
    await recordAudit({ actorId: request.therapistId, action: 'consent.revoked', targetType: 'client', targetId: id });
    return { recording_consent_at: null };
  });

  // ⭐ GET /api/recovered — جلسات قطع‌شده‌ی همین تراپیست (یک query)
  // ⭐ مرتب بر اساس session_num DESC — همیشه جدیدترین جلسه (نه updated_at)
  app.get('/api/recovered', async (request) => {
    return { recovered: await listRecoveredSessions(request.therapistId) };
  });

  // POST /api/clients — ساخت مراجع جدید برای همین تراپیست
  app.post('/api/clients', async (request, reply) => {
    const { alias, category, gender, status, reason, unit_type, members } = request.body as {
      alias?: string; category?: string; gender?: string; status?: string; reason?: string;
      unit_type?: string; members?: unknown;
    };
    // واحدِ درمان (migration 029): اختیاری و سازگار با عقب — بدونِ آن همان مراجعِ فردیِ قبلی.
    // اعتبارسنجی پیش از INSERT تا مراجعِ نیمه‌کاره ساخته نشود.
    const hasUnit = typeof unit_type === 'string' && unit_type !== '';
    if (hasUnit) {
      try { await treatmentUnits.validate(unit_type!, members as any); }
      catch (e) {
        if (e instanceof TreatmentUnitValidationError) { reply.code(400); return { error: e.message, code: e.code }; }
        throw e;
      }
    }

    if (category && !VALID_CATEGORIES.includes(category)) {
      reply.code(400);
      return { error: 'دسته‌بندی نامعتبر است' };
    }
    if (gender && !VALID_GENDERS.includes(gender)) {
      reply.code(400);
      return { error: 'جنسیت نامعتبر است' };
    }
    // ⭐ ساخت در تبِ «غیرفعال» (آرشیوِ پرونده‌های قبلی) — قبلاً status پذیرفته نمی‌شد و
    // مراجع همیشه active ساخته می‌شد، یعنی از تبی که در آن ساخته شده بود ناپدید می‌شد.
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      reply.code(400);
      return { error: 'وضعیت نامعتبر است' };
    }
    const finalStatus = status === 'inactive' ? 'inactive' : 'active';
    const statusReason = finalStatus === 'inactive' ? cleanStatusReason(reason) : null;
    if (statusReason && statusReason.length > MAX_STATUS_REASON_LEN) {
      reply.code(400);
      return { error: 'دلیل بیش از حد طولانی است' };
    }

    // جنسیت فقط برایِ نوجوان/بزرگسال معنا داره
    const finalGender = (category === 'child' || category === 'teen' || category === 'adult') ? (gender || null) : null;

    let code = generateClientCode();
    for (let i = 0; i < 5; i++) {
      if (!(await clientCodeExists(code))) break;
      code = generateClientCode();
    }

    const newId = randomUUID();
    await insertClient({
      id: newId, code, alias: alias || null, therapistId: request.therapistId, category: category || null,
      gender: finalGender, status: finalStatus, statusReason,
    });
    if (hasUnit) await treatmentUnits.saveUnit(newId, unit_type!, members as any);
    const created = await getClientRow(newId);

    reply.code(201);
    return { client: created, unit: await treatmentUnits.describeUnit(newId) };
  });

  // GET /api/clients/:id — جزئیات یک مراجع + جلساتش (فقط اگر مالِ همین تراپیست باشه)
  app.get('/api/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const client = await getOwnedClient(id, request.therapistId!);
    if (!client) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    const sessions = await listClientSessions(id);

    return {
      client,
      unit: await treatmentUnits.describeUnit(id),
      sessions,
    };
  });

  // PUT /api/clients/:id — ویرایش alias
  app.put('/api/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { alias } = request.body as { alias: string };

    const owned = await getOwnedClient(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    if ((await updateClientAlias(id, request.therapistId, alias)) === 0) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    return { client: await getClientRow(id) };
  });

  // PATCH /api/clients/:id/status — انتقال فعال/غیرفعال (همیشه اقدامِ دستیِ تراپیست)
  app.patch('/api/clients/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, reason } = request.body as { status: string; reason?: string };

    if (!VALID_STATUSES.includes(status)) {
      reply.code(400);
      return { error: 'وضعیت نامعتبر است' };
    }

    // برگشت به فعال یعنی دلیلِ قبلی دیگه معتبر نیست
    const statusReason = status === 'inactive' ? cleanStatusReason(reason) : null;
    if (statusReason && statusReason.length > MAX_STATUS_REASON_LEN) {
      reply.code(400);
      return { error: 'دلیل بیش از حد طولانی است' };
    }

    const owned = await getOwnedClient(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    // غیرفعال‌شدن یعنی از صفحه‌ی اول (نمای «امروز») هم می‌رود؛ سنجاقِ متناقض روی
    // مراجعِ غیرفعال نگه داشته نمی‌شود.
    const updated = await updateClientStatus(id, request.therapistId, status, statusReason);

    // مراجع بینِ چکِ مالکیت و UPDATE حذف شده — مثلِ PUT، نه 200 با client خالی
    if (updated === 0) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    return { client: await getClientRow(id) };
  });

  // PATCH /api/clients/:id/pin — سنجاق/برداشتنِ سنجاق به صفحه‌ی اول (نمای «امروز»)
  app.patch('/api/clients/:id/pin', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { pinned } = request.body as { pinned: boolean };

    if (typeof pinned !== 'boolean') {
      reply.code(400);
      return { error: 'pinned باید true یا false باشد' };
    }

    const owned = await getOwnedClient(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    if ((await setClientPinned(id, request.therapistId, pinned)) === 0) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    return { client: await getClientRow(id) };
  });

  // PATCH /api/clients/:id/category — تغییرِ دسته‌بندیِ دموگرافیک (+ جنسیتِ اختیاری)
  app.patch('/api/clients/:id/category', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { category, gender } = request.body as { category: string | null; gender?: string | null };

    if (category !== null && category !== undefined && !VALID_CATEGORIES.includes(category)) {
      reply.code(400);
      return { error: 'دسته‌بندی نامعتبر است' };
    }
    if (gender !== null && gender !== undefined && !VALID_GENDERS.includes(gender)) {
      reply.code(400);
      return { error: 'جنسیت نامعتبر است' };
    }

    const owned = await getOwnedClient(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    // جنسیت فقط برایِ نوجوان/بزرگسال معنا داره — با تغییرِ دسته به کودک، پاک می‌شه
    const finalGender = (category === 'child' || category === 'teen' || category === 'adult') ? (gender || null) : null;

    await updateClientCategory(id, request.therapistId, category || null, finalGender);

    return { client: await getClientRow(id) };
  });

  // DELETE /api/clients/:id — حذف آبشاری
  // DELETE /api/clients/:id — ⭐ (2026-10-02، تصمیمِ مالک «هیچ چیزی هارد دیلیت نشود») حذفِ نرم: deleted_at (migration 043). جلسه‌ها، متن،
  // یادداشت و صدا می‌مانند و برایِ ادمین قابلِ‌مشاهده‌اند؛ با POST /restore (تراپیست/ادمین) برمی‌گردد.
  app.delete('/api/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const owned = await getOwnedClient(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    const cascade = await countClientCascade(id);
    if ((await deleteOwnedClient(id, request.therapistId)) === 0) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }
    await recordAudit({ actorId: request.therapistId, action: 'therapist.client_delete', targetType: 'client', targetId: id, detail: { soft: true, count: Number(cascade?.session_count || 0) } });

    return {
      deleted: owned.code,
      cascade,
      recoverable: true,
    };
  });

  // GET /api/deleted-clients — «مراجعینِ حذف‌شده»: مسیرِ پیدا کردنِ مراجعِ حذف‌شده (فقط متادیتا)
  app.get('/api/deleted-clients', async (request) => {
    return { clients: await listDeletedClients(request.therapistId) };
  });

  // POST /api/clients/:id/restore — بازگردانیِ مراجعِ حذف‌شده‌یِ خودِ تراپیست
  app.post('/api/clients/:id/restore', async (request, reply) => {
    const { id } = request.params as { id: string };
    const any = await getOwnedClientAny(id, request.therapistId!);
    if (!any) { reply.code(404); return { error: 'مراجع یافت نشد' }; }
    if (!any.deleted_at) { reply.code(409); return { error: 'این مراجع حذف نشده است', code: 'not-deleted' }; }
    if ((await restoreOwnedClient(id, request.therapistId)) === 0) { reply.code(409); return { error: 'این مراجع حذف نشده است', code: 'not-deleted' }; }
    await recordAudit({ actorId: request.therapistId, action: 'therapist.client_restore', targetType: 'client', targetId: id });
    return { restored: any.code };
  });
}
