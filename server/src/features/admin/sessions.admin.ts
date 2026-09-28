// ادمین: جلسه (متن + یادداشت‌ها، فقط‌خواندنی)، فهرستِ سراسریِ جلساتِ اخیر، تشخیص و timeline. pluginِ فرزندِ
// adminRoutes (requireAdmin).
import { FastifyInstance } from 'fastify';
import { listSessionAudio } from '../transcription/archive/listing.js';
import { pendingAudiosFor } from '../transcription/batch/queueFiles.js';
import { recordAudit } from '../../obs/audit.js';
import { diagnoseSession } from './diagnosis.js';
import {
  getSessionWithTranscript, listSessionNotesForAdmin, listRecentSessions, getSessionForDiagnosis, listSessionEventsBrief,
  listSessionUiEventsBrief, getSessionTimelineHead, listSessionEvents, listSessionUiEvents, listSessionNotesMeta,
} from './admin.repository.js';

export async function sessionsAdminRoutes(app: FastifyInstance) {
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

  // ————————————————— لایه‌ی رصد/حسابرسی — فازِ ۱ (پنلِ ادمین) —————————————————

  // GET /api/admin/sessions/recent — فهرستِ سراسریِ جلساتِ اخیر/ناتمام (مشکلِ کشف‌پذیریِ
  // شرح‌داده‌شده در پلن: «تراپیست ضبط کرد، ثبت نهایی نزد، هیچ‌چی نمی‌تونم بازیابی کنم»).
  // خودِ متنِ رونویسی هرگز SELECT نمی‌شود — فقط CHAR_LENGTH (نه LENGTH؛ فارسیِ utf8mb4 چندبایتی است).
  app.get('/api/admin/sessions/recent', async (request, reply) => {
    const q = request.query as {
      status?: string; since_hours?: string; therapist_id?: string;
      has_transcript?: string; limit?: string; offset?: string;
    };
    const status = q.status === 'completed' || q.status === 'all' ? q.status : 'in_progress';
    const sinceHoursRaw = Number(q.since_hours);
    const sinceHours = Number.isFinite(sinceHoursRaw) && sinceHoursRaw > 0 ? Math.min(sinceHoursRaw, 24 * 365) : 168;
    const limitRaw = Number(q.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 200) : 50;
    const offsetRaw = Number(q.offset);
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;

    const conditions: string[] = ['s.updated_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)'];
    const params: unknown[] = [sinceHours];
    if (status !== 'all') { conditions.push('s.status = ?'); params.push(status); }
    if (q.therapist_id) { conditions.push('t.id = ?'); params.push(q.therapist_id); }
    if (q.has_transcript === 'true') conditions.push('CHAR_LENGTH(s.transcript) > 0');
    else if (q.has_transcript === 'false') conditions.push('(s.transcript IS NULL OR CHAR_LENGTH(s.transcript) = 0)');

    return { sessions: await listRecentSessions(conditions, params, limit, offset) };
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
    return diagnoseSession({ s, audioRows, pendingCount, ev, ui });
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
