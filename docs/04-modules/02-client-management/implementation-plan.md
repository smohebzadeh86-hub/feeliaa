# Module 02 — Client Management · Implementation Plan

## Current State
همه در working tree، commitنشده: status/category/gender پایه + UIِ تب/فیلتر/مرتب‌سازی/مدال‌ها (migrations 008، 009) در `2763414`؛ ساختِ مراجع با status/reason از تبِ غیرفعال، یکسان‌سازیِ اندازه‌ی کارتِ فعال/غیرفعال و متنِ دکمه‌ی آرشیو در `54a17fd` (2026-09-15). **(2026-09-16، commitنشده)** صفحه‌ی مراجعین به دو screen تقسیم شد: `#screenClients` (نمای «امروز + سنجاق‌شده») و `#screenAllClients` (منطقِ قبلیِ تب/فیلتر/مرتب‌سازی + سربرگ‌های تاریخی)؛ endpointِ سنجاق (`PATCH /:id/pin`) و migrationِ `015_client_pinned.sql` (فقط MySQL) اضافه شد. بدونِ تستِ خودکار؛ [verification](../../../verification/2026-09-16-clients-today-view-and-all-clients.md) دستی (UI با mock + migration روی MySQLِ لوکالِ واقعی).

## Code Anchors
| لایه | anchor |
|---|---|
| API | `server/src/http/clients.ts`: `generateClientCode`، `VALID_CATEGORIES`، `VALID_GENDERS`، روت‌های list/create/get/put/status/category/**pin**/delete |
| مالکیت | `server/src/db/ownership.ts#getOwnedClient` |
| DB | migrations 001، 004، 008، 009، **015** (`server/src/db/mysql/migrations/`، فقط MySQL) |
| UI | `index.html`: `#screenClients` (نمای امروز)، `#screenAllClients` (جدید)، `CATEGORY_LABELS`، `GENDER_OPTIONS`، `loadClients`، `switchClientTab`، `renderCategoryChips`، `renderCatFilterRow`، `filterClients`، `setSortMode`، `applyClientFilters`→`renderTodayClientsView`/`renderAllClientsView`، `renderClientGroups`، `buildClientCard`، `historyBucket`، `jalaliDayTehran`/`todayJalaliTehran`/`isTodayClient`/`isPinnedClient`، `togglePinClient`، `showAllClients`/`goBackToClientsToday`، `openDeactivateModal`/`confirmDeactivateClient`، `reactivateClient`، `openEditCategoryModal`/`confirmEditCategory`، `openEditAliasModal`/`confirmEditAlias`، `showDeleteClient`/`confirmDeleteClient`، `showNewClientModal`/`createNewClient`، `openClientDetail` |

## Architecture Impact
ندارد.

## Data / Schema Changes
**(2026-09-16، اعمال‌شده)** migration 015: `clients.pinned_at DATETIME NULL` — افزودنیِ خالص، فقط MySQL (`server/src/db/mysql/migrations/`). توجه: 009 داده را تبدیل می‌کند — قبل از deploy backup.

## Backend Changes (Proposed)
| # | تغییر | دلیل |
|---|---|---|
| C-1 | حذفِ فایل‌های صدای جلساتِ مراجع هنگامِ حذف | REQ-093 (platform PL-3) |
| C-2 | تولیدِ کد با `crypto.randomInt` به‌جای `Math.random` و اتکا به UNIQUE + retry روی خطای 23505 | فعلاً ۵ تلاش با SELECT؛ فضای ~1M کد (غیربحرانی) |
| C-3 | **(اعمال‌شده 2026-09-16)** `PATCH /api/clients/:id/pin` + `pinned_at` در SELECTِ لیست + پاک‌شدنِ خودکارِ سنجاق در `PATCH /:id/status` هنگامِ inactive | UC-02.8/02.9 |

## Frontend Changes
**(اعمال‌شده 2026-09-16)** بازچینیِ `#screenClients` به نمای «امروز»؛ سکشنِ جدیدِ `#screenAllClients` با منطقِ قبلیِ تب/فیلتر/جستجو/مرتب‌سازی + سربرگ‌های تاریخی؛ منویِ کارت سنجاق/برداشتنِ سنجاق گرفت؛ **فیکسِ مهم:** `showScreen('Clients')` حالا `clientTab`/`clientsView` را ریست می‌کند تا وضعیتِ تبِ صفحه‌ی «همه» به دکمه‌ی «مراجع جدید»ِ صفحه‌ی اول نشت نکند (پیش از این کشف نشده بود — در بازبینیِ پلن پیدا شد).

## API Changes
**(اعمال‌شده 2026-09-16)** `PATCH /api/clients/:id/pin` `{pinned: boolean}` → `{client}` (400 اگر غیرِ boolean، 404 غیرمالک). جزئیات: [api-catalog](../../02-reference/api-catalog.md).

## Integration Changes
ندارد.

## Migration Strategy
008–011 باید پیش از هر deploy commit شوند (master plan P0-0). **015** additive است و به backup نیاز ندارد؛ فقط رویِ محیطِ MySQL اجرا می‌شود (production فعلاً Postgres — تا cutoverِ رسمی این migration رویِ production اجرا نمی‌شود).

## Testing Strategy
inject: قواعدِ gender/category، reason، مالکیت، cascade، **pin/unpin و پاک‌شدنِ خودکارش هنگامِ deactivate**؛ UI با mock backend برای تب/فیلتر/مرتب‌سازی **و نمای امروز/سنجاق/صفحه‌ی همه**.

## Deployment Strategy
با migrationهای 008/009 در یک release؛ backup قبل از 009. **015** در همان چرخه‌ی سیم‌کشیِ MySQL که هنوز production را نگرفته (PROJECT_STATUS §7).

## Risks
009 روی داده‌ی `adult-f/m` اجرا می‌شود — اگر دسته‌ی دیگری در DB باشد، ADD CONSTRAINT شکست و startup متوقف می‌شود (INFERRED).

## Rollback Strategy
کد: revert. schema: migrationِ جدیدِ جبرانی (ویرایشِ 008/009/015 ممنوع).

## Verification Checklist
- [ ] `SELECT DISTINCT category FROM clients` روی prod قبل از 009 (read-only، با مجوز)
- [ ] Acceptance Criteria در PRD
- [x] **(2026-09-16)** migration 015 روی MySQLِ لوکالِ واقعی اعمال و با `SHOW COLUMNS` تأیید شد؛ idempotency با ری‌استارت تأیید شد.

## Documentation Updates
database-catalog، api-catalog، requirement-catalog، traceability-matrix، module-prd (همه در 2026-09-16 برایِ UC-02.8/02.9/02.10 هم‌گام شدند).
