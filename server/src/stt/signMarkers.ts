// (2026-09-27، درخواستِ مالک: «علائمِ بدنی به ترتیبِ زمانی داخلِ خودِ متن») — نشانگرِ علامت در متنِ جلسه.
// قالب دقیقاً همان public/feelia-rt.js (signMarker) + formatTimer در public/index.html است؛ هر تغییری باید هر سه
// را هم‌زمان عوض کند، وگرنه حذفِ علامت (که نشانگر را با همین قالب پیدا می‌کند) دیگر کار نمی‌کند.

export type SignMark = { sign_type: string | null; offset_ms: number | null };

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (s: string) => s.replace(/[0-9]/g, (d) => FA_DIGITS[+d]);
const pad2 = (n: number) => (n < 10 ? '0' + n : String(n));

// همان formatTimerِ فرانت: دقیقه:ثانیه با ارقامِ فارسی (دقیقه‌ی بیش از ۵۹ هم همان‌طور نوشته می‌شود).
export function formatSignTime(ms: number | null): string {
  const s = Math.floor((Number(ms) || 0) / 1000);
  return toFa(pad2(Math.floor(s / 60)) + ':' + pad2(s % 60));
}

export function signMarker(timeLabel: string, signType: string | null): string {
  const clean = (s: string | null) => String(s ?? '').replace(/[[\]\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
  return '[علامت · ' + clean(timeLabel) + ' — ' + clean(signType) + ']';
}

export function sortedSigns(signs: SignMark[]): SignMark[] {
  return signs.slice().sort((a, b) => (Number(a.offset_ms) || 0) - (Number(b.offset_ms) || 0));
}
