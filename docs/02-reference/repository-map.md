# Repository Map

> **وضعیت:** ACTIVE-CANONICAL · Snapshot: `git ls-files` (۳۸ فایل tracked) + `git status` در 2026-09-13.
> Git: `T` = tracked · `M` = tracked و modified · `U` = untracked · `I` = ignored.

```
feeliaa/
├── CLAUDE.md                          U  router agent (جدید)
├── PROJECT_MASTER_REFERENCE.md        U  master reference (جدید)
├── PROJECT_STATUS.md                  M  وضعیتِ زنده + Event Log (tracked از `54a17fd`؛ با هر رویداد به‌روز می‌شود)
├── package.json                       T  root: dev, test:rt, test:cf
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
│   ├── index.html                     T  SPA کامل (تا commit `54a17fd`)
│   ├── feelia-rt.js                   T  موتورِ realtime (تا commit `54a17fd`)
│   ├── feelia-analytics.js            U  Clarity
│   ├── feelia-obs.js                  U  جدید، فازِ ۱ِ رصد/حسابرسی (2026-09-22) — تله‌متریِ کلیک/ناوبریِ سمتِ کلاینت به `/api/obs/events`
│   └── feelia-upload.js               U  جدید 2026-09-23 — موتورِ آپلودِ تکه‌تکه/قابلِ ادامه‌ی فایلِ صوتیِ جلسه (IndexedDB `feelia-uploads`)
│
├── server/
│   ├── package.json, tsconfig.json    T
│   ├── scripts/copy-assets.mjs        T  کپیِ migration به dist
│   ├── .env                           I  secret
│   ├── data/                          I  batch-queue/, session-audio/ (صدای واقعی!)
│   ├── dist/                          I  خروجیِ build
│   └── src/
│       ├── index.ts                   M
│       ├── auth/ guard.ts M · session.ts T · password.ts T
│       ├── db/   connection.ts T · migrate.ts T · ownership.ts T
│       │   └── migrations/ 001–014 T (008–014 با commitِ `54a17fd`، 2026-09-15؛ هنوز رویِ production اجرا نشده)
│       ├── http/ admin.ts M · auth.ts M · clients.ts T (تا `54a17fd`) · sessions.ts T (تا `54a17fd`) · stt.ts M · clientConfig.ts U · sessionDate.ts T (نرمال‌سازیِ تاریخ/ساعتِ شمسیِ جلسه، `54a17fd`) · obs.ts U (جدید، فازِ ۱: `POST /api/obs/events`)
│       ├── obs/   U — جدید، فازِ ۱ِ رصد/حسابرسی (2026-09-22): types.ts، redact.ts (نقطه‌ی اجرایِ LAW-001، `sanitizeDetail`/`isSafeToken`)، fileSink.ts (JSONLِ چرخشی، بدونِ dependency)، eventLog.ts (صفِ درون‌حافظه‌ای + drain به DB، `logEvent`/`logUiEvents`)، httpHook.ts (`registerObsHooks`)، sweep.ts (`sweepOldObsEvents`)
│       ├── stt/  batchqueue.ts M · soniox.ts M · tempkey.ts T · asyncTranscribe.ts U · sessionAudioArchive.ts U (+ `deriveSessionStatus` جدید، فازِ ۱) · speakerResolve.ts U
│       ├── features/case-file/  U — جدید 2026-09-17: AI Case File (Ports & Adapters)؛ `application/autoTrigger.ts` (2026-09-23، سیاستِ مرکزیِ تولیدِ خودکار)
│       ├── features/audio-upload/  U — جدید 2026-09-23: آپلودِ فایلِ صوتیِ جلسه + jobِ پس‌زمینه ([subsystem 06](../07-subsystems/06-audio-upload-pipeline.md))
│       ├── features/notifications/ U — جدید 2026-09-23: اعلان‌هایِ پایدار (`notify.ts`)
│       │   ├── domain/     types.ts، errors.ts، validate.ts، normalizeText.ts (جدید 2026-09-19)، findings.ts (جدید 2026-09-20: واحدِ «یافته»، شناسه‌ی فکت، finalizeCouple)
│       │   ├── ports/      llmProvider.port.ts، caseFileRepo.port.ts
│       │   ├── application/ aggregateClientCorpus.ts، renderDigest.ts (جدید 2026-09-19)، buildCaseFilePrompt.ts، mergeTherapistEdits.ts، applyFieldPatch.ts، generateCaseFile.ts، repairLoop.ts (جدید 2026-09-19)، upgradeLegacyContent.ts (جدید 2026-09-20: ارتقایِ پرونده‌ی قدیمی بدونِ LLM)
│       │   ├── adapters/   llm/openai.adapter.ts، llm/openrouter.adapter.ts (هر دو با SDKِ 'openai')، llm/registry.ts، llm/chatJson.ts + llm/caseFileDigestSchema.ts (جدید 2026-09-19)، llm/caseFileJsonSchema.ts، repository/caseFileRepository.sql.ts
│       │   └── api/        caseFile.routes.ts
│       └── ws/   transcription.ts T · p1.ts T
│
├── server-deploy/                     U  EVIDENCE/stale: کپیِ server در f9b0a9c + .env + dist + node_modules
│
├── scripts/rt-harness.cjs             T  تستِ FeeliaRT
├── scripts/case-file-harness.ts       T  تستِ پرونده‌ی درمان (findings/merge/patch/repairLoop؛ بدونِ شبکه/DB) — 2026-09-20
├── scripts/upload-harness.ts          U  تستِ pipelineِ آپلودِ صدا (`pnpm test:up`؛ ماشینِ حالت با portهایِ جعلی + ffmpegِ واقعی) — 2026-09-23
│
├── docs/
│   ├── README.md                      U
│   ├── admin-panel.md                 T  HISTORICAL
│   ├── analytics-clarity.md           U  ACTIVE (مالکِ جزئیاتِ Clarity)
│   ├── 00-governance/ … 07-subsystems/  U  معماریِ مستندات
│
└── verification/                      U  evidence تاریخ‌دار
```

## نکاتِ مهم
- **کارِ commitنشده:** کدِ محصول دیگر commitنشده نیست — تا `54a17fd` (2026-09-15) push شده. فقط فایل‌های `U` بالا که صراحتاً «مستندات/artifact» علامت خورده‌اند (خودِ `docs/`، `CLAUDE.md`، `PROJECT_MASTER_REFERENCE.md`، `.claude/`، و artifactهای نامرتبط مثلِ `feelia-f9b0a9c.tar`/`server-deploy/`/`soniox.html`/`package-lock.json`) هنوز در git نیستند.
- `server/data/` شاملِ صدای واقعیِ جلسات است (در dev: پوشه‌های `batch-queue` و `session-audio` موجودند). هرگز باز/کپی/commit نشود (LAW-001، LAW-002).
- `server-deploy/.env` و `server/.env` هر دو secret دارند.
- `node_modules/` در root، `server/`، `server-deploy/`.
- شاخه‌ها: `main` (`8bcdf0e`)، `feat/clarity` (فعلی، `54a17fd`، **جلوتر از main**، بدونِ merge)، `backup-before-merge-de6cb31`؛ remote: `origin` (`feat/clarity` push‌شده، `main` دست‌نخورده).
