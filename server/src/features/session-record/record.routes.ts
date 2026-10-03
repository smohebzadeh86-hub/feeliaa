// نگاشتِ گوینده به نقش (تأییدِ تراپیست) روی رکوردِ canonicalِ جلسه. فقط مالکِ جلسه (LAW-004). بدونِ لاگِ متن.
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../auth/guard.js';
import { getOwnedSession } from '../../db/ownership.js';
import { logEvent } from '../../obs/eventLog.js';
import { getCurrentRecord, getRoles, listSegments, setRoles } from './record.repository.js';
import { rolesComplete } from './segments.js';

export async function sessionRecordRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /api/sessions/:id/speakers — گوینده‌هایِ گذرِ canonical + نقشِ تأییدشده + سهمِ کلمات. بدونِ گذر ⇒ has_record:false.
  app.get('/api/sessions/:id/speakers', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await getOwnedSession(id, request.therapistId!))) { reply.code(404); return { error: 'جلسه یافت نشد' }; }
    const rec = await getCurrentRecord(id);
    if (!rec) return { has_record: false, speakers: [] };
    const segs = await listSegments(rec.recordId);
    const roles = await getRoles(id);
    const by = new Map<string, { turns: number; words: number }>();
    for (const s of segs) {
      const a = by.get(s.speaker_key) || { turns: 0, words: 0 };
      a.turns++; a.words += s.text.split(/\s+/).filter(Boolean).length;
      by.set(s.speaker_key, a);
    }
    const totalWords = [...by.values()].reduce((x, a) => x + a.words, 0) || 1;
    const speakers = [...by.entries()].map(([key, a], i) => ({
      speaker_key: key, ordinal: i + 1, turns: a.turns, share: Math.round((a.words / totalWords) * 100) / 100,
      role: roles[key]?.role ?? null, label: roles[key]?.label ?? null,
    }));
    return { has_record: true, source: rec.source, covers_full: rec.coversFull, roles_complete: rolesComplete(speakers.map((s) => s.speaker_key), roles), speakers };
  });

  // PUT /api/sessions/:id/speakers { roles: { "<speaker_key>": { role, label? } } } — فقط گوینده‌هایِ موجودِ گذر.
  app.put('/api/sessions/:id/speakers', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await getOwnedSession(id, request.therapistId!))) { reply.code(404); return { error: 'جلسه یافت نشد' }; }
    const body = request.body as { roles?: Record<string, { role?: unknown; label?: unknown }> } | undefined;
    if (!body?.roles || typeof body.roles !== 'object' || Array.isArray(body.roles)) { reply.code(400); return { error: 'roles الزامی است' }; }
    const rec = await getCurrentRecord(id);
    if (!rec) { reply.code(409); return { error: 'برای این جلسه هنوز رکوردِ تفکیکِ گوینده وجود ندارد', code: 'no-record' }; }
    const valid = new Set((await listSegments(rec.recordId)).map((s) => s.speaker_key));
    const entries: Record<string, { role: unknown; label?: unknown }> = {};
    for (const [k, v] of Object.entries(body.roles)) if (valid.has(k) && v && typeof v === 'object') entries[k] = { role: v.role, label: v.label };
    const n = await setRoles(id, request.therapistId ?? null, entries);
    if (!n) { reply.code(400); return { error: 'نقشِ معتبری ارسال نشد', code: 'invalid-roles' }; }
    logEvent({ event: 'session.speaker_roles_set', sessionId: id, therapistId: request.therapistId, detail: { count: n } });
    return { updated: n };
  });
}
