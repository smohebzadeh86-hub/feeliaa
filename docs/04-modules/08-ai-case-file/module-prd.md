# Module PRD — ۰۸: پرونده‌ی روندِ درمان (AI Case File)

> last-verified: 2026-09-30 @ `17d6919` · مالک: [feature-index](../../02-reference/feature-index.md) (`case-file`) · قالب: [feature-doc-template](../../00-governance/feature-doc-template.md) · REQ-111…116 · مرزها/کد/داده/تست/ریسک: [implementation-plan](implementation-plan.md)
> **وضعیت:** ACTIVE-CANONICAL · ایجاد شده 2026-09-17 · فازِ ۱ (دستی) + بخشِ اولِ فازِ ۲
> (auto-trigger، 2026-09-18؛ همچنان فقط مراجعینِ غیرفعال).
> این سند مالکِ رفتارِ محصولی/معماریِ این ماژول است. جزئیاتِ endpoint در
> [api-catalog §8](../../02-reference/api-catalog.md)، schemaِ جدول در
> [database-catalog §client_case_file](../../02-reference/database-catalog.md)، env در
> [configuration-catalog](../../02-reference/configuration-catalog.md)، متنِ prompt/style در
> [content-style-guide.md](content-style-guide.md).

## مسئله

تراپیست قبل از هر جلسه نیاز به بازیابیِ سریع (در حدِ چند ثانیه) از وضعیتِ مراجع دارد، بدونِ
مرورِ دستیِ کامل رونویسی/یادداشت‌هایِ خام. این ماژول از رویِ داده‌ی خامِ ثبت‌شده
(`sessions.transcript` + `session_notes.text`)، با یک LLM (providerِ قابلِ‌تعویض — [llm-provider-layer](../../06-platform/llm-provider-layer.md))، یک «پرونده‌ی روندِ درمان»
ساختاریافته و روایی می‌سازد.

## اصولِ enforced (نه فقط توصیه)

1. **فقط دیتایِ مجاز و ثبت‌شده.** `aggregateClientCorpus` فقط از دو جدولِ رسمی می‌خواند؛
   بدونِ فیلترِ `consent` (آن فیلد فقط «رضایتِ ضبطِ زنده»ست، نه «مجازبودنِ متن» —
   [sessions.ts](../../../server/src/features/sessions/) خطِ ۵۷). فراخوانیِ LLM بدونِ
   tools/functions — نمی‌تواند از دانشِ عمومی/اینترنت چیزی اضافه کند.
2. **خروجیِ AI = پیشنهاد.** هر فیلد `{value, source, reviewedByTherapist, suggestedUpdate,
   pending}` دارد. Regeneration فیلدِ `reviewedByTherapist=true` را overwrite نمی‌کند — پیش‌نویسِ
   تازه در `suggestedUpdate` می‌نشیند (فقط اگر واقعاً فرق کند).
3. **جداییِ یک‌طرفه از داده‌ی خام.** `generateCaseFile` فقط از corpus می‌خواند و فقط در
   `client_case_file` می‌نویسد؛ هیچ مسیری از طریقِ این ماژول `sessions.transcript`/`session_notes`
   را تغییر نمی‌دهد. `generated_from_session_id` عمداً بدونِ FK سخت (حذفِ session نباید پرونده
   را نامعتبر کند).
4. **صفر دیتایِ گم‌شده.** هیچ بخشی از ساختار حذف نمی‌شود، حتی بدونِ داده — `pending=true`.
5. **بازتولیدِ کامل خطرناک است.** `force=true` صراحتاً همه‌ی تاییدهایِ دستی را دور می‌ریزد؛
   UI باید تاییدِ دوباره (تایپِ عبارت) بگیرد؛ `force_regenerated_at/by` ثبت می‌شود.
6. **بدونِ برچسبِ خامِ متادیتا در UI.** `source`/`reviewedByTherapist`/`suggestedUpdate` هرگز
   به‌صورتِ متنِ خام نمایش داده نمی‌شوند — فقط نشانه‌هایِ ظریف (`pending`، نقطه‌ی پیشنهاد).

## معماری

Ports & Adapters در `server/src/features/case-file/` — تعویضِ LLM provider فقط یک آداپتورِ
جدید در `adapters/llm/` می‌خواهد؛ `application/`/`domain/` هیچ importی از `openai` ندارند.
**تولید دو مرحله‌ای (2026-09-19):** `LLMProvider.digestCorpus` (رونویسیِ خام → digestِ تصحیح‌شده با فکت/نقل/ابهام) و سپس `generateCaseFile` (چیدن از رویِ digest؛ schemaِ خروجی بدونِ تغییر). digest ذخیره نمی‌شود؛ خروجیِ هر دو مرحله از `normalizeText` می‌گذرد.
پس از validate، `enforceCaseFileRules` قواعدِ roadmap (p1 مشروط به safetyRisk، ترتیب، طولِ why، پیشوندِ detail) را سمتِ کد اعمال می‌کند (2026-09-19).
جزئیاتِ لایه‌ها: کدِ خودش (کامنت‌هایِ سرِ هر فایل) + [repository-map](../../02-reference/repository-map.md).

## فازِ ۱ (تاییدشده، فعلی)

- **دکمه‌ی دستی همچنان اصلیه.** «تولیدِ پرونده»/«به‌روزرسانی»/«بازتولیدِ کامل» دست‌نخورده‌اند.
- **دامنه:** Backend/schema generic (بدونِ شرطِ status در کد) — ولی UI (تبِ/بخشِ پرونده) فقط
  برایِ مراجعینِ `status='inactive'` رندر می‌شود.
- **محلِ نمایش:** داخلِ `screenClientDetail` موجود، بالایِ `sessionsList` — نه صفحه/تبِ جدا.
- **همگام (نه async queue):** چون trigger دستی همچنان همگام است، `POST regenerate` منتظر
  می‌ماند تا LLM جواب بدهد و نتیجه را برمی‌گرداند — بدونِ نیاز به polling/debounce/outbox.

## فازِ ۲ (بخشِ اول پیاده شد — 2026-09-18)

- **Auto-trigger پیاده شد:** بعدِ پایانِ کاملِ جلسه (`PUT /api/sessions/:id` با
  `status:'completed'`، هم‌مسیرِ زنده هم مسیرِ Wrapup؛ و ساختِ جلسه‌ی دستی که مستقیماً
  `completed` درج می‌شود) — نه یادداشتِ خارج از جلسه (آن هنوز trigger نیست). Fire-and-forget:
  پاسخِ HTTPِ ثبت/به‌روزرسانیِ جلسه را بلاک یا fail نمی‌کند؛ قفلِ نرم/`corpus_signature`ِ
  موجود در `generateCaseFile` از race با کلیکِ دستیِ هم‌زمان جلوگیری می‌کند.
- **تنظیمِ سطحِ‌تراپیست:** ستونِ سه‌حالته‌ی `therapists.case_file_auto_generate`
  (migration 020؛ `NULL`=هنوز پرسیده نشده). اولین بار که جلسه‌ای کامل می‌شود و هنوز `NULL`
  است، یک مودالِ یک‌باره پرسیده می‌شود؛ بعدِ پاسخ، همیشه از یک toggleِ کنارِ دکمه‌هایِ
  `cf-toolbar` قابلِ‌تغییر است (`PATCH /api/auth/case-file-auto-generate`).
- **دامنه هنوز همان فازِ ۱:** فقط مراجعینِ `status='inactive'`؛ گسترش به مراجعینِ فعال هنوز
  پیاده نشده.
- **هنوز پیاده نشده:** صفِ async با coalesce برایِ چند رویدادِ هم‌زمان (نیازش وقتی می‌رسد که
  trigger به یادداشت‌ها هم گسترش یابد — فعلاً یک تریگر در هر پایانِ جلسه کافی‌ست، چون قفلِ
  نرمِ ۳دقیقه‌ای موجود کفایت می‌کند).

## ظاهر

**تایپوگرافی (2026-09-19):** هم‌تراز با design system (پایه ۱۴px، عنوانِ بخش ۱۶px، micro ≥۱۱px)؛ پالتِ `--cf-*` دست‌نخورده. جزئیات: content-style-guide.

تقریباً هم‌شکلِ فایلِ نمونه‌ی طراحی (m4.html): پالت/فونتِ خودش (`--cf-*`، Vazirmatn — از قبل
در اپ لود شده)، نه رنگ‌هایِ عمومیِ Feelia؛ CSS اسکوپ‌شده زیرِ `.case-file-doc` در
`public/index.html` تا با بقیه‌ی اپ تداخل نکند.

## Providerِ LLM

**از 2026-09-28 مستقل از provider:** یک آداپتور (`adapters/llm/chatLlm.adapter.ts`) رویِ لایه‌ی مشترکِ
`server/src/llm/` (هم‌رسانِ «متنِ نهایی»). `LLM_PROVIDER` (یا `CASE_FILE_LLM_PROVIDER`) یکی از `openai`،
`openrouter`، `metis` (DeepSeek از طریقِ متیس، پرداختِ ریالی)، `deepseek` یا `custom` (هر APIِ سازگار با OpenAI
بدونِ تغییرِ کد) است. سوییچ = یک خط در env + restart. **هیچ مدلی در کد hardcode نشده** (تصمیمِ صریحِ مالک) —
`<P>_MODEL` (یا `<P>_CASE_FILE_MODEL`) الزامی است؛ نبودش یعنی 502 `llm-failed` روی هر regenerate.

- **حالتِ JSON:** OpenAI/OpenRouter با `json_schema`ِ strict؛ متیس/DeepSeek `json_schema` ندارند (400) ⇒
  `json_object` + schema در پرامپت، سپس `shapeOk` و `validateCaseFileDraft` در همان آداپتور؛ خروجیِ بدساختار
  یک بار دوباره پرسیده می‌شود. `repairLoop`/`finalizeDraft` لایه‌ی دوم می‌مانند.
- **استدلال:** `CASE_FILE_REASONING_EFFORT` (پیش‌فرض `low`) به پارامترِ هر provider ترجمه می‌شود.
- **مدلِ ذخیره‌شده:** `client_case_file.model` از 2026-09-28 شکلِ `provider:model` دارد (مثلاً
  `metis:deepseek-v4-flash`)؛ ردیف‌هایِ قدیمی بدونِ پیشوند.
- **providerِ جایگزین** (`LLM_FALLBACK_PROVIDER`، پیش‌فرض خاموش): فقط با خطایِ گذرایِ providerِ اصلی.
- پرامپت/`CASE_FILE_JSON_SCHEMA` برایِ همه‌ی providerها یکی است؛ `application/`/`domain/` از provider/مدل بی‌خبرند.
  جزئیاتِ env: [configuration-catalog](../../02-reference/configuration-catalog.md).

## ظاهر — تصمیمِ آگاهانه: حالتِ تاریک وجود دارد

برخلافِ سندِ نمونه‌ی طراحیِ اولیه‌ی این ماژول (که عمداً «بدونِ حالتِ تاریک» بود)، به دستورِ
صریحِ مالک (2026-09-18) `.case-file-doc` یک پالتِ تاریکِ کاملاً جداگانه دارد
(`[data-theme="dark"] .case-file-doc`، نه معکوسِ خودکارِ رنگ‌ها) — تمِ کلیِ اپ را دنبال
می‌کند. کنتراستِ هر جفتِ متن/پس‌زمینه با WCAG AA (≥4.5:1 برایِ متنِ معمولی) تأیید شد؛
دکمه‌ی primary در تمِ تاریک از `--cf-teal-btn` (نسخه‌ی تیره‌تر) استفاده می‌کند چون
`--cf-teal`ِ خودش برایِ متن/بوردر روی کارت طراحی شده، نه پس‌زمینه‌ی زیرِ متنِ سفید.

## Out of Scope (فازِ ۱ + بخشِ اولِ فازِ ۲)

مراجعینِ فعال، صفحه/ناوبریِ مستقل، providerِ LLMِ غیرِ سازگار با OpenAI (مثلاً APIِ بومیِ Anthropic — نیازمندِ یک ردیفِ جدید با clientِ دیگر)، صفِ async با
coalesce، گسترشِ trigger به یادداشت‌هایِ خارج از جلسه.

## رفعِ A1.9 (2026-09-26) — merge
- ردیفِ محور/گام/خلاصه‌ی جلسه/دارویی که تراپیست تأیید یا ویرایش کرده (reviewed، غیرِ pending) و مدل در regenerateِ عادی نیاورده، مثلِ ردیفِ `addedByTherapist` حفظ می‌شود (`mergeTherapistEdits.ts`).
- در بازتولیدِ کامل (`force`) هم `answeredQuestions` حفظ می‌شود و سوالِ پاسخ‌داده‌شده دوباره «باز» نمی‌شود. تست: `test:cf` A1.9a/A1.9b.

## ردیابی، راستی‌آزماییِ نقل و دروازه‌یِ کیفیت (2026-10-02 — F3)
- **ردیابیِ جلسه (`CaseFileFinding.sessions`):** هر یافته‌یِ دارایِ ارجاع، شماره‌یِ جلساتِ منبعش را از شناسه‌هایِ digest (`S<num>F<i>`/`S<num>Q<i>`) می‌گیرد — قطعی و از کد، نه ادعایِ مدل. UI چیپِ «جلسه ۲، ۳» نشان می‌دهد. ردیابیِ در سطحِ نوبت هنوز نیست (digest نوبت را نگه نمی‌دارد).
- **راستی‌آزماییِ نقل (`quoteVerified`):** متنِ هر «نقلِ عینی» (پس از `cmpNorm`: بدونِ فاصله/نیم‌فاصله/نشانه‌گذاری) باید زیررشته‌یِ متنِ همان جلسه (canonical یا `sessions.transcript`) یا یادداشت‌هایش باشد (`quoteVerifierFor`). نشد ⇒ `quoteVerified=false` و چیپِ هشدارِ «عینِ متنِ جلسه نیست»؛ نقل حذف نمی‌شود (تصمیم با تراپیست).
- **دروازه‌یِ کیفیت:** `maybeAutoGenerateCaseFile` اگر جلسه‌ای از این مراجع (آخرین jobِ آپلودِ آن) پرچمِ `low_coverage` یا `speakers_merged` داشته باشد، تولیدِ **خودکار** را نگه می‌دارد (خروجی `'skipped'`، قراردادِ jobِ آپلود دست‌نخورده)؛ تولیدِ دستی آزاد است. `GET /api/clients/:id/case-file` فیلدِ `quality` می‌دهد و UI بنر نشان می‌دهد. فقط جلساتِ آپلودی metrics دارند؛ جلسه‌یِ زنده دروازه ندارد.
- **هنوز نیست:** مصرفِ «متنِ نهایی» (polished)ِ تراپیست به‌جایِ canonical؛ `rolesComplete` فقط اطلاعاتی است (دروازه نمی‌سازد).
- **تست:** `test:cf` T1–T4؛ یکپارچه‌یِ DB (GET quality، hold).
