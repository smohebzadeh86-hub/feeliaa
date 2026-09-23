# Verification — پاسخ به «سوالاتِ باز» به‌عنوانِ دیتا + دکمه‌ی صریحِ «ثبتِ پاسخ»

> Evidence — مشاهده در یک لحظه (LAW-019)، نه تضمینِ رفتار در آینده.

## گزارشِ مالک
«وقتی تایپ کردم چیزی نشد اصلا» + دو سوال: پاسخ کجا ذخیره می‌شود؟ چطور روی پرونده اثر
می‌گذارد؟ + بعدِ audit و پلن، سه تصمیمِ صریح: (۱) دکمه‌ی «ثبت» جدا از دکمه‌ی «به‌روزرسانیِ
پرونده» بماند، (۲) سوالِ پاسخ‌داده‌شده دیگر در «سوالاتِ باز» نماند، (۳) بدونِ محدودیتِ طول.

## Audit — دو مشکلِ جدا
1. **UI:** `<input onchange=...>` خام — فقط با blur ارسال می‌شد، بدونِ فیدبکِ موفقیت.
2. **Pipeline (اصلی):** پاسخ فقط در `pendingQuestions[].answer` می‌ماند و هیچ‌کجا به
   `aggregateClientCorpus`/`buildCaseFilePrompt`/`generateCaseFile` نمی‌رسید (grepِ کاملِ
   `.answer` در کلِ فیچر تأیید کرد). `corpusSignature` هم فقط از `sessions`/`session_notes`
   می‌آمد، پس دکمه‌ی از قبل موجودِ «به‌روزرسانی» (`regenerateCaseFile(false)`) بعدِ
   پاسخ‌دادن بی‌صدا `skipped:true` می‌داد — LLM حتی صدا زده نمی‌شد.

## کشفِ معماریِ مهم (حینِ پیاده‌سازی)
تلاشِ اول: بلوکِ پاسخ به `corpusText`ِ ورودیِ کلی اضافه شد. اما `repairLoop.ts` نشان داد
corpusTextِ مرحله‌ی ۲ (compose) کاملاً از `digest.sessions` بازسازی می‌شود
(`renderDigest.ts`) — schemaِ digest دقیقاً بر اساسِ `sessionNum` است، پس هر متنِ
غیرِجلسه‌ای که به مرحله‌ی ۱ برود در مرحله‌ی ۲ گم می‌شود. فیکسِ درست:
`buildAnsweredQuestionsBlock` مستقیماً *بعدِ* `renderDigest` به ورودیِ مرحله‌ی ۲ می‌چسبد
(پارامترِ تازه‌ی `extraCorpusText` در `composeWithRepair`)، هرگز به مرحله‌ی ۱ نمی‌رود.

## تغییراتِ کد
- `domain/types.ts`: `CaseFileAnsweredQuestion`، `CaseFileContent.answeredQuestions?`
- `application/applyFieldPatch.ts`: پچِ پاسخ سوال را منتقل می‌کند (نه فقط ست)؛ پاسخِ خالی
  رد می‌شود؛ `migrateAnsweredQuestions` برایِ رکوردِ قدیمی
- `application/mergeTherapistEdits.ts`: `mergePendingQuestions` در برابرِ `answeredQuestions`
  چک می‌کند؛ `answeredQuestions` با regenerate دست‌نخورده می‌ماند
- `application/buildCaseFilePrompt.ts`: `buildAnsweredQuestionsBlock` + قاعده‌ی ۲۸ در system prompt
- `application/repairLoop.ts`: `composeWithRepair` پارامترِ `extraCorpusText`
- `application/generateCaseFile.ts`: `effectiveSignature` (corpus + شناسه‌هایِ answeredQuestions)
- `api/caseFile.routes.ts`: صدازدنِ `migrateAnsweredQuestions` در GET/PATCH
- `public/index.html`: textarea + دکمه‌ی «ثبتِ پاسخ» (`submitCaseFileAnswer`) به‌جایِ input/onchange

## تستِ خودکار (`pnpm test:cf`)
۶ تستِ تازه در `scripts/case-file-harness.ts`:

| تست | نتیجه |
|---|---|
| T1 patch: پاسخ سوال را از pendingQuestions حذف و به answeredQuestions اضافه می‌کند | ✅ |
| T2 patch: پاسخِ خالی/فقط‌فاصله و سوالِ ناموجود رد می‌شود | ✅ |
| T3 migrateAnsweredQuestions: رکوردِ قدیمی منتقل می‌شود؛ ایدمپوتنت | ✅ |
| T4 merge: سوالِ پاسخ‌داده‌شده دوباره باز نمی‌شود؛ answeredQuestions دست‌نخورده می‌ماند | ✅ |
| T5 buildAnsweredQuestionsBlock: متنِ بلوک و حالتِ خالی | ✅ |
| T6 composeWithRepair: بلوک فقط به مرحله‌ی ۲ می‌رسد، نه مرحله‌ی ۱ | ✅ |

**۱۰۸/۱۰۸ PASS** (۱۰۲ تستِ قبلی بدونِ رگرسیون). `cd server && npx tsc --noEmit` تمیز.

## تستِ UI (Browser pane واقعی)
سرورِ استاتیکِ Nodeِ scratchpad رویِ `public/` (بدونِ اکانت/DB، طبقِ الگویِ evidenceِ
`feelia-frontend-testing-without-accounts`) اجرا و در Browser pane باز شد.
`currentCaseFile`/`renderCaseFile` مستقیماً از global scopeِ صفحه ست/صدا زده شدند (نه
`window.*` — متغیرِ سطحِ بالایِ اپ با `let` تعریف شده و رویِ `window` نیست؛ نکته‌ای که حینِ
دیباگ کشف شد)، و `api()` برای capture کردنِ PATCH mock شد.

| مورد | نتیجه |
|---|---|
| رندرِ سوالِ باز | ✅ `textarea#cfq_<id>` + `button#cfq_btn_<id>` («ثبتِ پاسخ») + `span#cfq_status_<id>` — بدونِ inputِ کهنه |
| کلیکِ «ثبتِ پاسخ» با متنِ معتبر | ✅ دقیقاً یک `PATCH /api/clients/c1/case-file` با `{fieldId:'question.q1.answer',action:'edit',value:'بله، سرترالین ۵۰ میلی‌گرم'}` |
| بعدِ پاسخِ موفق | ✅ `renderCaseFile()` صدا زده شد؛ آیتمِ سوال از DOM حذف شد (طبقِ تصمیمِ مالک) |
| ثبتِ پاسخِ خالی/فقط‌فاصله | ✅ بنرِ خطا («پاسخ نمی‌تواند خالی باشد»)؛ سوال در لیست ماند؛ **صفر** فراخوانیِ `api()` |

## محدودیت‌هایِ این تست
- بدونِ سرور/DB/حسابِ واقعی — `api()` mock بود؛ endpointِ واقعیِ `caseFile.routes.ts` با
  هارنسِ خودکار (نه Browser) تست شد.
- end-to-endِ کاملِ LLMِ واقعی (پاسخ واقعاً در axes/medication ظاهر شود، دکمه‌ی
  «به‌روزرسانی» واقعاً regenerate کند) تست نشد — نیازمندِ OpenRouterِ واقعی + حسابِ canary
  است؛ فقط با خواندنِ دقیقِ pipeline + هارنس (T6) تأیید شد.

## نتیجه‌گیری
هر دو مشکلِ گزارش‌شده (فیدبکِ UI، و پاسخ که هیچ‌وقت در پرونده اثر نمی‌کرد) رفع شدند؛ رفتار
دقیقاً طبقِ سه تصمیمِ صریحِ مالک پیاده شد. تأییدِ نهایی با یک regenerateِ واقعیِ canary
(وقتِ مالک) باقی مانده.
