// فقط I/O: احراز، مالکیت (LAW-004)، و map ِخطایِ دامنه به HTTP.
import type { FastifyInstance, FastifyReply } from 'fastify';
import { requireAuth } from '../../../auth/guard.js';
import { getOwnedClient } from '../../../db/ownership.js';
import { logEvent } from '../../../obs/eventLog.js';
import { treatmentUnits } from '../instance.js';
import { TreatmentUnitValidationError } from '../domain/errors.js';

export function sendUnitError(reply: FastifyReply, e: unknown) {
  if (e instanceof TreatmentUnitValidationError) {
    reply.code(400);
    return { error: e.message, code: e.code };
  }
  throw e;
}

export async function treatmentUnitRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // کاتالوگِ داده‌محور — فرانت فرمِ درختی را از روی همین می‌سازد.
  app.get('/api/catalog/treatment-units', async () => {
    const c = await treatmentUnits.catalog();
    return {
      unit_types: c.unitTypes.map((u) => ({
        code: u.code, label: u.labelFa, min_members: u.minMembers, max_members: u.maxMembers,
        allowed_roles: u.allowedRoles, presets: u.presets.map((p) => ({ key: p.key, label: p.labelFa, roles: p.roles, default: p.default })),
      })),
      roles: c.roles.map((r) => ({ code: r.code, label: r.labelFa, gender: r.gender, age_group: r.ageGroup, ask_age: r.askAge, ask_gender: r.askGender })),
      modalities: c.modalities.map((m) => ({ code: m.code, label: m.labelFa, default_unit: m.defaultUnit })),
    };
  });

  app.get('/api/clients/:id/unit', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await getOwnedClient(id, request.therapistId!))) { reply.code(404); return { error: 'مراجع یافت نشد' }; }
    return { unit: await treatmentUnits.describeUnit(id) };
  });

  // تغییر/ارتقایِ واحد (مثلاً فردی → زوج با افزودنِ عضو) — همان client_id و تاریخچه حفظ می‌شود.
  app.put('/api/clients/:id/unit', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await getOwnedClient(id, request.therapistId!))) { reply.code(404); return { error: 'مراجع یافت نشد' }; }
    const { unit_type, members } = (request.body ?? {}) as { unit_type?: string; members?: unknown };
    try {
      const before = await treatmentUnits.describeUnit(id);
      const unit = await treatmentUnits.saveUnit(id, String(unit_type ?? ''), members as any);
      // فقط نوع و تعداد — هیچ مستعاری (LAW-001)
      logEvent({ event: 'client.unit_changed', therapistId: request.therapistId, clientId: id,
        detail: { from: before?.unit_type, to: unit?.unit_type, members: unit?.members.length } });
      return { unit };
    } catch (e) { return sendUnitError(reply, e); }
  });

  app.get('/api/therapist/modalities', async (request) => ({ modalities: await treatmentUnits.listTherapistModalities(request.therapistId!) }));

  app.put('/api/therapist/modalities', async (request, reply) => {
    try {
      const { modalities } = (request.body ?? {}) as { modalities?: unknown };
      return { modalities: await treatmentUnits.setTherapistModalities(request.therapistId!, modalities) };
    } catch (e) { return sendUnitError(reply, e); }
  });
}
