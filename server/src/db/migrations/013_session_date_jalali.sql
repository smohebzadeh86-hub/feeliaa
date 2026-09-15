-- 013: یکسان‌سازیِ sessions.date به شمسیِ `YYYY/MM/DD` با ارقامِ لاتین (تصمیمِ مالک، 2026-09-14).
-- قبلاً جلسه‌ی زنده تاریخِ میلادیِ سرور می‌گرفت ولی ویرایش/ثبتِ دستی شمسی بود؛ `MAX(date)` روی TEXT
-- («آخرین جلسه») با دو فرمت نادرست می‌شد.
-- ⚠️ داده‌تغییردهنده (LAW-007): قبل از اجرا روی production از جدولِ sessions backup بگیرید.
-- idempotent: فقط ردیف‌هایی که مقدارِ نرمال‌شده‌شان با مقدارِ فعلی فرق دارد به‌روز می‌شوند؛
-- ردیف‌هایی که با الگوی Y/M/D نمی‌خوانند دست‌نخورده می‌مانند.
-- الگوریتمِ تبدیل عیناً همان `gregorianToJalali` در `server/src/http/sessionDate.ts` است.
DO $$
DECLARE
  r RECORD;
  v TEXT;
  parts TEXT[];
  gy INT; gm INT; gd INT; gy2 INT; days INT;
  jy INT; jm INT; jd INT;
  g_d_m INT[] := ARRAY[0,31,59,90,120,151,181,212,243,273,304,334];
  normalized TEXT;
BEGIN
  FOR r IN SELECT id, date FROM sessions LOOP
    v := replace(translate(btrim(r.date), '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'), '-', '/');
    parts := regexp_match(v, '^([0-9]{4})/([0-9]{1,2})/([0-9]{1,2})$');
    CONTINUE WHEN parts IS NULL;
    jy := parts[1]::int; jm := parts[2]::int; jd := parts[3]::int;
    CONTINUE WHEN jm < 1 OR jm > 12 OR jd < 1 OR jd > 31;
    IF jy >= 1700 THEN
      gy := jy; gm := jm; gd := jd;
      gy2 := CASE WHEN gm > 2 THEN gy + 1 ELSE gy END;
      days := 355666 + (365 * gy) + ((gy2 + 3) / 4) - ((gy2 + 99) / 100) + ((gy2 + 399) / 400) + gd + g_d_m[gm];
      jy := -1595 + (33 * (days / 12053));
      days := days % 12053;
      jy := jy + 4 * (days / 1461);
      days := days % 1461;
      IF days > 365 THEN
        jy := jy + ((days - 1) / 365);
        days := (days - 1) % 365;
      END IF;
      IF days < 186 THEN
        jm := 1 + (days / 31);
        jd := 1 + (days % 31);
      ELSE
        jm := 7 + ((days - 186) / 30);
        jd := 1 + ((days - 186) % 30);
      END IF;
    END IF;
    normalized := jy::text || '/' || lpad(jm::text, 2, '0') || '/' || lpad(jd::text, 2, '0');
    IF normalized IS DISTINCT FROM r.date THEN
      UPDATE sessions SET date = normalized WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
