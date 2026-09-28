// CRUD برای جلسات — همیشه از مسیر مراجعِ متعلق به تراپیستِ واردشده. pluginِ sessionRoutes گاردِ requireAuth را
// می‌گذارد و pluginهایِ فرزندِ همین feature (یادداشت‌ها، یادداشتِ صوتیِ legacy، batch/آرشیو/گوینده‌ها) را ثبت می‌کند.
import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../auth/guard.js';
import { getOwnedClient, getOwnedSession } from '../../db/ownership.js';
import {
  INVALID_DATE_ERROR,
  INVALID_TIME_ERROR,
  normalizeSessionDate,
  normalizeStartTime,
  nowInTehran,
} from './sessionDate.js';
import { prepareSessionMediaPurge, purgeSessionMedia } from '../session-media/purge.js';
import { logEvent } from '../../obs/eventLog.js';
import { hasStoredConsent, recordClientConsent } from '../clients/consent.js';
// خودکارسازیِ تولیدِ پرونده بعدِ پایانِ کاملِ جلسه (فازِ ۲ِ Module 08) — سیاستِ مرکزی حالا در
// features/case-file/application/autoTrigger.ts است (jobِ آپلودِ صدا هم از همان استفاده می‌کند).
import { maybeAutoGenerateCaseFile } from '../case-file/application/autoTrigger.js';
import { recordAudit } from '../../obs/audit.js';
import { enqueueFinalTranscript } from '../final-transcript/index.js';
import { treatmentUnits, TreatmentUnitValidationError } from '../treatment-unit/index.js';
import {
  createManualSession, createLiveSession, getSessionRow, getClientConsentRow, getOwnedSessionWithClient, listSessionNotes,
  getTranscriptVersionRow, updateOwnedSession, getOwnedTranscriptVersionRow, deleteOwnedSession, appendTranscriptTail,
} from './sessions.repository.js';
import { sessionNotesRoutes } from './notes.routes.js';
import { sessionVoiceNoteRoutes } from './voiceNote.legacy.js';
import { sessionBatchRoutes } from './batch.routes.js';

// سقفِ یادداشتِ «پیش از جلسه» (configuration-catalog)
const PRE_NOTE_MAX_CHARS = Number(process.env.PRE_NOTE_MAX_CHARS) > 0 ? Number(process.env.PRE_NOTE_MAX_CHARS) : 2000;

export async function sessionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  await app.register(sessionNotesRoutes);
  await app.register(sessionVoiceNoteRoutes);
  await app.register(sessionBatchRoutes);

  // POST /api/sessions — شروع جلسه‌ی جدید (مراجع باید مالِ همین تراپیست باشه)
  // mode='manual': ثبتِ دستیِ جلسه‌ی گذشته (آرشیوِ پرونده‌های قبلی) — هیچ ضبط/صدایی
  // در کار نیست، پس رضایتِ ضبط موضوعیت ندارد (LAW-009)؛ جلسه مستقیماً completed ساخته می‌شود.
  app.post('/api/sessions', async (request, reply) => {
    const { client_id, consent, date, start_time, mode, note, attendees, pre_note } = request.body as {
      client_id: string;
      consent: boolean;
      date?: string;
      start_time?: string;
      mode?: string;
      note?: string;
      attendees?: unknown;   // شناسه‌یِ اعضایِ حاضر (migration 029)؛ نبود = همه
      pre_note?: string;     // یادداشتِ کوتاهِ پیش از جلسه (اختیاری)
    };

    if (mode !== undefined && mode !== 'live' && mode !== 'manual') {
      reply.code(400);
      return { error: 'نوعِ جلسه نامعتبر است' };
    }
    const isManual = mode === 'manual';

    // ⭐ برایِ ثبتِ جلسه‌ی گذشته، تاریخ اختیاری‌ست (تصمیمِ مالک، 2026-09-15): تراپیست ممکنه
    // دقیقِ تاریخِ پرونده‌ی قدیمی رو نداشته باشه؛ اگه نفرسته، به‌جایِ fallbackِ نادرستِ «امروز»
    // (migration 014) به‌صراحت NULL ذخیره می‌شه — «بدونِ تاریخ». جلسه‌ی زنده همچنان همیشه
    // تاریخِ واقعی می‌گیرد (fallback به وقتِ ایران، رفتارِ قبلی دست‌نخورده). ساعت برایِ manual
    // در UI اصلاً نمایش داده نمی‌شود؛ سرور همیشه با fallbackِ وقتِ ایران پر می‌کند.
    const hasDate = typeof date === 'string' && date.trim() !== '';
    const hasTime = typeof start_time === 'string' && start_time.trim() !== '';
    // ⭐ همه‌ی تاریخ‌ها شمسیِ `YYYY/MM/DD` با ارقامِ لاتین (migration 013) — قبلاً جلسه‌ی زنده
    // تاریخِ میلادیِ سرور می‌گرفت و «آخرین جلسه» (`MAX(date)` روی TEXT) غلط می‌شد.
    const now = nowInTehran();
    let sessionDate: string | null = null;
    if (hasDate) {
      sessionDate = normalizeSessionDate(date);
      if (!sessionDate) {
        reply.code(400);
        return { error: INVALID_DATE_ERROR };
      }
    } else if (!isManual) {
      sessionDate = now.date;
    }
    // isManual && !hasDate → sessionDate می‌ماند null («بدونِ تاریخ»، تصمیمِ مالک)
    const sessionTime = hasTime ? normalizeStartTime(start_time) : now.time;
    if (!sessionTime) {
      reply.code(400);
      return { error: INVALID_TIME_ERROR };
    }

    const client = await getOwnedClient(client_id, request.therapistId!);
    if (!client) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    // LAW-009: جلسه‌ی زنده فقط با رضایتِ صریح. رضایتِ یک‌باره‌ی ثبت‌شده‌ی همین مراجع (migration 024) هم معتبر است؛
    // رضایتِ تازه (consent:true) برایِ دفعاتِ بعد ثبت می‌شود — پس از ساختِ موفقِ جلسه (پایین).
    if (!isManual && consent !== true && !hasStoredConsent(client)) {
      reply.code(400);
      return { error: 'رضایت مراجع الزامی است', code: 'consent-required' };
    }

    // ⭐ مراجعِ غیرفعال جلسه‌ی زنده‌ی جدید نمی‌گیرد (کارت هم دکمه‌ی شروع ندارد). ادامه‌ی
    // جلسه‌ی نیمه‌تمامِ قبلی از این مسیر نمی‌گذرد و آزاد می‌ماند.
    if (!isManual && client.status === 'inactive') {
      reply.code(409);
      return { error: 'مراجع غیرفعال است؛ ابتدا او را به فعال‌ها بازگردانید', code: 'client-inactive' };
    }

    // شماره‌ی جلسه: MAX+1 با تکرار در تداخل (sessions.repository، رفعِ M7).
    if (isManual) {
      const noteText = typeof note === 'string' && note.trim() ? note.trim() : null;
      const sessionId = randomUUID();
      // یک تراکنشِ اتمیک: جلسه بدونِ یادداشتش (یا برعکس) نیمه‌کاره ساخته نمی‌شود.
      await createManualSession({ sessionId, clientId: client_id, date: sessionDate, time: sessionTime, noteText });
      const manual = await getSessionRow(sessionId);
      // ⭐ باگِ واقعیِ کشف‌شده (2026-09-18): trigger زدن اینجا بدونِ قیدِ noteText یک
      // raceِ واقعی می‌ساخت — اکثرِ جلساتِ دستی در همین لحظه هنوز هیچ یادداشتی ندارند
      // (یادداشت جداگانه بعداً با POST /notes اضافه می‌شود، صفحه‌ی archiveNoteAdd)؛
      // یک generateِ تقریباً-خالی همین‌جا شروع می‌شد و قفلِ نرمِ ۳دقیقه‌ای را می‌گرفت،
      // بعد trigger واقعیِ POST /notes (که محتوایِ واقعی دارد) با «busy» رد می‌شد و
      // بی‌صدا گم می‌شد. فقط وقتی trigger بزن که یادداشت همین‌جا، اتمیک، ثبت شده باشد؛
      // در غیرِ این صورت trigger روی POST /notes (پایینِ همین فایل) خودش کار را می‌کند.
      if (noteText !== null) {
        void maybeAutoGenerateCaseFile(client_id, request.therapistId!);
      }
      logEvent({ event: 'session.created', sessionId, clientId: client_id, therapistId: request.therapistId, detail: { mode: 'manual' } });
      reply.code(201);
      return {
        session: manual,
        client: { code: client.code, alias: client.alias },
      };
    }

    // زمینه‌ی جلسه (واحدِ درمان): حاضرین + یادداشتِ پیش از جلسه — هر دو اختیاری.
    let attendeeIds: string[] | null = null;
    try { attendeeIds = await treatmentUnits.attendeesForNewSession(client_id, attendees); }
    catch (e) {
      if (e instanceof TreatmentUnitValidationError) { reply.code(400); return { error: e.message, code: e.code }; }
      throw e;
    }
    const preNote = typeof pre_note === 'string' && pre_note.trim() ? pre_note.trim() : null;
    if (preNote && preNote.length > PRE_NOTE_MAX_CHARS) {
      reply.code(400);
      return { error: 'یادداشتِ پیش از جلسه بیش از حد طولانی است', code: 'pre-note-too-long' };
    }

    const newId = randomUUID();
    await createLiveSession({
      sessionId: newId, clientId: client_id, date: sessionDate, time: sessionTime,
      attendees: attendeeIds ? JSON.stringify(attendeeIds) : null, preNote,
    });
    const created = await getSessionRow(newId);
    logEvent({ event: 'session.created', sessionId: newId, clientId: client_id, therapistId: request.therapistId, detail: { mode: 'live' } });
    if (consent === true) await recordClientConsent(client_id, request.therapistId!);
    const consentRow = await getClientConsentRow(client_id);

    reply.code(201);
    return {
      session: created,
      client: { code: client.code, alias: client.alias, recording_consent_at: consentRow?.recording_consent_at ?? null },
    };
  });

  // GET /api/sessions/:id — جزئیات جلسه + یادداشت‌ها
  app.get('/api/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const session = await getOwnedSessionWithClient(id, request.therapistId);

    if (!session) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    const notes = await listSessionNotes(id);

    return {
      session,
      notes,
    };
  });

  // PUT /api/sessions/:id — با محافظ نسخه برای transcript (جلوگیری از overwrite stale)
  app.put('/api/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      transcript?: string;
      transcript_version?: number;
      realtime_reliable?: boolean;
      stt_mode?: string;
      anchors?: Array<{ chars: number; off: number }>;
      duration_ms?: number;
      status?: string;
      date?: string | null;
      start_time?: string;
    };

    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    // R5 (subsystem 03 §2/§5): پیش‌بررسیِ زیر (SELECT جدا) به‌تنهایی CAS نیست — بینِ این
    // SELECT و UPDATEِ پایینِ تابع یک پنجره‌ی race باز بود: دو PUTِ هم‌زمان با همان نسخه‌ی
    // پایه می‌توانستند هر دو از این چک عبور کنند و هر دو UPDATE موفق شوند (یکی متنِ
    // دیگری را بی‌صدا overwrite می‌کرد). الان پیش‌بررسی فقط برایِ خطایِ سریع/واضح نگه
    // داشته شده؛ گاردِ واقعی همان `AND transcript_version = ?`ی اتمیکِ پایینِ همین تابع
    // است که مستقیماً در WHEREِ UPDATE می‌آید (پیشنهادِ همان سند، بخشِ ۵.۴).
    let versionGuard: number | undefined;
    if (body.transcript !== undefined) {
      // فیکسِ نشتِ حریمِ‌خصوصی (فازِ ۱ِ رصد/حسابرسی، 2026-09-22، LAW-001): این‌جا قبلاً
      // ۸۰ نویسه‌ی آخرِ متنِ بالینی را مستقیم در stdout لاگ می‌کرد (console.log
      // [diag-transcript]). جایگزین: فقط متادیتای امن (طول/نسخه) از طریقِ logEvent.
      logEvent({ event: 'session.transcript_put', sessionId: id, therapistId: request.therapistId, detail: { len: body.transcript.length, version: body.transcript_version } });
      // ✅ Compare-and-swap: اگر caller نسخه‌ی پایه بفرستد و با DB نخورد → 409، نه overwrite.
      // callerهای قدیمی (بدون transcript_version) همچنان پذیرفته‌اند (سازگاری عقبرو).
      if (typeof body.transcript_version === 'number') {
        const cv: number = (await getTranscriptVersionRow(id))?.transcript_version ?? 0;
        if (cv !== body.transcript_version) {
          logEvent({ event: 'session.transcript_conflict', sessionId: id, therapistId: request.therapistId, severity: 'warn', detail: { version: body.transcript_version, prev_version: cv } });
          reply.code(409);
          return {
            error: 'نسخه‌ی transcript قدیمی است؛ ابتدا تازه‌سازی کنید',
            code: 'version-conflict',
            current_version: cv,
          };
        }
        versionGuard = body.transcript_version;
      }
      updates.push(`transcript = ?`);
      values.push(body.transcript);
      // هر write موفق، نسخه را یکی جلو می‌برد — اتمیک در همین UPDATE
      updates.push(`transcript_version = transcript_version + 1`);
    }
    if (body.realtime_reliable !== undefined) {
      updates.push(`realtime_reliable = ?`);
      values.push(body.realtime_reliable);
    }
    if (body.stt_mode !== undefined) {
      updates.push(`stt_mode = ?`);
      values.push(body.stt_mode);
    }
    if (body.anchors !== undefined) {
      updates.push(`anchors = ?`);
      values.push(JSON.stringify(body.anchors));
    }
    if (body.duration_ms !== undefined) {
      updates.push(`duration_ms = ?`);
      values.push(body.duration_ms);
    }
    let reopened = false;
    if (body.status !== undefined) {
      // ⭐ (A5، 2026-09-26) قبلاً هر رشته‌ای پذیرفته و هر انتقالی مجاز بود (مثلاً completed → in_progress با یک
      // PUTِ دیررسیده از تبِ دیگر). حالا فقط statusهایِ شناخته‌شده؛ completed/canceled نهایی‌اند، جز جلسه‌ای که
      // worker خودکار بسته (auto_closed_at) و تراپیست ادامه‌اش می‌دهد (A3).
      const ALLOWED_STATUS = ['in_progress', 'recovered', 'completed', 'canceled'];
      if (!ALLOWED_STATUS.includes(body.status)) {
        reply.code(400);
        return { error: 'وضعیتِ جلسه نامعتبر است', code: 'invalid-status' };
      }
      const cur = String(owned.status || '');
      if (cur !== body.status) {
        reopened = cur === 'completed' && body.status === 'in_progress' && !!owned.auto_closed_at;
        const open = cur === 'in_progress' || cur === 'recovered';
        if (!open && !reopened) {
          reply.code(409);
          return { error: 'این جلسه پایان یافته و قابلِ تغییرِ وضعیت نیست', code: 'invalid-transition', status: cur };
        }
      }
      updates.push(`status = ?`);
      values.push(body.status);
      if (reopened) updates.push(`auto_closed_at = NULL`);
    }
    if (body.date !== undefined) {
      const dateIsEmpty = body.date === null || (typeof body.date === 'string' && body.date.trim() === '');
      if (dateIsEmpty) {
        // ⭐ پاک‌کردنِ تاریخ فقط برایِ جلسه‌ی دستی معنا دارد («بدونِ تاریخ» — تصمیمِ مالک،
        // migration 014). جلسه‌ی زنده/کامل باید همیشه تاریخِ واقعی داشته باشد.
        // جلسه‌ی ساخته‌شده از فایلِ آپلودی (migration 023) هم مثلِ دستی تاریخِ اختیاری دارد.
        if (owned.source !== 'manual' && owned.source !== 'upload') {
          reply.code(400);
          return { error: INVALID_DATE_ERROR };
        }
        updates.push(`date = NULL`);
      } else {
        const normalizedDate = normalizeSessionDate(body.date);
        if (!normalizedDate) {
          reply.code(400);
          return { error: INVALID_DATE_ERROR };
        }
        updates.push(`date = ?`);
        values.push(normalizedDate);
      }
    }
    if (body.start_time !== undefined) {
      const normalizedTime = normalizeStartTime(body.start_time);
      if (!normalizedTime) {
        reply.code(400);
        return { error: INVALID_TIME_ERROR };
      }
      updates.push(`start_time = ?`);
      values.push(normalizedTime);
    }

    if (updates.length === 0) {
      reply.code(400);
      return { error: 'چیزی برای به‌روزرسانی نیست' };
    }

    updates.push(`updated_at = NOW()`);
    // گاردِ مالکیت + گاردِ اتمیکِ transcript_version در WHEREِ همین UPDATE (sessions.repository).
    const updatedRows = await updateOwnedSession(updates, values, id, request.therapistId, versionGuard);

    if (updatedRows === 0) {
      if (versionGuard !== undefined) {
        // یا جلسه/مالکیت پیدا نشد، یا نسخه دقیقاً همین بینِ پیش‌بررسیِ بالا و همین UPDATE
        // توسطِ یک نویسنده‌ی هم‌زمانِ دیگر عوض شده — تشخیصِ صریح برایِ پیامِ درست:
        const recheck = await getOwnedTranscriptVersionRow(id, request.therapistId);
        if (!recheck) {
          reply.code(404);
          return { error: 'جلسه یافت نشد' };
        }
        reply.code(409);
        return {
          error: 'نسخه‌ی transcript قدیمی است؛ ابتدا تازه‌سازی کنید',
          code: 'version-conflict',
          current_version: recheck.transcript_version,
        };
      }
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    const updatedSession = await getSessionRow(id);
    if (reopened) logEvent({ event: 'session.reopened', sessionId: id, therapistId: request.therapistId });
    if (body.status === 'completed') {
      // fire-and-forget — پایانِ کاملِ جلسه (زنده یا دستی) یکی از دو نقطه‌ی تریگرِ
      // auto-generate است؛ نقطه‌ی دیگر ساختِ جلسه‌ی دستی در بالاست.
      void maybeAutoGenerateCaseFile(owned.client_id, request.therapistId!);
      // «متنِ نهایی» (فقط اگر درمانگر روشن کرده) — idempotent، هرگز پرتاب نمی‌کند. جلسه‌ی دستی متنِ رونویسی ندارد.
      if (owned.source !== 'manual') void enqueueFinalTranscript(id);
    }
    return { session: updatedSession };
  });

  // DELETE /api/sessions/:id
  app.delete('/api/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    const media = await prepareSessionMediaPurge([id]);
    if ((await deleteOwnedSession(id, request.therapistId)) === 0) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    // LAW-010: بعدِ حذفِ موفقِ ردیفِ DB، فایل‌هایِ آرشیوشده‌ی همین جلسه رویِ دیسک را هم پاک کن
    // (وگرنه یتیم می‌مانند — cascadeِ DB فقط ردیف را می‌بیند، نه فایل).
    purgeSessionMedia(media);
    logEvent({ event: 'session.deleted', sessionId: id, therapistId: request.therapistId });
    await recordAudit({ actorId: request.therapistId, action: 'therapist.session_delete', targetType: 'session', targetId: id });

    return { deleted: id };
  });

  // ===== (A5، 2026-09-26) ذخیره‌ی فقط دُمِ متن هنگامِ بستنِ صفحه =====
  // PUTِ keepaliveِ مرورگر سقفِ ~۶۴KB دارد؛ برایِ جلسه‌ی طولانی (متنِ > ۶۰KB) flushِ pagehide قبلاً هیچ کاری نمی‌کرد و دُمِ
  // متنِ بعد از آخرین autosave گم می‌شد. اینجا فقط دُم با CAS رویِ transcript_version به انتهایِ متنِ همان نسخه اضافه می‌شود.
  const MAX_TAIL_CHARS = 60000;
  app.post('/api/sessions/:id/transcript-tail', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { base_version?: number; tail?: string };
    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }
    if (typeof body.base_version !== 'number' || typeof body.tail !== 'string' || !body.tail || body.tail.length > MAX_TAIL_CHARS) {
      reply.code(400);
      return { error: 'درخواستِ نامعتبر', code: 'bad-tail' };
    }
    if ((await appendTranscriptTail(id, body.tail, body.base_version)) !== 1) {
      const cur = await getTranscriptVersionRow(id);
      logEvent({ event: 'session.transcript_conflict', sessionId: id, therapistId: request.therapistId, severity: 'warn', detail: { version: body.base_version, prev_version: cur?.transcript_version, source: 'tail' } });
      reply.code(409);
      return { error: 'نسخه‌ی transcript قدیمی است', code: 'version-conflict', current_version: cur?.transcript_version };
    }
    logEvent({ event: 'session.transcript_put', sessionId: id, therapistId: request.therapistId, detail: { len: body.tail.length, version: body.base_version, source: 'tail' } });
    const r = await getTranscriptVersionRow(id);
    return { ok: true, transcript_version: r?.transcript_version };
  });
}
