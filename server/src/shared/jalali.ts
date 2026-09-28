// تقویمِ جلالی (شمسی) — تبدیلِ حسابیِ میلادی ⇄ جلالی، بدونِ وابستگی به دامنه.
// ⚠️ الگوریتمِ `gregorianToJalali` عیناً در migration `013_session_date_jalali` تکرار شده — هر تغییر در هر دو.

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
