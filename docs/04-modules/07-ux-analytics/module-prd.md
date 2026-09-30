# Module 07 — UX Analytics (Microsoft Clarity) · PRD

> **وضعیت:** ACTIVE-CANONICAL · REQ-080…084 · **مالکِ جزئیات** (فهرستِ رویدادها، screenها، mask، env، CSP): [`docs/analytics-clarity.md`](../../analytics-clarity.md). این PRD آن‌ها را تکرار نمی‌کند.

> last-verified: 2026-09-30 @ `17d6919` · مالک: [feature-index](../../02-reference/feature-index.md) (`client-config`) · قالب: [feature-doc-template](../../00-governance/feature-doc-template.md) (LAW-026)

### چرا — تصمیم‌هایِ ثبت‌شده
- (D1، 2026-09-15، مالک — نقضِ آگاهانه‌ی نسخه‌ی قبلیِ LAW-011) Clarity با `projectId` معتبر و کاربرِ غیرادمین **بدونِ پرسیدنِ اجازه** فعال می‌شود؛ `feelia_ux_consent_v1` دیگر در کد نیست.
- فقط رویدادِ بدونِ پارامترِ allowlistشده؛ `data-clarity-mask` رویِ هر containerِ حساس؛ هرگز `identify`.
- `FeeliaObs` (رصدِ خودمان) نقضِ آگاهانه‌ی دیگر و در [observability-audit](../../06-platform/observability-audit.md).

### مرزها
- `features/client-config/` **`index.ts` ندارد** (allowlist LAW-025)؛ route مستقیم از `app.ts`. فرانت: `feelia-analytics.js` (`window.FeeliaAnalytics`) + `feelia-obs.js`.

### کد
- Backend: `features/client-config/clientConfig.routes.ts` (`GET /api/client-config`). Frontend: `public/feelia-analytics.js` (`EVENTS`، `SCREENS`، `boot`، `activate`)، `uxTrack`/`showScreen` در `index.html`.

### داده
- بدونِ جدول. بدونِ storage (رضایتِ localStorage حذف شد).

### تست
- harnessِ اختصاصی ندارد؛ mock backend در scratchpad (بدونِ حساب) و بررسیِ شبکه؛ `clarity.ms` از شبکه‌ی dev در دسترس نیست (verify از VPS).

### ریسک و بدهی
- container جدیدِ بدونِ mask ⇒ نشتِ داده؛ کاربرانِ ایران احتمالاً Clarity را لود نمی‌کنند (داده‌ی سوگیرانه).

## Problem
تیم نمی‌داند تراپیست‌ها کجای UI گیر می‌کنند (rage/dead click، رها کردنِ funnel)، ولی داده‌ی اپ بالینی است و هیچ محتوایی نباید به سرویسِ analytics برسد.

## Goal
دیدِ رفتاری از UI فقط با رضایتِ خودِ تراپیست، بدونِ هیچ داده‌ی بالینی/شناسه، و بدونِ هیچ اثری روی پایداریِ اپ.

## Users / Actors
تراپیستِ غیرادمین (ضبط‌شونده و دهنده‌ی رضایت)؛ تیمِ محصول (بیننده در داشبوردِ Clarity)؛ Microsoft Clarity.

## Use Cases
| UC | شرح |
|---|---|
| UC-07.1 | تراپیست کارتِ رضایت را روی صفحه‌ی مراجعین می‌بیند و اجازه می‌دهد/رد می‌کند |
| UC-07.2 | تراپیست از لینکِ پایینِ صفحه تحلیل را روشن/خاموش می‌کند |
| UC-07.3 | مالک با پاک‌کردنِ `CLARITY_PROJECT_ID` کلِ سیستم را خاموش می‌کند |

## Business Rules
REQ-080…084، LAW-011. رضایتِ Clarity رضایتِ **تراپیست** برای ضبطِ رفتارِ خودش است و از رضایتِ بالینیِ مراجع کاملاً جداست.

## Functional Requirements
طبقِ [`docs/analytics-clarity.md`](../../analytics-clarity.md) §2–§7.

## Non-Functional Requirements
fail-open کامل؛ هیچ `await` در مسیرِ اپ؛ حداکثر یک تزریقِ اسکریپت در هر بارگذاری؛ timeoutِ config ۳s.

## Permissions
`GET /api/client-config` نیازمندِ نشست؛ برای ادمین همیشه `null`.

## States
`off → pending → ask | denied | active | disabled` (`feelia-analytics.js`).

## Validation
Project ID با `^[a-z0-9]{6,20}$` هم در سرور و هم در کلاینت.

## Dependencies
ماژول 01 (login/logout)، `showScreen`، `index.html` (mask)، شبکه‌ی کاربر (`clarity.ms` از شبکه‌ی dev بلاک است).

## Acceptance Criteria
- [ ] قبل از رضایت هیچ درخواستی به `clarity.ms` نمی‌رود.
- [ ] ادمین هیچ درخواستی به `clarity.ms` ندارد.
- [ ] رویدادِ خارج از allowlist ارسال نمی‌شود؛ هیچ رویدادی پارامتر ندارد.
- [ ] در recording همه‌ی متن‌های بالینی masked‌اند (نیازمندِ بررسی از شبکه‌ای که به Clarity دسترسی دارد).
- [ ] logout پس از فعال‌بودن → reload.

## Out of Scope
Google Analytics، identify کاربر، heatmapِ صفحاتِ ادمین، ضبطِ صفحه‌ی Auth، analytics سمتِ سرور.
