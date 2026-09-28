// ⭐ خروجِ داده از پلتفرم (export) — فقط همین دو مسیرِ ادمین (LAW-005). pluginِ فرزندِ adminRoutes (requireAdmin).
import { FastifyInstance } from 'fastify';
import { logEvent } from '../../obs/eventLog.js';
import { recordAudit } from '../../obs/audit.js';
import {
  getTherapistForExport, listClientsForExport, listSessionsForExport, listNotesForExport, listTherapistIdsForExport,
} from './admin.repository.js';

// دیتای کاملِ یک تراپیست: مراجعین + جلسات (با متنِ رونویسی) + یادداشت‌ها/علائم.
// فقط از دو مسیرِ export که پشتِ requireAdmin هستن صدا زده می‌شه.
async function buildTherapistExport(therapistId: string) {
  const therapist = await getTherapistForExport(therapistId);
  if (!therapist) return null;

  const clients = await listClientsForExport(therapistId);
  const sessions = await listSessionsForExport(therapistId);
  const notes = await listNotesForExport(therapistId);

  const notesBySession = new Map<string, any[]>();
  for (const n of notes) {
    if (!notesBySession.has(n.session_id)) notesBySession.set(n.session_id, []);
    notesBySession.get(n.session_id)!.push(n);
  }
  const sessionsByClient = new Map<string, any[]>();
  for (const s of sessions) {
    const withNotes = { ...s, notes: notesBySession.get(s.id) || [] };
    if (!sessionsByClient.has(s.client_id)) sessionsByClient.set(s.client_id, []);
    sessionsByClient.get(s.client_id)!.push(withNotes);
  }

  return {
    therapist,
    clients: clients.map(c => ({ ...c, sessions: sessionsByClient.get(c.id) || [] })),
  };
}

export async function exportAdminRoutes(app: FastifyInstance) {
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
    const ids = await listTherapistIdsForExport();
    const all = [];
    for (const therapistId of ids) {
      const data = await buildTherapistExport(therapistId);
      if (data) all.push(data);
    }
    logEvent({ event: 'admin.export', therapistId: request.therapistId, detail: { kind: 'full', count: all.length } });
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.export', targetType: 'system', detail: { kind: 'full', count: all.length } });
    reply.header('Content-Disposition', `attachment; filename="feelia-export-${new Date().toISOString().slice(0, 10)}.json"`);
    reply.type('application/json');
    return { exported_at: new Date().toISOString(), therapists: all };
  });
}
