# Module 09 — Treatment Unit · Implementation Plan

> last-verified: 2026-09-30 @ `17d6919` · PRD: [module-prd](module-prd.md)

## Current State
پیاده‌سازی‌شده و در production (وضعیتِ deploy: `PROJECT_STATUS.md`). فازهایِ ۱ (کاتالوگ/اعضا/ارتقا) و ۲ (حاضرین، contextِ پویا) انجام شده؛ فاز ۳ «پس‌پردازشِ گوینده/turn» در «متنِ نهایی» پوشش داده شد (subsystem 07).

## Code Anchors
| لایه | anchor |
|---|---|
| domain | `domain/{types,rules,sonioxContext,errors}.ts` |
| application | `application/treatmentUnitService.ts` (`TreatmentUnitService`) |
| ports/adapters | `ports/treatmentUnitRepo.port.ts` ← `adapters/treatmentUnitRepository.sql.ts` |
| api | `api/treatmentUnit.routes.ts` |
| wiring | `instance.ts` (`treatmentUnits`)، `index.ts` |
| migration | `029_treatment_unit.sql`، `030_partner_role_labels.sql`، `032_modality_dbt_pbt.sql` |
| harness | `scripts/treatment-unit-harness.ts` (`pnpm test:tu`) |
| frontend | `tu*`، `renderUnitEditor`، `openEditUnitModal`، `openModalitiesModal` در `public/index.html` |

## Backlog (هر مورد پلنِ جدا)
| # | مورد | منبع |
|---|---|---|
| TU-1 | ویرایشِ کاتالوگ (نقش/نوع/رویکرد) از پنلِ ادمین | PRD §۸ |
| TU-2 | FK یا CHECK برایِ `client_members.role_code` | PRD §۸ |
| TU-4 | نمایشِ `pre_note`ِ قدیمی در صفحه‌ی جلسه (Event Log: «باز») — با REQ-066 عملاً ناموردنیاز؛ تأییدِ مالک | Event Log 2026-09-27 |

## Testing Strategy
`test:tu` + UI با mock backend (LAW-016) + E2E با DBِ dev فقط با مجوزِ مالک.

## Migration Strategy
seed با `INSERT IGNORE`؛ تغییرِ seed = migrationِ جدید (LAW-007). ⚠️ `;` در متنِ SQL ممنوع.

## Rollback
ستون‌هایِ افزوده NULL/DEFAULT‌اند؛ برگشتِ کد بدونِ حذفِ ستون امن است (مراجعِ قدیمی عضوِ ضمنی دارند).
