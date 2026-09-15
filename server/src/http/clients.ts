// CRUD برای مراجعین — همیشه محدود به تراپیستِ واردشده
import { FastifyInstance } from 'fastify';
import { query } from '../db/connection.js';
import { requireAuth } from '../auth/guard.js';
import { getOwnedClient } from '../db/ownership.js';

const VALID_CATEGORIES = ['child', 'teen', 'adult'];
const VALID_GENDERS = ['f', 'm'];
const VALID_STATUSES = ['active', 'inactive'];
const MAX_STATUS_REASON_LEN = 200;

// دلیلِ غیرفعال‌بودن: trim؛ خالی (مثلاً گزینه‌ی «نامشخص») = null
function cleanStatusReason(reason: unknown): string | null {
  return typeof reason === 'string' && reason.trim() ? reason.trim() : null;
}

// تولید کد یکتا: CL-XXXX
function generateClientCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CL-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function clientRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /api/clients — لیست مراجعینِ همین تراپیست
  app.get('/api/clients', async (request) => {
    const result = await query(`
      SELECT
        c.id, c.code, c.alias, c.created_at,
        c.status, c.status_reason, c.category, c.gender,
        COUNT(s.id) as session_count,
        MAX(s.date) as last_session_date
      FROM clients c
      LEFT JOIN sessions s ON s.client_id = c.id
      WHERE c.therapist_id = $1
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `, [request.therapistId]);
    return { clients: result.rows };
  });

  // ⭐ GET /api/recovered — جلسات قطع‌شده‌ی همین تراپیست (یک query)
  // ⭐ مرتب بر اساس session_num DESC — همیشه جدیدترین جلسه (نه updated_at)
  app.get('/api/recovered', async (request) => {
    const result = await query(`
      SELECT
        s.id, s.client_id, s.session_num, s.date, s.start_time,
        s.duration_ms, s.status, s.transcript,
        LENGTH(COALESCE(s.transcript, '')) as transcript_chars,
        c.code as client_code, c.alias as client_alias
      FROM sessions s
      JOIN clients c ON c.id = s.client_id
      WHERE s.status = 'recovered' AND c.therapist_id = $1
      ORDER BY s.session_num DESC
    `, [request.therapistId]);
    return { recovered: result.rows };
  });

  // POST /api/clients — ساخت مراجع جدید برای همین تراپیست
  app.post('/api/clients', async (request, reply) => {
    const { alias, category, gender, status, reason } = request.body as {
      alias?: string; category?: string; gender?: string; status?: string; reason?: string;
    };

    if (category && !VALID_CATEGORIES.includes(category)) {
      reply.code(400);
      return { error: 'دسته‌بندی نامعتبر است' };
    }
    if (gender && !VALID_GENDERS.includes(gender)) {
      reply.code(400);
      return { error: 'جنسیت نامعتبر است' };
    }
    // ⭐ ساخت در تبِ «غیرفعال» (آرشیوِ پرونده‌های قبلی) — قبلاً status پذیرفته نمی‌شد و
    // مراجع همیشه active ساخته می‌شد، یعنی از تبی که در آن ساخته شده بود ناپدید می‌شد.
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      reply.code(400);
      return { error: 'وضعیت نامعتبر است' };
    }
    const finalStatus = status === 'inactive' ? 'inactive' : 'active';
    const statusReason = finalStatus === 'inactive' ? cleanStatusReason(reason) : null;
    if (statusReason && statusReason.length > MAX_STATUS_REASON_LEN) {
      reply.code(400);
      return { error: 'دلیل بیش از حد طولانی است' };
    }

    // جنسیت فقط برایِ نوجوان/بزرگسال معنا داره
    const finalGender = (category === 'teen' || category === 'adult') ? (gender || null) : null;

    let code = generateClientCode();
    for (let i = 0; i < 5; i++) {
      const exists = await query('SELECT id FROM clients WHERE code = $1', [code]);
      if (exists.rows.length === 0) break;
      code = generateClientCode();
    }

    const result = await query(
      'INSERT INTO clients (code, alias, therapist_id, category, gender, status, status_reason) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [code, alias || null, request.therapistId, category || null, finalGender, finalStatus, statusReason]
    );

    reply.code(201);
    return { client: result.rows[0] };
  });

  // GET /api/clients/:id — جزئیات یک مراجع + جلساتش (فقط اگر مالِ همین تراپیست باشه)
  app.get('/api/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const client = await getOwnedClient(id, request.therapistId!);
    if (!client) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    const sessionsResult = await query(`
      SELECT id, session_num, date, start_time, duration_ms, status, source, created_at
      FROM sessions
      WHERE client_id = $1
      ORDER BY session_num DESC
    `, [id]);

    return {
      client,
      sessions: sessionsResult.rows,
    };
  });

  // PUT /api/clients/:id — ویرایش alias
  app.put('/api/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { alias } = request.body as { alias: string };

    const owned = await getOwnedClient(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    const result = await query(
      'UPDATE clients SET alias = $1 WHERE id = $2 AND therapist_id = $3 RETURNING *',
      [alias, id, request.therapistId]
    );

    if (result.rows.length === 0) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    return { client: result.rows[0] };
  });

  // PATCH /api/clients/:id/status — انتقال فعال/غیرفعال (همیشه اقدامِ دستیِ تراپیست)
  app.patch('/api/clients/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, reason } = request.body as { status: string; reason?: string };

    if (!VALID_STATUSES.includes(status)) {
      reply.code(400);
      return { error: 'وضعیت نامعتبر است' };
    }

    // برگشت به فعال یعنی دلیلِ قبلی دیگه معتبر نیست
    const statusReason = status === 'inactive' ? cleanStatusReason(reason) : null;
    if (statusReason && statusReason.length > MAX_STATUS_REASON_LEN) {
      reply.code(400);
      return { error: 'دلیل بیش از حد طولانی است' };
    }

    const owned = await getOwnedClient(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    const result = await query(
      'UPDATE clients SET status = $1, status_reason = $2 WHERE id = $3 AND therapist_id = $4 RETURNING *',
      [status, statusReason, id, request.therapistId]
    );

    // مراجع بینِ چکِ مالکیت و UPDATE حذف شده — مثلِ PUT، نه 200 با client خالی
    if (result.rows.length === 0) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    return { client: result.rows[0] };
  });

  // PATCH /api/clients/:id/category — تغییرِ دسته‌بندیِ دموگرافیک (+ جنسیتِ اختیاری)
  app.patch('/api/clients/:id/category', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { category, gender } = request.body as { category: string | null; gender?: string | null };

    if (category !== null && category !== undefined && !VALID_CATEGORIES.includes(category)) {
      reply.code(400);
      return { error: 'دسته‌بندی نامعتبر است' };
    }
    if (gender !== null && gender !== undefined && !VALID_GENDERS.includes(gender)) {
      reply.code(400);
      return { error: 'جنسیت نامعتبر است' };
    }

    const owned = await getOwnedClient(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    // جنسیت فقط برایِ نوجوان/بزرگسال معنا داره — با تغییرِ دسته به کودک، پاک می‌شه
    const finalGender = (category === 'teen' || category === 'adult') ? (gender || null) : null;

    const result = await query(
      'UPDATE clients SET category = $1, gender = $2 WHERE id = $3 AND therapist_id = $4 RETURNING *',
      [category || null, finalGender, id, request.therapistId]
    );

    return { client: result.rows[0] };
  });

  // DELETE /api/clients/:id — حذف آبشاری
  app.delete('/api/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const owned = await getOwnedClient(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    const countResult = await query(`
      SELECT
        (SELECT COUNT(*) FROM sessions WHERE client_id = $1) as session_count,
        (SELECT COUNT(*) FROM session_notes WHERE session_id IN
          (SELECT id FROM sessions WHERE client_id = $1)) as note_count
    `, [id]);

    const result = await query(
      'DELETE FROM clients WHERE id = $1 AND therapist_id = $2 RETURNING code',
      [id, request.therapistId]
    );

    if (result.rows.length === 0) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    return {
      deleted: result.rows[0].code,
      cascade: countResult.rows[0],
    };
  });
}
