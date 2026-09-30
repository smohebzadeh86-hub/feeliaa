# لایه‌ی LLMِ مستقل از provider

> last-verified: 2026-09-30 @ `17d6919` · مالک: [feature-index](../02-reference/feature-index.md) (`llm`) · وضعیت: ACTIVE-CANONICAL
> ⚠️ **این لایه مقصدِ خروجِ متنِ بالینی است** (LAW-001، LAW-009): متنِ جلسه/یادداشت‌ها از اینجا به providerِ بیرونی می‌رود.

## ۱. چرا (Why)
- **مسئله:** پروندهٔ درمان و «متنِ نهایی» به یک LLM نیاز دارند. در 2026-09-28 اعتبارِ OpenRouter دو بار تمام شد و هر دو فیچر بی‌صدا از کار افتادند (402)؛ همچنین نیاز به سوییچِ ارزان/قابلِ‌پرداختِ ریالی (متیس/DeepSeek) پیدا شد.
- **تصمیم‌ها** (منبع: Event Log 2026-09-28 «لایه‌ی LLMِ مستقل از provider»، [verification](../../verification/2026-09-28-metis-deepseek.md)):
  - دانستنِ «هر provider چه می‌خواهد» فقط در `server/src/llm/config.ts` (جدولِ `PROFILES`)؛ کدِ فیچرها فقط `resolveLlmConfig(purpose)`/`createJsonCaller(purpose)` را می‌شناسد. سوییچ = عوض‌کردنِ `LLM_PROVIDER` + restart.
  - **سقفِ توکنِ خروجی همیشه گذاشته می‌شود** — بدونِ آن OpenRouter سقفِ کاملِ مدل (≈۱۳۱k) را از اعتبار رزرو می‌کرد ⇒ 402 با اعتبارِ کم (ریشه‌ی حادثه).
  - **متیس/DeepSeek `json_schema` را نمی‌پذیرد** (probe: 400) ⇒ حالتِ `object`/`prompt` + اعتبارسنجیِ سمتِ ما؛ و بدونِ پارامتر «thinking» روشن است ⇒ سطحِ استدلال برایِ هر provider به پارامترِ خودش ترجمه می‌شود (پارامترِ اشتباه بی‌صدا نادیده گرفته می‌شود).
  - هشدارِ ادمین برایِ قطعیِ LLM (`healthAlert.ts`): 401/403/402 فوراً، خطایِ دیگر بعد از چند شکستِ پیاپی؛ هر علت حداکثر یک‌بار در بازه‌ی throttle.
  - **پذیرشِ مالک (R21):** با متیس، متنِ بالینی به DeepSeek می‌رود؛ سیاستِ نگهداری/آموزشِ متیس نامعلوم است و معادلِ `data_collection: deny`ِ OpenRouter ندارد. متنِ رضایت این را نمی‌گوید (LAW-009، [master reference R19/R21](../../PROJECT_MASTER_REFERENCE.md)).
  - providerِ جایگزین (`*_LLM_FALLBACK_PROVIDER`) پیش‌فرض **خاموش** است، چون روشن‌کردنش متن را به providerِ دوم هم می‌برد — تصمیمِ مالک.

## ۲. چه می‌کند (What)
- `resolveLlmConfig(purpose)`: providerِ فعال، کلید، مدل، حالتِ JSON (`schema|object|prompt`)، سطحِ استدلال، سقفِ توکن، timeout و هدرها را از env و پروفایلِ provider می‌سازد. providerها: OpenAI، OpenRouter، Metis، DeepSeek، Custom (هر سرویسِ سازگار با OpenAI). purposeها: `case-file` و `final-transcript`.
- `createJsonCaller(purpose)` / `completeJsonWith`: درخواستِ JSON با retry، استخراج/اعتبارسنجیِ خروجی، طبقه‌بندیِ خطایِ گذرا (`isTransientLlmError`) و انتشارِ رویدادِ سلامت (`onLlmHealth`).
- `createLlmAlertTracker`: اعلانِ `llm_unavailable` به ادمین‌ها (علت‌ها: `credit`، `auth`، `unavailable`) — [notifications](notifications.md).
- ⚠️ `describeLlmConfig` فقط «کلید هست/نیست» را برمی‌گرداند؛ کلید هرگز لاگ نمی‌شود.

## ۳. مرزها (Boundaries)
- سطحِ عمومی: `server/src/llm/{config,jsonCall,healthAlert}.ts` (platform؛ `index.ts` ندارد).
- مصرف‌کننده‌ها: `features/case-file/adapters/llm/` ([ماژول 08](../04-modules/08-ai-case-file/module-prd.md))، `features/final-transcript/adapters/llmJson.ts` ([subsystem 07](../07-subsystems/07-final-transcript.md))، `jobs/backgroundJobs.ts` (سیم‌کشیِ هشدار).
- قاعده: `llm/` هرگز از `features/` import نکند (R2؛ `test:arch` فعلاً `llm` را در R2 نمی‌سنجد — گسترشِ checker در فاز ۶).
- egress: مستقیم از سرور (`PROXY_URL` در `llm/` استفاده نمی‌شود) — [integration-architecture](../01-architecture/integration-architecture.md).

## ۴. کد (Code)
`config.ts` (`PROFILES`، `resolveLlmConfig`، `resolveLlmFallbackConfig`، `reasoningBody`، `describeLlmConfig`)، `jsonCall.ts` (`createChatClient`، `buildRequest`، `extractJson`، `shapeOk`، `createJsonCaller`، `LlmError`)، `healthAlert.ts` (`createLlmAlertTracker`، `reasonFor`).

## ۵. داده (Data)
جدولِ مالک ندارد. `client_case_file.model` برچسبِ `provider:model` را نگه می‌دارد (`modelTag`، ≤۶۴ نویسه). `final_transcripts.polish_report` فقط شمارنده/مدل دارد (بدونِ متن).

## ۶. API و config
env: [configuration-catalog](../02-reference/configuration-catalog.md) (`LLM_PROVIDER`، `<P>_API_KEY/MODEL/…`، `*_JSON_MODE`، `*_REASONING_EFFORT`، `*_MAX_TOKENS`، `*_LLM_TIMEOUT_MS`، fallback). خطاها: `llm-failed`/`llm-invalid-output` در [error-code-catalog](../02-reference/error-code-catalog.md).

## ۷. تست (Tests)
`pnpm test:llm` (`scripts/llm-harness.ts`): config هر provider، رگرسیونِ بدنه‌ی درخواست (max_tokens، هدرِ ASCII)، حالت‌هایِ JSON، providerِ جایگزین؛ کلاینتِ جعلی، بدونِ شبکه. **پوشش نمی‌دهد:** رفتارِ واقعیِ provider (فقط E2Eِ دستی).

## ۸. ریسک و بدهی
R19/R21 (خروجِ متنِ بالینی بدونِ ذکر در متنِ رضایت)؛ DeepSeek `json_schema`ِ strict ندارد ⇒ اتکا به `shapeOk` + گاردهایِ سمتِ فیچر؛ آستانه‌ها و مدلِ پیش‌فرض از سنجشِ ساختگی آمده‌اند (R20).
