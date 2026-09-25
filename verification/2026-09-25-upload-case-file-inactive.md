# 2026-09-25 — آپلودِ صدا برایِ مراجعِ غیرفعال ⇒ پرونده

> **به‌روزرسانیِ بعدی (همان روز):** به تصمیمِ مالک («فعلاً متن») این مسیر پشتِ `UPLOAD_CASE_FILE_INACTIVE=1` رفت و **پیش‌فرض خاموش** است.
> E2Eِ زیر با کدِ پیش از این سوئیچ اجرا شد (مسیرِ روشن). بعد از سوئیچ: `test:up` 37/37 (H27/H28ِ زیر ⇒ **H35/H36**، H35 پیش‌فرضِ خاموش را هم چک می‌کند)،
> `tsc` تمیز، UI با `case_file_planned:false` ⇒ ۳ مرحله برایِ غیرفعال.
>
> **Deploy به production (همان روز، «دیپلوی کن رو سرور»):** پیش از آن `test:cf` 108/108 و `test:rt` exit 0 هم اجرا شد. hashهایِ رویِ دیسک و
> `index.html`ِ سروشده = لوکال (`2073d260`)؛ health ok؛ `/api/audio-jobs` و `POST /api/uploads` بدونِ نشست ⇒ 401؛ `UPLOAD_CASE_FILE*` در `.env`
> تنظیم نیست ⇒ آپلود فقط متن. smoke با آپلودِ واقعی رویِ production انجام نشد. جزئیات: Event Logِ `PROJECT_STATUS.md`.

> Evidence (مشاهده در یک زمان). مالکِ رفتار: `docs/07-subsystems/06-audio-upload-pipeline.md`.

## تغییر
- `server/src/features/audio-upload/jobMachine.ts` — `uploadCaseFileAllowed`؛ `caseFileAfterUpload(job)` per-job/async.
- `server/src/features/audio-upload/jobRunner.ts` — `uploadCaseFileAllowedForJob` (خواندنِ `clients.status` + `therapists.case_file_enabled/case_file_auto_generate`).
- `server/src/features/audio-upload/uploads.routes.ts` — `client_status` در `AudioJobView`؛ retry ِ پس از ثبتِ متن فقط برایِ jobِ مرحله‌ی پرونده.
- `public/index.html` — `jobHasCaseFileStep`، پیامِ `busy_gave_up`، متنِ مودالِ آپلود.
- `scripts/upload-harness.ts` — H27، H28.

## اجرا
- `pnpm test:up` ⇒ **37 PASS / 0 FAIL** (H27: جدولِ سیاست — غیرفعال/فعال/بدونِ فیچر/خودکارِ خاموش/NULL/سوئیچِ سراسری؛ H28: دو job در یک world —
  غیرفعال ⇒ `done` + `case_file_status=done` و یک فراخوانیِ پرونده؛ فعال ⇒ `done/disabled`).
- `cd server && npx tsc --noEmit` ⇒ exit 0.
- Browser pane رویِ `file:///…/public/index.html` (بدونِ سرور/حساب؛ jobهایِ ساختگی به `jobCardHtml`):
  - غیرفعال + فیچر + خودکار، `transcribing` ⇒ `دریافت|تبدیل به متن|متن آماده|پرونده`
  - غیرفعال، `case_file/running` ⇒ ۴ مرحله + «پرونده در حالِ به‌روزرسانی…»؛ `done/done` ⇒ «متن آماده است و پرونده به‌روز شد.»
  - فعال، یا حسابِ بدونِ فیچر، یا خودکارِ خاموش، یا `failed` پیش از متن، یا فایلِ بی‌گفتار ⇒ ۳ مرحله
  - مودالِ آپلود: غیرفعال ⇒ «… و بعد پرونده‌ی درمانِ مراجع خودکار به‌روز می‌شود.»؛ فعال ⇒ متنِ قبلی.

## E2Eِ واقعی (همان روز، مجوزِ مالک: «تست E2E واقعی رو انجام بده») — PASS
**محیط:** سرورِ dev (`pnpm dev` از `.claude/launch.json`، با کدِ جدید؛ workerِ واقعی)، MySQLِ dev، **Sonioxِ واقعی**، **OpenRouterِ واقعی**.
پیش از تست سرورِ dev خاموش بود. **داده:** گفتگوی ۱۰ جمله‌ایِ کاملاً ساختگی با TTSِ ویندوز (David/Zira، انگلیسی) به m4a؛
حقایقِ کاشته‌شده: خواب، اضطراب از جلسه با مدیر، مقایسه‌شدن توسطِ برادر، پیاده‌رویِ صبح.
**Fixture:** دو تراپیستِ canary مستقیم در DB (`password_hash` غیرقابلِ‌استفاده، ایمیلِ `.invalid`، `case_file_enabled=1`؛ A با خودکارِ روشن،
B با خودکارِ خاموش)، مراجع‌ها با رضایتِ ثبت‌شده. آپلود از طریقِ HTTPِ واقعی (`POST /api/uploads` ← تکه‌ها ← `complete`) با کوکیِ نشست.

| سناریو | نتیجه |
|---|---|
| S1 غیرفعال + خودکارِ روشن (دورِ اول) | `normalizing ← transcribing ← case_file/running ← done/failed` بعد از ۶۶ث. متن ذخیره شد (۹۵۸ نویسه، نسخه ۱). digest موفق بود (۲۲ث)؛ compose با **`ECONNRESET`ِ OpenRouter** شکست خورد (قطعیِ گذرای شبکه، همان رفتارِ ثبت‌شده‌ی قبلی — نه این تغییر). اعلان‌ها: `transcript_ready`، `case_file_failed`. UI: «به‌روزرسانیِ خودکارِ پرونده ناموفق بود …» |
| S1 دورِ دوم (فایلِ دوم برایِ همان مراجع، جلسه‌ی ۲) | `case_file/running ← done/done` در ۷۰ث؛ `client_case_file.status=ready`، `corpus_signature` پر، اعلان‌ها `transcript_ready` + `case_file_updated`. هر ۴ حقیقتِ کاشته‌شده به فارسی در پرونده (خواب/برادر/مدیر/پیاده‌روی) — فقط وجودِ واژه چک شد، متن چاپ نشد |
| S2 فعال + خودکارِ روشن | `done/disabled` در ۱۰ث؛ **هیچ ردیفِ پرونده**؛ فقط `transcript_ready` |
| S3 غیرفعال + خودکارِ خاموش | `done/disabled`؛ **هیچ ردیفِ پرونده**؛ فقط `transcript_ready` |
| `client_status` در پاسخِ `complete` / `GET /api/audio-jobs` | `inactive`/`active` درست |
| UIِ واقعی (Browser pane، `127.0.0.1:3000` با کوکیِ canary) | سینیِ «پردازش‌ها و اعلان‌ها»: S1 ⇒ ۴ مرحله «… متن آماده ← پرونده» + «متن آماده است و پرونده به‌روز شد.»؛ S2 ⇒ ۳ مرحله «متن ذخیره شد» (اسکرین‌شات گرفته شد) |

**پاک‌سازی:** ۲ تراپیست (cascade)، ۴ جلسه با پوشه‌های صدا، ۴ پوشه‌ی آپلود حذف شدند؛ `remaining=0`. اسکریپتِ موقتِ `server/e2e-tmp/` حذف شد؛
سرورِ dev دوباره خاموش شد. ⚠️ تبِ `localhost:3000`ِ pane با کوکیِ httpOnlyِ حسابِ QAِ قدیمیِ `qa-obs-verify-…` لاگین بود — با آن هیچ کاری انجام نشد.

**تست‌نشده:** فهرستِ حسابِ Soniox بعد از تست خوانده نشد (پاک‌سازیِ فایل/transcription با `cleanupRemote` در کد انجام می‌شود و در ۲۰۲۶-۰۹-۲۳ تأیید شده بود)؛
گفتارِ فارسی (TTSِ فارسی رویِ این ماشین نیست)؛ retry ِ پرونده از دکمه‌ی «تلاشِ دوباره» (jobِ S1 به `done/failed` رسید، نه `failed`؛ مسیرِ رفع «به‌روزرسانی»ِ بخشِ پرونده است).
