# Traceability Matrix

> **وضعیت:** ACTIVE-CANONICAL · **Completeness: PARTIAL** — بیشترِ REQها تستِ خودکار ندارند.
> زنجیره: Requirement → PRD → Implementation Plan → Code → Test → Verification.
> Test IDها = برچسب‌های `scripts/rt-harness.cjs`. نتایج: [evidence 2026-09-13](../../verification/2026-09-13-documentation-baseline.md) — **WT** = working tree، **HEAD** = `feelia-rt.js` در `17dd11a`.
> Verification: `code-read` = کد خوانده شد (بدونِ اجرا) · `harness` · `none`.

| REQ | PRD / Plan | Code anchor | Test | Verification |
|---|---|---|---|---|
| REQ-001…004 | [01](../04-modules/01-therapist-accounts/module-prd.md) / [plan](../04-modules/01-therapist-accounts/implementation-plan.md) | `server/src/http/auth.ts` (`normalizePhone`، `DUMMY_PASSWORD_HASH`، register/login) | none | code-read |
| REQ-005 | 01 | `auth/guard.ts` `registerAuthContext`؛ `http/auth.ts` login | none | code-read |
| REQ-006, 007 | 01 | `auth/session.ts`؛ `auth/guard.ts`؛ `http/auth.ts` logout | none | code-read |
| REQ-008 | 01 | `http/auth.ts` `ensureAdminFlag` | none | code-read |
| REQ-010…014 | [02](../04-modules/02-client-management/module-prd.md) / [plan](../04-modules/02-client-management/implementation-plan.md) | `http/clients.ts`، `db/ownership.ts` | none | code-read |
| REQ-015 | 02 | `index.html` `applyClientFilters`، `renderClients` | none | code-read |
| REQ-016 | 02 | `http/clients.ts` POST؛ `index.html` `showNewClientModal`، `createNewClient`، `readReasonFrom` | mock UI | [verification](../../verification/2026-09-14-client-status-archive.md) |
| REQ-017 | 02 | `http/sessions.ts` POST (409)؛ `index.html` `openClientDetail`، `reactivateFromDetail` | mock UI | همان |
| REQ-018 | 02 | `http/clients.ts` GET؛ `index.html` `renderTodayClientsView`، `isTodayClient`، `jalaliDayTehran` | mock UI (۸ مراجعِ synthetic) | [verification](../../verification/2026-09-16-clients-today-view-and-all-clients.md) |
| REQ-019 | 02 | `http/clients.ts` PATCH `/:id/pin`، PATCH `/:id/status`؛ `index.html` `togglePinClient`، `renderAllClientsView`، `historyBucket` | mock UI + migration روی MySQLِ واقعی | همان |
| REQ-020…023 | [03](../04-modules/03-therapy-sessions/module-prd.md) / [plan](../04-modules/03-therapy-sessions/implementation-plan.md) | `http/sessions.ts` POST؛ `http/stt.ts`؛ `index.html` `runPreflight`، `updateStartButtonState` | none | code-read |
| REQ-024 | 03 | `checkActiveSessionBanner`، `liveResumeSession`، `RTSession.start` | T9 | harness PASS (WT+HEAD) |
| REQ-025 | 03 | `RTSession.pause/resume`، `rtOnState` | T6, T17 | harness PASS (WT+HEAD) |
| REQ-026…031 | 03 | `endNewRTSession`، `finishSession`، `confirmCancelSession`، `persistDuration`، `saveSessionMeta`، `beforeunload`، `startSttWatchdog` | none | code-read |
| REQ-032 | 03 | `http/sessions.ts` POST `mode:"manual"`؛ migration 012؛ `index.html` `openManualSession`، `saveManualSession`، `viewTranscript` | mock UI + سرور/DBِ واقعی (۳ ترکیبِ تاریخ/ساعت) | [verification §7/§8](../../verification/2026-09-14-client-status-archive.md) |
| REQ-033 | 03 | `index.html` `startArchiveVoiceNote(Direct)`، `addArchiveTextNote`، `cleanupArchiveVoice` | سرور/DBِ واقعی: یادداشتِ متنی end-to-end؛ یادداشتِ صوتی تا مرزِ میکروفون (مسدود در sandbox) | [verification §8](../../verification/2026-09-14-client-status-archive.md) |
| REQ-029 (تاریخِ شمسی) | 03 | `http/sessionDate.ts`، `http/sessions.ts` POST/PUT؛ migration 013؛ `index.html` `startSession`، `saveSessionMeta` | unit (tsx ۳۸/۳۸) + mock UI؛ PL/pgSQL تست‌نشده | [verification §6](../../verification/2026-09-14-client-status-archive.md) |
| REQ-040 | [04](../04-modules/04-transcription/module-prd.md) / [plan](../04-modules/04-transcription/implementation-plan.md) | `http/stt.ts` realtime-session؛ `stt/tempkey.ts` | T1 (master never sent)، T2 (fresh mint) | harness PASS (سمتِ کلاینت؛ سرور code-read) |
| REQ-041 | 04 | `openDirectWS`، `STT_DEFAULTS` | none | code-read |
| REQ-042 | 04 | `scheduleReconnect` | T2 | harness PASS |
| REQ-043 | 04 | `scheduleReconnect`، `watchOnline` | T2, T15 (FAILED state) | harness PASS |
| REQ-044 | 04 | `RTSession.start` | T16 | harness: WT **partial FAIL** (2/3)، HEAD PASS |
| REQ-045 | 04 | `startAutosave`، `persistConfirmed`؛ `PUT /api/sessions/:id` | T1, T10 | harness PASS (کلاینت)؛ CAS سرور code-read |
| REQ-046 | 04 | `finish`، `uploadBatchSegments`، `awaitBatchDrain`، `batchqueue.ts` | T2 (batch)، T14 | T14 PASS؛ **T2 batch FAIL در WT**، HEAD PASS |
| REQ-047 | 04 | `noteDiscontinuity`، `speakerLabelMap` | T6 (خروجی شاملِ مارکر) | harness PASS (غیرمستقیم) |
| REQ-048 | 04 | `stt/speakerResolve.ts`، `sessions.ts` resolve-speakers | none | code-read |
| REQ-049, 050 | 04 | `cleanText`، `buildTextFromTokens`، `transcribeFileAsync` | none | code-read |
| REQ-051 | 04 / [subsystem 04](../07-subsystems/04-legacy-ws-proxy-p1.md) | `startSession`، `ws/transcription.ts` | none | code-read |
| REQ-052 | 04 | `RTSession.abort` | T7, T7b | harness PASS |
| REQ-053 | 04 | `RTSession.finish` | T8 | harness PASS |
| REQ-054 | 04 | `connEpoch`، `openDirectWS` | T13a, T13b | harness PASS |
| REQ-060…062, 064 | [05](../04-modules/05-notes-and-signs/module-prd.md) / [plan](../04-modules/05-notes-and-signs/implementation-plan.md) | `index.html` signs/notes؛ `sessions.ts` notes | none | code-read |
| REQ-063 | 05 | `startVoiceNoteDirect`، `stopVoiceNoteDirect`، `batchqueue.ts` note | T15 | **WT: 3 FAIL** (upload، retry، drain)؛ HEAD PASS |
| REQ-070…078 | [06](../04-modules/06-admin-panel/module-prd.md) / [plan](../04-modules/06-admin-panel/implementation-plan.md) | `http/admin.ts`؛ `index.html` admin | none | code-read |
| REQ-080…084 | [07](../04-modules/07-ux-analytics/module-prd.md) / [plan](../04-modules/07-ux-analytics/implementation-plan.md) | `feelia-analytics.js`، `clientConfig.ts`، `index.html` | sandbox harness (۴۱ assertion) + route inject (۱۰) — اسکریپت‌ها در repo نیستند | [evidence 2026-09-14](../../verification/2026-09-14-clarity-test-pass.md): PASS؛ کلیکِ واقعی و payloadِ Clarity تأیید نشده |
| REQ-090…097 | [platform](../06-platform/platform-prd.md) / [plan](../06-platform/implementation-plan.md) | `db/migrate.ts`، sweeperها، `stt/*` | none | code-read |
| REQ-098 | platform + [subsystem 05](../07-subsystems/05-session-audio-archive-speaker-resolve.md) | `index.html` consent/privacy note ↔ `feelia-rt.js` archive، `sessionAudioArchive.ts` | none | code-read → CONTRADICTED |
| REQ-099 | platform | `http/sessions.ts` `[diag-transcript]` | none | code-read → CONTRADICTED |
| REQ-100 | platform | `index.ts` `register(multipart)` | none | node_modules read → verified limit |

| REQ-055…059 | [04](../04-modules/04-transcription/module-prd.md) / [subsystem 06](../07-subsystems/06-audio-upload-pipeline.md) | `server/src/features/audio-upload/*`، `features/notifications/notify.ts`، `public/feelia-upload.js` | `scripts/upload-harness.ts` (H1–H24، `pnpm test:up`) | harness 24/24 + mock-UI + **E2Eِ واقعی** (Soniox/LLM/MySQL، ۶۰ دقیقه، kill ِ سرور، UIِ واقعی) — [verification](../../verification/2026-09-23-audio-upload-pipeline.md) §۴.۱ |
| REQ-060 | 04 | `stt/batchqueue.ts#applyBatchSegmentOnce` | E2E موقت (C3 + mutation، F8-real) | MySQLِ واقعی — همان verification |

## شکاف‌های پوشش (برای master plan)
1. هیچ تستِ backend (auth، مالکیت، CAS، admin guards، batch merge).
2. harness با صفِ IndexedDB هم‌گام نیست (6 FAIL در WT).
3. هیچ تستِ UI/E2E.
4. قراردادِ مسیرِ legacy تست ندارد.
