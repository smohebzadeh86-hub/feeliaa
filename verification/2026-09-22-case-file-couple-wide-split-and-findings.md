# 2026-09-22 — پرونده‌ی روندِ درمان: دوستونه‌شدنِ کارتِ زوجین + رفعِ دو FINDING (مودالِ دارو، دکمه‌ی «بازکردنِ همه»)

## دامنه (به تصمیمِ صریحِ مالک)
سه گزارشِ UI از پرونده‌ی روندِ درمان بررسی شد. ابتدا فقط مورد (۳) پیاده‌سازی شد؛ (۱) و (۲) ابتدا فقط ریشه‌یابی و FINDING ثبت شدند. بعدِ تاییدِ بصریِ موردِ (۳) توسطِ مالک و دستورِ صریح («بقیشه باگ هارو هم فیکس کن»)، (۱) و (۲) هم در همین نوبت رفع و تست شدند.

## FINDING ۱ (رفع‌شده) — ردیفِ «در انتظار ثبت» اضافه هنگامِ افزودنِ دارو
ریشه: [public/index.html:1122](../public/index.html#L1122)
```html
<div id="cfAddItemFields" onkeydown="if(event.key==='Enter'){event.preventDefault();submitCfAddItem();}">
```
هندلر رویِ کلِ ظرفِ فرم است، نه رویِ یک اینپوتِ خاص. مودالِ دارو ۵ فیلد دارد. اگر تراپیست بعدِ تایپِ یک فیلد (معمولاً نام) Enter بزند، همان لحظه `submitCfAddItem()` با هر چه تا آن لحظه پر شده صدا زده می‌شود. چون فقط نامِ دارو در سرور اجباری است (`cleanText` در [applyFieldPatch.ts:211](../server/src/features/case-file/application/applyFieldPatch.ts#L211))، این submitِ ناقص موفق می‌شود، ردیفی با بقیه‌ی فیلدهایِ خالی می‌سازد و مودال را می‌بندد. تراپیست دوباره باز می‌کند و کامل ثبت می‌کند ⇒ دو ردیف (یکی «در انتظار ثبت» در همه‌ی زیرفیلدها، یکی کامل).

### رفع
`onkeydown` رویِ `#cfAddItemFields` ([public/index.html:1128](../public/index.html#L1128)) با `onkeydown="cfAddItemKeydown(event)"` جایگزین شد. تابعِ جدید:
```js
function cfAddItemKeydown(event){
  if(event.key!=='Enter')return;
  event.preventDefault();
  if(cfAddItemMode==='medication'&&(!event.target||event.target.id!=='cfai_prescriber'))return;
  submitCfAddItem();
}
```
در مودالِ `medication` فقط وقتی focus رویِ آخرین فیلد (`cfai_prescriber`) است submit می‌کند؛ در بقیه‌ی فیلدها فقط `preventDefault` می‌کند (نه submit، نه رفتارِ پیش‌فرضِ فرم). در مودال‌هایِ تک‌فیلدی (axis/roadmap) رفتارِ قبلی حفظ شد — Enter بلافاصله submit می‌کند.

## FINDING ۲ (رفع‌شده) — دکمه‌ی «بازکردنِ همه» با اینکه محورها بازند
ریشه: [public/index.html:4201](../public/index.html#L4201) — بعدِ `sec.innerHTML=html;` هیچ‌جا `cfSyncAllBtn()` صدا زده نمی‌شود. تابعِ sync (`cfSyncAllBtn`، [public/index.html:3889-3894](../public/index.html#L3889)) فقط بعدِ کلیکِ دستیِ کاربر (`cfSummaryClick`/`cfAxesAll`/`cfFocusNewItem`) اجرا می‌شود، نه بعدِ رندرِ اولیه. برچسبِ اولیه‌ی دکمه هم hardcode است ([public/index.html:4088](../public/index.html#L4088)). وقتی محورها به‌صورتِ پیش‌فرض باز می‌شوند (منطقِ `def` در [public/index.html:4095-4098](../public/index.html#L4095))، دکمه هنوز «بازکردنِ همه» نشان می‌دهد.

### رفع
یک خط `cfSyncAllBtn();` بلافاصله بعدِ `sec.innerHTML=html;` در انتهایِ `renderCaseFile()` اضافه شد (خودِ `cfSyncAllBtn` تغییر نکرد — فقط زودتر و در یک جایِ اضافه صدا زده می‌شود).

## تستِ FINDING ۱ و ۲
صفحه‌ی مستقلِ HTML دیگری (خارج از repo، در Browser pane) با کپیِ عینیِ هر دو تابعِ فیکس‌شده از سورس ساخته شد:
- **fixtureِ مودالِ دارو:** ۵ اینپوت با idهایِ واقعی (`cfai_name`…`cfai_prescriber`)، `submitCfAddItem` جایگزین با یک شمارنده.
- **fixtureِ محورها:** یک دکمه با `id="cfAxesAllBtn"` + ۳ عنصرِ `<details class="cf-axis">` (۲تا از قبل باز).

با `KeyboardEvent('keydown',{key:'Enter'})` واقعی (نه فراخوانیِ مستقیمِ تابع) رویِ هر فیلد:
| سناریو | نتیجه |
|---|---|
| Enter رویِ `cfai_name` (mode=medication) | submit نشد (۰ فراخوانی) |
| Enter رویِ `cfai_dose` (mode=medication) | submit نشد |
| Enter رویِ `cfai_prescriber` (آخرین فیلد، mode=medication) | submit شد (۱ فراخوانی) |
| Enter در مودالِ تک‌فیلدی (mode=axis) | بلافاصله submit شد |
| `cfSyncAllBtn()` با ۲ از ۳ محورِ باز | برچسب «بازکردنِ همه» ماند (allOpen=false) |
| بازکردنِ دستیِ هر ۳ (شبیه‌سازیِ پیش‌فرضِ رندرِ اولیه) + `cfSyncAllBtn()` دوباره | برچسب به «جمع‌کردنِ همه» عوض شد |

**۶/۶ PASS** (خروجیِ واقعیِ صفحه در Browser pane، نه ادعا).

### محدودیت‌هایِ این بخش (صادقانه)
- تست با کپیِ عینیِ توابع در fixtureِ مستقل بود، نه با `renderCaseFile`/DOMِ واقعیِ اپ روی سرورِ واقعی (چون ورود با حسابِ واقعی ممنوع است). اگر بعداً منطقِ اصلی تغییر کند بدونِ به‌روزکردنِ این fixture، ریسکِ divergence هست.
- `cd server && npx tsc --noEmit` صدا زده نشد چون تغییر فقط در `public/index.html` (بدونِ TypeScript) بود.

## مورد ۳ (پیاده‌سازی‌شده) — دوستونه‌شدنِ کارتِ بلندِ زوجین

### خواستِ مالک
عدمِ جمع‌شدن (بدونِ `<details>`) ولی وقتی کارت پرمحتوا می‌شود، به دو زیرمجموعه تقسیم شود — بدونِ بریدنِ وسطِ یک یافته/جمله.

### کد
- `public/index.html`:
  - `CF_COUPLE_WIDE_MIN_ITEMS=5` (کنارِ `CF_MAX_OPEN_AXES`).
  - در حلقه‌ی رندرِ فیلدهایِ `coupleRelationship`: `itemCount = f.items.length || تعدادِ خطوطِ غیرخالیِ f.value`؛ اگر `itemCount>=5` (و کارت نقل‌قول/حالتِ ویرایش نباشد) کلاسِ `cf-couple-wide` به کارت اضافه می‌شود.
  - CSS جدید:
    ```css
    @media (min-width:640px){
      .cf-couple-card.cf-couple-wide{grid-column:span 2}
      .cf-couple-card.cf-couple-wide .cf-couple-body{column-count:2;column-gap:22px}
    }
    .cf-couple-body .cf-rich-row,.cf-couple-body .cf-rich-s,.cf-couple-body .cf-rich-p{break-inside:avoid-column}
    .cf-couple-body .cf-role-head{break-after:avoid-column}
    ```

### تست
صفحه‌ی مستقلِ HTML با CSSِ واقعیِ استخراج‌شده از `public/index.html` (کاملِ بلوکِ `<style>`) + دادهٔ ساختگی (۱ کارتِ کوتاه با یک یافته، ۱ کارتِ بلند با ۶ یافته شاملِ یک متنِ چندخطیِ عمداً طولانی، ۱ کارتِ کوتاهِ دیگر) روی یک سرورِ Node استاتیکِ محلی (پورتِ 4899، خارج از repo، فقط برایِ تست) در Browser pane باز شد.

با `javascript_tool` (نه فقط اسکرین‌شات):
- کارتِ بلند: `grid-column:span 2` گرفت → عرضِ واقعی ۵۹۶.۷px در برابرِ ۲۹۳.۳px کارت‌هایِ کوتاه؛ `getComputedStyle(...).columnCount === '2'`.
- کارت‌هایِ کوتاه: `columnCount:'auto'`، عرضِ عادی — دست‌نخورده ماندند.
- با اندازه‌گیریِ `getBoundingClientRect()` هر ردیف داخلِ کارتِ بلند: هر ردیف (از جمله متنِ چندخطیِ ۱۶۶px‌ارتفاع «تعارض») یک بلاکِ کاملِ یک‌تکه ماند — هیچ ردیفی بینِ دو ستون بریده نشد؛ الگوریتمِ balance محتوا را رویِ مرزِ ردیف‌ها تقسیم کرد (۴ ردیفِ ستونِ چپ، ۲ ردیفِ ستونِ راست).

### محدودیت‌ها (صادقانه)
- رفتارِ زیرِ ۶۴۰px (mobile) فقط با خواندنِ CSS تایید شد، نه اجرایِ واقعی — `resize_window` رویِ این تبِ استاتیکِ محلی اثر نکرد (`window.innerWidth` بعدِ چند تلاش با preset‌هایِ مختلف هنوز ۹۸۰ ماند؛ به‌نظر محدودیتِ ابزار برایِ تب‌هایِ سرورِ استاتیکِ خارج از پروژه است، نه چیزِ مرتبط با CSSِ خودِ تغییر). از نظرِ کد این یک `@media (min-width:640px)` استانداردِ CSS است، مستقل از JS.
- تست با داده‌ی واقعیِ مراجع/DB انجام نشد (ممنوع بدونِ اجازه).
- `cd server && npx tsc --noEmit` صدا زده نشد چون تغییر فقط در `public/index.html` (فرانت، بدونِ TypeScript) بود.
- commit نشده.
