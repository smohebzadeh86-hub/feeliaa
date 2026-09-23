# Verification — لایه‌ی رصد/حسابرسیِ فازِ ۱: ترافیکِ واقعیِ canary + بررسیِ نشتِ PHI

**تاریخ:** 2026-09-22
**هدف:** بخشِ ۶ از دستورِ پیاده‌سازیِ فازِ ۱ — تأییدِ end-to-end با ترافیکِ واقعی (نه فقط بازبینیِ کد)
که هیچ متنِ فارسی/بالینی وارد `data/logs/obs.jsonl` یا `obs_events`/`obs_ui_events` نمی‌شود، و
هر دو sink (فایل + DB) واقعاً کار می‌کنند.

## ۰. پیش‌شرط — بررسیِ تداخل

قبل از بالا آوردنِ سرور: `Get-NetTCPConnection -LocalPort 3000` و `Get-Process node,tsx` هر دو
خالی بودند — هیچ نشستِ دیگری در لحظه‌ی اجرا از دیتابیسِ dev/پورتِ ۳۰۰۰ استفاده نمی‌کرد. با
اطمینان از این، `pnpm dev` توسطِ همین نشست بالا آورده شد (بعداً با `Stop-Process` تمیز خاموش شد).

## ۱. دادهٔ canary ساخته‌شده (غیرواقعی — تصمیم با مالک برایِ حذف/نگه‌داشتن)

| نوع | id | نکته |
|---|---|---|
| therapist | `9026b74b-ca89-49f0-86de-d0691bac307f` | phone `09120000111`، نامِ `Canary Obs Test` |
| client | `d5f74439-85b6-4aa9-80d0-06e4b79ab920` | کد `CL-39Y2`، alias `Canary Client` |
| session | `d68f0db5-b9e0-4475-a37c-06a928bb8f95` | status نهایی `completed`، transcript = متنِ آزمایشیِ فارسی |
| note | `bace1904-631a-4f5a-9f72-6865d6f5c943` | یادداشتِ آزمایشیِ فارسی |

طبقِ LAW-006 هیچ‌کدام حذف نشدند — فقط این‌جا فهرست شدند تا مالک تصمیم بگیرد. رشدِ `data/logs/`
از قبل با سقفِ ۴۸MB محدود است (بخشِ پلن)، پس نگه‌داشتنِ این چند ردیف ریسکِ عملیاتی ندارد.

## ۲. سناریوهایِ تولیدشده

1. ثبت‌نام تراپیستِ canary، ساختِ مراجع، شروعِ جلسه‌ی زنده (`session.created`).
2. `PUT .../transcript` با متنِ فارسیِ واقعی (۸۹ نویسه) → `session.transcript_put`.
3. تکرارِ همان PUT با نسخه‌ی کهنه (۰) → **409 version-conflict** → `session.transcript_conflict`.
4. یادداشتِ فارسی (`POST .../notes`).
5. بچِ ۷تاییِ `POST /api/obs/events` شاملِ: نویگیشن، کلیک، یک کلیکِ عمداً با `target_id` فارسی
   (تستِ adversarial — پایینِ همین سند)، رویدادهایِ `net` (آنلاین/آفلاین، شبیه‌سازیِ قطعیِ شبکه)،
   یک `session_id` که مالِ این تراپیست نیست (تستِ `obs.session_mismatch`)، و `obs.client_dropped`.
6. پایانِ جلسه (`PUT status=completed`).
7. یک تلاشِ loginِ ناموفقِ عمدی (`auth.login_failed` بدونِ شماره در detail).
8. یک `GET /api/admin/stats` بدونِ دسترسیِ ادمین (۴۰۳؛ مسیرِ `/api/admin/` همیشه در DB لاگ می‌شود).

## ۳. یافته‌یِ واقعی — نشتِ ساختاریِ سمتِ‌سرور (رفع‌شده در همین verification)

بچِ مرحله‌ی ۵ عمداً شاملِ `target_id:"سلام-فارسی"` بود تا مسیرِ سمتِ‌سروری که *مستقل از*
فیلترِ سمتِ‌کلاینتِ `feelia-obs.js` عمل می‌کند تست شود. نتیجه: **این متن واقعاً در
`obs_ui_events.target_id` ذخیره شد** — `server/src/http/obs.ts` تابعِ قدیمی‌اش (`safeShortString`)
فقط طول/trim را چک می‌کرد، نه الگویِ امنِ توکن (`isSafeToken`) را. یعنی یک کلاینتِ دیگر (یا
دستکاریِ درخواست، یا باگِ آینده در خودِ `feelia-obs.js`) می‌توانست هر متنِ آزادی را مستقیماً در
DB بنویسد — دقیقاً همان چیزی که `sanitizeDetail`/`isSafeToken` برایِ `obs_events.detail` قرار
بود جلویش را بگیرد، ولی برایِ سه ستونِ `target_id`/`target_role`/`target_tag`ِ `obs_ui_events`
این دفاعِ سمتِ‌سرور وجود نداشت (فقط دفاعِ سمتِ‌کلاینت بود که defense-in-depth کافی نیست).

**فیکس:** `safeShortString` با `safeShortToken` جایگزین شد که مستقیماً `isSafeToken` (همان
regexِ `redact.ts`) را روی `target_id`/`target_role`/`target_tag`/`screen` اعمال می‌کند —
حالا هر رشته‌ای که با الگویِ امنِ توکن (`^[A-Za-z0-9_.:-]{1,64}$`) نخورَد، `null` می‌شود، صرفِ‌نظر
از این‌که چه کلاینتی درخواست را فرستاده. با فیکس، همان بچِ عیناً دوباره فرستاده شد؛ ردیفِ جدید
`target_id=null` گرفت (نه متنِ فارسی) — تأیید شد.

**ردیفِ قدیمیِ leak‌شده (id=3 در `obs_ui_events`، قبل از فیکس) عمداً حذف نشد** (LAW-006 —
هیچ DELETEِ دستی بدونِ اجازه) — یک ردیفِ تکی، غیرواقعی (دادهٔ canaryِ همین verification)، و
جزوِ همان چند ردیفِ canaryِ بالاست که مالک می‌تواند دستور به حذف بدهد.

## ۴. نتایجِ واقعی (نه حدس)

### فایلِ JSONL
```
$ grep -P '[\x{0600}-\x{06FF}]' server/data/logs/obs.jsonl*
(بدونِ خروجی — exit code 1)
```
تأییدِ دوباره با اسکریپتِ Node (چون grep -P این محیط بدونِ `LC_ALL=en_US.UTF-8` خطا می‌داد):
`TOTAL_HITS 0` رویِ همه‌ی خط‌هایِ فایل. کنترلِ مثبت (یک فایلِ آزمایشیِ حاویِ متنِ فارسی) با
همان regex درست تشخیص داده شد (exit 0) — یعنی خودِ چک واقعاً کار می‌کند، false-negative نیست.

دلیلِ این‌که هیچ‌وقت نشتی در JSONL دیده نشد (حتی قبل از فیکسِ بالا): `writeJsonl()` فقط از
داخلِ `logEvent()` (رویدادهایِ `obs_events`) صدا زده می‌شود؛ `logUiEvents()` (که leak از آن‌جا
آمد) اصلاً به فایل نمی‌نویسد، فقط به DB — پس چکِ JSONL به‌تنهایی کافی نبود؛ همین SQLهایِ پایین
بود که مشکلِ واقعی را پیدا کرد.

### SQL — بعدِ فیکس
```sql
SELECT COUNT(*) FROM obs_ui_events;                                        -- 14
SELECT COUNT(*) FROM obs_events;                                           -- 18
SELECT COUNT(*) FROM obs_ui_events WHERE target_id REGEXP '[^ -~]';        -- 1  (فقط ردیفِ قدیمیِ id=3، پیش از فیکس)
SELECT COUNT(*) FROM obs_events WHERE CAST(detail AS CHAR) REGEXP '[^ -~]';-- 0
SELECT COUNT(*) FROM obs_events WHERE route LIKE '%?%';                    -- 0
```
بعدِ فیکس، بچِ adversarial دوباره فرستاده شد و ردیفِ **جدید** (id=10) با `target_id=null` ثبت
شد — یعنی `COUNT(...) WHERE target_id REGEXP '[^ -~]'` دیگر رشد نکرد (هنوز ۱ است، فقط بابتِ
ردیفِ قدیمیِ قبل از فیکس).

### تأییدِ end-to-end بودنِ هر دو sink
`obs_events` از ۰ (بعدِ migration، بدونِ ترافیک) به ۱۸ رسید؛ `obs_ui_events` از ۰ به ۱۴ —
یعنی هم `logEvent`/drainِ DB و هم `logUiEvents`/drainِ DB واقعاً کار می‌کنند، نه فقط صفِ
درون‌حافظه‌ای. نمونه‌یِ ردیف‌هایِ واقعی (بدونِ هیچ متنِ بالینی):
```json
{"event":"session.transcript_put","severity":"info","session_id":"d68f0db5-...","detail":{"len":89,"version":0}}
{"event":"session.transcript_conflict","severity":"warn","detail":{"version":0,"prev_version":1}}
{"event":"auth.login_failed","severity":"warn","detail":{}}
{"event":"http.request","route":"/api/admin/stats","method":"GET","status_code":403,"detail":{"status":403,"duration_ms":2}}
{"event":"obs.session_mismatch","severity":"debug","detail":{}}
```
`route` همیشه الگوست (`/api/sessions/:id`)، نه URLِ خام با UUIDِ واقعی — تأییدِ رفتارِ
`request.routeOptions.url`.

## ۵. جمع‌بندی

- **فایلِ JSONL:** بدونِ نشتِ فارسی/بالینی، هم قبل هم بعدِ فیکس (۰ بار در همین verification نشتی نداشت، چون UI events اصلاً به آن نمی‌رسند).
- **DB:** یک نشتِ واقعی پیدا و همان‌جا رفع شد (`target_id` بدونِ اعتبارسنجیِ سمتِ‌سرور). بعدِ
  فیکس، هر دو چکِ SQLِ درخواستی صفر برگرداندند برایِ ترافیکِ تازه.
- **هر دو sink (فایل + DB) واقعاً end-to-end کار می‌کنند** — تأییدشده با شمارشِ واقعیِ ردیف.
- تصمیمِ حذفِ دادهٔ canary (جدولِ بخشِ ۱) و ردیفِ leak‌شده‌یِ قدیمی با مالک است.

## تست/تایپ‌چک
`cd server && npx tsc --noEmit` بعدِ فیکس: تمیز.
