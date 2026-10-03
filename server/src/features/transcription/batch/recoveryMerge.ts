// ادغامِ متنِ بازیابی‌شده‌ی یک سگمنت در متنِ جلسه (تابعِ خالص) — placeholderِ «⏳» درجا پر می‌شود، وگرنه append با
// برچسب/کلید (LAW-008).
// ⭐ (A2) placeholderِ بازه‌ی قطعی که کلاینت در جایِ زمانیِ درست گذاشته (insertRecoveryPlaceholder در feelia-rt.js):
// «[⏳ … · #<run>:<seq>]». applyBatchSegmentOnce همان را درجا با متنِ بازیابی‌شده جایگزین می‌کند.
export const RECOVERED_LABEL = 'بازیابی‌شده از صدایِ بازه‌ی قطعی';
export const RECOVERED_EMPTY_LABEL = 'بازه‌ی قطعی — گفتاری تشخیص داده نشد';
export function recoveryKey(runId: string, seq: number): string {
  return `${String(runId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}:${seq}`;
}
function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
export function recoveryPlaceholderRe(key: string): RegExp {
  return new RegExp(`\\[⏳ [^\\]\\n]*· #${escapeRe(key)}\\]`);
}
// متنِ فعلی + متنِ بازیابی‌شده‌ی یک سگمنت ⇒ متنِ جدید (یا null اگر تغییری لازم نیست).
export function mergeRecoveredSegment(currentText: string, text: string, key: string | undefined, label?: string): string | null {
  const re = key ? recoveryPlaceholderRe(key) : null;
  if (re && re.test(currentText)) {
    const repl = text ? `[${RECOVERED_LABEL} · #${key}]\n${text}` : `[${RECOVERED_EMPTY_LABEL} · #${key}]`;
    return currentText.replace(re, () => repl);
  }
  if (!text) return null;
  // placeholder نیست (کلاینتِ قدیمی، یا placeholder هنوز ذخیره نشده بود) ⇒ رفتارِ قبلی: append، حالا با برچسب/کلید
  // تا کلاینت placeholderِ ذخیره‌نشده‌ی همان بازه را بعداً حذف کند (dropResolvedPlaceholders).
  const head = label ? label + (key ? ` [#${key}]` : '') : key ? `[${RECOVERED_LABEL} · #${key}]` : '';
  const segment = head ? `${head}\n${text}` : text;
  return currentText ? currentText + '\n\n' + segment : segment;
}

// ⭐ (2026-10-02، فاز ۶ ممیزیِ Core) بازه‌ای که هرگز رونویسی نمی‌شود (فایلِ نامعتبر/drop یا پاک‌سازیِ ۲۴ساعتهٔ صف) نباید «⏳ در حالِ
// بازیابی» برایِ همیشه در متن بماند: placeholder با نشانگرِ صادقانه جایگزین می‌شود (کلیدِ همان بازه حفظ است تا کلاینت
// بازه را «حل‌شده» ببیند). صدایِ همان بازه در آرشیوِ ادمین می‌ماند. placeholder نبود ⇒ null (چیزی عوض نمی‌شود).
export const RECOVERY_LOST_LABEL = 'بازه‌ی قطعی — متنِ این بخش بازیابی نشد (صدا در آرشیو است)';
export function mergeRecoveryLost(currentText: string, key: string | undefined): string | null {
  if (!key) return null;
  const re = recoveryPlaceholderRe(key);
  if (!re.test(currentText)) return null;
  return currentText.replace(re, () => `[${RECOVERY_LOST_LABEL} · #${key}]`);
}
