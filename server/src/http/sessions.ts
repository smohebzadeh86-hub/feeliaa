// CRUD برای جلسات
import { FastifyInstance } from 'fastify';
import { query } from '../db/connection.js';

export async function sessionRoutes(app: FastifyInstance) {

  // POST /api/sessions — شروع جلسه‌ی جدید
  app.post('/api/sessions', async (request, reply) => {
    const { client_id, consent, date, start_time } = request.body as {
      client_id: string;
      consent: boolean;
      date?: string;
      start_time?: string;
    };

    if (!consent) {
      reply.code(400);
      return { error: 'رضایت مراجع الزامی است' };
    }

    // چک: مراجع وجود داره؟
    const clientCheck = await query(
      'SELECT code, alias FROM clients WHERE id = $1', [client_id]
    );
    if (clientCheck.rows.length === 0) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    // شماره‌ی جلسه: آخرین + ۱
    const lastNum = await query(
      'SELECT COALESCE(MAX(session_num), 0) + 1 as next FROM sessions WHERE client_id = $1',
      [client_id]
    );
    const sessionNum = lastNum.rows[0].next;

    // تاریخ و ساعت: پیش‌فرض الان
    const now = new Date();
    const defaultDate = date || `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const defaultTime = start_time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const result = await query(
      `INSERT INTO sessions (client_id, session_num, date, start_time, consent, status)
       VALUES ($1, $2, $3, $4, $5, 'in_progress')
       RETURNING *`,
      [client_id, sessionNum, defaultDate, defaultTime, true]
    );

    reply.code(201);
    return {
      session: result.rows[0],
      client: clientCheck.rows[0],
    };
  });

  // GET /api/sessions/:id — جزئیات جلسه + یادداشت‌ها
  app.get('/api/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const sessionResult = await query(
      `SELECT s.*, c.code, c.alias 
       FROM sessions s 
       JOIN clients c ON c.id = s.client_id 
       WHERE s.id = $1`, [id]
    );

    if (sessionResult.rows.length === 0) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    const notesResult = await query(
      'SELECT * FROM session_notes WHERE session_id = $1 ORDER BY offset_ms NULLS LAST, created_at',
      [id]
    );

    return {
      session: sessionResult.rows[0],
      notes: notesResult.rows,
    };
  });

  // PUT /api/sessions/:id — به‌روزرسانی (پایان جلسه / متن نهایی)
  app.put('/api/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      transcript?: string;
      anchors?: Array<{ chars: number; off: number }>;
      duration_ms?: number;
      status?: string;
    };

    // فقط فیلدهای ارسال‌شده رو آپدیت کن
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (body.transcript !== undefined) {
      updates.push(`transcript = $${paramCount++}`);
      values.push(body.transcript);
    }
    if (body.anchors !== undefined) {
      updates.push(`anchors = $${paramCount++}`);
      values.push(JSON.stringify(body.anchors));
    }
    if (body.duration_ms !== undefined) {
      updates.push(`duration_ms = $${paramCount++}`);
      values.push(body.duration_ms);
    }
    if (body.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(body.status);
    }
    
    updates.push(`updated_at = now()`);
    values.push(id);

    const result = await query(
      `UPDATE sessions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    return { session: result.rows[0] };
  });

  // POST /api/sessions/:id/notes — افزودن یادداشت/علامت
  app.post('/api/sessions/:id/notes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { type, text, sign_type, offset_ms, wall_clock } = request.body as {
      type: 'note_during' | 'note_after' | 'sign' | 'voice';
      text?: string;
      sign_type?: string;
      offset_ms?: number;
      wall_clock?: string;
    };

    if (!type) {
      reply.code(400);
      return { error: 'type الزامی است' };
    }

    const result = await query(
      `INSERT INTO session_notes (session_id, type, text, sign_type, offset_ms, wall_clock)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, type, text || null, sign_type || null, offset_ms || null, wall_clock || null]
    );

    reply.code(201);
    return { note: result.rows[0] };
  });

  // DELETE /api/notes/:id — حذف یادداشت
  app.delete('/api/notes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query('DELETE FROM session_notes WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      reply.code(404);
      return { error: 'یادداشت یافت نشد' };
    }
    return { deleted: id };
  });
}