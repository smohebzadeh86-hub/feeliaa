# Repository Map

> **وضعیت:** ACTIVE-CANONICAL · last-verified: 2026-09-30 @ `17d6919` (`git ls-files` + `git status`).
> Git: `T` = tracked · `U` = untracked · `I` = ignored. وضعیتِ commit فقط نشانِ لحظه‌ی snapshot است؛ وضعیتِ زنده در `PROJECT_STATUS.md` (LAW-027). نگاشتِ feature↔کد: [feature-index](feature-index.md).

```
feeliaa/
├── CLAUDE.md                          T  router agent
├── PROJECT_MASTER_REFERENCE.md        T  master reference
├── PROJECT_STATUS.md                  T  وضعیتِ زنده + Event Log (با هر رویداد به‌روز می‌شود)
├── CURRENT_UI_STATE.md                U  snapshotِ UI (EVIDENCE)
├── package.json                       T  root: dev, test:rt, test:cf, test:up, test:tu, test:ft, test:llm, test:api, test:routes, test:arch
├── pnpm-workspace.yaml                T
├── pnpm-lock.yaml                     T
├── package-lock.json                  U  lockfileِ خالیِ npm — IRRELEVANT
├── .gitignore                         T
├── .claude/launch.json                U  کانفیگِ dev server
├── diag-collect.sh                    T  ابزارِ تشخیصِ read-only production
├── deploy/nginx/feelia.conf           U  کانفیگِ مرجعِ nginx (REFERENCE؛ با کانفیگِ زنده مقایسه نشده — deployment-operations §4)
├── feelia-design-system.html          T  مرجعِ طراحی
├── session_assistant_v11 (3).html     T  HISTORICAL: نمونه‌ی بدون سرور
├── soniox.html                        U  کپیِ مستنداتِ Soniox (شخص ثالث)
├── feelia-f9b0a9c.tar                 U  snapshot — نباید commit شود
│
├── public/                               فرانت (سرو شده توسط سرور)
│   ├── index.html                     T  SPA اصلی (یک اسکریپتِ بزرگ — [frontend-map](frontend-map.md))
│   ├── feelia-rt.js                   T  موتورِ realtime
│   ├── feelia-analytics.js            T  Clarity
│   ├── feelia-obs.js                  T  تله‌متریِ کلیک/ناوبری به `/api/obs/events`
│   └── feelia-upload.js               T  موتورِ آپلودِ تکه‌تکه/قابلِ ادامه (IndexedDB `feelia-uploads`)
│
├── server/
│   ├── package.json, tsconfig.json    T
│   ├── scripts/copy-assets.mjs        T  کپیِ migration به dist
│   ├── .env                           I  secret
│   ├── data/                          I  batch-queue/, session-audio/ (صدای واقعی!)
│   ├── dist/                          I  خروجیِ build
│   └── src/                          (ساختارِ ماژولار از 2026-09-28 — [application-architecture §1](../01-architecture/application-architecture.md))
│       ├── index.ts                   entry: dotenv → buildApp → migrations → startBackgroundJobs → listen
│       ├── app.ts                     buildApp(): Fastify + pluginها + static + /api/health
│       ├── jobs/backgroundJobs.ts     همه‌ی sweep/workerهایِ پس‌زمینه
│       ├── shared/  keyedLock.ts · rateLimit.ts · persianDigits.ts · jalali.ts · ffmpeg.ts · httpRange.ts · sessionSttContext.ts (بی‌دامنه)
│       ├── auth/    guard.ts · session.ts · password.ts
│       ├── db/      connection.ts · migrate.ts · ownership.ts · mysql/migrations/ (001–034؛ migrations/ = Postgresِ متروک)
│       ├── obs/     types · redact · fileSink · eventLog · httpHook · audit · sweep · obs.routes.ts (`POST /api/obs/events`)
│       ├── llm/     config.ts · jsonCall.ts · healthAlert.ts — لایه‌ی LLMِ مستقل از provider (2026-09-28؛ `pnpm test:llm`)
│       └── features/
│           ├── auth/            auth.routes.ts · therapists.repository.ts
│           ├── clients/         clients.routes.ts · clients.repository.ts · consent.ts · index.ts
│           ├── sessions/        sessions.routes.ts · notes.routes.ts · batch.routes.ts · voiceNote.legacy.ts · sessions.repository.ts
│           │                    · sessionDate.ts · sessionNumber.ts · autoClose.ts · index.ts
│           ├── transcription/   stt.routes.ts · soniox/{config,restClient,tempKey}.ts · signMarkers.ts · speakerResolve.ts · index.ts
│           │   ├── batch/       queueFiles · recoveryMerge · processQueue · sweep
│           │   └── archive/     store · ffmpegOps · archiveWrite · listing · fullAudio · sweep
│           ├── session-media/   purge.ts · index.ts
│           ├── admin/           admin.routes.ts · therapists/sessions/audio/export/obs.admin.ts · admin.repository.ts · diagnosis.ts · filters.ts
│           ├── audio-upload/    uploads.routes.ts · uploads.repository.ts · uploadSession.ts · groupFinalize.ts · uploadLocks.ts · jobMachine.ts
│           │                    · jobStore.sql.ts · worker.ts · quota.ts · sonioxRefs.ts · orphanSweep.ts · uploadStore.ts · media.ts · quality.ts · index.ts
│           ├── notifications/   notify.ts · notifications.routes.ts · index.ts
│           ├── case-file/       api/ · application/ · domain/ · ports/ · adapters/{llm,repository}/ · prompts/ · composition.ts · index.ts
│           │                    (adapters/llm/chatLlm.adapter.ts + registry؛ prompts/{systemPrompts,userPrompts}.ts)
│           ├── treatment-unit/  واحدِ درمان (فردی/زوج/خانواده) + contextِ پویایِ Soniox؛ index.ts (routeها هم) — `pnpm test:tu`
│           ├── final-transcript/ «متنِ نهایی» ([subsystem 07](../07-subsystems/07-final-transcript.md))؛ index.ts (routeها + worker) — `pnpm test:ft`
│           ├── client-config/   clientConfig.routes.ts
│           └── legacy-ws/       transcription.routes.ts · p1.ts · soniox.ts (LAW-015)
│
├── server-deploy/                     U  EVIDENCE/stale: کپیِ server در f9b0a9c + .env + dist + node_modules
│
├── scripts/rt-harness.cjs             T  تستِ FeeliaRT (`pnpm test:rt`)
├── scripts/treatment-unit-harness.ts  T  تستِ واحدِ درمان (`pnpm test:tu`؛ دامنه/نگاشتِ مدالیته/migration؛ بدونِ DB)
├── scripts/check-docs.mjs             T  `pnpm test:docs` — بهداشتِ مستندات (LAW-027)
├── scripts/case-file-harness.ts       T  تستِ پرونده‌ی درمان (findings/merge/patch/repairLoop؛ بدونِ شبکه/DB) — 2026-09-20
├── scripts/final-transcript-harness.ts U  تستِ «متنِ نهایی» (`pnpm test:ft`؛ ماشینِ حالت، نگهبان‌ها، تکه‌بندی، polish با LLMِ جعلی) — 2026-09-27
├── scripts/llm-harness.ts             U  تستِ لایه‌ی LLM (`pnpm test:llm`؛ config هر provider، رگرسیونِ بدنه‌ی OpenRouter/OpenAI، JSON، providerِ جایگزین؛ کلاینتِ جعلی) — 2026-09-28
├── scripts/upload-harness.ts          T  تستِ pipelineِ آپلودِ صدا (`pnpm test:up`؛ ماشینِ حالت با portهایِ جعلی + ffmpegِ واقعی) — 2026-09-23
├── scripts/route-snapshot.ts (+ .txt) T  `pnpm test:routes` — قراردادِ routeها و guardهایِ مؤثر (2026-09-28)
├── scripts/api-contract-harness.mts   T  `pnpm test:api` (فقط با FEELIA_E2E_OK=1) — characterizationِ APIِ رویِ DBِ dev با fixture (2026-09-28)
├── scripts/check-backend-boundaries.mjs T `pnpm test:arch` — قواعدِ مرز/چرخه‌ی ماژول‌هایِ backend (2026-09-28)
│
├── docs/
│   ├── README.md · admin-panel.md (HISTORICAL) · analytics-clarity.md (ACTIVE)
│   └── 00-governance/ … 07-subsystems/  معماریِ مستندات (`02-reference/feature-index.md` = رجیستریِ فیچرها)
│
└── verification/                      U  evidence تاریخ‌دار
```

## نکاتِ مهم
- `server/data/` شاملِ صدای واقعیِ جلسات است (`batch-queue`، `session-audio`، `uploads`). هرگز باز/کپی/commit نشود (LAW-001، LAW-002).
- `server-deploy/.env` و `server/.env` هر دو secret دارند؛ `server-deploy/` کپیِ قدیمی است (EVIDENCE).
- `node_modules/` در root، `server/`، `server-deploy/`.
- شاخه‌ها و وضعیتِ push/merge: فقط `git branch -vv` و `PROJECT_STATUS.md`.
- `server/src/db/migrations/` = Postgresِ متروک (هیچ runnerِ زنده‌ای)؛ MySQL: `server/src/db/mysql/migrations/`.

## نقشه‌ی مسیرهایِ قدیم → جدید (بازسازیِ ماژولارِ 2026-09-28)
شماره‌خط‌هایِ اسنادِ قدیمی و `verification/` به مسیرهایِ قدیم اشاره می‌کنند؛ این جدول برایِ پیدا کردنِ همان کد است. رفتار عوض نشده.

| قدیم (`server/src/`) | جدید (`server/src/`) |
|---|---|
| `index.ts` (ساختِ اپ + jobها) | `app.ts` (buildApp) · `jobs/backgroundJobs.ts` · `index.ts` |
| `http/auth.ts` | `features/auth/auth.routes.ts` + `therapists.repository.ts` |
| `http/clients.ts` · `http/clientConsent.ts` | `features/clients/clients.routes.ts` · `consent.ts` + `clients.repository.ts` |
| `http/sessions.ts` | `features/sessions/`: `sessions.routes.ts` (CRUD، tail) · `notes.routes.ts` · `batch.routes.ts` (batch-audio/status/retry، resolve-speakers) · `voiceNote.legacy.ts` · `sessions.repository.ts` · `sessionNumber.ts` |
| `http/sessionDate.ts` · `http/sessionAutoClose.ts` | `features/sessions/sessionDate.ts` (+ `shared/jalali.ts`) · `features/sessions/autoClose.ts` |
| `http/stt.ts` | `features/transcription/stt.routes.ts` |
| `http/admin.ts` | `features/admin/` (`admin.routes.ts` + `*.admin.ts`، `admin.repository.ts`، `diagnosis.ts`، `filters.ts`) |
| `http/clientConfig.ts` · `http/obs.ts` | `features/client-config/clientConfig.routes.ts` · `obs/obs.routes.ts` |
| `stt/tempkey.ts` · `stt/asyncTranscribe.ts` | `features/transcription/soniox/tempKey.ts` · `soniox/restClient.ts` (+ `soniox/config.ts`) |
| `stt/batchqueue.ts` | `features/transcription/batch/{queueFiles,recoveryMerge,processQueue,sweep}.ts` |
| `stt/sessionAudioArchive.ts` | `features/transcription/archive/{store,ffmpegOps,archiveWrite,listing,fullAudio,sweep}.ts` |
| `stt/speakerResolve.ts` · `stt/signMarkers.ts` | `features/transcription/speakerResolve.ts` · `signMarkers.ts` |
| `stt/sessionContext.ts` | `shared/sessionSttContext.ts` |
| `stt/soniox.ts` · `ws/transcription.ts` · `ws/p1.ts` | `features/legacy-ws/soniox.ts` · `transcription.routes.ts` · `p1.ts` |
| `features/audio-upload/jobRunner.ts` | `worker.ts` · `jobStore.sql.ts` · `quota.ts` · `orphanSweep.ts` · `sonioxRefs.ts` |
| `features/audio-upload/uploads.routes.ts` (اعلان‌ها، تراکنش‌ها، گروه) | `features/notifications/notifications.routes.ts` · `uploadSession.ts` · `groupFinalize.ts` · `uploadLocks.ts` · `uploads.repository.ts` |
| `features/case-file/application/buildCaseFilePrompt.ts` | `features/case-file/prompts/{systemPrompts,userPrompts}.ts` |
| cascadeِ حذف (پوشه‌هایِ صدا + منابعِ Soniox) در ۴ route | `features/session-media/purge.ts` |
