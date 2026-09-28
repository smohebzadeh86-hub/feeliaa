// شماره‌ی جلسه = MAX(session_num)+1 برایِ هر مراجع، با UNIQUE(client_id, session_num). ساختِ جلسه در دو مسیر
// (POST /api/sessions بدونِ FOR UPDATE، و آپلودِ صدا با FOR UPDATE) هر کدام INSERTِ خودش را دارد؛ فقط سیاستِ
// تکرار در تداخل این‌جا مشترک است.
// تداخلِ شماره‌ی جلسه (UNIQUE uq_sessions_client_num) یا deadlockِ کوتاهِ InnoDB بینِ دو ساختِ هم‌زمان ⇒ قابلِ تکرار.
// تا ۱۵ بار با فاصله‌ی تصادفیِ کوتاهِ رو‌به‌افزایش (هر دور فقط یکی از رقبا برنده می‌شود؛ jitter هم‌زمانیِ دوباره را می‌شکند).
export const SESSION_NUM_MAX_RETRIES = 15;
export function sessionNumRetryPause(attempt: number): Promise<void> {
  return new Promise((r) => setTimeout(r, 5 + Math.floor(Math.random() * 20 * (attempt + 1))));
}
export function isSessionNumConflict(err: unknown): boolean {
  const e = err as { code?: string; errno?: number; message?: string };
  if (e?.code === 'ER_LOCK_DEADLOCK' || e?.errno === 1213) return true;
  return e?.code === 'ER_DUP_ENTRY' && /uq_sessions_client_num|session_num/.test(String(e?.message || ''));
}
