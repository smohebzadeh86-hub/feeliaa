# Traceability Matrix

> **وضعیت:** ACTIVE-CANONICAL · **Completeness: PARTIAL** — بیشترِ REQها تستِ خودکار ندارند.
> زنجیره: Requirement → PRD → Implementation Plan → Code → Test → Verification.
> Test IDها = برچسب‌های `scripts/rt-harness.cjs`. نتایج: [evidence 2026-09-13](../../verification/2026-09-13-documentation-baseline.md) — **WT** = working tree، **HEAD** = `feelia-rt.js` در `17dd11a`.
> Verification: `code-read` = کد خوانده شد (بدونِ اجرا) · `harness` · `none`.

| REQ | PRD / Plan | Code anchor | Test | Verification |
|---|---|---|---|---|
| REQ-001…004 | [01](../04-modules/01-therapist-accounts/module-prd.md) / [plan](../04-modules/01-therapist-accounts/implementation-plan.md) | `server/src/features/auth/auth.routes.ts` (`normalizePhone`، `DUMMY_PASSWORD_HASH`، register/login) | none | code-read |
| REQ-005 | 01 | `auth/guard.ts` `registerAuthContext`؛ `features/auth/auth.routes.ts` login | none | code-read |
| REQ-006, 007 | 01 | `auth/session.ts`؛ `auth/guard.ts`؛ `features/auth/auth.routes.ts` logout | none | code-read |
| REQ-008 | 01 | `features/auth/auth.routes.ts` `ensureAdminFlag` | none | code-read |
| REQ-010…014 | [02](../04-modules/02-client-management/module-prd.md) / [plan](../04-modules/02-client-management/implementation-plan.md) | `features/clients/clients.routes.ts`، `db/ownership.ts` | none | code-read |
| REQ-015 | 02 | `index.html` `applyClientFilters`، `renderClients` | none | code-read |
| REQ-016 | 02 | `features/clients/clients.routes.ts` POST؛ `index.html` `showNewClientModal`، `createNewClient`، `readReasonFrom` | mock UI | [verification](../../verification/2026-09-14-client-status-archive.md) |
| REQ-017 | 02 | `features/sessions/` POST (409)؛ `index.html` `openClientDetail`، `reactivateFromDetail` | mock UI | همان |
| REQ-018 | 02 | `features/clients/clients.routes.ts` GET؛ `index.html` `renderTodayClientsView`، `isTodayClient`، `jalaliDayTehran` | mock UI (۸ مراجعِ synthetic) | [verification](../../verification/2026-09-16-clients-today-view-and-all-clients.md) |
| REQ-019 | 02 | `features/clients/clients.routes.ts` PATCH `/:id/pin`، PATCH `/:id/status`؛ `index.html` `togglePinClient`، `renderAllClientsView`، `historyBucket` | mock UI + migration روی MySQLِ واقعی | همان |
| REQ-020…023 | [03](../04-modules/03-therapy-sessions/module-prd.md) / [plan](../04-modules/03-therapy-sessions/implementation-plan.md) | `features/sessions/` POST؛ `features/transcription/stt.routes.ts`؛ `index.html` `runPreflight`، `updateStartButtonState` | none | code-read |
| REQ-024 | 03 | `checkActiveSessionBanner`، `liveResumeSession`، `RTSession.start` | T9 | harness PASS (WT+HEAD) |
| REQ-025 | 03 | `RTSession.pause/resume`، `rtOnState` | T6, T17 | harness PASS (WT+HEAD) |
| REQ-026…031 | 03 | `endNewRTSession`، `finishSession`، `confirmCancelSession`، `persistDuration`، `saveSessionMeta`، `beforeunload`، `startSttWatchdog` | none | code-read |
| REQ-032 | 03 | `features/sessions/` POST `mode:"manual"`؛ migration 012؛ `index.html` `startManualSessionFlow`، `viewTranscript` | mock UI + سرور/DBِ واقعی (۳ ترکیبِ تاریخ/ساعت) | [verification §7/§8](../../verification/2026-09-14-client-status-archive.md) |
| REQ-033 | 03 | `index.html` `startArchiveVoiceNote(Direct)`، `addArchiveTextNote`، `cleanupArchiveVoice` | سرور/DBِ واقعی: یادداشتِ متنی end-to-end؛ یادداشتِ صوتی تا مرزِ میکروفون (مسدود در sandbox) | [verification §8](../../verification/2026-09-14-client-status-archive.md) |
| REQ-029 (تاریخِ شمسی) | 03 | `features/sessions/sessionDate.ts`، `features/sessions/` POST/PUT؛ migration 013؛ `index.html` `startSession`، `saveSessionMeta` | unit (tsx ۳۸/۳۸) + mock UI؛ PL/pgSQL تست‌نشده | [verification §6](../../verification/2026-09-14-client-status-archive.md) |
| REQ-040 | [04](../04-modules/04-transcription/module-prd.md) / [plan](../04-modules/04-transcription/implementation-plan.md) | `features/transcription/stt.routes.ts` realtime-session؛ `features/transcription/soniox/tempKey.ts` | T1 (master never sent)، T2 (fresh mint) | harness PASS (سمتِ کلاینت؛ سرور code-read) |
| REQ-041 | 04 | `openDirectWS`، `STT_DEFAULTS` | none | code-read |
| REQ-042 | 04 | `scheduleReconnect` | T2 | harness PASS |
| REQ-043 | 04 | `scheduleReconnect`، `watchOnline` | T2, T15 (FAILED state) | harness PASS |
| REQ-044 | 04 | `RTSession.start` | T16 | harness: WT **partial FAIL** (2/3)، HEAD PASS |
| REQ-045 | 04 | `startAutosave`، `persistConfirmed`؛ `PUT /api/sessions/:id` | T1, T10 | harness PASS (کلاینت)؛ CAS سرور code-read |
| REQ-046 | 04 | `finish`، `uploadBatchSegments`، `awaitBatchDrain`، `features/transcription/batch/` | T2 (batch)، T14 | T14 PASS؛ **T2 batch FAIL در WT**، HEAD PASS |
| REQ-047 | 04 | `noteDiscontinuity`، `speakerLabelMap` | T6 (خروجی شاملِ مارکر) | harness PASS (غیرمستقیم) |
| REQ-048 | 04 | `features/transcription/speakerResolve.ts`، `sessions.ts` resolve-speakers | none | code-read |
| REQ-049, 050 | 04 | `cleanText`، `buildTextFromTokens`، `transcribeFileAsync` | none | code-read |
| REQ-051 | 04 / [subsystem 04](../07-subsystems/04-legacy-ws-proxy-p1.md) | `startSession`، `features/legacy-ws/transcription.routes.ts` | none | code-read |
| REQ-052 | 04 | `RTSession.abort` | T7, T7b | harness PASS |
| REQ-053 | 04 | `RTSession.finish` | T8 | harness PASS |
| REQ-054 | 04 | `connEpoch`، `openDirectWS` | T13a, T13b | harness PASS |
| REQ-060…062, 064 | [05](../04-modules/05-notes-and-signs/module-prd.md) / [plan](../04-modules/05-notes-and-signs/implementation-plan.md) | `index.html` signs/notes؛ `sessions.ts` notes | none | code-read |
| REQ-066 | [05](../04-modules/05-notes-and-signs/module-prd.md) / [subsystem 02](../07-subsystems/02-audio-durability-batch-fallback.md) | `index.html` pre-note (Setup/آپلود/Wrapup/صفحه‌ی جلسه/ادمین)؛ `feelia-rt.js` intent `pre-note`؛ `features/sessions/notes.routes.ts`، `sessions.repository.ts`؛ `features/transcription/batch/*`؛ `features/admin/*`؛ `features/case-file/*` | T56a/b + UIِ mock | `test:rt` 102/102، `tsc`، `test:routes`/`arch`/`cf`/`up`/`tu`/`ft`/`llm` PASS 2026-09-29؛ E2Eِ واقعی PASS 2026-09-29 |
| REQ-065 | [05](../04-modules/05-notes-and-signs/module-prd.md) / [subsystem 03](../07-subsystems/03-transcript-integrity.md) | `feelia-rt.js` signMarker؛ `index.html` sign chips/removeSign؛ `features/transcription/signMarkers.ts`، `asyncTranscribe.ts`، `speakerResolve.ts` | T50–T55 + E2Eِ واقعی | `test:rt` PASS 2026-09-27؛ E2E (Chrome + Soniox + MySQLِ dev) PASS |
| REQ-063 | 05 | `startVoiceNoteDirect`، `stopVoiceNoteDirect`، `features/transcription/batch/` note | T15 | **WT: 3 FAIL** (upload، retry، drain)؛ HEAD PASS |
| REQ-070…078 | [06](../04-modules/06-admin-panel/module-prd.md) / [plan](../04-modules/06-admin-panel/implementation-plan.md) | `features/admin/`؛ `index.html` admin | none | code-read |
| REQ-080…084 | [07](../04-modules/07-ux-analytics/module-prd.md) / [plan](../04-modules/07-ux-analytics/implementation-plan.md) | `feelia-analytics.js`، `clientConfig.ts`، `index.html` | sandbox harness (۴۱ assertion) + route inject (۱۰) — اسکریپت‌ها در repo نیستند | [evidence 2026-09-14](../../verification/2026-09-14-clarity-test-pass.md): PASS؛ کلیکِ واقعی و payloadِ Clarity تأیید نشده |
| REQ-090…097 | [platform](../06-platform/platform-prd.md) / [plan](../06-platform/implementation-plan.md) | `db/migrate.ts`، sweeperها، `features/transcription/soniox/` | none | code-read |
| REQ-098 | platform + [subsystem 05](../07-subsystems/05-session-audio-archive-speaker-resolve.md) | `index.html` consent/privacy note ↔ `feelia-rt.js` archive، `features/transcription/archive/` | none | code-read → CONTRADICTED |
| REQ-099 | platform | `features/sessions/` `[diag-transcript]` | none | code-read → CONTRADICTED |
| REQ-100 | platform | `app.ts` `register(multipart)` | none | code-read |

| REQ-055…059 | [04](../04-modules/04-transcription/module-prd.md) / [subsystem 06](../07-subsystems/06-audio-upload-pipeline.md) | `server/src/features/audio-upload/*`، `features/notifications/notify.ts`، `public/feelia-upload.js` | `scripts/upload-harness.ts` (H1–H24، `pnpm test:up`) | harness 24/24 + mock-UI + **E2Eِ واقعی** (Soniox/LLM/MySQL، ۶۰ دقیقه، kill ِ سرور، UIِ واقعی) — [verification](../../verification/2026-09-23-audio-upload-pipeline.md) §۴.۱ |
| REQ-109 | 04 | `features/transcription/batch/#applyBatchSegmentOnce` | E2E موقت (C3 + mutation، F8-real) | MySQLِ واقعی — همان verification |
| REQ-101…104 | 04 / [subsystem 07](../07-subsystems/07-final-transcript.md) | `server/src/features/final-transcript/*`، `index.html#renderFinalTranscript` | `scripts/final-transcript-harness.ts` (`pnpm test:ft`، ۳۳) | harness 33/33 + mock-UI + فاز ۰ رویِ ۴ صدا (gate ۸ از ۸) + **E2E رویِ MySQLِ dev با Soniox/LLMِ واقعی ۱۲/۱۲** — [verification](../../verification/2026-09-28-final-transcript-implementation.md) |
| REQ-105…108 | 04 / [subsystem 06 §۱۰](../07-subsystems/06-audio-upload-pipeline.md)، [07](../07-subsystems/07-final-transcript.md) | `audio-upload/quality.ts`، `jobMachine.ts`، `worker.ts` (+ `jobStore.sql.ts`)، `features/transcription/soniox/restClient.ts`، `final-transcript/domain/{polishGuards,transcriptText}.ts`، `index.html#jobQualityHtml` | `test:up` H41–H51، `test:ft` B1–B8 | harness 52/52 و 41/41 + ffmpegِ واقعی + mock-UI؛ آستانه‌ها از فاز ۰B — [verification](../../verification/2026-09-28-upload-audio-quality-phase0b.md)؛ **E2E رویِ MySQLِ dev + Soniox/ffmpeg/LLMِ واقعی: ۳۸/۴۰ (۲ FAILِ زمان‌بندیِ خودِ تست، نه کد)** |

| REQ-111…116 | [08](../04-modules/08-ai-case-file/module-prd.md) / [plan](../04-modules/08-ai-case-file/implementation-plan.md) | `features/case-file/{application,api}/*` | `scripts/case-file-harness.ts` (`test:cf`) | harness + [verification 2026-09-17](../../verification/2026-09-17-ai-case-file-real-e2e.md) |
| REQ-117…119 | [09](../04-modules/09-treatment-unit/module-prd.md) / [plan](../04-modules/09-treatment-unit/implementation-plan.md) | `features/treatment-unit/*`، `index.html` `tu*` | `scripts/treatment-unit-harness.ts` (`test:tu`) | harness + [verification 2026-09-27](../../verification/2026-09-27-treatment-unit-e2e-and-setup-edit.md) |
| REQ-109، REQ-110 | 04 | `transcription/batch/`، `audio-upload/*` | `test:up`، E2E موقت | همان verificationهایِ آپلود |
| REQ-120 | [llm-provider-layer](../06-platform/llm-provider-layer.md) | `server/src/llm/config.ts` | `scripts/llm-harness.ts` (`test:llm`) | harness |
| REQ-121 | [observability-audit](../06-platform/observability-audit.md) | `server/src/obs/audit.ts` | `test:api` (دستی) | E2Eِ 2026-09-26 |
| REQ-122 | platform | `scripts/check-backend-boundaries.mjs` | `test:arch` | harness |

## شکاف‌های پوشش (برای master plan)
1. auth، clients، sessions، admin harnessِ خودکارِ اختصاصی ندارند (فقط `test:api` دستی رویِ DBِ dev و `test:routes` برایِ guardها).
2. هیچ تستِ UI/E2Eِ خودکار (فقط mock و اجراهایِ دستیِ تاریخ‌دار در `verification/`).
3. قراردادِ مسیرِ legacy تست ندارد.
4. جدولِ بالا از سنجشِ 2026-09-13 است؛ ستونِ Test/Verification برایِ ردیف‌هایِ قدیمی (REQ-0xx) بازبینی نشده — UNKNOWN تا بازبینیِ مالک.
