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
| `FFMPEG_PATH` | `stt/speakerResolve.ts` | `ffmpeg` | خیر | خیر | باینریِ ffmpeg |
| `OPENAI_API_KEY` | `features/case-file/adapters/llm/openai.adapter.ts` | — | فقط اگر `LLM_PROVIDER=openai` | **بله** | نبود → 502 `llm-failed` روی regenerate |
| `OPENAI_CASE_FILE_MODEL` | همان | — (عمداً بدونِ fallbackِ hardcode‌شده — تصمیمِ مالک) | **الزامی** اگر `LLM_PROVIDER=openai` | خیر | نبود → 502 `llm-failed` روی regenerate |
| `OPENROUTER_API_KEY` | `features/case-file/adapters/llm/openrouter.adapter.ts` | — | فقط اگر `LLM_PROVIDER=openrouter` | **بله** | نبود → 502 `llm-failed` روی regenerate |
| `OPENROUTER_MODEL` | همان | — (عمداً بدونِ fallbackِ hardcode‌شده — تصمیمِ مالک) | **الزامی** اگر `LLM_PROVIDER=openrouter` | خیر | شناسه‌ی مدلِ OpenRouter (فرمتِ `<provider>/<model>`)؛ نبود → 502 `llm-failed` |
| `OPENROUTER_SITE_URL` | همان | `https://feelia.ir` | خیر | خیر | هدرِ `HTTP-Referer` — فقط شناساییِ اپ در داشبوردِ OpenRouter، بدونِ دیتایِ کاربر |
| `LLM_PROVIDER` | `features/case-file/adapters/llm/registry.ts` | `openai` | خیر | خیر | `openai` یا `openrouter`؛ مقدارِ دیگر → throw |

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
| `POLL_INTERVAL_MS` / `POLL_TIMEOUT_MS` / timeoutِ درخواست | 2000 / ۱۰ دقیقه / 20000 | `stt/asyncTranscribe.ts` |
| ffmpeg timeout / پاکسازیِ job | ۵ دقیقه / ۲ ساعت | `stt/speakerResolve.ts` |
| موتورِ سرور: `RECONNECT_BASE_DELAY`، `MAX_RECONNECT`، `CONNECT_TIMEOUT`، `FINALIZE_TIMEOUT`، `MAX_BUFFER_CHUNKS` | 1000، 6، 8000، 8000، 200 | `stt/soniox.ts` |
| `P1_PARAMS` | GRACE 60s، REORDER 2s، HANDOVER 5s، BUFFER_MAX 100، FORWARDED_SET_MAX 2000 | `ws/p1.ts` |
| voice-note حجم | 100B–50MB | `http/sessions.ts` |
| slow query log | >100ms | `db/connection.ts` |
| sweep intervals | ۲۴h (audio)، ۱h (resolve jobs) | `index.ts` |
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
| `package.json` (root) | `dev`، `test:rt` |
| `pnpm-workspace.yaml` | `packages: server, packages/*` (`packages/` وجود ندارد)؛ `allowBuilds: esbuild: false` |
| `server/package.json` | `dev`، `build`، `start`؛ وابستگی `global-agent` بدونِ استفاده |
| `server/tsconfig.json` | ES2022، NodeNext، strict، `src → dist` |
| `.gitignore` | `node_modules/`، `dist/`، `.env`، `*.log`، `.DS_Store`، `uploads/`، `data/` |
| `.claude/launch.json` | `npm run dev` پورت 3000 |
