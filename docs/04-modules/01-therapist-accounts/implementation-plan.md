# Module 01 — Therapist Accounts · Implementation Plan

> Current State = ACTIVE-CANONICAL · Proposed = PROPOSED.

## Current State
کامل و در HEAD موجود، همه commit شده (`specialty` migration 010 و `guard.ts` در `2763414`). بدونِ تستِ خودکار.

## Code Anchors
| لایه | anchor |
|---|---|
| API | `server/src/http/auth.ts`: `normalizePhone`، `isValidEmail`، `publicTherapist`، `DUMMY_PASSWORD_HASH`، `ensureAdminFlag`، روت‌های register/login/logout/me |
| Core | `server/src/auth/password.ts` (scrypt)، `server/src/auth/session.ts` (`createSession`، `resolveSession`، `destroySession`)، `server/src/auth/guard.ts` |
| DB | migrationهای 004، 005، 006، 010 |
| UI | `public/index.html`: `#screenAuth`، `toggleAuthMode`، `submitAuth`، `logout`، `init`، `enterApp` |

## Architecture Impact
ندارد (تغییراتِ پیشنهادی محلی‌اند).

## Data / Schema Changes
ندارد.

## Backend Changes (Proposed)
| # | تغییر | مرجع |
|---|---|---|
| A-1 | rate-limit برای login/register | platform PL-5 |
| A-2 | `secure` روی کوکی در production | platform PL-4 |
| A-3 | پاکسازیِ `auth_sessions` منقضی | platform PL-9 |
| A-4 | (اختیاری) حذفِ همه‌ی نشست‌های حساب هنگامِ غیرفعال‌سازی — فعلاً لازم نیست چون `active` در هر درخواست چک می‌شود | — |

## Frontend Changes
ندارد.

## API Changes
A-1 پاسخِ 429 اضافه می‌کند → api-catalog، error-code-catalog.

## Integration Changes
ندارد.

## Migration Strategy
ندارد.

## Testing Strategy
تست‌های Fastify `inject`: نرمال‌سازی، 409، 400، 401 یکسان، 403 غیرفعال، 401 پس از غیرفعال‌سازی، `ADMIN_PHONE`، logout.

## Deployment Strategy
A-2 نیازمندِ دانستنِ اینکه TLS در nginx terminate می‌شود (`trustProxy`).

## Risks
A-2 می‌تواند ورود در devِ HTTP را بشکند اگر شرطِ محیط درست نباشد.

## Rollback Strategy
revertِ commit.

## Verification Checklist
- [ ] `npx tsc --noEmit`
- [ ] سناریوهای Acceptance Criteria در PRD با DBِ آزمایشی
- [ ] بدونِ ساختِ حسابِ واقعی روی production

## Documentation Updates
api-catalog، error-code-catalog، requirement-catalog، traceability-matrix، platform-prd.
