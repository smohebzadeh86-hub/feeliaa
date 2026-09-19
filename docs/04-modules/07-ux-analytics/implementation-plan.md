# Module 07 — UX Analytics · Implementation Plan

## Current State
پیاده‌سازی‌شده روی branch `feat/clarity`؛ کدِ برنامه commit شده (`public/feelia-analytics.js`، `server/src/http/clientConfig.ts`، تغییراتِ `index.html`/`index.ts` — در `2763414`). فقط سندِ `docs/analytics-clarity.md` خودش هنوز untracked است (مستندات، نه کد). evidence: [verification/2026-09-14-clarity-test-pass.md](../../../verification/2026-09-14-clarity-test-pass.md) — route inject 10/10، sandbox 41/41، mask/allowlist استاتیک OK. **تست‌نشده:** کلیکِ واقعی در مرورگر و payloadِ واقعیِ Clarity (`clarity.ms` از شبکه‌ی dev در دسترس نیست).

## Code Anchors
| لایه | anchor |
|---|---|
| server | `server/src/http/clientConfig.ts` (`CLARITY_PROJECT_ID_RE`، `clarityProjectId`، `GET /api/client-config`)؛ ثبت در `server/src/index.ts` |
| client | `public/feelia-analytics.js` (`EVENTS`، `SCREENS`، `MIC_ERRORS`، `boot`، `activate`، `injectScript`، `grant`، `deny`، `onLogout`، `renderUI`) |
| glue | `index.html`: `uxTrack`، `showScreen` → `FeeliaAnalytics.screen`، `enterApp` → `boot`، `logout` → `onLogout`، `runPreflight` → `micError`، `#uxConsentToggle`، `data-clarity-mask` |
| docs | `docs/analytics-clarity.md` |

## Architecture Impact
یک origin خارجیِ مشروط (LAW-014).

## Data / Schema Changes
ندارد (رضایت در localStorage).

## Backend Changes
ندارد.

## Frontend Changes (Proposed)
| # | تغییر |
|---|---|
| UX-1 | ~~ثبتِ evidence~~ انجام شد (2026-09-14). باقی: تستِ کلیکِ واقعی در مرورگر (بنرِ رضایت، toggle) با mock backend، و بررسیِ recording از شبکه‌ای که به Clarity دسترسی دارد |
| UX-2 | بررسیِ `#cancelModal` که `data-clarity-mask` ندارد (فقط متنِ ثابت دارد — احتمالاً بی‌خطر؛ تأیید) |

## API Changes
ندارد.

## Integration Changes
در صورتِ افزودنِ CSP: allowlistِ §9 سندِ Clarity.

## Migration Strategy
ندارد.

## Testing Strategy
mock backend در scratchpad که `public/` واقعی را سرو کند (بدونِ حسابِ واقعی)؛ بررسیِ درخواست‌های شبکه؛ بررسیِ recording از VPS/شبکه‌ی دیگر.

## Deployment Strategy
`CLARITY_PROJECT_ID` فقط در `.env` production (مسیرِ واقعیِ `.env` ابتدا تأیید شود — deployment-operations C3)؛ restart.

## Risks
هر container جدیدِ بدونِ mask = نشتِ داده به Clarity؛ کاربرانِ داخلِ ایران احتمالاً Clarity را لود نمی‌کنند (داده‌ی سوگیرانه).

## Rollback Strategy
پاک‌کردنِ `CLARITY_PROJECT_ID` + restart (خاموشیِ فوری).

## Verification Checklist
- [ ] `docs/analytics-clarity.md` §10 (دستی پس از deploy)
- [ ] grep: `data-clarity-unmask` و `identify` در repo = 0
- [ ] هر رویدادِ `uxTrack('…')` در `EVENTS` هست

## Documentation Updates
`docs/analytics-clarity.md` (مالک)، requirement-catalog، verification/.
