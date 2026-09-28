import { randomUUID } from 'node:crypto';
import { logEvent } from '../../obs/eventLog.js';
import { nowInTehran } from '../sessions/index.js';
import { assembledPath, removeUploadDir } from './uploadStore.js';
import { MAX_DURATION_MS, extensionOf } from './media.js';
import { wakeAudioJobWorker } from './worker.js';
import { withUploadLock } from './uploadLocks.js';
import { listCompleteGroupParts, rejectGroupPartTooLong } from './uploads.repository.js';
import { createSessionAndJobForGroup } from './uploadSession.js';

// ————— چندبخشی (migration 025) —————
// وقتی همه‌ی بخش‌هایِ یک گروه رسیده و بررسی شده‌اند ⇒ یک جلسه + یک job (اتمیک). تا آن موقع ⇒ part_done.
// همیشه زیرِ قفلِ درون‌پروسه‌ایِ گروه صدا زده می‌شود (LAW-013) + FOR UPDATE رویِ ردیف‌ها در تراکنش.
export type GroupResult =
  | { kind: 'waiting'; received: number; total: number }
  | { kind: 'created'; jobId: string; sessionId: string }
  | { kind: 'already'; sessionId: string }
  | { kind: 'rejected'; status: number; code: string; error: string };

export async function finalizeGroup(groupId: string, therapistId: string): Promise<GroupResult> {
  const rows = await listCompleteGroupParts(therapistId, groupId) as any[];
  if (!rows.length) return { kind: 'waiting', received: 0, total: 0 };
  const done = rows.find((x) => x.session_id);
  if (done) return { kind: 'already', sessionId: done.session_id };
  const total = Number(rows[0].parts_total);
  const byIndex = new Map<number, any>();
  for (const x of rows) if (!byIndex.has(x.part_index)) byIndex.set(x.part_index, x);
  if (byIndex.size < total) return { kind: 'waiting', received: byIndex.size, total };
  const parts = Array.from({ length: total }, (_, i) => byIndex.get(i)).filter(Boolean);
  if (parts.length !== total) return { kind: 'waiting', received: parts.length, total };

  const known = parts.every((p) => p.duration_ms !== null && p.duration_ms !== undefined);
  const totalMs = known ? parts.reduce((s, p) => s + Number(p.duration_ms), 0) : null;
  if (totalMs !== null && totalMs > MAX_DURATION_MS) {
    for (const p of parts) {
      await rejectGroupPartTooLong(p.id);
      removeUploadDir(p.id);
    }
    logEvent({ event: 'upload.rejected', therapistId, clientId: parts[0].client_id, code: 'too-long', severity: 'warn' });
    return { kind: 'rejected', status: 422, code: 'too-long', error: 'مجموعِ بخش‌ها بیش از ۵ ساعت است' };
  }

  const first = parts[0];
  const sourceParts = parts.map((p) => ({ uploadId: p.id, path: assembledPath(p.id, extensionOf(p.original_name)) }));
  const sessionId = randomUUID();
  const jobId = randomUUID();
  const now = nowInTehran();
  const tx = await createSessionAndJobForGroup(parts, first, therapistId, sessionId, jobId, now, totalMs, sourceParts);
  if (tx.kind === 'already') return { kind: 'already', sessionId: tx.sessionId };
  if (tx.kind === 'closed') return { kind: 'rejected', status: 409, code: 'group-closed', error: 'این مجموعه‌ی فایل دیگر باز نیست' };
  logEvent({ event: 'upload.completed', therapistId, clientId: first.client_id, sessionId, detail: { count: total, duration_ms: totalMs } });
  logEvent({ event: 'session.created', sessionId, clientId: first.client_id, therapistId, detail: { mode: 'upload' } });
  wakeAudioJobWorker();
  return { kind: 'created', jobId, sessionId };
}

// (A1.3) برایِ sweepStaleUploads: گروهی که همه‌ی بخش‌هایش رسیده ولی جلسه ندارد finalize می‌شود، نه حذف.
// true ⇒ جلسه ساخته شد یا از قبل بود.
export async function tryFinalizeGroup(groupId: string, therapistId: string): Promise<boolean> {
  const g = await withUploadLock('group:' + groupId, () => finalizeGroup(groupId, therapistId));
  return g.kind === 'created' || g.kind === 'already';
}
