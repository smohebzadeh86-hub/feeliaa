# Module 01 — Therapist Accounts · PRD

> **وضعیت:** ACTIVE-CANONICAL · REQ-001…008 · مکانیزم‌های مشترکِ auth: [platform-prd](../../06-platform/platform-prd.md) · PRD = WHAT/WHY.
> **به‌روزرسانی (2026-09-15، تصمیمِ مالک D3):** نام و تخصص برایِ ثبت‌نامِ **جدید** الزامی شدند
> (ایمیل هنوز اختیاری). حساب‌های موجود که این فیلدها را نداشتند دست‌نخورده می‌مانند —
> بدونِ migration/`NOT NULL` در DB. UC-01.1 و REQ-003 زیر طبقِ همین تصمیم اصلاح شدند.

> last-verified: 2026-09-30 @ `17d6919` · مالک: [feature-index](../../02-reference/feature-index.md) (`auth`) · قالب: [feature-doc-template](../../00-governance/feature-doc-template.md) (LAW-026)

### چرا — تصمیم‌هایِ ثبت‌شده
- ثبت‌نام باز برایِ همه و بدونِ بازیابیِ رمز/OTP (وضعیتِ موجود، تصمیمِ صریحِ مالک ثبت نشده — UNKNOWN).
- اولین ادمین با `ADMIN_PHONE` (bootstrap)، نه سیستمِ auth دوم.
- (تصمیمِ مالک D3، 2026-09-15) نام و تخصص در ثبت‌نامِ جدید اجباری است (بدونِ `NOT NULL` در DB).
- غیرفعال‌سازیِ حساب فوراً اثر می‌کند (resolveِ نشست هر درخواست `active` را می‌خواند).

### مرزها
- `features/auth/` **`index.ts` ندارد** ([LAW-025](../../00-governance/project-laws.md) allowlist)؛ `app.ts` مستقیم `auth.routes.ts` را import می‌کند (R3 مجاز).
- platform `server/src/auth/{guard,session,password}.ts` (R2: از features import نمی‌کند). `caseFileEnabled` در همان کوئریِ نشست resolve می‌شود.

### کد
- Backend: `features/auth/{auth.routes,therapists.repository}.ts`، `auth/*`. Frontend: `toggleAuthMode`، `submitAuth`، `logout`، `init`، `enterApp` ([frontend-map](../../02-reference/frontend-map.md)).

### داده
- مالک: `therapists`، `auth_sessions` (فقط SHA-256 توکن) — [database-catalog §۰](../../02-reference/database-catalog.md).

### تست
- harnessِ اختصاصی ندارد؛ فقط `test:api` (DBِ dev، با مجوزِ مالک) و `test:routes` (guardها).

### ریسک و بدهی
- نبودِ rate-limit برایِ login و CSP/security headers (R7)؛ `auth_sessions` منقضی پاک نمی‌شود (INFERRED)؛ `index.ts` برایِ feature ندارد.

## Problem
تراپیست‌ها باید با هویتی ساده و مرسوم در ایران (شماره‌ی موبایل) وارد شوند و داده‌ی بالینی‌شان از بقیه جدا بماند؛ مالکِ سیستم هم باید بتواند حساب‌ها را کنترل کند.

## Goal
ثبت‌نام و ورودِ سریع با موبایل و رمز، نشستِ ماندگار و امن، و قابلیتِ قطعِ فوریِ دسترسی.

## Users / Actors
- تراپیست (ثبت‌نام، ورود، خروج)
- مالکِ سرور (`ADMIN_PHONE`)
- ادمین (غیرفعال‌سازی — ماژول 06)

## Use Cases
| UC | شرح |
|---|---|
| UC-01.1 | تراپیستِ جدید با موبایل، رمز، نام، تخصص و (اختیاری) ایمیل ثبت‌نام می‌کند و بلافاصله وارد می‌شود (D3: نام/تخصص از 2026-09-15 الزامی‌اند) |
| UC-01.2 | تراپیست با موبایل و رمز وارد می‌شود |
| UC-01.3 | باز کردنِ دوباره‌ی اپ ظرفِ ۳۰ روز بدونِ ورودِ مجدد |
| UC-01.4 | خروج |
| UC-01.5 | مالک با شماره‌ی `ADMIN_PHONE` ادمین می‌شود |
| UC-01.6 | حسابِ غیرفعال‌شده دیگر نمی‌تواند کار کند |

## Business Rules
REQ-001 (موبایلِ ایرانی و یکتا)، REQ-002 (رمز ≥۸)، REQ-003 (فیلدهای اختیاری)، REQ-004 (پیامِ خطای یکسان و زمانِ یکسان)، REQ-005 (غیرفعال)، REQ-006 (نشست)، REQ-007 (خروج)، REQ-008 (ادمینِ bootstrap) — [requirement-catalog](../../03-requirements/requirement-catalog.md).

## Functional Requirements
1. فرمِ یکپارچه‌ی ورود/ثبت‌نام با سوییچِ حالت.
2. نرمال‌سازیِ ورودی‌های `+98…`، `0098…`، `98…`، با فاصله/خط‌تیره.
3. پس از ثبت‌نام/ورود: ورود به فهرستِ مراجعین؛ دکمه‌ی ادمین فقط برای ادمین.
4. `GET /api/auth/me` در بارگذاریِ صفحه برای بازیابیِ نشست.
5. خروج: نشستِ سرور حذف؛ اگر Clarity لود شده بود صفحه reload (ماژول 07).

## Non-Functional Requirements
- عدمِ افشای وجودِ شماره از طریقِ پیام یا زمان.
- رمز فقط هش‌شده؛ توکن فقط هش‌شده.
- پیام‌های فارسی.

## Permissions
register/login/logout: عمومی · me: نیازمندِ نشست.

## States
حساب: فعال / غیرفعال · نقش: تراپیست / ادمین · نشست: معتبر / منقضی.

## Validation
موبایل `^09\d{9}$` پس از نرمال‌سازی؛ ایمیل `^[^\s@]+@[^\s@]+\.[^\s@]+$`؛ رمز طول ≥۸.

## Dependencies
platform (کوکی، guard)، PostgreSQL، ماژول 06 (تغییرِ active/is_admin)، ماژول 07 (boot/logout).

## Acceptance Criteria
- [ ] شماره‌ی `+98 912-345-6789` به `09123456789` ذخیره می‌شود.
- [ ] ثبت‌نامِ تکراری → 409.
- [ ] رمزِ ۷ کاراکتری → 400.
- [ ] ورودِ اشتباه برای شماره‌ی موجود و ناموجود پیامِ یکسان.
- [ ] حسابِ غیرفعال: login → 403؛ درخواستِ بعدیِ نشستِ باز → 401.
- [ ] خروج → `GET /api/auth/me` 401.
- [ ] ورود با `ADMIN_PHONE` → `is_admin=true`.

## Out of Scope
بازیابی/تغییرِ رمز، OTP/پیامک، ویرایشِ پروفایل، حذفِ حساب توسطِ خودِ کاربر، 2FA، دعوت‌نامه (ثبت‌نام برای همه باز است).
