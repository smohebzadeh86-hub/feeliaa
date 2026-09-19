// نرمال‌سازیِ تاریخ/ساعتِ جلسه — همه‌ی جلسه‌ها شمسیِ `YYYY/MM/DD` با ارقامِ لاتین ذخیره می‌شوند
// (تصمیمِ مالک، 2026-09-14). فرمتِ یکتا لازم است چون «آخرین جلسه» با `MAX(date)` روی TEXT ساخته می‌شود
// (`clients.ts`، `admin.ts`) و فرمتِ ثابتِ صفرپُرشده به ترتیبِ زمانی sort می‌شود.
// ⚠️ الگوریتمِ `gregorianToJalali` عیناً در migration `013_session_date_jalali.sql` تکرار شده — هر تغییر در هر دو.

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export const INVALID_DATE_ERROR = 'تاریخ نامعتبر است (مثال: ۱۴۰۵/۰۶/۲۳)';
export const INVALID_TIME_ERROR = 'ساعت نامعتبر است (مثال: ۱۰:۳۰)';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toLatinDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

// الگوریتمِ حسابیِ متداولِ جلالی (چرخه‌ی ۳۳ساله). روز‌به‌روز برای ۱۹۵۰–۲۱۰۰ با Intl (ICU persian،
// همان منبعِ `toJalali` در فرانت) مقایسه شد: ۰ اختلاف در ۵۵۱۵۲ روز (2026-09-14).
export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const gDaysBeforeMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 355666 + 365 * gy + Math.trunc((gy2 + 3) / 4) - Math.trunc((gy2 + 99) / 100)
    + Math.trunc((gy2 + 399) / 400) + gd + gDaysBeforeMonth[gm - 1];
  let jy = -1595 + 33 * Math.trunc(days / 12053);
  days %= 12053;
  jy += 4 * Math.trunc(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.trunc((days - 1) / 365);
    days = (days - 1) % 365;
  }
  if (days < 186) {
    return [jy, 1 + Math.trunc(days / 31), 1 + (days % 31)];
  }
  return [jy, 7 + Math.trunc((days - 186) / 30), 1 + ((days - 186) % 30)];
}

// ورودیِ آزاد (ارقامِ فارسی/عربی، `-` یا `/`، ماه/روزِ یک‌رقمی، حتی تاریخِ میلادی) → شمسیِ نرمال؛ نامعتبر → null
export function normalizeSessionDate(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const m = toLatinDigits(input.trim()).replace(/-/g, '/').match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  let y = Number(m[1]);
  let mo = Number(m[2]);
  let d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return null;
  if (y >= 1700) {
    // میلادی: اعتبارِ روز با رفت‌وبرگشتِ Date (مثلاً ۳۰ فوریه رد می‌شود)
    const g = new Date(Date.UTC(y, mo - 1, d));
    if (g.getUTCMonth() !== mo - 1 || g.getUTCDate() !== d) return null;
    [y, mo, d] = gregorianToJalali(y, mo, d);
  } else if (y < 1200 || d > (mo <= 6 ? 31 : 30)) {
    return null;
  }
  return `${y}/${pad2(mo)}/${pad2(d)}`;
}

// معکوسِ gregorianToJalali — بدونِ پیاده‌سازیِ جداگانه‌ی الگوریتمِ جلالی، رویِ همان
// تابعِ اعتبارسنجی‌شده جستجویِ دودویی می‌کند (بازه‌ی ~۳ سال، ~۱۱ تکرار)؛ خروجی:
// timestampِ UTCِ نیمه‌شبِ همان روزِ میلادی، برایِ محاسبه‌ی اختلافِ روز بینِ دو تاریخِ شمسی.
export function jalaliToTimestampMs(jy: number, jm: number, jd: number): number {
  const DAY_MS = 86400000;
  let lo = Date.UTC(jy + 620, 0, 1);
  let hi = Date.UTC(jy + 623, 11, 31);
  while (lo < hi) {
    const midDay = lo + Math.floor((hi - lo) / 2 / DAY_MS) * DAY_MS;
    const d = new Date(midDay);
    const [gy2, gm2, gd2] = gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    const cmp = gy2 !== jy ? gy2 - jy : gm2 !== jm ? gm2 - jm : gd2 - jd;
    if (cmp === 0) return midDay;
    if (cmp < 0) lo = midDay + DAY_MS; else hi = midDay;
  }
  return lo;
}

// `H:MM` یا `HH:MM` (ارقامِ فارسی هم) → `HH:MM`؛ نامعتبر → null
export function normalizeStartTime(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const m = toLatinDigits(input.trim()).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${pad2(h)}:${pad2(min)}`;
}

// پیش‌فرضِ سرور وقتی کلاینت تاریخ/ساعت نفرستد — به وقتِ ایران، نه منطقه‌ی زمانیِ ماشینِ سرور
export function nowInTehran(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const [jy, jm, jd] = gregorianToJalali(get('year'), get('month'), get('day'));
  return { date: `${jy}/${pad2(jm)}/${pad2(jd)}`, time: `${pad2(get('hour'))}:${pad2(get('minute'))}` };
}
