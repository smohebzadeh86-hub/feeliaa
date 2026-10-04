# Documentation Map — نقشه‌ی کاملِ مستندات

> **وضعیت:** ACTIVE · **اعتبار:** HIGH · آخرین به‌روزرسانی: 2026-09-30
> هر سندِ جدید باید اینجا ثبت شود (LAW-017).

## ۱. واژگانِ وضعیت

| Status | معنا |
|---|---|
| ACTIVE-CANONICAL | مالکِ رسمیِ factهای خود؛ مبنای کار |
| ACTIVE-SUPPORTING | مرجعِ کمکی؛ مالکِ fact نیست یا منبعش خارجی است |
| EVIDENCE | مشاهده در یک تاریخ؛ حقیقتِ فعلی نیست |
| PROPOSED | پیشنهاد؛ تا تأییدِ مالک اجرا نمی‌شود |
| HISTORICAL | سابقه؛ با وضعیتِ فعلی تعارض دارد یا جایگزین شده |
| DEPRECATED | منسوخ؛ استفاده نشود |
| IRRELEVANT | مستند نیست / artifact |

| Completeness | معنا |
|---|---|
| COMPLETE | همه‌ی بخش‌های لازم از کد تأیید شده |
| PARTIAL | بخش‌هایی عمداً خالی/نیازمندِ کارِ بعدی |
| HAS-INFERRED | شاملِ ادعاهای INFERRED یا UNVERIFIED (برچسب‌خورده) |

«Review» = آیا مالکِ محصول سند را تأیید کرده؟ در 2026-09-13 برای همه‌ی اسنادِ جدید: **خیر**.

## ۲. ورودی‌ها و governance

| Document | Purpose | Status | Authority | Completeness | Owner / Scope | Depends On | Updated By |
|---|---|---|---|---|---|---|---|
| [`CLAUDE.md`](../../CLAUDE.md) | Router اجباریِ agent | ACTIVE-CANONICAL | HIGH | COMPLETE | کلِ repo | laws، master reference | هر تغییرِ ساختارِ docs یا دستورات |
| [`PROJECT_MASTER_REFERENCE.md`](../../PROJECT_MASTER_REFERENCE.md) | تصویرِ کل + وضعیت + ریسک | ACTIVE-CANONICAL | HIGH | HAS-INFERRED | کلِ پروژه | همه‌ی لایه‌ها | تغییرِ وضعیت/ریسک/ماژول |
| [`docs/README.md`](../README.md) | فهرستِ لایه‌ها | ACTIVE-SUPPORTING | MEDIUM | COMPLETE | docs/ | — | افزودنِ لایه |
| [project-laws.md](project-laws.md) | قوانین LAW-xxx | ACTIVE-CANONICAL | HIGHEST | COMPLETE | کلِ پروژه | تصمیم‌های مالک | قانونِ جدید/تغییرِ violation |
| [product-thesis.md](product-thesis.md) | Value thesis، Core Functional Job، Core/Non-Core، فیلترِ تصمیمِ feature، metricها (جهتِ محصول؛ 2026-10-02) | ACTIVE (نوشته‌ی مالک؛ جهت نه وضعیتِ کد) | HIGH برای اولویت‌بندی | HAS-INFERRED (§۱۶ تفسیرِ نگارنده) | کلِ محصول | تصمیمِ مالک | تغییرِ جهتِ محصول با تصمیمِ مالک |
| [source-of-truth.md](source-of-truth.md) | حلِ تعارض | ACTIVE-CANONICAL | HIGH | COMPLETE | کلِ پروژه | laws | تغییرِ سلسله‌مراتب |
| [ai-agent-reading-guide.md](ai-agent-reading-guide.md) | workflow agent | ACTIVE-CANONICAL | HIGH | COMPLETE | agentها | laws، module-map | درسِ جدید از خطا |
| [documentation-map.md](documentation-map.md) | همین فهرست | ACTIVE-CANONICAL | HIGH | COMPLETE | docs | همه | هر سندِ جدید/تغییرِ وضعیت |
| [feature-doc-template](feature-doc-template.md) | قالبِ اجباریِ سندِ فیچر (LAW-026) | ACTIVE-CANONICAL | HIGH | COMPLETE | همه‌ی featureها | laws | تغییرِ قالب |
| [`PROJECT_STATUS.md`](../../PROJECT_STATUS.md) | وضعیتِ زنده (مطابقِ ساختارِ دستورِ مستندسازی) + Event Logِ همه‌ی رویدادها | ACTIVE-CANONICAL (مالکِ Event Log) | HIGH | COMPLETE | کلِ پروژه | همه | **هر رویداد** (LAW-024) |

## ۳. معماری، مرجع، requirement

| Document | Purpose | Status | Authority | Completeness | Owner / Scope | Depends On | Updated By |
|---|---|---|---|---|---|---|---|
| [system-architecture](../01-architecture/system-architecture.md) | مرزها، اجزا، جریان‌ها | ACTIVE-CANONICAL | HIGH | HAS-INFERRED | سیستم | کد | تغییرِ مرز/جزء |
| [application-architecture](../01-architecture/application-architecture.md) | ساختارِ backend و frontend | ACTIVE-CANONICAL | HIGH | COMPLETE | server/، public/ | کد | فایل/لایه‌ی جدید |
| [data-architecture](../01-architecture/data-architecture.md) | مدلِ داده، مالکیت، چرخه‌ی عمر | ACTIVE-CANONICAL | HIGH | HAS-INFERRED | DB + فایل + IndexedDB | migrations | migration، تغییرِ retention |
| [integration-architecture](../01-architecture/integration-architecture.md) | Soniox، Clarity، egress | ACTIVE-CANONICAL | HIGH | COMPLETE | خارجی‌ها | کد stt/ | تغییرِ integration |
| [deployment-operations](../01-architecture/deployment-operations.md) | build/run/ops | ACTIVE-CANONICAL | MEDIUM | **HAS-INFERRED** (production UNVERIFIED) | runtime | package.json | هر تغییرِ استقرار |
| [api-catalog](../02-reference/api-catalog.md) | همه‌ی endpointها و پیام‌های WS | ACTIVE-CANONICAL | MEDIUM | COMPLETE | http/، ws/ | کد | endpoint/payload |
| [module-map](../02-reference/module-map.md) | ماژول ↔ کد ↔ subsystem | ACTIVE-CANONICAL | MEDIUM | COMPLETE | کلِ کد | کد | فایلِ جدید |
| [route-map](../02-reference/route-map.md) | screenهای UI و ثبتِ روت‌ها | ACTIVE-CANONICAL | MEDIUM | COMPLETE | index.html، index.ts | کد | screen/plugin جدید |
| [database-catalog](../02-reference/database-catalog.md) | جداول، ستون‌ها، enumها | ACTIVE-CANONICAL | MEDIUM | COMPLETE | migrations | کد | migration |
| [configuration-catalog](../02-reference/configuration-catalog.md) | env، ثابت‌ها، storage | ACTIVE-CANONICAL | MEDIUM | COMPLETE | کد | کد | env/ثابت |
| [error-code-catalog](../02-reference/error-code-catalog.md) | خطاها و کدها | ACTIVE-CANONICAL | MEDIUM | HAS-INFERRED | API | کد | کدِ خطای جدید |
| [repository-map](../02-reference/repository-map.md) | هر مسیر و وضعیتش | ACTIVE-CANONICAL | MEDIUM | COMPLETE | repo | git | فایل/پوشه‌ی جدید |
| [feature-index](../02-reference/feature-index.md) | رجیستریِ واحدِ feature↔کد↔سند↔تست↔جدول | ACTIVE-CANONICAL | HIGH | COMPLETE | کلِ repo | کد | feature/جدول/harnessِ جدید |
| [frontend-map](../02-reference/frontend-map.md) | نقشه‌ی فرانت: featureها ↔ صفحه/تابع/state/storage | ACTIVE-CANONICAL | MEDIUM | HAS-INFERRED | public/ | کد | تابع/صفحه‌ی جدید |
| [glossary](../02-reference/glossary.md) | اصطلاحات | ACTIVE-CANONICAL | MEDIUM | COMPLETE | پروژه | — | اصطلاحِ جدید |
| [requirement-catalog](../03-requirements/requirement-catalog.md) | REQ-xxx | ACTIVE-CANONICAL (REQها DERIVED) | HIGH | COMPLETE | محصول | کد، اسنادِ قبلی | تغییرِ رفتار/تأیید |
| [traceability-matrix](../03-requirements/traceability-matrix.md) | REQ→PRD→کد→تست | ACTIVE-CANONICAL | HIGH | PARTIAL (بیشترِ REQها تست ندارند) | محصول | catalog | تغییرِ REQ/تست |

## ۴. ماژول‌ها، پلتفرم، subsystemها، برنامه

| Document | Purpose | Status | Authority | Completeness | Updated By |
|---|---|---|---|---|---|
| [01-therapist-accounts PRD](../04-modules/01-therapist-accounts/module-prd.md) / [Plan](../04-modules/01-therapist-accounts/implementation-plan.md) | حسابِ تراپیست | ACTIVE-CANONICAL | HIGH | COMPLETE | تغییرِ auth/حساب |
| [02-client-management PRD](../04-modules/02-client-management/module-prd.md) / [Plan](../04-modules/02-client-management/implementation-plan.md) | مراجعین | ACTIVE-CANONICAL | HIGH | COMPLETE | تغییرِ مراجع |
| [03-therapy-sessions PRD](../04-modules/03-therapy-sessions/module-prd.md) / [Plan](../04-modules/03-therapy-sessions/implementation-plan.md) | چرخه‌ی جلسه | ACTIVE-CANONICAL | HIGH | HAS-INFERRED | تغییرِ lifecycle |
| [04-transcription PRD](../04-modules/04-transcription/module-prd.md) / [Plan](../04-modules/04-transcription/implementation-plan.md) | رونویسی | ACTIVE-CANONICAL | HIGH | HAS-INFERRED | تغییرِ STT |
| [05-notes-and-signs PRD](../04-modules/05-notes-and-signs/module-prd.md) / [Plan](../04-modules/05-notes-and-signs/implementation-plan.md) | علائم/یادداشت | ACTIVE-CANONICAL | HIGH | COMPLETE | تغییرِ یادداشت |
| [06-admin-panel PRD](../04-modules/06-admin-panel/module-prd.md) / [Plan](../04-modules/06-admin-panel/implementation-plan.md) | ادمین | ACTIVE-CANONICAL | HIGH | COMPLETE | تغییرِ ادمین |
| [07-ux-analytics PRD](../04-modules/07-ux-analytics/module-prd.md) / [Plan](../04-modules/07-ux-analytics/implementation-plan.md) | Clarity | ACTIVE-CANONICAL | HIGH | COMPLETE | تغییرِ analytics |
| [08-ai-case-file PRD](../04-modules/08-ai-case-file/module-prd.md) / [Plan](../04-modules/08-ai-case-file/implementation-plan.md) / [content-style-guide](../04-modules/08-ai-case-file/content-style-guide.md) | پروندهٔ درمان (AI) | ACTIVE-CANONICAL | HIGH | HAS-INFERRED | تغییرِ case-file |
| [09-treatment-unit PRD](../04-modules/09-treatment-unit/module-prd.md) / [Plan](../04-modules/09-treatment-unit/implementation-plan.md) | واحدِ درمان | ACTIVE-CANONICAL | HIGH | HAS-INFERRED | تغییرِ treatment-unit |
| [06-platform README](../06-platform/README.md) / [PRD](../06-platform/platform-prd.md) / [Plan](../06-platform/implementation-plan.md) | cross-cutting | ACTIVE-CANONICAL | HIGH | HAS-INFERRED | تغییرِ زیرساخت |
| [llm-provider-layer](../06-platform/llm-provider-layer.md) / [observability-audit](../06-platform/observability-audit.md) / [notifications](../06-platform/notifications.md) / [session-media-purge](../06-platform/session-media-purge.md) | سرویس‌هایِ مشترک | ACTIVE-CANONICAL | HIGH | HAS-INFERRED | تغییرِ همان سرویس |
| [07-subsystems README](../07-subsystems/README.md) | فهرستِ subsystemها | ACTIVE-CANONICAL | HIGH | COMPLETE | subsystemِ جدید |
| [01-browser-realtime-engine](../07-subsystems/01-browser-realtime-engine.md) | FeeliaRT | ACTIVE-CANONICAL | HIGH | COMPLETE | feelia-rt.js |
| [02-audio-durability-batch-fallback](../07-subsystems/02-audio-durability-batch-fallback.md) | صف صدا و batch | ACTIVE-CANONICAL | HIGH | COMPLETE | batch/IndexedDB |
| [03-transcript-integrity](../07-subsystems/03-transcript-integrity.md) | CAS و merge | ACTIVE-CANONICAL | HIGH | COMPLETE | هر نوشتنِ transcript |
| [04-legacy-ws-proxy-p1](../07-subsystems/04-legacy-ws-proxy-p1.md) | مسیرِ قدیمی | ACTIVE-CANONICAL (کدِ LEGACY) | MEDIUM | COMPLETE | ws/ |
| [05-session-audio-archive-speaker-resolve](../07-subsystems/05-session-audio-archive-speaker-resolve.md) | آرشیو و resolve | ACTIVE-CANONICAL | HIGH | HAS-INFERRED | آرشیو/ffmpeg |
| [06-audio-upload-pipeline](../07-subsystems/06-audio-upload-pipeline.md) | آپلودِ فایلِ صوتی | ACTIVE-CANONICAL | HIGH | COMPLETE | audio-upload |
| [07-final-transcript](../07-subsystems/07-final-transcript.md) | متنِ نهایی | ACTIVE-CANONICAL | HIGH | COMPLETE | final-transcript |
| [08-session-record](../07-subsystems/08-session-record.md) | رکوردِ canonicalِ جلسه (توکن، نوبتِ گوینده، نقش، تاریخچه) | ACTIVE-CANONICAL | HIGH | COMPLETE | session-record |
| [master-implementation-plan](../05-plans/master-implementation-plan.md) | ترتیبِ کارها | **PROPOSED** | MEDIUM | COMPLETE | تصمیمِ مالک/پیشرفت |
| [core-data-plan-2026-10-03](../05-plans/core-data-plan-2026-10-03.md) | پلنِ تکمیلِ Core پس از بازممیزی (رکوردِ realtime، نقشِ گوینده، سنجه‌ها، T59، سنجشِ دقت، A/B میکروفون) — به‌جز رضایت | **EXECUTED** (2026-10-04؛ قدمِ ۶/۷ منتظرِ داده) | MEDIUM | COMPLETE | اجرایِ هر قدم یا تصمیمِ مالک |
| [upload-quality-followup-2026-10-04](../05-plans/upload-quality-followup-2026-10-04.md) | پیگیریِ کیفیتِ آپلودهایِ پدرام: تأییدِ deployِ داور، پرچم‌هایِ گوینده (فانتوم/نامتعادل)، هزینه و precisionِ داورِ مرز | **PROPOSED** (2026-10-04) | MEDIUM | COMPLETE | اجرایِ هر قدم یا تصمیمِ مالک |
| [ui-ux-audit-2026-09-14](../05-plans/ui-ux-audit-2026-09-14.md) | بررسیِ کاملِ UI: باگ‌ها (با شاهدِ اجرا/کد و ستونِ production) + پیشنهادهای بهبود و نقشه‌ی اجرا | یافته‌ها: EVIDENCE (2026-09-14) · پیشنهادها: **PROPOSED** | MEDIUM | HAS-INFERRED | رفعِ هر UI-xx یا تصمیمِ مالک |
| [ux-audit-2026-09-14/UX_AUDIT_REPORT](../05-plans/ux-audit-2026-09-14/UX_AUDIT_REPORT.md) (+ [UX_FINDINGS](../05-plans/ux-audit-2026-09-14/UX_FINDINGS.md)، [USER_JOURNEYS](../05-plans/ux-audit-2026-09-14/USER_JOURNEYS.md)، [UX_OPEN_QUESTIONS](../05-plans/ux-audit-2026-09-14/UX_OPEN_QUESTIONS.md)، [UX_PRIORITY_ROADMAP](../05-plans/ux-audit-2026-09-14/UX_PRIORITY_ROADMAP.md)) | UX audit از دیدِ پژوهشِ تجربه‌ی کاربر: ۴۲ یافته UX-xx، مسیرهای کاربر، سناریوهای شکست، حریمِ خصوصی، دسترس‌پذیری، محتوای فارسی، سؤالاتِ باز، نقشه‌ی اولویت | یافته‌ها: EVIDENCE (2026-09-14) · راه‌حل‌ها و roadmap: **PROPOSED** · مدلِ ذهنی: ASSUMPTION | MEDIUM | HAS-INFERRED | رفعِ هر UX-xx، تحقیقِ کاربر، یا تصمیمِ مالک |

## ۵. اسنادِ قبلی و artifactها (Audit در 2026-09-13)

| مسیر | چیست؟ | Status | معتبر؟ | Duplicate؟ | تعارض با کد؟ | اقدام |
|---|---|---|---|---|---|---|
| [`CURRENT_UI_STATE.md`](../../CURRENT_UI_STATE.md) (root، untracked) | snapshotِ UI در یک تاریخ | EVIDENCE | — | — | — | مبنای کار نیست؛ commit با تصمیمِ مالک |
| [`docs/08-history/event-log-2026-09.md`](../08-history/event-log-2026-09.md) | آرشیوِ Event Logِ تا 2026-09-28 + زنجیره‌ی قدیمیِ سربرگِ STATUS (انتقال، نه حذف؛ فاز ۷) | EVIDENCE | — | — | — | فقط‌خواندنی؛ ورودیِ جدید در `PROJECT_STATUS.md` |
| [`docs/analytics-clarity.md`](../analytics-clarity.md) | مشخصاتِ Clarity (نسخه‌ی پیاده‌سازی‌شده) | **ACTIVE-CANONICAL** برای allowlist/mask/consent | بله — با `feelia-analytics.js` و `index.html` تطبیق داده شد | نه (ماژول 07 به آن لینک می‌دهد) | تعارضِ مهمی دیده نشد | در جا ماند (کد به این مسیر ارجاع می‌دهد)؛ سربرگِ وضعیت اضافه شد |
| [`docs/admin-panel.md`](../admin-panel.md) | سندِ طراحیِ v1.0 پنل ادمین (commit `37bbe34`) | **HISTORICAL** | جزئی | بله، با ماژول 06 | بله: (۱) «ادمین هیچ‌جا متنِ رونویسی نمی‌بیند» ↔ export شاملِ transcript است؛ (۲) پخشِ صدای جلسات برای ادمین در طراحی نیست؛ (۳) فهرستِ API ناقص (export، sessions، audio)؛ (۴) الگوی تأیید برای حذفِ مراجع ↔ UI بدونِ تأیید | محتوای مفید به [ماژول 06](../04-modules/06-admin-panel/module-prd.md) منتقل شد؛ بنرِ HISTORICAL اضافه شد؛ حذف نشد |
| `soniox.html` (root، untracked) | کپیِ markdownِ مستنداتِ Soniox (realtime) | ACTIVE-SUPPORTING (خارجی) | نامعلوم — تاریخ ندارد | — | — | در `index.html` به آن ارجاع شده؛ برای رفتارِ Soniox مستنداتِ آنلاین مقدم است؛ درباره‌ی commit شدنش (محتوای شخصِ ثالث) تصمیم با مالک |
| `feelia-design-system.html` (tracked) | سیستمِ طراحی (tokenهای رنگ/فونت) | ACTIVE-SUPPORTING | tokenهای `:root` با `index.html` یکسان به‌نظر می‌رسند (نمونه‌ای بررسی شد) | tokenها در `index.html` هم کپی شده‌اند | نه | بماند؛ مرجعِ طراحی |
| `session_assistant_v11 (3).html` (tracked) | نمونه‌ی اولیه‌ی تک‌فایلیِ «بدون سرور» (v8.0 در سربرگ) | **HISTORICAL / DEPRECATED** | نه | نسخه‌ی قدیمیِ اپ | بله (معماریِ بدونِ سرور) | بماند به‌عنوانِ سابقه؛ مبنای کار نیست |
| `diag-collect.sh` (tracked) | ابزارِ read-only تشخیصِ production | ACTIVE-SUPPORTING (ابزار) | ساختاراً بله | — | فرضِ `APP_DIR=$HOME/server-deploy` با pm2/`/root/feeliaa` در analytics-clarity تعارض دارد | در [deployment-operations](../01-architecture/deployment-operations.md) ثبت شد |
| `server-deploy/` (untracked) | کپیِ `server/` با `.env`، `dist`، `node_modules`؛ کد = commit `f9b0a9c` | **EVIDENCE / stale** | نه | کپیِ کد | بله (سه commitِ بعدی ندارد) | هرگز ویرایش نشود؛ commit نشود (LAW-002) |
| `feelia-f9b0a9c.tar` (untracked) | snapshotِ ۵۰ فایلِ repo در `f9b0a9c` | IRRELEVANT / EVIDENCE | — | — | — | commit نشود؛ حذف با تصمیمِ مالک (LAW-006) |
| `package-lock.json` (root، untracked) | lockfileِ خالیِ npm | IRRELEVANT | — | با `pnpm-lock.yaml` تداخلِ مفهومی | — | به‌احتمالِ زیاد تصادفی؛ تصمیم با مالک |
| `.claude/launch.json` (untracked) | کانفیگِ dev server برای Claude desktop | ACTIVE-SUPPORTING | بله | — | — | بماند |
| کامنت‌های کد | مستنداتِ درون‌خطی (فارسی) | ACTIVE-SUPPORTING | اغلب؛ چند مورد قدیمی | — | نمونه‌ها در [source-of-truth §2.4](source-of-truth.md) | با هر تغییرِ کد اصلاح شوند |
| [`verification/`](../../verification/README.md) | evidence تاریخ‌دار | EVIDENCE | در تاریخِ خودش | — | — | فایلِ جدید برای هر اجرا |

## ۶. تعارض‌های فعلی (پیداشده هنگامِ ساختِ مستندات)

| # | منبع A | منبع B | برنده | اقدام |
|---|---|---|---|---|
| C1 | متنِ رضایت و privacy note در `index.html`: «صدا هیچ‌جا ذخیره نمی‌شود» | IndexedDB + آرشیوِ ۳۰روزه + پخشِ ادمین | LAW-009 (متن باید حقیقت بگوید) — کد وضعیتِ موجود است | تصمیمِ مالک: P0-1 در master plan |
| C2 | `docs/admin-panel.md`: ادمین transcript نمی‌بیند | `buildTherapistExport` شاملِ `transcript` | کد (سند HISTORICAL شد) | ثبت در PRD ادمین |
| C3 | `analytics-clarity.md`: prod با pm2 در `/root/feeliaa` | `diag-collect.sh`: `$HOME/server-deploy` | هیچ‌کدام تأییدشده نیست | تأیید از سرور (P1-3) |
| C4 | هشدار/راهنمای ویرایشِ تاریخ: شمسی (`۱۴۰۳/۰۵/۱۲`) | پیش‌فرضِ `POST /api/sessions`: تاریخِ میلادی | کد | ✅ رفع در working tree (2026-09-14): مالک «شمسی» انتخاب کرد — migration 013 + `features/sessions/sessionDate.ts` |
| C5 | کامنت‌های سربرگِ `feelia-rt.js` و `batchqueue.ts` درباره‌ی حذفِ صدا | `archiveQueuedAudioOnly`، `archiveAudioForAdmin` | کد | اصلاحِ کامنت همراهِ P0-1 |
| C6 | ~~`SonioxDirect` با `enable_endpoint_detection:true` ↔ FeeliaRT/سرور با `false`~~ | — | — | **بسته‌شده 2026-09-14:** همه‌ی مسیرها اکنون `true` |
| C7 | harness انتظارِ batch fallback بدونِ IndexedDB | `feelia-rt.js` فعلی با صفِ IndexedDB | کد؛ harness قدیمی است | به‌روزرسانیِ harness (P1-2) |
| C8 | `.env` شاملِ `AUTH_PASSWORD` | هیچ استفاده‌ای در کد | کد | پاکسازی با تأییدِ مالک |

## ۷. کارهای باقی در مستندات

- review مالک روی laws و REQها (تبدیلِ DERIVED → APPROVED).
- تأییدِ توپولوژیِ production و تکمیلِ deployment-operations.
- افزودنِ تستِ backend و به‌روزکردنِ ستونِ Test در traceability.
- تصمیم درباره‌ی انتقالِ `docs/admin-panel.md` به پوشه‌ی archive (فعلاً در جا با بنر).
