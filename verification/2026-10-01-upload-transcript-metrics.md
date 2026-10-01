# 2026-10-01 — «کیفیت به عدد» برایِ جلسه‌ی آپلودی (Session Data Engine، فاز Q-U)

> Evidence (مشاهده در یک زمان). ماشینِ dev، بدونِ DB، بدونِ Soniox، بدونِ دادهٔ مراجع. سند مالک: [subsystem 06 §11](../docs/07-subsystems/06-audio-upload-pipeline.md).

## چه ساخته شد
- `server/src/features/audio-upload/transcriptMetrics.ts` (جدید، خالص): پوششِ متن نسبت به صدایِ گفتاری، حفره‌هایِ وسط/سر/ته، گوینده‌هایِ پیدا‌شده در برابرِ حاضرین، نوبت‌هایِ تکه‌تکه، اطمینان.
- `quality.ts`: `speechSpans` (VADِ انرژی) از همان گذرِ ffmpeg ⇒ `audio_quality.speech_spans`.
- `jobMachine.ts`/`worker.ts`: توکن‌ها (فقط در حافظه) + پورتِ `expectedSpeakers` ⇒ `meta.metrics`؛ fail-open.
- `jobStore.sql.ts` + migration `036_upload_transcript_metrics.sql`: `audio_jobs.transcript_metrics`.
- `admin/diagnosis.ts`: `metricsFindings` در کارتِ «تشخیصِ جلسه»؛ `admin.repository.ts` ستون را می‌خواند.

## تست‌ها (اجرا‌شده)
| دستور | نتیجه |
|---|---|
| `pnpm test:up` | **63 PASS / 0 FAIL** (۵۴ قبلی بدونِ رگرسیون + H54–H62 جدید) |
| `cd server && npx tsc --noEmit` | تمیز |
| `pnpm test:arch` | OK (149 فایل، بدونِ چرخه) |
| `pnpm test:routes` | OK (135 route — routeی تغییر نکرد) |
| `pnpm test:docs` | OK پس از به‌روزرسانیِ اسناد |

H54–H62: پوششِ کامل ⇒ ۱ و بدونِ پرچم؛ حفره‌ی ۳۰ثِ وسط ⇒ `uncovered_gap` + `low_coverage` (پوشش ≈ ۰٫۷۶)؛ حفره‌ی ۸ث ⇒ بدونِ پرچم؛
سکوتِ واقعی بینِ دو بخش ⇒ حفره نیست؛ ۲۰ث بی‌متن در ابتدا/انتها ⇒ `head_gap`/`tail_gap`؛ ۳ حاضر و ۲ گوینده ⇒ `speakers_merged`
(برچسبِ تصادفیِ <۳٪ شمرده نمی‌شود)؛ ۳ گوینده و ۲ حاضر ⇒ `speakers_extra`؛ نوبتِ تک‌واژه‌ای ⇒ `fragmented_turns`؛ بازه‌هایِ نامعلوم/توکنِ بی‌زمان ⇒ پوشش null؛
VADِ خالص (پلِ مکثِ ۵۰۰ms، حذفِ تقِ ۱۰۰ms، نویزِ غالب ⇒ null)؛ meter رویِ سیگنالِ ساختگی با ۳۰ث سکوت؛ ماشینِ حالت (ثبتِ metrics، خطایِ حاضرین fail-open،
getTextِ رشته‌ای ⇒ null، متن بی‌تغییر)؛ یافته‌هایِ ادمین.

## ffmpegِ واقعی
فایلِ ساختگی (opus): ۳۰ث سینوس + ۳۰ث سکوت + ۳۰ث سینوس ⇒ `measureAudioQuality` ⇒ `speech_spans = [[0,30050],[60000,90000]]` (درست).
(flagهایِ `no_signal`/`noisy` رویِ سینوسِ خالصِ بدونِ نویزِ کف رفتارِ از قبل موجودِ meter است، ربطی به این تغییر ندارد.)

## چه چیزی تست **نشده**
- DBِ واقعی (migration 036 و UPDATEها) — فقط `tsc`؛ migration در startupِ بعدی اجرا می‌شود.
- Sonioxِ واقعی و گفتارِ واقعی: آستانه‌ها (`METRICS`، `QUALITY.VAD_*`) فقط با دادهٔ ساختگی تنظیم شده‌اند. VAD صدایِ غیرِگفتاری را هم «صدادار» می‌شمارد ⇒ رویِ جلساتِ واقعی پوشش کمی زیرِ ۱ طبیعی است؛ باید پس از چند جلسه‌ی واقعی بازبینی شود.
- کارتِ ادمین در مرورگر (فقط تابعِ خالص تست شد؛ UI کدِ جدید ندارد — همان لیستِ findings).
- deploy نشده.
