// متریکِ HTTPِ درون‌حافظه‌ای: ۴۸ سطلِ ۳۰دقیقه‌ای (= ۲۴ ساعت) + reservoirِ محدودِ duration برایِ p50/p95.
// DB فقط نمونه‌ی خطا/کند/ادمین را دارد و p95 از آن مغرضانه است. از آخرین راه‌اندازی، حداکثر ۲۴ ساعت. بدونِ مسیر/کاربر.
export const BUCKET_MS = 30 * 60 * 1000;
export const BUCKET_COUNT = 48;
const RESERVOIR_MAX = 500;

interface Bucket { start: number; count: number; c4xx: number; c5xx: number; durations: number[]; seen: number }

export function createHttpMetrics(now: () => number = Date.now, rand: () => number = Math.random) {
  const buckets = new Map<number, Bucket>();

  function prune(t: number): void {
    const min = Math.floor(t / BUCKET_MS) - BUCKET_COUNT + 1;
    for (const k of buckets.keys()) if (k < min) buckets.delete(k);
  }

  function record(statusCode: number, durationMs: number): void {
    const t = now();
    const key = Math.floor(t / BUCKET_MS);
    let b = buckets.get(key);
    if (!b) { b = { start: key * BUCKET_MS, count: 0, c4xx: 0, c5xx: 0, durations: [], seen: 0 }; buckets.set(key, b); prune(t); }
    b.count++;
    if (statusCode >= 500) b.c5xx++; else if (statusCode >= 400) b.c4xx++;
    // reservoir sampling (Algorithm R) — حافظه‌ی ثابت، نمونه‌ی بی‌طرف
    b.seen++;
    if (b.durations.length < RESERVOIR_MAX) b.durations.push(durationMs);
    else { const j = Math.floor(rand() * b.seen); if (j < RESERVOIR_MAX) b.durations[j] = durationMs; }
  }

  function snapshot() {
    const t = now();
    const cur = Math.floor(t / BUCKET_MS);
    const out: Array<{ start: number; count: number; c4xx: number; c5xx: number }> = [];
    const all: number[] = [];
    let total = 0, e4 = 0, e5 = 0;
    for (let k = cur - BUCKET_COUNT + 1; k <= cur; k++) {
      const b = buckets.get(k);
      out.push({ start: k * BUCKET_MS, count: b?.count ?? 0, c4xx: b?.c4xx ?? 0, c5xx: b?.c5xx ?? 0 });
      if (b) { total += b.count; e4 += b.c4xx; e5 += b.c5xx; all.push(...b.durations); }
    }
    return {
      buckets: out, total, c4xx: e4, c5xx: e5,
      error_rate_5xx: total ? e5 / total : 0,
      p50_ms: percentile(all, 50), p95_ms: percentile(all, 95),
    };
  }

  return { record, snapshot };
}

export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
}

export const httpMetrics = createHttpMetrics();
