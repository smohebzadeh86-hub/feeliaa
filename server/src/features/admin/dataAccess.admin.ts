// ادمین: دسترسیِ کامل به همه‌یِ داده — حذف‌شده‌ها، تاریخچه‌هایِ ویرایش، پرونده و نسخه‌هایش (2026-10-02، تصمیمِ مالک:
// «به همه دیتا دسترسی داشته باشم و هیچی هارد دیلیت نشه»). pluginِ فرزندِ adminRoutes (requireAdmin). هر خواندنِ متنِ بالینی audit می‌شود (LAW-005).
import { FastifyInstance } from 'fastify';
import { recordAudit } from '../../obs/audit.js';
import {
  listDeletedOverview, restoreDeletedNote, listTranscriptRevisionsAdmin, getTranscriptRevisionAdmin, listNoteRevisionsAdmin,
  getNoteRevisionAdmin, getCaseFileAdmin, listCaseFileVersionsAdmin, getCaseFileVersionAdmin,
} from './admin.repository.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const parse = (v: unknown) => { if (typeof v !== 'string') return v ?? null; try { return JSON.parse(v); } catch { return null; } };

export async function dataAccessAdminRoutes(app: FastifyInstance) {
  // GET /api/admin/deleted — همه‌یِ حذف‌شده‌هایِ نرم (مراجع، جلسه، یادداشت) در کلِ سیستم؛ فقط متادیتا
  app.get('/api/admin/deleted', async () => listDeletedOverview());

  // POST /api/admin/notes/:id/restore — بازگردانیِ یادداشتِ حذف‌شده
  app.post('/api/admin/notes/:id/restore', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!UUID_RE.test(id) || (await restoreDeletedNote(id)) === 0) { reply.code(404); return { error: 'یادداشتِ حذف‌شده یافت نشد' }; }
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.session_restore', targetType: 'session', targetId: id, detail: { kind: 'note' } });
    return { restored: id };
  });

  // تاریخچه‌یِ متنِ جلسه
  app.get('/api/admin/sessions/:id/transcript-revisions', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!UUID_RE.test(id)) { reply.code(404); return { error: 'جلسه یافت نشد' }; }
    return { revisions: await listTranscriptRevisionsAdmin(id) };
  });
  app.get('/api/admin/sessions/:id/transcript-revisions/:rid', async (request, reply) => {
    const { id, rid } = request.params as { id: string; rid: string };
    const row = UUID_RE.test(id) && Number.isInteger(Number(rid)) ? await getTranscriptRevisionAdmin(id, Number(rid)) : null;
    if (!row) { reply.code(404); return { error: 'نسخه یافت نشد' }; }
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.session_view', targetType: 'session', targetId: id, detail: { kind: 'transcript_revision', revision: Number(rid) } });
    return row;
  });

  // تاریخچه‌یِ یادداشت
  app.get('/api/admin/notes/:id/revisions', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!UUID_RE.test(id)) { reply.code(404); return { error: 'یادداشت یافت نشد' }; }
    return { revisions: await listNoteRevisionsAdmin(id) };
  });
  app.get('/api/admin/notes/:id/revisions/:rid', async (request, reply) => {
    const { id, rid } = request.params as { id: string; rid: string };
    const row = UUID_RE.test(id) && Number.isInteger(Number(rid)) ? await getNoteRevisionAdmin(id, Number(rid)) : null;
    if (!row) { reply.code(404); return { error: 'نسخه یافت نشد' }; }
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.session_view', targetType: 'session', targetId: id, detail: { kind: 'note_revision', revision: Number(rid) } });
    return row;
  });

  // پرونده‌یِ درمان: محتوایِ فعلی + فهرستِ نسخه‌هایِ قبلی + یک نسخه
  app.get('/api/admin/clients/:id/case-file', async (request, reply) => {
    const { id } = request.params as { id: string };
    const cf = UUID_RE.test(id) ? await getCaseFileAdmin(id) : null;
    if (!cf) { reply.code(404); return { error: 'پرونده‌ای برایِ این مراجع نیست' }; }
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.session_view', targetType: 'client', targetId: id, detail: { kind: 'case_file' } });
    return { case_file: { ...cf, content: parse(cf.content) }, versions: await listCaseFileVersionsAdmin(id) };
  });
  app.get('/api/admin/clients/:id/case-file/versions/:vid', async (request, reply) => {
    const { id, vid } = request.params as { id: string; vid: string };
    const row = UUID_RE.test(id) && Number.isInteger(Number(vid)) ? await getCaseFileVersionAdmin(id, Number(vid)) : null;
    if (!row) { reply.code(404); return { error: 'نسخه یافت نشد' }; }
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.session_view', targetType: 'client', targetId: id, detail: { kind: 'case_file_version', version: Number(vid) } });
    return { ...row, content: parse(row.content) };
  });
}
