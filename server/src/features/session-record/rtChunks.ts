// رکوردِ realtime (core-data-plan-2026-10-03، قدمِ ۲): اعتبارسنجیِ تکه‌هایِ توکنِ مرورگر و مونتاژِ آن‌ها به یک گذر. خالص و بدونِ DB.
// قالبِ هر توکن از مرورگر (feelia-rt.js#captureRtToken): [text, start_ms, end_ms, speaker_key, confidence].
import type { RecordToken } from './tokens.js';

export const RT_CHUNK_MAX_TOKENS = 2000;
const TEXT_MAX = 200;
const KEY_RE = /^[A-Za-z0-9_-]{1,16}$/;
const RUN_RE = /^[A-Za-z0-9_-]{1,64}$/;
const CONTROL_RE = /^\s*<\/?[a-z_]+>\s*$/i;

export interface RtChunkInput {
  runId: string;
  chunkSeq: number;
  tokens: RecordToken[];
  final: boolean;
  reliable: boolean | null;
  dropped: number | null;
}

// بدنه‌ی POST ⇒ ورودیِ تمیز، یا کدِ خطایِ ماشینی. توکنِ نامعتبر دور ریخته می‌شود (نه کلِ تکه).
export function parseRtChunk(body: unknown): RtChunkInput | { error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const runId = typeof b.run_id === 'string' ? b.run_id : '';
  if (!RUN_RE.test(runId)) return { error: 'run-invalid' };
  const chunkSeq = Number(b.chunk_seq);
  if (!Number.isInteger(chunkSeq) || chunkSeq < 0 || chunkSeq > 1_000_000) return { error: 'seq-invalid' };
  if (!Array.isArray(b.tokens)) return { error: 'tokens-invalid' };
  if (b.tokens.length > RT_CHUNK_MAX_TOKENS) return { error: 'too-many-tokens' };
  const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 2 ** 31 ? Math.round(v) : undefined);
  const tokens: RecordToken[] = [];
  for (const t of b.tokens) {
    if (!Array.isArray(t) || typeof t[0] !== 'string' || !t[0] || t[0].length > TEXT_MAX) continue;
    if (CONTROL_RE.test(t[0])) continue; // <end>/<fin>ِ Soniox: واژه نیستند و زمانِ ۰ دارند (کلاینتِ قدیمی)
    const key = typeof t[3] === 'string' && KEY_RE.test(t[3]) ? t[3] : null;
    const conf = typeof t[4] === 'number' && Number.isFinite(t[4]) && t[4] >= 0 && t[4] <= 1 ? t[4] : undefined;
    tokens.push({ text: t[0], start_ms: num(t[1]), end_ms: num(t[2]), speaker: key, confidence: conf });
  }
  const final = b.final === true;
  if (!tokens.length && !final) return { error: 'empty' };
  return {
    runId, chunkSeq, tokens, final,
    reliable: final && typeof b.reliable === 'boolean' ? b.reliable : null,
    dropped: final ? (num(b.dropped) ?? 0) : null,
  };
}

export interface StoredRtChunk {
  id: number;
  runId: string;
  chunkSeq: number;
  tokens: RecordToken[];
  isFinal: boolean;
  reliable: boolean | null;
  dropped: number | null;
}

export interface RtAssembly {
  tokens: RecordToken[];
  meta: {
    runs: number;
    chunks: number;
    missing_chunks: number;   // شکاف در chunk_seqِ هر run (تکه‌ای که هرگز نرسید)
    final_seen: boolean;      // آخرین run پایانِ صریح فرستاده
    reliable: boolean | null; // پرچمِ unreliableِ موتور در پایان (هر reconnect ⇒ false)
    dropped: number;          // توکنِ دورریخته به‌خاطرِ سقفِ بافرِ مرورگر
    complete: boolean;        // یک run، بدونِ شکاف، پایانِ صریح، reliable، بدونِ دورریخته
  };
  key: string;                // کلیدِ قطعیِ گذر: با رسیدنِ تکه‌ی تازه عوض می‌شود ⇒ گذرِ تازه (فقط‌افزودنی)
}

// runها به ترتیبِ اولین تکه‌شان (id)، داخلِ هر run به ترتیبِ chunk_seq. زمان‌ها در هر run از صفرِ همان run‌اند ⇒ run بعدی
// بعد از پایانِ run قبلی جابه‌جا می‌شود تا زمان یکنوا بماند (تقریبی؛ فاصله‌ی واقعیِ بینِ دو run معلوم نیست).
export function assembleRtChunks(sessionId: string, chunks: StoredRtChunk[]): RtAssembly | null {
  if (!chunks.length) return null;
  const byRun = new Map<string, StoredRtChunk[]>();
  for (const c of [...chunks].sort((a, b) => a.id - b.id)) {
    if (!byRun.has(c.runId)) byRun.set(c.runId, []);
    byRun.get(c.runId)!.push(c);
  }
  const tokens: RecordToken[] = [];
  let missing = 0;
  let shift = 0;
  let lastFinal: StoredRtChunk | null = null;
  let finalOfLastRun = false;
  let dropped = 0;
  const runs = [...byRun.values()];
  runs.forEach((list, i) => {
    list.sort((a, b) => a.chunkSeq - b.chunkSeq);
    const seqs = new Set(list.map((c) => c.chunkSeq));
    for (let s = 0; s <= list[list.length - 1].chunkSeq; s++) if (!seqs.has(s)) missing++;
    let runEnd = 0;
    for (const c of list) {
      for (const t of c.tokens) {
        const st = Number.isFinite(t.start_ms) ? (t.start_ms as number) + shift : undefined;
        const en = Number.isFinite(t.end_ms) ? (t.end_ms as number) + shift : undefined;
        if (en !== undefined && en > runEnd) runEnd = en;
        tokens.push({ ...t, start_ms: st, end_ms: en });
      }
      if (c.isFinal) { lastFinal = c; dropped += c.dropped ?? 0; }
    }
    if (i === runs.length - 1) finalOfLastRun = list.some((c) => c.isFinal);
    shift = Math.max(shift, runEnd);
  });
  const reliable = lastFinal ? (lastFinal as StoredRtChunk).reliable : null;
  const meta = {
    runs: runs.length, chunks: chunks.length, missing_chunks: missing, final_seen: finalOfLastRun,
    reliable, dropped,
    complete: runs.length === 1 && missing === 0 && finalOfLastRun && reliable === true && dropped === 0,
  };
  const maxId = Math.max(...chunks.map((c) => c.id));
  return { tokens, meta, key: `rt:${sessionId}:${chunks.length}:${maxId}:${meta.final_seen ? 1 : 0}` };
}
