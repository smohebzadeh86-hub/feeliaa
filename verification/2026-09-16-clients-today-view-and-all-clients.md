# تأییدِ «نمایِ امروز + سنجاق + صفحه‌ی همه‌ی مراجعین» — 2026-09-16

## دامنه
پیاده‌سازیِ کاملِ پلن (audit شده و دو نقصِ منطقی پیش از اجرا اصلاح شد: نشتِ
`clientTab` بینِ صفحه‌ها، و پارامتری‌نشدنِ `renderClients` برای دو زمینه).

## تغییرات
- `server/src/db/mysql/migrations/015_client_pinned.sql` (جدید): `clients.pinned_at DATETIME NULL`.
- `server/src/db/mysql/schema.sql`: ستونِ `pinned_at` در بلوکِ `clients`.
- `server/src/http/clients.ts`: `pinned_at` در SELECTِ `GET /api/clients`؛ endpointِ جدیدِ
  `PATCH /api/clients/:id/pin`؛ `PATCH /:id/status` حالا هنگامِ `inactive` شدن `pinned_at`
  را هم null می‌کند.
- `public/index.html`: بازچینیِ کاملِ `#screenClients` (نمایِ «امروز») + سکشنِ جدیدِ
  `#screenAllClients`؛ `jalaliDayTehran`/`todayJalaliTehran`/`isTodayClient`/`isPinnedClient`؛
  `applyClientFilters` به `renderTodayClientsView`/`renderAllClientsView` تقسیم شد؛
  `renderClientGroups`/`buildClientCard`/`historyBucket`/سنجاق (منو + بج) اضافه شد؛
  **فیکسِ ریشه‌ای:** `showScreen('Clients')` حالا `clientsView='today'` و `clientTab='active'`
  را ریست می‌کند — بدونِ این، اگر کاربر در صفحه‌ی «همه» تبِ غیرفعال را انتخاب کرده باشد و
  برگردد، دکمه‌ی «مراجع جدید»ِ صفحه‌ی اول (که از `newClientTargetStatus`←`clientTab` می‌خواند)
  بی‌صدا یک مراجعِ غیرفعال می‌ساخت.
- `public/feelia-analytics.js`: رویدادهای `client_pinned`/`client_unpinned`/`all_clients_opened`
  + صفحه‌ی `AllClients`.
- مستندات: `api-catalog.md`، `database-catalog.md`، `analytics-clarity.md`.

## تست / تأیید
1. `cd server && npx tsc --noEmit` → **بدونِ خطا**.
2. Migration رویِ MySQLِ لوکالِ واقعی (نه mock): سرورِ dev درحالِ اجرا (`tsx watch`) با فایلِ
   migrationِ جدید ری‌استارت شد، `015_client_pinned.sql` اعمال شد؛ با `SHOW COLUMNS FROM
   clients LIKE 'pinned_at'` مستقیماً تأیید شد (`{Field:"pinned_at", Type:"datetime",
   Null:"YES"}`). ری‌استارتِ بعدی هم "already applied" داد (idempotent، از طریقِ جدولِ
   `_migrations`، نه ری‌ست).
3. تستِ تعاملیِ کاملِ UI با mock backendِ اسکرچ‌پد (۸ مراجعِ synthetic: سنجاق‌شده،
   امروزثبت‌شده، امروزجلسه‌دار، دیروز/این‌هفته/قدیمی‌تر، غیرفعالِ قدیمی، یک موردِ جست‌وجو)
   رویِ Browser pane:
   - صفحه‌ی اول فقط سنجاق‌شده + امروز را نشان داد، با سربرگ‌های جدا؛ بقیه (دیروز/این‌هفته/
     قدیمی/غیرفعال) درست پنهان بودند.
   - جست‌وجو در صفحه‌ی اول یک مراجعِ **غیرفعال** را با کارتِ کامل نشان داد (قاعده‌ی «امروز»
     و تبِ وضعیت کنار رفتند)، به‌همراهِ راهنمای «نتیجه در همه‌ی مراجعین».
   - صفحه‌ی «همه»: تب فعال/غیرفعال، فیلترِ دسته/جنسیت، جست‌وجویِ مستقل، و سربرگ‌های
     تاریخیِ «امروز/دیروز/این‌هفته/قدیمی‌تر» (بر اساسِ `created_at`، پس از اصلاحِ
     sort در mock هم‌ترازِ API واقعی) — هر سربرگ **دقیقاً یک‌بار**، بدونِ تکرار.
   - برداشتنِ سنجاق از منویِ کارت → کارت بلافاصله از صفحه‌ی اول حذف شد (چون آن مراجع
     نه امروزی بود نه دیگر سنجاق).
   - **فیکسِ نشتِ `clientTab`:** در صفحه‌ی «همه» تبِ «غیرفعال» انتخاب شد (برچسبِ دکمه به
     «افزودنِ پرونده‌ی قبلی» عوض شد، صحیح)؛ بازگشت به صفحه‌ی اول → برچسبِ دکمه‌ی همان‌جا
     «مراجع جدید» ماند و کلیک روی آن مودالِ حالتِ **فعال** را باز کرد (نه «مراجعِ غیرفعالِ
     جدید») — یعنی باگِ شناسایی‌شده در بازبینیِ پلن واقعاً رفع شده.
   - تأییدِ مستقیمِ endpointِ auto-unpin: `PATCH /status {status:'inactive'}` روی مراجعِ
     سنجاق‌شده → `pinned_at` در پاسخِ بعدیِ `GET /api/clients` مطابقِ انتظار `null` شد.
   - `read_console_messages` بدونِ خطای مرتبط (یک `ERR_CONNECTION_CLOSED` گذرا از یک
     navigate/tab قبلی، نه از اپ).
4. `pnpm test:rt` اجرا **نشد** — این تغییر مسیرِ realtime/WS را لمس نمی‌کند؛ طبقِ بندِ ۴
   جدولِ CLAUDE.md فقط برایِ task‌های مرتبط لازم است.

## نتیجه
هر دو نقصِ منطقیِ شناسایی‌شده در بازبینیِ پلن پیش از پیاده‌سازی رفع شدند و با تستِ واقعی
تأیید شدند. بدونِ رگرسیونِ مشاهده‌شده در بقیه‌ی مسیرهای مراجعین (ایجاد/ویرایش/غیرفعال‌سازی/
بازگرداندن/حذف).

## کارِ باز
- `docs/04-modules/02-client-management/module-prd.md` + `implementation-plan.md` و
  `docs/03-requirements/requirement-catalog.md`/`traceability-matrix.md` هنوز با UC/REQِ
  جدید (نمایِ امروز، سنجاق، صفحه‌ی «همه») به‌روز نشده‌اند — به دلیلِ محدودیتِ زمان، خارج از
  دامنه‌ی این نشست ماند.
- `docs/00-governance/project-laws.md` (LAW-007) و `docs/02-reference/database-catalog.md`
  (سربرگِ ۲) هنوز مسیرِ Postgresِ `server/src/db/migrations/` را به‌عنوانِ مسیرِ زنده ذکر
  می‌کنند، درحالی‌که سیستمِ زنده از `server/src/db/mysql/migrations/` می‌خواند — ناهم‌گامیِ
  از قبل موجود، نه ناشی از این تغییر؛ به‌عنوانِ FINDING در Event Log ثبت شد.
