# MySQL migrations — یادداشتِ idempotency (LAW-007)

این پوشه **تنها migrationِ زنده** است (001–035؛ MySQL). ۰۰۱–۰۱۴ معادلِ نسخه‌ی متروکِ Postgres (`server/src/db/migrations/`) هستند و شماره‌گذاریِ یکسان دارند؛ از 015 به بعد فقط MySQL. فهرستِ شرح‌دار: [database-catalog §۱](../../../../../docs/02-reference/database-catalog.md).

**۱۳ یک فایلِ `.mjs` است، نه `.sql`** — چون داده‌تغییردهنده و شاملِ ریاضیِ تبدیلِ
شمسی/میلادی است؛ به‌جایِ بازنویسیِ دستیِ آن ریاضی در SQLِ خام (ریسکِ خطا روی داده‌ی
بالینی)، همان ریاضیِ تبدیلِ تست‌شده‌ی `gregorianToJalali` (اکنون `server/src/shared/jalali.ts`) را دوباره پیاده می‌کند.

## چرا این فایل‌ها فاقدِ `IF NOT EXISTS`/`ADD COLUMN IF NOT EXISTS` هستند

MySQL (بر خلافِ Postgres) از `CREATE INDEX IF NOT EXISTS` و
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` پشتیبانی نمی‌کند. برای idempotency (اجرای
امنِ دوباره — همان نیازی که Postgres با `DO $$ ... EXCEPTION WHEN duplicate_object`
حل می‌کند)، migration runner (`server/src/db/migrate.ts`) این خطاهای مشخصِ MySQL را می‌گیرد و نادیده می‌گیرد
(مجموعه‌ی دقیق: `IGNORABLE_ERRNOS` در همان فایل — علاوه بر جدولِ زیر، 3821 برایِ `DROP CHECK`ِ تکراری در 023):

| خطا | کد | یعنی چه |
|---|---|---|
| `ER_DUP_FIELDNAME` | 1060 | ستون از قبل با `ADD COLUMN` وجود دارد |
| `ER_DUP_KEYNAME` | 1061 | ایندکس/کلید از قبل با همین نام وجود دارد |
| `ER_TABLE_EXISTS_ERROR` | 1050 | (معمولاً با `IF NOT EXISTS` خودِ CREATE TABLE حل می‌شود) |
| `ER_DUP_CHECK_CONSTRAINT` / `ER_CHECK_CONSTRAINT_DUP_NAME` | 3822 | CHECK constraint با همین نام وجود دارد |
| `ER_CANT_DROP_FIELD_OR_KEY` | 1091 | `DROP CONSTRAINT` روی چیزی که وجود ندارد (برایِ اجرایِ دوباره‌ی 009 بی‌خطر) |

رفتارِ runner: هر فایل با `;` به statementها تکه می‌شود و هر statement جدا اجرا می‌شود (⚠️ در متن/کامنتِ SQL هیچ `;` نگذارید)؛ اگر کدِ خطا یکی از موارد بالا بود از آن statement رد می‌شود، وگرنه خطا پرتاب و کلِ startup متوقف می‌شود.

## وضعیت

runnerِ زنده `server/src/db/migrate.ts` است: در startup، فایل‌هایِ `.sql`/`.mjs` این پوشه را به ترتیبِ نام اجرا و در `_migrations` ثبت می‌کند (فایلِ `.mjs` تابعِ `migrate<NNN>` را export می‌کند). `server/scripts/copy-assets.mjs` هنگامِ build این پوشه را به `dist/` می‌برد. انضباط: [LAW-007](../../../../../docs/00-governance/project-laws.md).
