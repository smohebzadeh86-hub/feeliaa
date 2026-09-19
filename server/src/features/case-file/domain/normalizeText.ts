// دفاعِ دومِ سمتِ سرور در برابرِ نشتِ سبکِ کسره/اعرابِ اضافه و نویسه‌های عربی در خروجیِ LLM.
// فقط نویسه‌ها را نرمال می‌کند؛ هرگز محتوا را عوض نمی‌کند.
export function normalizePersianText(input: string): string {
  return input
    .replace(/[ً-ْٰ]/g, '') // اعراب (فتحه‌تین…کسره…سکون) و الفِ خنجری
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ \t]*‌[ \t]*/g, '‌') // ZWNJ بدونِ فاصله‌ی اطراف
    .replace(/‌{2,}/g, '‌')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

// همه‌ی stringهایِ یک ساختارِ JSON را (به‌جز کلیدها و مقادیرِ enum-مانندِ کوتاهِ لاتین) نرمال می‌کند.
export function normalizeDeep<T>(value: T): T {
  if (typeof value === 'string') return normalizePersianText(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => normalizeDeep(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = normalizeDeep(v);
    return out as T;
  }
  return value;
}
