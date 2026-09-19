# Platform (Cross-cutting)

> **وضعیت:** ACTIVE-CANONICAL · قابلیت‌هایی که متعلق به یک feature خاص نیستند.

| سند | محتوا |
|---|---|
| [platform-prd.md](platform-prd.md) | WHAT/WHY: auth، authorization/مالکیت، امنیت، کانفیگ، DB/migration، لاگ/مشاهده‌پذیری، نگهداریِ داده، خطا، egress، runtime |
| [implementation-plan.md](implementation-plan.md) | HOW: وضعیتِ فعلی، anchorها، شکاف‌ها، ترتیبِ رفع |

موارد **ناموجود** در پروژه (عمداً مستند نشده): cache، صفِ پیامِ مستقل، worker مجزا، RBAC چندسطحی، i18n، feature flag سیستم (بجز `localStorage.feelia_direct`)، CI/CD.

مرتبط: [system-architecture](../01-architecture/system-architecture.md) · [configuration-catalog](../02-reference/configuration-catalog.md) · [error-code-catalog](../02-reference/error-code-catalog.md) · [deployment-operations](../01-architecture/deployment-operations.md).
