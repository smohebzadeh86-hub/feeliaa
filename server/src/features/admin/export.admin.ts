// ⭐ خروجِ داده از پلتفرم (export) — فقط همین دو مسیرِ ادمین (LAW-005). pluginِ فرزندِ adminRoutes (requireAdmin).
import { FastifyInstance } from 'fastify';
import { logEvent } from '../../obs/eventLog.js';
import { recordAudit } from '../../obs/audit.js';
import { exportCanonicalRecord } from '../session-record/index.js';
import { exportFinalTranscript } from '../final-transcript/index.js';
import {
  getTherapistForExport, listClientsForExport, listSessionsForExport, listNotesForExport, listTherapistIdsForExport,
  listTranscriptRevisionsForExport, listNoteRevisionsForExport, listCaseFilesForExport, listCaseFileVersionsForExport,
} from './admin.repository.js';

// دیتای کاملِ یک تراپیست: مراجعین + جلسات (با متنِ رونویسی) + یادداشت‌ها/علائم.
// فقط از دو مسیرِ export که پشتِ requireAdmin هستن صدا زده می‌شه.
async function buildTherapistExport(therapistId: string) {
  const therapist = await getTherapistForExport(therapistId);
  if (!therapist) return null;

  const clients = await listClientsForExport(therapistId);
  const sessions = await listSessionsForExport(therapistId);
  const notes = await listNotesForExport(therapistId);
  // schema v3 (2026-10-02): همه‌چیز — حذف‌شده‌ها (deleted_at روی مراجع/جلسه/یادداشت) + تاریخچه‌هایِ ویرایش + پرونده و نسخه‌هایش
  const transcriptRevisions = await listTranscriptRevisionsForExport(therapistId);
  const noteRevisions = await listNoteRevisionsForExport(therapistId);
  const caseFiles = await listCaseFilesForExport(therapistId);
  const caseFileVersions = await listCaseFileVersionsForExport(therapistId);
  const group = (rows: any[], key: string) => { const m = new Map<string, any[]>(); for (const r of rows) { if (!m.has(r[key])) m.set(r[key], []); m.get(r[key])!.push(r); } return m; };
  const revBySession = group(transcriptRevisions, 'session_id');
  const noteRevBySession = group(noteRevisions, 'session_id');
  const cfByClient = new Map<string, any>(caseFiles.map((f) => [f.client_id, f]));
  const cfvByClient = group(caseFileVersions, 'client_id');

  const notesBySession = new Map<string, any[]>();
  for (const n of notes) {
    if (!notesBySession.has(n.session_id)) notesBySession.set(n.session_id, []);
    notesBySession.get(n.session_id)!.push(n);
  }
  const sessionsByClient = new Map<string, any[]>();
  for (const s of sessions) {
    // schema v2: رکوردِ canonical (نوبت‌هایِ گوینده با نقش، زمان و اطمینان) کنارِ متنِ خام؛ null برایِ جلسه‌یِ بدونِ رکورد
    // schema v4 (2026-10-04): «متنِ نهایی» (متنِ مرتب، نوبت‌ها با نقش، فهرستِ نسخه‌ها) + منشأ/سنجه‌هایِ رکوردِ canonical
    const withNotes = { ...s, notes: notesBySession.get(s.id) || [], canonical: await exportCanonicalRecord(s.id),
      final_transcript: await exportFinalTranscript(s.id),
      transcript_revisions: revBySession.get(s.id) || [], note_revisions: noteRevBySession.get(s.id) || [] };
    if (!sessionsByClient.has(s.client_id)) sessionsByClient.set(s.client_id, []);
    sessionsByClient.get(s.client_id)!.push(withNotes);
  }

  return {
    therapist,
    clients: clients.map(c => ({ ...c, sessions: sessionsByClient.get(c.id) || [], case_file: cfByClient.get(c.id) || null, case_file_versions: cfvByClient.get(c.id) || [] })),
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
    return { schema_version: 4, exported_at: new Date().toISOString(), therapists: all };
  });
}
