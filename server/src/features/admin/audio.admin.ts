// ادمین: صدایِ جلسات — سگمنت‌ها، فایلِ کامل و پخش (Range)، آرشیوِ صدا، حذفِ صدا، یادداشت‌هایِ صوتی.
// پخش فقط از همین endpointها با stream (LAW-005). pluginِ فرزندِ adminRoutes (requireAdmin).
import { FastifyInstance } from 'fastify';
import { statSync } from 'node:fs';
import {
  listSessionAudio, getSessionAudioRow, getFullSessionAudio, deleteSessionAudioDirs, deriveSessionStatus, checkSeqContiguous,
  SESSION_AUDIO_RETENTION_MS,
} from '../transcription/archive/sessionAudioArchive.js';
import { pendingAudiosFor } from '../transcription/batch/batchQueue.js';
import { logEvent } from '../../obs/eventLog.js';
import { recordAudit } from '../../obs/audit.js';
import { sendFileWithRange } from '../../shared/httpRange.js';
import { audioFilters, pageParams, SILENT_KBPS } from './filters.js';
import {
  getSessionSttState, sessionExists, audioArchiveBase, listAudioArchivePage, listSessionSeqs, audioArchiveTotals,
  countAudioExpiringSoon, sessionAudioTotals, deleteSessionAudioRows, listVoiceNoteSessionsPage, listSessionsInfo,
  listVoiceNotesMeta, listNoteAudio, getVoiceNoteText,
} from './admin.repository.js';

export async function audioAdminRoutes(app: FastifyInstance) {
  // GET /api/admin/sessions/:id/audio — لیستِ سگمنت‌هایِ صدایِ آرشیوشده‌ی یک جلسه
  // (فقط متادیتا — bytes/seq/created_at، نه خودِ فایل). فقط برایِ آرشیوِ داخلی/دیباگ
  // استفاده می‌شود؛ نمایشِ ادمین از `audio/full` (بخشِ F) استفاده می‌کند.
  app.get('/api/admin/sessions/:id/audio', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await getSessionSttState(id);
    if (!session) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }
    const rows = await listSessionAudio(id);
    // ⭐ (بخشِ F) شمارشِ فایل‌هایِ هنوز-در-صف (هر purposeی که هنوز آرشیو نشده) — پنلِ
    // ادمین یک بنرِ «N فایل هنوز در صفِ پردازشِ سرور است» نشان می‌دهد.
    const pendingCount =
      pendingAudiosFor(id, 'transcript').length +
      pendingAudiosFor(id, 'late-transcript').length +
      pendingAudiosFor(id, 'note').length +
      pendingAudiosFor(id, 'archive').length;
    // بخشِ ۱۱/۱۳ی audit «zero-loss recording» (2026-09-22): قبلاً ادمین فقط یک بنرِ
    // تجمیعیِ «N فایل در صف» می‌دید — بینِ «صدا کامل ولی رونویسی پنding» و «سگمنتی از
    // صدا واقعاً گم شده» تمایزی نبود. الان صریحاً محاسبه و برگردانده می‌شود.
    // (فازِ ۱ِ رصد/حسابرسی، 2026-09-22: همین منطق در deriveSessionStatus استخراج شد
    // تا GET /api/admin/sessions/recent هم بتواند از آن استفاده کند.)
    const row = session as { batch_status: string | null; realtime_reliable: boolean | null; stt_mode: string | null };
    const derived = deriveSessionStatus(rows, pendingCount, row);
    return {
      audio: rows.map((r) => ({
        id: r.id, seq: r.seq, bytes: r.bytes, mime: r.mime, source: r.source, kind: r.kind,
        duration_ms: r.duration_ms, created_at: r.created_at,
      })),
      pending_count: derived.pendingCount,
      audio_status: derived.audioStatus,
      audio_missing_segments: derived.audioMissingSegments,
      transcript_status: derived.transcriptStatus,
    };
  });

  // GET /api/admin/sessions/:id/audio/full[?download=1] — یک فایلِ کاملِ چسبیده‌شده از
  // همه‌ی سگمنت‌هایِ kind='session' (بخشِ F، تصمیمِ صریحِ مالک: «نه چانک‌چانک»). صدایِ
  // یادداشت‌هایِ صوتی (kind='note') از قبل یک فایلِ کوتاهِ یکپارچه‌اند و از همین مسیر
  // بیرون گذاشته شده‌اند — با `session-audio/:audioId/stream` قابلِ‌شنیدنند.
  app.get('/api/admin/sessions/:id/audio/full', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { download } = request.query as { download?: string };
    if (!(await sessionExists(id))) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }
    const result = await getFullSessionAudio(id);
    if (!result.ok) {
      // پیامِ روشن، نه خطایِ مبهم — طبقِ پلن: «این قابلیت بدونِ ffmpeg در دسترس نیست»
      reply.code(result.reason === 'no-audio' ? 404 : 503);
      return { error: result.message };
    }
    let stat;
    try {
      stat = statSync(result.path);
    } catch {
      reply.code(404);
      return { error: 'فایلِ کامل رویِ دیسک پیدا نشد' };
    }
    if (download) {
      const ext = result.mime.includes('ogg') ? 'ogg' : result.mime.includes('mp4') ? 'm4a' : 'webm';
      reply.header('Content-Disposition', `attachment; filename="session-${id}.${ext}"`);
    }
    // بخشِ ۵ی audit «zero-loss recording» (2026-09-22): این فایل قبلاً بدونِ هیچ سیگنالی
    // دربارهٔ کاملیت سرو می‌شد — caller ای که مستقیم این endpoint را می‌زند (نه از مسیرِ
    // UIِ فعلی که جدا از `/audio` چک می‌کند) هیچ راهی برایِ فهمیدنِ gapِ احتمالی نداشت.
    // (A6) پخش/دانلودِ صدا — فقط شروعِ پخش (بدونِ Range یا Rangeِ از بایتِ ۰)، نه هر درخواستِ Rangeِ scrub.
    if (download || !request.headers.range || /^bytes=0-/.test(String(request.headers.range))) {
      await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: download ? 'admin.audio_download' : 'admin.audio_play', targetType: 'session', targetId: id, detail: { kind: 'full' } });
    }
    reply.header('X-Audio-Complete', String(result.complete));
    if (!result.complete) {
      reply.header('X-Audio-Missing-Segments', result.missingSegments.join(','));
    }
    return sendFileWithRange(reply, request.headers.range, result.path, stat.size, result.mime);
  });

  // GET /api/admin/session-audio/:audioId/stream — پخشِ خودِ فایلِ صدا (با Range،
  // برایِ اینکه <audio> بتونه scrub کنه). فقط پشتِ requireAdmin — لینکِ عمومی نداره،
  // از static directory سرو نمی‌شه.
  app.get('/api/admin/session-audio/:audioId/stream', async (request, reply) => {
    const { audioId } = request.params as { audioId: string };
    const { download } = request.query as { download?: string };
    const row = await getSessionAudioRow(audioId);
    if (!row) {
      reply.code(404);
      return { error: 'فایلِ صدا یافت نشد' };
    }
    let stat;
    try {
      stat = statSync(row.path);
    } catch {
      reply.code(404);
      return { error: 'فایل رویِ دیسک پیدا نشد' };
    }
    if (download || !request.headers.range || /^bytes=0-/.test(String(request.headers.range))) {
      await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: download ? 'admin.audio_download' : 'admin.audio_play', targetType: 'session_audio', targetId: audioId, detail: { kind: row.kind } });
    }
    if (download) {
      const ext = (row.mime && row.mime.includes('ogg')) ? 'ogg' : 'webm';
      reply.header('Content-Disposition', `attachment; filename="segment-${String(row.seq).padStart(6, '0')}.${ext}"`);
    }
    const contentType = row.mime || 'audio/webm';
    return sendFileWithRange(reply, request.headers.range, row.path, stat.size, contentType);
  });

  // ————————————————— B2 (2026-09-26): آرشیوِ صدا —————————————————
  // GET /api/admin/audio-archive?therapist_id&client_id&from&to&limit&offset — فهرستِ جلسه‌به‌جلسه‌ی صدایِ آرشیوشده (فقط
  // kind='session')، فقط متادیتا (هیچ متنی). روزهایِ باقی‌مانده تا حذفِ قدیمی‌ترین سگمنت در خودِ SQL (هم‌زمان با sweep).
  app.get('/api/admin/audio-archive', async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const f = audioFilters(q, { therapist: 'c.therapist_id', client: 's.client_id', ts: 'a.created_at' });
    const { limit, offset } = pageParams(q);
    const retentionSec = Math.floor(SESSION_AUDIO_RETENTION_MS / 1000);
    const base = audioArchiveBase(f);
    const pageRows = await listAudioArchivePage(base, f, retentionSec, limit, offset);
    const rows = pageRows.slice(0, limit) as any[];
    const ids = rows.map((x) => x.session_id);
    const seqs = new Map<string, any[]>();
    if (ids.length) {
      const sr = await listSessionSeqs(ids);
      for (const x of sr) { if (!seqs.has(x.session_id)) seqs.set(x.session_id, []); seqs.get(x.session_id)!.push(x); }
    }
    const items = rows.map((x) => {
      const audioMs = Number(x.audio_ms) || 0;
      const bytes = Number(x.bytes) || 0;
      const kbps = audioMs > 0 ? Math.round((bytes * 8) / audioMs * 10) / 10 : null;
      const { complete, missing } = checkSeqContiguous(seqs.get(x.session_id) || []);
      const pending = pendingAudiosFor(x.session_id, 'transcript').length + pendingAudiosFor(x.session_id, 'late-transcript').length + pendingAudiosFor(x.session_id, 'archive').length;
      return {
        session_id: x.session_id, session_num: x.session_num, date: x.date, status: x.status, source: x.source,
        client_id: x.client_id, client_code: x.client_code, therapist_id: x.therapist_id, therapist_name: x.therapist_name,
        segments: Number(x.segments), bytes, audio_ms: audioMs, audio_kbps: kbps,
        silent: kbps !== null && audioMs > 20000 && kbps < SILENT_KBPS,
        complete, missing_segments: missing, pending_count: pending,
        first_at: x.first_at, last_at: x.last_at,
        days_left: Math.max(0, Math.ceil(Number(x.expires_in_sec) / 86400)),
      };
    });
    const tot = await audioArchiveTotals(base, f);
    const exp = await countAudioExpiringSoon(base, f, retentionSec);
    return {
      items,
      has_more: pageRows.length > limit,
      totals: {
        sessions: Number(tot?.sessions || 0),
        bytes: Number(tot?.bytes || 0),
        audio_ms: Number(tot?.audio_ms || 0),
        expiring_2d: Number(exp?.n || 0),
      },
      retention_days: Math.round(SESSION_AUDIO_RETENTION_MS / 86400000),
    };
  });

  // DELETE /api/admin/sessions/:id/audio — فقط صدایِ یک جلسه (نه خودِ جلسه/متن). صدایی که هنوز در صفِ رونویسی است
  // حذف نمی‌شود (409) تا متنی که فقط از همان صدا بازیابی‌پذیر است گم نشود. LAW-010 + ممیزی.
  app.delete('/api/admin/sessions/:id/audio', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await sessionExists(id))) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }
    const pending = pendingAudiosFor(id, 'transcript').length + pendingAudiosFor(id, 'late-transcript').length + pendingAudiosFor(id, 'note').length;
    if (pending > 0) {
      reply.code(409);
      return { error: 'بخشی از صدایِ این جلسه هنوز در صفِ رونویسی است — بعد از پایانِ پردازش دوباره امتحان کنید', code: 'audio-pending', pending_count: pending };
    }
    const cnt = await sessionAudioTotals(id);
    const n = Number(cnt?.n || 0);
    const b = Number(cnt?.b || 0);
    await deleteSessionAudioRows(id);
    deleteSessionAudioDirs([id]);
    logEvent({ event: 'admin.delete', therapistId: request.therapistId, sessionId: id, detail: { kind: 'session_audio', count: n } });
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.session_audio_delete', targetType: 'session', targetId: id, detail: { count: n, bytes: b } });
    return { deleted: n, bytes: b };
  });

  // ————————————————— B3 (2026-09-26): یادداشت‌هایِ صوتی —————————————————
  // GET /api/admin/voice-notes?therapist_id&client_id&from&to&limit&offset — جلسه‌به‌جلسه: یادداشت‌هایِ صوتی (فقط طول، نه
  // متن — تصمیمِ D2: متن فقط با کلیکِ صریح) + صدایِ یادداشت‌ها (kind='note'). جلسه‌ای که فقط صدا دارد (رونویسی ناموفق) هم می‌آید.
  app.get('/api/admin/voice-notes', async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const f = audioFilters(q, { therapist: 'c.therapist_id', client: 's.client_id', ts: 'x.ts' });
    const { limit, offset } = pageParams(q);
    const pageRows = await listVoiceNoteSessionsPage(f, limit, offset);
    const page = pageRows.slice(0, limit) as any[];
    const ids = page.map((x) => x.session_id);
    if (!ids.length) return { items: [], has_more: false };
    const ph = ids.map(() => '?').join(',');
    const info = await listSessionsInfo(ph, ids);
    const notes = await listVoiceNotesMeta(ph, ids);
    const audio = await listNoteAudio(ph, ids);
    const byId = new Map(info.map((x: any) => [x.id, x]));
    const items = page.map((p) => {
      const s: any = byId.get(p.session_id) || {};
      return {
        session_id: p.session_id, session_num: s.session_num, date: s.date, status: s.status,
        client_id: s.client_id, client_code: s.client_code, therapist_id: s.therapist_id, therapist_name: s.therapist_name,
        last_at: p.last_at,
        notes: notes.filter((n: any) => n.session_id === p.session_id).map((n: any) => ({ id: n.id, wall_clock: n.wall_clock, created_at: n.created_at, text_len: Number(n.text_len) })),
        audio: audio.filter((a: any) => a.session_id === p.session_id).map((a: any) => ({ id: a.id, bytes: Number(a.bytes), duration_ms: a.duration_ms, created_at: a.created_at })),
      };
    });
    return { items, has_more: pageRows.length > limit };
  });

  // GET /api/admin/voice-notes/:noteId/text — متنِ یک یادداشتِ صوتی، فقط با کلیکِ صریحِ ادمین؛ ممیزی می‌شود.
  app.get('/api/admin/voice-notes/:noteId/text', async (request, reply) => {
    const { noteId } = request.params as { noteId: string };
    const note = await getVoiceNoteText(noteId);
    if (!note) {
      reply.code(404);
      return { error: 'یادداشت یافت نشد' };
    }
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.voice_note_text_view', targetType: 'note', targetId: noteId });
    return { id: noteId, session_id: note.session_id, text: note.text || '' };
  });
}
