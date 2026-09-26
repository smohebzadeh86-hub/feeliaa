// پنل ادمین — فقط is_admin=true. هیچ‌جا متنِ رونویسی‌شده‌ی جلسات نمایش داده نمی‌شود.
import { FastifyInstance } from 'fastify';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { query } from '../db/connection.js';
import { requireAdmin } from '../auth/guard.js';
import { listSessionAudio, getSessionAudioRow, getFullSessionAudio, deleteSessionAudioDirs, deriveSessionStatus, checkSeqContiguous, SESSION_AUDIO_RETENTION_MS } from '../stt/sessionAudioArchive.js';
import { collectUploadSonioxRefs, releaseSonioxRefs } from '../features/audio-upload/jobRunner.js';
import { pendingAudiosFor } from '../stt/batchqueue.js';
import { logEvent, obsQueueStats } from '../obs/eventLog.js';
import { recordAudit } from '../obs/audit.js';

// پارسِ امنِ Range: bytes=start-end با clamp به اندازه‌ی واقعیِ فایل.
// خروجی null یعنی range غیرقابلِ‌ارضا (باید 416 برگردد) — قبلاً start فراتر از
// stat.size منجر به Content-Length منفی و پاسخِ خراب می‌شد.
function parseRange(rangeHeader: string, size: number): { start: number; end: number } | null {
  const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (!m || (!m[1] && !m[2])) return null;
  let start = m[1] ? parseInt(m[1], 10) : 0;
  let end = m[2] ? parseInt(m[2], 10) : size - 1;
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (!m[1] && m[2]) {
    // فرمِ suffix: bytes=-N یعنی N بایتِ آخر
    start = Math.max(0, size - end);
    end = size - 1;
  }
  if (start > end || start < 0 || start >= size) return null;
  if (end >= size) end = size - 1;
  return { start, end };
}

// ————— فیلترهایِ مشترکِ آرشیوِ صدا / یادداشت‌هایِ صوتی (B2/B3، 2026-09-26) —————
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// سکوت: همان آستانه‌ی diagnosis — جلساتِ سالم ۱۱–۲۵ kbps؛ زیرِ ۶ با بیش از ۲۰ث صدا یعنی میکروفون چیزی نگرفته.
const SILENT_KBPS = 6;
function audioFilters(q: Record<string, string | undefined>, alias: { therapist: string; client: string; ts: string }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.therapist_id && UUID_RE.test(q.therapist_id)) { where.push(`${alias.therapist} = ?`); params.push(q.therapist_id); }
  if (q.client_id && UUID_RE.test(q.client_id)) { where.push(`${alias.client} = ?`); params.push(q.client_id); }
  if (q.from && DATE_RE.test(q.from)) { where.push(`${alias.ts} >= ?`); params.push(q.from + ' 00:00:00'); }
  if (q.to && DATE_RE.test(q.to)) { where.push(`${alias.ts} < DATE_ADD(?, INTERVAL 1 DAY)`); params.push(q.to + ' 00:00:00'); }
  return { sql: where.length ? ' AND ' + where.join(' AND ') : '', params };
}
function pageParams(q: Record<string, string | undefined>) {
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 30));
  const offset = Math.max(0, Number(q.offset) || 0);
  return { limit, offset };
}

// دیتای کاملِ یک تراپیست: مراجعین + جلسات (با متنِ رونویسی) + یادداشت‌ها/علائم.
// فقط از دو مسیرِ export که پشتِ requireAdmin هستن صدا زده می‌شه.
async function buildTherapistExport(therapistId: string) {
  const t = await query('SELECT id, phone, email, name, specialty, created_at FROM therapists WHERE id = ?', [therapistId]);
  if (t.rows.length === 0) return null;

  const clients = await query(
    'SELECT id, code, alias, status, status_reason, category, gender, created_at FROM clients WHERE therapist_id = ? ORDER BY created_at',
    [therapistId]
  );

  const sessions = await query(`
    SELECT s.id, s.client_id, s.session_num, s.date, s.start_time, s.duration_ms,
           s.status, s.source, s.consent, s.transcript, s.created_at
    FROM sessions s
    JOIN clients c ON c.id = s.client_id
    WHERE c.therapist_id = ?
    ORDER BY s.client_id, s.session_num
  `, [therapistId]);

  // MySQL از NULLS LAST پشتیبانی نمی‌کند؛ `(offset_ms IS NULL)` در ASC همان اثر را دارد.
  const notes = await query(`
    SELECT n.id, n.session_id, n.type, n.text, n.sign_type, n.offset_ms, n.wall_clock, n.created_at
    FROM session_notes n
    JOIN sessions s ON s.id = n.session_id
    JOIN clients c ON c.id = s.client_id
    WHERE c.therapist_id = ?
    ORDER BY n.session_id, (n.offset_ms IS NULL), n.offset_ms, n.created_at
  `, [therapistId]);

  const notesBySession = new Map<string, any[]>();
  for (const n of notes.rows) {
    if (!notesBySession.has(n.session_id)) notesBySession.set(n.session_id, []);
    notesBySession.get(n.session_id)!.push(n);
  }
  const sessionsByClient = new Map<string, any[]>();
  for (const s of sessions.rows) {
    const withNotes = { ...s, notes: notesBySession.get(s.id) || [] };
    if (!sessionsByClient.has(s.client_id)) sessionsByClient.set(s.client_id, []);
    sessionsByClient.get(s.client_id)!.push(withNotes);
  }

  return {
    therapist: t.rows[0],
    clients: clients.rows.map(c => ({ ...c, sessions: sessionsByClient.get(c.id) || [] })),
  };
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin);

  // GET /api/admin/stats
  app.get('/api/admin/stats', async () => {
    const result = await query(`
      SELECT
        (SELECT COUNT(*) FROM therapists) as therapists,
        (SELECT COUNT(*) FROM clients) as clients,
        (SELECT COUNT(*) FROM sessions) as sessions,
        (SELECT COUNT(*) FROM sessions WHERE created_at >= CURRENT_DATE) as sessions_today,
        (SELECT COUNT(*) FROM sessions WHERE created_at >= CURRENT_DATE - INTERVAL 7 DAY) as sessions_this_week
    `);
    return { stats: result.rows[0] };
  });

  // GET /api/admin/therapists?q=search
  app.get('/api/admin/therapists', async (request) => {
    const { q } = request.query as { q?: string };
    const search = q?.trim() || null;

    const result = await query(`
      SELECT
        t.id, t.phone, t.email, t.name, t.specialty, t.is_admin, t.active, t.created_at,
        COUNT(DISTINCT c.id) as client_count,
        COUNT(DISTINCT s.id) as session_count,
        MAX(s.created_at) as last_session_at
      FROM therapists t
      LEFT JOIN clients c ON c.therapist_id = t.id
      LEFT JOIN sessions s ON s.client_id = c.id
      WHERE ? IS NULL OR t.phone LIKE CONCAT('%', ?, '%') OR t.name LIKE CONCAT('%', ?, '%') OR t.email LIKE CONCAT('%', ?, '%')
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `, [search, search, search, search]);

    return { therapists: result.rows };
  });

  // GET /api/admin/therapists/:id/clients — بدونِ transcript، فقط متادیتا
  app.get('/api/admin/therapists/:id/clients', async (request, reply) => {
    const { id } = request.params as { id: string };

    const therapist = await query('SELECT id, phone, name, specialty FROM therapists WHERE id = ?', [id]);
    if (therapist.rows.length === 0) {
      reply.code(404);
      return { error: 'تراپیست یافت نشد' };
    }

    const clients = await query(`
      SELECT c.id, c.code, c.alias, c.status, c.status_reason, c.category, c.gender, c.created_at,
        COUNT(s.id) as session_count,
        MAX(s.date) as last_session_date
      FROM clients c
      LEFT JOIN sessions s ON s.client_id = c.id
      WHERE c.therapist_id = ?
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `, [id]);

    return { therapist: therapist.rows[0], clients: clients.rows };
  });

  // GET /api/admin/clients/:id/sessions — لیستِ جلساتِ یک مراجع (فقط متادیتا، بدونِ متن)
  // برایِ رفتنِ ادمین از تراپیست → مراجع → جلسه → صدا.
  app.get('/api/admin/clients/:id/sessions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const client = await query('SELECT id, code, alias FROM clients WHERE id = ?', [id]);
    if (client.rows.length === 0) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }
    const sessions = await query(`
      SELECT s.id, s.session_num, s.date, s.start_time, s.duration_ms, s.status, s.source, s.consent,
        s.updated_at, s.batch_status, s.auto_closed_at, s.realtime_reliable, CHAR_LENGTH(COALESCE(s.transcript, '')) as transcript_len,
        COUNT(a.id) as audio_count
      FROM sessions s
      LEFT JOIN session_audio a ON a.session_id = s.id
      WHERE s.client_id = ?
      GROUP BY s.id
      ORDER BY s.session_num DESC
    `, [id]);
    return { client: client.rows[0], sessions: sessions.rows };
  });

  // GET /api/admin/sessions/:id — متنِ کاملِ رونویسی + همه‌ی یادداشت‌ها/علائمِ یک جلسه
  // (تصمیمِ مالک D2، 2026-09-15: دسترسیِ کاملِ ادمین داخلِ پنل، فقط‌خواندنی؛ بدونِ لاگِ متن، LAW-001).
  app.get('/api/admin/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await query(`
      SELECT s.id, s.client_id, s.session_num, s.date, s.start_time, s.duration_ms,
        s.status, s.source, s.consent, s.transcript, s.created_at,
        s.updated_at, s.transcript_version, s.realtime_reliable, s.stt_mode, s.batch_status, s.auto_closed_at
      FROM sessions s WHERE s.id = ?
    `, [id]);
    if (session.rows.length === 0) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }
    const notes = await query(`
      SELECT id, type, text, sign_type, offset_ms, wall_clock, created_at
      FROM session_notes
      WHERE session_id = ?
      ORDER BY (offset_ms IS NULL), offset_ms, created_at
    `, [id]);
    // (A6) مشاهده‌ی متنِ بالینیِ یک جلسه توسطِ ادمین ممیزی می‌شود.
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.session_view', targetType: 'session', targetId: id });
    return { session: session.rows[0], notes: notes.rows };
  });

  // GET /api/admin/sessions/:id/audio — لیستِ سگمنت‌هایِ صدایِ آرشیوشده‌ی یک جلسه
  // (فقط متادیتا — bytes/seq/created_at، نه خودِ فایل). فقط برایِ آرشیوِ داخلی/دیباگ
  // استفاده می‌شود؛ نمایشِ ادمین از `audio/full` (بخشِ F) استفاده می‌کند.
  app.get('/api/admin/sessions/:id/audio', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await query(
      'SELECT id, batch_status, realtime_reliable, stt_mode FROM sessions WHERE id = ?',
      [id]
    );
    if (session.rows.length === 0) {
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
    const row = session.rows[0] as { batch_status: string | null; realtime_reliable: boolean | null; stt_mode: string | null };
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
    const session = await query('SELECT id FROM sessions WHERE id = ?', [id]);
    if (session.rows.length === 0) {
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
    const range = request.headers.range;
    if (range) {
      const parsed = parseRange(range, stat.size);
      if (!parsed) {
        reply.code(416);
        reply.header('Content-Range', `bytes */${stat.size}`);
        return reply.send();
      }
      const { start, end } = parsed;
      reply.code(206);
      reply.header('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      reply.header('Accept-Ranges', 'bytes');
      reply.header('Content-Length', end - start + 1);
      reply.header('Content-Type', result.mime);
      return reply.send(createReadStream(result.path, { start, end }));
    }
    reply.header('Accept-Ranges', 'bytes');
    reply.header('Content-Length', stat.size);
    reply.header('Content-Type', result.mime);
    return reply.send(createReadStream(result.path));
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
    const range = request.headers.range;
    const contentType = row.mime || 'audio/webm';
    if (range) {
      const parsed = parseRange(range, stat.size);
      if (!parsed) {
        reply.code(416);
        reply.header('Content-Range', `bytes */${stat.size}`);
        return reply.send();
      }
      const { start, end } = parsed;
      reply.code(206);
      reply.header('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      reply.header('Accept-Ranges', 'bytes');
      reply.header('Content-Length', end - start + 1);
      reply.header('Content-Type', contentType);
      return reply.send(createReadStream(row.path, { start, end }));
    }
    reply.header('Accept-Ranges', 'bytes');
    reply.header('Content-Length', stat.size);
    reply.header('Content-Type', contentType);
    return reply.send(createReadStream(row.path));
  });

  // ⭐ خروج دیتا از پلتفرم فقط از همین دو مسیر ممکنه — هر دو پشتِ requireAdmin.
  // هیچ مسیرِ مشابهی سمتِ تراپیستِ معمولی وجود نداره (عمداً حذف شد).

  // GET /api/admin/therapists/:id/export — دیتای کاملِ یک تراپیست (شاملِ متنِ رونویسی)
  app.get('/api/admin/therapists/:id/export', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await buildTherapistExport(id);
    if (!data) {
      reply.code(404);
      return { error: 'تراپیست یافت نشد' };
    }
    logEvent({ event: 'admin.export', therapistId: request.therapistId, detail: { kind: 'therapist' } });
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.export', targetType: 'therapist', targetId: id, detail: { kind: 'therapist' } });
    reply.header('Content-Disposition', `attachment; filename="feelia-${data.therapist.phone}.json"`);
    reply.type('application/json');
    return data;
  });

  // GET /api/admin/export — دیتای کاملِ همه‌ی تراپیست‌ها (خروجیِ کل سیستم)
  app.get('/api/admin/export', async (request, reply) => {
    const ids = await query('SELECT id FROM therapists ORDER BY created_at');
    const all = [];
    for (const row of ids.rows) {
      const data = await buildTherapistExport(row.id);
      if (data) all.push(data);
    }
    logEvent({ event: 'admin.export', therapistId: request.therapistId, detail: { kind: 'full', count: all.length } });
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.export', targetType: 'system', detail: { kind: 'full', count: all.length } });
    reply.header('Content-Disposition', `attachment; filename="feelia-export-${new Date().toISOString().slice(0, 10)}.json"`);
    reply.type('application/json');
    return { exported_at: new Date().toISOString(), therapists: all };
  });

  // PATCH /api/admin/therapists/:id — { active?, is_admin? }
  app.patch('/api/admin/therapists/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { active, is_admin } = request.body as { active?: boolean; is_admin?: boolean };

    if (id === request.therapistId) {
      if (active === false) {
        reply.code(400);
        return { error: 'نمی‌توانید حساب خودتان را غیرفعال کنید' };
      }
      if (is_admin === false) {
        const adminCount = await query('SELECT COUNT(*) AS count FROM therapists WHERE is_admin = true');
        if (Number(adminCount.rows[0].count) <= 1) {
          reply.code(400);
          return { error: 'شما تنها ادمین سیستم هستید — نمی‌توانید این نقش را از خودتان بردارید' };
        }
      }
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    if (typeof active === 'boolean') { updates.push(`active = ?`); values.push(active); }
    if (typeof is_admin === 'boolean') { updates.push(`is_admin = ?`); values.push(is_admin); }
    if (updates.length === 0) {
      reply.code(400);
      return { error: 'چیزی برای به‌روزرسانی نیست' };
    }
    values.push(id);

    const update = await query(
      `UPDATE therapists SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    if (update.rowCount === 0) {
      reply.code(404);
      return { error: 'تراپیست یافت نشد' };
    }

    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.therapist_update', targetType: 'therapist', targetId: id,
      detail: { ...(typeof active === 'boolean' ? { state: active ? 'active' : 'inactive' } : {}), ...(typeof is_admin === 'boolean' ? { mode: is_admin ? 'admin' : 'not_admin' } : {}) } });
    const result = await query(
      'SELECT id, phone, email, name, is_admin, active, created_at FROM therapists WHERE id = ?',
      [id]
    );
    return { therapist: result.rows[0] };
  });

  // DELETE /api/admin/therapists/:id — آبشاری (clients/sessions/notes با ON DELETE CASCADE)
  app.delete('/api/admin/therapists/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (id === request.therapistId) {
      reply.code(400);
      return { error: 'نمی‌توانید حساب خودتان را حذف کنید' };
    }

    const existing = await query('SELECT phone FROM therapists WHERE id = ?', [id]);
    if (existing.rows.length === 0) {
      reply.code(404);
      return { error: 'تراپیست یافت نشد' };
    }
    // LAW-010: قبل از cascadeِ DB (therapist → clients → sessions)، شناسه‌ی همه‌ی
    // جلسه‌هایِ زیرِ این تراپیست را نگه می‌داریم تا فایل‌هایِ صدایشان یتیم نمانند.
    const sessionIdsResult = await query(
      'SELECT s.id FROM sessions s JOIN clients c ON s.client_id = c.id WHERE c.therapist_id = ?',
      [id]
    );
    const sessionIds = sessionIdsResult.rows.map((r: { id: string }) => r.id);
    const sonioxRefs = await collectUploadSonioxRefs(sessionIds);
    await query('DELETE FROM therapists WHERE id = ?', [id]);
    deleteSessionAudioDirs(sessionIds);
    releaseSonioxRefs(sonioxRefs);
    logEvent({ event: 'admin.delete', therapistId: request.therapistId, detail: { kind: 'therapist' } });
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.therapist_delete', targetType: 'therapist', targetId: id, detail: { count: sessionIds.length } });

    return { deleted: existing.rows[0].phone };
  });

  // DELETE /api/admin/clients/:id — حذفِ یک مراجعِ خاص، مستقل از تراپیستش
  app.delete('/api/admin/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await query('SELECT code FROM clients WHERE id = ?', [id]);
    if (existing.rows.length === 0) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }
    // LAW-010: همان دلیلِ بالا — قبل از cascade شناسه‌ی جلسه‌ها را نگه می‌داریم.
    const sessionIdsResult = await query('SELECT id FROM sessions WHERE client_id = ?', [id]);
    const sessionIds = sessionIdsResult.rows.map((r: { id: string }) => r.id);
    const sonioxRefs = await collectUploadSonioxRefs(sessionIds);
    await query('DELETE FROM clients WHERE id = ?', [id]);
    deleteSessionAudioDirs(sessionIds);
    releaseSonioxRefs(sonioxRefs);
    logEvent({ event: 'admin.delete', therapistId: request.therapistId, detail: { kind: 'client' } });
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.client_delete', targetType: 'client', targetId: id, detail: { count: sessionIds.length } });

    return { deleted: existing.rows[0].code };
  });

  // ————————————————— B2 (2026-09-26): آرشیوِ صدا —————————————————
  // GET /api/admin/audio-archive?therapist_id&client_id&from&to&limit&offset — فهرستِ جلسه‌به‌جلسه‌ی صدایِ آرشیوشده (فقط
  // kind='session')، فقط متادیتا (هیچ متنی). روزهایِ باقی‌مانده تا حذفِ قدیمی‌ترین سگمنت در خودِ SQL (هم‌زمان با sweep).
  app.get('/api/admin/audio-archive', async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const f = audioFilters(q, { therapist: 'c.therapist_id', client: 's.client_id', ts: 'a.created_at' });
    const { limit, offset } = pageParams(q);
    const retentionSec = Math.floor(SESSION_AUDIO_RETENTION_MS / 1000);
    const base = `FROM session_audio a JOIN sessions s ON s.id = a.session_id JOIN clients c ON c.id = s.client_id
      JOIN therapists t ON t.id = c.therapist_id WHERE a.kind = 'session'${f.sql}`;
    const r = await query(
      `SELECT s.id AS session_id, s.session_num, s.date, s.status, s.source, s.client_id, c.code AS client_code,
              c.therapist_id, t.name AS therapist_name,
              COUNT(*) AS segments, COALESCE(SUM(a.bytes), 0) AS bytes, COALESCE(SUM(a.duration_ms), 0) AS audio_ms,
              MIN(a.created_at) AS first_at, MAX(a.created_at) AS last_at,
              TIMESTAMPDIFF(SECOND, NOW(), MIN(a.created_at) + INTERVAL ? SECOND) AS expires_in_sec
         ${base}
        GROUP BY s.id, s.session_num, s.date, s.status, s.source, s.client_id, c.code, c.therapist_id, t.name
        ORDER BY last_at DESC LIMIT ? OFFSET ?`,
      [retentionSec, ...f.params, limit + 1, offset]
    );
    const rows = r.rows.slice(0, limit) as any[];
    const ids = rows.map((x) => x.session_id);
    const seqs = new Map<string, any[]>();
    if (ids.length) {
      const sr = await query(`SELECT session_id, seq FROM session_audio WHERE kind = 'session' AND session_id IN (${ids.map(() => '?').join(',')})`, ids);
      for (const x of sr.rows) { if (!seqs.has(x.session_id)) seqs.set(x.session_id, []); seqs.get(x.session_id)!.push(x); }
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
    const tot = await query(
      `SELECT COUNT(DISTINCT a.session_id) AS sessions, COALESCE(SUM(a.bytes), 0) AS bytes, COALESCE(SUM(a.duration_ms), 0) AS audio_ms ${base}`,
      f.params
    );
    const exp = await query(
      `SELECT COUNT(*) AS n FROM (SELECT a.session_id, MIN(a.created_at) AS m ${base} GROUP BY a.session_id) x
        WHERE TIMESTAMPDIFF(SECOND, NOW(), x.m + INTERVAL ? SECOND) <= 2 * 86400`,
      [...f.params, retentionSec]
    );
    return {
      items,
      has_more: r.rows.length > limit,
      totals: {
        sessions: Number(tot.rows[0]?.sessions || 0),
        bytes: Number(tot.rows[0]?.bytes || 0),
        audio_ms: Number(tot.rows[0]?.audio_ms || 0),
        expiring_2d: Number(exp.rows[0]?.n || 0),
      },
      retention_days: Math.round(SESSION_AUDIO_RETENTION_MS / 86400000),
    };
  });

  // DELETE /api/admin/sessions/:id/audio — فقط صدایِ یک جلسه (نه خودِ جلسه/متن). صدایی که هنوز در صفِ رونویسی است
  // حذف نمی‌شود (409) تا متنی که فقط از همان صدا بازیابی‌پذیر است گم نشود. LAW-010 + ممیزی.
  app.delete('/api/admin/sessions/:id/audio', async (request, reply) => {
    const { id } = request.params as { id: string };
    const s = await query('SELECT id FROM sessions WHERE id = ?', [id]);
    if (!s.rows.length) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }
    const pending = pendingAudiosFor(id, 'transcript').length + pendingAudiosFor(id, 'late-transcript').length + pendingAudiosFor(id, 'note').length;
    if (pending > 0) {
      reply.code(409);
      return { error: 'بخشی از صدایِ این جلسه هنوز در صفِ رونویسی است — بعد از پایانِ پردازش دوباره امتحان کنید', code: 'audio-pending', pending_count: pending };
    }
    const cnt = await query('SELECT COUNT(*) AS n, COALESCE(SUM(bytes), 0) AS b FROM session_audio WHERE session_id = ?', [id]);
    const n = Number(cnt.rows[0]?.n || 0);
    const b = Number(cnt.rows[0]?.b || 0);
    await query('DELETE FROM session_audio WHERE session_id = ?', [id]);
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
    const r = await query(
      `SELECT x.session_id, MAX(x.ts) AS last_at FROM (
          SELECT n.session_id, n.created_at AS ts FROM session_notes n WHERE n.type = 'voice'
          UNION ALL SELECT a.session_id, a.created_at AS ts FROM session_audio a WHERE a.kind = 'note'
        ) x JOIN sessions s ON s.id = x.session_id JOIN clients c ON c.id = s.client_id
        WHERE 1 = 1${f.sql}
        GROUP BY x.session_id ORDER BY last_at DESC LIMIT ? OFFSET ?`,
      [...f.params, limit + 1, offset]
    );
    const page = r.rows.slice(0, limit) as any[];
    const ids = page.map((x) => x.session_id);
    if (!ids.length) return { items: [], has_more: false };
    const ph = ids.map(() => '?').join(',');
    const info = await query(
      `SELECT s.id, s.session_num, s.date, s.status, s.client_id, c.code AS client_code, c.therapist_id, t.name AS therapist_name
         FROM sessions s JOIN clients c ON c.id = s.client_id JOIN therapists t ON t.id = c.therapist_id WHERE s.id IN (${ph})`, ids);
    const notes = await query(
      `SELECT id, session_id, wall_clock, created_at, CHAR_LENGTH(COALESCE(text, '')) AS text_len FROM session_notes
        WHERE type = 'voice' AND session_id IN (${ph}) ORDER BY created_at`, ids);
    const audio = await query(
      `SELECT id, session_id, bytes, duration_ms, created_at FROM session_audio WHERE kind = 'note' AND session_id IN (${ph}) ORDER BY created_at`, ids);
    const byId = new Map(info.rows.map((x: any) => [x.id, x]));
    const items = page.map((p) => {
      const s: any = byId.get(p.session_id) || {};
      return {
        session_id: p.session_id, session_num: s.session_num, date: s.date, status: s.status,
        client_id: s.client_id, client_code: s.client_code, therapist_id: s.therapist_id, therapist_name: s.therapist_name,
        last_at: p.last_at,
        notes: notes.rows.filter((n: any) => n.session_id === p.session_id).map((n: any) => ({ id: n.id, wall_clock: n.wall_clock, created_at: n.created_at, text_len: Number(n.text_len) })),
        audio: audio.rows.filter((a: any) => a.session_id === p.session_id).map((a: any) => ({ id: a.id, bytes: Number(a.bytes), duration_ms: a.duration_ms, created_at: a.created_at })),
      };
    });
    return { items, has_more: r.rows.length > limit };
  });

  // GET /api/admin/voice-notes/:noteId/text — متنِ یک یادداشتِ صوتی، فقط با کلیکِ صریحِ ادمین؛ ممیزی می‌شود.
  app.get('/api/admin/voice-notes/:noteId/text', async (request, reply) => {
    const { noteId } = request.params as { noteId: string };
    const r = await query(`SELECT id, session_id, text FROM session_notes WHERE id = ? AND type = 'voice'`, [noteId]);
    if (!r.rows.length) {
      reply.code(404);
      return { error: 'یادداشت یافت نشد' };
    }
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.voice_note_text_view', targetType: 'note', targetId: noteId });
    return { id: noteId, session_id: r.rows[0].session_id, text: r.rows[0].text || '' };
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

    const rows = await query(
      `SELECT s.id, s.session_num, s.date, s.start_time, s.status, s.source,
              s.created_at, s.updated_at, s.batch_status, s.realtime_reliable, s.stt_mode,
              c.id AS client_id, c.code AS client_code,
              t.id AS therapist_id, t.name AS therapist_name,
              CHAR_LENGTH(s.transcript) AS transcript_len,
              (SELECT COUNT(*) FROM session_audio a WHERE a.session_id = s.id) AS audio_count,
              (SELECT COALESCE(SUM(a.bytes), 0) FROM session_audio a WHERE a.session_id = s.id) AS audio_bytes,
              (SELECT COALESCE(SUM(a.duration_ms), 0) FROM session_audio a WHERE a.session_id = s.id) AS audio_duration_ms,
              (SELECT COUNT(*) FROM session_notes n WHERE n.session_id = s.id) AS note_count
       FROM sessions s
       JOIN clients c ON c.id = s.client_id
       JOIN therapists t ON t.id = c.therapist_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return { sessions: rows.rows };
  });

  // GET /api/admin/sessions/:id/diagnosis — «چه اتفاقی افتاد؟» به زبانِ ساده (audit ذخیره‌سازی 2026-09-26).
  // ادمین قبلاً فقط رویدادهایِ خام (timeline) داشت و نمی‌توانست بفهمد صدا سکوت بوده، میکروفون قطع شده،
  // صفحه پنهان شده یا پایان کِی زده شده. همه از داده‌یِ موجود محاسبه می‌شود؛ متنِ بالینی برگردانده نمی‌شود
  // (فقط شمارش/طول — LAW-001).
  app.get('/api/admin/sessions/:id/diagnosis', async (request, reply) => {
    const { id } = request.params as { id: string };
    const sres = await query(
      `SELECT id, status, source, duration_ms, created_at, updated_at, batch_status, realtime_reliable, transcript
       FROM sessions WHERE id = ?`, [id]
    );
    if (sres.rows.length === 0) { reply.code(404); return { error: 'جلسه یافت نشد' }; }
    const s = sres.rows[0] as any;
    const audioRows = (await listSessionAudio(id)).filter((r) => r.kind === 'session');
    const audioMs = audioRows.reduce((a, r) => a + (Number(r.duration_ms) || 0), 0);
    const audioBytes = audioRows.reduce((a, r) => a + (Number(r.bytes) || 0), 0);
    const kbps = audioMs > 0 ? Math.round((audioBytes * 8) / audioMs * 10) / 10 : null;
    const seqs = audioRows.map((r) => r.seq);
    const missing: number[] = [];
    if (seqs.length) for (let i = 0; i <= Math.max(...seqs); i++) if (!seqs.includes(i)) missing.push(i);
    const pendingCount = pendingAudiosFor(id, 'transcript').length + pendingAudiosFor(id, 'late-transcript').length + pendingAudiosFor(id, 'archive').length;

    const ev = (await query('SELECT ts, event, detail FROM obs_events WHERE session_id = ? ORDER BY ts', [id])).rows as any[];
    const countEv = (name: string, pred?: (d: any) => boolean) => ev.filter((e) => e.event === name && (!pred || pred(e.detail || {}))).length;
    const wsDrops = countEv('rt.ws_close', (d) => d.close_code !== 1000 && d.close_code !== 1005);
    const reconnectOk = countEv('rt.reconnect_ok');
    const exhausted = countEv('rt.reconnect_exhausted');
    const mintFailed = countEv('rt.mint_failed');
    const micLost = countEv('rt.mic_lost');
    const batchFailed = countEv('batch.failed') + countEv('batch.segment_unrecoverable');
    const unreadable = countEv('audio.segment_unreadable');
    const quality = [...new Set(ev.filter((e) => e.event === 'rt.audio_quality_warn').map((e) => (e.detail || {}).reason).filter(Boolean))];

    const ui = (await query('SELECT ts, kind, target_id FROM obs_ui_events WHERE session_id = ? ORDER BY ts', [id])).rows as any[];
    const endClick = ui.find((u) => u.kind === 'click' && u.target_id === 'btnEndSession');
    const completedAt = ev.find((e) => e.event === 'rt.state_change' && (e.detail || {}).state === 'COMPLETED')?.ts || null;
    let hiddenCount = 0, hiddenMs = 0, hiddenAt: number | null = null;
    const stopAt = endClick ? new Date(endClick.ts).getTime() : Infinity;
    for (const u of ui) {
      if (u.kind !== 'visibility') continue;
      const t = new Date(u.ts).getTime();
      if (t > stopAt) break;
      if (u.target_id === 'hidden' && hiddenAt === null) { hiddenAt = t; hiddenCount++; }
      else if (u.target_id === 'visible' && hiddenAt !== null) { hiddenMs += t - hiddenAt; hiddenAt = null; }
    }

    const text: string = s.transcript || '';
    const paras = text.split(/\n\n+/).filter(Boolean);
    const shortParas = paras.filter((p) => p.replace(/^گوینده [۰-۹0-9]+:\s*/, '').trim().split(/\s+/).filter(Boolean).length <= 3).length;
    const durMs = Number(s.duration_ms) || 0;

    type F = { level: 'ok' | 'warn' | 'error'; text: string };
    const findings: F[] = [];
    const sec = (ms: number) => Math.round(ms / 1000);
    if (s.source === 'live') {
      if (s.status === 'in_progress' || s.status === 'recovered') findings.push({ level: 'warn', text: 'جلسه «پایان» نخورده است؛ داده تا آخرین ذخیره موجود است.' });
      if (endClick) findings.push({ level: 'ok', text: `دکمه‌ی «پایان جلسه» زده شد (ساعتِ ${new Date(endClick.ts).toLocaleTimeString('fa-IR', { timeZone: 'Asia/Tehran' })}).` });
      if (!audioRows.length) findings.push({ level: 'error', text: 'هیچ صدایی برایِ این جلسه به سرور نرسیده است.' });
      else {
        if (durMs > 0 && audioMs < durMs * 0.9) findings.push({ level: 'error', text: `صدایِ رسیده (${sec(audioMs)}ث) کمتر از مدتِ جلسه (${sec(durMs)}ث) است — ${sec(durMs - audioMs)} ثانیه صدا نرسیده.` });
        else findings.push({ level: 'ok', text: `صدایِ کاملِ جلسه رسیده است (${sec(audioMs)}ث در ${audioRows.length} تکه).` });
        if (kbps !== null && audioMs > 20000 && kbps < 6) findings.push({ level: 'error', text: `صدا عملاً سکوت است (${kbps} kbps؛ جلساتِ سالم ۱۱–۲۵). میکروفون صدایی نگرفته — میکروفونِ اشتباه/بی‌صدا یا اشغال توسطِ برنامه‌ی دیگر.` });
        if (missing.length) findings.push({ level: 'error', text: `${missing.length} تکه از صدا هرگز به سرور نرسید (شماره‌ها: ${missing.join('، ')}).` });
      }
      if (unreadable) findings.push({ level: 'warn', text: 'بعضی تکه‌هایِ صدا خراب‌اند و از فایلِ کامل کنار گذاشته شدند.' });
      if (pendingCount) findings.push({ level: 'warn', text: `${pendingCount} فایلِ صدا هنوز در صفِ پردازشِ سرور است.` });
      if (micLost) findings.push({ level: 'error', text: `میکروفون ${micLost} بار حینِ ضبط قطع شد.` });
      for (const q of quality) {
        const m: Record<string, string> = { no_signal: 'میکروفون صدایی نمی‌گرفت', too_quiet: 'صدا خیلی ضعیف بود (دور از میکروفون)', noisy: 'نویزِ محیط غالب بود', clipping: 'صدا خش داشت (خیلی بلند)' };
        findings.push({ level: 'warn', text: 'هشدارِ کیفیتِ ضبط: ' + (m[q] || q) });
      }
      if (hiddenCount) findings.push({ level: 'warn', text: `صفحه ${hiddenCount} بار حینِ جلسه پنهان شد (جمعاً ${sec(hiddenMs)}ث) — رویِ موبایل می‌تواند رونویسی را قطع کند.` });
      if (wsDrops) findings.push({ level: 'warn', text: `اتصالِ رونویسیِ زنده ${wsDrops} بار قطع شد؛ ${reconnectOk} بار دوباره وصل شد.` });
      if (exhausted || mintFailed) findings.push({ level: 'error', text: `رونویسیِ زنده مدتی کاملاً در دسترس نبود (${exhausted + mintFailed} رویداد)؛ متنِ آن بازه از صدا بازیابی می‌شود.` });
      if (batchFailed || s.batch_status === 'failed') findings.push({ level: 'error', text: 'رونویسیِ صدایِ دوره‌ی قطعی ناموفق بود.' });
      if (audioMs > 60000 && text.length / (audioMs / 1000) < 2) findings.push({ level: 'error', text: `متن نسبت به طولِ صدا خیلی کم است (${text.length} نویسه برایِ ${sec(audioMs)}ث).` });
      if (paras.length >= 10 && shortParas / paras.length > 0.4) findings.push({ level: 'warn', text: `متن ${paras.length} بندِ گوینده دارد که ${shortParas} تایش ≤۳ کلمه است — تفکیکِ گوینده متن را تکه‌تکه نشان می‌دهد (داده گم نشده).` });
    }
    return {
      diagnosis: {
        status: s.status, duration_ms: durMs, audio_ms: audioMs, audio_segments: audioRows.length, audio_kbps: kbps,
        missing_segments: missing, pending_count: pendingCount, ws_drops: wsDrops, reconnect_ok: reconnectOk,
        reconnect_exhausted: exhausted, mint_failed: mintFailed, mic_lost: micLost, quality_warnings: quality,
        hidden_count: hiddenCount, hidden_ms: hiddenMs, end_clicked_at: endClick ? endClick.ts : null, completed_at: completedAt,
        transcript_chars: text.length, speaker_paragraphs: paras.length, short_paragraphs: shortParas,
        updated_at: s.updated_at,
      },
      findings,
    };
  });

  // GET /api/admin/sessions/:id/timeline — همه‌ی رویدادهایِ مرتبط با یک جلسه، مرتب بر ts.
  app.get('/api/admin/sessions/:id/timeline', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await query('SELECT id, created_at, updated_at, status FROM sessions WHERE id = ?', [id]);
    if (session.rows.length === 0) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    type TimelineItem = {
      ts: string; lane: 'server' | 'client' | 'ui' | 'audio' | 'note' | 'db'; label: string; detail: Record<string, unknown>;
    };
    const items: TimelineItem[] = [];

    const events = await query(
      'SELECT ts, source, severity, event, code, duration_ms, status_code, route, method, detail FROM obs_events WHERE session_id = ? ORDER BY ts',
      [id]
    );
    for (const r of events.rows) {
      items.push({
        ts: r.ts, lane: r.source === 'client' ? 'client' : 'server', label: r.event,
        detail: { severity: r.severity, code: r.code, duration_ms: r.duration_ms, status_code: r.status_code, route: r.route, method: r.method, ...(r.detail || {}) },
      });
    }

    const uiEvents = await query(
      'SELECT ts, kind, screen, target_id, target_role, target_tag, value_num FROM obs_ui_events WHERE session_id = ? ORDER BY ts',
      [id]
    );
    for (const r of uiEvents.rows) {
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
    const notes = await query(
      'SELECT id, type, sign_type, created_at, CHAR_LENGTH(text) AS text_len FROM session_notes WHERE session_id = ? ORDER BY created_at',
      [id]
    );
    for (const r of notes.rows) {
      items.push({ ts: r.created_at, lane: 'note', label: 'note.' + r.type, detail: { sign_type: r.sign_type, text_len: r.text_len } });
    }

    items.push({ ts: session.rows[0].created_at, lane: 'db', label: 'session.created_at', detail: {} });
    items.push({ ts: session.rows[0].updated_at, lane: 'db', label: 'session.updated_at', detail: { status: session.rows[0].status } });

    items.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    return { timeline: items };
  });

  // GET /api/admin/obs/events — جدولِ فیلترشده‌ی obs_events (فیلترهایِ اختیاری، الگوی
  // موجودِ `? IS NULL OR col = ?`).
  app.get('/api/admin/obs/events', async (request) => {
    const q = request.query as {
      event?: string; severity?: string; therapist_id?: string; session_id?: string;
      source?: string; from?: string; to?: string; limit?: string;
    };
    const limitRaw = Number(q.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 500) : 100;
    const event = q.event?.trim() || null;
    const severity = q.severity?.trim() || null;
    const therapistId = q.therapist_id?.trim() || null;
    const sessionId = q.session_id?.trim() || null;
    const source = q.source?.trim() || null;
    const from = q.from?.trim() || null;
    const to = q.to?.trim() || null;

    const rows = await query(
      `SELECT id, ts, client_ts, source, severity, event, code, therapist_id, client_id, session_id,
              run_id, request_id, nav_id, route, method, status_code, duration_ms, detail
       FROM obs_events
       WHERE (? IS NULL OR event = ?)
         AND (? IS NULL OR severity = ?)
         AND (? IS NULL OR therapist_id = ?)
         AND (? IS NULL OR session_id = ?)
         AND (? IS NULL OR source = ?)
         AND (? IS NULL OR ts >= ?)
         AND (? IS NULL OR ts <= ?)
       ORDER BY ts DESC
       LIMIT ?`,
      [event, event, severity, severity, therapistId, therapistId, sessionId, sessionId, source, source, from, from, to, to, limit]
    );
    return { events: rows.rows };
  });

  // GET /api/admin/obs/ui-events — همان الگو برایِ obs_ui_events.
  app.get('/api/admin/obs/ui-events', async (request) => {
    const q = request.query as {
      kind?: string; therapist_id?: string; session_id?: string; nav_id?: string;
      from?: string; to?: string; limit?: string;
    };
    const limitRaw = Number(q.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 500) : 100;
    const kind = q.kind?.trim() || null;
    const therapistId = q.therapist_id?.trim() || null;
    const sessionId = q.session_id?.trim() || null;
    const navId = q.nav_id?.trim() || null;
    const from = q.from?.trim() || null;
    const to = q.to?.trim() || null;

    const rows = await query(
      `SELECT id, ts, client_ts, therapist_id, session_id, nav_id, seq, kind, screen, target_id, target_role, target_tag, value_num
       FROM obs_ui_events
       WHERE (? IS NULL OR kind = ?)
         AND (? IS NULL OR therapist_id = ?)
         AND (? IS NULL OR session_id = ?)
         AND (? IS NULL OR nav_id = ?)
         AND (? IS NULL OR ts >= ?)
         AND (? IS NULL OR ts <= ?)
       ORDER BY ts DESC
       LIMIT ?`,
      [kind, kind, therapistId, therapistId, sessionId, sessionId, navId, navId, from, from, to, to, limit]
    );
    return { events: rows.rows };
  });

  // GET /api/admin/obs/stats — شمارشِ روزانه‌ی ۱۴روزه به تفکیکِ رویداد، آمارِ صفِ درون‌حافظه‌ای،
  // اندازه‌ی فایل‌هایِ JSONL، و حجمِ DBِ دو جدول.
  app.get('/api/admin/obs/stats', async () => {
    const daily = await query(
      `SELECT DATE(ts) AS day, event, COUNT(*) AS count
       FROM obs_events
       WHERE ts >= DATE_SUB(NOW(), INTERVAL 14 DAY)
       GROUP BY DATE(ts), event
       ORDER BY day DESC`
    );

    let dbSize: { obs_events: number; obs_ui_events: number } = { obs_events: 0, obs_ui_events: 0 };
    try {
      const sizeRows = await query(
        `SELECT table_name, (DATA_LENGTH + INDEX_LENGTH) AS size_bytes
         FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name IN ('obs_events', 'obs_ui_events')`
      );
      for (const r of sizeRows.rows) {
        if (r.table_name === 'obs_events') dbSize.obs_events = Number(r.size_bytes) || 0;
        if (r.table_name === 'obs_ui_events') dbSize.obs_ui_events = Number(r.size_bytes) || 0;
      }
    } catch {
      // information_schema ممکن است در بعضی محیط‌های محدودشده در دسترس نباشد — fail-open
    }

    const logDir = path.join(process.cwd(), 'data', 'logs');
    let jsonlFiles: Array<{ name: string; bytes: number }> = [];
    try {
      if (existsSync(logDir)) {
        jsonlFiles = readdirSync(logDir)
          .filter((f) => f.startsWith('obs.jsonl'))
          .map((f) => {
            try { return { name: f, bytes: statSync(path.join(logDir, f)).size }; }
            catch { return { name: f, bytes: 0 }; }
          });
      }
    } catch {
      // no-op
    }

    return {
      daily_counts: daily.rows,
      queue: obsQueueStats(),
      jsonl_files: jsonlFiles,
      db_size_bytes: dbSize,
    };
  });
}
