// قاعده‌ی «چه وقت متنِ جایگزین‌شده در تاریخچه ذخیره شود» (migration 040) + قراردادِ CAS اجباریِ PUT /api/sessions/:id. خالص.
export const REVISION_CAUSES = ['resolve-speakers', 'marker-remove', 'edit'] as const;

// علتِ صریحِ کلاینت (body.change_reason)؛ ناشناخته ⇒ 'put'.
export function revisionCause(raw: unknown): string {
  return typeof raw === 'string' && (REVISION_CAUSES as readonly string[]).includes(raw) ? raw : 'put';
}

// فقط جایگزینیِ *غیر-الحاقی* که اطلاعات را عوض می‌کند: الحاق (متنِ جدید با متنِ قبلی شروع می‌شود) چیزی از دست نمی‌دهد.
// خودذخیره‌یِ حینِ جلسه (in_progress/recovered) معمولاً فقط کمی تغییر می‌کند و هر چند ثانیه می‌آید ⇒ فقط اگر علتِ صریح
// داده شده یا متن بیش از ۱۰٪ کوتاه شده؛ بعد از پایانِ جلسه هر تغییرِ غیر-الحاقی ذخیره می‌شود.
export function shouldRecordRevision(oldText: string | null | undefined, nextText: string, status: string | null | undefined, cause: string): boolean {
  const old = oldText ?? '';
  if (!old.trim() || nextText === old || nextText.startsWith(old)) return false;
  const open = status === 'in_progress' || status === 'recovered';
  return !open || cause !== 'put' || nextText.length < old.length * 0.9;
}

// CAS اجباری (ممیزیِ Core 2026-10-01): PUTِ transcript بدونِ transcript_version متنِ دیگری را بی‌صدا overwrite می‌کرد.
// TRANSCRIPT_CAS_REQUIRED=0 فقط برایِ بازگشتِ اضطراری (مرورگرِ قدیمیِ legacy).
export function casRequired(): boolean {
  return process.env.TRANSCRIPT_CAS_REQUIRED !== '0';
}
