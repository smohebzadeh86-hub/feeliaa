# 2026-09-25 — تستِ کاملِ آپلودِ صدا از UIِ واقعی + رفعِ تلاشِ دوباره‌ی پرونده

> Evidence (مشاهده در یک زمان). مالکِ رفتار: `docs/07-subsystems/06-audio-upload-pipeline.md`.
> دستورِ مالک: «حل کن تمامِ مشکلات رو … تستِ کامل رو انجام بده و بعدش تیکه‌تیکه کامیت کن».

## تغییرِ کد (رفعِ «شکستِ گذرایِ OpenRouter بدونِ تلاشِ دوباره»)
- `server/src/features/case-file/domain/errors.ts` — `CaseFileGenerationError.transient`.
- `server/src/features/case-file/adapters/llm/chatJson.ts` — `isTransientLlmError` (بدونِ status/قطعِ اتصال/timeout یا 408/429/5xx).
- `server/src/features/case-file/application/autoTrigger.ts` — گزینه‌ی `retryTransient` ⇒ `'transient'` بدونِ اعلانِ شکست.
- `server/src/features/audio-upload/jobMachine.ts` — `CASE_FILE_TRANSIENT_RETRY_MS = [1m, 5m, 15m]`؛ `ctx.lastAttempt`؛ `waiting` + `case-file-retry`.
- `server/src/features/audio-upload/jobRunner.ts` — `retryTransient: !ctx.lastAttempt`.
- `public/index.html` — پیامِ «سرویسِ ساختِ پرونده موقتاً در دسترس نبود — خودکار دوباره تلاش می‌کنیم».

## تستِ خودکار
- `pnpm test:up` **41/41** (جدید: H38 گذرا ⇒ waiting/۶۰ث ⇒ موفق؛ H39 سه تلاشِ دوباره ۱/۵/۱۵ دقیقه و تلاشِ چهارم lastAttempt ⇒ failed؛ H40 طبقه‌بندیِ خطا).
  H38 در اجرایِ اول به‌خاطرِ خودِ تست FAIL شد (`drive` بعد از WAIT فوراً ادامه می‌دهد) — تست قدم‌به‌قدم شد.
- `pnpm test:cf` 108/108؛ `tsc --noEmit` تمیز؛ `pnpm test:rt` (پیش از commit).

## E2E واقعی — سرورِ dev + MySQLِ dev + Sonioxِ واقعی + OpenRouterِ واقعی + UIِ واقعی در Browser pane
حسابِ canary (ایمیلِ `.invalid`، رمزِ غیرقابلِ‌استفاده، `case_file_enabled=1`، خودکارِ روشن)؛ صدایِ ساختگیِ TTSِ دوگوینده. فایل‌ها موقتاً در
`public/__e2e_*` سرو و با `DataTransfer` در `#audioUploadInput` گذاشته شدند (همان مسیرِ انتخابِ فایل)؛ بقیه UIِ واقعی (`feelia-upload.js`).

| سناریو | نتیجه |
|---|---|
| A — مراجعِ فعال، تک‌فایل؛ کلیکِ واقعی «آپلود صوت» رویِ کارت و «شروعِ آپلود» | مودال: رضایتِ ثبت‌شده ⇒ تیک پنهان؛ سینی: ۳ مرحله ⇒ «متن با تفکیکِ گوینده در این جلسه ذخیره شد.»؛ اعلانِ «متنِ … آماده شد»؛ «مشاهده‌ی جلسه» ⇒ متن با «گوینده ۱: …» |
| B — فایلِ WAVِ ۶۶.۵MB (۱۷ تکه، ۶ دقیقه) | `done/disabled`، ۵۷۶۳ نویسه؛ **هیچ `MaxListenersExceededWarning`** در لاگِ سرور |
| C — دو بخش برایِ یک جلسه | یک جلسه، `parts_total=2`، متنِ کامل (۹۵۸ نویسه = همان فایلِ یک‌تکه) |
| D — مراجعِ غیرفعال، سوئیچ خاموش (= production) | `done/disabled`، فقط `transcript_ready`، **هیچ پرونده‌ای** |
| E — مراجعِ غیرفعال، `UPLOAD_CASE_FILE_INACTIVE=1` موقت در `server/.env`ِ dev | `case_file/running ⇒ done/done`، پرونده `ready`، اعلان‌ها `transcript_ready` + `case_file_updated`؛ کارت ۴ مرحله |

A تا D هم‌زمان در صف بودند؛ همه در ~۱۵ث تمام شدند. لاگِ سرور بدونِ Error/Warning.

## پاک‌سازی
fixtureها (۱ تراپیست، ۳ مراجع، ۵ جلسه، ۶ آپلود + پوشه‌ها) ⇒ `remaining=0`؛ `public/__e2e_*` و `server/e2e-tmp/` حذف؛ `server/.env` از backup برگشت (سوئیچ ۰ خط)؛
سرورِ dev خاموش (مثلِ قبل)؛ تبِ canary بسته شد.

## تست‌نشده
- گفتارِ فارسی (TTSِ فارسی رویِ این ماشین نیست؛ `language_hints: ['fa']` در `asyncTranscribe.ts` تنظیم است).
- خطایِ گذرایِ **واقعیِ** OpenRouter (فقط با هارنس شبیه‌سازی شد).
- آپلودِ واقعی رویِ production.
