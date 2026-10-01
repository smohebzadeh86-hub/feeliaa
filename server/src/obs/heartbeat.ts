// ضربانِ workerها/جاروبِ پس‌زمینه — فقط درون‌حافظه‌ای (LAW-013: تک‌پروسه). صفحه‌ی «سلامتِ سیستم» ادمین از اینجا می‌خواند.
// هیچ‌کدام از توابع هرگز throw نمی‌کنند؛ رصد نباید کارِ اصلی را fail کند.
export interface Heartbeat {
  name: string;
  intervalMs: number;
  lastAt: number | null;
  count: number;
  lastError: string | null;
}

const beats = new Map<string, Heartbeat>();

// intervalMs فقط یک بار (اولین beat) لازم است؛ worker «ok» است اگر lastAt < ۳× بازه‌اش.
export function beat(name: string, intervalMs?: number, error?: unknown): void {
  try {
    const cur = beats.get(name) ?? { name, intervalMs: intervalMs ?? 0, lastAt: null, count: 0, lastError: null };
    if (intervalMs && intervalMs > 0) cur.intervalMs = intervalMs;
    cur.lastAt = Date.now();
    cur.count++;
    // فقط نامِ خطا/۱۲۰ نویسه‌ی اول — بدونِ داده‌ی بالینی
    cur.lastError = error === undefined ? null : String((error as Error)?.message ?? error).slice(0, 120);
    beats.set(name, cur);
  } catch {}
}

// setInterval با ضربان. اجرایِ خطادار هم beat می‌زند (worker زنده است) ولی lastError را پر می‌کند.
export function scheduleBeating(name: string, intervalMs: number, fn: () => unknown | Promise<unknown>): ReturnType<typeof setInterval> {
  beat(name, intervalMs); // ثبتِ فوریِ بازه تا قبل از اولین اجرا هم «ثبت‌شده» دیده شود
  return setInterval(() => {
    Promise.resolve().then(fn).then(() => beat(name, intervalMs), (e) => beat(name, intervalMs, e));
  }, intervalMs);
}

export type HeartbeatStatus = 'ok' | 'stale' | 'unknown';

export function heartbeatStatus(h: Pick<Heartbeat, 'intervalMs' | 'lastAt'>, now: number): HeartbeatStatus {
  if (h.lastAt === null) return 'unknown';
  return h.intervalMs > 0 && now - h.lastAt > 3 * h.intervalMs ? 'stale' : 'ok';
}

export function heartbeats(now = Date.now()): Array<Heartbeat & { status: HeartbeatStatus; age_s: number | null }> {
  return [...beats.values()].map((h) => ({
    ...h,
    status: heartbeatStatus(h, now),
    age_s: h.lastAt === null ? null : Math.max(0, Math.round((now - h.lastAt) / 1000)),
  }));
}
