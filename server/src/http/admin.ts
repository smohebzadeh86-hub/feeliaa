// پنل ادمین — فقط is_admin=true. هیچ‌جا متنِ رونویسی‌شده‌ی جلسات نمایش داده نمی‌شود.
import { FastifyInstance } from 'fastify';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { query } from '../db/connection.js';
import { requireAdmin } from '../auth/guard.js';
import { listSessionAudio, getSessionAudioRow, getFullSessionAudio, deleteSessionAudioDirs, deriveSessionStatus } from '../stt/sessionAudioArchive.js';
import { collectUploadSonioxRefs, releaseSonioxRefs } from '../features/audio-upload/jobRunner.js';
import { pendingAudiosFor } from '../stt/batchqueue.js';
import { logEvent, obsQueueStats } from '../obs/eventLog.js';

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
        s.status, s.source, s.consent, s.transcript, s.created_at
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

    return { deleted: existing.rows[0].code };
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
