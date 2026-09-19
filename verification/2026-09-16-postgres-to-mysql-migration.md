# 2026-09-16 — مهاجرتِ دیتابیس PostgreSQL → MySQL — تأییدِ اجرای واقعی

> نوعِ رویداد: CODE + MIGRATION + TEST. مرتبط با PROJECT_STATUS §7 (2026-09-15/16).

## زمینه
مالک درخواست کرد: (۱) بک‌آپِ کاملِ ساختار+دیتای Postgresِ لوکال روی دسکتاپ، (۲) نوشتنِ
`schema.sql` + migrationهای معادل برای MySQL، (۳) اعمالِ واقعیِ تبدیل (نه فقط فایل).

## چه چیزی اجرا/تست شد (نه فقط نوشته شد)

1. **بک‌آپ:** `pg_dump` (از `C:\Program Files\PostgreSQL\16\bin`، در PATH نبود) →
   `C:\Users\Moheb\Desktop\feelia-postgres-backup-2026-09-15.sql` (۹۳٬۷۸۳ بایت، ۷۳۵ خط،
   ساختار+داده‌ی کاملِ Postgresِ لوکال).
2. **نصبِ MySQL:** MySQL Community Server 8.4.9 با `winget install Oracle.MySQL --silent`؛
   دیتادایرکتوری با `mysqld --initialize-insecure` در `C:\Users\Moheb\mysql-data\feelia` ساخته
   شد؛ سرور با `mysqld --datadir=... --port=3306` اجرا شد (فرآیندِ پس‌زمینه، نه Windows Service —
   برایِ اجرایِ دائمی نیاز به نصبِ service یا راه‌اندازیِ دستی در هر بازِ کاری دارد).
3. **schema.sql مستقل:** روی یک دیتابیسِ خالی اجرا شد → هر ۷ جدول + هر ۴ CHECK constraint
   بدونِ خطا ساخته شدند (`SHOW TABLES`، `information_schema.table_constraints` تأیید شد).
4. **۱۳ migrationِ عددیِ MySQL (001–012، 014) به‌ترتیب** روی یک دیتابیسِ خالیِ دیگر اجرا شدند —
   همه بدونِ خطا (idempotency/دیالکت تأیید شد جدا از خودِ runner).
5. **اجرایِ واقعیِ runner (`migrate.ts` جدید) از صفر:** `pnpm --filter server dev` با
   `DATABASE_URL` اشاره‌کننده به MySQL، رویِ دیتابیسِ کاملاً خالی — هر ۱۴ migration (شاملِ ۰۱۳ که
   به‌صورتِ اسکریپتِ Node اجرا می‌شود) با موفقیت اعمال و در `_migrations` ثبت شدند؛ `GET
   /api/health` → `database:"connected"`.
6. **تستِ سرتاسریِ canary با `curl` رویِ سرورِ واقعی (نه mock):**
   - ثبت‌نام (UUID تولیدشده در برنامه، کوکیِ نشست) ✅
   - ساختِ مراجع (کدِ یکتا، CHECKهای category/gender) ✅
   - جلسه‌ی دستی + یادداشتِ همراه در یک **تراکنش** (جایگزینِ CTEِ نویسنده‌ی Postgres که MySQL
     پشتیبانی نمی‌کند) — اتمیک بودن تأیید شد ✅
   - جلسه‌ی زنده + `PUT` با متنِ فارسیِ واقعی (`سلام دنیا، این یک متنِ فارسیِ آزمایشی است.`) —
     ذخیره/بازخوانیِ بدونِ خرابیِ کاراکتر (utf8mb4) تأیید شد ✅ (یک بارِ اول با آرگومانِ inlineِ
     shell کاراکترها `?` شدند — مشخص شد مشکلِ رمزگذاریِ argvِ Bash-on-Windows بود، نه DB؛
     با ارسالِ بدنه از فایل رفع شد)
   - **CAS/تعارضِ نسخه:** `PUT` با `transcript_version` منقضی → `409` ✅
   - ترتیبِ یادداشت‌ها با `offset_ms` مخلوطِ null/غیرِnull → `(offset_ms IS NULL), offset_ms`
     دقیقاً معادلِ `NULLS LAST`ِ Postgres رفتار کرد (`[1000, 5000, null]`) ✅
   - `PATCH` وضعیت/دسته‌بندیِ مراجع (پاک‌شدنِ خودکارِ gender با تغییر به `child`) ✅
   - جستجویِ ادمین (`LIKE CONCAT` جایگزینِ `ILIKE`) case-insensitive روی نامِ فارسی/لاتین ✅
   - `admin/export` (درختِ therapist→clients→sessions→notes، `COUNT(*) AS count`) ✅
   - `DELETE` یادداشت/جلسه/مراجع/تراپیست + رفتارِ idempotent (تکرار → 404) ✅
   - **ستونِ `anchors` (JSON):** یک باگِ واقعی پیدا و رفع شد — mysql2 بدونِ آرگومانِ encoding
     ستونِ JSON را باینری تفسیر می‌کند (هشدارِ خودِ درایور در لاگ)؛ با `field.string('utf8')` در
     `typeCast`ِ `connection.ts` رفع و دوباره با یک آرایه‌ی anchors واقعی تأیید شد ✅
   - **پاکسازیِ کامل:** بعد از هر دو round تست، شمارشِ هر ۶ جدول صفر شد (بدونِ داده‌ی یتیم) ✅
7. **Typecheck:** `cd server && npx tsc --noEmit` → بدونِ خطا (دو بار، قبل و بعدِ فیکسِ JSON).
8. **`pnpm test:rt`:** اجرا نشد — این تغییر فقط `server/` را لمس کرده، `feelia-rt.js` دست‌نخورده
   است (طبقِ LAW-016 فقط تغییرِ مرتبط تست می‌شود).

## به‌روزرسانیِ 2026-09-16 (ادامه، همان روز) — تستِ end-to-endِ واقعیِ WS/STT با دستورِ صریحِ مالک

مالک صریحاً درخواست کرد «صفر تا صد» تست شود، شاملِ بخش‌هایی که در نسخه‌ی اولِ این verification
«صادقانه تست نشد» علامت خورده بودند. با `SONIOX_API_KEY`ِ واقعیِ موجود در `server/.env` و یک
فایلِ صوتیِ synthetic (TTS انگلیسیِ Windows، **نه صدای واقعیِ هیچ مراجعی** — LAW-001) که با
ffmpeg به webm/opus تبدیل شد، این مسیرها روی سرورِ واقعی + MySQLِ واقعی تست شدند:

1. **`GET /api/stt/check`** — mint واقعی + پروبِ واقعیِ اتصال به Soniox → `ok:true, code:mint-ok`.
2. **`POST /api/sessions/:id/batch-audio?purpose=archive`** — فایل آرشیو شد، ردیفِ
   `session_audio` با `ON DUPLICATE KEY UPDATE` درست ساخته شد (بایت‌ها/UUID تطبیق داشت).
3. **`purpose=transcript`** — رونویسیِ واقعیِ async (stt-async-v5) متنِ TTS را درست برگرداند
   («گوینده ۱: Hello, this is a test recording…») و با `mergeBatchTranscript` در
   `sessions.transcript`ِ MySQL ذخیره شد (`transcript_version` درست +۱ شد، `batch_status='done'`).
   یک‌بار با خطای شبکه‌ی گذرا («TLS…disconnected») مواجه شد که ربطی به تبدیلِ SQL نداشت (کدِ
   `stt/asyncTranscribe.ts` اصلاً لمس نشده بود) — با `batch-retry` بلافاصله موفق شد.
4. **`purpose=note`** — همان صدا این‌بار فقط در `session_notes(type='voice')` ذخیره شد، بدونِ
   دست‌زدن به `sessions.transcript` — ایزولاسیونِ purpose تأیید شد.
5. **`/ws/t/:sessionId` (موتورِ P1، حساس‌ترین فایلِ پروژه):** یک کلاینتِ WebSocketِ واقعی
   (اسکریپتِ Node با پکیجِ `ws`) صدای TTS را در ۷ chunk با پروتکلِ واقعیِ
   `chunk-meta`+باینری فرستاد؛ ACKها، previewِ تدریجی (hint→confirmed)، و در نهایت `finalize`→
   `finished` با متنِ کاملِ درست دریافت شد؛ `GET /api/sessions/:id` بعدش
   `status:"completed"` و `transcript` درست را از MySQL نشان داد.
6. **قطعیِ شبکه/grace-timeout → `recovered`:** یک اتصالِ دیگر فقط ۳ chunk فرستاد و بدونِ
   `finalize` با `ws.terminate()` قطع شد (شبیه‌سازیِ قطعیِ واقعی)؛ بلافاصله وضعیت هنوز
   `in_progress` بود (داخلِ پنجره‌ی grace ۶۰ثانیه‌ای)؛ بعدِ گذشتِ ۶۰ثانیه (poll هر ۵ ثانیه)
   وضعیت دقیقاً طبقِ کدِ تبدیل‌شده به `recovered` تغییر کرد (`UPDATE sessions SET status =
   'recovered' ... WHERE status = 'in_progress'`).
7. **`/ws/voice/:sessionId` (مسیرِ legacy یادداشتِ صوتیِ زنده):** همان صدا استریم و `finalize`
   شد → متنِ رونویسی‌شده به‌درستی در `session_notes(type='voice')`ِ MySQL نوشته شد.

نتیجه‌ی این دور: **همه‌ی مسیرهایی که قبلاً «صادقانه تست نشد» علامت خورده بودند، حالا با
زیرساختِ واقعی (Soniox واقعی + MySQLِ واقعی) تست و تأیید شدند**، از جمله حساس‌ترین بخش (P1
realtime engine، شاملِ مسیرِ قطعی/grace-timeout). تنها چیزی که همچنان تست نشد: رفتار زیرِ
شبکه‌ی واقعاً ناپایدار/چندکاربره‌ی هم‌زمان (چون این محیط تک‌کاربره‌ی dev است، نه یک تستِ
بار/همزمانی) و خودِ کیفیتِ تشخیصِ گفتارِ Soniox روی صدایِ TTSِ synthetic (نه صدای انسانیِ واقعی).
داده‌های canary (۳ تراپیست، مراجعین/جلسات/یادداشت‌های همراه، و فایلِ صوتیِ آرشیوشده) کاملاً
پاک‌سازی شدند؛ شمارشِ هر ۶ جدول دوباره صفر شد. اسکریپت‌های موقتِ تست (`scratch-ws-*.mjs`) و
فایل‌های صوتیِ synthetic حذف شدند — هیچ‌کدام commit نشدند.

## نتیجه‌ی نهایی
تبدیل برایِ **همه‌ی** مسیرهای اصلیِ سرور (REST CRUD، پنلِ ادمین، batch fallback با Soniوxِ
واقعی، و موتورِ WebSocketِ realtime شاملِ interruption/recovery) با دیتا/زیرساختِ واقعی رویِ
MySQL تأیید شد. `cd server && npx tsc --noEmit` سبز. Production همچنان Postgres است؛ هیچ
commit/deployی انجام نشده (LAW-006/LAW-022).
