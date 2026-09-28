// قفلِ کلیددارِ درون‌پروسه‌ای (زنجیره‌ی Promise برایِ هر کلید). LAW-013: runtime تک‌پروسه‌ای است، پس همین برایِ
// سریال‌کردنِ کارهایِ هم‌زمان رویِ یک کلید کافی است. هر ماژول instanceِ خودش را می‌سازد (Mapها مشترک نیستند).
// خطایِ یک کار زنجیره را نمی‌شکند: کارِ بعدی بعد از پایانِ (موفق یا ناموفقِ) قبلی اجرا می‌شود.
export type KeyedLock = <T>(key: string, fn: () => Promise<T>) => Promise<T>;

export function createKeyedLock(): KeyedLock {
  const locks = new Map<string, Promise<unknown>>();
  return function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = locks.get(key) || Promise.resolve();
    const run = prev.catch(() => {}).then(fn);
    locks.set(key, run.catch(() => {}));
    return run;
  };
}
