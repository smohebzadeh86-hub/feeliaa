# Platform — Implementation Plan

> **وضعیت:** ACTIVE-CANONICAL (بخشِ Current State) · بخش‌های «Proposed» = **PROPOSED**، نیازمندِ تأییدِ مالک.

## Current State
پلتفرم کار می‌کند و typecheck تمیز است؛ شکاف‌ها در امنیتِ لایه‌ی HTTP، لاگِ حساس، سقفِ آپلود، و پاکسازیِ فایل‌ها.

## Code Anchors
| موضوع | فایل / symbol |
|---|---|
| bootstrap | `server/src/index.ts` (`app.register(multipart)`، `start()`) |
| auth | `server/src/auth/guard.ts` (`registerAuthContext`، `requireAuth`، `requireAdmin`)، `session.ts`، `password.ts` |
| مالکیت | `server/src/db/ownership.ts` |
| DB | `server/src/db/connection.ts` (`query`)، `migrate.ts` (`runMigrations`، `resolveMigrationsDir`) |
| build | `server/scripts/copy-assets.mjs` |
| sweeperها | `batchqueue.ts#sweepOldBatchFiles`، `sessionAudioArchive.ts#sweepOldSessionAudio`، `speakerResolve.ts#sweepOldResolveJobs` |
| لاگِ حساس | `server/src/http/sessions.ts` خطوطِ `[diag-transcript]` |

## Architecture Impact
تغییراتِ پیشنهادی داخلِ همان پروسه و بدونِ dependencyِ جدیدِ اجباری‌اند (بجز rate-limit که می‌تواند in-memory باشد).

## Proposed Changes

| # | تغییر | REQ/LAW | Data/Schema | Backend | Frontend | ریسک |
|---|---|---|---|---|---|---|
| PL-1 | حذفِ لاگ‌های `DIAG-TEMP` یا حذفِ `tail` از آن‌ها | REQ-099، LAW-023 | — | `sessions.ts` | — | پایین |
| PL-2 | تعیینِ صریحِ سقفِ multipart (`limits.fileSize`) متناسب با بیشترین سگمنت/voice-note (تصمیمِ عدد با مالک) و هماهنگی با nginx | REQ-100 | — | `index.ts` | — | پایین؛ باید nginx هم بررسی شود |
| PL-3 | حذفِ فایل‌های صدا هنگامِ حذفِ جلسه/مراجع/تراپیست + sweepِ فایل‌های یتیمِ بدونِ ردیف | REQ-093، LAW-010 | — | `sessions.ts`، `clients.ts`، `admin.ts`، `sessionAudioArchive.ts` | — | متوسط (عملیاتِ حذف؛ LAW-006 برای اجرای روی prod) |
| PL-4 | `secure: true` روی کوکی در production (بر اساسِ env یا `trustProxy`) | P-3 | — | `http/auth.ts` | — | متوسط (dev روی http) |
| PL-5 | rate-limit برای login/register (in-memory مثلِ `mintHits`) | P-3 | — | `http/auth.ts` | — | پایین |
| PL-6 | security headers (حداقل `X-Content-Type-Options`، `Referrer-Policy`؛ CSP با allowlistِ Clarity/Fonts/Soniox) | P-3 | — | hook در `index.ts` یا nginx | ممکن است inline handlerها CSP سخت را بشکنند | متوسط |
| PL-7 | اعتبارسنجیِ UUID برای پارامترها → 404 به‌جای 500 | P-8 | — | helper مشترک | — | پایین |
| PL-8 | حذفِ پیش‌فرضِ credentialدارِ `DATABASE_URL` (fail-fast اگر تنظیم نشده) | P-3 | — | `connection.ts` | — | پایین؛ dev باید `.env` داشته باشد |
| PL-9 | پاکسازیِ دوره‌ایِ `auth_sessions` منقضی | P-7 | — | sweeper | — | پایین |
| PL-10 | pin کردنِ Node/pnpm (`engines`، `packageManager`) | P-10 | — | package.json | — | پایین |
| PL-11 | اجرای هر migration داخلِ transaction | LAW-007 | — | `migrate.ts` | — | پایین (بعضی DDLها؛ بررسی لازم) |

## API Changes
PL-7 رفتارِ پاسخ به UUIDِ نامعتبر را از 500 به 404 تغییر می‌دهد → [error-code-catalog](../02-reference/error-code-catalog.md).

## Integration Changes
PL-6: CSP باید `connect-src wss://stt-rt.soniox.com` (و EU در صورتِ استفاده)، Clarity (طبقِ `docs/analytics-clarity.md` §9) و Google Fonts را مجاز کند.

## Migration Strategy
هیچ‌کدام migration لازم ندارند.

## Testing Strategy
- ایجادِ حداقل تست‌های backend (پیشنهاد: `node:test` + Fastify `inject` با DBِ آزمایشی) برای guardها، مالکیت، CAS، سقفِ آپلود.
- `npx tsc --noEmit` پس از هر تغییر.

## Deployment Strategy
PL-2/PL-4/PL-6 وابسته به کانفیگِ nginx واقعی‌اند → اول [deployment-operations](../01-architecture/deployment-operations.md) تأیید شود.

## Risks
PL-3 روی داده‌ی واقعی destructive است؛ PL-6 ممکن است UI را بشکند.

## Rollback Strategy
همه با revertِ commit قابلِ‌بازگشت‌اند (بدونِ schema).

## Verification Checklist
- [ ] grep برای `diag-transcript` خالی
- [ ] آپلودِ سگمنتِ 1.5MB پذیرفته/رد طبقِ سقفِ تصمیم‌شده
- [ ] حذفِ جلسه‌ی آزمایشی → پوشه‌ی `data/session-audio/<id>` حذف
- [ ] ۶ تلاشِ ناموفقِ login → 429
- [ ] `Set-Cookie` در prod شاملِ `Secure`

## Documentation Updates
configuration-catalog، error-code-catalog، api-catalog، requirement-catalog (وضعیتِ REQ-093/099/100)، PROJECT_MASTER_REFERENCE §22.
