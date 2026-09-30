# Module Map

> **وضعیت:** ACTIVE-CANONICAL · نگاشتِ ماژول‌های محصول، پلتفرم و subsystemها به فایل‌های واقعی. last-verified: 2026-09-30 @ `17d6919` · نگاشتِ فیچر↔سند↔تست: [feature-index](feature-index.md).

## ۱. ماژول‌های محصول

| # | ماژول | Backend | Frontend (`public/index.html` مگر ذکر شود) | جداول | Subsystemها |
|---|---|---|---|---|---|
| 01 | [Therapist Accounts](../04-modules/01-therapist-accounts/module-prd.md) | `features/auth/auth.routes.ts`، `auth/password.ts`، `auth/session.ts` | `#screenAuth`، `toggleAuthMode`، `submitAuth`، `logout`، `init`، `enterApp` | `therapists`، `auth_sessions` | — (platform) |
| 02 | [Client Management](../04-modules/02-client-management/module-prd.md) | `features/clients/clients.routes.ts` (بجز `/api/recovered`)، `db/ownership.ts` | `#screenClients`، `loadClients`، `switchClientTab`، `applyClientFilters`، `renderTodayClientsView`، `renderAllClientsView`، مدال‌های `newClientModal`/`deactivateClientModal`/`editCategoryModal`/`deleteClientModal`، `openClientDetail` | `clients` | — |
| 03 | [Therapy Sessions](../04-modules/03-therapy-sessions/module-prd.md) | `features/sessions/` (CRUD)، `features/clients/clients.routes.ts` (`/api/recovered`) | `#screenSetup`، `#screenLive`، `#screenWrapup`، `#screenClientDetail`؛ `setupNewSession`، `runPreflight`، `startSession`، `endSession`، `handleFinished`، `confirmCancelSession`، `finishSession`، `checkActiveSessionBanner`، `liveResumeSession`، `resumeSession`، `viewTranscript`، `saveSessionMeta`، timer، watchdog، `persistDuration` | `sessions` | 01، 03 |
| 04 | [Transcription](../04-modules/04-transcription/module-prd.md) | `features/transcription/stt.routes.ts`، `features/sessions/` (`batch.routes.ts`: batch-*، resolve-speakers)، `features/transcription/{soniox,batch,archive}/`، `features/legacy-ws/` (LEGACY) | `public/feelia-rt.js`؛ در index: `startNewRTSession`، `rtOnState`، `endNewRTSession`، `rtPauseLive`، `rtResumeLive`، `sweepOrphanedAudioQueue`، `startResolveSpeakersUI`، `applyResolvedSpeakers`، `SonioxDirect`، `connectWS`، `startMic` | `sessions` (ستون‌های متن/STT)، `session_audio` | 01، 02، 03، 04، 05 |
| 05 | [Notes & Signs](../04-modules/05-notes-and-signs/module-prd.md) | `features/sessions/` (notes، voice-note)، `features/transcription/batch/` (purpose=note) | `.sign-chip` handlers، `renderSignsLog`، `addQuickNote`، `renderNotesLog`، `addTextNote`، `renderWrapupNotes`، `startVoiceNote`، `startVoiceNoteDirect`، `stopVoiceNoteDirect` | `session_notes` | 02 |
| 06 | [Admin Panel](../04-modules/06-admin-panel/module-prd.md) | `features/admin/`، `features/transcription/archive/` (خواندن) | `#screenAdmin`، `#screenAdminTherapist`، `#screenAdminSessions`؛ `openAdminPanel` … `adminDownloadAll` | همه (خواندن)، `therapists` (نوشتن) | 05 |
| 07 | [UX Analytics](../04-modules/07-ux-analytics/module-prd.md) | `features/client-config/clientConfig.routes.ts` | `public/feelia-analytics.js`؛ `uxTrack`، `data-clarity-mask`، `#uxConsentBox`، `#uxConsentToggle` | — | — |
| 08 | [AI Case File](../04-modules/08-ai-case-file/module-prd.md) | `server/src/features/case-file/**` (ports/adapters؛ `adapters/llm/chatLlm.adapter.ts` تنها آداپتورِ LLM؛ انتخابِ provider در `server/src/llm/` — 2026-09-28) | `#caseFileSection` در `screenClientDetail`؛ `loadCaseFile`، `renderCaseFile`، `regenerateCaseFile`، `saveCaseFileEdits`، CSSِ اسکوپ‌شده‌ی `.case-file-doc` | `client_case_file` | — |
| 09 | [Treatment Unit](../04-modules/09-treatment-unit/module-prd.md) | `server/src/features/treatment-unit/**` (domain/application/adapters/api؛ `instance.ts`؛ `index.ts` شاملِ routeها؛ `sessionSttContext` برایِ Soniox) | فرمِ مراجع/جلسه در `index.html` (کاتالوگ از `GET /api/catalog/treatment-units`) | `tu_*`، `client_members` (+ `clients.unit_type`، `sessions.attendees`، `therapists.modalities`) | — |

## ۲. پلتفرم (cross-cutting) — [06-platform](../06-platform/README.md)

| قابلیت | فایل |
|---|---|
| bootstrap، ثبتِ روت، static، sweeperها | `server/src/index.ts` (entry) · `app.ts` (buildApp: pluginها + static + health) · `jobs/backgroundJobs.ts` (sweep/workerها) |
| احرازِ هویت و guardها | `server/src/auth/guard.ts`، `session.ts`، `password.ts` |
| مالکیت | `server/src/db/ownership.ts` |
| DB و migration | `server/src/db/connection.ts`، `migrate.ts`، `migrations/`، `server/scripts/copy-assets.mjs` |
| کانفیگ | `process.env` در کد؛ `.env` |
| egress | `PROXY_URL` در `features/transcription/soniox/config.ts` (`createProxyAgent` برایِ tempKey و restClient)، `features/legacy-ws/soniox.ts` |
| primitiveهایِ مشترکِ بی‌دامنه | `server/src/shared/` (keyedLock، rateLimit، persianDigits، jalali، ffmpeg، httpRange، sessionSttContext) |
| لایه‌ی LLMِ مستقل از provider | `server/src/llm/` (config، jsonCall، healthAlert) |
| رصد/ممیزی | `server/src/obs/` — [observability-audit](../06-platform/observability-audit.md) |
| اعلان‌ها | `server/src/features/notifications/` — [notifications](../06-platform/notifications.md) |
| دُمِ مشترکِ حذفِ آبشاری (صدا + Soniox) | `server/src/features/session-media/purge.ts` |
| مرزِ ماژول‌ها | `features/<x>/index.ts` (API عمومی)؛ `pnpm test:arch` (`scripts/check-backend-boundaries.mjs`) |
| helperهای مشترکِ UI | `api()`، `showScreen()`، `showBanner()`، `toFa()`، `escapeHtml()`، `describeMicError()`، `MicModule`، `detectWebView()`، `checkSecureAudioEnv()` در `index.html` |
| تشخیص | `diag-collect.sh`، `GET /api/health`، `GET /api/stt/check` |
| تست | `scripts/rt-harness.cjs`، `case-file-harness.ts`، `upload-harness.ts`، `treatment-unit-harness.ts`، `final-transcript-harness.ts`، `llm-harness.ts`، `route-snapshot.ts` (`test:routes`)، `api-contract-harness.mts` (`test:api`)، `check-backend-boundaries.mjs` (`test:arch`) |

## ۳. Subsystemها — [07-subsystems](../07-subsystems/README.md)

| # | Subsystem | فایل‌های اصلی |
|---|---|---|
| 01 | Browser Realtime Engine | `public/feelia-rt.js` (`RTSession`)، `server/src/features/transcription/soniox/tempKey.ts`، `POST /api/stt/realtime-session` |
| 02 | Audio Durability & Batch Fallback | `feelia-rt.js` (`AudioQueueDB`، `startDurable`، `uploadBatchSegments`، `drainQueuedAudioInBackground`، `archiveQueuedAudioOnly`، `awaitBatchDrain`)، `features/transcription/batch/`، `features/transcription/soniox/restClient.ts` |
| 03 | Transcript Integrity | `PUT /api/sessions/:id`، `persistConfirmed`، `mergeBatchTranscript`، `noteDiscontinuity`، `features/legacy-ws/transcription.routes.ts` (نوشتن‌های legacy) |
| 04 | Legacy WS Proxy (P1) | `features/legacy-ws/transcription.routes.ts`، `features/legacy-ws/p1.ts`، `features/legacy-ws/soniox.ts`، `SonioxDirect`/`connectWS`/`startMic`/`handleMsg` در index |
| 05 | Session Audio Archive & Speaker Resolve | `features/transcription/archive/`، `features/transcription/speakerResolve.ts`، روت‌های admin audio و resolve-speakers |
| 06 | [Audio Upload Pipeline](../07-subsystems/06-audio-upload-pipeline.md) (2026-09-23، ماژولِ 04) | `server/src/features/audio-upload/{uploads.routes,uploadStore,media,quality,jobMachine,jobStore.sql,worker}.ts` (`quality.ts` 2026-09-28: سنجشِ کیفیت، پلنِ B)، `features/notifications/notify.ts`، `features/case-file/application/autoTrigger.ts`، `public/feelia-upload.js`؛ در index: `openAudioUploadModal`، `startAudioUpload`، `renderTray`، `refreshProcessing`، `jobCardHtml`، `renderSessionUploadJob`، `jobQualityHtml` (2026-09-28)؛ جداول `audio_uploads`/`audio_jobs`/`notifications` |
| 07 | [Final Transcript](../07-subsystems/07-final-transcript.md) (2026-09-27، ماژولِ 04) | `server/src/features/final-transcript/{domain/{jobMachine,polishGuards,transcriptText},application/{polishTranscript,prompts},adapters/llmJson,api/finalTranscript.routes,runner,ports,index}.ts`؛ در index: `loadFinalTranscript`، `renderFinalTranscript`، `toggleFinalTranscriptSetting`؛ جدولِ `final_transcripts`؛ تست `scripts/final-transcript-harness.ts` |

## ۴. فایل‌های بدونِ ماژول

| فایل | وضعیت |
|---|---|
| `feelia-design-system.html` | مرجعِ طراحی |
| `session_assistant_v11 (3).html` | HISTORICAL |
| `soniox.html` | مرجعِ خارجی |
| `diag-collect.sh` | ابزارِ ops |
