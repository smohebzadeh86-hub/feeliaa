# docs/ — مستنداتِ فیلیا

نقطه‌ی شروع: [`../CLAUDE.md`](../CLAUDE.md) و [`../PROJECT_MASTER_REFERENCE.md`](../PROJECT_MASTER_REFERENCE.md).
وضعیتِ زنده و Event Log: [`../PROJECT_STATUS.md`](../PROJECT_STATUS.md) — **هر رویداد باید آن‌جا ثبت شود** (LAW-024).

| لایه | محتوا | اعتبار |
|---|---|---|
| [00-governance](00-governance/documentation-map.md) | قوانین (LAW-xxx)، source of truth، راهنمای agent، نقشه‌ی اسناد | بالاترین |
| [01-architecture](01-architecture/system-architecture.md) | معماریِ سیستم/اپلیکیشن/داده/یکپارچه‌سازی/استقرار | بالا |
| [02-reference](02-reference/api-catalog.md) | catalogهای استخراج‌شده از کد | متوسط (کد برنده است) |
| [03-requirements](03-requirements/requirement-catalog.md) | REQ-xxx و traceability | بالا (فعلاً DERIVED) |
| [04-modules](02-reference/module-map.md) | PRD (WHAT/WHY) + Implementation Plan (HOW) — ۹ ماژول | بالا |
| [05-plans](05-plans/master-implementation-plan.md) | ترتیبِ کلیِ کارها | PROPOSED |
| [06-platform](06-platform/README.md) | cross-cutting (LLM، obs/audit، notifications، session-media) | بالا |
| [07-subsystems](07-subsystems/README.md) | briefهای فنیِ پرریسک | بالا |
| [feature-index](02-reference/feature-index.md) | **رجیستریِ فیچرها** (feature ↔ کد ↔ سند ↔ تست ↔ جدول) — نقطه‌ی شروعِ هر task | بالا |
| [analytics-clarity.md](analytics-clarity.md) | مشخصاتِ تفصیلیِ Clarity (allowlist، mask) | بالا — مالکِ آن factها |
| [admin-panel.md](admin-panel.md) | سندِ طراحیِ اولیه‌ی پنل ادمین | **HISTORICAL** — استفاده نکنید |

قاعده: **One fact → One canonical owner.** اگر fact را در دو سند می‌بینی، مالکش را از [documentation-map](00-governance/documentation-map.md) پیدا کن.
Evidence (گزارش تست/بررسی) در [`../verification/`](../verification/README.md) است، نه اینجا.
