# Feature Index — رجیستریِ واحدِ فیچرها

> **اعتبار:** ACTIVE-CANONICAL · مالکِ نگاشتِ «فیچر ↔ کد ↔ سند ↔ تست ↔ جدول». قانونِ حاکم: [LAW-025/026](../00-governance/project-laws.md).
> `CLAUDE.md` §4 به همین فایل route می‌کند. قالبِ سندِ هر فیچر: [feature-doc-template](../00-governance/feature-doc-template.md).
> `pnpm test:docs` تضمین می‌کند هر پوشه‌ی `server/src/features/*` و هر platform اینجا ردیف دارد و سندِ مالکش موجود است.
> last-verified: 2026-09-30 @ `17d6919`

## ۱. Featureها (`server/src/features/*`)

| id | پوشه‌ی backend | Frontend | سندِ مالک | harness | جدول‌هایِ مالک |
|---|---|---|---|---|---|
| `auth` | `features/auth/` (+ platform `auth/`) | `index.html` (ورود/ثبت‌نام) | [ماژول 01](../04-modules/01-therapist-accounts/module-prd.md) | `test:api` | `therapists`، `auth_sessions` |
| `clients` | `features/clients/` (`consent.ts`) | `index.html` (لیست/جزئیاتِ مراجع) | [ماژول 02](../04-modules/02-client-management/module-prd.md) | `test:api` | `clients`، `client_members` (نوشتن: `clients.repository.ts` و treatment-unit) |
| `sessions` | `features/sessions/` (`autoClose.ts`، `sessionNumber.ts`، `sessionDate.ts`) | `index.html` (Setup/Live/Wrapup/جلسه) | [ماژول 03](../04-modules/03-therapy-sessions/module-prd.md) | `test:api` | `sessions` (⚠️ چند featureِ دیگر هم می‌نویسند — [database-catalog](database-catalog.md)) |
| `notes` (شاملِ **یادداشتِ پیش از جلسه / pre-note**، متنی و صوتی) | `features/sessions/notes.routes.ts`، `voiceNote.legacy.ts`؛ ساختِ `note_before` در `sessions.repository.ts` (`createLiveSession`)؛ رونویسیِ `purpose=pre-note` در `transcription/batch/processQueue.ts`؛ mintِ `purpose:'pre-note'` در `transcription/stt.routes.ts` | `index.html` (علائم/یادداشت؛ pre-note: `makePreVoice`، `restorePreVoiceDrafts`، `enqueuePreVoiceClips`) | [ماژول 05](../04-modules/05-notes-and-signs/module-prd.md) | `test:rt` | `session_notes` |
| `transcription` | `features/transcription/` (`stt.routes.ts`، `batch/`، `archive/`، `soniox/`، `speakerResolve.ts`) | `feelia-rt.js` + `index.html` | [ماژول 04](../04-modules/04-transcription/module-prd.md) + subsystemهایِ [01](../07-subsystems/01-browser-realtime-engine.md)، [02](../07-subsystems/02-audio-durability-batch-fallback.md)، [03](../07-subsystems/03-transcript-integrity.md)، [05](../07-subsystems/05-session-audio-archive-speaker-resolve.md) | `test:rt` | `session_audio` |
| `legacy-ws` | `features/legacy-ws/` | `SonioxDirect` در `index.html` | [subsystem 04](../07-subsystems/04-legacy-ws-proxy-p1.md) (LEGACY، LAW-015) | — | — |
| `audio-upload` | `features/audio-upload/` | `feelia-upload.js` | [subsystem 06](../07-subsystems/06-audio-upload-pipeline.md) | `test:up` | `audio_uploads`، `audio_jobs` |
| `final-transcript` | `features/final-transcript/` | `index.html` (تبِ «متنِ نهایی») | [subsystem 07](../07-subsystems/07-final-transcript.md) | `test:ft` | `final_transcripts` |
| `case-file` | `features/case-file/` | `index.html` (پروندهٔ درمان) | [ماژول 08](../04-modules/08-ai-case-file/module-prd.md) | `test:cf` | `client_case_file` |
| `treatment-unit` | `features/treatment-unit/` | `index.html` (واحدِ درمان/اعضا) | [ماژول 09](../04-modules/09-treatment-unit/module-prd.md) | `test:tu` | `tu_unit_types`، `tu_member_roles`، `tu_modalities`، `tu_modality_terms` |
| `admin` | `features/admin/` | `index.html` (پنلِ ادمین، ۱۱ صفحه) | [ماژول 06](../04-modules/06-admin-panel/module-prd.md) | `test:api` | — (فقط می‌خواند/خروجی می‌دهد) |
| `client-config` | `features/client-config/` | `feelia-analytics.js`، `feelia-obs.js` | [ماژول 07](../04-modules/07-ux-analytics/module-prd.md) + [analytics-clarity](../analytics-clarity.md) | — | — |
| `notifications` | `features/notifications/` | `index.html` (زنگِ اعلان) | [platform/notifications](../06-platform/notifications.md) | `test:up` | `notifications` |
| `session-media` | `features/session-media/` | — | [platform/session-media-purge](../06-platform/session-media-purge.md) | — | — (فایل‌هایِ `data/`) |

## ۲. Platform (مشترک؛ feature نیستند)

| id | مسیر | سندِ مالک | harness | جدول‌هایِ مالک |
|---|---|---|---|---|
| `llm` | `server/src/llm/` | [llm-provider-layer](../06-platform/llm-provider-layer.md) | `test:llm` | — |
| `obs` | `server/src/obs/` | [observability-audit](../06-platform/observability-audit.md) | `test:api` | `obs_events`، `obs_ui_events`، `audit_log` |
| `db` | `server/src/db/` | [data-architecture](../01-architecture/data-architecture.md)، [database-catalog](database-catalog.md) | `test:api` | `_migrations` |
| `shared` | `server/src/shared/` | [application-architecture](../01-architecture/application-architecture.md) | — | — |
| `jobs` | `server/src/jobs/` | [platform README](../06-platform/README.md) | — | — |

## ۳. Frontend (بدونِ build)

| فایل | نقش | سند |
|---|---|---|
| `public/index.html` | SPA اصلی (همه‌ی صفحه‌ها) | [frontend-map](frontend-map.md)، [route-map](route-map.md) |
| `public/feelia-rt.js` | موتورِ realtime | subsystem 01 |
| `public/feelia-upload.js` | آپلودِ فایلِ صوتی | subsystem 06 |
| `public/feelia-admin-quality.js` | ادمین: «کیفیتِ رونویسی» + تاریخچه‌ی «متنِ نهایی» (Session Data Engine) | [subsystem 06 §11](../07-subsystems/06-audio-upload-pipeline.md)، [subsystem 07](../07-subsystems/07-final-transcript.md) |
| `public/feelia-obs.js` | رصدِ کلیک/ناوبری | [observability-audit](../06-platform/observability-audit.md) |
| `public/feelia-analytics.js` | Clarity | [analytics-clarity](../analytics-clarity.md) |

## ۴. Harnessها

`test:rt` (`scripts/rt-harness.cjs`) · `test:cf` · `test:up` · `test:tu` · `test:ft` · `test:llm` · `test:api` (⚠️ DBِ مشترکِ dev، فقط با مجوزِ مالک) · `test:routes` · `test:arch` · `test:docs`. جزئیات: `CLAUDE.md` §8.

## ۵. Featureِ جدید — چک‌لیست
۱. پوشه با `index.ts`؛ ۲. ردیف اینجا؛ ۳. سند طبقِ template؛ ۴. ثبت در [documentation-map](../00-governance/documentation-map.md)؛ ۵. جدولِ جدید ⇒ ستونِ «مالک» در database-catalog؛ ۶. فرانتِ جدید ⇒ فایلِ IIFEِ جدا.
