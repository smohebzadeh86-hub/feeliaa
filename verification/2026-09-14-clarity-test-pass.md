# Verification — Clarity integration, local test pass (no deploy)

> **نوع:** Evidence (طبقِ LAW-019: مشاهده در یک لحظه، نه حقیقتِ فعلی).
> **تاریخ:** 2026-09-14 · **شاخه:** `feat/clarity` (commit‌نشده) · **درخواستِ مالک:** «فعلاً چیزی دیپلوی نشه ولی تست‌های کامل صورت بگیره».
> **محدودیتِ این اجرا:** هر دو MCP browser server این نشست (`Claude Browser` و `Claude in Chrome`) به‌خاطرِ تعارضِ نام غیرفعال بودند؛ پس تستِ کلیک‌کردنِ واقعی در مرورگر ممکن نشد. جایگزین: هارنسِ Node.jsِ sandboxی که خودِ `public/feelia-analytics.js` را بدونِ تغییر در `vm.createContext` اجرا می‌کند (پایین‌تر) — پوششِ state machine دقیق‌تر از کلیک دستی است، ولی رفتارِ واقعیِ DOM/CSS/مرورگر را تست نمی‌کند.

## ۱. Typecheck و Build

```
cd server && npx tsc --noEmit   → بدونِ خطا (exit 0)
pnpm --filter server build      → موفق (exit 0)، شاملِ کپیِ migrationها
```

## ۲. `pnpm test:rt` (هارنسِ رسمیِ پروژه)

**29 PASS / 6 FAIL** — دقیقاً همان الگویی که در [PROJECT_MASTER_REFERENCE.md §20](../PROJECT_MASTER_REFERENCE.md) قبلاً ثبت شده بود (T2 یکی، T15 سه‌تا، T16 دوتا). این ۶ شکست به Clarity ربطی ندارند؛ به صفِ IndexedDB/batch-fallback در `feelia-rt.js` مربوطند که در این task دست نخورده.

## ۳. Static checks روی `public/index.html` و `public/feelia-analytics.js`

| بررسی | نتیجه |
|---|---|
| Syntax فایلِ `feelia-analytics.js` (`node --check`) | OK |
| Syntax بلاکِ `<script>` اینلاینِ `index.html` (استخراج و `node --check`) | OK |
| تعدادِ `data-clarity-mask="true"` | ۳۵ |
| تعدادِ `data-clarity-unmask` | ۰ (طبقِ LAW-011 باید همیشه صفر باشد) |
| تعدادِ فراخوانیِ `uxTrack('...')` | ۳۱ |
| هر رویدادِ فراخوانی‌شده در `index.html` داخلِ `EVENTS` در `feelia-analytics.js` هست؟ | بله — `missing_from_allowlist = []` |

## ۴. تستِ Route: `GET /api/client-config`

با `server/dist/http/clientConfig.js` واقعی و `fastify.inject` (بدونِ DB/شبکه):

- بدونِ auth → 401
- بدونِ `CLARITY_PROJECT_ID` → `{clarity:null}` + `Cache-Control: no-store`
- `CLARITY_PROJECT_ID` معتبر (با فاصله‌ی اضافی) → trim شده برگردانده می‌شود
- ادمین → همیشه `{clarity:null}`، حتی با env معتبر
- ۵ مقدارِ خصمانه/بدشکل (`ABC123XYZ9`, یک XSS، URL، خیلی کوتاه، دارایِ space) → همه رد شدند

**۱۰ از ۱۰ PASS.**

## ۵. تستِ end-to-end با Project ID واقعی

Project ID که مالک داد (`yhujhtp8rn`) روی یک mock backend محلی (کدِ واقعیِ `public/` را سرو می‌کند، بدونِ حساب/رمزِ واقعی) ست شد:

```
GET /api/client-config  →  {"clarity":{"projectId":"yhujhtp8rn"}}
```

فرمت با regexِ سرور (`^[a-z0-9]{6,20}$`) مطابقت دارد — یعنی همین مقدار در `.env` بدونِ نیازِ تغییرِ کد کار می‌کند.

## ۶. هارنسِ sandbox برایِ `feelia-analytics.js` (۴۱ assertion)

`public/feelia-analytics.js` بدونِ هیچ تغییری در `vm.createContext` با `window`/`document`/`localStorage`/`fetch` جعلی اجرا شد. همه‌ی توابعِ عمومی (`boot`, `screen`, `event`, `micError`, `grant`, `deny`, `toggleConsent`, `onLogout`, `state`) فراخوانی شدند.

**۴۱ از ۴۱ PASS**، از جمله:

- ادمین: هرگز `fetch('/api/client-config')` صدا زده نمی‌شود؛ state = `disabled`.
- بدونِ `CLARITY_PROJECT_ID` / خطایِ ۵۰۰ / پرتاب‌شدنِ fetch / timeout → همه → `disabled`، بدونِ throw.
- Project ID خصمانه از سرور (`<script>`, بیش از ۲۰ کاراکتر، حروفِ بزرگ) در سمتِ کلاینت هم رد می‌شود (دفاعِ دولایه).
- رضایت داده نشده → **دقیقاً صفر** تگِ اسکریپت تزریق می‌شود.
- رضایت داده شده → **دقیقاً یک** تگِ اسکریپت با `src=https://www.clarity.ms/tag/abc123xyz9`؛ `boot()` تکراری تگِ دوم نمی‌سازد.
- `consentv2` دقیقاً یک‌بار با `{ad_Storage:'denied', analytics_Storage:'granted'}` ارسال می‌شود؛ `identify` هرگز صدا زده نمی‌شود.
- رد کردنِ رضایت → `clarity('consent', false)`؛ آفلاین‌شدنِ بعدی هم state را `denied` نگه می‌دارد.
- Logout بعد از رضایت → گزارش می‌دهد که reload لازم است (برای جلوگیری از نشتِ recording به کاربرِ بعدی).
- یک لاگِ کاملِ فراخوانی (screen tracking + همه‌ی رویدادهای اصلی) برایِ رشته‌های canary/شماره/ایمیل/UUID اسکن شد — **صفر نشتی**.
- `mic_error` فقط نامِ `DOMException` را حمل می‌کند؛ رشته‌ی دلخواه/PII-شکل به `other` نگاشت می‌شود.

## ۷. چه چیزی تست **نشد** (صادقانه)

- کلیک واقعی در مرورگر (banner رضایت، toggle، صفحه‌ی Live) — به‌خاطرِ غیرفعال‌بودنِ MCP browser در این نشست.
- دریافت واقعیِ `POST https://www.clarity.ms/tag/...` و `collect` از یک session واقعی — نیازمندِ دسترسیِ خودِ Clarity است که در audit قبلی از VPS تأیید شد ولی از این نشست انجام نشد (بدونِ تغییرِ production).
- میکروفون/جلسه‌ی زنده با Soniox — خارج از scopeِ Clarity و نیازمندِ سخت‌افزار/حساب.

## نتیجه

هیچ تغییری در کد داده نشد؛ **هیچ deploy/push/restartی انجام نشد**. Clarity در همه‌ی مسیرهایی که قابلِ اجرا بود (typecheck، build، rt-harness، mask/allowlist استاتیک، route واقعی، و state machineِ کاملِ `feelia-analytics.js`) بدونِ regression تأیید شد.
