# Error Code Catalog

> **وضعیت:** ACTIVE-CANONICAL · منبع: `server/src/**`، `public/feelia-rt.js`، `public/index.html` · موارد استنباطی برچسب دارند.

## ۱. قرارداد

- HTTP: `reply.code(status)` + `{ "error": "<پیامِ فارسیِ قابلِ نمایش>", "code"?: "<machine-code>" }`.
- اکثرِ خطاها `code` ندارند؛ کلاینت باید روی **status** تصمیم بگیرد و فقط در موارد زیر روی `code`.
- پیام‌های فارسی قرارداد نیستند و ممکن است تغییر کنند؛ **استثنای خطرناک:** `liveResumeSession` در UI برای تشخیصِ «حذف‌شده» روی زیررشته‌ی `'یافت نشد'` تصمیم می‌گیرد.
- `api()` در `index.html` و `reqJson()` در `feelia-rt.js` خطا را با `err.status` و `err.code` می‌سازند.

## ۲. کدهای ماشینیِ HTTP

| code | status | منبع | معنا | رفتارِ کلاینت |
|---|---|---|---|---|
| `unauthorized` | 401 | `auth/guard.ts` | نشستِ معتبر نیست | RT: FAILED «نشست منقضی»؛ UI: پیامِ ورودِ دوباره |
| `forbidden` | 403 | `requireAdmin` | ادمین نیست | نمایشِ پیام |
| `version-conflict` | 409 | `PUT /api/sessions/:id` (+ `current_version`) | CAS شکست خورد | `persistConfirmed`: GET → اگر سرور طولانی‌تر/برابر، سرور برنده؛ وگرنه یک PUT دیگر با نسخه‌ی تازه |
| `client-inactive` | 409 | `POST /api/sessions` (mode زنده) | مراجع غیرفعال است؛ جلسه‌ی زنده‌ی جدید ساخته نمی‌شود (ادامه‌ی جلسه‌ی نیمه‌تمامِ قبلی و `mode:"manual"` آزادند) | UI: بنرِ خطا؛ در حالتِ عادی رخ نمی‌دهد چون کارت و پرونده برای مراجعِ غیرفعال دکمه‌ی شروع ندارند |
| `no-key` | 500 (realtime-session) / 200 `ok:false` (check) | `stt.ts`، `tempkey.ts` | `SONIOX_API_KEY` تنظیم نیست | durable-only |
| `version-conflict` (پرونده) | 409 | PATCH/items/DELETE/upgradeِ case-file (2026-09-23) | CASِ `content_version` بعد از ۵ تلاش | UI: پیامِ خطا؛ کاربر دوباره تلاش می‌کند |
| `consent-required`، `file-too-small`، `bad-fingerprint` | 400 | `POST /api/uploads` (و `consent-required` از 2026-09-24 در `POST /api/sessions` زنده هم؛ فقط وقتی مراجع رضایتِ ثبت‌شده ندارد) | ورودیِ نامعتبر | UP: خطایِ دائمی (فایل رها می‌شود) |
| `file-too-large` | 413 | همان | > ۱GB | همان |
| `unsupported-format` | 415 | همان | پسوند خارج از allowlist و MIMEِ غیرِ `audio/*`/`video/*` (2026-09-24) | همان |
| `too-many-uploads` | 429 | همان | > ۵ آپلودِ نیمه‌کاره، بعد از آزادسازیِ خودکارِ نیمه‌کاره‌هایِ بی‌فعالیت > ۲۴ساعت (2026-09-24) | UP: خطا با امکانِ تلاشِ دوباره؛ «بستنِ» کارتِ خطا حالا آپلودِ سرور را هم لغو می‌کند |
| `server-storage-full` | 507 | همان | فضایِ دیسک < ۲×حجم + ۵۱۲MB | همان |
| `bad-chunk-index`، `bad-chunk-size` | 400 | `PUT …/chunks/:n` | شماره/حجمِ تکه نادرست | UP: خطا |
| `chunk-corrupt` | 422 | همان | sha256 نخورد | UP: همان تکه دوباره |
| `upload-closed` | 409 | chunks/complete/DELETE | آپلود دیگر `uploading` نیست | UP: خطایِ دائمی |
| `chunks-missing` | 409 | `complete` (+`missing[]`) | تکه‌ای نرسیده | UP: همان تکه‌ها و دوباره complete |
| `bad-part` | 400 | `POST /api/uploads` (چندبخشی، 2026-09-25) | `group_id`/`part_index`/`parts_total` نامعتبر (بیش از ۱۰ بخش، …) | UP: خطایِ دائمی، کلِ گروه لغو |
| `part-mismatch` | 409 | همان | همان بخشِ همان گروه قبلاً با فایلِ دیگری شروع شده | همان |
| `group-closed` | 409 | `POST /api/uploads`، `complete` | بخشی از گروه رد (`failed`) یا لغو شده است | همان — «فایل‌ها را دوباره انتخاب کنید» |
| `not-audio`، `no-audio`، `unreadable`، `too-long` | 422 | `complete` (و `error_code`ِ job) | فایل صوتی نیست / بی‌صدا / خراب / > ۳۰۰ دقیقه | UI: پیامِ فارسی، بدونِ «تلاشِ دوباره» |
| `assemble-failed` | 500 | `complete` | الحاقِ تکه‌ها رویِ دیسک ناموفق | UP: تلاشِ دوباره |
| `not-failed` | 409 | `POST /api/audio-jobs/:id/retry` | job در جریان/تمام‌شده | — |
| `audio-expired` | 410 | همان (و `error_code`ِ job) | صدا دیگر رویِ سرور نیست (۱۴ روز) | UI: «دوباره آپلود کنید» |

**`audio_jobs.error_code`** (در `notifications.error_code` هم): `soniox-unavailable`، `soniox-error`، `soniox-timeout`، `soniox-lost`، `soniox-unknown-status`، `no-ffmpeg`، `normalize-failed` (گذرا — retryِ خودکار، بعد از ۳ شکست `failed` با همین کد و قابلِ «تلاشِ دوباره»؛ پیش از 2026-09-24 به `unreadable` تبدیل می‌شد)، `quota-wait` (2026-09-24، رفعِ L6: **خطا نیست** — job در `transcribing` منتظرِ آزادشدنِ سقفِ روزانه است؛ UI پیامِ «خودکار ادامه می‌یابد»)، `internal-error` (2026-09-24: ۵ خطایِ غیرمنتظره‌ی پشتِ‌سرِ‌همِ worker ⇒ `failed`، قابلِ «تلاشِ دوباره»)؛ `no-audio`، `unreadable`، `too-long`، `audio-missing`، `audio-expired` (دائمی). نگاشتِ فارسی: `PROC_ERR` در `index.html`.
| `mint-transport` | 503 | `tempkey.ts` | DNS/TCP/TLS به Soniox | durable-only / reconnect |
| `mint-timeout` | 503 | `tempkey.ts` | >10s | همان |
| `mint-rejected` | 502 | `tempkey.ts` | Soniox رد کرد (کلید/سقف) | همان |
| `mint-ok` | 200 | `/api/stt/check` | سالم | — |
| ~~`proxy-unknown` / `proxy-transport` / `proxy-soniox-error`~~ | — | — | **حذف شد 2026-09-24** همراهِ probeِ legacyِ `/api/stt/check` | — |
| `llm-failed` | 502 | `case-file/domain/errors.ts` (`CaseFileGenerationError`) | فراخوانیِ OpenAI ناموفق (شبکه/کلید/rate-limit) یا `OPENAI_API_KEY` تنظیم نشده | UI: پیامِ خطا + دکمه‌ی تلاشِ دوباره؛ `client_case_file.status='error'` |
| `llm-invalid-output` | 502 | همان | پاسخِ خالی یا JSONِ نامعتبر/ناسازگار با schema | همان |
| `unknown` (case-file) | 502 | همان | خطایِ دیگر در `generateCaseFile` | همان |
| `obs-bad-payload` | 400 | `POST /api/obs/events` | بدنه/آرایه‌ی `events` نامعتبر (خالی، >۲۰۰ عضو، یا شکلِ اشتباه) | `feelia-obs.js`: این batch دور ریخته می‌شود (بدونِ retry فوری، منتظرِ flushِ بعدی) |
| `obs-rate-limited` | 429 | `POST /api/obs/events` | >۲۰ درخواست یا >۱۵۰۰ رویداد/دقیقه به‌ازایِ تراپیست | `feelia-obs.js`: بافر خالی می‌شود + backoff |

## ۳. statusهای بدونِ code

| status | کجا | معنا |
|---|---|---|
| 400 | اعتبارسنجی‌ها (auth، clients، sessions، batch، resolve، admin، case-file) | ورودیِ نامعتبر / وضعیتِ نامجاز (مثلاً «جلسه پایان یافته است»، «صوتی در صف نیست»، `fieldId`/`action`ِ نامعتبرِ PATCH case-file)؛ **(D3، 2026-09-15)** `register` بدونِ نام/تخصص یا با طولِ >۱۰۰ → «نام الزامی است» / «تخصص الزامی است» (فقط ثبت‌نامِ جدید؛ `login`/`me` بدونِ تغییر) |
| 401 | `/api/auth/login` (اعتبارِ غلط)، `/api/auth/me` | — |
| 403 | login حسابِ غیرفعال | «این حساب غیرفعال شده است» |
| 404 | منبعِ غیرموجود **یا غیرمالک** (LAW-004)؛ GET resolve-speakers بدونِ job | — |
| 409 | register شماره‌ی تکراری | — |
| 413 | آپلودِ فایلی بزرگ‌تر از **1MiB**: `@fastify/multipart@10.1.1` پیش‌فرضِ `fileSize` را برابرِ `bodyLimit` فاستیفای می‌گذارد و `index.ts` هیچ‌کدام را تنظیم نکرده (تأییدشده از `node_modules`، 2026-09-13). بنابراین چکِ 50MB در `voice-note`/`batch-audio` عملاً دست‌نیافتنی است. کدِ دقیقِ پاسخ (413 از `RequestFileTooLargeError`) **INFERRED**؛ سقفِ nginx هم ممکن است زودتر اعمال شود | پیامِ غیرقراردادی؛ در `drainQueuedAudioInBackground` پاسخِ غیر-ok/غیر-400 یعنی سگمنت در صف می‌ماند |
| 429 | `/api/stt/realtime-session` | >30 mint/دقیقه |
| 500 | voice-note بدونِ کلید؛ خطای ناگرفته (مثلاً **INFERRED:** UUID نامعتبر در پارامتر → خطای pg `22P02`) | پاسخِ پیش‌فرضِ Fastify |
| 202 | voice-note، batch-audio، resolve-speakers POST | پذیرفته، پردازش در پس‌زمینه |

## ۴. خطاهای سمتِ کلاینت (FeeliaRT)

| مقدار | منبع | معنا |
|---|---|---|
| `request-timeout` (`status=0`) | `reqJson` | fetch بیش از 12s |
| `direct-timeout` | `openDirectWS` | WS در 10s باز نشد |
| `direct-error` | `openDirectWS` | خطای WS قبل از open |
| `superseded` | `openDirectWS` | open دیررس بعد از finish/abort |
| Soniox `temp_api_key_session_expired` | `handleSonioxMessage` | سقفِ جلسه‌ی کلید → reconnect با mint تازه |
| هر `error_code/error_type` دیگرِ Soniox | همان | `unreliable=true` + reconnect |
| `no-indexeddb`، `indexeddb-*` | `AudioQueueDB` | صف در دسترس نیست → `add` false → `onError` «فضایِ ذخیره‌ی محلیِ صدا پر شده» (پیامِ گمراه‌کننده در این حالت — **INFERRED**) |

## ۵. پیام‌های WS (legacy)
`{"type":"error","message"}` بدونِ code — [api-catalog §8](api-catalog.md).

## ۶. mapping خطاهای میکروفون (UI)
`describeMicError` برای `NotAllowedError`، `PermissionDeniedError`، `NotFoundError`، `DevicesNotFoundError`، `NotReadableError`، `TrackStartError`، `OverconstrainedError`، `ConstraintNotSatisfiedError`، `AbortError`، `SecurityError`، `NotSupportedError`، `TypeError`، WebView و non-secure context پیامِ فارسیِ متفاوت دارد. Clarity فقط نامِ خطا از همین allowlist را ارسال می‌کند.
