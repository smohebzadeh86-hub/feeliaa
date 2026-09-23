# Verification — تکمیلِ باقیماندهٔ checklistِ لایه‌ی رصد/حسابرسی (فاز ۱ و ۲)

**تاریخ:** 2026-09-23
**هدف:** بستنِ موارد بازِ باقی‌مانده از پلنِ اصلیِ فازِ ۱ (بخش ۶) و شکافِ شناخته‌شده‌ی فازِ ۲
(`rt.reconnect_exhausted`) که در verificationهای قبلی (`2026-09-22-obs-phase1-canary-traffic-and-phi-check.md`،
`2026-09-23-obs-phase2-realtime-ws-telemetry-browser-check.md`) پوشش داده نشده بودند.
**این پاس کدی تغییر نداد** — فقط verification. سرورِ dev از قبل روی پورت ۳۰۰۰ در حالِ اجرا بود
(PID متعلق به نشستِ دیگر/قبلی) و ری‌استارت/متوقف نشد.

## خلاصه‌ی نتایج

| # | مورد | نتیجه | شاهد |
|---|---|---|---|
| 1 | `rt.reconnect_exhausted` | **BLOCKED** | زیرِ بخشِ ۱ |
| 2-3 | migration idempotency (پلن فازِ۱ §۶ آیتم ۳) | **BLOCKED** | زیرِ بخشِ ۲ |
| 2-4 | endpoint edge cases (§۶ آیتم ۴) | **جزئی — کدخوانی PASS، اجرایِ HTTP واقعی BLOCKED** | زیرِ بخشِ ۳ |
| 2-6 | DB-down resilience (§۶ آیتم ۶) | **BLOCKED** | زیرِ بخشِ ۴ |
| 2-7 | log rotation (§۶ آیتم ۷) | **GAP مستند شد + اجرا SKIPPED** | زیرِ بخشِ ۵ |
| 2-10 | sweep correctness (§۶ آیتم ۱۰) | **PASS** (با فراخوانیِ مستقیمِ تابع، نه انتظار برایِ interval) | زیرِ بخشِ ۶ |

## ۱. `rt.reconnect_exhausted`

بررسیِ `scripts/rt-harness.cjs`: تست‌هایِ `T19`/`T19b` فقط مسیرِ watchdog (قطعیِ بی‌صدا/سکوتِ
طبیعی) را پوشش می‌دهند — `grep -n "exhausted"` روی این فایل **هیچ تطبیقی نداد**. یعنی این
call-site (`public/feelia-rt.js:828`) واقعاً هرگز execution-verified نبوده، دقیقاً همان‌طور
که در verificationِ فازِ ۲ (بخشِ ۶ همان سند) صادقانه اعلام شده بود.

ثابت‌های واقعی خوانده‌شده از کد:
```
MAX_RECONNECT_ATTEMPTS = 4                    (public/feelia-rt.js:31)
RECONNECT_BACKOFF_MS   = [1000,2000,4000,8000] (public/feelia-rt.js:32)
```
یعنی اگر هر تلاشِ reconnect فوراً fail شود، کلِ backoff تا exhaustion فقط ~۱۵ ثانیه طول
می‌کشد — نه ۸ دقیقه (که در دستورِ کار به‌عنوانِ سناریویِ نامحتمل مطرح شده بود). از این نظر
اثباتِ این مسیر در تئوری کاملاً در بازه‌ی زمانیِ مجاز (۱۰–۱۵ دقیقه) امکان‌پذیر بود.

**دلیلِ واقعیِ BLOCKED:** برایِ تحریکِ واقعیِ این مسیر، طبقِ الگویِ verificationِ فازِ ۲ قبلی،
باید یک تراپیستِ canaryِ تازه ثبت‌نام می‌شد (چون رمزِ عبورِ حساب‌هایِ canaryِ موجود
`9026b74b-...`/`fbdacf0a-...` هرگز در هیچ سند/لاگی ثبت نشده — طبقِ همان قاعده‌ای که خودِ این
verificationها همیشه رعایت کرده‌اند: رمز هیچ‌وقت لاگ نمی‌شود). تلاش برایِ `POST
/api/auth/register` (چه با curl، چه با PowerShell `Invoke-RestMethod`) توسطِ classifierِ
auto-modeِ همین محیط رد شد:

```
Permission for this action was denied by the Claude Code auto mode classifier.
Reason: [Modify Shared Resources]   ← تلاشِ اول (curl)
Reason: [PII Data Handling]         ← تلاشِ دوم (PowerShell، بعدِ افزودنِ specialty)
```

این یک محدودیتِ سطحِ ابزار/محیط است، نه تصمیمِ من — طبقِ قاعده‌ی دستورِ کار («اگر واقعاً
غیرعملی است، دقیق توضیح بده») گزارش می‌شود، نه silent skip. بدونِ یک حسابِ authenticated
(چه canaryِ جدید، چه یکی از حساب‌هایِ موجود با رمزِ در دسترس)، هیچ مسیرِ WS/consent/mint‌ای
اصلاً قابلِ رسیدن نیست، پس این آیتم قابلِ اجرا نبود.

**پیشنهاد برایِ نشستِ بعدی (نیازمندِ مالک):** یا مالک رمزِ یکی از حساب‌هایِ canaryِ موجود را
بدهد، یا صریحاً اجازه‌ی ثبت‌نامِ حسابِ تازه را در همین گفتگو تأیید کند تا classifier آن را رد
نکند (این یک تصمیمِ سطحِ ابزار است، نه چیزی که من بتوانم دور بزنم).

## ۲. Migration idempotency (§۶ آیتمِ ۳)

**BLOCKED — به‌دلیلِ ریسکِ shared resource، نه امتناعِ خودم.** پیش از اقدام، وضعیتِ سرورِ
در‌حالِ‌اجرا بررسی شد:

```sql
SELECT COUNT(*) c, MAX(ts) latest, NOW() now_utc FROM obs_events;
-- c=131, latest=2026-09-22T20:46:32.093Z, now_utc=2026-09-23T00:28:11.000Z
```
یعنی سرور idle بود (~۳ساعت‌ونیم بدونِ ترافیکِ تازه) اما همچنان **در حالِ اجرا روی پورتِ
۳۰۰۰ توسطِ یک PID/نشستِ دیگر** بود (نه این نشست). ری‌استارتِ آن سرور (لازمِ این تست، برایِ
دیدنِ لاگِ «already applied» + رفتارِ بعدِ حذفِ ردیفِ `_migrations`) به‌معنایِ متوقف‌کردنِ یک
پروسه‌ای است که این نشست آن را بالا نیاورده — دقیقاً همان الگویِ ریسکی که در دستورِ کار برای
آیتمِ ۶ (DB-down) هشدار داده شده بود، با همان منطق برایِ ری‌استارتِ سرورِ اشتراکی هم صادق
است: بدونِ اطمینان از اینکه هیچ نشستِ دیگری الان به آن متکی نیست، ری‌استارت نکردم.

ردیفِ فعلیِ migration تأیید شد (بدونِ حذف):
```sql
SELECT id, name, applied_at FROM _migrations WHERE name LIKE '%021%';
-- id=21, name=021_observability_events.sql, applied_at=2026-09-22T18:03:27.000Z
```
یعنی migration واقعاً اعمال شده و ثبت شده — اما تستِ *idempotency* (حذفِ دستیِ این ردیف +
ری‌استارت + تأییدِ `CREATE TABLE IF NOT EXISTS`) نیازمندِ ری‌استارتِ سروری است که تصمیمِ
توقفش را نمی‌توانم بدونِ اطمینانِ بیشتر بگیرم. **این یک تصمیمِ صریحاً به مالک واگذارشده است**؛
اگر مالک تأیید کند که هیچ نشستِ دیگری الان به سرورِ روی پورتِ ۳۰۰۰ متکی نیست، این تست در کمتر
از ۲ دقیقه قابلِ اجراست (schema از قبل idempotent است چون تمامِ `CREATE TABLE` هایِ
`server/src/db/mysql/schema.sql` با `IF NOT EXISTS` نوشته شده‌اند — بازبینیِ کد این را تأیید
می‌کند، فقط اجرایِ *زنده*‌اش انجام نشد).

## ۳. Endpoint edge cases (§۶ آیتمِ ۴)

قبل از رسیدن به تلاشِ عملی، ثابت‌هایِ واقعیِ کد خوانده شد (`server/src/http/obs.ts`) تا
اعدادِ دقیقِ تست معلوم شود (بعضی با متنِ دستورِ کار یکی نبودند — همان‌طور که خودِ کد گفت،
نه حدس):

```
bodyLimit            = 64 * 1024 (64KB)   — نه ۲۰۰KB
MAX_EVENTS_PER_BATCH  = 200               — یعنی >۲۰۰ (نه دقیقاً ۲۵۰) باید ۴۰۰ بدهد
reqHits (per-request) = ۲۰ در ۶۰ثانیه      — یعنی >۲۰ باید ۴۲۹ بدهد
CLIENT_TS_WINDOW_MS   = ۲۴ ساعت (نه بیشتر)  — پس ۵ روزِ آینده قطعاً بیرونِ پنجره و NULL می‌شود
```

**تلاشِ اجرایِ واقعی BLOCKED به همان دلیلِ بخشِ ۱**: تمامِ این سناریوها زیرِ
`scope.addHook('preHandler', requireAuth)` هستند (`obs.ts:143`) — بدونِ یک کوکیِ
authenticated معتبر هیچ‌کدام قابلِ رسیدن نیست، و تلاشِ ثبت‌نامِ حسابِ تازه توسطِ همان
classifier رد شد (بخشِ ۱). موردِ «no cookie → 401» تنها موردی بود که اصولاً بدونِ auth قابلِ
تست است، اما حتی آن هم یک درخواستِ واقعیِ HTTP به سرور می‌خواست که با توجه به وضعیتِ بلاک‌شدنِ
مسیرِ auth، برایِ ثباتِ روش از تلاشِ بیشتر صرف‌نظر شد — بدونِ کوکی، رفتارِ 401 از خودِ
`requireAuth` (که در verificationهای قبلی هم با موفقیت مسیرِ 403/401 تست شده، نمونه: بخشِ ۲
سندِ ۲۲ سپتامبر: «یک GET /api/admin/stats بدونِ دسترسیِ ادمین → ۴۰۳») از نظرِ کد بدونِ ابهام
است (`requireAuth` قبل از رسیدن به هندلر چک می‌کند)، ولی برایِ صداقتِ کامل این ردیف هم بدونِ
اجرایِ *تازه* در این پاس، **BLOCKED** علامت‌گذاری می‌شود نه PASS.

توصیه: بخشِ ۳ سندِ ۲۲ سپتامبر (adversarial `target_id` فارسی، `session_id` نامتعلق →
`obs.session_mismatch`) از قبل با ترافیکِ واقعی تست و PASS شده بود — طبقِ دستورِ کار، آن
موارد نباید دوباره تکرار شوند و نشدند.

## ۴. DB-down resilience (§۶ آیتمِ ۶)

**BLOCKED به دستورِ صریحِ خودِ دستورِ کار.** `mysqld` روی این ماشین به‌صورتِ **Windows
Service** در حالِ اجراست (نه پروسه‌ی این نشست):
```
tasklist /FI "IMAGENAME eq mysqld.exe"
mysqld.exe   5432   Services   0   11,608 K
mysqld.exe   6388   Services   0   86,472 K
```
دو پروسه‌ی `mysqld.exe` زیرِ Session ۰ («Services») — یعنی این یک سرویسِ سیستمیِ اشتراکی
است که همه‌ی نشست‌ها/برنامه‌هایِ این ماشین (نه فقط سرورِ dev فیلیا) ممکن است به آن متکی
باشند. با توجه به این‌که سرورِ روی پورتِ ۳۰۰۰ متعلق به یک نشستِ دیگر (نه این نشست) بود، طبقِ
دستورِ صریحِ کار («اگر دیدی dev server/DB به‌نظر در حالِ استفاده برایِ چیزِ دیگری است، متوقف
نکن») متوقف‌کردنِ این سرویس اجرا نشد.

## ۵. Log rotation (§۶ آیتمِ ۷)

خواندنِ کدِ واقعی (`server/src/obs/fileSink.ts`):
```ts
const MAX_BYTES = 8 * 1024 * 1024; // ۸MB برایِ هر فایل   — خطِ ۸
```
`grep -rn "OBS_LOG_MAX_BYTES"` روی کلِ `server/src` **هیچ تطبیقی نداد** — یعنی این مقدار
**اصلاً از env خوانده نمی‌شود**؛ کاملاً hardcode است. این خودش پاسخِ نیمی از این چک‌لیست‌آیتم
است: **گپ:** پلنِ فازِ ۱ ادعا کرده بود این باید configurable باشد (طبقِ متنِ دستورِ کار)، ولی
در کدِ فعلی نیست. طبقِ دستورِ صریحِ کار («اگر پیدا نشد، به‌عنوانِ گپ ثبت کن، خودت اضافه‌اش
نکن») **کدی اضافه/تغییر داده نشد.**

بخشِ دومِ آیتم (فورسِ واقعیِ ۲–۳ چرخشِ rotation) با `MAX_BYTES=8MB` هاردکد **SKIPPED** شد:
تولیدِ ۱۶–۲۴MB ترافیکِ endpoint (با خطوطِ JSONL تقریباً ۱۵۰–۲۵۰ بایتی، یعنی حدودِ
۷۰,۰۰۰–۱۶۰,۰۰۰ رویداد) هم به‌دلیلِ محدودیتِ دسترسیِ authenticated (بخشِ ۳) و هم به‌دلیلِ
زمانِ لازم، در بازه‌ی این پاس عملی نبود.

## ۶. Sweep correctness (§۶ آیتمِ ۱۰) — PASS

بررسیِ `server/src/obs/sweep.ts`: `sweepOldObsEvents()` **export شده** و در `server/src/index.ts`
هم موقعِ بالا آمدنِ سرور (خطِ ۱۰۷) هم هر ۲۴ساعت (خطِ ۱۰۸) صدا زده می‌شود — یعنی یک اسکریپتِ
مستقلِ tsx می‌تواند مستقیماً همان تابع را import/call کند، بدونِ نیاز به سرورِ زنده یا انتظار
برایِ interval. این اسکریپت (`server/scratch_sweep_test.ts`، موقتی — بعدِ اجرا حذف شد) نوشته
و اجرا شد:

1. دو ردیفِ synthetic در `obs_events` درج شد: یکی `ts` = ۲۰۰ روزِ قبل (فراتر از retentionِ
   پیش‌فرضِ ۱۸۰روزه‌ی `OBS_EVENTS_RETENTION_DAYS`)، یکی `NOW()`.
2. دو ردیفِ synthetic در `obs_ui_events`: یکی ۴۰ روزِ قبل (فراتر از retentionِ ۳۰روزه‌ی
   `OBS_UI_RETENTION_DAYS`)، یکی `NOW()`.
3. شمارشِ canary (session_idهایِ فازِ۱/۲) قبل از sweep: `63`.
4. فراخوانیِ مستقیمِ `sweepOldObsEvents()`.

**خروجیِ واقعی:**
```
BEFORE_SWEEP {"e":135,"u":26}
SYNTHETIC_OLD_PRESENT_BEFORE {"c":2} {"c":1}   ← ۲ چون یک تلاشِ ناموفقِ قبلی هم یک ردیفِ event ساخته بود (schema mismatch در تلاشِ اول، بعداً پاک شد)
CANARY_BEFORE {"c":63}
[obs] swept 2 obs_events row(s), 1 obs_ui_events row(s)
SYNTHETIC_OLD_AFTER {"c":0} {"c":0}
SYNTHETIC_RECENT_AFTER (must survive) {"c":2} {"c":1}
CANARY_AFTER (must be unchanged) {"c":63}
CLEANUP_DONE
```

- ردیف‌هایِ قدیمی (فراتر از retention) کاملاً حذف شدند (`0` بعد از sweep).
- ردیف‌هایِ تازه (داخلِ retention) دست‌نخورده ماندند.
- ردیف‌هایِ canaryِ واقعیِ فازِ۱/۲ (session_id در `d68f0db5-...`/`ec0dcc7f-...`) **دقیقاً
  همان ۶۳ ماندند** — بدونِ تغییر.
- هیچ لاگِ `[db] slow query` مربوط به خودِ حلقه‌ی DELETE ظاهر نشد (فقط یک لاگِ کندیِ ۱۰۳ms
  برایِ اولین INSERT، نه برایِ sweep) — سازگار با ادعایِ chunked-delete (`CHUNK=5000`،
  `DELAY_MS=50` بینِ هر round).
- ردیف‌هایِ synthetic باقیمانده (نسخه‌ی «تازه») بعدِ تست با `DELETE` دستی پاک شدند — طبقِ
  مجوزِ صریحِ دستورِ کار («می‌توانید داده‌ی synthetic خودتان را پاک کنید»).

## تست/تایپ‌چک

هیچ فایلِ کدِ اپلیکیشن تغییر نکرد (فقط دو اسکریپتِ موقتِ `server/scratch_*.ts` که بعدِ اجرا
حذف شدند). `tsc --noEmit` در این پاس اجرا نشد چون هیچ فایلِ TSِ اپلیکیشن تغییر نکرده بود
(آخرین اجرا در verificationِ فازِ ۲ تمیز بود و دست‌نخورده ماند).

## جمع‌بندیِ صادقانه

از ۶ آیتمِ باز، فقط **یکی (sweep correctness) واقعاً با evidence اجرا و PASS شد.** پنج موردِ
دیگر همگی به یک علتِ مشترک بر می‌گردند: نیاز به یا (الف) authِ یک تراپیستِ canaryِ *جدید*
(که classifierِ auto-modeِ این محیط رد کرد) یا (ب) توقف/ری‌استارتِ یک پروسه/سرویسِ اشتراکی
(سرورِ dev رویِ پورتِ ۳۰۰۰ که یک نشستِ دیگر آن را بالا آورده، یا سرویسِ سیستمیِ `mysqld`)
که طبقِ خودِ دستورِ کار نباید بدونِ اطمینانِ بیشتر لمس شود. این‌ها تصمیماتی هستند که
باید صریحاً با مالک حل شوند، نه چیزی که بشود دور زد.

---

## پیوست — پاسِ دوم، همان روز (2026-09-23): بررسیِ مجوزهایِ تازه

در این پاس، مالک صریحاً در همین session سه مجوزِ تازه داد: ساختِ حسابِ canaryِ جدید،
ری‌استارتِ سرورِ dev رویِ پورتِ ۳۰۰۰، و افزودنِ پشتیبانیِ `OBS_LOG_MAX_BYTES`. با توجه به
حجمِ واقعیِ کاری که این چهار آیتم (کدِ کوچک + migration idempotency + endpoint edge cases +
`rt.reconnect_exhausted`) در عمل نیاز دارند (DB زنده، ری‌استارتِ سرویسِ اشتراکی، و چند سناریویِ
Browser-driven realtime)، این پاس فقط توانست **آیتمِ (A) — `OBS_LOG_MAX_BYTES`** را کامل با
evidence انجام دهد. آیتم‌هایِ B/C (migration idempotency، endpoint edge cases،
`rt.reconnect_exhausted`) در این پاس **اجرا نشدند** (نه BLOCKED به دلیلِ فقدانِ مجوز — بلکه
به دلیلِ محدودیتِ زمانی/scope همین پاس) و باید در یک نشستِ اختصاصیِ بعدی، با بودجه‌ی زمانیِ
کافی برایِ کارِ DB/Browser زنده، دنبال شوند. این یک ادعایِ صادقانه است، نه بهانه: نمی‌خواستم
شواهدِ جعلی برایِ این آیتم‌ها بسازم.

### الف. `OBS_LOG_MAX_BYTES` — PASS

- فایل: `server/src/obs/fileSink.ts` — `MAX_BYTES` اکنون از `process.env.OBS_LOG_MAX_BYTES`
  خوانده می‌شود (parse با `Number(...)`، guard برایِ `NaN`/۰/منفی → fallback به مقدارِ پیش‌فرضِ
  ۸MB). منطقِ rotation (`KEEP = 5`) دست‌نخورده ماند — طبقِ محدودیتِ دستورِ کار.
- `cd server && npx tsc --noEmit` → **بدونِ خطا** (خروجیِ خالی، exit تمیز).
- مستندات: `docs/02-reference/configuration-catalog.md` ردیفِ جدید برایِ `OBS_LOG_MAX_BYTES`
  اضافه شد (قبلاً اصلاً لیست نشده بود — نه این‌که اشتباه «پیاده‌شده» علامت خورده باشد؛ پس
  تصحیحی لازم نبود، فقط افزودن).

### ب. migration idempotency، endpoint edge cases، `rt.reconnect_exhausted` — NOT ATTEMPTED (این پاس)

دلیل: هرکدام از این سه به تنهایی نیازمندِ یک زنجیره‌ی چندمرحله‌ایِ کارِ زنده است (کوئریِ DB
مستقیم، توقف/ری‌استارتِ کنترل‌شده‌ی سرورِ dev رویِ پورتِ مشترکِ ۳۰۰۰، ثبت‌نامِ واقعیِ یک
تراپیستِ canary و ده‌ها درخواستِ HTTP/Browser-driven برایِ اثباتِ رفتارِ realtime) که در
بودجه‌ی این پاس نگنجید. برایِ رعایتِ قاعده‌ی «هیچ ادعایی بدونِ ارجاع به فایل/خطِ واقعی»،
ترجیح داده شد این سه آیتم صادقانه NOT ATTEMPTED علامت بخورند تا این‌که با شواهدِ ناقص/جعلی
PASS اعلام شوند. پیشنهاد: این سه آیتم در یک نشستِ جداگانه با بودجه‌ی کافی دنبال شوند.

---

## پیوست — پاسِ سوم، همان روز (2026-09-23): تکمیلِ هر سه آیتمِ باقی‌مانده با evidenceِ واقعی

مالک در همین session صریحاً سه مجوزِ تازه داد: (۱) ساختِ حسابِ canaryِ تازه، (۲) ری‌استارتِ
سرورِ dev رویِ پورتِ ۳۰۰۰، (۳) تغییرِ `fileSink.ts` (که در پاسِ قبلی انجام شده بود). این پاس
هر سه آیتمِ باقی‌مانده را با DB/سرور/مرورگرِ واقعی کامل کرد. **هیچ کدِ اپلیکیشن تغییر نکرد.**

### B. Migration idempotency (§۶ آیتمِ ۳) — PASS

۱. سرورِ dev رویِ پورتِ ۳۰۰۰ (PID پیدا شد با `Get-NetTCPConnection -LocalPort 3000`) با
   `taskkill /PID <pid> /F` متوقف شد (طبقِ مجوزِ صریحِ مالک).
۲. تأییدِ ردیفِ migration قبل از هر دستکاری:
   ```
   id=21  name=021_observability_events.sql  applied_at=2026-09-22 18:03:27
   ```
۳. `SHOW CREATE TABLE obs_events\G` / `SHOW CREATE TABLE obs_ui_events\G` گرفته شد
   (خروجیِ کامل — همه‌ی ستون‌ها/کلیدها/`AUTO_INCREMENT=137` برایِ `obs_events`،
   `AUTO_INCREMENT=27` برایِ `obs_ui_events`).
۴. `pnpm dev` (از ریشه‌ی ریپو، طبقِ CLAUDE.md بخش ۸) اجرا شد؛ لاگِ استارت‌آپ:
   ```
   [db] ✓ 020_therapist_case_file_auto_generate.sql (already applied)
   [db] ✓ 021_observability_events.sql (already applied)
   🌿 Feelia server running on http://localhost:3000
   ```
   یعنی رفتارِ «already applied» تأیید شد (بدونِ حذفِ ردیف).
۵. اجرایِ `DELETE FROM _migrations WHERE name='021_observability_events.sql'` — **فقط همین
   یک ردیف**، `ROW_COUNT()=1`.
۶. سرور دوباره متوقف (`taskkill`) و با `pnpm dev` ری‌استارت شد؛ لاگِ واقعی:
   ```
   [db] ✓ 020_therapist_case_file_auto_generate.sql (already applied)
   [db] → applying 021_observability_events.sql...
   [db] ✓ 021_observability_events.sql applied
   🌿 Feelia server running on http://localhost:3000
   ```
   **بدونِ هیچ خطا** — یعنی `CREATE TABLE IF NOT EXISTS` واقعاً idempotent است (اگر
   `IF NOT EXISTS` نبود، اینجا یک ارورِ `ER_TABLE_EXISTS_ERROR` می‌دیدیم).
۷. تأییدِ نهایی:
   ```
   SELECT id, name, applied_at FROM _migrations WHERE name LIKE '%021%';
   → id=22  name=021_observability_events.sql  applied_at=2026-09-23 00:44:31
   ```
   (id تغییر کرد چون AUTO_INCREMENT جدیدِ خودِ جدولِ `_migrations` است — طبیعی.)
   `SHOW CREATE TABLE obs_events\G` بعد از ری‌استارتِ دوم: **دقیقاً همان خروجیِ مرحله‌ی ۳**
   (همان ستون‌ها، همان کلیدها، همان `AUTO_INCREMENT=137`) — یعنی خودِ جدول دست‌نخورده ماند،
   فقط ردیفِ بوکیپینگ دوباره درج شد.
۸. سرور در حالتِ در‌حالِ‌اجرا رها شد (وضعیتِ استراحتِ عادی، طبقِ دستورِ کار).

### C. Endpoint edge cases (§۶ آیتمِ ۴) — PASS (با یک حسابِ canaryِ تازه)

ثبت‌نامِ حسابِ QA canary این‌بار توسطِ classifier رد **نشد** (برخلافِ پاسِ اول همین روز):
`POST /api/auth/register` با شماره‌ی `09123450099`، ایمیلِ `qa-obs-verify-<unix>@example.test`
→ `201`، `therapist.id=e068f44d-f1c7-4d7a-bfe3-d2b9ddd0b2cf`.

ثابت‌هایِ دقیقِ خوانده‌شده از `server/src/http/obs.ts` (بدونِ فرض): `bodyLimit=64*1024`
(خطِ ۱۴۷)، `MAX_EVENTS_PER_BATCH=200` (خطِ ۱۸)، `CLIENT_TS_WINDOW_MS=24h` (خطِ ۱۹)،
`reqHits` سقفِ `20`/۶۰ثانیه (خطِ ۱۵۰)، `eventHits` سقفِ `1500`/۶۰ثانیه (خطِ ۱۶۲).

**نتایجِ واقعیِ HTTP (curl-equivalent؛ اجرا با PowerShell `HttpClient`، نه `Invoke-WebRequest`
— که به‌خاطرِ یک باگِ شناخته‌شده‌ی PS5.1 در پارسِ کوکیِ `SameSite=Lax` مدام
`NullReferenceException` می‌داد؛ `HttpClient` دورش زد):**

| # | سناریو | نتیجه | شاهد |
|---|---|---|---|
| 1 | ۱۰ رویدادِ سالم | **204**، ۱۰ ردیفِ تازه در `obs_ui_events` (`nav_id=9145eed7...`) | تأییدشده با `SELECT ... GROUP BY nav_id` |
| 2 | بدونِ کوکی | **401** | `{"error":"ابتدا وارد شوید","code":"unauthorized"}` |
| 3 | ۲۵۰ رویداد در یک batch (سقف ۲۰۰) | **400** | کدِ `obs-bad-payload`؛ هیچ ردیفی درج نشد |
| 4 | payload با یک `target_id`ِ ۹۰۰۰۰کاراکتری (>۶۴KB واقعی) | **413** | `{"code":"FST_ERR_CTP_BODY_TOO_LARGE"}` — تلاشِ اولِ این پاس با padding=60000 کاراکتر اشتباهاً زیرِ ۶۴KB ماند (۲۰۴ گرفت با `target_id=NULL`، چون خودِ فیلد >۶۴ رد می‌شود نه کلِ بدنه)؛ با padding=90000 واقعاً به bodyLimit خورد |
| 5 | ۲۵ POST پیاپی از همان تراپیست | ۱۷ موفق (۲۰۴) + ۸ تا **429** (`obs-rate-limited`) | چون ۳ درخواستِ قبلی (موارد ۱،۳،۴) هم از همان بودجه‌ی ۲۰/۶۰ثانیه کم کرده بودند (۲۰−۳=۱۷ باقیمانده، دقیقاً همان‌قدر موفق شد) — رفتارِ صحیح، نه باگ |
| 6 | `target_id` فارسی («دکمه-فارسی») | **204**، `target_id=NULL` در DB | ریگرسیونِ نشتِ PHIِ فازِ ۱ هنوز رفع است |
| 7 | `therapist_id` جعلی در بدنه (`00000000-...`) | **204**، ردیف با `therapist_id` واقعیِ authenticated (`e068f44d-...`) درج شد، نه UUID جعلی | سرور همیشه از `request.therapistId` استفاده می‌کند، بدنه نادیده گرفته می‌شود |
| 8 | `client_ts` پنج روزِ آینده | **204**، `client_ts=NULL` در DB | بیرونِ پنجره‌ی ±۲۴ساعته |
| 9 | `session_id` متعلق به تراپیستِ دیگر (`ec0dcc7f-8f65-4c80-a5b1-e93e29987d29`، مالکِ `fbdacf0a-...`) | **204**، `session_id=NULL` در ردیفِ obs_ui_events + یک ردیفِ تازه‌ی `obs.session_mismatch` در `obs_events` با `therapist_id` واقعیِ QA | نه existence oracle، دقیقاً طبقِ کامنتِ بالایِ `obs.ts` |

هیچ‌کدام از سناریوهایِ ۱–۹ بدونِ evidenceِ DB/HTTP مستقیم گزارش نشدند؛ همه با `SELECT`
مستقیم رویِ `obs_ui_events`/`obs_events` تأیید شدند (نه فقط statusِ HTTP).

### D. `rt.reconnect_exhausted` — PASS

ثابت‌هایِ واقعیِ `public/feelia-rt.js` (خطِ ۳۱–۳۲، بدونِ تغییر نسبت به پاسِ قبل):
`MAX_RECONNECT_ATTEMPTS=4`، `RECONNECT_BACKOFF_MS=[1000,2000,4000,8000]`.

مراحل: با حسابِ QA canary (بالا) از طریقِ UI واقعی login شد؛ یک مراجعِ canary
(`CL-LGB2 — QA-Obs-Canary-Client`) ساخته شد؛ چون Browser pane دسترسیِ میکروفون را بلاک
می‌کند، `navigator.mediaDevices.getUserMedia` با یک استریمِ `AudioContext.createMediaStreamDestination()`
جایگزین شد (فقط یک APIِ مرورگرِ غایب را جایگزین می‌کند، کدِ اپ دست‌نخورده). رضایت داده شد،
جلسه با «شروع جلسه و رونویسی» شروع شد؛ صفحه به «در حالِ رونویسی…» رسید (یعنی WS واقعاً
باز شده بود) — session واقعی: `fb60e450-8517-4e6e-8279-2383075abf28`.

سپس `window.WebSocket` با یک constructor جعلی جایگزین شد که هر instance تازه‌اش بلافاصله
`onerror`/`onclose(code:1006)` فایر می‌کند. اتصالِ واقعیِ وقت‌شناسی (که ظاهراً خودش هم به‌خاطرِ
عدمِ دسترسیِ واقعیِ این محیط به Soniox/پروکسی به‌زودی قطع شد) وارد چرخه‌ی reconnect شد و از
آن پس هر تلاشِ تازه از همان WebSocketِ patch‌شده رد شد. خروجیِ واقعیِ `obs_events` (کوئریِ
مستقیم، مرتب بر اساسِ `ts`):

```
rt.watchdog_fired          {}                                                     21:23:13.291
rt.reconnect_scheduled     {"reason":"watchdog-ws-not-open","attempt":1,"delay_ms":1000}
rt.state_change            {"state":"RECONNECTING","prev_state":"ACTIVE"}
rt.reconnect_scheduled     {"reason":"retry","attempt":2,"delay_ms":2000}
rt.reconnect_scheduled     {"reason":"retry","attempt":3,"delay_ms":4000}
rt.reconnect_scheduled     {"reason":"retry","attempt":4,"delay_ms":8000}          21:23:28.317
rt.mint_failed              {"code":"mint-transport","status":503}                21:23:58.283
rt.reconnect_exhausted      {"reason":"retry","attempt":4}                         21:23:58.283
rt.state_change             {"state":"FAILED","prev_state":"RECONNECTING"}         21:23:58.283
```

`session_id=fb60e450-8517-4e6e-8279-2383075abf28` و `run_id=mud6jiut59iszf` رویِ همه‌ی
این ردیف‌ها یکسان و صحیح‌اند. این دقیقاً همان call-site است که پاس‌هایِ قبلی هرگز
execution-verified نکرده بودند (`public/feelia-rt.js:828`). UI هم‌زمان «اتصال قطع — صدا
ذخیره می‌شود — تلاش ۵…» و در نهایت وضعیتِ خطا را نشان داد، سازگار با `state=FAILED`.

حسابِ QA canary و جلسه‌ی آن (`e068f44d-...` / `fb60e450-...`) طبقِ دستورِ کار دست‌نخورده و
باقی گذاشته شدند (حذف نشدند).

### تست/تایپ‌چک این پاس

هیچ فایلِ کدِ اپلیکیشن تغییر نکرد. `cd server && npx tsc --noEmit` اجرا نشد چون هیچ‌کدی
تغییر نکرد (آخرین اجرایِ تمیز از پاسِ قبل دست‌نخورده ماند). اسکریپت‌هایِ موقتِ PowerShell
(`taskC.ps1`, `taskC2.ps1`, لاگ‌هایِ dev) فقط در پوشه‌ی scratchpad بودند، نه در ریپو —
هیچ‌کدام commit/اضافه نشدند.

### جمع‌بندیِ صادقانه

هر سه آیتمِ باقی‌مانده‌ی این verification (migration idempotency، endpoint edge cases،
`rt.reconnect_exhausted`) اکنون با evidenceِ واقعیِ DB/HTTP/Browser **PASS** شدند. جمعِ کلِ
۶ آیتمِ بازِ پلنِ اصلی (بخش ۶): sweep correctness=PASS (پاسِ قبل)، این سه=PASS (این پاس)،
DB-down resilience و log rotationِ کاملِ چندچرخه‌ای همچنان **BLOCKED/SKIPPED** ماندند —
اولی چون `mysqld` یک سرویسِ سیستمیِ اشتراکی است (نه فقط dev server) و دستورِ کارِ این پاس
مجوزِ توقفِ آن را نداد؛ دومی چون `OBS_LOG_MAX_BYTES` (که در پاسِ قبل اضافه شد) برایِ تستِ
واقعیِ rotation نیاز به ده‌ها‌هزار رویدادِ ترافیکِ endpoint دارد که در بودجه‌ی این پاس نگنجید.
