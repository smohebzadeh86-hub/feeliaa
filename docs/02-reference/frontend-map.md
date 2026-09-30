# Frontend Map — نقشه‌ی فرانت (feature ↔ صفحه ↔ تابع ↔ state ↔ storage)

> **وضعیت:** ACTIVE-CANONICAL · last-verified: 2026-09-30 @ `17d6919` · نامِ symbol (نه شماره‌ی خط). `pnpm test:docs` وجودِ هر symbol را در `public/` می‌سنجد.
> مالک: [feature-index](feature-index.md) · صفحه‌ها و مودال‌ها: [route-map](route-map.md) · کلیدهایِ storage: [configuration-catalog §۴](configuration-catalog.md) · قاعده: [LAW-025](../00-governance/project-laws.md) (فرانتِ جدید ⇒ IIFEِ جدا).

## ۱. ساختار
- `public/index.html`: یک `<script>` بزرگِ global (≈۴۵۰ تابع، ≈۱۵۰ `let` سراسری) + markup همه‌ی صفحه‌ها (`section#screen<Name>`) و مدال‌ها. هر feature یک banner `// ===== [feature:<id>] =====` رویِ تابعِ ورودیِ اصلی‌اش دارد (2026-09-30؛ `pnpm test:docs` D12 وجودشان را می‌سنجد)؛ بقیه‌ی توابعِ feature پراکنده‌اند و مرزِ بلوکی ندارند.
- فایل‌هایِ IIFE: `feelia-rt.js` (`window.FeeliaRT`)، `feelia-upload.js` (`window.FeeliaUpload`)، `feelia-obs.js` (`window.FeeliaObs`)، `feelia-analytics.js` (`window.FeeliaAnalytics`). ترتیبِ لود: rt → analytics → obs → upload → inline.
- ناوبری: `showScreen(name)`؛ URL عوض نمی‌شود. خطا/نمایش: `api()`، `showBanner()`، `escapeHtml()`.

## ۲. جدولِ feature
| feature | صفحه‌ها / مدال‌ها | توابعِ ورودی | stateِ global | storage |
|---|---|---|---|---|
| `auth` | `#screenAuth` | `init` `enterApp` `toggleAuthMode` `submitAuth` `logout` | `currentTherapist` `authMode` | cookie `feelia_session` |
| `clients` | `#screenClients`، `#screenAllClients`، `#screenClientDetail`؛ مودال‌ها: `#newClientModal`، `#deactivateClientModal`، `#editCategoryModal`، `#deleteClientModal` | `loadClients` `applyClientFilters` `renderTodayClientsView` `renderAllClientsView` `renderClientGroups` `openClientDetail` `showAllClients` `renderCatFilterRow` `renderCategoryChips` | `currentClient` `allClients` `clientTab` `clientsView` `clientCategoryFilter` `clientGenderFilter` `clientSortMode` `deactivateTargetClient` `editCategoryTargetClient` | — |
| `sessions` | `#screenSetup`، `#screenLive`، `#screenWrapup`، `#screenSessionDetail`؛ مودال‌ها: `#cancelModal`، `#exitModal`، `#deleteSessionModal`، `#editSessionModal` | `setupNewSession` `runPreflight` `startSession` `liveResumeSession` `finishSession` `handleFinished` `resumeSession` `doViewTranscript` `renderLive` `renderSetupChips` `renderTimer` `sessionStatusFa` | `currentSession` `consent` `elapsedMs` `timerRunning` `currentViewSession` `currentViewNotes` `preflightMicOk` `preflightSttOk` `wrapupNotes` | `feelia_active_session`، `feelia_pending_complete` |
| `notes` | `#screenLive` (چیپ علائم/یادداشتِ سریع)، `#screenWrapup`، `#screenSessionDetail` | `renderSignsLog` `renderNotesLog` `renderWrapupSigns` `renderWrapupNotesLog` `renderWrapupNotes` `startVoiceNoteDirect` `startArchiveVoiceNote` `renderArchiveNotesList` `renderPreNotesEditor` `renderPresence` `makePreVoice` `restorePreVoiceDrafts` `enqueuePreVoiceClips` | `sessionSigns` `sessionNotes` `wrapupNotes` `noteOutboxBusy` `wrapupPreState` `presenceUnit` `preDraftClaimed` | `feelia_note_outbox`؛ IndexedDB `feelia-predraft/clips` |
| `transcription` | `#screenLive` | `startNewRTSession` `endNewRTSession` `rtOnState` `pauseSessionLive` `resumeSessionLive` `Mic_requestStream` `Mic_createRecorder` | rtSession-related: elapsedMs، lastPreviewAt، lastAudioSentAt، sttWarnAt | `feelia_direct`؛ IndexedDB `feelia-audio/segments`؛ `p1c-<sessionId>` (legacy) |
| `legacy-ws` | `#screenLive` (LEGACY) | `startDirectLive` `pauseDirectLive` `resumeDirectLive` | `ws` `wsConnected` `p1ClientId` `p1NextSeq` `unacked` `directActive` `directRec` | `p1c-<sessionId>` |
| `audio-upload` | `#audioUploadModal`، `#logoutUploadModal`، سینیِ کارها (tray)، `#screenSessionDetail` (کارتِ job) | `openAudioUploadFromSetup` `openAudioUploadModal` `renderAudioUploadFiles` `renderAudioUploadConsent` `renderTray` `retryAudioJob` `renderSessionUploadJob` `stopSessionJobPoll` `openSessionFromJob` | — | IndexedDB `feelia-uploads/tasks` (`feelia-upload.js`، `window.FeeliaUpload`) |
| `final-transcript` | `#screenSessionDetail` (تبِ «متنِ نهایی») | `renderFinalTranscript` `ftRenderTurns` `ftApplyRole` `ftToggleRoleMenu` `ftStopPoll` | `ftState` `ftShowRaw` `ftShowEdits` `ftPollTimer` `ftSessionId` | — |
| `case-file` | `#screenClientDetail` (`.case-file-doc`)؛ مودال‌ها: `#caseFileAutoPromptModal`، `#cfAddItemModal`، `#cfDeleteItemModal` | `renderCaseFile` `cfSummaryClick` `cfOpenKey` `cfSaveOpen` `cfUpgrade` `cfSyncAllBtn` `cfAddBtn` `cfDelBtn` `cfStarBtn` `cfMove` | `currentCaseFile` `caseFileEditMode` `cfPendingNewItem` `cfPinned` `cfAddItemMode` `cfDeleteTarget` `regenerateCaseFilePollTimer` | `feelia-cf-open:<clientId>:<axis>` |
| `treatment-unit` | `#editUnitModal`، `#modalitiesModal`، کارتِ «حاضرین» در `#screenSetup` | `tuUnit` `tuRole` `tuDefaultPreset` `tuNewState` `tuStateFromUnit` `tuStateToBody` `tuAutoLabels` `tuUnitSummary` `renderUnitEditor` `renderEditUnit` `openEditUnitModal` `confirmEditUnit` `renderModalitiesChips` `openModalitiesModal` `confirmModalities` | `tuCatalog` `tuTherapistModalities` `currentClientUnit` `editUnitState` `editUnitFrom` `modalitiesDraft` | — |
| `admin` | `#screenAdmin`، `#screenAdminTherapist`، `#screenAdminSessions`، `#screenAdminSessionDetail`، `#screenAdminActivity`، `#screenAdminSessionTimeline`، `#screenAdminAudio`، `#screenAdminVoiceNotes`؛ مودال‌ها: `#deleteTherapistModal`، `#deleteClientModal` | `openAdminPanel` `openAdminActivity` `openAdminSessionTimeline` `openAdminAudio` `openAdminVoiceNotes` `openAdminTherapistDetail` `openAdminClientSessions` `openAdminSessionDetail` `renderAdminSessionDiagnosis` `renderAdminStats` `renderAdminTherapists` `adminDownload` `adminDownloadAll` `adminSetActive` `adminSetIsAdmin` `adminDeleteClient` | `adminTherapists` `currentAdminTherapistId` `adminActivityCurrentTab` `adminTimelineSessionId` `adminAudioOffset` `adminVnOffset` `adminDetailReturn` | — |
| `notifications` | زنگِ اعلان + سینی | `openNotification` `notifText` `notifIsBad` `notifOsText` | — | — |
| `client-config` | — | `uxTrack` | — | — |

## ۳. IIFEها — APIِ عمومی
| فایل | export | مصرفِ اصلی |
|---|---|---|
| `feelia-rt.js` | `STATES`، `isAvailable`، `createSession` (⇒ نمونه‌ی `RTSession` با `start/pause/resume/finish`)، `hasOpenConnection`، `hasActiveRecording`، `forget`، `cleanText`، `signMarker`، `removeMarkerFromText`، `audioQueue` (`AudioQueueDB`)، `uploadQueuedSegment`، `isSessionActive`، `withAudioLock`، `createAudioQualityMonitor` | `startNewRTSession`، یادداشتِ صوتی، `sweepOrphanedAudioQueue` |
| `feelia-upload.js` | `FeeliaUpload` | `openAudioUploadModal` و سینی |
| `feelia-obs.js` | `FeeliaObs` | خودکار (کلیک/ناوبری؛ `data-obs`) |
| `feelia-analytics.js` | `FeeliaAnalytics.boot/screen/event/micError/onLogout/state` | `showScreen`، `uxTrack`، `enterApp`، `logout` |

## ۴. قواعدِ افزودن
۱) فرانتِ feature جدید ⇒ `public/feelia-<x>.js` (IIFE، `window.Feelia<X>`) + ردیف در جدولِ بالا؛ ۲) هر containerِ حاوی داده‌ی حساس `data-clarity-mask="true"` (LAW-011)؛ ۳) کلیدِ storage جدید ⇒ [configuration-catalog §۴](configuration-catalog.md)؛ ۴) متنِ رضایت/privacy باید با رفتارِ ذخیره‌ی صدا مطابق بماند (LAW-009).

## ۵. UNKNOWN / بدهی
- نامِ توابعِ داخلِ IIFEهایِ کوچکِ `index.html` (مثلاً بلوکِ `feelia-predraft`) در جدول فقط با نامِ symbolِ صادرشده آمده؛ مرزِ دقیقِ بلوک‌ها مستند نیست.
- `module-map` تا 2026-09-30 نامِ بعضی توابعِ قدیمی را داشت؛ درست شد (`renderTodayClientsView`/`renderAllClientsView`). ثبتِ دستیِ جلسه: `startManualSessionFlow`. این جدول مرجعِ معتبر است.
