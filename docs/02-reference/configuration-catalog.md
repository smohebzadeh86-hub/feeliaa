# Configuration Catalog

> **وضعیت:** ACTIVE-CANONICAL (مالکِ env، ثابت‌ها، کلیدهای storage) · منبع: grepِ `process.env` در `server/src` و ثابت‌های کد · Snapshot 2026-09-13.
> مقدارِ هیچ secretی در این سند نیست.

## ۱. متغیرهای محیطی (سرور)

`.env` با `import 'dotenv/config'` از **cwd پروسه** خوانده می‌شود.

| متغیر | استفاده | پیش‌فرض | الزامی | Secret | اثر |
|---|---|---|---|---|---|
| `DATABASE_URL` | `db/connection.ts` | فرمتِ MySQL: `mysql://user:pass@host:port/db` (تا 2026-09-15 فرمتِ PostgreSQL بود؛ مهاجرت به MySQL به دستورِ صریحِ مالک — [PROJECT_STATUS](../../PROJECT_STATUS.md) §7) | عملاً بله | **بله** | اتصالِ mysql2 (قبلاً pg)؛ درایور `timezone:'Z'` + هر اتصال `SET time_zone='+00:00'` (2026-09-29) ⇒ همه‌ی DATETIMEها UTC، مستقل از time_zoneِ سرورِ MySQL |
| `PORT` | `index.ts` | `3000` | خیر | خیر | پورتِ listen (همیشه `0.0.0.0`) |
| `SONIOX_API_KEY` | `features/transcription/stt.routes.ts`، `features/sessions/`، `features/transcription/soniox/tempKey.ts`، `features/transcription/soniox/restClient.ts`، `features/transcription/batch/`، `features/legacy-ws/transcription.routes.ts` | — | برای STT بله | **بله** | نبود → `no-key`؛ batch `failed` |
| `SONIOX_API_BASE` | `features/transcription/soniox/tempKey.ts`، `features/transcription/soniox/restClient.ts` | `https://api.soniox.com` | خیر | خیر | base REST |
| `SONIOX_WS_URL` | `features/transcription/soniox/tempKey.ts` | `wss://stt-rt.soniox.com/transcribe-websocket` | خیر | خیر | URLِ برگشتی به مرورگر؛ **`features/legacy-ws/soniox.ts` از آن استفاده نمی‌کند** (URL ثابت) |
| `PROXY_URL` | `features/transcription/soniox/tempKey.ts`، `features/transcription/soniox/restClient.ts`، `features/legacy-ws/soniox.ts` | — | خیر | ممکن است credential داشته باشد | egressِ سرور به Soniox |
| `ADMIN_PHONE` | `features/auth/auth.routes.ts` | — | خیر | نیمه‌حساس | شماره‌ای که در register/login ادمین می‌شود |
| `CLARITY_PROJECT_ID` | `features/client-config/clientConfig.routes.ts` | — (خاموش) | خیر | خیر | باید `^[a-z0-9]{6,20}$`؛ فقط در production |
| `FFMPEG_PATH` | `features/transcription/speakerResolve.ts`، `features/transcription/archive/`، `features/audio-upload/media.ts` | `ffmpeg` | برایِ آپلودِ فایلِ صوتی عملاً بله | خیر | باینریِ ffmpeg؛ نبودش ⇒ jobِ آپلود با `no-ffmpeg` در backoff می‌ماند |
| `AUDIT_LOG_RETENTION_DAYS` | `obs/sweep.ts` | `730` (۲ سال) | تنظیم‌نشده | خیر | **جدید 2026-09-26 (A6، تصمیمِ مالک: «۲ سال»).** ردیف‌هایِ `audit_log` قدیمی‌تر از این در جاروبِ روزانه (startup + هر ۲۴ ساعت) حذف می‌شوند |
| `SESSION_AUTO_CLOSE_IDLE_SECONDS` | `features/sessions/autoClose.ts` | `7200` (۲ ساعت؛ کف ۹۰۰) | تنظیم‌نشده | خیر | **جدید 2026-09-26 (A3).** جلسه‌ی زنده‌ی `in_progress`/`recovered` (غیرِ upload) که در این مدت نه `updated_at`، نه `session_audio`، نه `obs_events` داشته، هر ۱۵ دقیقه خودکار completed می‌شود (`auto_closed_at`) |
| `SONIOX_CONTEXT_PRE_NOTE` / `SONIOX_CONTEXT_PRE_NOTE_MAX_CHARS` | `features/treatment-unit/instance.ts` | روشن / `2000` | ست نشده | خیر | **جدید 2026-10-01.** `SONIOX_CONTEXT_PRE_NOTE=0` ⇒ یادداشتِ پیش از جلسه (متنِ `note_before`/`voice_before`) به `context.text` ِSoniox نمی‌رود؛ وگرنه تا سقفِ نویسه‌ی دوم (و سقفِ سختِ ۹۵۰۰ نویسه برایِ کلِ context) می‌رود. سنجش: verification/2026-10-01-pre-note-stt-context.md |
| `SONIOX_CONTEXT_MAX_TERMS` / `SONIOX_CONTEXT_MAX_CHARS` | `features/treatment-unit/instance.ts` | `60` / `8000` | ست نشده | خیر | **جدید 2026-09-27.** سقفِ واژه‌هایِ رویکرد و طولِ JSONِ contextِ پویایِ Soniox |
| `TU_CATALOG_TTL_MS` | `features/treatment-unit/instance.ts` | `60000` | ست نشده | خیر | **جدید 2026-09-27.** کشِ درون‌حافظه‌ایِ کاتالوگِ واحدِ درمان |
| `PRE_NOTE_MAX_CHARS` | `features/sessions/` | `2000` | ست نشده | خیر | **جدید 2026-09-27.** سقفِ یادداشتِ پیش از جلسه |
| `SONIOX_ORPHAN_SWEEP` | `features/audio-upload/worker.ts` | خاموش | **رویِ production: `1`** (در `/root/feeliaa-mysql/.env` ست شد 2026-09-24؛ dry-run پیش از آن: ۱ transcription + ۱ فایلِ یتیمِ 2026-09-16) | خیر | **جدید 2026-09-23.** فقط `1` پاک‌سازیِ فایل/transcriptionِ یتیمِ فیلیا رویِ Soniox را فعال می‌کند. رویِ dev عمداً خاموش — کلیدِ Soniox بینِ dev و production مشترک است و DBِ dev از jobهایِ زنده‌ی production خبر ندارد |
| `UPLOAD_DAILY_AUDIO_MINUTES` | `features/audio-upload/worker.ts` (`quotaWaitMsForJob`) | `600` | ست نشده (پیش‌فرض ۶۰۰) | خیر | **جدید 2026-09-24 (رفعِ L6).** سقفِ دقیقه‌ی صدایِ رونویسی‌شده‌ی آپلودی برایِ هر تراپیست در ۲۴ ساعتِ غلتان. بیش از آن ⇒ job **صف می‌ماند** (`error_code='quota-wait'`، چکِ دوباره هر ۳۰ دقیقه) — هرگز رد/failed نمی‌شود؛ اولین job همیشه اجرا می‌شود؛ `0` ⇒ بدونِ سقف |
| `TRANSCRIPT_UNCERTAIN_CONFIDENCE` | `features/transcription/soniox/restClient.ts` (`uncertainConfidence`) | `0.5` | خیر | خیر | **جدید 2026-09-28 (پلنِ B).** واژه‌ای که کمینه‌ی confidenceِ توکن‌هایش زیرِ این است در **ورودیِ «متنِ نهایی»** با `⟦…؟⟧` علامت می‌خورد (هرگز در `sessions.transcript`). بازه‌ی معتبر (0,1)؛ نامعتبر ⇒ پیش‌فرض |
| `UPLOAD_LOW_CONF_RATIO` | `features/transcription/soniox/restClient.ts` (`lowConfidenceWarnRatio`) ⇒ `worker.productionDeps` | `0.08` | خیر | خیر | **جدید 2026-09-28 (پلنِ B).** سهمِ توکن‌هایِ confidence<0.7 که بالاتر از آن jobِ آپلود `quality_warning=low_confidence` و اعلانِ `transcript_low_quality` می‌گیرد. مبنا: فاز ۰B (بی‌آسیب ≤ ۰٫۰۳۸، متنِ خراب ۰٫۱۲۲) — با دادهٔ واقعی بازتنظیم شود. در startup خوانده می‌شود |
| `UPLOAD_CASE_FILE` | `features/audio-upload/jobMachine.ts#uploadCaseFileEnabled` | خاموش | خیر | خیر | **جدید 2026-09-24 (تصمیمِ مالک).** مسیرِ آپلودِ فایلِ صوتی برایِ مراجعِ فعال و غیرفعال با «ذخیره‌ی متن» تمام می‌شود (`audio_jobs.case_file_status='disabled'`)؛ فقط `1` مرحله‌ی پرونده را بعد از متن روشن می‌کند (UI هم ثابتِ `UPLOAD_SHOW_CASE_FILE_STEP` در `index.html` را دارد که باید هم‌زمان `true` شود). فقط مراجعِ غیرفعال را می‌خواهید؟ ⇒ `UPLOAD_CASE_FILE_INACTIVE` |
| `UPLOAD_CASE_FILE_INACTIVE` | `features/audio-upload/jobMachine.ts#uploadCaseFileInactiveEnabled` | خاموش | خیر | خیر | **جدید 2026-09-25 (تصمیمِ مالک: «فعلاً متن»).** فقط `1` ⇒ آپلودِ مراجعِ **غیرفعال** بعد از متن پرونده را هم به‌روز می‌کند، به شرطِ `case_file_enabled` و `case_file_auto_generate=true` برایِ آن تراپیست (`uploadCaseFileAllowed`). مراجعِ فعال اثر نمی‌گیرد. UI خودکار از `case_file_planned` پیروی می‌کند. نیازمندِ ری‌استارت |
| `CASE_FILE_AUTO_ACTIVE_CLIENTS` | `features/case-file/application/autoTrigger.ts` | خاموش | خیر | خیر | **جدید 2026-09-23 (پی‌ریزی، تصمیمِ مالک «الان نه»).** `1` ⇒ تولیدِ خودکارِ پرونده برایِ مراجعِ **فعال** هم (امروز فقط غیرفعال) |
| `LLM_PROVIDER` | `llm/config.ts` (`resolveLlmConfig`) | `openai` | خیر | خیر | **بازنویسیِ 2026-09-28 (لایه‌ی LLMِ مستقل از provider).** `openai`، `openrouter`، `metis`، `deepseek` یا `custom`. providerِ پیش‌فرضِ هر دو مسیر (پرونده‌ی درمان + «متنِ نهایی»). **سوییچ = همین یک خط + restart**؛ کلید/مدلِ همه‌ی providerها کنارِ هم در `.env` می‌مانند. مقدارِ نامعتبر ⇒ `llm-failed` (پرونده) / `llm-not-configured` (متنِ نهایی) + خطِ `[llm] … پیکربندی نامعتبر` در لاگِ شروع |
| `CASE_FILE_LLM_PROVIDER` / `FINAL_TRANSCRIPT_LLM_PROVIDER` | همان | `LLM_PROVIDER` | خیر | خیر | **2026-09-28.** providerِ جدا برایِ یک مسیر (مثلاً «متنِ نهایی» رویِ متیس، پرونده رویِ OpenRouter) |
| `LLM_FALLBACK_PROVIDER` / `CASE_FILE_LLM_FALLBACK_PROVIDER` / `FINAL_TRANSCRIPT_LLM_FALLBACK_PROVIDER` | `llm/config.ts` (`resolveLlmFallbackConfig`)، `llm/jsonCall.ts` | **خاموش** | خیر | خیر | **2026-09-28.** providerِ جایگزین: فقط وقتی providerِ اصلی خطایِ **گذرا** بدهد (402/408/429/5xx/شبکه)، همان درخواست یک بار با قراردادِ providerِ جایگزین فرستاده می‌شود. ⚠️ روشن‌کردنش یعنی متنِ بالینی ممکن است به providerِ دوم هم برود (تصمیمِ مالک). `none` یا همان providerِ اصلی ⇒ خاموش |
| `<P>_API_KEY` | همان | — | برایِ providerِ فعال **بله** | **بله** | `<P>` = `OPENAI`، `OPENROUTER`، `METIS`، `DEEPSEEK`، `CUSTOM_LLM`. نبود ⇒ خطایِ پیکربندی (پیام بدونِ مقدارِ کلید) |
| `<P>_MODEL` | همان | — (عمداً بدونِ fallbackِ hardcode‌شده — تصمیمِ مالک) | برایِ providerِ فعال **بله** | خیر | مدلِ پیش‌فرضِ آن provider برایِ هر دو مسیر. نامِ مدل مالِ provider است (OpenRouter: `deepseek/deepseek-v4.1-flash`؛ متیس: `deepseek-v4-flash`) |
| `<P>_CASE_FILE_MODEL` / `<P>_FINAL_TRANSCRIPT_MODEL` | همان | `<P>_MODEL` | خیر | خیر | مدلِ جدا برایِ یک مسیر. `OPENAI_CASE_FILE_MODEL` همان نامِ قبلی است (سازگار) |
| `<P>_BASE_URL` | همان | جدولِ `PROFILES` (OpenRouter: `https://openrouter.ai/api/v1`؛ متیس: `https://api.metisai.ir/deepseek/v1`؛ DeepSeek: `https://api.deepseek.com/v1`) | برایِ `custom` **بله** | خیر | آدرسِ APIِ سازگار با OpenAI |
| `CUSTOM_LLM_JSON_MODE` / `CUSTOM_LLM_REASONING_STYLE` / `CUSTOM_LLM_TOKEN_PARAM` | همان | `prompt` / `none` / `max_tokens` | خیر | خیر | فقط `LLM_PROVIDER=custom`: هر سرویسِ سازگار با OpenAI بدونِ تغییرِ کد. `schema\|object\|prompt`؛ `none\|openrouter\|deepseek\|openai`؛ `max_tokens\|max_completion_tokens` |
| `CASE_FILE_JSON_MODE` / `FINAL_TRANSCRIPT_JSON_MODE` | همان | پیش‌فرضِ provider: OpenAI/OpenRouter = `schema`؛ متیس/DeepSeek = `object`؛ custom = `CUSTOM_LLM_JSON_MODE` | خیر | خیر | `schema` = `response_format: json_schema`ِ strict؛ `object` = `json_object` + schema در پرامپت؛ `prompt` = فقط schema در پرامپت. در دو حالتِ آخر خروجی با parseِ مقاوم + چکِ ساختار (و در پرونده `validateCaseFileDraft`) خوانده و یک بار دوباره پرسیده می‌شود. حالتی که provider ندارد ⇒ پیش‌فرضِ provider + هشدار در لاگِ شروع (نه خطا) — متیس `json_schema` را با 400 رد می‌کند (probe 2026-09-28). مقدارِ ناشناخته ⇒ خطایِ پیکربندی |
| `<P>_CASE_FILE_REASONING_EFFORT` / `<P>_FINAL_TRANSCRIPT_REASONING_EFFORT` | همان | — | خیر | خیر | **2026-09-28.** سطحِ استدلالِ مخصوصِ یک provider؛ بر سطحِ عمومیِ ردیفِ بعد مقدم است. سطحِ مناسب به مدل بستگی دارد (Dots3ِ رایگانِ OpenRouter فقط بدونِ استدلال کار می‌کرد؛ DeepSeekِ متیس با `low` بهتر است)، پس با این متغیر سوییچ و برگشت بدونِ دست‌زدن به envِ دیگر ممکن است. مثال: `OPENROUTER_FINAL_TRANSCRIPT_REASONING_EFFORT=off` |
| `FINAL_TRANSCRIPT_DAILY_BUDGET_USD` / `FINAL_TRANSCRIPT_DAILY_BUDGET_TOKENS` | `features/final-transcript/runner.ts` (`polishFor`) | `3` / `5000000` | ست نشده | خیر | **جدید 2026-10-01.** سقفِ روزانه (روزِ UTC) برایِ «متنِ نهایی»: جمعِ هزینه‌ی دلاری و جمعِ توکنِ (ورودی+خروجی) ویرایش‌هایِ تمام‌شده‌یِ امروز از `polish_report.usage`. هر کدام پر شود ⇒ ویرایشِ تازه بدونِ فراخوانیِ LLM با `error_code='llm-budget'` شکست می‌خورد (دکمه‌ی «تلاشِ دوباره» فردا). ۰ ⇒ آن سقف خاموش. متیس/DeepSeek هزینه‌ی دلاری نمی‌دهند ⇒ فقط سقفِ توکن مؤثر است مگر قیمت (ردیفِ بعد) تنظیم شود |
| `<P>_PRICE_IN_PER_M` / `<P>_PRICE_OUT_PER_M` | `llm/config.ts` (`priceFor`) | — | خیر | خیر | **جدید 2026-10-01.** قیمتِ هر ۱M توکنِ ورودی/خروجی (دلار) برایِ تخمینِ هزینه وقتی provider خودش هزینه را در پاسخ نمی‌دهد (OpenRouter می‌دهد؛ `usage:{include:true}`). بدونِ آن `cost_usd=null` و فقط توکن‌ها شمرده می‌شوند |
| `CASE_FILE_REASONING_EFFORT` / `FINAL_TRANSCRIPT_REASONING_EFFORT` | همان (`reasoningBody`) | پرونده: `low` (OpenAI: `default`)؛ متنِ نهایی: **متیس `off`** (از 2026-10-01؛ سنجش: کیفیتِ برابر، ~۴× توکنِ خروجیِ کمتر، ۲٫۶× سریع‌تر)، DeepSeek/OpenRouter `low`، OpenAI `default` | خیر | خیر | واژگانِ مشترک `off\|minimal\|low\|medium\|high\|max\|default`؛ هر provider به پارامترِ خودش ترجمه می‌کند (OpenRouter: `reasoning`؛ DeepSeek/متیس: `thinking` + `reasoning_effort`؛ OpenAI: `reasoning_effort`). `default` ⇒ هیچ پارامتری. ⚠️ متیس بدونِ پارامتر استدلال را **روشن** می‌کند و پارامترِ OpenRouter را بی‌صدا نادیده می‌گیرد (probe 2026-09-28). مقدارِ نامعتبر ⇒ خطایِ پیکربندی |
| `OPENROUTER_REASONING_EFFORT` | همان | `low` | خیر | خیر | **سازگاری:** فقط وقتی provider = OpenRouter و `<PURPOSE>_REASONING_EFFORT` خالی است. دلیلِ سقف (2026-09-20، دادهٔ ساختگی): بدونِ آن یک اجرا ۱۴٬۱۳۲ توکنِ reasoning و ۷۸۹ث؛ با `low` ۱۸۴ث |
| `OPENROUTER_SITE_URL` | همان | `https://feelia.ir` | خیر | خیر | هدرِ `HTTP-Referer` ِ OpenRouter — فقط شناساییِ اپ، بدونِ دیتایِ کاربر |
| `FINAL_TRANSCRIPT_MODEL` | همان | — | خیر | خیر | **سازگاری:** فقط برایِ OpenRouter/OpenAI خوانده می‌شود (نامِ مدل مالِ provider است — با سوییچ به متیس نادیده گرفته می‌شود و `METIS_MODEL` به کار می‌رود). جایگزینِ تمیز: `<P>_FINAL_TRANSCRIPT_MODEL` |
| `FINAL_TRANSCRIPT_FALLBACK_MODELS` / `OPENROUTER_FINAL_TRANSCRIPT_FALLBACK_MODELS` | همان | — | خیر | خیر | **فقط OpenRouter** (پارامترِ `models`): اگر مدلِ اصلی 429/خطا داد خودِ OpenRouter این‌ها را امتحان می‌کند. با providerِ دیگر نادیده + هشدار در لاگِ شروع |
| `CASE_FILE_MAX_TOKENS` / `FINAL_TRANSCRIPT_MAX_TOKENS` | همان | `32768` (پرونده؛ OpenAI بدونِ سقف مگر ست شود) / `16384` | خیر | خیر | **2026-09-28.** سقفِ توکنِ خروجی (`max_tokens`، یا `max_completion_tokens` در OpenAI). بدونِ آن OpenRouter سقفِ کاملِ مدل (۱۳۱۰۷۲) را از اعتبار رزرو می‌کرد ⇒ 402 با اعتبارِ کم. سقفِ متیس: ۳۹۳۲۱۶ |
| `CASE_FILE_LLM_TIMEOUT_MS` / `FINAL_TRANSCRIPT_LLM_TIMEOUT_MS` | همان | `300000` / `180000` | خیر | خیر | timeoutِ هر فراخوانی؛ `maxRetries=0` (retryِ پرونده در `repairLoop`/jobِ آپلود؛ متنِ نهایی در `llmJson.ts` و backoffِ job). از 2026-09-28 OpenAI هم همین (قبلاً پیش‌فرضِ SDK: ۱۰ دقیقه + ۲ retry) |
| `FINAL_TRANSCRIPT_CALL_RETRIES` | `features/final-transcript/adapters/llmJson.ts` | `2` | خیر | خیر | تلاشِ دوباره‌ی درجایِ همان فراخوانی برایِ خطایِ گذرا (و یک بار برایِ پاسخِ نامعتبر) |
| `FINAL_TRANSCRIPT_CHUNK_CHARS` | `features/final-transcript/runner.ts` | `4000` (تا 2026-09-28: `6000`) | خیر | خیر | سقفِ نویسه‌ی هر تکه (مرزِ نوبت) |
| `FINAL_TRANSCRIPT_OVERVIEW_CHARS` | همان | `60000` | خیر | خیر | متنِ بلندتر ⇒ برداشتِ کلی رویِ نمونه‌ی ابتدا/میانه/انتها |
| `FINAL_TRANSCRIPT_AUDIO_WAIT_MS` | همان | `1800000` | خیر | خیر | سقفِ انتظار برایِ sync ِ آرشیوِ صدا، بعد از آن ⇒ realtime |
| `FINAL_TRANSCRIPT_SETTLE_MS` | همان | `90000` | خیر | خیر | مکثِ اولیه بعد از پایانِ جلسه (تکه‌هایِ دُمِ مرورگر) |
| `FINAL_TRANSCRIPT_MIN_LENGTH_RATIO` / `_MAX_LENGTH_RATIO` / `_MIN_OVERLAP` | همان | `0.65` / `1.15` / `0.7` | خیر | خیر | آستانه‌هایِ نگهبانِ هر تکه (`polishGuards.ts`) |
| `LOG_LEVEL` | `index.ts` (سطحِ لاگرِ Fastify) | `info` | خیر | خیر | **جدید، فازِ ۱ِ رصد/حسابرسی، 2026-09-22** — قبلاً `logger:true` هارد بود |
| `OBS_SLOW_MS` | `obs/httpHook.ts` | `1500` | خیر | خیر | آستانه‌ی «کند» برایِ ثبتِ `http.request` در DB (پایین‌ترش فقط در JSONL می‌ماند) |
| `OBS_EVENTS_RETENTION_DAYS` | `obs/sweep.ts` | `180` | خیر | خیر | نگهداریِ `obs_events` |
| `OBS_UI_RETENTION_DAYS` | `obs/sweep.ts` | `30` | خیر | خیر | نگهداریِ `obs_ui_events` |
| `OBS_CLIENT_ENABLED` | `features/client-config/clientConfig.routes.ts` | `true` (هر مقدارِ غیرِ `'false'`) | خیر | خیر | کلیدِ سراسریِ روشن/خاموشِ `FeeliaObs` (شاملِ ادمین) |
| `OBS_CLIENT_SAMPLE` | `features/client-config/clientConfig.routes.ts` | `1` | خیر | خیر | نرخِ نمونه‌برداریِ per-page-load (۰ تا ۱) |
| `OBS_LOG_MAX_BYTES` | `obs/fileSink.ts` | `8388608` (۸MB) | خیر | خیر | **پیاده‌سازی‌شده 2026-09-23.** سقفِ حجمِ هر فایلِ `obs.jsonl`/`obs.jsonl.N` پیش از rotate؛ مقدارِ نامعتبر/۰/منفی/NaN → fallback به ۸MB. تعدادِ فایل‌ها (`KEEP=5`) ثابت است و از env نمی‌آید. |

کلیدهای موجود در `server/.env` محلی ولی **بدونِ استفاده در کد:** `AUTH_PASSWORD` (C8). `PROXY_URL` در آن comment شده است.

## ۲. ثابت‌های سرور

| ثابت | مقدار | فایل |
|---|---|---|
| `SESSION_COOKIE` / `SESSION_COOKIE_MAX_AGE` | `feelia_session` / ۳۰ روز | `auth/guard.ts` |
| `SESSION_TTL_MS` | ۳۰ روز | `auth/session.ts` |
| `NOTE_EDIT_MAX_CHARS` | 20000 (2026-09-29) — سقفِ متنِ ویرایش‌شده‌ی یادداشتِ پیش از جلسه (`PATCH /api/notes/:id`) | `features/sessions/notes.routes.ts` |
| scrypt `KEY_LEN` | 64 | `auth/password.ts` |
| mint rate limit | ۳۰/۶۰s per therapist | `features/transcription/stt.routes.ts` |
| `STT_DEFAULTS` | model `stt-rt-v5`، …، `enable_endpoint_detection:true` (از 2026-09-14؛ قبلاً false) | `features/transcription/stt.routes.ts` |
| `TEMP_KEY_EXPIRES_IN_SECONDS` / `TEMP_KEY_MAX_SESSION_SECONDS` / `MINT_TIMEOUT_MS` | 120 / 7200 / 10000 | `features/transcription/soniox/tempKey.ts` |
| `QUEUE_DIR` / `MAX_AUDIO_BYTES` / `RETENTION_MS` | `<cwd>/data/batch-queue` / 50MB / ۲۴h | `features/transcription/batch/` |
| `ARCHIVE_DIR` / `RETENTION_MS` | `<cwd>/data/session-audio` / ۳۰ روز | `features/transcription/archive/` |
| JSONLِ obs: `MAX_BYTES` / `KEEP` | 8MB / 5 (سقفِ دیسک ~۴۸MB، `<cwd>/data/logs/obs.jsonl[.1..5]`) | `obs/fileSink.ts` |
| صفِ obs: `MAX_QUEUE` / `DRAIN_BATCH` / درین هر `2s` (یا `30s` وقتِ خرابیِ DB) | 2000 / 200 | `obs/eventLog.ts` |
| obs rate-limit | ۲۰ درخواست + ۱۵۰۰ رویداد/دقیقه به‌ازایِ تراپیست | `obs/obs.routes.ts` |
| `FeeliaObs`: `MAX_BUF` / `BATCH_MAX` / flush دوره‌ای | 200 / 50 / ۱۵ثانیه | `public/feelia-obs.js` |
| `FeeliaObs` backoff | [5s, 15s, 60s, 300s]، reset روی هر 2xx | `public/feelia-obs.js` |
| `POLL_INTERVAL_MS` / سقفِ poll / timeoutِ درخواست | 2000 / **۱۰ دقیقه + ۱ دقیقه به ازایِ هر MB** (`pollTimeoutForBytes`، رفعِ F2، 2026-09-23؛ قبلاً ثابتِ ۱۰ دقیقه) / 20000 (آپلودِ stream: 60000 idle) | `features/transcription/soniox/restClient.ts` |
| آپلودِ فایلِ صوتی: `CHUNK_SIZE` / `MAX_UPLOAD_BYTES` / `MAX_ACTIVE_UPLOADS_PER_THERAPIST` / نگهداریِ نیمه‌کاره | ۴MB / ۱GB (تصمیمِ مالک) / ۵ / ۷ روز | `features/audio-upload/uploadStore.ts` (2026-09-23) |
| `MAX_DURATION_MS` | ۳۰۰ دقیقه (سقفِ Soniox؛ تصمیمِ مالک) | `features/audio-upload/media.ts` |
| `QUALITY` (سنجشِ فایلِ آپلودی) | قاب ۵۰ms، پنجره ۳۰ث؛ `no_signal` p95<−85، `too_quiet` p95<**−60** (زنده: −45)، `clipping` سهمِ قابِ peak≥0.99 > ۰٫۰۲، `noisy` p10>−40 و p95−p10<12؛ flag وقتی ≥۳۰٪ پنجره‌ها (فایلِ زیرِ ۳ پنجره: کلِ فایل) | `features/audio-upload/quality.ts` |
| نرمال‌سازی | Opus/Ogg mono 16kHz 32kbps (fallback AAC/M4A 48kbps)؛ timeout = max(۵ دقیقه، طولِ صدا/۱۰) | `media.ts` |
| workerِ jobها: tick / هم‌زمانی / lease / heartbeat | ۳s / ۲ / ۲۰ دقیقه / ۶۰s | `features/audio-upload/worker.ts` |
| `BACKOFF_MS` / `MAX_ATTEMPTS` / busyِ پرونده | [30s, 2m, 10m, 30m, 1h, 3h] / 6 / هر ۲ دقیقه تا ۱۵ بار | `features/audio-upload/jobMachine.ts` |
| `CHEAP_RETRY_MS` / `CHEAP_MAX_ATTEMPTS` (2026-09-24) | 20s ثابت / 90 (~۳۰ دقیقه) — فقط وقتی transcription رویِ Soniox ساخته شده و poll/دریافتِ متن شکست خورده؛ در startupِ worker هم `next_attempt_at` ِ این jobها حداکثر NOW+20s می‌شود | `jobMachine.ts`، `worker.ts#startAudioJobWorker` |
| تکرارِ خطایِ شبکه‌ایِ درخواستِ Soniox (2026-09-24) | فقط GET/DELETE: ۳ تکرار با [1s, 2s, 4s] رویِ خطایِ سطحِ شبکه (TLS/socket/timeout/…)؛ POST هرگز | `features/transcription/soniox/restClient.ts#request` |
| مهلتِ یک transcription | ۳۰ دقیقه + طولِ صدا | `jobMachine.ts#transcriptionDeadlineMs` |
| sweeps (2026-09-23) | آپلودهایِ رهاشده/یتیم: ساعتی + startup؛ اعلان‌ها: روزانه (نگهداری ۳۰ روز)؛ یتیم‌هایِ Soniox: startup + هر ۶ ساعت (فقط با `SONIOX_ORPHAN_SWEEP=1`، آستانه‌ی ۲۴ ساعت) | `index.ts` |
| ffmpeg timeout / پاکسازیِ job | ۵ دقیقه / ۲ ساعت | `features/transcription/speakerResolve.ts` |
| موتورِ سرور: `RECONNECT_BASE_DELAY`، `MAX_RECONNECT`، `CONNECT_TIMEOUT`، `FINALIZE_TIMEOUT`، `MAX_BUFFER_CHUNKS` | 1000، 6، 8000، 8000، 200 | `features/legacy-ws/soniox.ts` |
| `P1_PARAMS` | GRACE 60s، REORDER 2s، HANDOVER 5s، BUFFER_MAX 100، FORWARDED_SET_MAX 2000 | `features/legacy-ws/p1.ts` |
| voice-note حجم | 100B–50MB | `features/sessions/` |
| slow query log | >100ms | `db/connection.ts` |
| sweep intervals | ۲۴h (audio)، ۱h (resolve jobs)، ۱h (صفِ batch — `BATCH_SWEEP_INTERVAL_MS`؛ به‌علاوه‌ی startup) | `index.ts`؛ ثابت در `features/transcription/batch/` |
| multipart `fileSize` | **۱۰MB صریح** (audit صدا، 2026-09-16) (`register(multipart, { limits: { fileSize: 10*1024*1024 } })`) — قبلاً ۱MiB عملی (`bodyLimit` پیش‌فرضِ Fastify، تأییدشده در `@fastify/multipart@10.1.1`) که سگمنت‌هایِ صوتیِ بزرگ‌تر را با ۴۱۳ رد می‌کرد | `index.ts`؛ پیامد: [platform plan](../06-platform/implementation-plan.md) |
| workerِ دوره‌ایِ retryِ صفِ batch | هر ۵ دقیقه (`setInterval`) + سرِ startup | `index.ts` → `features/transcription/batch/#retryQueuedBatches` |
| `LATE_TRANSCRIPT_LABEL` | `[بخشِ ضبط‌شده در زمانِ قطعیِ اینترنت — بعداً رونویسی شد]` | `features/transcription/batch/` (export شده، در `mergeBatchTranscript` prepend می‌شود) |

## ۳. ثابت‌های فرانت

### `public/index.html` — یادداشتِ پیش از جلسه (2026-09-29)
| ثابت | مقدار |
|---|---|
| `PRE_VOICE_MAX_MS` | ۵ دقیقه — سقفِ هر ضبطِ یادداشتِ صوتیِ پیش از جلسه (توقفِ خودکار) |
| `PreDraft` (`feelia-predraft`/`clips`) `MAX_AGE` | ۱۴ روز؛ `purgeExpired` ۵ ثانیه پس از هر بارگذاریِ صفحه همه‌ی پیش‌نویس‌هایِ کهنه را پاک می‌کند (نه فقط مراجعِ بازشده) |
| poll ِ Wrapup برایِ متنِ صوتیِ پیش از جلسه | هر ۵ ثانیه، حداکثر ۵ دقیقه |

### `public/feelia-rt.js`
| ثابت | مقدار |
|---|---|
| `MAX_RECONNECT_ATTEMPTS` / `RECONNECT_BACKOFF_MS` | 4 / [1000, 2000, 4000, 8000] |
| `RESUME_MAX_ATTEMPTS` / `RESUME_RETRY_BACKOFF_MS` | 3 / [800, 1600] (فقط مسیرِ کندِ resume) |
| `KEEPALIVE_INTERVAL_MS` | 5000 — `{"type":"keepalive"}` حینِ MANUAL_PAUSED (Soniox: حداقل هر ۲۰s) |
| `CONNECT_TIMEOUT_MS` / `REQUEST_TIMEOUT_MS` / `FINALIZE_TIMEOUT_MS` | 10000 / 12000 / 8000 |
| `PAUSE_SILENCE_BUFFER_MS` / `PAUSE_FLUSH_MS` | 250 / 2000 |
| `AUTOSAVE_MS` / `AUTOSAVE_MAX_GAP_MS` | 5000 / 15000 — تیکِ ۵ثانیه‌ای؛ فاصله‌ی دو ذخیره `min(15s, 5s + ⌊طولِ متن/20000⌋×2.5s)`؛ هرگز دو PUTِ هم‌زمان (2026-09-26) |
| `TRANSCRIPT_PUT_TIMEOUT_MS` | 30000 — فقط PUTِ متنِ کامل در `persistConfirmed` (بقیه‌ی درخواست‌ها `REQUEST_TIMEOUT_MS`) (2026-09-26) |
| `SEGMENT_UPLOAD_TIMEOUT_MS` | 60000 — سقفِ هر POSTِ سگمنت در `uploadQueuedSegment` (زیرِ قفلِ صف)؛ در timeout رکورد در صف می‌ماند (A1.2، 2026-09-26) |
| `FINAL_PERSIST_DELAYS_MS` | `[0, 1500, 4000]` — تلاش‌هایِ ذخیره‌ی نهاییِ متن در `finish` (`persistFinal`)؛ در شکستِ نهایی سگمنت‌هایِ archiveِ همین run که از `lastPersistOkAt − UNSAVED_SEGMENT_SAFETY_MS` (3000) به بعد بسته شده‌اند به `transcript` برمی‌گردند (A1.4، 2026-09-26) |
| `FAILED_RETRY_MS` | 30000 — از FAILED (به‌جز 401) هر ۳۰ث یک دورِ کاملِ reconnect، مستقل از رویدادِ `online` (2026-09-26) |
| Screen Wake Lock | `navigator.wakeLock.request('screen')` تا وقتی یک RTSession زنده است (شامل MANUAL_PAUSED)؛ بدونِ پشتیبانی بی‌صدا هیچ (2026-09-26) |
| `BATCH_POLL_MS` / `BATCH_TIMEOUT_MS` | 5000 / ۱۵ دقیقه |
| `MIME_CANDIDATES` | webm;opus، webm، ogg;opus، ogg |
| `DURABLE_ROTATE_MS` / `DURABLE_BITRATE` | **15000** (audit صدا، 2026-09-16) (قبلاً 60000 — تصمیمِ مالک، کاهشِ پنجره‌ی صدایِ در-RAM) / 24000 |
| `DURABLE_FLUSH_GUARD_MS` | **10000** (قبلاً hardcode `1500` در `stopDurableSegment`) — نگهبانی که اگه `onstop` هیچ‌وقت fire نشه، `finish()`/`pause()` را برایِ همیشه قفل نمی‌کند |
| `AUDIO_DB_NAME` / `AUDIO_DB_VERSION` / `AUDIO_STORE` | `feelia-audio` / 1 / `segments` |
| `AUDIO_QUEUE_MAX_BYTES` | 300MB — جمعِ bytes یک بار با `getAll()` خوانده و در همان تب با add/remove نگه داشته می‌شود (2026-09-26) |

### `public/feelia-upload.js` (2026-09-23)
| ثابت | مقدار |
|---|---|
| IndexedDB | `feelia-uploads` / نسخه 1 / store `tasks` (keyPath `key` = `<fingerprint>:<clientId>`) |
| اثرِ انگشت | sha256 از نام/حجم/lastModified + ۱MBِ اول و آخر |
| تکرارِ هر تکه | backoff `min(30s, 2^n s)` تا ۸ بار، سپس هر ۱۵s تا بی‌نهایت؛ timeoutِ XHR `max(120s, حجم/4KB·s)` + قطعِ زودهنگام اگر `CHUNK_STALL_MS`=60s هیچ بایتی جلو نرود (2026-09-26؛ قبلاً ثابتِ 120s) |
| poll ِ سینی (`index.html`) | ۵s وقتی کاری فعال است، وگرنه ۳۰s؛ poll ِ صفحه‌ی جلسه ۴s |
| live recorder timeslice / durable timeslice | 250ms / 1000ms |
| getUserMedia (`feelia-rt.js`) | `echoCancellation`، `noiseSuppression`، `autoGainControl` = true (2026-09-26: خاموش‌کردنشان آزموده شد — اثری بر تفکیکِ گوینده نداشت؛ برگشت. [verification](../../verification/2026-09-26-speaker-diarization-3-speakers.md)) |
| هشدارِ کیفیتِ ضبط (`QM_*` در `feelia-rt.js`) | پنجره 30000ms؛ تأیید ۲ پنجره (ضعیف/بی‌صدا/نویز)؛ `no_signal` p95<−85dBFS؛ `too_quiet` p95<−45؛ `noisy` p10>−40 و p95−p10<12dB؛ `clipping` >۲٪ فریم‌ها با peak≥0.99؛ حداقل ۲۰۰ فریم در پنجره |
| contextِ Soniox | `server/src/shared/sessionSttContext.ts` → `stt_defaults.context` (realtime، به‌جز `purpose=note`) و `createTranscription` (async، به‌جز یادداشتِ صوتی) — متنِ ثابتِ «جلسه‌ی درمانی، ممکن است ۳+ گوینده» |

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
| localStorage | `feelia_note_outbox` | آرایه‌ی `{qid, sessionId, body, ts}` — علامت/یادداشتِ سریع/متنِ یادداشتِ صوتی‌ای که POSTش گذرا شکست خورد (⚠️ شاملِ متنِ یادداشت تا ارسالِ موفق) | `postNoteReliably` (`index.html`) | ارسالِ موفق، خطایِ دائمی (400/404/413)، حذفِ آیتم توسطِ تراپیست؛ تلاشِ دوباره هر ۲۰ث + `online` + لودِ صفحه (A1.5، 2026-09-26) |
| localStorage | `feelia_direct` | `'0'` = اجبارِ proxy | دستی (`setDirectMode`) | — |
| localStorage | `feelia_theme` | `light`/`dark` | تغییرِ تم در `index.html` | — |
| localStorage | `feelia_pending_complete` | آرایه‌ی شناسه‌ی جلسه‌هایِ «پایان»ِ هنوز تأییدنشده (retry با backoff، A3) | `writePendingCompletes` | بعد از تأییدِ سرور (409 هم تأیید است) |
| localStorage | `feelia-cf-open:<clientId>:<axisKey>` | `1`/`0` — باز/بسته‌بودنِ محورِ پرونده | `cfSaveOpen` | — |
| sessionStorage | `p1c-<sessionId>` | clientId P1 | `startSession` | تب |
| IndexedDB | `feelia-audio` / store `segments` (keyPath `id`=`<sessionId>_<seq>`، index `sessionId`) | `{sessionId, seq, blob, mime, bytes, createdAt}` | `startDurable` | آپلودِ موفق، abort، 400 |
| IndexedDB | `feelia-uploads` / store `tasks` | فایلِ صوتیِ انتخاب‌شده تا پایانِ آپلود (`feelia-upload.js`) | آپلود | «دریافت شد»/لغو/خطای دائمی |
| IndexedDB | `feelia-predraft` / store `clips` (keyPath `id`، index `scope`) | پیش‌نویسِ صوتیِ یادداشتِ پیش از جلسه (حداکثر ۱۴ روز) | `index.html` (pre-note) | ارسال/حذفِ کاربر/انقضا |
| Cookie | `feelia_session` | توکن (httpOnly) | سرور | logout/انقضا |

## ۵. فایل‌های کانفیگ

| فایل | نکته |
|---|---|
| `package.json` (root) | scriptها: `dev`، `test:rt|cf|up|tu|ft|llm|api|routes|arch|docs` — فهرستِ شرح‌دار: `CLAUDE.md` §8 |
| `pnpm-workspace.yaml` | `packages: server, packages/*` (`packages/` وجود ندارد)؛ `allowBuilds: esbuild: false` |
| `server/package.json` | `dev`، `build`، `start`؛ وابستگی `global-agent` بدونِ استفاده |
| `server/tsconfig.json` | ES2022، NodeNext، strict، `src → dist` |
| `.gitignore` | `node_modules/`، `dist/`، `.env`، `*.log`، `.DS_Store`، `uploads/`، `data/` |
| `.claude/launch.json` | `npm run dev` پورت 3000 |
