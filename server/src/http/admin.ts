// پنل ادمین — فقط is_admin=true. هیچ‌جا متنِ رونویسی‌شده‌ی جلسات نمایش داده نمی‌شود.
import { FastifyInstance } from 'fastify';
import { query } from '../db/connection.js';
import { requireAdmin } from '../auth/guard.js';

// دیتای کاملِ یک تراپیست: مراجعین + جلسات (با متنِ رونویسی) + یادداشت‌ها/علائم.
// فقط از دو مسیرِ export که پشتِ requireAdmin هستن صدا زده می‌شه.
async function buildTherapistExport(therapistId: string) {
  const t = await query('SELECT id, phone, email, name, created_at FROM therapists WHERE id = $1', [therapistId]);
  if (t.rows.length === 0) return null;

  const clients = await query(
    'SELECT id, code, alias, created_at FROM clients WHERE therapist_id = $1 ORDER BY created_at',
    [therapistId]
  );

  const sessions = await query(`
    SELECT s.id, s.client_id, s.session_num, s.date, s.start_time, s.duration_ms,
           s.status, s.transcript, s.created_at
    FROM sessions s
    JOIN clients c ON c.id = s.client_id
    WHERE c.therapist_id = $1
    ORDER BY s.client_id, s.session_num
  `, [therapistId]);

  const notes = await query(`
    SELECT n.id, n.session_id, n.type, n.text, n.sign_type, n.offset_ms, n.wall_clock, n.created_at
    FROM session_notes n
    JOIN sessions s ON s.id = n.session_id
    JOIN clients c ON c.id = s.client_id
    WHERE c.therapist_id = $1
    ORDER BY n.session_id, n.offset_ms NULLS LAST, n.created_at
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
