// هشدارِ ادمین برایِ قطعیِ سرویسِ LLM (2026-09-28) — منطقِ خالص؛ ارسالِ واقعی (اعلان به ادمین‌ها) از بیرون تزریق می‌شود.
// چرا: دو بار در یک روز اعتبارِ provider تمام شد و «متنِ نهایی» و پرونده بی‌صدا از کار افتادند؛ کسی خبردار نشد.
//   - 401/403 (کلید) یا 402 (اعتبار) ⇒ همان اولین خطا هشدار می‌دهد (خودبه‌خود رفع نمی‌شود).
//   - خطایِ دیگر (429/5xx/شبکه) ⇒ فقط بعد از FAIL_STREAK خطایِ پشتِ‌سرِهم بدونِ هیچ پاسخِ موفق (قطعیِ گذرا طبیعی است).
//   - هر علت حداکثر یک بار در هر THROTTLE_MS. پاسخِ موفق شمارنده را صفر می‌کند.
import type { LlmHealthEvent } from './jsonCall.js';

export type LlmAlertReason = 'auth' | 'credit' | 'unavailable';

export const FAIL_STREAK = 3;
export const THROTTLE_MS = 6 * 60 * 60 * 1000;

export function reasonFor(status: number | undefined): LlmAlertReason | null {
  if (status === 401 || status === 403) return 'auth';
  if (status === 402) return 'credit';
  return null;
}

export function createLlmAlertTracker(opts: { now: () => number; alert: (reason: LlmAlertReason, provider: string) => void }) {
  let streak = 0;
  const lastAlert = new Map<string, number>();
  const fire = (reason: LlmAlertReason, provider: string) => {
    const key = `${provider}:${reason}`;
    const t = opts.now();
    if (t - (lastAlert.get(key) ?? -Infinity) < THROTTLE_MS) return;
    lastAlert.set(key, t);
    opts.alert(reason, provider);
  };
  return {
    handle(e: LlmHealthEvent): void {
      if (e.ok) { streak = 0; return; }
      streak++;
      const serious = reasonFor(e.status);
      if (serious) fire(serious, e.provider);
      else if (streak >= FAIL_STREAK) fire('unavailable', e.provider);
    },
  };
}
