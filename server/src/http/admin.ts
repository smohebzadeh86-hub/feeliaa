// پنل ادمین — فقط is_admin=true. هیچ‌جا متنِ رونویسی‌شده‌ی جلسات نمایش داده نمی‌شود.
import { FastifyInstance } from 'fastify';
import { createReadStream, statSync } from 'node:fs';
import { query } from '../db/connection.js';
import { requireAdmin } from '../auth/guard.js';
import { listSessionAudio, getSessionAudioRow, getFullSessionAudio } from '../stt/sessionAudioArchive.js';
import { pendingAudiosFor } from '../stt/batchqueue.js';

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
    const session = await query('SELECT id FROM sessions WHERE id = ?', [id]);
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
    return {
      audio: rows.map((r) => ({
        id: r.id, seq: r.seq, bytes: r.bytes, mime: r.mime, source: r.source, kind: r.kind,
        duration_ms: r.duration_ms, created_at: r.created_at,
      })),
      pending_count: pendingCount,
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
    const range = request.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m && m[1] ? parseInt(m[1], 10) : 0;
      const end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
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
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m && m[1] ? parseInt(m[1], 10) : 0;
      const end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
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
    await query('DELETE FROM therapists WHERE id = ?', [id]);

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
    await query('DELETE FROM clients WHERE id = ?', [id]);

    return { deleted: existing.rows[0].code };
  });
}
