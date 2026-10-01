// وضعیتِ سلامتِ یک جلسه‌ی در حالِ ضبط — تابعِ خالص (قابلِ تست). فقط از سنِ آخرین سگمنتِ صدا.
export const LIVE_RECORDING_MAX_S = 2 * 60;   // < ۲ دقیقه: در حالِ ضبط
export const LIVE_QUIET_MAX_S = 15 * 60;      // ۲–۱۵ دقیقه: ساکت؛ بیشتر: متوقف (کاندیدِ autoClose)
export const LIVE_WINDOW_HOURS = 6;

export type LiveHealth = 'recording' | 'quiet' | 'stalled';

// lastSegmentAgeS: ثانیه از آخرین سگمنتِ صدا؛ null یعنی هنوز سگمنتی نرسیده ⇒ از سنِ خودِ جلسه (sinceUpdateS) حساب می‌شود.
export function liveHealth(lastSegmentAgeS: number | null, sinceUpdateS: number): LiveHealth {
  const age = lastSegmentAgeS ?? sinceUpdateS;
  if (age < LIVE_RECORDING_MAX_S) return 'recording';
  if (age <= LIVE_QUIET_MAX_S) return 'quiet';
  return 'stalled';
}
