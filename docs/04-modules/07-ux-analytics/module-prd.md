# Module 07 — UX Analytics (Microsoft Clarity) · PRD

> **وضعیت:** ACTIVE-CANONICAL · REQ-080…084 · **مالکِ جزئیات** (فهرستِ رویدادها، screenها، mask، env، CSP): [`docs/analytics-clarity.md`](../../analytics-clarity.md). این PRD آن‌ها را تکرار نمی‌کند.

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
