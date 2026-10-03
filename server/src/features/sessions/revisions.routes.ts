// مرور و بازگردانیِ تاریخچه‌ی متنِ خامِ جلسه (F8، 2026-10-02). جدولِ session_transcript_revisions (migration 040) تا اینجا
// فقط‌نوشتنی بود؛ حالا مالکِ جلسه می‌تواند فهرست را ببیند، یک نسخه را با diffِ پاراگرافی نسبت به متنِ فعلی بخواند و بازگرداند.
// بازگردانی = یک نوشتنِ CAS-دار (مثلِ PUT): متنِ فعلی پیش از جایگزینی در همان تاریخچه ثبت می‌شود، پس خودِ بازگردانی هم برگشت‌پذیر است.
// ⚠️ LAW-001: متن هرگز لاگ نمی‌شود؛ LAW-004: فقط مالکِ جلسه.
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../auth/guard.js';
import { getOwnedSession } from '../../db/ownership.js';
import { logEvent } from '../../obs/eventLog.js';
import {
  listTranscriptRevisions, getTranscriptRevision, updateOwnedSession, insertTranscriptRevision, getTranscriptVersionRow,
} from './sessions.repository.js';
import { diffParagraphs, diffSummary } from './transcriptDiff.js';

export async function sessionRevisionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET فهرست (فقط متادیتا) — جدیدترین اول
  app.get('/api/sessions/:id/transcript-revisions', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await getOwnedSession(id, request.therapistId!))) { reply.code(404); return { error: 'جلسه یافت نشد' }; }
    const rows = await listTranscriptRevisions(id);
    return { revisions: rows };
  });

  // GET یک نسخه + diff نسبت به متنِ فعلی
  app.get('/api/sessions/:id/transcript-revisions/:rid', async (request, reply) => {
    const { id, rid } = request.params as { id: string; rid: string };
    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) { reply.code(404); return { error: 'جلسه یافت نشد' }; }
    const rev = await getTranscriptRevision(id, Number(rid));
    if (!rev) { reply.code(404); return { error: 'نسخه یافت نشد' }; }
    const { ops, truncated } = diffParagraphs(rev.text, String(owned.transcript || ''));
    return {
      revision: { id: rev.id, version: rev.version, cause: rev.cause, chars: rev.chars, created_at: rev.created_at },
      text: rev.text,
      current_version: Number(owned.transcript_version) || 0,
      // diff از «این نسخه» به «متنِ فعلی»: removed = فقط در نسخه‌ی قدیمی بود، added = فقط در متنِ فعلی است
      diff: truncated ? null : { ops, summary: diffSummary(ops) },
    };
  });

  // POST بازگردانی — { transcript_version } الزامی (CAS)
  app.post('/api/sessions/:id/transcript-revisions/:rid/restore', async (request, reply) => {
    const { id, rid } = request.params as { id: string; rid: string };
    const body = (request.body || {}) as { transcript_version?: unknown };
    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) { reply.code(404); return { error: 'جلسه یافت نشد' }; }
    if (typeof body.transcript_version !== 'number') {
      reply.code(400);
      return { error: 'نسخه‌ی پایه‌ی متن (transcript_version) الزامی است؛ صفحه را تازه‌سازی کنید', code: 'version-required' };
    }
    const rev = await getTranscriptRevision(id, Number(rid));
    if (!rev) { reply.code(404); return { error: 'نسخه یافت نشد' }; }
    const cur = String(owned.transcript || '');
    if (rev.text === cur) { reply.code(409); return { error: 'این نسخه همان متنِ فعلی است', code: 'same-text' }; }
    const cv = Number(owned.transcript_version) || 0;
    if (cv !== body.transcript_version) {
      reply.code(409);
      return { error: 'نسخه‌ی transcript قدیمی است؛ ابتدا تازه‌سازی کنید', code: 'version-conflict', current_version: cv };
    }
    const n = await updateOwnedSession(
      ['transcript = ?', 'transcript_version = transcript_version + 1', 'updated_at = NOW()'],
      [rev.text], id, request.therapistId!, body.transcript_version);
    if (n === 0) {
      const re = await getTranscriptVersionRow(id);
      reply.code(409);
      return { error: 'نسخه‌ی transcript قدیمی است؛ ابتدا تازه‌سازی کنید', code: 'version-conflict', current_version: re?.transcript_version ?? null };
    }
    // متنِ فعلی (جایگزین‌شده) در تاریخچه می‌ماند ⇒ بازگردانی خودش برگشت‌پذیر است
    if (cur.trim()) await insertTranscriptRevision({ sessionId: id, version: cv, cause: 'restore', actor: request.therapistId ?? null, text: cur });
    logEvent({ event: 'session.transcript_restore', sessionId: id, therapistId: request.therapistId, detail: { revision: rev.id, from_version: cv, chars: rev.chars } });
    return { ok: true, transcript_version: cv + 1 };
  });
}
