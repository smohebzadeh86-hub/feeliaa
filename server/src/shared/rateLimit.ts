// rate-limitِ سادهٔ درون‌حافظه‌ای با پنجره‌ی لغزانِ ۶۰ثانیه‌ای، per key (مثلاً therapistId). هر limiter Mapِ خودش را
// دارد (LAW-013). weight: چند واحد در یک فراخوانی (مثلاً تعدادِ رویدادهایِ یک batch).
export type RateLimiter = (key: string, weight?: number) => boolean;

export function createRateLimiter(max: number): RateLimiter {
  const hits = new Map<string, number[]>();
  return function limited(key: string, weight = 1): boolean {
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
    if (arr.length >= max) {
      hits.set(key, arr);
      return true;
    }
    for (let i = 0; i < weight; i++) arr.push(now);
    hits.set(key, arr);
    return false;
  };
}
