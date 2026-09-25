# Configuration Catalog

> **وضعیت:** ACTIVE-CANONICAL (مالکِ env، ثابت‌ها، کلیدهای storage) · منبع: grepِ `process.env` در `server/src` و ثابت‌های کد · Snapshot 2026-09-13.
> مقدارِ هیچ secretی در این سند نیست.

## ۱. متغیرهای محیطی (سرور)

`.env` با `import 'dotenv/config'` از **cwd پروسه** خوانده می‌شود.

| متغیر | استفاده | پیش‌فرض | الزامی | Secret | اثر |
|---|---|---|---|---|---|
| `DATABASE_URL` | `db/connection.ts` | فرمتِ MySQL: `mysql://user:pass@host:port/db` (تا 2026-09-15 فرمتِ PostgreSQL بود؛ مهاجرت به MySQL به دستورِ صریحِ مالک — [PROJECT_STATUS](../../PROJECT_STATUS.md) §7) | عملاً بله | **بله** | اتصالِ mysql2 (قبلاً pg) |
| `PORT` | `index.ts` | `3000` | خیر | خیر | پورتِ listen (همیشه `0.0.0.0`) |
| `SONIOX_API_KEY` | `http/stt.ts`، `http/sessions.ts`، `stt/tempkey.ts`، `stt/asyncTranscribe.ts`، `stt/batchqueue.ts`، `ws/transcription.ts` | — | برای STT بله | **بله** | نبود → `no-key`؛ batch `failed` |
| `SONIOX_API_BASE` | `stt/tempkey.ts`، `stt/asyncTranscribe.ts` | `https://api.soniox.com` | خیر | خیر | base REST |
| `SONIOX_WS_URL` | `stt/tempkey.ts` | `wss://stt-rt.soniox.com/transcribe-websocket` | خیر | خیر | URLِ برگشتی به مرورگر؛ **`stt/soniox.ts` از آن استفاده نمی‌کند** (URL ثابت) |
| `PROXY_URL` | `stt/tempkey.ts`، `stt/asyncTranscribe.ts`، `stt/soniox.ts` | — | خیر | ممکن است credential داشته باشد | egressِ سرور به Soniox |
| `ADMIN_PHONE` | `http/auth.ts` | — | خیر | نیمه‌حساس | شماره‌ای که در register/login ادمین می‌شود |
| `CLARITY_PROJECT_ID` | `http/clientConfig.ts` | — (خاموش) | خیر | خیر | باید `^[a-z0-9]{6,20}$`؛ فقط در production |
| `FFMPEG_PATH` | `stt/speakerResolve.ts`، `stt/sessionAudioArchive.ts`، `features/audio-upload/media.ts` | `ffmpeg` | برایِ آپلودِ فایلِ صوتی عملاً بله | خیر | باینریِ ffmpeg؛ نبودش ⇒ jobِ آپلود با `no-ffmpeg` در backoff می‌ماند |
| `SONIOX_ORPHAN_SWEEP` | `features/audio-upload/jobRunner.ts` | خاموش | **رویِ production: `1`** (در `/root/feeliaa-mysql/.env` ست شد 2026-09-24؛ dry-run پیش از آن: ۱ transcription + ۱ فایلِ یتیمِ 2026-09-16) | خیر | **جدید 2026-09-23.** فقط `1` پاک‌سازیِ فایل/transcriptionِ یتیمِ فیلیا رویِ Soniox را فعال می‌کند. رویِ dev عمداً خاموش — کلیدِ Soniox بینِ dev و production مشترک است و DBِ dev از jobهایِ زنده‌ی production خبر ندارد |
| `UPLOAD_DAILY_AUDIO_MINUTES` | `features/audio-upload/jobRunner.ts` (`quotaWaitMsForJob`) | `600` | ست نشده (پیش‌فرض ۶۰۰) | خیر | **جدید 2026-09-24 (رفعِ L6).** سقفِ دقیقه‌ی صدایِ رونویسی‌شده‌ی آپلودی برایِ هر تراپیست در ۲۴ ساعتِ غلتان. بیش از آن ⇒ job **صف می‌ماند** (`error_code='quota-wait'`، چکِ دوباره هر ۳۰ دقیقه) — هرگز رد/failed نمی‌شود؛ اولین job همیشه اجرا می‌شود؛ `0` ⇒ بدونِ سقف |
| `UPLOAD_CASE_FILE` | `features/audio-upload/jobMachine.ts#uploadCaseFileEnabled` | خاموش | خیر | خیر | **جدید 2026-09-24 (تصمیمِ مالک).** مسیرِ آپلودِ فایلِ صوتی برایِ مراجعِ فعال و غیرفعال با «ذخیره‌ی متن» تمام می‌شود (`audio_jobs.case_file_status='disabled'`)؛ فقط `1` مرحله‌ی پرونده را بعد از متن روشن می‌کند (UI هم ثابتِ `UPLOAD_SHOW_CASE_FILE_STEP` در `index.html` را دارد که باید هم‌زمان `true` شود). فقط مراجعِ غیرفعال را می‌خواهید؟ ⇒ `UPLOAD_CASE_FILE_INACTIVE` |
| `UPLOAD_CASE_FILE_INACTIVE` | `features/audio-upload/jobMachine.ts#uploadCaseFileInactiveEnabled` | خاموش | خیر | خیر | **جدید 2026-09-25 (تصمیمِ مالک: «فعلاً متن»).** فقط `1` ⇒ آپلودِ مراجعِ **غیرفعال** بعد از متن پرونده را هم به‌روز می‌کند، به شرطِ `case_file_enabled` و `case_file_auto_generate=true` برایِ آن تراپیست (`uploadCaseFileAllowed`). مراجعِ فعال اثر نمی‌گیرد. UI خودکار از `case_file_planned` پیروی می‌کند. نیازمندِ ری‌استارت |
| `CASE_FILE_AUTO_ACTIVE_CLIENTS` | `features/case-file/application/autoTrigger.ts` | خاموش | خیر | خیر | **جدید 2026-09-23 (پی‌ریزی، تصمیمِ مالک «الان نه»).** `1` ⇒ تولیدِ خودکارِ پرونده برایِ مراجعِ **فعال** هم (امروز فقط غیرفعال) |
| `OPENAI_API_KEY` | `features/case-file/adapters/llm/openai.adapter.ts` | — | فقط اگر `LLM_PROVIDER=openai` | **بله** | نبود → 502 `llm-failed` روی regenerate |
| `OPENAI_CASE_FILE_MODEL` | همان | — (عمداً بدونِ fallbackِ hardcode‌شده — تصمیمِ مالک) | **الزامی** اگر `LLM_PROVIDER=openai` | خیر | نبود → 502 `llm-failed` روی regenerate |
| `OPENROUTER_API_KEY` | `features/case-file/adapters/llm/openrouter.adapter.ts` | — | فقط اگر `LLM_PROVIDER=openrouter` | **بله** | نبود → 502 `llm-failed` روی regenerate |
| `OPENROUTER_MODEL` | همان | — (عمداً بدونِ fallbackِ hardcode‌شده — تصمیمِ مالک) | **الزامی** اگر `LLM_PROVIDER=openrouter` | خیر | شناسه‌ی مدلِ OpenRouter (فرمتِ `<provider>/<model>`)؛ نبود → 502 `llm-failed` |
| `OPENROUTER_SITE_URL` | همان | `https://feelia.ir` | خیر | خیر | هدرِ `HTTP-Referer` — فقط شناساییِ اپ در داشبوردِ OpenRouter، بدونِ دیتایِ کاربر |
| `OPENROUTER_REASONING_EFFORT` | همان | `low` | خیر | خیر | سقفِ «فکرِ پنهان» (reasoning) مدل: `minimal`|`low`|`medium`|`high` یا `default` (هیچ پارامتری نفرست). دلیل (2026-09-20، دادهٔ ساختگی): بدونِ سقف یک اجرا ۱۴٬۱۳۲ توکنِ reasoning داشت و ۷۸۹ث طول کشید؛ با `low` ۱۸۴ث. مقدارِ نامعتبر ⇒ خطای `llm-failed`. |
| `LLM_PROVIDER` | `features/case-file/adapters/llm/registry.ts` | `openai` | خیر | خیر | `openai` یا `openrouter`؛ مقدارِ دیگر → throw |
| `LOG_LEVEL` | `index.ts` (سطحِ لاگرِ Fastify) | `info` | خیر | خیر | **جدید، فازِ ۱ِ رصد/حسابرسی، 2026-09-22** — قبلاً `logger:true` هارد بود |
| `OBS_SLOW_MS` | `obs/httpHook.ts` | `1500` | خیر | خیر | آستانه‌ی «کند» برایِ ثبتِ `http.request` در DB (پایین‌ترش فقط در JSONL می‌ماند) |
| `OBS_EVENTS_RETENTION_DAYS` | `obs/sweep.ts` | `180` | خیر | خیر | نگهداریِ `obs_events` |
| `OBS_UI_RETENTION_DAYS` | `obs/sweep.ts` | `30` | خیر | خیر | نگهداریِ `obs_ui_events` |
| `OBS_CLIENT_ENABLED` | `http/clientConfig.ts` | `true` (هر مقدارِ غیرِ `'false'`) | خیر | خیر | کلیدِ سراسریِ روشن/خاموشِ `FeeliaObs` (شاملِ ادمین) |
| `OBS_CLIENT_SAMPLE` | `http/clientConfig.ts` | `1` | خیر | خیر | نرخِ نمونه‌برداریِ per-page-load (۰ تا ۱) |
| `OBS_LOG_MAX_BYTES` | `obs/fileSink.ts` | `8388608` (۸MB) | خیر | خیر | **پیاده‌سازی‌شده 2026-09-23.** سقفِ حجمِ هر فایلِ `obs.jsonl`/`obs.jsonl.N` پیش از rotate؛ مقدارِ نامعتبر/۰/منفی/NaN → fallback به ۸MB. تعدادِ فایل‌ها (`KEEP=5`) ثابت است و از env نمی‌آید. |

کلیدهای موجود در `server/.env` محلی ولی **بدونِ استفاده در کد:** `AUTH_PASSWORD` (C8). `PROXY_URL` در آن comment شده است.

## ۲. ثابت‌های سرور

| ثابت | مقدار | فایل |
|---|---|---|
| `SESSION_COOKIE` / `SESSION_COOKIE_MAX_AGE` | `feelia_session` / ۳۰ روز | `auth/guard.ts` |
| `SESSION_TTL_MS` | ۳۰ روز | `auth/session.ts` |
| scrypt `KEY_LEN` | 64 | `auth/password.ts` |
| mint rate limit | ۳۰/۶۰s per therapist | `http/stt.ts` |
| `STT_DEFAULTS` | model `stt-rt-v5`، …، `enable_endpoint_detection:true` (از 2026-09-14؛ قبلاً false) | `http/stt.ts` |
| `TEMP_KEY_EXPIRES_IN_SECONDS` / `TEMP_KEY_MAX_SESSION_SECONDS` / `MINT_TIMEOUT_MS` | 120 / 7200 / 10000 | `stt/tempkey.ts` |
| `QUEUE_DIR` / `MAX_AUDIO_BYTES` / `RETENTION_MS` | `<cwd>/data/batch-queue` / 50MB / ۲۴h | `stt/batchqueue.ts` |
| `ARCHIVE_DIR` / `RETENTION_MS` | `<cwd>/data/session-audio` / ۱۴ روز | `stt/sessionAudioArchive.ts` |
| JSONLِ obs: `MAX_BYTES` / `KEEP` | 8MB / 5 (سقفِ دیسک ~۴۸MB، `<cwd>/data/logs/obs.jsonl[.1..5]`) | `obs/fileSink.ts` |
| صفِ obs: `MAX_QUEUE` / `DRAIN_BATCH` / درین هر `2s` (یا `30s` وقتِ خرابیِ DB) | 2000 / 200 | `obs/eventLog.ts` |
| obs rate-limit | ۲۰ درخواست + ۱۵۰۰ رویداد/دقیقه به‌ازایِ تراپیست | `http/obs.ts` |
| `FeeliaObs`: `MAX_BUF` / `BATCH_MAX` / flush دوره‌ای | 200 / 50 / ۱۵ثانیه | `public/feelia-obs.js` |
| `FeeliaObs` backoff | [5s, 15s, 60s, 300s]، reset روی هر 2xx | `public/feelia-obs.js` |
| `POLL_INTERVAL_MS` / سقفِ poll / timeoutِ درخواست | 2000 / **۱۰ دقیقه + ۱ دقیقه به ازایِ هر MB** (`pollTimeoutForBytes`، رفعِ F2، 2026-09-23؛ قبلاً ثابتِ ۱۰ دقیقه) / 20000 (آپلودِ stream: 60000 idle) | `stt/asyncTranscribe.ts` |
| آپلودِ فایلِ صوتی: `CHUNK_SIZE` / `MAX_UPLOAD_BYTES` / `MAX_ACTIVE_UPLOADS_PER_THERAPIST` / نگهداریِ نیمه‌کاره | ۴MB / ۱GB (تصمیمِ مالک) / ۵ / ۷ روز | `features/audio-upload/uploadStore.ts` (2026-09-23) |
| `MAX_DURATION_MS` | ۳۰۰ دقیقه (سقفِ Soniox؛ تصمیمِ مالک) | `features/audio-upload/media.ts` |
| نرمال‌سازی | Opus/Ogg mono 16kHz 32kbps (fallback AAC/M4A 48kbps)؛ timeout = max(۵ دقیقه، طولِ صدا/۱۰) | `media.ts` |
| workerِ jobها: tick / هم‌زمانی / lease / heartbeat | ۳s / ۲ / ۲۰ دقیقه / ۶۰s | `features/audio-upload/jobRunner.ts` |
| `BACKOFF_MS` / `MAX_ATTEMPTS` / busyِ پرونده | [30s, 2m, 10m, 30m, 1h, 3h] / 6 / هر ۲ دقیقه تا ۱۵ بار | `features/audio-upload/jobMachine.ts` |
| `CHEAP_RETRY_MS` / `CHEAP_MAX_ATTEMPTS` (2026-09-24) | 20s ثابت / 90 (~۳۰ دقیقه) — فقط وقتی transcription رویِ Soniox ساخته شده و poll/دریافتِ متن شکست خورده؛ در startupِ worker هم `next_attempt_at` ِ این jobها حداکثر NOW+20s می‌شود | `jobMachine.ts`، `jobRunner.ts#startAudioJobWorker` |
| تکرارِ خطایِ شبکه‌ایِ درخواستِ Soniox (2026-09-24) | فقط GET/DELETE: ۳ تکرار با [1s, 2s, 4s] رویِ خطایِ سطحِ شبکه (TLS/socket/timeout/…)؛ POST هرگز | `stt/asyncTranscribe.ts#request` |
| مهلتِ یک transcription | ۳۰ دقیقه + طولِ صدا | `jobMachine.ts#transcriptionDeadlineMs` |
| sweeps (2026-09-23) | آپلودهایِ رهاشده/یتیم: ساعتی + startup؛ اعلان‌ها: روزانه (نگهداری ۳۰ روز)؛ یتیم‌هایِ Soniox: startup + هر ۶ ساعت (فقط با `SONIOX_ORPHAN_SWEEP=1`، آستانه‌ی ۲۴ ساعت) | `index.ts` |
| ffmpeg timeout / پاکسازیِ job | ۵ دقیقه / ۲ ساعت | `stt/speakerResolve.ts` |
| موتورِ سرور: `RECONNECT_BASE_DELAY`، `MAX_RECONNECT`، `CONNECT_TIMEOUT`، `FINALIZE_TIMEOUT`، `MAX_BUFFER_CHUNKS` | 1000، 6، 8000، 8000، 200 | `stt/soniox.ts` |
| `P1_PARAMS` | GRACE 60s، REORDER 2s، HANDOVER 5s، BUFFER_MAX 100، FORWARDED_SET_MAX 2000 | `ws/p1.ts` |
| voice-note حجم | 100B–50MB | `http/sessions.ts` |
| slow query log | >100ms | `db/connection.ts` |
| sweep intervals | ۲۴h (audio)، ۱h (resolve jobs)، **۱h (صفِ batch — `BATCH_SWEEP_INTERVAL_MS`، commitنشده 2026-09-23؛ قبلاً فقط startup)** | `index.ts`؛ ثابت در `stt/batchqueue.ts` |
| multipart `fileSize` | **commitنشده (audit صدا/۲۰۲۶-۰۹-۱۶): ۱۰MB صریح** (`register(multipart, { limits: { fileSize: 10*1024*1024 } })`) — قبلاً ۱MiB عملی (`bodyLimit` پیش‌فرضِ Fastify، تأییدشده در `@fastify/multipart@10.1.1`) که سگمنت‌هایِ صوتیِ بزرگ‌تر را با ۴۱۳ رد می‌کرد | `index.ts`؛ پیامد: [platform plan](../06-platform/implementation-plan.md) |
| workerِ دوره‌ایِ retryِ صفِ batch | commitنشده — هر ۵ دقیقه (`setInterval`) + سرِ startup | `index.ts` → `stt/batchqueue.ts#retryQueuedBatches` |
| `LATE_TRANSCRIPT_LABEL` | commitنشده — `[بخشِ ضبط‌شده در زمانِ قطعیِ اینترنت — بعداً رونویسی شد]` | `stt/batchqueue.ts` (export شده، در `mergeBatchTranscript` prepend می‌شود) |

## ۳. ثابت‌های فرانت

### `public/feelia-rt.js`
| ثابت | مقدار |
|---|---|
| `MAX_RECONNECT_ATTEMPTS` / `RECONNECT_BACKOFF_MS` | 4 / [1000, 2000, 4000, 8000] |
| `RESUME_MAX_ATTEMPTS` / `RESUME_RETRY_BACKOFF_MS` | 3 / [800, 1600] (فقط مسیرِ کندِ resume) |
| `KEEPALIVE_INTERVAL_MS` | 5000 — `{"type":"keepalive"}` حینِ MANUAL_PAUSED (Soniox: حداقل هر ۲۰s) |
| `CONNECT_TIMEOUT_MS` / `REQUEST_TIMEOUT_MS` / `FINALIZE_TIMEOUT_MS` | 10000 / 12000 / 8000 |
| `PAUSE_SILENCE_BUFFER_MS` / `PAUSE_FLUSH_MS` | 250 / 2000 |
| `AUTOSAVE_MS` | 5000 |
| `BATCH_POLL_MS` / `BATCH_TIMEOUT_MS` | 5000 / ۱۵ دقیقه |
| `MIME_CANDIDATES` | webm;opus، webm، ogg;opus، ogg |
| `DURABLE_ROTATE_MS` / `DURABLE_BITRATE` | **commitنشده (audit صدا/۲۰۲۶-۰۹-۱۶): 15000** (قبلاً 60000 — تصمیمِ مالک، کاهشِ پنجره‌ی صدایِ در-RAM) / 24000 |
| `DURABLE_FLUSH_GUARD_MS` | **commitنشده — جدید، 10000** (قبلاً hardcode `1500` در `stopDurableSegment`) — نگهبانی که اگه `onstop` هیچ‌وقت fire نشه، `finish()`/`pause()` را برایِ همیشه قفل نمی‌کند |
| `AUDIO_DB_NAME` / `AUDIO_DB_VERSION` / `AUDIO_STORE` | `feelia-audio` / 1 / `segments` |
| `AUDIO_QUEUE_MAX_BYTES` | 300MB |

### `public/feelia-upload.js` (2026-09-23)
| ثابت | مقدار |
|---|---|
| IndexedDB | `feelia-uploads` / نسخه 1 / store `tasks` (keyPath `key` = `<fingerprint>:<clientId>`) |
| اثرِ انگشت | sha256 از نام/حجم/lastModified + ۱MBِ اول و آخر |
| تکرارِ هر تکه | backoff `min(30s, 2^n s)` تا ۸ بار، سپس هر ۱۵s تا بی‌نهایت؛ timeoutِ XHR 120s |
| poll ِ سینی (`index.html`) | ۵s وقتی کاری فعال است، وگرنه ۳۰s؛ poll ِ صفحه‌ی جلسه ۴s |
| live recorder timeslice / durable timeslice | 250ms / 1000ms |
| getUserMedia | `echoCancellation`، `noiseSuppression`، `autoGainControl` = true |

### `public/index.html`
| ثابت | مقدار |
|---|---|
| duration autosave | 10000ms |
| STT watchdog | هر 5s؛ هشدار اگر صدا در ۶s اخیر و متن نه در ۲۰s؛ حداکثر هر ۹۰s |
| `WS_RECONNECT_DELAYS` (legacy) | [1,2,4,8,16,32]s |
| `PAUSE_ACK_TIMEOUT` / `RESUME_ACK_TIMEOUT` (legacy) | 3000 / 5000 |
| `P1_UNACKED_MAX` / `MAX_AUDIO_BUFFER` | 200 / 200 |
| `SonioxDirect` connect timeout | 8000 |
| legacy finalize fallback | 10000 |
| resolve-speakers poll | 3000 |

### `public/feelia-analytics.js`
`CONFIG_TIMEOUT_MS=3000`، `MAX_BUFFER=50`، `PROJECT_ID_RE=/^[a-z0-9]{6,20}$/`، `TAG_URL=https://www.clarity.ms/tag/`.

## ۴. ذخیره‌سازیِ مرورگر

| نوع | کلید | مقدار | نویسنده | پاک‌کننده |
|---|---|---|---|---|
| localStorage | `feelia_active_session` | UUID جلسه | `startSession`، `liveResumeSession` | پایان/لغو/خطای «یافت نشد» |
| localStorage | `feelia_direct` | `'0'` = اجبارِ proxy | دستی (`setDirectMode`) | — |
| localStorage | `feelia_ux_consent_v1:<therapistId>` | `granted`/`denied` | `FeeliaAnalytics.grant/deny` | — |
| sessionStorage | `p1c-<sessionId>` | clientId P1 | `startSession` | تب |
| IndexedDB | `feelia-audio` / store `segments` (keyPath `id`=`<sessionId>_<seq>`، index `sessionId`) | `{sessionId, seq, blob, mime, bytes, createdAt}` | `startDurable` | آپلودِ موفق، abort، 400 |
| Cookie | `feelia_session` | توکن (httpOnly) | سرور | logout/انقضا |

## ۵. فایل‌های کانفیگ

| فایل | نکته |
|---|---|
| `package.json` (root) | `dev`، `test:rt`، `test:cf` |
| `pnpm-workspace.yaml` | `packages: server, packages/*` (`packages/` وجود ندارد)؛ `allowBuilds: esbuild: false` |
| `server/package.json` | `dev`، `build`، `start`؛ وابستگی `global-agent` بدونِ استفاده |
| `server/tsconfig.json` | ES2022، NodeNext، strict، `src → dist` |
| `.gitignore` | `node_modules/`، `dist/`، `.env`، `*.log`، `.DS_Store`، `uploads/`، `data/` |
| `.claude/launch.json` | `npm run dev` پورت 3000 |
