// معادلِ MySQLِ 013_session_date_jalali.sql (Postgres).
//
// چرا .mjs به‌جای .sql؟ نسخه‌ی Postgres یک DO block روییِ procedural با آرایه/loop/
// regexp_match و تقسیمِ صحیح است. بازنویسیِ دستیِ همان ریاضیِ تبدیلِ شمسی/میلادی در
// SQLِ خامِ MySQL (بدونِ آرایه، با تفاوتِ INT division) ریسکِ خطای پنهان روی داده‌ی
// بالینی دارد (LAW-008). به‌جایش از همان تابعِ تست‌شده‌ی
// server/src/http/sessionDate.ts (gregorianToJalali) دوباره استفاده می‌شود.
//
// ⚠️ داده‌تغییردهنده (LAW-007): قبل از اجرا روی production از جدولِ sessions backup
// بگیرید. Idempotent: فقط ردیف‌هایی که مقدارِ نرمال‌شده با مقدارِ فعلی فرق دارد
// به‌روز می‌شوند؛ اگر داده از pg_dump وارد شده باشد (که 013 رویش قبلاً روی Postgres
// اجرا شده)، این اسکریپت روی هیچ ردیفی چیزی تغییر نمی‌دهد (no-op امن).
//
// اجرا: node server/src/db/mysql/migrations/013_session_date_jalali.mjs
// (باید بعد از اتصال به MySQL و قبل از ثبت در _migrations اجرا شود — سیم‌کشیِ
// runner در server/src/db/mysql/migrate.ts انجام می‌شود، نه اینجا.)

import mysql from 'mysql2/promise';

const PERSIAN_ARABIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩';
const LATIN_DIGITS = '01234567890123456789';

function toLatinDigits(s) {
  let out = '';
  for (const ch of s) {
    const idx = PERSIAN_ARABIC_DIGITS.indexOf(ch);
    out += idx === -1 ? ch : LATIN_DIGITS[idx];
  }
  return out;
}

// عیناً همان الگوریتمِ 013_session_date_jalali.sql (که خودش عیناً همان
// gregorianToJalali در server/src/http/sessionDate.ts است).
function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    g_d_m[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm, jd;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return { jy, jm, jd };
}

function normalize(raw) {
  const v = toLatinDigits(raw.trim()).replace(/-/g, '/');
  const m = /^([0-9]{4})\/([0-9]{1,2})\/([0-9]{1,2})$/.exec(v);
  if (!m) return null;
  let jy = parseInt(m[1], 10);
  const jm = parseInt(m[2], 10);
  const jd = parseInt(m[3], 10);
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;

  let finalY = jy, finalM = jm, finalD = jd;
  if (jy >= 1700) {
    const r = gregorianToJalali(jy, jm, jd);
    finalY = r.jy; finalM = r.jm; finalD = r.jd;
  }
  return `${finalY}/${String(finalM).padStart(2, '0')}/${String(finalD).padStart(2, '0')}`;
}

export async function migrate013(pool) {
  const [rows] = await pool.query('SELECT id, date FROM sessions WHERE date IS NOT NULL');
  let changed = 0;
  for (const row of rows) {
    const normalized = normalize(row.date);
    if (normalized !== null && normalized !== row.date) {
      await pool.query('UPDATE sessions SET date = ? WHERE id = ?', [normalized, row.id]);
      changed++;
    }
  }
  console.log(`[migrate 013] ${changed}/${rows.length} session date(s) normalized`);
}

// اجرای مستقیم (node 013_session_date_jalali.mjs) — برای تست/اجرایِ دستیِ جدا از runner.
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = new URL(process.env.MYSQL_URL || 'mysql://root@localhost:3306/feelia');
  const pool = mysql.createPool({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    charset: 'utf8mb4',
  });
  await migrate013(pool);
  await pool.end();
}
