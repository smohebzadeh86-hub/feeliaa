// پنل ادمین — فقط is_admin=true. هیچ‌جا متنِ رونویسی‌شده‌ی جلسات نمایش داده نمی‌شود.
import { FastifyInstance } from 'fastify';
import { query } from '../db/connection.js';
import { requireAdmin } from '../auth/guard.js';

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
        (SELECT COUNT(*) FROM sessions WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as sessions_this_week
    `);
    return { stats: result.rows[0] };
  });

  // GET /api/admin/therapists?q=search
  app.get('/api/admin/therapists', async (request) => {
    const { q } = request.query as { q?: string };
    const search = q?.trim();

    const result = await query(`
      SELECT
        t.id, t.phone, t.email, t.name, t.is_admin, t.active, t.created_at,
        COUNT(DISTINCT c.id) as client_count,
        COUNT(DISTINCT s.id) as session_count,
        MAX(s.created_at) as last_session_at
      FROM therapists t
      LEFT JOIN clients c ON c.therapist_id = t.id
      LEFT JOIN sessions s ON s.client_id = c.id
      WHERE $1::text IS NULL OR t.phone ILIKE '%'||$1||'%' OR t.name ILIKE '%'||$1||'%' OR t.email ILIKE '%'||$1||'%'
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `, [search || null]);

    return { therapists: result.rows };
  });

  // GET /api/admin/therapists/:id/clients — بدونِ transcript، فقط متادیتا
  app.get('/api/admin/therapists/:id/clients', async (request, reply) => {
    const { id } = request.params as { id: string };

    const therapist = await query('SELECT id, phone, name FROM therapists WHERE id = $1', [id]);
    if (therapist.rows.length === 0) {
      reply.code(404);
      return { error: 'تراپیست یافت نشد' };
    }

    const clients = await query(`
      SELECT c.id, c.code, c.alias, c.created_at,
        COUNT(s.id) as session_count,
        MAX(s.date) as last_session_date
      FROM clients c
      LEFT JOIN sessions s ON s.client_id = c.id
      WHERE c.therapist_id = $1
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `, [id]);

    return { therapist: therapist.rows[0], clients: clients.rows };
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
        const adminCount = await query('SELECT COUNT(*) FROM therapists WHERE is_admin = true');
        if (Number(adminCount.rows[0].count) <= 1) {
          reply.code(400);
          return { error: 'شما تنها ادمین سیستم هستید — نمی‌توانید این نقش را از خودتان بردارید' };
        }
      }
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let n = 1;
    if (typeof active === 'boolean') { updates.push(`active = $${n++}`); values.push(active); }
    if (typeof is_admin === 'boolean') { updates.push(`is_admin = $${n++}`); values.push(is_admin); }
    if (updates.length === 0) {
      reply.code(400);
      return { error: 'چیزی برای به‌روزرسانی نیست' };
    }
    values.push(id);

    const result = await query(
      `UPDATE therapists SET ${updates.join(', ')} WHERE id = $${n} RETURNING id, phone, email, name, is_admin, active, created_at`,
      values
    );
    if (result.rows.length === 0) {
      reply.code(404);
      return { error: 'تراپیست یافت نشد' };
    }

    return { therapist: result.rows[0] };
  });

  // DELETE /api/admin/therapists/:id — آبشاری (clients/sessions/notes با ON DELETE CASCADE)
  app.delete('/api/admin/therapists/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (id === request.therapistId) {
      reply.code(400);
      return { error: 'نمی‌توانید حساب خودتان را حذف کنید' };
    }

    const result = await query('DELETE FROM therapists WHERE id = $1 RETURNING phone', [id]);
    if (result.rows.length === 0) {
      reply.code(404);
      return { error: 'تراپیست یافت نشد' };
    }

    return { deleted: result.rows[0].phone };
  });

  // DELETE /api/admin/clients/:id — حذفِ یک مراجعِ خاص، مستقل از تراپیستش
  app.delete('/api/admin/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await query('DELETE FROM clients WHERE id = $1 RETURNING code', [id]);
    if (result.rows.length === 0) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    return { deleted: result.rows[0].code };
  });
}
