// CRUD برای مراجعین — همیشه محدود به تراپیستِ واردشده
import { FastifyInstance } from 'fastify';
import { query } from '../db/connection.js';
import { requireAuth } from '../auth/guard.js';
import { getOwnedClient } from '../db/ownership.js';

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
    const { alias } = request.body as { alias?: string };

    let code = generateClientCode();
    for (let i = 0; i < 5; i++) {
      const exists = await query('SELECT id FROM clients WHERE code = $1', [code]);
      if (exists.rows.length === 0) break;
      code = generateClientCode();
    }

    const result = await query(
      'INSERT INTO clients (code, alias, therapist_id) VALUES ($1, $2, $3) RETURNING *',
      [code, alias || null, request.therapistId]
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
      SELECT id, session_num, date, start_time, duration_ms, status, created_at
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
