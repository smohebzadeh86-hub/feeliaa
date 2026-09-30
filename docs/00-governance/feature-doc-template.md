# Feature Doc Template — قالبِ اجباریِ سندِ هر فیچر

> **اعتبار:** ACTIVE-CANONICAL · قانونِ حاکم: [LAW-026](project-laws.md).
> هر feature (پوشه‌ی `server/src/features/*` یا قابلیتِ platform) دقیقاً **یک سندِ مالک** دارد که از این قالب پیروی می‌کند و در
> [`feature-index`](../02-reference/feature-index.md) ثبت است. سندِ مالک می‌تواند `module-prd.md`، یک subsystem، یا یک فایلِ `docs/06-platform/*.md` باشد.

## بخش‌هایِ ثابت (به همین ترتیب و با همین عنوان‌ها)

```markdown
# <نامِ فیچر>

> last-verified: YYYY-MM-DD @ <commit کوتاه> · مالک: <feature-index id> · وضعیت: ACTIVE-CANONICAL

## ۱. چرا (Why)
مسئله + تصمیم‌ها. هر تصمیم: تاریخ، تصمیم‌گیرنده، مرجع (Event Log / verification / کامنتِ کد).
منبع نبود ⇒ `UNKNOWN — نیازمندِ تأییدِ مالک`. هیچ «چرا»یی ساخته نمی‌شود.

## ۲. چه می‌کند (What)
رفتارِ قابلِ مشاهده برایِ کاربر/سیستم، بدونِ ثابتِ عددی (ثابت‌ها → configuration-catalog).

## ۳. مرزها (Boundaries)
- سطحِ عمومی: `features/<x>/index.ts` (نامِ exportها)
- وابستگی‌ها: کدام featureها/platform را import می‌کند و کدام‌ها او را
- قواعدِ R1–R7 ([LAW-025](project-laws.md)) که برایش مهم است

## ۴. کد (Code)
- Backend: فایل/تابع‌هایِ اصلی (نامِ symbol، نه شماره‌ی خط)
- Frontend: فایل + نامِ تابع‌ها/idهایِ مودال/stateهایِ global ([frontend-map](../02-reference/frontend-map.md))

## ۵. داده (Data)
- جدول‌هایِ **مالک** (فقط این feature می‌نویسد)
- جدول‌هایِ لمس‌شده (خواندن/نوشتنِ مجاز و دلیل)
- فایل/IndexedDB/localStorage اگر هست

## ۶. API و config
فقط لینک: [api-catalog](../02-reference/api-catalog.md)، [error-code-catalog](../02-reference/error-code-catalog.md)،
[configuration-catalog](../02-reference/configuration-catalog.md). عدد/ثابت اینجا تکرار نمی‌شود (LAW-027).

## ۷. تست (Tests)
harnessهایِ مربوط (`pnpm test:*`) + آنچه پوشش نمی‌دهند.

## ۸. ریسک و بدهی
موردهایِ باز، violationهایِ LAW، نقاطِ INFERRED.
```

## قواعد
1. بدونِ شماره‌ی خط؛ فقط نامِ فایل/symbol.
2. وضعیتِ commit/deploy در سندِ فیچر نمی‌آید؛ فقط `PROJECT_STATUS.md` (LAW-027).
3. بخشِ patchِ تاریخ‌دار («به‌روزرسانی 09-xx») ممنوع؛ تغییر در متنِ اصلی ادغام می‌شود و دلیلش در «چرا» می‌آید.
4. `last-verified` هر بار که سند با کد تطبیق داده شد به‌روز می‌شود؛ `pnpm test:docs` وجودِ آن را چک می‌کند.
