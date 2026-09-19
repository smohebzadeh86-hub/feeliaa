# MySQL migrations — یادداشتِ idempotency (LAW-007)

این پوشه معادلِ MySQLِ `server/src/db/migrations/001..014` (PostgreSQL) است. شماره‌گذاری و
ترتیب یکسان است؛ هر فایل توضیح می‌دهد چه چیزی نسبت به نسخه‌ی Postgres فرق کرده و چرا.

**۱۳ یک فایلِ `.mjs` است، نه `.sql`** — چون داده‌تغییردهنده و شاملِ ریاضیِ تبدیلِ
شمسی/میلادی است؛ به‌جایِ بازنویسیِ دستیِ آن ریاضی در SQLِ خام (ریسکِ خطا روی داده‌ی
بالینی)، همان تابعِ تست‌شده‌ی `server/src/http/sessionDate.ts` را دوباره پیاده می‌کند.

## چرا این فایل‌ها فاقدِ `IF NOT EXISTS`/`ADD COLUMN IF NOT EXISTS` هستند

MySQL (بر خلافِ Postgres) از `CREATE INDEX IF NOT EXISTS` و
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` پشتیبانی نمی‌کند. برای idempotency (اجرای
امنِ دوباره — همان نیازی که Postgres با `DO $$ ... EXCEPTION WHEN duplicate_object`
حل می‌کند)، migration runner (`migrate.ts` معادلِ MySQL — هنوز نوشته نشده، بخشِ بعدیِ
کار) باید این خطاهای مشخصِ MySQL را بگیرد و نادیده بگیرد:

| خطا | کد | یعنی چه |
|---|---|---|
| `ER_DUP_FIELDNAME` | 1060 | ستون از قبل با `ADD COLUMN` وجود دارد |
| `ER_DUP_KEYNAME` | 1061 | ایندکس/کلید از قبل با همین نام وجود دارد |
| `ER_TABLE_EXISTS_ERROR` | 1050 | (معمولاً با `IF NOT EXISTS` خودِ CREATE TABLE حل می‌شود) |
| `ER_DUP_CHECK_CONSTRAINT` / `ER_CHECK_CONSTRAINT_DUP_NAME` | 3822 | CHECK constraint با همین نام وجود دارد |
| `ER_CANT_DROP_FIELD_OR_KEY` | 1091 | `DROP CONSTRAINT` روی چیزی که وجود ندارد (برایِ اجرایِ دوباره‌ی 009 بی‌خطر) |

راهِ عملی: هر statement را جدا (نه کلِ فایل یک‌جا) اجرا کنید و اگر کدِ خطا یکی از
موارد بالا بود، از آن statement رد شوید؛ در غیرِ این صورت خطا را پرتاب کنید (مثلِ
رفتارِ فعلیِ `migrate.ts` که کلِ startup را در صورتِ شکست متوقف می‌کند).

## وضعیت

این فایل‌ها هنوز به هیچ migration runnerِ زنده‌ای وصل نیستند — سرورِ فعلی همچنان
از `server/src/db/migrations/` (Postgres) با `server/src/db/migrate.ts` استفاده
می‌کند. سیم‌کشیِ واقعی (اتصال به MySQL، اجرایِ خودکار در startup) بخشِ جداگانه‌ای
از کار است که نیازمندِ یک سرورِ MySQLِ واقعی برایِ تست است (LAW-016).
