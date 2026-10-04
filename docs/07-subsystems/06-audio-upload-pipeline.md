# Subsystem 06 — آپلودِ فایلِ صوتیِ جلسه و pipelineِ پس‌زمینه

> **وضعیت:** ACTIVE-CANONICAL (مالکِ جزئیاتِ این مسیر) · ایجاد 2026-09-23 · آپلودِ چندبخشی (§۲.۱، migration 025، 2026-09-25) · سیاستِ پرونده‌ی آپلود (`UPLOAD_CASE_FILE_INACTIVE`، خاموش) + `case_file_planned` (2026-09-25).
> **منشأ:** بازخوردِ تراپیست (اینترنتِ کلینیک ناپایدار است؛ باید بتوان صدایِ ضبط‌شده را بعداً وارد کرد) + دستورِ صریحِ مالک.
> **کد:** `server/src/features/audio-upload/` (`uploads.routes.ts`، `uploadStore.ts`، `media.ts`، `jobMachine.ts`، `worker.ts` (+ `jobStore.sql.ts`))،
> `server/src/features/notifications/notify.ts`، `server/src/features/case-file/application/autoTrigger.ts`، `public/feelia-upload.js`،
> بخشِ «آپلودِ فایلِ صوتیِ جلسه + سینیِ پردازش» در `public/index.html`. Migration: `023_audio_upload_pipeline.sql`.

> **🔶 تصمیمِ مالک (2026-09-24):** مسیرِ آپلود برایِ **مراجعِ فعال و غیرفعال** فعلاً با **ذخیره‌ی متن** تمام می‌شود — پرونده ساخته نمی‌شود
> («در نهایت همون متنش ذخیره بشه … تبدیل به پرونده باشه بعدش، الان نه»). job بعد از ثبتِ متن مستقیم `done` با `case_file_status='disabled'`
> می‌شود؛ UI سه مرحله نشان می‌دهد (دریافت ← تبدیل به متن ← متن ذخیره شد). مرحله‌ی `case_file` (§۴، §۷) در کد و تست باقی است و با
> `UPLOAD_CASE_FILE=1` + `UPLOAD_SHOW_CASE_FILE_STEP=true` روشن می‌شود. تنها اعلانِ این مسیر: `transcript_ready`/`transcript_low_quality` (2026-09-28)/`transcript_empty`/`processing_failed`.
>
> **🔶 تصمیمِ مالک (2026-09-25):** «فعلاً متن ذخیره بشه؛ بعداً اگه خواستم پرونده» (پرونده هنوز برایِ همه‌ی تراپیست‌ها فعال نیست) ⇒ **پیش‌فرض
> هنوز برایِ همه فقط متن است.** مسیرِ «مراجعِ غیرفعال ⇒ پرونده» پیاده و با E2Eِ واقعی تأیید شده ولی پشتِ `UPLOAD_CASE_FILE_INACTIVE=1` خاموش است.
> `jobMachine.ts#uploadCaseFileAllowed`: job بعد از ثبتِ متن به `case_file` می‌رود اگر `UPLOAD_CASE_FILE=1` **یا** (`UPLOAD_CASE_FILE_INACTIVE=1` +
> مراجع `inactive` + `therapists.case_file_enabled` + `case_file_auto_generate=true`) — وضعیت لحظه‌ی ثبتِ متن خوانده می‌شود
> (`worker.ts#uploadCaseFileAllowedForJob`)؛ وگرنه `done/disabled`. UI (`jobHasCaseFileStep`) پیش از ثبتِ متن از `case_file_planned`ِ سرور
> (همان تابع) می‌خواند ⇒ روشن‌کردن فقط با env است، بدونِ تغییرِ فرانت. «به‌روزرسانی»ِ دستیِ پرونده همیشه متنِ جلسه‌هایِ آپلودی را هم می‌خواند.
> **خطایِ گذرایِ LLM در مرحله‌ی پرونده (2026-09-25):** `chatJson.ts#isTransientLlmError` (از 2026-09-28: `server/src/llm/jsonCall.ts`) (بدونِ status/قطعِ اتصال/timeout، یا 408/429/5xx) ⇒
> `CaseFileGenerationError.transient`؛ `autoTrigger` با `retryTransient` ⇒ `'transient'` بدونِ اعلان؛ `stepCaseFile` ⇒ `waiting` + `error_code='case-file-retry'`،
> تلاشِ دوباره بعد از ۱، ۵، ۱۵ دقیقه (`CASE_FILE_TRANSIENT_RETRY_MS`)؛ تلاشِ چهارم `lastAttempt` ⇒ شکستِ عادی (`done/failed` + `case_file_failed`). مسیرِ جلسه‌ی زنده تغییری نکرد.
> **الحاقِ تکه‌ها (2026-09-25):** `uploadStore.ts#assembleUpload` هر تکه را با `WriteStream`ِ جداگانه (append) می‌نویسد — رفعِ `MaxListenersExceededWarning` برایِ ≥۱۰ تکه.

> last-verified: 2026-09-30 @ `17d6919` · مالک: [feature-index](../02-reference/feature-index.md) (`audio-upload`) · قالب: [feature-doc-template](../00-governance/feature-doc-template.md) (LAW-026) — «چرا»ی هر تصمیم در متنِ زیر و Event Log؛ ساختارِ استاندارد:

- **مرزها:** `features/audio-upload/index.ts` صادر می‌کند: `collectUploadSonioxRefs`، `releaseSonioxRefs`، `sweepStaleUploads`، `sweepOrphanUploadDirs`، `startAudioJobWorker`، `sweepSonioxOrphans`، `tryFinalizeGroup`؛ routeها مستقیم از `uploads.routes.ts` (R3). اعلان‌ها: [notifications](../06-platform/notifications.md).
- **داده:** مالک: `audio_uploads`، `audio_jobs` (023، 025، 033)؛ می‌نویسد: `sessions` (`uploadSession.ts`، `jobStore.sql.ts`)، `session_audio` (source=upload)، `notifications`؛ فایل‌ها `data/uploads/`.
- **تست:** `pnpm test:up` (`scripts/upload-harness.ts`: ماشینِ حالت با portهایِ جعلی + ffmpegِ واقعی)؛ E2Eِ واقعیِ فایلِ ۶۰دقیقه‌ای در [verification](../../verification/2026-09-23-audio-upload-pipeline.md).
- **ریسک و بدهی:** نقضِ آگاهانه‌ی LAW-009 (متنِ رضایت دست نخورد)؛ آستانه‌هایِ کیفیت از یک گفت‌وگویِ ساختگی (R20)؛ `sessions` را مستقیم می‌نویسد.

## ۱. هدف و مرز

تراپیست فقط فایل را انتخاب می‌کند؛ از آن لحظه مدیریتِ کلِ مسیر کارِ سیستم است:

```
انتخابِ فایل → آپلودِ تکه‌تکه‌ی قابلِ ادامه → ذخیره‌ی durable (دیسکِ سرور) → بررسیِ واقعیِ فایل (ffmpeg)
→ ساختِ اتمیکِ «جلسه + job» → [از این‌جا مستقل از مرورگر] نرمال‌سازی → رونویسیِ async با تفکیکِ گوینده (Soniox)
→ ثبتِ exactly-onceِ متن → پرونده (طبقِ سیاستِ auto-generate) → اعلانِ پایدار
```

- **رضایت (2026-09-24):** تیکِ مودال فقط اگر مراجع رضایتِ ثبت‌شده ندارد نمایش داده می‌شود؛ اولین آپلود با تیک آن را برایِ همه‌ی جلسه/آپلودهایِ بعدیِ همان مراجع ثبت می‌کند (LAW-009).
- **چند فایل برایِ یک جلسه (2026-09-25، دستورِ مالک، migration 025):** «ویس‌ها مربوط به همان جلسه‌اند و به ترتیبِ آپلود ترنسکریپت شوند». جزئیات §۲.۱.
- هر فایلِ آپلودی (یا هر مجموعه‌ی چندبخشی) یک **جلسه‌ی تازه** با `sessions.source='upload'` می‌سازد (`status='completed'`، `consent=true` چون تراپیست تیکِ رضایت را زده). پیوستن به جلسه‌ی موجود عمداً پشتیبانی نمی‌شود (ریسکِ متنِ تکراری با ضبطِ زنده‌ی همان جلسه — محدودیتِ شناخته‌شده، §۹).
- ضبطِ آفلاینِ **داخلِ خودِ فیلیا** مسیرِ جدایی است که از قبل وجود داشت (IndexedDB + `late-transcript` — [subsystem 02](02-audio-durability-batch-fallback.md)).

## ۲. آپلود (کلاینت: `public/feelia-upload.js`)

| موضوع | رفتار |
|---|---|
| اثرِ انگشت | sha256 از `name|size|lastModified` + ۱MBِ اول + ۱MBِ آخر (بدونِ خواندنِ کلِ فایل) |
| ماندگاری | (رکورد فقط یک بار، پیش از شروع، نوشته می‌شود — ادامه با fingerprint) خودِ `File` در IndexedDB (`feelia-uploads`/`tasks`) تا پایانِ آپلود؛ بعد از رفرش/بستن‌وبازکردنِ تب، بعد از ورود **بدونِ انتخابِ دوباره** ادامه می‌یابد. هر کار به `therapistId` گره خورده. اگر ذخیره‌ی IndexedDB ممکن نشد: fail-open (فقط ادامه بعد از رفرش از دست می‌رود و UI صادقانه می‌گوید فایل را دوباره انتخاب کنید). |
| تکه | ۴MB (`CHUNK_SIZE`)، PUTِ جدا با `X-Chunk-Sha256`؛ با XHR تا نوارِ پیشرفتِ واقعی |
| شبکه‌ی ضعیف | فقط همان تکه تکرار می‌شود (backoffِ نمایی تا ۳۰ث، بعد صبرِ ۱۵ثانیه‌ایِ بی‌پایان)؛ timeoutِ هر تکه `max(120s, حجم/4KB·s)` و قطعِ زودهنگام فقط اگر ۶۰ث هیچ بایتی نرود (2026-09-26؛ قبلاً ثابتِ ۱۲۰s ⇒ زیرِ ~۳۵KB/s هیچ تکه‌ای کامل نمی‌شد)؛ با `offline` منتظرِ `online` می‌ماند؛ انتخابِ فایل در حالتِ آفلاین ⇒ «منتظرِ اینترنت» و شروعِ خودکار |
| ادامه | `POST /api/uploads` همان آپلود را (با fingerprint) برمی‌گرداند + فهرستِ تکه‌هایِ رسیده؛ فقط باقی ارسال می‌شود |
| تکراری | همان فایل برایِ همان مراجع ⇒ `duplicate:true` و پیامِ «قبلاً آپلود شده (جلسه N)». **(2026-09-24، رفعِ B2)** اگر jobِ آن آپلود `failed` و قابلِ ادامه است ⇒ همان job دوباره در صف (`requeued:true`، جلسه‌ی تکراری ساخته نمی‌شود)؛ اگر غیرقابلِ ادامه است (صدا دیگر نیست یا `unreadable`/`no-audio`/`too-long`/`audio-missing`/`audio-expired`) ⇒ آپلودِ تازه مجاز است |
| بستنِ تب | تا «دریافت شد» `beforeunload` هشدار می‌دهد؛ بعد از آن لازم نیست صفحه باز بماند |
| خروج از حساب | همه‌ی کارهایِ درون‌حافظه لغو (نه فقط XHRِ در جریان)، فایل در IndexedDB برایِ همان حساب می‌ماند |
| بستنِ کارتِ خطا | (2026-09-24، رفعِ B3) `DELETE /api/uploads/:id` هم زده می‌شود تا ردیفِ نیمه‌کاره جزوِ سقفِ ۵ نماند. سرور هم وقتی سقف پر است، نیمه‌کاره‌هایِ بی‌فعالیتِ > ۲۴ساعت را خودکار `canceled`/`expired` می‌کند |
| انتخابِ دوباره‌ی سریع | همان فایل/مراجع تا وقتی کارِ قبلی در جریان است کارِ دوم نمی‌سازد |
| نقاطِ ورود | دکمه‌ی پرونده‌ی مراجع (`detailUploadBtn`) و **(2026-09-26) صفحه‌ی «جلسه‌ی جدید» (`setupUploadBtn` → `openAudioUploadFromSetup`)**؛ از Setup بعد از شروعِ آپلود به پرونده‌ی همان مراجع می‌رود، انصراف رویِ Setup می‌ماند. ریشه: بعد از ساختِ مراجع اپ مستقیم به Setup می‌رود؛ در تستِ واقعی (2026-09-24، دو بار) تراپیست برایِ رسیدن به دکمه‌ی آپلود یک جلسه‌ی زنده‌ی خالیِ ۵–۱۳ثانیه‌ای ساخت |

**صادقانه:** بدونِ Service Worker، خودِ انتقالِ بایت‌ها فقط وقتی تبی از فیلیا باز است انجام می‌شود؛ هرچه بعد از `complete` است کاملاً سمتِ سرور است.

### ۲.۱ چند فایل برایِ یک جلسه (2026-09-25)

| موضوع | رفتار |
|---|---|
| انتخاب | `<input multiple>` و drag&drop چندفایلی؛ فهرستِ فایل‌ها با شماره‌ی بخش، مدت، دکمه‌هایِ بالا/پایین (ترتیب) و **آیکونِ سطل (SVG) برایِ حذف**؛ «+ افزودنِ تکه‌ی دیگرِ همین جلسه». فایلِ تکراری (نام+حجم+تاریخ) و بیش از ۱۰ فایل رد می‌شود. تاریخِ پیشنهادی = قدیمی‌ترین `lastModified` (مگر تراپیست خودش تاریخ را عوض کرده باشد). ۱ فایل ⇒ همان مسیرِ تک‌فایلیِ قبلی |
| ترتیب | ترتیبِ فهرستِ مودال = `part_index` = ترتیبِ وصل‌شدن = ترتیبِ متن |
| آپلود | `FeeliaUpload.startGroup`: `group_id` (UUIDِ کلاینت)؛ اثرِ انگشت و ذخیره‌ی IndexedDB برایِ همه پیش از شروع؛ بخش‌ها **یکی‌یکی** (زنجیره‌ی per-group)؛ بخشِ منتظر «در صف» |
| سرور | هر بخش یک `audio_uploads` با همان مسیرِ تکه‌تکه/بررسی (sniff + probe). `complete`ِ بخش ⇒ `status='complete'`، `session_id` NULL (منتظر). وقتی همه‌ی بخش‌ها رسیدند (زیرِ قفلِ درون‌پروسه‌ایِ گروه + `FOR UPDATE`) ⇒ یک تراکنش: جلسه + **یک job** با `source_parts` (JSONِ `{uploadId, path}` به ترتیب) + `session_id` برایِ همه‌ی بخش‌ها. مجموعِ مدت > ۳۰۰ دقیقه ⇒ همه‌ی بخش‌ها `failed`/`too-long` |
| نرمال‌سازی | هر بخش جدا probe؛ ffmpeg با چند `-i` (whitelistها برایِ **هر** ورودی) و `filter_complex`: هر بخش `aresample=16000,aformat=fltp/16k/mono` ⇒ `concat` ⇒ یک Opus/Ogg ⇒ **یک رونویسی و تفکیکِ گوینده‌ی یکدست برایِ کلِ جلسه** (رونویسیِ جدا برایِ هر بخش برچسبِ گوینده‌ها را بینِ بخش‌ها ناهمسان می‌کرد). بعد از آرشیو، پوشه‌یِ همه‌ی بخش‌ها حذف می‌شود |
| لغو | آیکونِ سطل رویِ کارتِ آپلود در سینی (برایِ تک‌فایلی هم). برایِ یک بخش ⇒ **کلِ گروه** لغو (`DELETE /api/upload-groups/:id`)، چون جلسه بدونِ آن بخش ساخته نمی‌شود. خطایِ دائمیِ یک بخش (مثلاً `not-audio`) ⇒ بقیه‌ی گروه لغو و کارتِ خطایِ همان بخش می‌ماند |
| ادامه بعد از رفرش | بخش‌هایِ رسیده از IndexedDB پاک شده‌اند؛ بخش‌هایِ باقی‌مانده به ترتیب ادامه می‌یابند؛ آخرین بخش جلسه را می‌سازد. کلیدِ ادامه (گروه، شماره‌ی بخش) است نه fingerprint |
| نگه‌داری | بخشِ رسیده‌ای که جلسه‌اش هرگز ساخته نشد ⇒ بعد از ۷ روز بی‌فعالیتی `canceled`/`expired` + حذفِ پوشه (`sweepStaleUploads`) |

محدودیت: تکراری‌بودن بینِ گروه‌ها تشخیص داده نمی‌شود (انتخابِ دوباره‌ی همان فایل‌ها به‌عنوانِ مجموعه‌ی تازه جلسه‌ی تازه می‌سازد — عمدی، چون گروه صریحاً انتخابِ تراپیست است).

## ۳. سرور — دریافت و بررسی

- تکه‌ها: `data/uploads/<uploadId>/chunk-NNNNNN.part` با نوشتنِ اتمیک (tmp+rename) ⇒ تکه‌ای که هست کامل است. حجمِ هر تکه دقیقاً چک می‌شود؛ sha256 ⇒ `422 chunk-corrupt`.
- `complete`: قفلِ per-upload (تک‌پروسه، LAW-013) ⇒ الحاقِ stream‌ی به `source.<ext>` (هرگز کلِ فایل در RAM نیست) ⇒ چکِ حجم ⇒ `sniffObviouslyNotAudio` (PDF/ZIP/تصویر/اجرایی/playlist) ⇒ `probeMedia` (ffmpeg): بدونِ جریانِ صوتی ⇒ `422 no-audio`، ناخوانا ⇒ `422 unreadable`، > ۳۰۰ دقیقه ⇒ `422 too-long` ⇒ **یک تراکنش**: قفلِ ردیفِ آپلود، `session_num` بعدی، INSERTِ جلسه، INSERTِ job، بستنِ آپلود.
- امنیتِ ffmpeg: `-protocol_whitelist file` و `-format_whitelist` (فقط demuxerهایِ صوتی/ویدیوییِ رایج) ⇒ فایلِ HLS/concat/playlist نمی‌تواند ffmpeg را به خواندنِ مسیر/URLِ دیگر وادار کند؛ همه‌ی فراخوانی‌ها `execFile` با آرایه‌ی آرگومان (بدونِ shell). نامِ فایلِ کاربر فقط برایِ نمایش ذخیره می‌شود (sanitize)، هرگز در مسیرِ دیسک.
- فرمت‌ها (پسوند **یا** MIMEِ `audio/*`/`video/*` — از 2026-09-24 هم‌راستا با کلاینت؛ فقط برایِ ردِ زود؛ تصمیمِ نهایی با probe): mp3، m4a، mp4، aac، wav، ogg/oga/opus، webm/weba، flac، amr، 3gp/3gpp/3ga، wma/asf، aif/aiff، caf، mkv/mka، mov، m4b، wv. تست‌شده با ffmpegِ واقعی: wav، m4a، mp3، ogg/opus، flac، wma، webm، amr، 3gp، ویدیوی mp4.

## ۴. ماشینِ حالتِ job (`jobMachine.ts`)

```
queued → normalizing → transcribing → case_file → done
             └──────────────┴──────────────┴────→ failed
```

| مرحله | کار | idempotency / بازیابی |
|---|---|---|
| normalizing | probe ⇒ تبدیل به Opus/Ogg، mono، 16kHz، 32kbps (fallback: AAC/M4A اگر libopus نبود)؛ timeoutِ ffmpeg `max(5min, duration/3)` (2026-09-26؛ قبلاً `/10`) ⇒ آرشیو با `archiveAudioFileForAdmin` (sha256، rename، `session_audio.source='upload'`) ⇒ حذفِ فایلِ خامِ آپلود | اگر `normalized_path` از قبل هست ⇒ ffmpeg دوباره اجرا نمی‌شود |
| transcribing | آپلودِ stream به Soniox ⇒ ذخیره‌ی `soniox_file_id` ⇒ ساختِ transcription ⇒ ذخیره‌ی `soniox_transcription_id` ⇒ poll (۳ یا ۱۰ ثانیه) ⇒ متن ⇒ **تراکنش**: قفلِ job، اگر `transcript_applied_at` دارد ⇒ هیچ؛ وگرنه append به `sessions.transcript` (+version، `stt_mode='upload'`) + علامت + اعلان ⇒ حذفِ فایل/transcription از Soniox | بعد از ری‌استارت همان transcription دنبال می‌شود (نه آپلودِ دوباره)؛ ۴۰۴ ⇒ فقط transcription دوباره؛ سه اجرایِ دوباره ⇒ یک متن |
| case_file | `maybeAutoGenerateCaseFile` با اعلان | `busy` ⇒ هر ۲ دقیقه تا ۱۵ بار، بعد `busy_gave_up` (متن سالم می‌ماند) |

- **خطایِ گذرا** (شبکه/Soniox/۵xx/timeout): backoff ۳۰ث، ۲د، ۱۰د، ۳۰د، ۱س، ۳س؛ بعد از آن `failed`.
- **خطایِ دائمی** (`no-audio`، `unreadable`، `too-long`، `audio-missing`، `audio-expired`، Soniox «Invalid audio file»): `failed` فوری، بدونِ هزینه‌ی اضافه؛ retry برایشان رد می‌شود.
- **شکستِ نرمال‌سازی** (فایلِ probeشده): ۳ تلاش و بعد `failed` با `normalize-failed` — **قابلِ «تلاشِ دوباره»** (2026-09-24، رفعِ M1؛ قبلاً `unreadable` می‌شد در حالی که علت ممکن است دیسک/بارِ سرور باشد).
- **مهلتِ transcription:** ۳۰ دقیقه + طولِ صدا؛ بیشتر ⇒ حذف رویِ Soniox و ساختِ دوباره (رفعِ الگویِ F2 برایِ این مسیر).
- **سکوت:** متنِ خالی ⇒ `done` + اعلانِ `transcript_empty`، بدونِ پرونده.

## ۵. Worker (`worker.ts` (+ `jobStore.sql.ts`))

- داخلِ همان پروسه (LAW-013)، هر ۳ ثانیه، هم‌زمانی ۲. انتخاب: `stage` فعال و `next_attempt_at <= NOW()` و leaseِ آزاد.
- **lease** (`locked_until`، ۲۰ دقیقه) + heartbeatِ هر ۶۰ ثانیه. در startup همه‌ی leaseها آزاد می‌شوند (تنها پروسه‌ی زنده خودِ ماییم) ⇒ ادامه‌ی فوری بعد از ری‌استارت/deploy.
- `wakeAudioJobWorker()` بلافاصله بعد از `complete`/retry.
- **خطایِ غیرمنتظره** (exception بیرون از مسیرهایِ گذرا/دائمیِ ماشینِ حالت، مثلاً rename/ENOSPC/DB): فاصله‌ی ۶۰ث×n؛ بعد از ۵ بارِ پشتِ‌سرِ‌هم (شمارنده‌ی درون‌حافظه‌ای) ⇒ `failed` با `internal-error` + اعلان (2026-09-24، رفعِ M2؛ قبلاً تکرارِ ابدی بدونِ اعلان).
- jobی که جلسه‌اش وسطِ کار حذف شد (cascade) ⇒ `'gone'`، چیزی نوشته نمی‌شود. منابعِ Soniox (2026-09-24، رفعِ M3): هر ۴ مسیرِ حذف پیش از DELETE شناسه‌ها را با `collectUploadSonioxRefs` می‌خوانند و بعد از حذفِ موفق `releaseSonioxRefs` پاکشان می‌کند؛ jobی که همان لحظه در حالِ اجراست، در `finally`ِ `runJob` اگر ردیفش دیگر نیست منابعی را که خودش ساخته پاک می‌کند. آرشیو: اگر ثبتِ ردیفِ `session_audio` شکست بخورد (مثلاً FK بعد از حذفِ جلسه)، فایلِ جابه‌جاشده پاک می‌شود (رفعِ M4).

## ۶. اعلان‌ها (`notifications`)

- فقط از رویدادِ واقعیِ backend، داخلِ همان تراکنشِ تغییرِ وضعیت. `UNIQUE(job_id, kind)` + `INSERT IGNORE` ⇒ retry اعلانِ تکراری نمی‌سازد.
- انواع: `transcript_ready`، `transcript_low_quality` (متن ذخیره شد ولی کم‌اطمینان — بخشِ ۱۰)، `transcript_empty`، `processing_failed` (+`error_code`)، `case_file_updated`، `case_file_failed`. متنِ فارسی در UI از `kind` ساخته می‌شود ⇒ هیچ داده‌ی بالینی در جدول نیست.
- «در صف/در حالِ تبدیل» **وضعیت** است، نه اعلان (پرهیز از خستگیِ اعلان).
- UI: سینیِ «پردازش‌ها و اعلان‌ها» (زنگوله با شمارنده) — poll هر ۵ث وقتی کاری فعال است، وگرنه ۳۰ث، و با برگشت به تب. اعلانِ تازه ⇒ بنرِ درون‌اپ + Notificationِ مرورگر (فقط اگر تب پس‌زمینه است و اجازه داده شده؛ متنِ عمومی بدونِ کد/نامِ مراجع چون رویِ صفحه‌ی قفلِ گوشی دیده می‌شود). اعلان‌هایِ خوانده‌نشده بعد از ورودِ دوباره در سینی می‌مانند. نگه‌داری ۳۰ روز.
- **محدودیت:** Push واقعی وقتی مرورگر کاملاً بسته است (Service Worker + Web Push) پیاده نشده.

## ۷. پرونده

- سیاستِ مرکزی `autoTrigger.ts` (قبلاً داخلِ `sessions.ts`): `case_file_enabled` + `case_file_auto_generate` + مراجعِ **غیرفعال** (رفتارِ قبلی بدونِ تغییر).
- پی‌ریزی برایِ مراجعِ فعال (تصمیمِ مالک: «الان نه، ولی پی‌ریزی»): `CASE_FILE_AUTO_ACTIVE_CLIENTS=1` بدونِ تغییرِ کد فعالش می‌کند.
- merge طبقِ معماریِ موجود (`mergeTherapistEdits.ts`): فیلدِ تأییدشده‌ی تراپیست یخ می‌زند و پیشنهادِ تازه به `suggestedUpdate` می‌رود؛ ردیف‌هایِ `addedByTherapist` حفظ می‌شوند.
- **رفعِ F6:** CAS رویِ `client_case_file.content_version` در تولید و همه‌ی PATCHها ⇒ ویرایشِ تراپیست حینِ تولیدِ چنددقیقه‌ای دیگر پاک نمی‌شود؛ قفلِ «در حالِ تولید» اتمیک (`claimGenerating`).
- **رفعِ F7 (UI):** شکست/در‌حالِ‌تولیدِ یک بازتولید دیگر پرونده‌ی سالمِ قبلی را پنهان نمی‌کند (بنر بالایِ محتوا).

## ۸. نگه‌داری و حذف (LAW-010 — تأییدِ مالک 2026-09-23: ۳۰ روز)

| داده | محل | عمر |
|---|---|---|
| تکه‌هایِ آپلودِ نیمه‌کاره | `data/uploads/<id>/` | ۷ روز بی‌فعالیت ⇒ `canceled` + حذف (`sweepStaleUploads`، ساعتی) |
| فایلِ خامِ کامل | `data/uploads/<id>/source.*` | تا پایانِ نرمال‌سازی؛ حداکثر ۳۰ روز |
| نسخه‌ی نرمال‌شده | `data/session-audio/<sessionId>/` (`session_audio`) | ۳۰ روز (sweepِ موجود) |
| فایل/transcription رویِ Soniox | Soniox | بلافاصله بعد از ثبتِ متن یا شکستِ دائمی؛ یتیم‌ها با `sweepSonioxOrphans` (فقط با `SONIOX_ORPHAN_SWEEP=1`، > ۲۴ساعت، فقط نام/مرجعِ `feelia`) |
| اعلان | `notifications` | ۳۰ روز |

حذفِ جلسه/مراجع/تراپیست: ردیف‌ها cascade؛ `deleteSessionAudioDirs` حالا `sweepOrphanUploadDirs` را هم صدا می‌زند (هر ۴ مسیرِ حذف).

## ۹. محدودیت‌هایِ شناخته‌شده

1. **متنِ رضایت/privacy note** (`index.html` «صدا هیچ‌جا ذخیره نمی‌شود») با این فیچر در تعارضِ بیشتری است — به دستورِ صریحِ مالک دست‌نخورده ماند (نقضِ آگاهانه‌ی LAW-009، ثبت در project-laws).
2. آپلود فقط تا وقتی تبی باز است پیش می‌رود (بدونِ Service Worker).
   - **چندتب (رفعِ L2، 2026-09-24):** هر فایل با Web Lock (`feelia-upload:<key>`) فقط در یک تب آپلود می‌شود. تبِ دیگر حالتِ `other-tab` («در تبِ دیگری در حالِ آپلود است») دارد؛ اگر تبِ اول بسته شود ادامه را برمی‌دارد و اگر کار تمام شده باشد (رکورد از IndexedDB رفته)، کارت را بی‌صدا برمی‌دارد. «لغو» با BroadcastChannel به تب‌هایِ دیگر هم می‌رسد.
   - **آپلودِ بسته‌شده رویِ سرور** (`upload-closed`، مثلاً بعد از آزادسازیِ > ۲۴ساعت بی‌فعالیتی) دیگر خطایِ دائمی نیست: کلاینت تا ۲ بار با آپلودِ تازه از نو شروع می‌کند و نسخه‌ی IndexedDB را پاک نمی‌کند (استثنا: آپلودِ `failed`).
   - **خروج از حساب با آپلودِ ناتمام (رفعِ M5):** مودالِ `logoutUploadModal` سه گزینه دارد: فایل در این مرورگر بماند (دستگاهِ شخصی)، پاک شود (`purgeLocal`، کامپیوترِ مشترک)، یا ماندن. پاک‌کردن فقط نسخه‌ی مرورگر را حذف می‌کند؛ آپلودِ سرور عمداً لغو نمی‌شود تا انتخابِ دوباره‌ی همان فایل (حتی از دستگاهِ دیگر) از همان‌جا ادامه دهد. **تأییدشده:** Chrome کپیِ کاملِ فایل را در IndexedDB نگه می‌دارد (usage ~۵۸MB برایِ ۵۸MB).
3. پیوستن به جلسه‌ی موجود پشتیبانی نمی‌شود؛ اگر همان جلسه زنده هم ضبط شده باشد، دو جلسه‌ی جدا خواهید داشت.
4. ~~کانفیگِ زنده‌ی nginx UNVERIFIED~~ — **تأیید شد (2026-09-24، `nginx -T`):** production `client_max_body_size 50m` و `proxy_read_timeout 300s` (یک `location /` برایِ همه) دارد ⇒ تکه‌ی ۴MB و `complete`ِ طولانی بدونِ تغییرِ nginx کار می‌کنند؛ PUTِ ۴MB از مسیرِ nginx به اپ رسید (401 بدونِ نشست، نه 413).
5. Web Push/پیامک ندارد.
- **یادداشتِ پیش از جلسه — بازطراحی (2026-10-01، migration 035):** یادداشتِ **متنی** حالا همراهِ اولین `POST /api/uploads` (`pre_note`، سقف ۴۰۰۰؛ در گروه فقط بخشِ اول؛ فقط در حافظه‌ی کلاینت و تا اولین پاسخِ موفق) به سرور می‌رسد و در `audio_uploads.pre_note` می‌ماند؛ `uploadSession.ts#insertPreNote` آن را **در همان تراکنشِ ساختِ جلسه** (پیش از شروعِ job) به `session_notes(note_before)` می‌نویسد و ستون را NULL می‌کند. نتیجه: رونویسیِ Soniox (`context.text`) و «متنِ نهایی» یادداشت را از اولین لحظه می‌بینند. (آپلودِ تکراریِ همان فایل که جلسه‌اش از قبل هست، یادداشتِ تازه را نمی‌گیرد.) یادداشتِ **صوتی** هنوز مسیرِ قبلی را دارد (`pre-note` + رونویسیِ جدا بعد از ساختِ جلسه) ⇒ فقط برایِ رونویسی‌هایِ بعدی و «ساختِ دوباره» اثر می‌گذارد. شرحِ قدیمیِ متنی زیر منسوخ است برایِ متن.
- **یادداشتِ پیش از جلسه (2026-09-29، REQ-066 — بخشِ متنی منسوخ، بالا را ببین):** مودالِ آپلود بلوکِ متنی/صوتی دارد (از صفحه‌ی شروع، همان متن/صداها منتقل می‌شوند). چون `session_id` فقط در `complete` معلوم می‌شود، `index.html#flushUploadPreNotes` با `FeeliaUpload.onChange` منتظرِ taskِ `done`/`duplicate` می‌ماند و بعد متن را با `POST /notes` (`note_before`) و صدا را با صفِ `pre-note` می‌فرستد. تا آن لحظه فقط در حافظه‌ی تب است (همان «تا دریافت شد صفحه را نبندید»)؛ لغو/حذفِ کار ⇒ دور ریخته می‌شود.
- **سقفِ هزینه (رفعِ L6):** `UPLOAD_DAILY_AUDIO_MINUTES` (پیش‌فرض ۶۰۰ دقیقه در ۲۴ ساعت برایِ هر تراپیست). پیش از آپلود به Soniox چک می‌شود؛ بیش از سقف ⇒ صف با `quota-wait`، نه رد. transcriptionِ در جریان هرگز متوقف نمی‌شود.
- **شماره‌ی جلسه (M7):** همیشه `MAX+1`؛ جلسه‌ی قدیمی‌ای که دیرتر آپلود شود شماره‌ی آخر را می‌گیرد. **عمداً شماره‌گذاریِ دوباره انجام نمی‌شود**، چون «جلسه N» در پرونده، اعلان‌ها و ذهنِ تراپیست ارجاع شده و تغییرش تغییرِ داده است. raceِ ساختِ هم‌زمان رفع شد: در زنده، دستی و `complete`، تداخلِ UNIQUE/deadlock تا ۱۵ بار با jitter دوباره تلاش می‌شود (E2E: ۱۰ ساختِ هم‌زمان ⇒ شماره‌هایِ ۱..۱۰، ۳ بار پشتِ‌سرِ‌هم).
6. ~~تستِ end-to-end با DB/Sonioxِ واقعی انجام نشد~~ — **انجام شد (2026-09-23، دورِ دوم):** مسیرِ کامل با Soniox/LLMِ واقعی، فایلِ ۶۰ دقیقه‌ای، kill ِ سرور وسطِ رونویسی، هم‌زمانی و mutation — [verification](../../verification/2026-09-23-audio-upload-pipeline.md) §۴.۱. تست‌نشده: گفتارِ فارسی (TTSِ فارسی در دسترس نبود)، حافظه‌ی سرور، `sweepSonioxOrphans` (عمداً).

## رفعِ A1 (2026-09-26)
- **A1.3 گروهِ گیرکرده:** `POST /api/uploads` برایِ بخشِ `complete`ِ بدونِ جلسه `finalizeGroup` را دوباره (زیرِ قفلِ گروه، idempotent) اجرا می‌کند؛ اگر جلسه ساخته شد/بود پاسخ `duplicate:true` با `job` است، وگرنه `part_done` با `parts_received/parts_total`. `sweepStaleUploads(tryFinalizeGroup)` هر ساعت گروه‌هایِ کاملِ بدونِ جلسه (قدیمی‌تر از ۱۰ دقیقه) را finalize می‌کند، نه اینکه بعد از ۷ روز حذف کند.
- **A1.8 رضایت:** `feelia-upload.js` فقط در شروعِ دستی (`start`/`startGroup`) و فقط تا اولین پاسخِ موفقِ `POST /api/uploads`، `consent:true` می‌فرستد؛ resume بعد از رفرش و retry نمی‌فرستند. سرور رضایت را فقط بعد از گذشتنِ validationها (تاریخ، گروهِ بسته) ثبت می‌کند.
- ⚠️ این دو با DBِ واقعی (E2E) تست نشده‌اند — فقط `tsc` و `test:up` (بدونِ رگرسیون).

## ۱۰. کیفیتِ فایلِ آپلودی (پلنِ B، 2026-09-28 — migration 033)

مبنا: فاز ۰B ([verification](../../verification/2026-09-28-upload-audio-quality-phase0b.md)). Soniox در برابرِ صدایِ آرام تا −50dB، وزوز/نویزِ ایستا تا SNR 0، ۸kHz، mp3ِ ۳۲k و clipping +20 مقاوم بود؛ اولین آسیب ادغامِ گوینده‌ها بود و تنها آسیبِ جدیِ واژه‌ای همهمه‌یِ هم‌سطح (WER ۲۲٫۵٪). **تنها پیش‌بینی‌کننده‌ی متنِ خراب confidenceِ خودِ Soniox بود.** هیچ فیلترِ صوتی (loudnorm/dynaudnorm/highpass/notch/afftdn) gate را رد نکرد ⇒ **پیش‌پردازش ساخته نشد**؛ فایلِ آرشیو و فایلِ Soniox همان خروجیِ `normalizeAudio` است.

- **سنجش (`quality.ts`)**: در مرحله‌ی `normalizing`، بعد از `normalizeAudio` و **پیش از** `archive`، یک گذرِ ffmpeg (`-f f32le -ar 16000`، stream، whitelistِ همان `media.ts`) ⇒ `FileQualityMeter` (portِ `createAudioQualityMonitor`، قاب ۵۰ms، پنجره ۳۰ث). خروجی `{p10_db, p95_db, clip_frac, windows, flagged_windows, flags}` در `audio_jobs.audio_quality`. آستانه‌ها در configuration-catalog (`QUALITY`)؛ `too_quiet` −60 (نه −45ِ زنده). flag فقط وقتی ≥۳۰٪ پنجره‌ها مشکل دارند (سکوتِ عادیِ جلسه flag نمی‌سازد). **fail-open**: خطا/timeout ⇒ `null`، job بی‌تغییر ادامه می‌دهد. ری‌استارت بعد از نرمال‌سازی: سنجه‌ی ثبت‌نشده از فایلِ آرشیو گرفته می‌شود. هیچ فایلی رد نمی‌شود (فقط `no-audio`/`unreadable` مثلِ قبل).
- **flagها فقط «علتِ احتمالی»‌اند** (`noisy` نویزِ بی‌خطر را هم می‌گیرد و همهمه را از نویزِ ایستا جدا نمی‌کند) ⇒ هیچ‌وقت به‌تنهایی هشدار/اعلان نمی‌سازند؛ در UI فقط «نکته برایِ ضبطِ بعدی».
- **هشدار (`quality_warning='low_confidence'`)**: `getText` حالا `{text, lowConfRatio, markedText}` برمی‌گرداند. `lowConfRatio` = سهمِ توکن‌هایِ محتوادار با confidence<0.7. بیشتر از `UPLOAD_LOW_CONF_RATIO` (۰٫۰۸) ⇒ متن **در هر حال ذخیره می‌شود** (LAW-008) ولی اعلان `transcript_low_quality` به‌جایِ `transcript_ready`، و `audio_jobs.quality_warning/low_conf_ratio` ثبت می‌شود. بدونِ confidence ⇒ بدونِ هشدار (fail-open). متنِ خالی ⇒ همان `transcript_empty`.
- **«متنِ نهایی» از آپلود**: ورودیِ polish نسخه‌ی علامت‌خورده (`markedTextFromTokens`: واژه‌هایِ confidence<`TRANSCRIPT_UNCERTAIN_CONFIDENCE` داخلِ `⟦…؟⟧`) است؛ `sessions.transcript` بدونِ علامت. اگر جلسه از قبل متن داشت، **کلِ متن** (نه فقط بخشِ آپلودی — قبلاً متنِ نهایی بخشِ قبلی را پنهان می‌کرد) با برچسبِ جداکننده و شماره‌ی گوینده‌هایِ جدا برایِ بخشِ آپلودی (`appendUploadForPolish`) مرتب می‌شود.
- **signها عمداً به متنِ آپلودی داده نمی‌شوند** (برخلافِ پیش‌نویسِ پلن): `offset_ms`ِ علامت نسبت به صدایِ جلسه‌ی زنده است، نه فایلِ آپلودی، و علائمِ زنده از قبل در بخشِ زنده‌ی متن هستند.
- **UI**: خطِ راهنما در مودالِ آپلود؛ کارتِ job (سینی و صفحه‌ی جلسه): `low_confidence` ⇒ بنرِ زرد + علتِ احتمالی از flag؛ فقط flag ⇒ نکته‌ی خاکستری؛ هشدار پنلِ صفحه‌ی جلسه را نگه می‌دارد. Clarity: `upload_quality_warned` (فقط نام). obs: `audio_job.quality_flags`، `audio_job.low_confidence` (فقط `reason`).
- **آزمون**: `test:up` H41–H51 (ماشینِ حالت، meterِ خالص، علامت‌گذاری، ffmpegِ واقعی: تمیز/−40dB/mp3/۸kHz بدونِ flag؛ −50dB/+30dB/SNR −5 flag درست؛ فایلِ خراب ⇒ null).

## ۱۱. «کیفیت به عدد» برایِ هر جلسه‌ی آپلودی (Session Data Engine، فاز Q-U، 2026-10-01 — migration 036)

- **چرا:** توکن‌هایِ async ِSoniox (زمان، گوینده، اطمینان) فقط به متن تبدیل و دور ریخته می‌شدند و transcription رویِ Soniox حذف می‌شود ⇒ هیچ عددی نمی‌گفت متن چقدر از گفتار را پوشش داده، ابتدا/انتها جا افتاده یا گوینده‌ها ادغام شده‌اند. تصمیمِ مالک (2026-10-01): اولویت با مسیرِ آپلود چون بیشترِ جلساتِ واقعی آپلودی‌اند. **هیچ تماسِ اضافه با Soniox ندارد.**
- **بازه‌هایِ صدادار:** همان گذرِ ffmpegِ `FileQualityMeter` dBِ هر قابِ ۵۰ms را نگه می‌دارد ⇒ `speechSpans` (VADِ انرژی: قاب ≥ max(p10+10، −70)dB، مکثِ <۱ث پل، تکه‌ی <۲۵۰ms حذف؛ اگر p95−p10 <۱۲dB ⇒ `null` = نامعلوم). ذخیره در کلیدِ `speech_spans` ِ `audio_jobs.audio_quality` (فقط زمان؛ به UIِ تراپیست نمی‌رود — `jobView` فقط flagها را می‌فرستد).
- **متریک (`transcriptMetrics.ts`، خالص):** در `stepTranscribe` از توکن‌ها (فقط در حافظه) + `speech_spans` + حاضرینِ جلسه (`treatmentUnits.sessionSpeakerRoster` + درمانگر؛ پورتِ اختیاریِ `expectedSpeakers`) ⇒ `audio_jobs.transcript_metrics` در همان تراکنشِ ثبتِ متن. فیلدها: `coverage`، `speech_ms`، `uncovered_speech_ms`، `longest_uncovered_ms`، `uncovered_gaps` (≥۱۵ث وسطِ جلسه)، `head_gap_ms`/`tail_gap_ms`، `words`، `words_per_min`، `low_conf_ratio`، `uncertain_words`، `speakers_found` (سهم ≥۳٪)/`speakers_raw`/`speakers_expected`، `speaker_shares`، `turns`، `short_turn_ratio`، `flags` ∈ `low_coverage` (<۰٫۸۵ با ≥۶۰ث گفتار)، `uncovered_gap`، `head_gap`، `tail_gap` (≥۱۵ث)، `speakers_merged`، `speakers_extra`، `speakers_minor` (2026-10-04: برچسبِ فانتومِ ۰٫۵–۳٪ سهم؛ فقط وقتی حاضرین معلوم‌اند)، `speaker_imbalance` (2026-10-04: دونفره + سهمِ بزرگ‌ترین ≥۸۵٪ + ≥۱۰۰۰ واژه — «مونولوگ یا ادغام»، فقط هشدارِ ادمین؛ نه برایِ تراپیست و نه HOLD)، `fragmented_turns` (>۴۰٪ نوبتِ ≤۳ واژه). ثابت‌ها: `METRICS` در همان فایل و `QUALITY.VAD_*` در `quality.ts`.
- **fail-open:** خطایِ متریک یا حاضرین ⇒ `null`/حاضرینِ نامعلوم؛ ثبتِ متن و اعلان بی‌تغییر. jobهایِ پیش از 036 و jobی که `speech_spans` ندارد ⇒ پوشش `null`.
- **نمایِ کلی (2026-10-01):** صفحه‌ی «کیفیتِ رونویسی» در پنلِ ادمین (`public/feelia-admin-quality.js`، `GET /api/admin/upload-quality`، `audio-upload/adminQuality.ts`): کاشی‌هایِ میانه/کمینه‌ی پوشش و شمارِ جلسه‌ی دارایِ هشدار، پرتکرارترین پرچم‌ها، و فهرستِ جلسات بدترین اول با فیلترِ تراپیست و بازه‌ی ۷/۳۰/۹۰ روز؛ «مشاهده» ⇒ جزئیاتِ جلسه.
- **ادمین:** کارتِ «تشخیصِ جلسه» (`admin/diagnosis.ts` ⇒ `metricsFindings`) برایِ جلسه‌ی آپلودی پوشش، حفره‌ها، گوینده‌ها و اطمینان را نشان می‌دهد؛ `diagnosis.upload_jobs[].transcript_metrics` عددِ خام.
- **محدودیت:** VAD گفتار را از صدایِ غیرِگفتاری جدا نمی‌کند ⇒ پوشش کمتر از ۱ طبیعی است؛ آستانه‌ها با دادهٔ ساختگی تنظیم شده‌اند و با دادهٔ واقعی بازبینی می‌شوند (R20). جلساتِ قدیمی متریک ندارند (توکن‌ها حذف شده‌اند).
- **آزمون:** `test:up` H54–H62 (پوشش/حفره/سر و ته/گوینده/تکه‌تکه، VADِ خالص و meter، ماشینِ حالت + fail-open، یافته‌هایِ ادمین)؛ ffmpegِ واقعی رویِ فایلِ ساختگیِ ۳۰ث صدا + ۳۰ث سکوت + ۳۰ث صدا ⇒ `[[0,30050],[60000,90000]]` ([verification](../../verification/2026-10-01-upload-transcript-metrics.md)).

## ۱۲. بهبودهایِ مسیرِ آپلود از ممیزیِ Core (2026-10-01)

- **fsync پیش از تأیید:** `uploadStore.ts#writeChunk` پیش از `rename` (و پیش از پاسخِ 200 که کلاینت بر اساسش نسخه‌ی خودش را رها می‌کند) `fsync` می‌زند؛ `assembleUpload` هم فایلِ الحاق‌شده را پیش از rename. قبلاً قطعِ برقِ سرور می‌توانست تکه‌ی «دریافت‌شده» را ناقص بگذارد.
- **تراپیست بداند چه جا افتاده:** `jobView.transcript_notes` پرچم‌هایِ `low_coverage|uncovered_gap|head_gap|tail_gap|speakers_merged` از `transcript_metrics` را (فقط نام) می‌فرستد؛ UI (`jobNotesHtml` در `index.html`) — به‌جز `speakers_merged` که از 2026-10-04 عمداً نمایش داده نمی‌شود — بنرِ «پیش از استفاده، متن را با صدا مقایسه کنید» با توضیحِ هر مورد نشان می‌دهد (کارتِ سینی و پنلِ صفحه‌ی جلسه). لحنِ مرور، نه خطا: VAD ساده است و آستانه‌ها R20.
- **آزمون:** `test:up` H64–H65. **انجام نشد:** مشاهده‌ی بصریِ بنر در مرورگر؛ ذخیره‌ی توکن‌هایِ Soniox و تاریخچه‌ی متنِ خام (فاز ۲ ممیزی — نیازمندِ migration و تصمیمِ مالک).

## ۱۳. ذخیره‌ی توکن‌هایِ زمان‌دار (Session Data Engine، فاز ۲، 2026-10-01 — migration 038)

- **چرا:** توکن‌هایِ async ِSoniox (متن، زمان، گوینده، اطمینان) فقط به متن تبدیل و دور ریخته می‌شدند؛ بعد از پاکسازیِ ۳۰روزه‌یِ صدا هیچ مدرکِ قابلِ راستی‌آزمایی نمی‌ماند و بازسازیِ رکوردِ ساخت‌یافته بدونِ رونویسیِ دوباره ممکن نبود. **تصمیمِ مالک (2026-10-01): توکن‌ها بعد از پاکسازیِ صدا بمانند.** هزینه‌یِ Soniox ندارد (توکن‌ها از قبل دریافت می‌شدند).
- **چطور:** `stepTranscribe` ⇒ `meta.tokens` ⇒ `sqlJobStore.applyTranscriptOnce` در **همان تراکنشِ ثبتِ متن** `INSERT IGNORE INTO session_transcript_tokens` (`UNIQUE(job_id)` ⇒ exactly-once). قالب (`session-record/tokens.ts` — از 041 به featureِ [session-record](08-session-record.md) منتقل شد؛ همان تراکنش حالا نوبت‌هایِ گوینده را هم در `session_segments` می‌سازد): gzip( `{v:1, t:[[text,start_ms,end_ms,speaker,confidence×100],…]}` )؛ `engine=soniox-async`، `model=stt-async-v5`.
- **fail-open:** توکنِ خالی/خطایِ بسته‌بندی/خطایِ INSERT ⇒ فقط لاگ؛ ثبتِ متن و اعلان بی‌تغییر (LAW-008).
- **نگهداری:** با جلسه (FK CASCADE)؛ پاکسازیِ صدا آن را حذف **نمی‌کند**. ⚠️ این داده‌یِ بالینی است ⇒ هنگامِ بازبینیِ متنِ رضایت/سیاستِ نگهداری (R1، LAW-009/010) ذکر شود.
- **محدودیت:** فقط آپلود (source=upload)؛ جلسه‌یِ زنده هنوز توکن نمی‌فرستد؛ jobهایِ پیش از 038 توکن ندارند؛ هنوز هیچ خواننده‌ای نیست (آماده برایِ فاز ۳).
- **آزمون:** `test:up` H66–H67 (roundtrip/فشرده‌سازی، رسیدنِ توکن به store). ⚠️ مسیرِ SQLِ واقعی (INSERT) رویِ DB تست نشد.
