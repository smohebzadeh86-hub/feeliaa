// نگاشتِ گوینده به نقش (تأییدِ تراپیست) روی رکوردِ canonicalِ جلسه. فقط مالکِ جلسه (LAW-004). بدونِ لاگِ متن.
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../auth/guard.js';
import { getOwnedSession } from '../../db/ownership.js';
import { logEvent } from '../../obs/eventLog.js';
import { buildRealtimeRecord, getCurrentRecord, getRoles, insertRtChunk, listSegments, setRoles } from './record.repository.js';
import { parseRtChunk } from './rtChunks.js';
import { rolesComplete } from './segments.js';
import { speakerDisplays, suggestRoles } from './suggest.js';

// منابعِ پیشنهادِ نقش (قدمِ ۳) — از ریشه‌ی ترکیب (app.ts) تزریق می‌شوند تا session-record به treatment-unit/final-transcript
// وابسته نشود (final-transcript خودش session-record را import می‌کند ⇒ چرخه). هر خطا ⇒ null (fail-open).
export interface SpeakerSuggestionSources {
  roster?: (sessionId: string) => Promise<string[] | null>;
  finalRoles?: (sessionId: string) => Promise<Record<string, string> | null>;
}
let sources: SpeakerSuggestionSources = {};
export function setSpeakerSuggestionSources(s: SpeakerSuggestionSources): void { sources = s; }
const safe = async <T>(fn: (() => Promise<T>) | undefined): Promise<T | null> => { try { return fn ? await fn() : null; } catch { return null; } };

// تکه‌ای که بعد از پایانِ جلسه می‌رسد (retryِ دیررس) گذر را دوباره می‌سازد — با کمی تأخیر تا چند تکه‌ی پشتِ‌سرِ‌هم یک بار ساخته شوند.
const rebuildTimers = new Map<string, NodeJS.Timeout>();
function scheduleRealtimeRebuild(sessionId: string): void {
  const prev = rebuildTimers.get(sessionId);
  if (prev) clearTimeout(prev);
  const t = setTimeout(() => { rebuildTimers.delete(sessionId); void buildRealtimeRecord(sessionId); }, 3000);
  t.unref?.();
  rebuildTimers.set(sessionId, t);
}

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
    const by = new Map<string, { turns: number; words: number; firstStartMs: number | null; firstSeq: number }>();
    for (const s of segs) {
      const a = by.get(s.speaker_key) || { turns: 0, words: 0, firstStartMs: s.start_ms, firstSeq: s.seq };
      a.turns++; a.words += s.text.split(/\s+/).filter(Boolean).length;
      by.set(s.speaker_key, a);
    }
    const totalWords = [...by.values()].reduce((x, a) => x + a.words, 0) || 1;
    const keys = [...by.keys()];
    const display = speakerDisplays(keys);
    const roster = await safe(sources.roster ? () => sources.roster!(id) : undefined);
    const finalRoles = rec.source === 'async' ? await safe(sources.finalRoles ? () => sources.finalRoles!(id) : undefined) : null;
    const sug = suggestRoles({
      speakers: keys.map((k) => ({ key: k, firstStartMs: by.get(k)!.firstStartMs, firstSeq: by.get(k)!.firstSeq })),
      recordSource: rec.source, finalRoles, rosterMembers: roster,
    });
    const speakers = [...by.entries()].map(([key, a], i) => ({
      speaker_key: key, ordinal: i + 1, display: display[key], turns: a.turns, share: Math.round((a.words / totalWords) * 100) / 100,
      role: roles[key]?.role ?? null, label: roles[key]?.label ?? null,
      suggested_role: sug[key]?.role ?? null, suggested_label: sug[key]?.label ?? null, suggestion_source: sug[key]?.source ?? null,
    }));
    return {
      has_record: true, source: rec.source, covers_full: rec.coversFull, roles_complete: rolesComplete(keys, roles), speakers,
      member_options: (roster ?? []).filter((m) => m && m !== 'مراجع').slice(0, 12),
    };
  });

  // POST /api/sessions/:id/rt-tokens { run_id, chunk_seq, tokens: [[text, start_ms, end_ms, speaker_key, confidence]…], final?, reliable?, dropped? }
  // توکن‌هایِ finalِ رونویسیِ زنده (core-data-plan قدمِ ۲). idempotent رویِ (run_id, chunk_seq). متن لاگ نمی‌شود (LAW-001).
  app.post('/api/sessions/:id/rt-tokens', { bodyLimit: 512 * 1024 }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) { reply.code(404); return { error: 'جلسه یافت نشد' }; }
    if (owned.source === 'manual' || owned.source === 'upload' || owned.status === 'canceled') { reply.code(409); return { error: 'این جلسه رونویسیِ زنده ندارد', code: 'not-live' }; }
    const c = parseRtChunk(request.body);
    if ('error' in c) { reply.code(400); return { error: 'تکه‌ی توکن نامعتبر است', code: c.error }; }
    const r = await insertRtChunk(id, c);
    if (owned.status === 'completed' || owned.status === 'recovered') scheduleRealtimeRebuild(id);
    return { stored: r };
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
