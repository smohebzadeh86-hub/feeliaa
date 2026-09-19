# Module Map

> **وضعیت:** ACTIVE-CANONICAL · نگاشتِ ماژول‌های محصول، پلتفرم و subsystemها به فایل‌های واقعی. Snapshot 2026-09-13.

## ۱. ماژول‌های محصول

| # | ماژول | Backend | Frontend (`public/index.html` مگر ذکر شود) | جداول | Subsystemها |
|---|---|---|---|---|---|
| 01 | [Therapist Accounts](../04-modules/01-therapist-accounts/module-prd.md) | `http/auth.ts`، `auth/password.ts`، `auth/session.ts` | `#screenAuth`، `toggleAuthMode`، `submitAuth`، `logout`، `init`، `enterApp` | `therapists`، `auth_sessions` | — (platform) |
| 02 | [Client Management](../04-modules/02-client-management/module-prd.md) | `http/clients.ts` (بجز `/api/recovered`)، `db/ownership.ts` | `#screenClients`، `loadClients`، `switchClientTab`، `applyClientFilters`، `renderClients`، مدال‌های `newClientModal`/`deactivateClientModal`/`editCategoryModal`/`deleteClientModal`، `openClientDetail` | `clients` | — |
| 03 | [Therapy Sessions](../04-modules/03-therapy-sessions/module-prd.md) | `http/sessions.ts` (CRUD)، `http/clients.ts` (`/api/recovered`) | `#screenSetup`، `#screenLive`، `#screenWrapup`، `#screenClientDetail`؛ `setupNewSession`، `runPreflight`، `startSession`، `endSession`، `handleFinished`، `confirmCancelSession`، `finishSession`، `checkActiveSessionBanner`، `liveResumeSession`، `resumeSession`، `viewTranscript`، `saveSessionMeta`، timer، watchdog، `persistDuration` | `sessions` | 01، 03 |
| 04 | [Transcription](../04-modules/04-transcription/module-prd.md) | `http/stt.ts`، `http/sessions.ts` (batch-*، resolve-speakers)، `stt/*`، `ws/*` | `public/feelia-rt.js`؛ در index: `startNewRTSession`، `rtOnState`، `endNewRTSession`، `rtPauseLive`، `rtResumeLive`، `sweepOrphanedAudioQueue`، `startResolveSpeakersUI`، `applyResolvedSpeakers`، `SonioxDirect`، `connectWS`، `startMic` | `sessions` (ستون‌های متن/STT)، `session_audio` | 01، 02، 03، 04، 05 |
| 05 | [Notes & Signs](../04-modules/05-notes-and-signs/module-prd.md) | `http/sessions.ts` (notes، voice-note)، `stt/batchqueue.ts` (purpose=note) | `.sign-chip` handlers، `renderSignsLog`، `addQuickNote`، `renderNotesLog`، `addTextNote`، `renderWrapupNotes`، `startVoiceNote`، `startVoiceNoteDirect`، `stopVoiceNoteDirect` | `session_notes` | 02 |
| 06 | [Admin Panel](../04-modules/06-admin-panel/module-prd.md) | `http/admin.ts`، `stt/sessionAudioArchive.ts` (خواندن) | `#screenAdmin`، `#screenAdminTherapist`، `#screenAdminSessions`؛ `openAdminPanel` … `adminDownloadAll` | همه (خواندن)، `therapists` (نوشتن) | 05 |
| 07 | [UX Analytics](../04-modules/07-ux-analytics/module-prd.md) | `http/clientConfig.ts` | `public/feelia-analytics.js`؛ `uxTrack`، `data-clarity-mask`، `#uxConsentBox`، `#uxConsentToggle` | — | — |
| 08 | [AI Case File](../04-modules/08-ai-case-file/module-prd.md) | `server/src/features/case-file/**` (ports/adapters؛ `adapters/llm/openai.adapter.ts` تنها فایلِ وابسته به OpenAI) | `#caseFileSection` در `screenClientDetail`؛ `loadCaseFile`، `renderCaseFile`، `regenerateCaseFile`، `saveCaseFileEdits`، CSSِ اسکوپ‌شده‌ی `.case-file-doc` | `client_case_file` | — |

## ۲. پلتفرم (cross-cutting) — [06-platform](../06-platform/README.md)

| قابلیت | فایل |
|---|---|
| bootstrap، ثبتِ روت، static، sweeperها | `server/src/index.ts` |
| احرازِ هویت و guardها | `server/src/auth/guard.ts`، `session.ts`، `password.ts` |
| مالکیت | `server/src/db/ownership.ts` |
| DB و migration | `server/src/db/connection.ts`، `migrate.ts`، `migrations/`، `server/scripts/copy-assets.mjs` |
| کانفیگ | `process.env` در کد؛ `.env` |
| egress | `PROXY_URL` در `stt/tempkey.ts`، `asyncTranscribe.ts`، `soniox.ts` |
| helperهای مشترکِ UI | `api()`، `showScreen()`، `showBanner()`، `toFa()`، `escapeHtml()`، `describeMicError()`، `MicModule`، `detectWebView()`، `checkSecureAudioEnv()` در `index.html` |
| تشخیص | `diag-collect.sh`، `GET /api/health`، `GET /api/stt/check` |
| تست | `scripts/rt-harness.cjs` |

## ۳. Subsystemها — [07-subsystems](../07-subsystems/README.md)

| # | Subsystem | فایل‌های اصلی |
|---|---|---|
| 01 | Browser Realtime Engine | `public/feelia-rt.js` (`RTSession`)، `server/src/stt/tempkey.ts`، `POST /api/stt/realtime-session` |
| 02 | Audio Durability & Batch Fallback | `feelia-rt.js` (`AudioQueueDB`، `startDurable`، `uploadBatchSegments`، `drainQueuedAudioInBackground`، `archiveQueuedAudioOnly`، `awaitBatchDrain`)، `stt/batchqueue.ts`، `stt/asyncTranscribe.ts` |
| 03 | Transcript Integrity | `PUT /api/sessions/:id`، `persistConfirmed`، `mergeBatchTranscript`، `noteDiscontinuity`، `ws/transcription.ts` (نوشتن‌های legacy) |
| 04 | Legacy WS Proxy (P1) | `ws/transcription.ts`، `ws/p1.ts`، `stt/soniox.ts`، `SonioxDirect`/`connectWS`/`startMic`/`handleMsg` در index |
| 05 | Session Audio Archive & Speaker Resolve | `stt/sessionAudioArchive.ts`، `stt/speakerResolve.ts`، روت‌های admin audio و resolve-speakers |

## ۴. فایل‌های بدونِ ماژول

| فایل | وضعیت |
|---|---|
| `feelia-design-system.html` | مرجعِ طراحی |
| `session_assistant_v11 (3).html` | HISTORICAL |
| `soniox.html` | مرجعِ خارجی |
| `diag-collect.sh` | ابزارِ ops |
