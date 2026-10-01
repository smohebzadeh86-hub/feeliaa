// فقط I/O: احراز، مالکیتِ جلسه (LAW-004)، تنظیمِ درمانگر. متنِ نهایی فقط به مالکِ جلسه برمی‌گردد و لاگ نمی‌شود.
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../../auth/guard.js';
import { getOwnedSession } from '../../../db/ownership.js';
import { query, pool } from '../../../db/connection.js';
import { lockCurrent, snapshotBaselineIfMissing, appendCurrentAsVersion } from '../adapters/versionStore.js';
import { logEvent } from '../../../obs/eventLog.js';
import { retryFinalTranscript, enqueueFinalTranscript } from '../runner.js';
import { treatmentUnits } from '../../treatment-unit/index.js';
import { allowedRoles, applyRoleEdit } from '../domain/roleEdit.js';
import type { CleanTurn } from '../domain/transcriptText.js';

function parseJson(v: unknown): any {
  if (typeof v !== 'string') return v ?? null;
  try { return JSON.parse(v); } catch { return null; }
}

// ردیفِ قدیمی (پیش از migration 034) یا دادهٔ بدشکل ⇒ null (UI همان clean_text را نشان می‌دهد)
function parseTurnsJson(v: unknown): CleanTurn[] | null {
  const a = parseJson(v);
  if (!Array.isArray(a) || !a.length) return null;
  return a.every((t) => t && typeof t.text === 'string' && (t.marker || typeof t.role === 'string')) ? a as CleanTurn[] : null;
}

export async function finalTranscriptRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET ⇒ { enabled, stage, clean_text (فقط done), source, stale, error_code, report }
  app.get('/api/sessions/:id/final-transcript', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await getOwnedSession(id, request.therapistId!))) { reply.code(404); return { error: 'جلسه یافت نشد' }; }
    const t = await query('SELECT final_transcript_enabled FROM therapists WHERE id = ?', [request.therapistId]);
    const r = await query(
      `SELECT f.stage, f.source, f.source_version, f.clean_text, f.clean_turns, f.error_code, f.polish_report, s.transcript_version
         FROM final_transcripts f JOIN sessions s ON s.id = f.session_id WHERE f.session_id = ?`, [id]);
    const row = r.rows[0];
    const enabled = !!t.rows[0]?.final_transcript_enabled;
    if (!row) return { enabled, stage: null };
    const report: any = parseJson(row.polish_report);
    const done = row.stage === 'done';
    const turns = done ? parseTurnsJson(row.clean_turns) : null;
    return {
      enabled,
      stage: row.stage,
      source: row.source,
      stale: done && Number(row.transcript_version || 0) > Number(row.source_version ?? -1),
      clean_text: done ? row.clean_text : null,
      // نوبت‌هایِ ساختاریافته (migration 034): نقش، متن، متنِ خامِ سازنده، شماره‌ی گوینده — فقط برایِ مالکِ جلسه
      turns,
      roles: turns ? allowedRoles(await treatmentUnits.sessionSpeakerRoster(id), turns) : null,
      // شماره‌ی گوینده فقط در گذرِ asyncِ کامل در کلِ جلسه یکدست است (realtime با هر reconnect از نو)
      speaker_edit: done && row.source === 'async',
      error_code: row.error_code,
      report: report ? { chunks: report.chunks ?? null, fallback_chunks: report.fallback_chunks ?? null, turns: report.turns ?? null, fallback_turns: report.fallback_turns ?? null, uncertain: report.uncertain ?? null } : null,
    };
  });

  // PATCH نقشِ گوینده — { indices, role, same_speaker } ⇒ { clean_text, turns }. فقط نقش عوض می‌شود، نه متن.
  // هم‌روندی: UPDATE فقط اگر همان نسخه‌ی خوانده‌شده هنوز سر جایش است (finished_at) — «ساختِ دوباره»یِ هم‌زمان برنده است.
  app.patch('/api/sessions/:id/final-transcript/roles', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await getOwnedSession(id, request.therapistId!))) { reply.code(404); return { error: 'جلسه یافت نشد' }; }
    const body = (request.body || {}) as { indices?: unknown; role?: unknown; same_speaker?: unknown };
    const r = await query('SELECT stage, source, clean_turns, finished_at FROM final_transcripts WHERE session_id = ?', [id]);
    const row = r.rows[0];
    const turns = row?.stage === 'done' ? parseTurnsJson(row.clean_turns) : null;
    if (!turns) { reply.code(409); return { error: 'این متنِ نهایی قابلِ اصلاحِ نقش نیست', code: 'not-editable' }; }
    const sameSpeaker = body.same_speaker === true && row.source === 'async';
    const res = applyRoleEdit(turns, {
      indices: Array.isArray(body.indices) ? body.indices.map((x) => Number(x)) : [],
      role: String(body.role ?? ''),
      sameSpeaker,
    }, allowedRoles(await treatmentUnits.sessionSpeakerRoster(id), turns));
    if (!res.ok) { reply.code(400); return { error: res.error === 'bad-role' ? 'نقشِ نامعتبر' : 'نوبتِ نامعتبر', code: res.error }; }
    if (res.changed) {
      // تاریخچه (migration 037): نسخه‌ی پیش و پس از اصلاح هر دو می‌مانند؛ همه در یک تراکنش با قفلِ ردیف.
      const conn = await pool.getConnection();
      let updated = 0;
      try {
        await conn.beginTransaction();
        await lockCurrent(conn, id);
        await snapshotBaselineIfMissing(conn, id);
        const [u] = await conn.query(
          `UPDATE final_transcripts SET clean_text = ?, clean_turns = ? WHERE session_id = ? AND stage = 'done' AND finished_at <=> ?`,
          [res.text, JSON.stringify(res.turns), id, row.finished_at]);
        updated = (u as any).affectedRows || 0;
        if (updated) await appendCurrentAsVersion(conn, id, 'role_edit', request.therapistId ?? null);
        await conn.commit();
      } catch (e) {
        try { await conn.rollback(); } catch {}
        throw e;
      } finally {
        conn.release();
      }
      if (!updated) { reply.code(409); return { error: 'متنِ نهایی هم‌زمان دوباره ساخته شد — صفحه را تازه کنید', code: 'conflict' }; }
      logEvent({ event: 'final_transcript.role_edit', sessionId: id, therapistId: request.therapistId, detail: { count: res.changed, mode: sameSpeaker ? 'speaker' : 'turn' } });
    }
    return { clean_text: res.text, turns: res.turns, changed: res.changed };
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
