// فقط I/O — بدونِ منطقِ provider-specific این‌جا. صدا زدنِ application/* و map کردنِ
// خطایِ دامنه‌ای به HTTP.
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../../auth/guard.js';
import { getOwnedClient } from '../../../db/ownership.js';
import { generateCaseFile } from '../application/generateCaseFile.js';
import { computeTreatmentRhythm } from '../application/computeTreatmentRhythm.js';
import { applyFieldPatch, addCaseFileItem, removeCaseFileItem, type FieldPatchAction, type AddableKind } from '../application/applyFieldPatch.js';
import { SqlCaseFileRepository } from '../adapters/repository/caseFileRepository.sql.js';
import { resolveLLMProvider } from '../adapters/llm/registry.js';
import { CaseFileGenerationError, CaseFileValidationError } from '../domain/errors.js';

const caseFileRepo = new SqlCaseFileRepository();

export async function caseFileRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /api/clients/:id/case-file — وضعیتِ فعلی، بدونِ تولیدِ دوباره
  app.get('/api/clients/:id/case-file', async (request, reply) => {
    const { id } = request.params as { id: string };
    const client = await getOwnedClient(id, request.therapistId!);
    if (!client) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }
    const record = await caseFileRepo.get(id);
    const treatment_rhythm = await computeTreatmentRhythm(id);
    return { case_file: record, treatment_rhythm };
  });

  // POST /api/clients/:id/case-file/regenerate — تنها راهِ trigger در فازِ ۱ (دستی، بدونِ auto-trigger)
  app.post('/api/clients/:id/case-file/regenerate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { force, confirmPhrase } = (request.body as { force?: boolean; confirmPhrase?: string }) || {};

    if (force && confirmPhrase !== 'بازتولید کامل') {
      reply.code(400);
      return { error: 'برایِ بازتولیدِ کامل، عبارتِ تاییدی الزامی است' };
    }

    const client = await getOwnedClient(id, request.therapistId!);
    if (!client) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    try {
      const llmProvider = resolveLLMProvider();
      const { record, skipped } = await generateCaseFile(
        id,
        { category: client.category ?? null, gender: client.gender ?? null, alias: client.alias ?? null },
        { llmProvider, caseFileRepo },
        { force: !!force, therapistId: request.therapistId ?? undefined }
      );
      const treatment_rhythm = await computeTreatmentRhythm(id);
      return { case_file: record, skipped, treatment_rhythm };
    } catch (err) {
      const message = err instanceof CaseFileGenerationError ? err.message : 'تولیدِ پرونده ناموفق بود';
      const code = err instanceof CaseFileGenerationError ? err.code : 'unknown';
      reply.code(code === 'busy' ? 409 : 502);
      return { error: message, code };
    }
  });

  // PATCH /api/clients/:id/case-file — ویرایش/تاییدِ یک فیلد (اسکیمِ fieldId در applyFieldPatch.ts)
  app.patch('/api/clients/:id/case-file', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { fieldId, action, value } = (request.body as { fieldId?: string; action?: FieldPatchAction; value?: string }) || {};

    if (!fieldId || !action) {
      reply.code(400);
      return { error: 'fieldId و action الزامی‌اند' };
    }

    const client = await getOwnedClient(id, request.therapistId!);
    if (!client) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    const record = await caseFileRepo.get(id);
    if (!record) {
      reply.code(404);
      return { error: 'پرونده هنوز ساخته نشده — ابتدا آن را تولید کنید' };
    }

    try {
      const nextContent = applyFieldPatch(record.content, fieldId, action, value);
      const updated = await caseFileRepo.upsert(id, {
        content: nextContent,
        therapistEditedAt: new Date(),
      });
      return { case_file: updated };
    } catch (err) {
      if (err instanceof CaseFileValidationError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  // POST /api/clients/:id/case-file/items — افزودنِ ردیفِ دستی (axis | medication | roadmap)
  app.post('/api/clients/:id/case-file/items', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { kind, ...input } = (request.body as { kind?: AddableKind } & Record<string, unknown>) || {};
    const client = await getOwnedClient(id, request.therapistId!);
    if (!client) { reply.code(404); return { error: 'مراجع یافت نشد' }; }
    const record = await caseFileRepo.get(id);
    if (!record) { reply.code(404); return { error: 'پرونده هنوز ساخته نشده — ابتدا آن را تولید کنید' }; }
    try {
      const nextContent = addCaseFileItem(record.content, kind as AddableKind, input);
      const updated = await caseFileRepo.upsert(id, { content: nextContent, therapistEditedAt: new Date() });
      return { case_file: updated };
    } catch (err) {
      if (err instanceof CaseFileValidationError) { reply.code(400); return { error: err.message }; }
      throw err;
    }
  });

  // DELETE /api/clients/:id/case-file/items/:kind/:itemId — فقط ردیفِ افزوده‌شده‌ی دستی
  app.delete('/api/clients/:id/case-file/items/:kind/:itemId', async (request, reply) => {
    const { id, kind, itemId } = request.params as { id: string; kind: AddableKind; itemId: string };
    const client = await getOwnedClient(id, request.therapistId!);
    if (!client) { reply.code(404); return { error: 'مراجع یافت نشد' }; }
    const record = await caseFileRepo.get(id);
    if (!record) { reply.code(404); return { error: 'پرونده هنوز ساخته نشده' }; }
    try {
      const nextContent = removeCaseFileItem(record.content, kind, itemId);
      const updated = await caseFileRepo.upsert(id, { content: nextContent, therapistEditedAt: new Date() });
      return { case_file: updated };
    } catch (err) {
      if (err instanceof CaseFileValidationError) { reply.code(400); return { error: err.message }; }
      throw err;
    }
  });
}
