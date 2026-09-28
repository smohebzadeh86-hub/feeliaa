// نرمال‌سازیِ تاریخ/ساعتِ جلسه — همه‌ی جلسه‌ها شمسیِ `YYYY/MM/DD` با ارقامِ لاتین ذخیره می‌شوند
// (تصمیمِ مالک، 2026-09-14). فرمتِ یکتا لازم است چون «آخرین جلسه» با `MAX(date)` روی TEXT ساخته می‌شود
// (`clients.ts`، `admin.ts`) و فرمتِ ثابتِ صفرپُرشده به ترتیبِ زمانی sort می‌شود.
// تبدیلِ تقویم: shared/jalali.ts.

import { toLatinDigits } from '../../shared/persianDigits.js';
import { gregorianToJalali } from '../../shared/jalali.js';

export const INVALID_DATE_ERROR = 'تاریخ نامعتبر است (مثال: ۱۴۰۵/۰۶/۲۳)';
export const INVALID_TIME_ERROR = 'ساعت نامعتبر است (مثال: ۱۰:۳۰)';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
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
