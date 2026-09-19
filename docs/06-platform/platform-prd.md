# Platform PRD

> **وضعیت:** ACTIVE-CANONICAL · REQها: REQ-005…008، REQ-010، REQ-090…100 در [requirement-catalog](../03-requirements/requirement-catalog.md) · WHAT/WHY — جزئیاتِ HOW در [implementation-plan](implementation-plan.md).

## Problem
داده‌ی بالینیِ چند تراپیست روی یک سرور مشترک نگهداری می‌شود؛ هر ضعفِ مشترک (auth، مالکیت، لاگ، نگهداریِ صدا، config) همه‌ی ماژول‌ها را هم‌زمان در معرضِ خطر قرار می‌دهد.

## Goal
یک پایه‌ی مشترک که: هویت را مطمئن احراز کند، دسترسی را به مالک محدود کند، secretها را محافظت کند، schema را قابلِ‌اعتماد تکامل دهد، داده‌ی حساس را از لاگ/analytics دور نگه دارد، و نگهداریِ صدا را محدود و قابلِ‌حسابرسی کند.

## Users / Actors
تراپیست، ادمین، اپراتورِ سرور (مالک)، سرویس‌های خارجی (Soniox، Clarity)، AI Agent/توسعه‌دهنده.

## Capabilities & Business Rules

### P-1 Authentication
- هویت = موبایل + رمز؛ نشستِ کوکیِ httpOnly ۳۰ روزه؛ توکن فقط به‌صورتِ هش در DB.
- `active=false` باید فوراً دسترسی را قطع کند (بدونِ نیاز به حذفِ نشست).
- اولین ادمین از `ADMIN_PHONE`.

### P-2 Authorization
- دو نقش: تراپیست، ادمین (فلگ).
- مالکیت روی client/session/note؛ غیرمالک → 404.
- ادمین از مسیرِ مجزا (`/api/admin/*`) دسترسیِ سراسری دارد؛ روت‌های تراپیست برای ادمین هم مالکیت‌محور می‌مانند.

### P-3 Security
- کلیدِ اصلیِ Soniox فقط سرور.
- کوئری‌های پارامتری.
- محافظتِ زمان‌بندی در login.
- **شکاف‌ها (از کد):** نبودِ rate-limit login، نبودِ `secure` روی کوکی، نبودِ CSP/HSTS/security headers، نبودِ CSRF token (اتکا به `sameSite=lax`)، credentialِ پیش‌فرض در `DATABASE_URL`، اعتبارسنجی نشدنِ UUIDها.

### P-4 Configuration
- همه‌ی تنظیمات از env در cwd؛ نبودِ کلیدِ اختیاری = قابلیت خاموش (Clarity، proxy)، نه کرش.
- catalog: [configuration-catalog](../02-reference/configuration-catalog.md).

### P-5 Data & Migration
- migrationهای SQLِ خام، خودکار در startup، idempotent، append-only (LAW-007).
- UTF8 اجباری.

### P-6 Logging & Observability
- لاگِ stdout با پیشوندِ حوزه؛ کوئریِ کند؛ لاگِ ممیزیِ mint بدونِ کلید.
- **ممنوع:** داده‌ی بالینی در لاگ (REQ-099 — violation فعلی).
- Health endpoint؛ diagnostic STT.
- **ناموجود:** metrics، alert، tracing، error tracking.

### P-7 Data Retention
- صفِ صدا ≤۲۴h؛ آرشیو ≤۱۴d؛ Soniox بلافاصله حذف؛ IndexedDB تا آپلود.
- حذفِ داده‌ی کسب‌وکاری باید صدای مرتبط را هم حذف کند (REQ-093 — ناقص).
- **ناموجود:** سیاستِ نگهداریِ transcript/لاگ، پاکسازیِ `auth_sessions` منقضی.

### P-8 Error Handling
- قالبِ یکسانِ `{error, code?}`؛ کدِ ماشینی فقط جایی که کلاینت تصمیم می‌گیرد.
- پس‌زمینه‌ها fail-safe (خطا در لاگ، بدونِ کرش).
- `pool.on('error')` برای جلوگیری از کرشِ پروسه.

### P-9 Egress
- همه‌ی ترافیکِ خروجیِ سرور به Soniox از `PROXY_URL` در صورتِ تنظیم.

### P-10 Runtime
- یک پروسه، یک instance (LAW-013)؛ migration در startup؛ sweeperها داخلِ پروسه.
- سقفِ حجمِ درخواست باید با اندازه‌ی سگمنت‌های صدا سازگار باشد (REQ-100 — فعلاً 1MiB پیش‌فرض).

## Non-Functional Requirements
| NFR | هدف | وضعیت |
|---|---|---|
| حریمِ خصوصی | هیچ داده‌ی بالینی خارج از DB/دیسکِ کنترل‌شده/Soniox | نقض: لاگ، متنِ رضایت |
| دسترس‌پذیری | شکستِ STT جلسه را متوقف نکند | IMPL |
| سازگاری | Chrome/Safari با HTTPS | راهنمای UI؛ تست نشده |
| زبان | فارسی/RTL | IMPL |
| مقیاس | یک instance | محدودیتِ آگاهانه |

## States
- نشست: معتبر / منقضی / حسابِ غیرفعال.
- سرور: starting (migrations) / running / degraded (DB قطع).

## Validation
ورودی‌ها در handlerها با شرط‌های دستی اعتبارسنجی می‌شوند؛ schema validation فاستیفای استفاده نمی‌شود.

## Dependencies
PostgreSQL، Soniox، ffmpeg (اختیاری)، reverse proxyِ HTTPS (UNVERIFIED).

## Acceptance Criteria
- درخواستِ بدونِ کوکی به روتِ تراپیست → 401؛ غیرادمین به ادمین → 403؛ منبعِ دیگری → 404.
- غیرفعال‌سازیِ حساب → درخواستِ بعدیِ آن حساب 401.
- سرور با DBِ قطع بالا نمی‌آید (exit 1)؛ در حینِ کار health=`degraded`.
- هیچ لاگی متنِ جلسه/یادداشت ندارد. **(فعلاً FAIL)**
- هیچ فایلِ صدایی بیش از ۱۴ روز روی دیسک نمی‌ماند. **(فعلاً FAIL برای فایل‌های یتیم — INFERRED)**

## Out of Scope
SSO/OAuth، 2FA، چند tenant، مقیاس‌پذیریِ افقی، رمزنگاریِ at-rest در سطحِ اپ.
