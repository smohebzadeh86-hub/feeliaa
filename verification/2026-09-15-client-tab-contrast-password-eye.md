# Verification — کنتراستِ تبِ فعال/غیرفعالِ مراجعین + آیکونِ نمایشِ رمز (2026-09-15)

> Evidence — مشاهده در یک لحظه، نه حقیقتِ دائمی (LAW-019). پلن: در همینِ گفتگو (بدونِ فایلِ pers مجزا) — audit → پلنِ سه‌بخشی (تبِ فعال/غیرفعال، چشمِ رمز، بررسیِ «بدونِ بوردر») تأییدشده توسطِ مالک → اجرا (فقط دو موردِ اول؛ موردِ سوم تحلیلی بود و اجرا نشد، طبقِ خودِ پلن).

## دامنه
فقط `public/index.html`. `feelia-analytics.js`، `feelia-rt.js`، backend لمس نشدند.

## چه چیزی عوض شد

### ۱. کنتراستِ تبِ فعال/غیرفعال (`.client-tabs`, `.client-tab`)
- **علتِ ریشه‌ای:** `.client-tab.active{background:var(--card)}` روی زمینه‌ی ظرفِ `var(--field)` — در تمِ روشن `#ffffff` روی `#fbfcfa` (کنتراستِ ~۱٫۰۳:۱)، در تمِ تاریک `#1c2320` روی `#171d1a` (مشابه). زیرِ حداقلِ ۳:۱ برایِ اجزای غیرمتنی (WCAG 1.4.11).
- **تعمیر:** تبِ فعال با `background:var(--sage)` + متنِ سفید پُر می‌شود — هم‌راستا با الگویِ موجودِ `.cat-seg button.active` و `.step.active` در همینِ فایل و با قاعده‌ی خودِ `feelia-design-system.html` («--sage = رنگِ تأکیدی اصلی … تب فعال»). بوردرِ ظرفِ `.client-tabs` حذف شد. `role="tablist"`/`role="tab"`/`aria-selected` اضافه شد و در `switchClientTab()` به‌روزرسانی می‌شود.
- **فایل/خط:** [public/index.html:114-127](../public/index.html) (CSS)، [public/index.html:491-492](../public/index.html) (HTML)، `switchClientTab()` (JS).

### ۲. آیکونِ نمایش/پنهان‌کردنِ رمز (`.pw-field`, `.pw-toggle`)
- **مشکل:** `#authPassword` هیچ راهی برای دیدنِ متنِ تایپ‌شده نداشت.
- **تعمیر:** الگوی `.search-box` تکرار شد (wrapper نسبی + دکمه‌ی absolute + `padding-left:44px` روی input برای رزروِ فضا). آیکونِ جدید `IC_EYE_OFF` کنارِ `IC_EYE` موجود اضافه شد. `togglePasswordVisibility()`/`resetPasswordVisibility()` جدید؛ ریست به `type="password"` بعد از هر ورود/ثبت‌نامِ موفق (`submitAuth`) و بعدِ هر `toggleAuthMode()`. `input::-ms-reveal{display:none}` برای جلوگیری از تداخل با چشمِ داخلیِ Edge.
- **فایل/خط:** [public/index.html:405-408](../public/index.html) (HTML)، CSS نزدیکِ `.search-box`، `IC_EYE_OFF` نزدیکِ `IC_EYE`، `togglePasswordVisibility`/`resetPasswordVisibility` نزدیکِ `toggleAuthMode`.

### مستنداتِ به‌روزشده
`feelia-design-system.html` — دو `rule.bad`/`rule.good` جدید در بخشِ «۰۸ — لغزش‌گاه‌های واقعی» (کنتراستِ حالتِ انتخاب‌شده + کامپوننتِ `.pw-toggle`) + یک آیتمِ جدید در چک‌لیستِ §۰۹.

## تست‌های واقعی اجراشده

### ۱. Syntax
دستور: استخراجِ بلوکِ `<script>` از `index.html` با regex و `node --check` روی خروجی.
نتیجه: **SYNTAX_OK**.

### ۲. Typecheck سرور (کنترل — سرور لمس نشد)
دستور: `cd server && npx tsc --noEmit`
نتیجه: **بدونِ خطا**.

### ۳. Harness رونویسیِ زنده (baseline بدونِ رگرسیون)
دستور: `pnpm test:rt`
نتیجه: **29 PASS / 6 FAIL** — دقیقاً همان baselineِ مستندشده در [PROJECT_STATUS §۱](../PROJECT_STATUS.md)؛ ۶ شکستِ موجود (T15×3، T16×2 و مشابه) از قبل مستندند و نامرتبط با این تغییرِ UI.

### ۴. تستِ تعاملیِ مرورگری — mock backend، بدونِ حساب/رمز/دادهٔ واقعی
سرورِ mock موقتی در اسکرچ‌پد (Node http، فقط `/api/auth/me` و `/api/clients` با دادهٔ canary: `A001`/`A002` فعال، `A003` غیرفعال؛ سایرِ `/api/*` با `200 {}`) — بعد از تست، پروسه با `taskkill` متوقف و فایل در اسکرچ‌پد باقی ماند (خارج از repo).

| بررسی | نتیجه |
|---|---|
| تبِ «فعال» پیش‌فرض، پُر با `--sage`، متن سفید | ✅ اسکرین‌شات |
| کلیک روی «غیرفعال» → پُرشدنِ همان تب، «فعال» به حالتِ خاموش برمی‌گردد، مراجعِ A003 نشان داده می‌شود | ✅ اسکرین‌شات |
| `aria-selected` بعدِ سوییچ (`getAttribute` مستقیم در صفحه) | `active=false` / `inactive=true` ✅ |
| رنگِ محاسبه‌شده‌ی تبِ فعال (`getComputedStyle`) | `background-color: rgb(78,137,119)` (=`--sage` در تمِ تاریک)، `color: rgb(255,255,255)` ✅ |
| تمِ روشن + عرضِ موبایل (۳۷۵px) | ✅ اسکرین‌شات — بدونِ سرریزِ افقی، هر دو تب خوانا |
| تایپِ رمزِ تستی (`testpass123`) → متن زیرِ آیکون نمی‌رود | ✅ اسکرین‌شات (بدونِ overlap) |
| کلیک روی چشم → `input.type` از `password` به `text`، آیکون به `IC_EYE_OFF`، `aria-pressed=true` | ✅ `javascript_tool` + zoom (متنِ `testpass123` خواناست) |
| جابه‌جاییِ «ثبت‌نام کنید» → `resetPasswordVisibility` اجرا می‌شود | `type` دوباره `password`، `aria-pressed=false` (مقدارِ فیلد دست‌نخورده می‌ماند — رفتارِ مطلوب) ✅ |

میکروفون/جلسه‌ی زنده تست نشد (خارج از دامنه‌ی این تغییر؛ Browser pane هم دسترسیِ میکروفون ندارد).

## کارِ بازِ عمدی (طبقِ پلن، اجرا نشد)
بخشِ ۳ پلن («بدونِ بوردر») فقط تحلیلِ نقادانه بود — نتیجه: پیشنهادِ «کم‌بوردر» به‌جای «بی‌بوردر»، مشروط به تعریفِ توکنِ سطحِ جدید در `feelia-design-system.html` پیش از هر تغییرِ کد. تا دستورِ صریحِ بعدیِ مالک، دست‌نخورده ماند.

## عامل
این نشست.
