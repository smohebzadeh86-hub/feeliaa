# 2026-09-28 — لایه‌ی LLMِ مستقل از provider + متیس (DeepSeek)

> Evidence (مشاهده در یک زمان). همه‌ی متن‌ها ساختگی‌اند. کلید چاپ/لاگ نشد؛ فقط status، usage، زمان و شمارنده‌ها ثبت شد.

## ۱. probeِ APIِ متیس (`https://api.metisai.ir/deepseek/v1`، از ماشینِ dev)
| درخواست | نتیجه |
|---|---|
| `GET /models` | 200 — `deepseek-flash`، `deepseek-v4-flash`، `deepseek-v4.1-flash`، `deepseek-v4-pro`؛ هر سه نامِ flash با `model: deepseek-flash` جواب می‌دهند |
| `json_object` + `thinking:{type:disabled}` | 200، JSONِ معتبر، ۰ توکنِ استدلال، ~۱٫۱ث |
| `json_object` + `thinking:enabled` + `reasoning_effort:low` | 200، ~۵۳۰ توکنِ استدلال، ~۳٫۲ث |
| بدونِ پارامترِ استدلال | استدلال **روشن** (~۵۰۸ توکن) |
| `reasoning:{enabled:false}` (قالبِ OpenRouter) | **بی‌صدا نادیده** (استدلال روشن) |
| `response_format: json_schema` | **400** «This response_format type is unavailable now» |
| مدلِ نامعتبر / کلیدِ نامعتبر | 400 `model_not_supported` / 401 |
| `max_tokens=5` / `65536` / `400000` | 200 + `finish_reason: length` / 200 / 400 (بازه‌ی مجاز ۱–۳۹۳۲۱۶) |

## ۲. کد
- `server/src/llm/config.ts` (جدید): جدولِ providerها (`openai`، `openrouter`، `metis`، `deepseek`، `custom`)، envِ یکدست، ترجمه‌ی سطحِ استدلال، providerِ جایگزینِ اختیاری، `describeLlmConfig` برایِ لاگِ شروع.
- `server/src/llm/jsonCall.ts` (جدید): یک فراخوانیِ JSON برایِ حالت‌هایِ `schema`/`object`/`prompt`، `isTransientLlmError`، `extractJson`/`shapeOk`، `validate`ِ اختیاری با یک تلاشِ دوباره.
- `case-file/adapters/llm/chatLlm.adapter.ts` (جدید) جایگزینِ `openai.adapter.ts`، `openrouter.adapter.ts` و `chatJson.ts` (حذف). `registry.ts` و `final-transcript/adapters/llmJson.ts` فقط config را resolve می‌کنند.
- `index.ts`: دو خطِ `[llm] …` در شروع (بدونِ کلید).

## ۳. تست‌هایِ خودکار
- `cd server && npx tsc --noEmit` تمیز.
- `pnpm test:llm` **16/16** (جدید). شاملِ رگرسیون: با envِ فعلیِ prod بدنه‌ی درخواستِ OpenRouter (پرونده و «متنِ نهایی») و OpenAI **دقیقاً** همان قبلی است.
- `test:ft` 56/56، `test:cf` 110/110، `test:up` 52/52، `test:tu` 17/17، `test:rt` 100 PASS / 0 FAIL.

## ۴. کیفیتِ «متنِ نهایی» رویِ متیس (همان ۸ متنِ ساختگیِ فاز ۰ و همان اسکریپتِ مقایسه‌ی مدل، chunk 6000)
WER نسبت به متنِ مرجع (کمتر بهتر)؛ «≤ خام» = تعدادِ متن‌هایی که خروجی بدتر از ورودیِ خام نشد.

| پیکربندی | ≤ خام | مجموعِ WER (خام = ۴۱٫۴) | دقتِ نقش | تکه‌ی خام‌مانده | منفیِ تغییرکرده | زمان/متن |
|---|---|---|---|---|---|---|
| OpenRouter `deepseek-v4.1-flash`، استدلال low (قبلی) | 8/8 | 40.1 | ۹۸٫۷–۱۰۰٪ | 1/8 (`number`) | 0 | 26–74ث |
| متیس `deepseek-v4-flash`، **off** | 6/8 | 42.3 | ۹۶٫۱–۱۰۰٪ | 0/8 | 0 | 4–8ث |
| متیس `deepseek-v4-flash`، **low** (پیش‌فرضِ نهایی) | **8/8** | **39.2** | ۹۸٫۷–۱۰۰٪ | 0/8 | 0 | 12–37ث |
| متیس `deepseek-v4-pro`، off | 8/8 | 38.9 | ۹۸٫۷–۱۰۰٪ | 0/8 | 0 | 15–23ث |

نتیجه: پیش‌فرضِ استدلالِ «متنِ نهایی» برایِ متیس/DeepSeek از `off` (پیشنهادِ اولیه) به **`low`** تغییر کرد. `v4-pro` کمی بهتر و هم‌سرعت است ولی گران‌تر؛ فقط با `METIS_FINAL_TRANSCRIPT_MODEL=deepseek-v4-pro` (تصمیمِ مالک).

## ۴ب. «آیا واقعاً بهتر شد؟» — آزمونِ غلط‌هایِ کاشته (همان متن و اسکریپتِ `2026-09-28-final-transcript-quality.md`، متیس flash + low، chunk 4000)
متنِ ساختگیِ جلسه‌ی فردی (۴۳ نوبت) با ۱۵ غلطِ کاشته (هم‌آوا، نیم‌فاصله، املا)، جمله‌ی بی‌نقطه و یک جمله‌ی شکسته بینِ دو برچسب.

| اجرا | غلطِ اصلاح‌شده | نوبتِ خام‌مانده | نقش (تغییرِ گوینده) | زمان |
|---|---|---|---|---|
| m1 | 13/15 (ماند: «رابطمون»، «هیچ وقت») | 0/43 | 42/42 درست | 30ث |
| m2 | **15/15** | 0/43 | 42/42 درست | 41ث |
| long (۳ برابر، ۳ تکه) | 13/15 | 0/129 | 126/126 درست | 137ث |
| مرجع: OpenRouter DeepSeek (fin1 / long) | 13/15 / 12/15 | 0 | درست | — |

- جمله‌ی شکسته بینِ دو برچسب درست یکی شد. نقطه‌گذاری و نیم‌فاصله اضافه شد. لحنِ محاوره ماند. نشانگرِ علامت در جایِ خودش ماند. `⟦…؟⟧` حفظ شد.
- در ۸ متنِ فاز ۰ (بخشِ ۴)، WER فقط در ۳ از ۸ کم شد و در ۵ از ۸ برابرِ خام ماند.
  - آن متن‌ها از صدایِ TTSِ تمیز آمده‌اند و خامشان کم‌غلط است (۴ تا ۷٪).
  - WER نقطه‌گذاری و نیم‌فاصله را نمی‌شمارد، پس بهبودِ خوانایی در آن عدد دیده نمی‌شود.

## ۵. پرونده‌ی درمانِ ساختگی رویِ متیس (بدونِ DB)
`digestWithRepair` ⇒ `composeWithRepair` ⇒ `enforceCaseFileRules` رویِ گفت‌وگویِ ساختگیِ زوج (conv3):
- **OK** در ۱۳۵ث (digest ۷۳ث، compose ۶۲ث). مرجعِ قبلی رویِ OpenRouter: ۱۸۴–۲۷۸ث.
- هیچ تخلفی برایِ اصلاح گزارش نشد. `json_object` + `validateCaseFileDraft` کافی بود. همه‌ی بخش‌ها پر شدند و `model = metis:deepseek-v4-flash`.

## ۶. باز / محدودیت
- dev: `LLM_PROVIDER=metis` در `server/.env`. prod: **تغییر نکرده** (commit/deploy فقط با دستورِ مالک). دسترسیِ VPS به `api.metisai.ir` سنجیده نشده.
- رفتارِ متیس در اتمامِ اعتبار (کدِ 402؟) دیده نشده؛ 402/429/5xx در کد گذرا حساب می‌شوند.
- سیاستِ نگهداریِ داده‌ی متیس/DeepSeek مستند نیست — ریسکِ R21 (پذیرفته‌شده).
- فقط متنِ ساختگی. رویِ جلسه‌ی واقعی سنجیده نشده.
