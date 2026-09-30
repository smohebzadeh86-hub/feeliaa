# Module 08 — AI Case File · Implementation Plan

> last-verified: 2026-09-30 @ `17d6919` · PRD: [module-prd](module-prd.md) · REQ-111…REQ-116

## Current State
فازِ ۱ (دستی) و فازِ ۲ (auto-trigger با toggleِ سطحِ درمانگر) پیاده و در production؛ فیچر پشتِ `therapists.case_file_enabled` (پیش‌فرض خاموش؛ مالک فقط برایِ یک تراپیست روشن کرد، 2026-09-23). تولید دو مرحله‌ای (digest سپس پرونده) با LLMِ مستقل از provider ([llm-provider-layer](../../06-platform/llm-provider-layer.md)).

## Code Anchors
| لایه | anchor |
|---|---|
| api | `server/src/features/case-file/api/caseFile.routes.ts` |
| application | `generateCaseFile`، `aggregateClientCorpus`، `mergeTherapistEdits`، `applyFieldPatch`، `repairLoop`، `renderDigest`، `upgradeLegacyContent`، `computeTreatmentRhythm`، `writeCaseFileWithCas`، `autoTrigger` |
| domain | `types.ts` (`CaseFileContent`)، `validate.ts`، `findings.ts`، `normalizeText.ts`، `errors.ts` |
| ports/adapters | `ports/{caseFileRepo,llmProvider}.port.ts` ← `adapters/repository/caseFileRepository.sql.ts`، `adapters/llm/{chatLlm.adapter,registry}.ts` |
| prompts | `prompts/{systemPrompts,userPrompts}.ts` (متن/سبک: [content-style-guide](content-style-guide.md)) |
| wiring | `composition.ts`؛ `index.ts` فقط `maybeAutoGenerateCaseFile`/`triggerCaseFileForSession` را برایِ featureهایِ دیگر export می‌کند |
| migration | `018`، `019` (corpus_signature، generating_started_at)، `020` (auto_generate)، `022` (case_file_enabled)، `023` (content_version) |
| harness | `scripts/case-file-harness.ts` (`pnpm test:cf`) |
| frontend | `.case-file-doc`، `cf*` در `public/index.html` (`cfOpenKey`/`cfSaveOpen`، `cfSummaryClick`، …؛ [frontend-map](../../02-reference/frontend-map.md)) |

## Backlog (هر مورد پلنِ جدا)
| # | مورد | منبع |
|---|---|---|
| CF-1 | گسترشِ UI/دامنه به مراجعینِ فعال (پی‌ریزی هست: `CASE_FILE_AUTO_ACTIVE_CLIENTS=1`) | تصمیمِ مالک 2026-09-23 («الان نه ولی پی‌ریزی») |
| CF-2 | صفِ async با coalesce برایِ چند رویدادِ هم‌زمان | PRD «هنوز پیاده نشده» |
| CF-3 | trigger برایِ یادداشتِ خارج از جلسه | PRD Out of Scope |
| CF-4 | انتقالِ SQLِ `application/autoTrigger.ts` و `aggregateClientCorpus.ts` به adapter (اکنون `query` مستقیم) | [LAW-025](../../00-governance/project-laws.md) |
| CF-5 | ویرایشِ مسیرِ `regenerate` به async/poll اگر `proxy_read_timeout` مشکل‌ساز شد | [deployment-operations §۴](../../01-architecture/deployment-operations.md) |

## Testing Strategy
`test:cf` (findings، merge، patch، repairLoop؛ LLMِ جعلی، بدونِ DB). E2Eِ واقعی با LLMِ واقعی فقط در verification تاریخ‌دار (مثلاً [2026-09-17](../../../verification/2026-09-17-ai-case-file-real-e2e.md)).

## Migration Strategy
همه additive. `content` JSON است؛ تغییرِ schemaِ محتوا با `upgradeLegacyContent` (idempotent) و `prompt_version`.

## Rollback
خاموش‌کردنِ `case_file_enabled` برایِ حساب‌ها (رفتارِ UI/route را می‌بندد)؛ جدول بدونِ حذف می‌ماند.

## Risks
خروجِ متنِ بالینی به providerِ LLM (R19/R21)؛ خروجیِ LLM پیشنهاد است نه حقیقت (اصلِ ۲ PRD)؛ `regenerate` همگام و چنددقیقه‌ای است (nginx timeout).
