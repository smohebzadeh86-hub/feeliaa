// Priority 1 — پارامترهای قابل تنظیم + state درون‌حافظه‌ای (جدا از منطق اصلی).
// معماری نهایی تأییدشده:
//   DB status ≠ connectionState ≠ Engine generation ≠ chunk identity ≠ transcript confirmation
//   Transcript Integrity سخت‌گیرانه؛ Audio Continuity best-effort (tail تأییدنشده ممکن است از دست برود).
// هیچ migration ندارد؛ status فقط رشته‌های موجود + 'canceled' (ستون TEXT است).

export const P1_PARAMS = {
  // فرضیه ۶۰ ثانیه — قابل تنظیم با metric واقعی
  GRACE_TIMEOUT_MS: 60_000,
  // reorder پایدار
  REORDER_TIMEOUT_MS: 2_000,
  // head-gap هم‌پوشان با handover نسل (replay هنوز در راه است)
  HANDOVER_TIMEOUT_MS: 5_000,
  // سقف reorder buffer (تعداد chunk) — overflow → skip اجباری head
  REORDER_BUFFER_MAX: 100,
  // سقف حافظه forwardedSet (sliding window)
  FORWARDED_SET_MAX: 2_000,
};

export type P1ConnectionState =
  | 'ACTIVE'
  | 'INTERRUPTED'
  | 'RECONNECTING'
  | 'MANUAL_PAUSED'
  | 'FINALIZING'
  | 'CLOSED';

export interface P1Hint {
  text: string;
  uptoSeq: number;
  at: number;
}

export interface P1Record {
  sessionId: string;
  clientId: string;
  // جدیدترین generation صادرشده برای این session (فقط به جلو)
  generation: number;
  connectionState: P1ConnectionState;
  // موتور زنده + نسلی که با آن ساخته شده (authority)
  engine: import('../stt/soniox.js').SonioxEngine | null;
  engineGeneration: number;
  // --- ordering (chunk identity = (sessionId, seq)، پایدار در طول session) ---
  nextExpected: number; // کوچک‌ترین seq حل‌نشده — فقط به جلو
  forwarded: Set<number>; // پنجره محدود seqهای forwardشده
  forwardedOrder: number[]; // صف eviction پنجره
  buffer: Map<number, Buffer>; // seq > nextExpected — bounded
  reorderTimer: ReturnType<typeof setTimeout> | null;
  reorderHead: number; // headSeq که timer برای آن arm شده
  reorderGeneration: number; // نسل مالک timer
  // --- grace (interruption) ---
  graceTimer: ReturnType<typeof setTimeout> | null;
  graceGeneration: number; // نسلی که timer برای آن arm شده
  handoverUntil: number; // تا این زمان، timeout handover اعمال می‌شود
  // --- transcript hint (هرگز وارد confirmed نمی‌شود) ---
  hint: P1Hint | null;
  // --- P1-F2/F3: idempotency و پنجره resume (بدون state جدید، فقط همین دو فیلد) ---
  pauseEpoch: number; // هر pause مؤثر +1؛ resume در-flight با epoch قدیمی باطل می‌شود
  resumeArmed: boolean; // true از ورود همگام resume تا پایان setup؛ chunkهای پنجره بافر می‌شوند
  // --- terminal guards ---
  terminal: null | 'finalizing' | 'completed' | 'canceled';
}

const records = new Map<string, P1Record>();

export function getRecord(sessionId: string): P1Record | undefined {
  return records.get(sessionId);
}

export function getOrCreateRecord(sessionId: string, clientId: string): P1Record {
  let r = records.get(sessionId);
  if (!r) {
    r = {
      sessionId,
      clientId,
      generation: 0,
      connectionState: 'CLOSED',
      engine: null,
      engineGeneration: 0,
      nextExpected: 1,
      forwarded: new Set(),
      forwardedOrder: [],
      buffer: new Map(),
      reorderTimer: null,
      reorderHead: 0,
      reorderGeneration: 0,
      graceTimer: null,
      graceGeneration: 0,
      handoverUntil: 0,
      hint: null,
      pauseEpoch: 0,
      resumeArmed: false,
      terminal: null,
    };
    records.set(sessionId, r);
  }
  if (clientId && !r.clientId) r.clientId = clientId;
  return r;
}

export function isCurrentGeneration(r: P1Record, generation: number): boolean {
  return r.generation === generation;
}

function trimForwarded(r: P1Record) {
  while (r.forwardedOrder.length > P1_PARAMS.FORWARDED_SET_MAX) {
    const oldest = r.forwardedOrder.shift()!;
    r.forwarded.delete(oldest);
  }
}

export function markForwarded(r: P1Record, seq: number) {
  if (!r.forwarded.has(seq)) {
    r.forwarded.add(seq);
    r.forwardedOrder.push(seq);
    trimForwarded(r);
  }
}

export function clearReorderTimer(r: P1Record) {
  if (r.reorderTimer) { clearTimeout(r.reorderTimer); r.reorderTimer = null; }
}

export function clearGraceTimer(r: P1Record) {
  if (r.graceTimer) { clearTimeout(r.graceTimer); r.graceTimer = null; }
}

// حلقه drain: تا head در buffer هست، به ترتیب forward کن.
// forwardFn باید trySend (بدون صف) باشد؛ ackFn بعد از موفقیت صدا زده می‌شود.
// برمی‌گرداند: تعداد forwardشده.
export function drainInOrder(
  r: P1Record,
  forwardFn: (seq: number, buf: Buffer) => boolean,
  ackFn: (seq: number) => void,
): number {
  let n = 0;
  while (true) {
    const buf = r.buffer.get(r.nextExpected);
    if (!buf) break;
    let ok = false;
    try { ok = forwardFn(r.nextExpected, buf); } catch { ok = false; }
    if (!ok) break; // سوکت Soniox باز نیست — صبر کن، ACK نده
    r.buffer.delete(r.nextExpected);
    markForwarded(r, r.nextExpected);
    try { ackFn(r.nextExpected); } catch {}
    r.nextExpected += 1;
    n += 1;
  }
  return n;
}
