// CRUD برای مراجعین
import { FastifyInstance } from 'fastify';
import { query } from '../db/connection.js';

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
  
  // GET /api/clients — لیست همه‌ی مراجعین
  app.get('/api/clients', async () => {
    const result = await query(`
      SELECT 
        c.id, c.code, c.alias, c.created_at,
        COUNT(s.id) as session_count,
        MAX(s.date) as last_session_date
      FROM clients c
      LEFT JOIN sessions s ON s.client_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    return { clients: result.rows };
  });

  // POST /api/clients — ساخت مراجع جدید
  app.post('/api/clients', async (request, reply) => {
    const { alias } = request.body as { alias?: string };
    
    // تولید کد یکتا (اگر تصادفی تکراری بود، دوباره)
    let code = generateClientCode();
    for (let i = 0; i < 5; i++) {
      const exists = await query('SELECT id FROM clients WHERE code = $1', [code]);
      if (exists.rows.length === 0) break;
      code = generateClientCode();
    }

    const result = await query(
      'INSERT INTO clients (code, alias) VALUES ($1, $2) RETURNING *',
      [code, alias || null]
    );
    
    reply.code(201);
    return { client: result.rows[0] };
  });

  // GET /api/clients/:id — جزئیات یک مراجع + جلساتش
  app.get('/api/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const clientResult = await query(
      'SELECT * FROM clients WHERE id = $1', [id]
    );
    
    if (clientResult.rows.length === 0) {
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
      client: clientResult.rows[0],
      sessions: sessionsResult.rows,
    };
  });

  // PUT /api/clients/:id — ویرایش (فقط alias)
  app.put('/api/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { alias } = request.body as { alias: string };
    
    const result = await query(
      'UPDATE clients SET alias = $1 WHERE id = $2 RETURNING *',
      [alias, id]
    );
    
    if (result.rows.length === 0) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }
    
    return { client: result.rows[0] };
  });

  // DELETE /api/clients/:id — حذف (آبشاری)
  app.delete('/api/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    // شمارش چیزی که حذف می‌شه (برای پیام تأیید)
    const countResult = await query(`
      SELECT 
        (SELECT COUNT(*) FROM sessions WHERE client_id = $1) as session_count,
        (SELECT COUNT(*) FROM session_notes WHERE session_id IN 
          (SELECT id FROM sessions WHERE client_id = $1)) as note_count
    `, [id]);
    
    const result = await query('DELETE FROM clients WHERE id = $1 RETURNING code', [id]);
    
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