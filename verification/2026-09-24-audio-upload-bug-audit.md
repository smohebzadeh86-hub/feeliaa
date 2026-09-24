# بررسیِ باگ‌هایِ فیچرِ «آپلودِ فایلِ صوتیِ جلسه» قبل از تست (2026-09-24)

> **Evidence** (مشاهده در یک لحظه، LAW-019). بررسی فقط با خواندنِ کد انجام شد و **هیچ کدی تغییر نکرد**.
> محدوده: `server/src/features/audio-upload/*`، `notifications/notify.ts`، `public/feelia-upload.js`، بخشِ آپلود/سینی در `public/index.html`،
> migration 023، تغییراتِ `asyncTranscribe.ts` / `sessionAudioArchive.ts` / `sessions.ts` / `index.ts`، و `deploy/nginx/feelia.conf`.
> اجرا: `pnpm test:up` **27 PASS / 0 FAIL**، `cd server && npx tsc --noEmit` تمیز (exit 0).
> برچسب‌ها: **CONFIRMED** = مسیرش در کد قدم‌به‌قدم دنبال شد · **INFERRED** = به رفتارِ مرورگر یا محیط بستگی دارد و اجرا نشد.

## ۰. خلاصه

هسته‌ی سمتِ سرور محکم است: کنترلِ مالکیت، `complete` اتمیک همراهِ قفل، ثبتِ exactly-onceِ متن، lease/heartbeat، whitelistِ ffmpeg و escapeِ HTML.
مشکل‌ها بیشتر در **مسیرهایِ شکست و بن‌بست**اند؛ یعنی جاهایی که تراپیست گیر می‌کند و راهی جز ما ندارد.
سه مورد باید قبل از تستِ واقعی رفع یا بررسی شود (B1–B3).

## ۱. قبل از تست باید رفع/بررسی شوند

### B1 — کانفیگِ nginxِ production تأیید نشده (INFERRED، اثر بالا)
- فقط `deploy/nginx/feelia.conf` (کانفیگِ مرجع) `client_max_body_size 12m` و `proxy_read_timeout 300s` را برایِ `complete` دارد. کانفیگِ زنده خوانده نشده (سندِ subsystem §۹.۴ و verification 2026-09-23 §۵).
- اگر روی production سقفِ بدنه پیش‌فرض (1m) باشد، **همه‌ی تکه‌هایِ ۴MB** خطایِ 413 می‌گیرند. در `feelia-upload.js:272` کدِ 413 قابلِ تکرار حساب نمی‌شود، پس آپلود فوراً با پیامِ «آپلود ناموفق بود» تمام می‌شود.
- فیچر هنوز commit و deploy نشده است. migration 023 هم باید روی production اجرا شود.

### B2 — بن‌بستِ «تکراری» بعد از شکستِ دائمیِ job (CONFIRMED)
- `uploads.routes.ts:157-169`: آپلودِ قبلی با وضعیتِ `complete` ⇒ جوابِ `duplicate:true`. وضعیتِ آپلود بعد از `complete` **هرگز** عوض نمی‌شود، حتی وقتی jobِ آن شکست بخورد.
- سناریو: job با `audio-expired` یا `audio-missing` یا `unreadable` شکست می‌خورد (`unreadable` از نرمال‌سازی یا از پیامِ «Invalid audio»ِ Soniox می‌آید). UI و endpointِ retry (کد 410) می‌گویند «لطفاً دوباره آپلود کنید». تراپیست همان فایل را برایِ همان مراجع دوباره انتخاب می‌کند و پیام می‌گیرد: «این فایل قبلاً … آپلود شده — دوباره ثبت نشد».
- تنها راهِ فعلی این است که جلسه حذف شود. با حذفِ جلسه، ردیفِ آپلود cascade می‌شود. این راه در UI هیچ‌جا گفته نشده.
- جهتِ رفع: وقتی jobِ آن آپلود `failed` است، dedupe آن را نادیده بگیرد، یا آپلود هنگامِ شکستِ دائمی از حالتِ `complete` خارج شود.

### B3 — سقفِ ۵ آپلودِ نیمه‌کاره و راهی برایِ آزادکردنش نیست (CONFIRMED)
- `uploads.routes.ts:171-175`: هر ردیفِ `uploading` تا ۷ روز جزوِ سقف حساب می‌شود (`sweepStaleUploads`). پیامِ خطا می‌گوید «اول آن‌ها را تمام یا لغو کنید».
- `feelia-upload.js:378` (`dismiss`، دکمه‌ی «بستن» رویِ کارتِ خطا) فقط IndexedDB و حافظه را پاک می‌کند و **`DELETE /api/uploads/:id` را صدا نمی‌زند**. فقط `cancel` این کار را می‌کند.
- سینی فقط کارهایِ محلیِ همین مرورگر را نشان می‌دهد. هیچ UIای ردیف‌هایِ `uploading`ِ سرور را فهرست یا لغو نمی‌کند.
- چه چیزهایی ردیفِ یتیم می‌سازند: بستنِ کارتِ خطا، خطایِ 413/400 وسطِ آپلود، ذخیره‌نشدنِ فایل در IndexedDB به‌همراهِ بستنِ تب، و انتخابِ دوباره‌ی فایل از گالریِ گوشی. در مورد آخر، `lastModified` یا نام عوض می‌شود، پس fingerprint تازه و ردیفِ تازه ساخته می‌شود (INFERRED).
- نتیجه: در یک روزِ تست با اینترنتِ ضعیف، تراپیست ممکن است تا ۷ روز با خطایِ 429 قفل شود.

## ۲. متوسط

| # | مشکل | محل | برچسب |
|---|---|---|---|
| M1 | مشکلِ گذرایِ سرور به‌صورتِ «فایل خراب است» گزارش می‌شود: سه شکستِ پشتِ‌سرِ‌همِ نرمال‌سازی (دیسکِ پر، timeout یا kill شدنِ ffmpeg زیرِ بار) ⇒ `unreadable` دائمی. دکمه‌ی تلاشِ دوباره در UI پنهان است (`PROC_NOT_RETRYABLE`) و سرور هم retry را با کدِ 422 رد می‌کند. | `jobMachine.ts:176-179`، `uploads.routes.ts:379` | CONFIRMED |
| M2 | حلقه‌ی بی‌پایان در خطایِ غیرمنتظره: هر exceptionی که بیرون از try/catchهایِ `stepJob` بیفتد (مثلاً `archive` یا rename یا ENOSPC در sha256 یا خطایِ DB در `applyTranscriptOnce`)، فقط `next_attempt_at` را ۶۰ ثانیه جلو می‌برد و `attempts` را زیاد نمی‌کند. job هیچ‌وقت `failed` نمی‌شود، اعلانی ساخته نمی‌شود و UI برایِ همیشه «در حالِ تبدیل…» نشان می‌دهد. | `jobRunner.ts:212-216` | CONFIRMED |
| M3 | حذفِ جلسه یا مراجع وسطِ رونویسی: ردیفِ job با cascade پاک می‌شود و `runJob` در خط ۲۰۷ فقط `return` می‌کند. پس فایل و transcriptionِ رویِ Soniox (یعنی صدایِ بالینی) می‌مانند. فقط `sweepSonioxOrphans` آن‌ها را پاک می‌کند، که به `SONIOX_ORPHAN_SWEEP=1` رویِ prod وابسته است و تنظیم‌بودنش تأیید نشده. ادعایِ سند (§۵: «'gone' ⇒ منابعِ Soniox پاک می‌شوند») فقط وقتی درست است که حذف درست وسطِ `applyTranscriptOnce` اتفاق بیفتد. | `jobRunner.ts:207`، سند §۵ | CONFIRMED |
| M4 | حذف وسطِ نرمال‌سازی: `archiveAudioFileForAdmin` اول فایل را به `data/session-audio/<sessionId>/` rename می‌کند و بعد INSERT می‌زند. INSERT با خطایِ FK شکست می‌خورد و فایلِ صوتی بدونِ ردیف روی دیسک می‌ماند. `sweepOldSessionAudio` فقط فایل‌هایِ دارایِ ردیف و پوشه‌هایِ خالی را پاک می‌کند، پس این فایل هرگز پاک نمی‌شود (LAW-010). احتمالش کم است. | `sessionAudioArchive.ts` (archiveAudioFileForAdmin، sweepOldSessionAudio) | CONFIRMED (منطق) |
| M5 | کلِ `File` در IndexedDB ذخیره می‌شود. احتمالاً Chrome محتوایِ blob را در پروفایل کپی می‌کند؛ برایِ فایلِ ۱GB این یعنی نوشتنِ ۱GB پیش از شروعِ آپلود، در حالی که UI «آماده‌سازیِ فایل…» نشان می‌دهد. `persist` بعد از گرفتنِ `uploadId` دوباره صدا زده می‌شود (خطِ ۱۹۷) و ممکن است همه را دوباره بنویسد. رویِ کامپیوترِ مشترکِ کلینیک، صدایِ بالینی تا پایانِ آپلود یا بستنِ کارت در پروفایلِ مرورگر می‌ماند، حتی بعد از خروج از حساب. | `feelia-upload.js:152-159, 197, 336` | INFERRED — روی دستگاهِ واقعی تست شود |
| M6 | تاریخِ پیش‌فرضِ جلسه از `file.lastModified` گرفته می‌شود. برایِ فایلی که از واتس‌اپ یا تلگرام یا دانلود آمده، این تاریخِ دریافتِ فایل است، نه تاریخِ جلسه، و بی‌صدا از قبل پر می‌شود. | `index.html` (`onAudioUploadPicked`) | CONFIRMED |
| M7 | شماره‌ی جلسه همیشه `MAX+1` است: جلسه‌ی قدیمی‌ای که دیرتر آپلود شود آخرین شماره را می‌گیرد، پس ترتیبِ شماره‌ها با ترتیبِ تاریخ جور نیست. ایجادِ جلسه‌ی زنده (`sessions.ts:136`) قفل نمی‌گیرد، پس اگر درست هم‌زمان با `complete`ِ همان مراجع اجرا شود، با خطایِ UNIQUE مواجه می‌شود و 500 برمی‌گرداند (احتمالش کم است). | `uploads.routes.ts:299-301` | CONFIRMED |

## ۳. کم‌اهمیت

- **L1** کلاینت هر فایلی با MIMEِ `audio/*` یا `video/*` را می‌پذیرد، حتی بدونِ پسوندِ مجاز. سرور فقط با پسوند تصمیم می‌گیرد و بعد از hash کردنِ فایل 415 برمی‌گرداند؛ مثلاً برای `.mpga`، `.m4r`، یا فایلِ بدونِ پسوندِ بعضی ضبط‌کننده‌ها. (`index.html` `onAudioUploadPicked` در برابرِ `uploads.routes.ts:128`)
- **L2** اگر دو تب باز باشد، هر دو همان کارِ IndexedDB را resume می‌کنند: پهنای‌باند دو برابر مصرف می‌شود و تبِ دوم ممکن است هشدارِ کاذبِ «قبلاً آپلود شده — دوباره ثبت نشد» بدهد.
- **L3** اگر همان فایل دو بار سریع پشتِ‌سرِ‌هم انتخاب شود، دو task هم‌زمان اجرا می‌شوند. چکِ `tasks[key].running` فقط وقتی کار می‌کند که taskِ اول به مرحله‌ی اجرا رسیده باشد (`feelia-upload.js:333`).
- **L4** بعد از `complete` و کرش پیش از commit، اگر تکه‌ها پاک شده باشند، سرور حداکثر ۵۰ تکه‌ی گم‌شده را فهرست می‌کند و کلاینت ۳ دور می‌فرستد. فایلِ بزرگ‌تر از حدودِ ۶۰۰MB به خطا می‌خورد، ولی دکمه‌ی «تلاشِ دوباره» آن را درست می‌کند.
- **L5** با خروج از حساب فقط XHRِ در جریان abort می‌شود. taskی که در حالِ hash یا `sleep` است ادامه می‌دهد و به 401/404 می‌خورد. داده‌ای نشت نمی‌کند.
- **L6** سقفِ هزینه‌ی Soniox برای هر تراپیست وجود ندارد (پنج فایلِ ۵ساعته هم‌زمان مجاز است).
- **L7** `size` فقط finite چک می‌شود، integer بودنش چک نمی‌شود. با عددِ اعشاری، آپلود هیچ‌وقت کامل نمی‌شود؛ فقط کلاینتِ مخرب چنین عددی می‌فرستد.

## ۴. تعارضِ آگاهانه که هنگامِ تست با تراپیستِ واقعی باید در نظر باشد
- متنِ privacy و رضایت در `index.html` هنوز می‌گوید صدا جایی ذخیره نمی‌شود، ولی این فیچر صدا را ۱۴ روز روی سرور نگه می‌دارد (و در صورتِ M5 در مرورگر هم). این نقضِ LAW-009 است که مالک آگاهانه پذیرفته (subsystem 06 §۹.۱). با تراپیستِ واقعی این یک مسئله‌ی اعتماد و رضایت است، نه باگِ فنی.

## ۵. چک‌لیستِ پیش از تست
1. deploy و اجرایِ migration 023 روی production (در `_migrations` چک شود).
2. کانفیگِ زنده‌ی nginx: `client_max_body_size` حداقل 5m برایِ `/api/uploads/*/chunks/*`، و `proxy_read_timeout` برابرِ 300s برایِ `complete`. بعد `nginx -t`.
3. روی production دستورِ `ffmpeg -hide_banner -encoders | grep libopus` اجرا شود.
4. `SONIOX_ORPHAN_SWEEP=1` در `.env`ِ ریشه‌ی production (پروسه‌ی زنده) تنظیم باشد. `UPLOAD_CASE_FILE` تنظیم نشده باشد.
5. فضایِ دیسکِ `data/` کافی باشد (برای هر آپلود: دو برابرِ حجمِ فایل + 512MB).
6. سناریوهای دستگاهِ واقعی: Voice Memoِ آیفون (m4a)، ضبط‌کننده‌ی اندروید، ویسِ واتس‌اپ (opus) و تلگرام (oga)، یک فایلِ بزرگِ بیش از ۵۰۰MB، حالتِ هواپیما وسطِ آپلود، رفرشِ صفحه وسطِ آپلود، انتخابِ دوباره‌ی همان فایل، فایلِ ساکت، فایلِ غیرصوتی با پسوندِ `.mp3`، خروج از حساب وسطِ آپلود، و حذفِ جلسه وسطِ پردازش.

## ۶. رفع‌ها (همان روز، دستورِ مالک «شروع کن به حل کردن»)

| # | وضعیت | تغییر |
|---|---|---|
| B1 | **رفع نشد (عملیاتی)** | به دسترسی و مجوزِ production (nginx، deploy، migration) نیاز دارد. چک‌لیستِ §۵ پابرجاست |
| B2 | رفع شد | `uploads.routes.ts`: وقتی jobِ آپلودِ قبلی `failed` است و قابلِ ادامه ⇒ همان job دوباره در صف می‌رود (`requeued:true`)؛ وقتی غیرقابلِ ادامه است ⇒ آپلودِ تازه مجاز است. منطقِ مشترکِ `failedJobRetryability` / `requeueFailedJob` با endpointِ retry. UI برای هر حالت پیامِ جدا دارد |
| B3 | رفع شد | کلاینت: `dismiss` در حالتِ خطا `DELETE /api/uploads/:id` می‌زند. سرور: پیش از 429، نیمه‌کاره‌هایِ بی‌فعالیت > ۲۴ساعتِ همان تراپیست `canceled`/`expired` می‌شوند |
| M1 | رفع شد | `jobMachine.ts`: شکستِ نهاییِ نرمال‌سازی ⇒ `normalize-failed` (قابلِ retry)، نه `unreadable` |
| M2 | رفع شد | `jobRunner.ts`: خطایِ غیرمنتظره با فاصله‌ی ۶۰ث×n؛ بعد از ۵ بار ⇒ `giveUpJob(…,'internal-error')` (failed + اعلان + پاک‌سازیِ Soniox) |
| M3 | رفع شد | `collectUploadSonioxRefs` پیش از DELETE و `releaseSonioxRefs` بعد از آن در هر ۴ مسیرِ حذف (`sessions.ts`، `clients.ts`، `admin.ts`×۲). `finally`ِ `runJob` هم منابعِ jobِ حذف‌شده‌ی در حالِ اجرا را پاک می‌کند |
| M4 | رفع شد | `archiveAudioFileForAdmin`: اگر ثبتِ ردیف شکست بخورد، فایلِ جابه‌جاشده (و پوشه‌ی خالی) پاک می‌شود |
| M5 | نیمه | persistِ دومِ IndexedDB حذف شد (ادامه با fingerprint). ذخیره‌ی خودِ فایل در مرورگر (طراحی) و ماندنش رویِ کامپیوترِ مشترک **رفع نشد** — تصمیمِ مالک لازم است |
| M6 | رفع شد | زیرِ تاریخِ پیش‌فرض در مودال توضیح داده می‌شود که از تاریخِ فایل آمده و ممکن است تاریخِ دریافت باشد |
| M7 | **رفع نشد** | شماره‌گذاری و raceِ ساختِ جلسه‌ی زنده به مسیرِ جلسه‌ی زنده (`sessions.ts`) مربوط است، خارج از این فیچر |
| L1 | رفع شد | سرور پسوندِ ناآشنا را با MIMEِ `audio/*`/`video/*` می‌پذیرد، هم‌راستا با کلاینت |
| L3 | رفع شد | `start`: کارِ در جریانِ همان فایل/مراجع (حتی پیش از `run`) دوباره ساخته نمی‌شود |
| L4 | رفع شد | `chunks-missing` فهرستِ کامل برمی‌گرداند (سقفِ ۵۰ حذف شد) |
| L5 | رفع شد | `setTherapist`: همه‌ی taskها `canceled` می‌شوند |
| L7 | رفع شد | `size` باید integer باشد |
| L2، L6 | رفع نشد | چندتب (نیازمندِ Web Locks) و سقفِ هزینه (تصمیمِ سیاستی) |

**رفتارِ تغییرکرده:** retryِ jobِ `unreadable` حالا حتی با وجودِ نسخه‌ی نرمال‌شده هم رد می‌شود (UI از قبل دکمه را برایش نشان نمی‌داد).

**تست‌ها:**
- `pnpm test:up` **29 PASS / 0 FAIL** (جدید: H27 برای M1، H28 برای M2)؛ `pnpm test:cf` 108/108؛ `tsc --noEmit` تمیز؛ `node --check public/feelia-upload.js` و parseِ اسکریپتِ inlineِ `index.html` بدونِ خطا.
- **UI در Browser pane** با mock backend در scratchpad (فایل‌هایِ واقعیِ `public/`، دادهٔ ساختگی، بدونِ حساب/DB):
  1. تاریخِ پیشنهادی و متنِ هشدار زیرش نمایش داده شد (M6).
  2. پاسخِ `requeued` ⇒ بنرِ «دوباره در صفِ پردازش قرار گرفت؛ جلسه‌ی تکراری ساخته نشد» (B2).
  3. خطایِ `bad-chunk-size` ⇒ «بستن» ⇒ `DELETE /api/uploads/<id>` ارسال شد (B3).
  4. دو `start` هم‌زمانِ همان فایل ⇒ یک task و یک `POST /api/uploads` (L3).
- **اجرا نشد:** مسیرهایِ SQLِ B2/B3/M2/M3/M4 رویِ MySQLِ واقعی (به حساب/fixture در DB نیاز دارد و مجوزش در این گفتگو داده نشده). منطقشان خوانده و type-check شد.

## ۷. تستِ واقعی رویِ MySQLِ dev + deploy به production (همان روز، مجوزِ صریحِ مالک: «کاملا اجازه میدم»)

### ۷.۱ E2E رویِ DBِ dev
ساختِ DBِ جدا ممکن نشد (کاربرِ `feelia` مجوزِ `CREATE DATABASE` ندارد). پس روی DBِ dev با fixtureِ ساختگی اجرا شد: یک تراپیستِ canary
بدونِ رمزِ قابلِ ورود و با ایمیلِ `.invalid`، که نشستش مستقیم با `createSession` ساخته شد. routeها درون‌پروسه با `fastify.inject` صدا زده شدند.
Soniox یک mockِ https محلی بود؛ هیچ درخواستی به Sonioxِ واقعی نرفت. jobهایِ fixture قفل (`locked_until`) یا `failed` بودند تا workerِ سرورِ dev
آن‌ها را برندارد. اسکریپت: `server/e2e-tmp/upload-fixes.e2e.ts` (بعد از اجرا حذف شد؛ کپی در scratchpad).

**13 PASS / 0 FAIL — fixtures remaining: 0**
L7، L1 (۲۰۱ و ۴۱۵)، B3 (آزادسازیِ بی‌فعالیت‌هایِ > ۲۴ساعت، و 429 برایِ تازه‌ها)، B2 (audio-expired ⇒ 201؛ unreadable ⇒ 201؛ soniox-unavailable ⇒
duplicate+requeued با حذفِ اعلانِ شکست و `batch_status=queued`؛ done ⇒ duplicate عادی)، retry (normalize-failed ⇒ 200؛ unreadable ⇒ 422؛ retryِ دوم ⇒ 409)،
L4 (`missing` ۶۰تایی)، M3 (حذفِ جلسه و حذفِ مراجع ⇒ `DELETE /v1/transcriptions/…` و `/v1/files/…` به mock رسید)، M4 (آرشیو برایِ جلسه‌ی ناموجود ⇒
خطا، بدونِ پوشه‌ی یتیم).
**تست‌نشده رویِ DB:** شمارنده‌ی خطایِ غیرمنتظره‌ی `runJob` (M2). workerِ سرورِ dev رقیب است و هر دور ۶۰ث×n طول می‌کشد. منطقش در H28
(`giveUpJob`) و با خواندنِ کد تأیید شد.

### ۷.۲ B1 — production
- **خواندنی:** `pm2` ⇒ `feelia-mysql` online. `nginx -T` ⇒ `client_max_body_size 50m`، `proxy_read_timeout 300s` ⇒ **تغییرِ nginx لازم نبود**.
  ffmpeg با libopus و aac. دیسک ۳۱G آزاد. آخرین migration ۰۲۲. در ۳ ساعتِ گذشته جلسه‌ی `in_progress` نبود (ساعت ~۳ بامدادِ تهران).
- **پیش‌آزمون:** `test:rt` بدونِ FAIL، `test:cf` 108/108، `test:up` 29/29، `tsc` تمیز، build.
- **backup:** DB با `/root/backups/feelia-pre-023-2026-09-23T23-46-50-057Z.sql` (205KB، «Dump completed»)،
  کدِ قبلی با `/root/backups/code-before-upload-20260923T234813Z.tar.gz`، `.env`ِ قبلی با `/root/backups/env-before-upload-*` (همه 600).
- **deploy:** تارِ `server/ public/ package.json pnpm-lock.yaml pnpm-workspace.yaml` (بدونِ `.env`/`data`/`node_modules`، تأییدشده) ⇒ استخراج در
  `/root/feeliaa-mysql` ⇒ `pnpm install --frozen-lockfile` (بدونِ تغییر) ⇒ `SONIOX_ORPHAN_SWEEP=1` به `.env` افزوده شد ⇒ `pm2 restart feelia-mysql --update-env`.
  ⚠ کلِ working tree deploy شد، یعنی همه‌ی تغییراتِ commit‌نشده‌ی فیچرِ آپلود و رفع‌هایِ F1–F8 (batchqueue، asyncTranscribe، CASِ پرونده، …).
- **dry-runِ sweep پیش از فعال‌سازی:** ۲۳ transcription و ۸ فایل روی Soniox؛ کاندیدِ حذف فقط ۱+۱ (از 2026-09-16). بعد از ری‌استارت در لاگ:
  `swept orphans transcriptions=1 files=1`.
- **نتیجه:** `023_audio_upload_pipeline.sql applied`؛ health `ok/connected`؛ سه جدولِ جدید، CHECKِ `source` با `upload`، و دو ستونِ جدید موجودند.
  `feelia-upload.js` 200. `index.html` شاملِ مودال است. `POST /api/uploads` و `GET /api/audio-jobs` بدونِ نشست 401 دادند. PUTِ ۴MB از مسیرِ nginx ⇒ 401 (نه 413).
  پروسه online است (restarts=5، ۱۲۰MB)، stderr فقط هشدارِ قدیمیِ FSTDEP023.
- **rollback (اگر لازم شد):** استخراجِ `code-before-upload-*.tar.gz` در `/root/feeliaa-mysql` و `pm2 restart`. جدول‌هایِ 023 بی‌ضررند و می‌مانند.
  برگرداندنِ DB فقط با مجوز و از روی dump.
- **انجام نشد:** آپلودِ واقعی روی production (به حسابِ تراپیست نیاز دارد). این اولین قدمِ تستِ مالک است.

## ۸. رفعِ موارد باقی‌مانده (M5، M7، L2، L6) + deployِ دوم (همان روز، دستورِ مالک: «همشون رو رفع کن … هیچ دیتایی از بین نره»)

**اصل:** هیچ رفعی داده‌ای را حذف یا بازنویسی نمی‌کند. سقف ⇒ صف، نه رد. شماره‌ی جلسه‌هایِ موجود عوض نمی‌شود. پاک‌کردنِ مرورگر فقط با انتخابِ صریحِ تراپیست و فقط برایِ نسخه‌ی کپی انجام می‌شود.

| # | رفع | فایل |
|---|---|---|
| M5 | خروج با آپلودِ ناتمام ⇒ مودالِ سه‌گزینه‌ای (بماند / پاک شود / ماندن)؛ `localPendingCount`/`purgeLocal`. آپلودِ سرور لغو نمی‌شود | `feelia-upload.js`، `index.html` |
| M7 | شماره‌گذاریِ دوباره عمداً **نه**. raceِ ساختِ هم‌زمان: retry با jitter تا ۱۵ بار در زنده، دستی و `complete` (`isSessionNumConflict`) | `sessions.ts`، `uploads.routes.ts` |
| L2 | Web Locks برای هر فایل + حالتِ `other-tab` + takeover با بسته‌شدنِ تب + لغو با BroadcastChannel | `feelia-upload.js`، `index.html` |
| L6 | `quotaWaitMs` (port) و `quotaWaitMsForJob` (SQL)، `UPLOAD_DAILY_AUDIO_MINUTES` پیش‌فرض ۶۰۰؛ `quota-wait` = صف | `jobMachine.ts`، `jobRunner.ts`، `index.html` |
| — | `upload-closed` در میانه‌ی آپلود ⇒ شروعِ دوباره با آپلودِ تازه، نه پاک‌کردنِ نسخه‌ی IndexedDB | `feelia-upload.js` |
| — | پیامِ «سرویس در دسترس نیست» بعد از رفعِ خطایِ گذرا پاک می‌شود (`errorCode:null` در poll و create) | `jobMachine.ts` |

**تست‌ها:**
- `test:up` **31/31** (جدید H29 و H30 برای L6)، `test:cf` 108/108، `test:rt` 55 PASS / 0 FAIL، `tsc` تمیز، parseِ JS و HTML بدونِ خطا.
- **E2E رویِ DBِ dev** (fixtureِ canary، پاک‌سازی کامل). M7: ۱۰ ساختِ هم‌زمان (۶ زنده و ۴ دستی با یادداشت) ⇒ همه 201، شماره‌ها ۱..۱۰، ۴ یادداشت سالم. دورِ اول با سقفِ ۵ تلاش 5 تا 500 داد ⇒ سقف ۱۵ و jitter اضافه شد ⇒ ۳ اجرایِ پشتِ‌سرِ‌هم 4/4. L6: بدونِ مصرف ⇒ ۰؛ ۵۹۰+۲۰ ⇒ ۳۰ دقیقه صبر؛ ۵۹۰+۵ ⇒ ۰؛ مصرفِ قدیمی‌تر از ۲۴ساعت ⇒ ۰؛ `=0` ⇒ بدونِ سقف.
- **UI در Browser pane** (mock با حالتِ hold/release، دو تبِ واقعی):
  - L2: تبِ B ⇒ `other-tab` با پیامِ درست؛ یک POST و فقط PUTهایِ تبِ A؛ بعد از پایانِ A، کارتِ B بی‌صدا حذف شد (بدونِ بنرِ کاذب).
  - Takeover: بستنِ تبِ A وسطِ آپلود ⇒ تبِ B خودش ادامه داد و «دریافت شد» را نشان داد.
  - M5: مودال با «۱ فایلِ صوتی…» باز شد. «بماند» ⇒ رکوردِ IndexedDB ماند، logout انجام شد، DELETEِ سرور نه. بعد از ورود ⇒ resume شد. «پاک شود» ⇒ IndexedDB و حافظه خالی، DELETEِ سرور نه. بدونِ آپلودِ ناتمام ⇒ مودالی نیامد.
  - سینیِ باز رویِ مودال را می‌پوشاند ⇒ `closeTray()` پیش از باز شدنِ مودال اضافه شد.
  - اسکرین‌شاتِ مودال ممکن نشد (پنجره minimize بود)؛ متن و وضعیت با DOM تأیید شد.
- **deployِ دوم به production:** پیش از آن جلسه‌ی زنده، آپلود یا jobِ فعال نبود. در production یک jobِ واقعیِ مالک پیش‌تر موفق تمام شده بود (`transcript applied chars=959`).
  - backup: `/root/backups/code-before-upload2-*.tar.gz`
  - migrationی نبود (023 already applied). health ok، online (restarts=6، ۱۱۲MB).
  - کدِ جدید سرو می‌شود: `withTaskLock` و `purgeLocal` در JS، مودال در HTML، quota و retry در dist.
- **FINDING (نامرتبط، بررسی نشد):** در لاگِ production چند `[soniox] error from service … "No audio received."` (400) از مسیرِ رونویسیِ زنده دیده شد.
