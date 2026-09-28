// فقط I/O: احراز، مالکیتِ جلسه (LAW-004)، تنظیمِ درمانگر. متنِ نهایی فقط به مالکِ جلسه برمی‌گردد و لاگ نمی‌شود.
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../../auth/guard.js';
import { getOwnedSession } from '../../../db/ownership.js';
import { query } from '../../../db/connection.js';
import { logEvent } from '../../../obs/eventLog.js';
import { retryFinalTranscript, enqueueFinalTranscript } from '../runner.js';

export async function finalTranscriptRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET ⇒ { enabled, stage, clean_text (فقط done), source, stale, error_code, report }
  app.get('/api/sessions/:id/final-transcript', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await getOwnedSession(id, request.therapistId!))) { reply.code(404); return { error: 'جلسه یافت نشد' }; }
    const t = await query('SELECT final_transcript_enabled FROM therapists WHERE id = ?', [request.therapistId]);
    const r = await query(
      `SELECT f.stage, f.source, f.source_version, f.clean_text, f.error_code, f.polish_report, s.transcript_version
         FROM final_transcripts f JOIN sessions s ON s.id = f.session_id WHERE f.session_id = ?`, [id]);
    const row = r.rows[0];
    const enabled = !!t.rows[0]?.final_transcript_enabled;
    if (!row) return { enabled, stage: null };
    let report: any = row.polish_report;
    if (typeof report === 'string') { try { report = JSON.parse(report); } catch { report = null; } }
    return {
      enabled,
      stage: row.stage,
      source: row.source,
      stale: row.stage === 'done' && Number(row.transcript_version || 0) > Number(row.source_version ?? -1),
      clean_text: row.stage === 'done' ? row.clean_text : null,
      error_code: row.error_code,
      report: report ? { chunks: report.chunks ?? null, fallback_chunks: report.fallback_chunks ?? null, turns: report.turns ?? null, fallback_turns: report.fallback_turns ?? null, uncertain: report.uncertain ?? null } : null,
    };
  });

  // POST retry — failed/skipped یا done ِ stale. جلسه‌ای که هنوز ردیف ندارد (قابلیت بعداً روشن شد) ⇒ enqueue.
  app.post('/api/sessions/:id/final-transcript/retry', async (request, reply) => {
    const { id } = request.params as { id: string };
    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) { reply.code(404); return { error: 'جلسه یافت نشد' }; }
    let res = await retryFinalTranscript(id);
    if (res === 'not-found') {
      if (owned.status !== 'completed') { reply.code(409); return { error: 'جلسه هنوز پایان نیافته است', code: 'session-not-completed' }; }
      res = (await enqueueFinalTranscript(id)) ? 'queued' : 'not-found';
      if (res === 'not-found') { reply.code(403); return { error: 'متنِ نهایی برایِ حسابِ شما فعال نیست', code: 'forbidden' }; }
    }
    if (res === 'busy') { reply.code(409); return { error: 'متنِ نهایی در حالِ آماده‌سازی است', code: 'busy' }; }
    if (res === 'fresh') { reply.code(409); return { error: 'متنِ نهایی به‌روز است', code: 'fresh' }; }
    logEvent({ event: 'final_transcript.retry', sessionId: id, therapistId: request.therapistId });
    return { ok: true };
  });
  // روشن/خاموش فقط از پنلِ ادمین (PATCH /api/admin/therapists/:id) — تصمیمِ مالک 2026-09-28: درمانگر خودش تنظیمی ندارد.
}
