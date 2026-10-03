// ادمین: جلسه (متن + یادداشت‌ها، فقط‌خواندنی)، فهرستِ سراسریِ جلساتِ اخیر، تشخیص و timeline. pluginِ فرزندِ
// adminRoutes (requireAdmin).
import { FastifyInstance } from 'fastify';
import { listSessionAudio, pendingAudiosFor, listSkips } from '../transcription/index.js';
import { recordAudit } from '../../obs/audit.js';
import { listFinalTranscriptVersions, getFinalTranscriptVersion } from '../final-transcript/index.js';
import { diagnoseSession } from './diagnosis.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { liveHealth, LIVE_WINDOW_HOURS } from './liveHealth.js';
import {
  getSessionWithTranscript, listSessionNotesForAdmin, listRecentSessions, RECENT_SORTS, getSessionForDiagnosis, listSessionEventsBrief,
  listSessionUiEventsBrief, listUploadJobsForDiagnosis, getFinalTranscriptForDiagnosis, getSessionTimelineHead, listSessionEvents, listSessionUiEvents, listSessionNotesMeta, listLiveSessions, restoreDeletedSession } from './admin.repository.js';

export async function sessionsAdminRoutes(app: FastifyInstance) {
  // GET /api/admin/sessions/live — جلساتِ زنده‌ی در حالِ ضبط (فقط وضعیت، بدونِ شنودِ زنده — تصمیمِ مالک 2026-10-01).
  // فقط متادیتا؛ بدونِ audit (متنِ بالینی برنمی‌گردد).
  app.get('/api/admin/sessions/live', async () => {
    const rows = await listLiveSessions(LIVE_WINDOW_HOURS);
    return {
      sessions: rows.map((r) => {
        const lastAge = r.last_segment_age_s === null || r.last_segment_age_s === undefined ? null : Number(r.last_segment_age_s);
        return {
          id: r.id, session_num: r.session_num, client_id: r.client_id, client_code: r.client_code,
          therapist_id: r.therapist_id, therapist_name: r.therapist_name,
          duration_ms: r.duration_ms === null ? null : Number(r.duration_ms), updated_at: r.updated_at, auto_closed_at: r.auto_closed_at ?? null,
          segment_count: Number(r.seg_count || 0), segment_bytes: Number(r.seg_bytes || 0), last_segment_age_s: lastAge,
          transcript_len: Number(r.transcript_len || 0),
          health: liveHealth(lastAge, Number(r.since_update_s || 0)),
        };
      }),
    };
  });

  // GET /api/admin/sessions/:id — متنِ کاملِ رونویسی + همه‌ی یادداشت‌ها/علائمِ یک جلسه
  // (تصمیمِ مالک D2، 2026-09-15: دسترسیِ کاملِ ادمین داخلِ پنل، فقط‌خواندنی؛ بدونِ لاگِ متن، LAW-001).
  app.get('/api/admin/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await getSessionWithTranscript(id);
    if (!session) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }
    const notes = await listSessionNotesForAdmin(id);
    // (A6) مشاهده‌ی متنِ بالینیِ یک جلسه توسطِ ادمین ممیزی می‌شود.
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.session_view', targetType: 'session', targetId: id });
    return { session, notes };
  });

  // GET /api/admin/sessions/:id/final-transcript/versions — تاریخچه‌ی «متنِ نهایی» (migration 037)، فقط متادیتا (بدونِ متن).
  app.get('/api/admin/sessions/:id/final-transcript/versions', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!UUID_RE.test(id)) { reply.code(404); return { error: 'جلسه یافت نشد' }; }
    return { versions: await listFinalTranscriptVersions(id) };
  });

  // GET /api/admin/sessions/:id/final-transcript/versions/:v — متنِ یک نسخه؛ مشاهده ممیزی می‌شود (مثلِ متنِ جلسه).
  app.get('/api/admin/sessions/:id/final-transcript/versions/:v', async (request, reply) => {
    const { id, v } = request.params as { id: string; v: string };
    const n = Number(v);
    if (!UUID_RE.test(id) || !Number.isInteger(n) || n < 1) { reply.code(404); return { error: 'نسخه یافت نشد' }; }
    const row = await getFinalTranscriptVersion(id, n);
    if (!row) { reply.code(404); return { error: 'نسخه یافت نشد' }; }
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.session_view', targetType: 'session', targetId: id, detail: { final_transcript_version: n } });
    return row;
  });

  // ————————————————— لایه‌ی رصد/حسابرسی — فازِ ۱ (پنلِ ادمین) —————————————————

  // GET /api/admin/sessions/recent — فهرستِ سراسریِ جلساتِ اخیر/ناتمام (مشکلِ کشف‌پذیریِ
  // شرح‌داده‌شده در پلن: «تراپیست ضبط کرد، ثبت نهایی نزد، هیچ‌چی نمی‌تونم بازیابی کنم»).
  // خودِ متنِ رونویسی هرگز SELECT نمی‌شود — فقط CHAR_LENGTH (نه LENGTH؛ فارسیِ utf8mb4 چندبایتی است).
  app.get('/api/admin/sessions/recent', async (request, reply) => {
    const q = request.query as {
      status?: string; since_hours?: string; therapist_id?: string;
      has_transcript?: string; limit?: string; offset?: string; deleted?: string; sort?: string; dir?: string;
    };
    const status = q.status === 'completed' || q.status === 'canceled' || q.status === 'all' ? q.status : 'in_progress';
    const sinceHoursRaw = Number(q.since_hours);
    const sinceHours = Number.isFinite(sinceHoursRaw) && sinceHoursRaw > 0 ? Math.min(sinceHoursRaw, 24 * 365) : 168;
    const limitRaw = Number(q.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 200) : 50;
    const offsetRaw = Number(q.offset);
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;

    // پنجره‌ی زمانی رویِ «آخرین فعالیت» (نوشتن یا ضبط)، نه فقط updated_at — جلسه‌ای که تازه ضبط شده نباید از فهرست بیفتد.
    const conditions: string[] = ["GREATEST(s.updated_at, COALESCE((SELECT MAX(a.created_at) FROM session_audio a WHERE a.session_id = s.id AND a.kind = 'session'), s.updated_at)) >= DATE_SUB(NOW(), INTERVAL ? HOUR)"];
    const params: unknown[] = [sinceHours];
    if (status !== 'all') { conditions.push('s.status = ?'); params.push(status); }
    if (q.therapist_id) { conditions.push('t.id = ?'); params.push(q.therapist_id); }
    // حذفِ نرم (042): پیش‌فرض همه (حذف‌شده‌ها هم دیده می‌شوند، با deleted_at)؛ deleted=only فقط حذف‌شده‌ها، deleted=false بدونِ آن‌ها
    if (q.deleted === 'only') conditions.push('s.deleted_at IS NOT NULL');
    else if (q.deleted === 'false') conditions.push('s.deleted_at IS NULL');
    if (q.has_transcript === 'true') conditions.push('CHAR_LENGTH(s.transcript) > 0');
    else if (q.has_transcript === 'false') conditions.push('(s.transcript IS NULL OR CHAR_LENGTH(s.transcript) = 0)');

    const sort = q.sort && q.sort in RECENT_SORTS ? q.sort : 'activity';
    return { sessions: await listRecentSessions(conditions, params, limit, offset, sort, q.dir === 'asc' ? 'asc' : 'desc') };
  });

  // POST /api/admin/sessions/:id/restore — بازگردانیِ جلسه‌یِ حذف‌شده (حذفِ نرمِ تراپیست، migration 042) به فهرستِ خودِ تراپیست
  app.post('/api/admin/sessions/:id/restore', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!UUID_RE.test(id)) { reply.code(404); return { error: 'جلسه یافت نشد' }; }
    if ((await restoreDeletedSession(id)) === 0) { reply.code(404); return { error: 'جلسه‌یِ حذف‌شده یافت نشد' }; }
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.session_restore', targetType: 'session', targetId: id });
    return { restored: id };
  });

  // GET /api/admin/sessions/:id/diagnosis — «چه اتفاقی افتاد؟» به زبانِ ساده (audit ذخیره‌سازی 2026-09-26).
  // ادمین قبلاً فقط رویدادهایِ خام (timeline) داشت و نمی‌توانست بفهمد صدا سکوت بوده، میکروفون قطع شده،
  // صفحه پنهان شده یا پایان کِی زده شده. همه از داده‌یِ موجود محاسبه می‌شود؛ متنِ بالینی برگردانده نمی‌شود
  // (فقط شمارش/طول — LAW-001).
  app.get('/api/admin/sessions/:id/diagnosis', async (request, reply) => {
    const { id } = request.params as { id: string };
    const s = await getSessionForDiagnosis(id);
    if (!s) { reply.code(404); return { error: 'جلسه یافت نشد' }; }
    const audioRows = (await listSessionAudio(id)).filter((r) => r.kind === 'session');
    const pendingCount = pendingAudiosFor(id, 'transcript').length + pendingAudiosFor(id, 'late-transcript').length + pendingAudiosFor(id, 'archive').length;
    const ev = await listSessionEventsBrief(id);
    const ui = await listSessionUiEventsBrief(id);
    const uploadJobs = s.source === 'upload' ? await listUploadJobsForDiagnosis(id) : [];
    const finalTranscript = await getFinalTranscriptForDiagnosis(id);
    const skips = (await listSkips([id])).get(id) ?? [];
    return diagnoseSession({ s, audioRows, skips, pendingCount, ev, ui, uploadJobs, finalTranscript });
  });

  // GET /api/admin/sessions/:id/timeline — همه‌ی رویدادهایِ مرتبط با یک جلسه، مرتب بر ts.
  app.get('/api/admin/sessions/:id/timeline', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await getSessionTimelineHead(id);
    if (!session) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    type TimelineItem = {
      ts: string; lane: 'server' | 'client' | 'ui' | 'audio' | 'note' | 'db'; label: string; detail: Record<string, unknown>;
    };
    const items: TimelineItem[] = [];

    const events = await listSessionEvents(id);
    for (const r of events) {
      items.push({
        ts: r.ts, lane: r.source === 'client' ? 'client' : 'server', label: r.event,
        detail: { severity: r.severity, code: r.code, duration_ms: r.duration_ms, status_code: r.status_code, route: r.route, method: r.method, ...(r.detail || {}) },
      });
    }

    const uiEvents = await listSessionUiEvents(id);
    for (const r of uiEvents) {
      items.push({
        ts: r.ts, lane: 'ui', label: 'ui.' + r.kind,
        detail: { screen: r.screen, target_id: r.target_id, target_role: r.target_role, target_tag: r.target_tag, value_num: r.value_num },
      });
    }

    const audio = await listSessionAudio(id);
    for (const r of audio) {
      items.push({
        ts: r.created_at, lane: 'audio', label: 'audio.segment',
        detail: { seq: r.seq, bytes: r.bytes, kind: r.kind, source: r.source, duration_ms: r.duration_ms },
      });
    }

    // متنِ یادداشت هرگز SELECT نمی‌شود — فقط متادیتا (LAW-001).
    const notes = await listSessionNotesMeta(id);
    for (const r of notes) {
      items.push({ ts: r.created_at, lane: 'note', label: 'note.' + r.type, detail: { sign_type: r.sign_type, text_len: r.text_len } });
    }

    items.push({ ts: session.created_at, lane: 'db', label: 'session.created_at', detail: {} });
    items.push({ ts: session.updated_at, lane: 'db', label: 'session.updated_at', detail: { status: session.status } });

    items.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    return { timeline: items };
  });
}
