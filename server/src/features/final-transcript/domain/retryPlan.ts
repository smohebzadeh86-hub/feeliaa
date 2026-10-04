// «تلاشِ دوباره/ساختِ دوباره»ی «متنِ نهایی»: از کدام مرحله شروع شود؟ خالص و بدونِ I/O.
// (2026-10-04، به دستورِ مالک) جلسه‌ی آپلودی: رونویسیِ asyncِ موجود همیشه دوباره استفاده می‌شود — همان فایل با همان مدل
// دوباره به Soniox رفتن خروجیِ یکسان می‌دهد (رونویسیِ async قطعی است) و فقط هزینه را دو برابر می‌کرد. اندازه‌گیریِ prod
// (2026-10-04): ۱ از ۱۴ آپلود با همین مسیر دو بار به Soniox رفته بود. جلسه‌ی زنده بدونِ تغییر: متنِ کهنه (دُمِ دیررس/بازیابیِ
// قطعی ⇒ صدایِ تازه در آرشیو) دوباره از صدا رونویسی می‌شود.
export interface RetryRow {
  stage: string;
  source: string | null;          // منبعِ متنِ نهایی: async | realtime
  hasAsync: boolean;              // async_text ذخیره شده است
  sessionSource: string | null;   // sessions.source: live | upload | manual
  stale: boolean;                 // متنِ جلسه بعد از ساختِ متنِ نهایی عوض شده
}
export type RetryPlan = 'busy' | 'fresh' | 'reuse-async' | 'retranscribe';

export function planRetry(r: RetryRow): RetryPlan {
  if (['waiting_audio', 'transcribing', 'polishing'].includes(r.stage)) return 'busy';
  if (r.stage === 'done' && !r.stale) return 'fresh';
  const asyncReady = r.source === 'async' && r.hasAsync;
  if (asyncReady && (!r.stale || r.sessionSource === 'upload')) return 'reuse-async';
  return 'retranscribe';
}
