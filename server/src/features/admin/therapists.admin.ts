// ادمین: آمار، تراپیست‌ها (فهرست/فعال‌سازی/نقشِ ادمین/حذف)، مراجعینِ هر تراپیست و جلساتِ هر مراجع، حذفِ مراجع.
// pluginِ فرزندِ adminRoutes (requireAdmin).
import { FastifyInstance } from 'fastify';
import { logEvent } from '../../obs/eventLog.js';
import { recordAudit } from '../../obs/audit.js';
import {
  getStats, listTherapistsWithStats, getTherapistBrief, listClientsOfTherapistWithStats, getClientBrief, listSessionsOfClient,
  countAdmins, updateTherapistFlags, getTherapistAccount, getTherapistPhoneRow,
  getClientCodeRow, deleteClient, restoreClient,
} from './admin.repository.js';

export async function therapistsAdminRoutes(app: FastifyInstance) {
  // GET /api/admin/stats
  app.get('/api/admin/stats', async () => {
    return { stats: await getStats() };
  });

  // GET /api/admin/therapists?q=search
  app.get('/api/admin/therapists', async (request) => {
    const { q } = request.query as { q?: string };
    const search = q?.trim() || null;

    return { therapists: await listTherapistsWithStats(search) };
  });

  // GET /api/admin/therapists/:id/clients — بدونِ transcript، فقط متادیتا
  app.get('/api/admin/therapists/:id/clients', async (request, reply) => {
    const { id } = request.params as { id: string };

    const therapist = await getTherapistBrief(id);
    if (!therapist) {
      reply.code(404);
      return { error: 'تراپیست یافت نشد' };
    }

    const clients = await listClientsOfTherapistWithStats(id);

    return { therapist, clients };
  });

  // GET /api/admin/clients/:id/sessions — لیستِ جلساتِ یک مراجع (فقط متادیتا، بدونِ متن)
  // برایِ رفتنِ ادمین از تراپیست → مراجع → جلسه → صدا.
  app.get('/api/admin/clients/:id/sessions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const client = await getClientBrief(id);
    if (!client) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }
    const sessions = await listSessionsOfClient(id);
    return { client, sessions };
  });

  // PATCH /api/admin/therapists/:id — { active?, is_admin?, final_transcript_enabled? }
  app.patch('/api/admin/therapists/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { active, is_admin, final_transcript_enabled } = request.body as { active?: boolean; is_admin?: boolean; final_transcript_enabled?: boolean };

    if (id === request.therapistId) {
      if (active === false) {
        reply.code(400);
        return { error: 'نمی‌توانید حساب خودتان را غیرفعال کنید' };
      }
      if (is_admin === false) {
        if ((await countAdmins()) <= 1) {
          reply.code(400);
          return { error: 'شما تنها ادمین سیستم هستید — نمی‌توانید این نقش را از خودتان بردارید' };
        }
      }
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    if (typeof active === 'boolean') { updates.push(`active = ?`); values.push(active); }
    if (typeof is_admin === 'boolean') { updates.push(`is_admin = ?`); values.push(is_admin); }
    if (typeof final_transcript_enabled === 'boolean') { updates.push(`final_transcript_enabled = ?`); values.push(final_transcript_enabled); }
    if (updates.length === 0) {
      reply.code(400);
      return { error: 'چیزی برای به‌روزرسانی نیست' };
    }
    values.push(id);

    if ((await updateTherapistFlags(updates, values)) === 0) {
      reply.code(404);
      return { error: 'تراپیست یافت نشد' };
    }

    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.therapist_update', targetType: 'therapist', targetId: id,
      detail: { ...(typeof active === 'boolean' ? { state: active ? 'active' : 'inactive' } : {}), ...(typeof is_admin === 'boolean' ? { mode: is_admin ? 'admin' : 'not_admin' } : {}), ...(typeof final_transcript_enabled === 'boolean' ? { purpose: final_transcript_enabled ? 'final_transcript_on' : 'final_transcript_off' } : {}) } });
    return { therapist: await getTherapistAccount(id) };
  });

  // DELETE /api/admin/therapists/:id — ⭐ (2026-10-02، تصمیمِ مالک «هیچ چیزی هارد دیلیت نشود») حذفِ سختِ حساب (cascade روی مراجعین/جلسه/صدا)
  // غیرفعال است؛ به‌جایش حساب غیرفعال می‌شود (PATCH /api/admin/therapists/:id با active=false). ردِ تلاش audit می‌شود.
  app.delete('/api/admin/therapists/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (id === request.therapistId) {
      reply.code(400);
      return { error: 'نمی‌توانید حساب خودتان را حذف کنید' };
    }
    const existing = await getTherapistPhoneRow(id);
    if (!existing) {
      reply.code(404);
      return { error: 'تراپیست یافت نشد' };
    }
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.hard_delete_blocked', targetType: 'therapist', targetId: id });
    reply.code(409);
    return { error: 'حذفِ سختِ حساب غیرفعال است (هیچ داده‌ای پاک نمی‌شود)؛ به‌جایِ آن حساب را غیرفعال کنید.', code: 'hard-delete-disabled' };
  });

  // DELETE /api/admin/clients/:id — حذفِ نرمِ یک مراجع (migration 043)؛ جلسه‌ها و صدا می‌مانند
  app.delete('/api/admin/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await getClientCodeRow(id);
    if (!existing) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }
    if ((await deleteClient(id, request.therapistId ?? null)) === 0) {
      reply.code(409);
      return { error: 'این مراجع قبلاً حذف شده است', code: 'already-deleted' };
    }
    logEvent({ event: 'admin.delete', therapistId: request.therapistId, detail: { kind: 'client', mode: 'soft' } });
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.client_delete', targetType: 'client', targetId: id, detail: { soft: true } });

    return { deleted: existing.code, recoverable: true };
  });

  // POST /api/admin/clients/:id/restore — بازگردانیِ مراجعِ حذف‌شده
  app.post('/api/admin/clients/:id/restore', async (request, reply) => {
    const { id } = request.params as { id: string };
    if ((await restoreClient(id)) === 0) { reply.code(404); return { error: 'مراجعِ حذف‌شده یافت نشد' }; }
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.client_restore', targetType: 'client', targetId: id });
    return { restored: id };
  });
}
