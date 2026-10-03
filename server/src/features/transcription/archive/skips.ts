// سگمنت‌هایِ خالیِ گزارش‌شده از کلاینت (migration 039) — ورودیِ چکِ «سگمنتی گم نشده» (listing.ts#checkSeqContiguous).
import { query } from '../../../db/connection.js';

export interface SkipRow { session_id: string; run_id: string; client_seq: number }

const MAX_PER_REQUEST = 100;
const MAX_SEQ = 1_000_000;

// ?empty=3,7 ⇒ [3,7]؛ ورودیِ نامعتبر نادیده گرفته می‌شود (fail-open: هرگز آپلودِ صدا را رد نمی‌کند).
export function parseEmptySeqs(raw: unknown): number[] {
  if (typeof raw !== 'string' || !raw) return [];
  const out = new Set<number>();
  for (const part of raw.split(',').slice(0, MAX_PER_REQUEST)) {
    if (!part.trim()) continue; // Number('') === 0 ⇒ بدونِ این، «,,» سگمنتِ ۰ را خالی گزارش می‌کرد
    const n = Number(part);
    if (Number.isInteger(n) && n >= 0 && n <= MAX_SEQ) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

export async function recordSkippedSegments(sessionId: string, runId: string, seqs: number[]): Promise<void> {
  if (!seqs.length) return;
  await query(
    `INSERT IGNORE INTO session_audio_skips (session_id, run_id, client_seq) VALUES ${seqs.map(() => '(?, ?, ?)').join(', ')}`,
    seqs.flatMap((s) => [sessionId, String(runId).slice(0, 64), s])
  );
}

export async function listSkips(sessionIds: string[]): Promise<Map<string, SkipRow[]>> {
  const out = new Map<string, SkipRow[]>();
  if (!sessionIds.length) return out;
  const r = await query(
    `SELECT session_id, run_id, client_seq FROM session_audio_skips WHERE session_id IN (${sessionIds.map(() => '?').join(',')})`,
    sessionIds
  );
  for (const x of r.rows as SkipRow[]) {
    if (!out.has(x.session_id)) out.set(x.session_id, []);
    out.get(x.session_id)!.push(x);
  }
  return out;
}
