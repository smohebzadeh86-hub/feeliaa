# CLAUDE.md — نقطه‌ی ورودِ اجباریِ هر AI Agent

> این فایل Router است، نه مرجعِ جزئیات. هر fact جزئی مالکِ canonical خودش را در `docs/` دارد.
> آخرین بازسازیِ ساختار مستندات: 2026-09-13 (از روی working tree شاخه‌ی `feat/clarity`).

## ۱. پروژه چیست؟ (یک پاراگراف)

**فیلیا (Feelia)** یک وب‌اپ فارسی برای تراپیست‌هاست: مدیریتِ مراجعین، ثبتِ جلسه‌ی درمانی با **رضایتِ مراجع**،
رونویسیِ زنده‌ی فارسی با Soniox (مستقیم از مرورگر با کلیدِ موقت)، ثبتِ علائم/یادداشت/یادداشتِ صوتی،
و پنلِ ادمین. Backend: Node.js + Fastify 5 + PostgreSQL (TypeScript، `server/`). Frontend: یک SPA تک‌فایلی
بدونِ build (`public/index.html` + `public/feelia-rt.js` + `public/feelia-analytics.js`).
**داده‌ها بالینی و فوق‌حساس‌اند.**

## ۲. ترتیبِ اجباریِ خواندن

```
CLAUDE.md (همین فایل)
  → PROJECT_MASTER_REFERENCE.md                (تصویر کل + وضعیت واقعی)
  → PROJECT_STATUS.md                           (وضعیتِ زنده + آخرین رویدادها — Event Log)
  → docs/00-governance/project-laws.md          (قوانین — بالاترین اعتبار)
  → docs/00-governance/source-of-truth.md       (حلِ تعارض)
  → docs/00-governance/ai-agent-reading-guide.md (workflow هر task)
  → معماریِ مرتبط (docs/01-architecture/)
  → subsystem مرتبط (docs/07-subsystems/)
  → module PRD مرتبط (docs/04-modules/NN-*/module-prd.md)
  → implementation plan همان module
  → کدِ واقعی → تغییر → تست → verification → به‌روزرسانیِ مستندات
```

فقط context مرتبط را بخوان؛ جدولِ بخش ۴ مشخص می‌کند کدام.

## ۳. قبل از هر تغییرِ کد — حداقلِ لازم

1. `docs/00-governance/project-laws.md` (کامل؛ کوتاه است).
2. بخشِ «Current Project Status» و «Important Risks» در `PROJECT_MASTER_REFERENCE.md`.
3. سندِ مالکِ ناحیه‌ای که لمس می‌کنی (جدول زیر).
4. خودِ کد. **مستندات ممکن است عقب باشند؛ کد + schema در working tree وضعیتِ فعلی است** (جزئیات در source-of-truth).

## ۴. برای هر نوع task چه بخوانم؟

| نوع task | اسنادِ لازم |
|---|---|
| هر چیزی درباره‌ی رونویسیِ زنده، reconnect، pause/resume | `docs/07-subsystems/01-browser-realtime-engine.md`، `03-transcript-integrity.md`، `docs/04-modules/04-transcription/` |
| آپلودِ فایلِ صوتیِ جلسه، jobِ پس‌زمینه، اعلان‌ها | `docs/07-subsystems/06-audio-upload-pipeline.md` |
| صدا، صف آفلاین، batch fallback، یادداشتِ صوتیِ ناموفق | `docs/07-subsystems/02-audio-durability-batch-fallback.md`، `05-session-audio-archive-speaker-resolve.md` |
| `/ws/t`، `/ws/voice`، `SonioxDirect` | `docs/07-subsystems/04-legacy-ws-proxy-p1.md` (مسیرِ LEGACY — قانون LAW-015) |
| مراجعین | `docs/04-modules/02-client-management/` |
| جلسه (شروع/پایان/لغو/ادامه/ویرایش) | `docs/04-modules/03-therapy-sessions/` |
| علائم/یادداشت‌ها | `docs/04-modules/05-notes-and-signs/` |
| ثبت‌نام/ورود/نشست/ادمین‌سازی | `docs/04-modules/01-therapist-accounts/`، `docs/06-platform/` |
| پنل ادمین / export / پخشِ صدا | `docs/04-modules/06-admin-panel/` |
| Microsoft Clarity | `docs/04-modules/07-ux-analytics/` + `docs/analytics-clarity.md` (مالکِ allowlist و mask) |
| migration / جدول / ستون | `docs/01-architecture/data-architecture.md`، `docs/02-reference/database-catalog.md`، LAW-007 |
| env / ثابت‌ها / localStorage | `docs/02-reference/configuration-catalog.md` |
| endpoint جدید یا تغییرِ API | `docs/02-reference/api-catalog.md`، `error-code-catalog.md` |
| deploy / سرور / لاگ | `docs/01-architecture/deployment-operations.md` (بخش‌های UNVERIFIED را جدی بگیر) |

## ۵. اسنادِ canonical و غیرِ canonical

- **Canonical:** همه‌ی فایل‌های `docs/00-*` تا `docs/07-*`، `PROJECT_MASTER_REFERENCE.md`، `PROJECT_STATUS.md` (مالکِ Event Log)، این فایل، و `docs/analytics-clarity.md`.
- **Evidence (مشاهده در یک زمان، نه حقیقتِ فعلی):** `verification/`.
- **HISTORICAL / DEPRECATED — در مسیرِ عادیِ خواندن نیستند:** `docs/admin-panel.md` (با واقعیت تعارض دارد)،
  `session_assistant_v11 (3).html` (نمونه‌ی اولیه‌ی بدون سرور)، `server-deploy/` (کپیِ قدیمیِ کد)، `feelia-f9b0a9c.tar`.
- **Supporting reference خارجی:** `soniox.html` (کپیِ محلیِ مستنداتِ Soniox — ممکن است قدیمی باشد)، `feelia-design-system.html`.

فهرستِ کامل با وضعیت: `docs/00-governance/documentation-map.md`.

## ۶. بدونِ مجوزِ صریحِ کاربر در همین گفتگو ممنوع است

- هر عملیاتِ destructive: `DELETE`/`DROP`/`TRUNCATE` روی DB، حذفِ `server/data/`، ویرایشِ migration اعمال‌شده،
  `git reset --hard` / `push --force` / حذفِ branch، deploy یا ری‌استارتِ production.
- commit/push (فقط وقتی کاربر بخواهد).
- ساختِ حساب، واردکردنِ رمز، یا تست با داده‌ی واقعیِ مراجع.
- چاپ/لاگ/commitِ هر secret (`.env`، `SONIOX_API_KEY`، کوکی) یا هر متنِ بالینی.
- refactor یا تغییرِ نامرتبط با task؛ افزودنِ dependency یا اسکریپتِ خارجیِ جدید به فرانت.
- تغییرِ رفتارِ ذخیره‌ی صدا بدونِ به‌روزکردنِ متنِ رضایت (LAW-009).

## ۷. بعد از تغییر — چه اسنادی را به‌روز کنم؟

| تغییر | سندِ مالک که باید به‌روز شود |
|---|---|
| **هر رویداد** (کد، migration، config، مستندات، تست، تصمیمِ مالک، git، deploy، باگ، کشفِ تعارض/ریسک، تغییرِ نشستِ دیگر) | **`PROJECT_STATUS.md` — اجباری و بدونِ استثنا** (LAW-024): ورودیِ جدید بالای Event Log + به‌روزرسانیِ وضعیت‌ها |
| endpoint / payload / status code | `docs/02-reference/api-catalog.md`، `error-code-catalog.md` |
| migration | `docs/02-reference/database-catalog.md`، `data-architecture.md` |
| env var یا ثابتِ timeout/retention | `docs/02-reference/configuration-catalog.md` |
| رفتارِ محصول | PRD ماژول + `docs/03-requirements/requirement-catalog.md` + `traceability-matrix.md` |
| lifecycle/state machine/صدا | subsystem مربوط |
| فایل/پوشه‌ی جدید | `docs/02-reference/repository-map.md`، `module-map.md` |
| رویداد/صفحه‌ی Clarity | `docs/analytics-clarity.md` + `public/feelia-analytics.js` |
| وضعیتِ کلی / ریسکِ جدید | `PROJECT_MASTER_REFERENCE.md` بخش‌های 20–22 |
| اجرای تست/بررسی | یک فایلِ تاریخ‌دار در `verification/` |

## ۸. دستورات (تأییدشده روی ماشینِ dev در 2026-09-13)

```bash
pnpm dev
```
```bash
pnpm test:rt
```
```bash
pnpm test:cf
```
```bash
pnpm test:up
```
```bash
cd server && npx tsc --noEmit
```

- `pnpm dev` = `pnpm --filter server dev` (tsx watch، cwd = `server/`، `.env` از `server/.env`، پورت پیش‌فرض 3000).
- `pnpm test:rt` = harness موتورِ realtime (`scripts/rt-harness.cjs`) — بدونِ شبکه/DB. وضعیتِ فعلی: بخش 20 Master Reference.
- `pnpm test:cf` = harness پرونده‌ی درمان (`scripts/case-file-harness.ts`، اجرا با tsx) — بدونِ شبکه/DB/LLMِ واقعی؛ دادهٔ ساختگی.
- `pnpm test:up` = harness pipelineِ آپلودِ فایلِ صوتی (`scripts/upload-harness.ts`، 2026-09-23) — ماشینِ حالتِ job با portهایِ جعلی (بدونِ DB/Soniox) + ffmpegِ واقعی رویِ فایل‌هایِ ساختگی.
- تستِ خودکارِ backend با DB یا CI وجود ندارد.

## ۹. رفتارِ Agent

پاسخ به کاربر به فارسی. اول audit → بعد plan → تغییرِ حداقلی → تستِ واقعی → **ثبت در `PROJECT_STATUS.md`** → گزارشِ صادقانه (شاملِ شکست‌های از قبل موجود).
اگر هنگامِ کار دیدی نشستِ دیگری کد/سند را عوض کرده، آن را برنگردان؛ با نوعِ `FINDING` ثبت و مستندات را هم‌گام کن.
هیچ ادعایی بدونِ ارجاع به فایل/خطِ واقعی نکن. جزئیات: `docs/00-governance/ai-agent-reading-guide.md`.
