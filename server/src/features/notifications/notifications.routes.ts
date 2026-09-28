// APIِ اعلان‌هایِ تراپیست (migration 023) — فهرست + علامتِ «خوانده‌شده».
//
// GET    /api/notifications
// POST   /api/notifications/read          { ids?: string[] } | { all: true }
//
// مالکیت (LAW-004): همه با therapist_id.
import type { FastifyInstance } from 'fastify';
import { query } from '../../db/connection.js';
import { requireAuth } from '../../auth/guard.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/api/notifications', async (request) => {
    const r = await query(
      `SELECT n.id, n.kind, n.client_id, n.session_id, n.job_id, n.error_code, n.created_at, n.read_at,
              c.code AS client_code, c.alias AS client_alias, s.session_num
       FROM notifications n
       LEFT JOIN clients c ON c.id = n.client_id
       LEFT JOIN sessions s ON s.id = n.session_id
       WHERE n.therapist_id = ? ORDER BY n.created_at DESC LIMIT 30`,
      [request.therapistId]
    );
    const unread = await query('SELECT COUNT(*) AS n FROM notifications WHERE therapist_id = ? AND read_at IS NULL', [request.therapistId]);
    return { notifications: r.rows, unread: Number(unread.rows[0]?.n || 0) };
  });

  app.post('/api/notifications/read', async (request) => {
    const b = (request.body || {}) as { ids?: string[]; all?: boolean };
    if (b.all) {
      await query('UPDATE notifications SET read_at = NOW() WHERE therapist_id = ? AND read_at IS NULL', [request.therapistId]);
    } else if (Array.isArray(b.ids) && b.ids.length) {
      const ids = b.ids.filter((x) => UUID_RE.test(String(x))).slice(0, 100);
      if (ids.length) {
        await query(
          `UPDATE notifications SET read_at = NOW() WHERE therapist_id = ? AND read_at IS NULL AND id IN (${ids.map(() => '?').join(',')})`,
          [request.therapistId, ...ids]
        );
      }
    }
    return { ok: true };
  });
}
