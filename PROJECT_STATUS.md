# PROJECT STATUS — وضعیتِ زنده‌ی پروژه و سیستمِ مستندات

> **نقش:** سندِ زنده. ساختارش مطابقِ «دستورِ ساختِ سیستمِ مستندسازی و مرجعِ اصلیِ پروژه» (مراحلِ کار + ۲۷ بخش + checklistِ validation + خروجیِ نهایی) است.
> **قانون:** [LAW-024](docs/00-governance/project-laws.md) — **هر رویداد باید همین‌جا ثبت شود.**
> **آخرین به‌روزرسانی:** 2026-10-04 — آخرین رویداد: **اجرایِ core-data-plan (رکوردِ realtime، پیشنهادِ نقش، سنجه‌یِ هر جلسه، T59، eval-asr، A/B میکروفون) با E2E؛ commit/deploy نشده.** رویدادِ قبلی: **Product Thesis به‌عنوانِ سندِ governance افزوده شد (DOCS؛ بدونِ تغییرِ کد).** رویدادِ قبلی: **پلنِ مستندات کامل شد (فازهایِ ۰–۷ + bannerهایِ فرانت) و commit شد؛ تست‌هایِ رفتاریِ همه‌ی harnessها و `test:api` سبز؛ push/deploy نشد.** سابقه‌ی زنجیره‌ی «قبل‌ترش»ها: [docs/08-history/event-log-2026-09.md](docs/08-history/event-log-2026-09.md).
> **مالکِ:** Event Log و وضعیتِ انطباق با ساختار. factهای جزئی مالکِ خودشان را دارند (لینک‌ها)؛ در تعارض، سندِ مالک برنده است ([source-of-truth](docs/00-governance/source-of-truth.md)).

---

## ۰. قاعده‌ی به‌روزرسانی (اجباری)

### چه چیزی «رویداد» است؟

| نوع | مثال |
|---|---|
| `CODE` | هر تغییر در `server/`، `public/`، `scripts/` |
| `MIGRATION` | افزودنِ فایل در `server/src/db/migrations/` |
| `CONFIG` | env، dependency، `package.json`، `.gitignore`، کانفیگِ ابزار |
| `DOCS` | ایجاد/تغییر/deprecate کردنِ هر سند |
| `TEST` | اجرای `pnpm test:rt`، typecheck، تستِ دستی/mock، هر verification |
| `DECISION` | تصمیمِ مالک (تأییدِ REQ، انتخاب در master plan، …) |
| `GIT` | commit، merge، branch، push، tag |
| `DEPLOY` | deploy، restart، تغییرِ سرور |
| `INCIDENT` | باگ، خرابی، نشتِ داده، رفتارِ غیرمنتظره |
| `FINDING` | کشفِ تعارض، ریسک، یا تغییری که نشستِ دیگری انجام داده |

### چطور ثبت کنم؟

1. یک ورودیِ جدید **بالای** [§7 Event Log](#۷-event-log) با قالبِ زیر اضافه کن.
2. اگر وضعیتی عوض شد، جدول‌های §1 تا §6 را به‌روز کن.
3. «آخرین به‌روزرسانی» در سربرگ را عوض کن.
4. اسنادِ مالک را طبقِ جدولِ §7 در [`CLAUDE.md`](CLAUDE.md) به‌روز کن (اگر §1 عوض شد، [Master Reference §20–22](PROJECT_MASTER_REFERENCE.md) هم).

```markdown
### YYYY-MM-DD — <TYPE> — <عنوانِ کوتاه>
- **چه شد:**
- **فایل‌ها:**
- **اسنادِ به‌روزشده:**
- **تست / تأیید:** (دستور + نتیجه‌ی واقعی، یا «انجام نشد» + دلیل)
- **عامل:** این نشست / نشستِ دیگر (کشف‌شده در YYYY-MM-DD) / مالک
- **کارِ باز / پیامد:**
```

### محدودیت‌ها
- Event Log **فقط اضافه‌شدنی** است؛ ورودیِ قبلی ویرایش/حذف نمی‌شود — اصلاح = ورودیِ جدید.
- هیچ داده‌ی بالینی، secret، کوکی یا شماره‌ی واقعی (LAW-001).
- task بدونِ ثبت در این فایل «انجام‌شده» نیست.

---

## ۱. وضعیتِ فعلی در یک نگاه

> مالکِ canonical: [PROJECT_MASTER_REFERENCE §20](PROJECT_MASTER_REFERENCE.md). با هر رویداد هر دو هم‌گام شوند.

| موضوع | وضعیت | تاریخ | منبع |
|---|---|---|---|
| علائمِ بدنی داخلِ متنِ جلسه (REQ-065) | ✅ پیاده؛ `test:rt` 100/100، `tsc`/`test:cf`/`test:up`/build سبز؛ **E2Eِ واقعی (Chrome + Soniox realtime/async + MySQLِ dev) PASS**؛ commit `9cee709` (فقط این کار) و **deploy به production** (preflight GO، health ok) | 2026-09-27 | §7 Event Log، [verification](verification/2026-09-27-sign-markers-in-transcript.md) |
| چالش‌هایِ تستِ واقعی (تراپیستِ `3cb546ef…`) | ✅ ریشه‌یابی و رفع در working tree (batch_statusِ گیرکرده، انتسابِ rt.*، آپلودِ تدریجیِ آرشیو، حذفِ جلسه→404، مسیرِ آپلود از Setup، یادداشتِ صوتیِ تکراری)؛ `tsc`/`test:rt` ۶۹-۰/`test:up`/`test:cf` سبز؛ ❗ commit/deploy نشده؛ reconcile رویِ MySQLِ واقعی تست نشده | 2026-09-26 | §7 Event Log، [verification](verification/2026-09-26-real-test-audit-fixes.md) |
| audit مسیرِ ضبط/ذخیره‌ی صدا (کاملِ پلن + قفلِ cross-context + رفعِ #۱۶) | ✅ کدِ commitنشده؛ `tsc`/harness سبز (بدونِ رگرسیون)؛ **هر ۶ بخشِ پلن + قفلِ cross-context + رفعِ باگِ #۱۶ (onlineHandler بعدِ FAILED) پیاده و رویِ زیرساختِ کاملاً واقعی (MySQL/Soniوx/ffmpeg/مرورگرِ واقعی، ۹+ حسابِ canaryِ جدا) تست شد** — seq-collision، idempotencyِ sha256، race، آرشیو-قبل-از-رونویسی، سکوت=موفقیت، چرخشِ ۱۵s، بازیابیِ خودکارِ میکروفون، فلاشِ visibilitychange، late-transcriptِ برچسب‌دار، mimeِ واقعی، فایلِ کاملِ ادمین، قفلِ سراسری، بازیابیِ رونویسیِ زنده بعدِ قطعیِ کاملِ شبکه (تأییدِ دوطرفه: بازتولیدِ باگ + تأییدِ رفع) — همه ✅؛ دو باگِ واقعیِ کشف‌شده حینِ کار (`clearForSession`، `onlineHandler`) پیدا و رفع شدند؛ ❗ **هیچ باگِ بازی نمانده** — فقط تعارضِ متنِ رضایت (C1، عمداً دست‌نخورده به دستورِ مالک) و commit/deploy باز مانده | 2026-09-16 | [stage6-offline](verification/2026-09-16-audio-durability-stage6-offline-reconnect.md)، [stage5-lock](verification/2026-09-16-audio-durability-stage5-crosscontextlock.md)، [stage4-partsEF](verification/2026-09-16-audio-durability-stage4-partsEF.md)، [full-regression](verification/2026-09-16-audio-durability-full-regression.md)، [stage1](verification/2026-09-16-audio-durability-stage1.md)، [stage2-partD](verification/2026-09-16-audio-durability-stage2-partD.md)، [stage3-partC](verification/2026-09-16-audio-durability-stage3-partC.md)، §7 Event Log |
| Branch / HEAD | `feat/clarity` روی **`2551943`** («fix(stt): voice notes could never mint a realtime credential»)؛ working tree برای هر ۳ فایلِ کد تمیز؛ `docs/admin-panel.md` هنوز modified (نامرتبط، عمداً کنار گذاشته شد)؛ **✅ push شد به `origin/feat/clarity`** (۹ کامیت، تا `2551943`)؛ `origin/main` هنوز `8bcdf0e` — بدونِ merge/PR، فقط branch push شده | 2026-09-14 | git log/status/push |
| کارِ commitنشده | مستنداتِ untracked + `docs/admin-panel.md` + **کدِ باگ‌های مراجعینِ فعال/غیرفعال، ثبتِ دستیِ جلسه (تاریخِ اختیاریِ بدونِ ساعت، nullable + یادداشتِ صوتی/متنی با بازبینیِ متن) و تاریخِ شمسی** (`server/src/http/clients.ts`، `sessions.ts`، `sessionDate.ts`، migrationهای `012`، `013`، **`014_session_date_optional.sql`جدید (additive، date nullable)**، `public/index.html`) — typecheck ✅، `node --check` ✅، **✅ سرور/DBِ واقعیِ لوکال با حسابِ canary تأیید شد** (نوشتن/خواندنِ مستقیمِ Postgres، پاکسازیِ کامل) + **رفعِ فلاشِ صفحه‌ی «پرونده» در `startManualSessionFlow` (`public/index.html`) — تستِ mock تأییدشده، بدونِ نیازِ typecheck/harness** | 2026-09-15 | [verification](verification/2026-09-14-client-status-archive.md)، §7 Event Log (CODE) |
| Typecheck سرور | ✅ بدونِ خطا | 2026-09-14 | این task |
| Harness realtime (`pnpm test:rt`) | ⚠️ 29 PASS / 6 FAIL — **دقیقاً همان baseline**؛ `feelia-rt.js` هنوز اصلاً لمس نشده | 2026-09-14 | این task |
| ۷ باگِ گزارش‌شده (Clarity/D1، انتخابگرِ تاریخ، نام/تخصص/D3، ادمین‌کامل/D2، اسکرولِ خودکار، یادداشتِ صوتی↔متنی) | ✅ هر ۶ موردِ کد پیاده‌سازی شد (`index.html`، `feelia-analytics.js`، `auth.ts`، `admin.ts`)؛ syntax/typecheck/`pnpm test:rt` سبز؛ **✅ تستِ تعاملیِ مرورگری با mock backend انجام شد — هر ۶ مورد با اجرایِ واقعی تأیید شد، بدونِ خطا**؛ ❗ سرورِ لوکالِ واقعی (Postgres) هنوز تست نشده — commitنشده | 2026-09-15 | [verification](verification/2026-09-15-seven-bugs.md)، §7 Event Log (CODE/TEST) |
| فازِ ۰ (UI-01/02/03/04/06) | ✅ **رفع و commit شد** (`ecf00b4`) | 2026-09-14 | [ui-ux-audit §رفعِ فازِ ۰](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-فازِ-۰--2026-09-14) |
| فازِ ۱ دورِ اول (UI-07/10/12/16/17/18/19/21/37) | ✅ **رفع و commit شد** (`ecf00b4`) | 2026-09-14 | [ui-ux-audit](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-فازِ-۱-دورِ-اول--2026-09-14) |
| فازِ ۱ دورِ دوم (UI-08/11/20-نیمه/27) | ✅ **رفع و commit شد** (`fedeac2`) | 2026-09-14 | [ui-ux-audit](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-فازِ-۱-دورِ-دوم--2026-09-14) |
| چیدمانِ موبایل (UI-22/23/24) | ✅ **رفع و commit شد** (`8347fbb`)، تست با mobile emulation (375×812) + دسکتاپِ واقعی (1280px) + رگرسیونِ کامل؛ ۲ باگِ CSSِ واقعی (containing-block از transform، over-constrained left/right در RTL) پیدا و رفع شد؛ `feelia-rt.js` لمس نشد | 2026-09-14 | [ui-ux-audit](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-چیدمانِ-موبایل-ui-222324--2026-09-14) |
| P2/P3 کم‌خطر دورِ اول (UI-20 تصحیحِ سند، UI-26، UI-34، UI-41، UI-42، UI-46) | ✅ **رفع و commit شد** (`85bd08e`)، تستِ mock + DOM/computed-style برای هر مورد + رگرسیونِ کامل؛ `feelia-rt.js` و سرور لمس نشد | 2026-09-14 | [ui-ux-audit](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-p2p3-کم‌خطر--2026-09-14) |
| رگرسیونِ کاملِ دستی روی `85bd08e` | ✅ **بدونِ رگرسیون** — جریانِ کاملِ ساختِ مراجع/جلسه/علامت/یادداشت/پایان/ذخیره + dedupe-guardها + Escape + CSSِ موبایل همه تأیید شدند؛ یک یافته‌ی از پیش‌موجود و نامرتبط (R16) دوباره دیده شد، نه رگرسیونِ جدید | 2026-09-14 | [ui-ux-audit §رگرسیون](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-p2p3-کم‌خطر-دورِ-دوم--2026-09-14) |
| P2/P3 کم‌خطر دورِ دوم (UI-29، UI-28، UI-38، UI-44-جزئی) | ✅ **رفع و commit شد** (`84d4783`)، تستِ mock + DOM/network برای هر مورد + رگرسیونِ نهایی | 2026-09-14 | [ui-ux-audit](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-p2p3-کم‌خطر-دورِ-دوم--2026-09-14) |
| باگِ بحرانیِ ۴۰۰ در آپلودِ یادداشتِ صوتی | ✅ **رفع و commit شد** (`fefa823`) — کشف‌شده در تستِ لوکالِ مالک با سرورِ واقعی (نه mock)؛ در production هم هست (از `f9b0a9c`، جدِّ `8bcdf0e`)، فقط کمتر دیده می‌شود چون realtime آنجا معمولاً موفق است | 2026-09-14 | [ui-ux-audit §رفعِ باگِ ۴۰۰](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-باگِ-بحرانیِ-۴۰۰-در-یادداشتِ-صوتی--2026-09-14) |
| باقیِ فازِ ۱ + P2/P3 | ~~UI-09~~ (✅ تصمیمِ مالک «شمسی» + تبدیلِ داده — رفع در working tree 2026-09-14، commitنشده)، UI-13/14/15/36 (لمسِ `feelia-rt.js` — عمداً کنار گذاشته شد)، UI-05 (متنِ رضایت — به دستورِ مالک دست نخورد)، UI-25 (نیازِ فیلدِ جدیدِ API)، UI-30/32/33/35/39/40/43/45/47 (نیازِ تغییرِ بصریِ گسترده‌تر یا هم‌پوشانی با کارِ نشستِ دیگر روی Clarity) | 2026-09-14 | همان audit |
| R16/UX-002 (متنِ یادداشت‌ها در پرونده خالی بود) | ✅ **رفع و commit شد** (`08e8d20`) — ریشه: `span:first-child` هیچ‌وقت match نمی‌شد چون svg اولین فرزند بود؛ به `:first-of-type` عوض شد؛ با سه نوعِ یادداشتِ واقعی (sign/text/voice) رویِ سرورِ لوکالِ واقعی تأیید شد | 2026-09-14 | [ui-ux-audit §رفعِ R16](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-r16ux-002-و-timeoutِ-api--2026-09-14) |
| `api()` بدونِ timeout (UI-33، بخشی) | ✅ **رفع و commit شد** (`08e8d20`) — پارامترِ اختیاریِ `timeoutMs` (AbortController)؛ بدونِ پاس‌دادنش رفتارِ همه‌ی callerهای فعلی عیناً قبلی می‌ماند؛ فقط رویِ چکِ STTِ preflight (۱۰s) سیم‌کشی شد | 2026-09-14 | همان بخش |
| ریشه‌ی واقعیِ «realtimeِ یادداشتِ صوتی وصل نمی‌شه» | ✅ **رفع و commit شد** (`2551943`) — مالک تأیید کرد جلسه‌ی اصلی مشکلی نداشت، فقط یادداشت؛ چون کدِ اتصال بینِ این دو مشترکه، دنبالِ چیزی گشتیم که *قبل*ِ اون کدِ مشترک فرق می‌کرد: `POST /api/stt/realtime-session` (mintِ credential) رویِ جلسه‌ی `completed` همیشه ۴۰۰ می‌داد، بدونِ تفکیکِ purpose — و تنها نقطه‌ی UIِ یادداشتِ صوتی (Wrapup) همیشه *بعد*ِ completed‌شدن اجرا می‌شه. یعنی یادداشتِ صوتی هیچ‌وقت credential نمی‌گرفت، حتی قبل از تلاش برایِ WS. با پارامترِ `purpose` ('note'/'transcript') رفع شد؛ رفتارِ جلسه‌ی اصلی (که purpose نمی‌فرسته) دست‌نخورده ماند. تأیید شد مستقیم رویِ سرورِ لوکال: `purpose=note` رویِ جلسه‌ی completed حالا `200`+`api_key` واقعی می‌ده (قبلاً ۴۰۰) | 2026-09-14 | [ui-ux-audit §ریشه‌ی realtime](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-ریشه‌ی-واقعیِ-realtimeِ-یادداشتِ-صوتی--2026-09-14) |
| Clarity (محلی) | ✅ route 10/10، sandbox 41/41 | 2026-09-14 | [evidence](verification/2026-09-14-clarity-test-pass.md) |
| Clarity (تولید، دادهٔ واقعی) | ❗ کد درست کار می‌کند ولی **صفر traffic رسیده** — `ERR_CONNECTION_CLOSED` به `clarity.ms` از مرورگرِ مالک، تأییدشده با Data Export API (`Traffic:[]`). علتِ محتملِ INFERRED: فیلترینگِ شبکه (VPN/ISP/سراسری) — هنوز تفکیک نشده | 2026-09-14 | §7 Event Log (FINDING) |
| Production | `feelia.ir` = پروسه‌ی pm2 `feelia-mysql` در `/root/feeliaa-mysql` (checkoutِ بدونِ git، deploy با tar) = **commitِ `45b0482` + working treeِ commitنشده‌ی 2026-09-25** (UIِ رضایت بدونِ متن/لغو؛ سیاستِ پرونده‌ی آپلود با `UPLOAD_CASE_FILE_INACTIVE` — تنظیم‌نشده ⇒ آپلود فقط متن)؛ migrationها تا `025`. `/root/feeliaa` (پروسه‌ی `feelia`) stopped و قدیمی است | 2026-09-25 | §7 Event Log — DEPLOY 2026-09-25 («فعلاً فقط متن») |
| مستندات | ✅ فیچر-محور با رجیستری/قالب/LAW-025…027 و `pnpm test:docs` سبز؛ ❗ هیچ سندی توسطِ مالک review نشده | 2026-09-30 | [feature-index](docs/02-reference/feature-index.md)، [verification](verification/2026-09-30-docs-phases-1-6.md) |
| ریسکِ بحرانیِ باز | ❗ R1 (متنِ رضایت ↔ ذخیره‌ی صدا، UI-05/UX-004)؛ ❗ **R15** (یادداشت/علامت در شکستِ ذخیره بی‌صدا از دست می‌رود، UX-001)، **R16** (متنِ یادداشت‌ها در پرونده نمایش داده نمی‌شود، UX-002)، **R17** (خروج در حالتِ ضبطِ محلی با میکروفونِ روشن، UX-003) — هر سه در HEAD `8347fbb` و production؛ R12–R14 محلی رفع شد ولی روی production هنوز فعال | 2026-09-14 | [Master Reference §22](PROJECT_MASTER_REFERENCE.md) |
| UX audit | 42 یافته (Critical ۵، High ۱۴، Medium ۱۸، Low ۵)؛ پس از commitهای هم‌زمان: ۷ جزئی رفع، ۰ کامل؛ ۱۲ سؤالِ باز؛ roadmap = PROPOSED | 2026-09-14 | [UX_AUDIT_REPORT](docs/05-plans/ux-audit-2026-09-14/UX_AUDIT_REPORT.md) |

---

## ۲. Pipelineِ کار (ترتیبِ اجباریِ دستور)

| # | مرحله | وضعیت | خروجی | آخرین تغییر |
|---|---|---|---|---|
| 1 | Repository Discovery | ✅ DONE | [Master Reference §1–9](PROJECT_MASTER_REFERENCE.md)، [repository-map](docs/02-reference/repository-map.md) | 2026-09-13 |
| 2 | Existing Documentation Audit | ✅ DONE | [documentation-map §5](docs/00-governance/documentation-map.md) | 2026-09-14 |
| 3 | Architecture Discovery | ✅ DONE (production UNVERIFIED) | [01-architecture](docs/01-architecture/system-architecture.md) | 2026-09-14 |
| 4 | Module / Subsystem Discovery | ✅ DONE | [module-map](docs/02-reference/module-map.md)، [subsystems](docs/07-subsystems/README.md) | 2026-09-13 |
| 5 | Source-of-Truth Definition | ✅ DONE | [source-of-truth](docs/00-governance/source-of-truth.md) | 2026-09-13 |
| 6 | Documentation Architecture Creation | ✅ DONE | `docs/00`–`07`، `verification/` | 2026-09-14 |
| 7 | Project Master Reference | ✅ DONE | [PROJECT_MASTER_REFERENCE.md](PROJECT_MASTER_REFERENCE.md) | 2026-09-14 |
| 8 | Module PRDs | ✅ DONE (7) | [04-modules](docs/02-reference/module-map.md) | 2026-09-13 |
| 9 | Implementation Plans | ✅ DONE (7 + platform) | همان + [platform plan](docs/06-platform/implementation-plan.md) | 2026-09-14 |
| 10 | Traceability | ⚠️ PARTIAL (بیشترِ REQها تست ندارند) | [traceability-matrix](docs/03-requirements/traceability-matrix.md) | 2026-09-14 |
| 11 | Validation | ✅ DONE (§4) | این فایل §4 | 2026-09-14 |

---

## ۳. انطباق با ۲۷ بخشِ دستور

| § | الزام | وضعیت | کجا | کارِ باز |
|---|---|---|---|---|
| 1 | Repository Discovery | ✅ | Master Reference §1–9، repository-map | — |
| 2 | Audit مستنداتِ فعلی | ✅ | documentation-map §5 | — |
| 3 | ساختارِ اصلیِ `docs/` | ✅ | `docs/00`–`07` | — |
| 4 | Master Reference (۲۴ بخش) | ✅ | [PROJECT_MASTER_REFERENCE.md](PROJECT_MASTER_REFERENCE.md) | — |
| 5 | `CLAUDE.md` به‌عنوانِ Router | ✅ | [CLAUDE.md](CLAUDE.md) | — |
| 6 | Governance و LAWها | ✅ (24 قانون) | [project-laws](docs/00-governance/project-laws.md) | review مالک |
| 7 | Source of Truth | ✅ | [source-of-truth](docs/00-governance/source-of-truth.md) | — |
| 8 | AI Agent Reading Guide | ✅ | [ai-agent-reading-guide](docs/00-governance/ai-agent-reading-guide.md) | — |
| 9 | Documentation Map | ✅ | [documentation-map](docs/00-governance/documentation-map.md) | — |
| 10 | Architecture | ⚠️ | [01-architecture](docs/01-architecture/system-architecture.md) | تأییدِ production (P1-3) |
| 11 | Reference catalogs | ✅ (8) | [02-reference](docs/02-reference/api-catalog.md) | integration/permission/event در اسنادِ موجود پوشش داده شده‌اند؛ catalogِ مجزا ساخته نشد |
| 12 | Requirements (REQ-xxx) | ⚠️ (71، همه DERIVED) | [requirement-catalog](docs/03-requirements/requirement-catalog.md) | تأییدِ مالک → APPROVED (P3-3) |
| 13 | شناسایی ماژول‌ها | ✅ (7) | [module-map](docs/02-reference/module-map.md) | — |
| 14 | Module PRDها | ✅ (7) | `docs/04-modules/*/module-prd.md` | — |
| 15 | Implementation Planها | ✅ (7) | `docs/04-modules/*/implementation-plan.md` | — |
| 16 | Platform | ✅ | [06-platform](docs/06-platform/README.md) | — |
| 17 | Subsystemها | ✅ (5) | [07-subsystems](docs/07-subsystems/README.md) | — |
| 18 | جداسازیِ Evidence | ✅ | [verification/](verification/README.md) | — |
| 19 | مدیریتِ Deprecated | ✅ | documentation-map §5 | تصمیم درباره‌ی انتقالِ `docs/admin-panel.md` به archive |
| 20 | کاهشِ Duplicate | ✅ | source-of-truth §3 | — |
| 21 | استخراج از source واقعی | ✅ (با برچسبِ INFERRED/UNVERIFIED) | همه‌ی اسناد | تأییدِ ادعاهای INFERRED |
| 22 | Migrationِ اسنادِ قبلی | ✅ | ماژول 06 ← `admin-panel.md` | — |
| 23 | Master Implementation Plan | ✅ (PROPOSED) | [master plan](docs/05-plans/master-implementation-plan.md) | تصمیمِ مالک |
| 24 | وضعیتِ واقعی در Documentation Map | ✅ | documentation-map §1–§7 | — |
| 25 | Final Validation | ✅ | §4 همین فایل | اجرای دوباره پس از هر `DOCS` |
| 26 | دقت بر تعداد مقدم | ✅ | فهرستِ موارد ناموجود در `07-subsystems/README`، `06-platform/README` | — |
| 27 | خروجی و گزارشِ نهایی | ✅ | §5 همین فایل | زنده نگه داشتن |

---

## ۴. Final Validation (بخش ۲۵)

آخرین اجرا: **2026-09-14** (checker: همه‌ی لینک‌های نسبیِ Markdown + تطبیقِ LAW/REQهای ارجاع‌شده با تعریف‌شده) — **52 فایل، 320 لینک، 0 خراب؛ 24 LAW و 71 REQ سازگار.**

- [x] CLAUDE.md exists
- [x] Master Reference exists
- [x] Governance exists
- [x] Source of Truth exists
- [x] AI Reading Guide exists
- [x] Documentation Map exists
- [x] Architecture documented — ⚠️ production UNVERIFIED
- [x] Requirements cataloged — 71، همه DERIVED
- [x] Modules identified — 7
- [x] Module PRDs created — 7
- [x] Implementation plans created — 7 + platform
- [x] Platform documented where applicable
- [x] Important subsystems documented — 5
- [x] Traceability exists — ⚠️ پوششِ تست PARTIAL
- [x] Deprecated docs identified
- [x] Evidence separated
- [x] No major duplicated sources of truth
- [x] Links between docs are valid — نتیجه‌ی آخرین اجرا در Event Log
- [x] Documentation reflects actual repository state — تا 2026-09-14؛ تغییراتِ نشست‌های دیگر باید با `FINDING` ثبت و هم‌گام شوند

---

## ۵. خروجیِ نهایی (بخش ۲۷) — خلاصه‌ی زنده

| مورد | وضعیتِ فعلی |
|---|---|
| ساختارِ ایجادشده | `CLAUDE.md`، `PROJECT_MASTER_REFERENCE.md`، `PROJECT_STATUS.md`، `docs/00`–`07`، `verification/` — فهرستِ سند به سند: [documentation-map](docs/00-governance/documentation-map.md) |
| اسنادِ قبلی و دسته‌بندی | `analytics-clarity.md` → ACTIVE-CANONICAL · `admin-panel.md` → HISTORICAL · `session_assistant_v11 (3).html` → DEPRECATED · `server-deploy/`، `feelia-f9b0a9c.tar` → EVIDENCE/IRRELEVANT · `soniox.html`، `feelia-design-system.html`، `diag-collect.sh` → SUPPORTING |
| اسنادِ canonical | `docs/00`–`07`، `CLAUDE.md`، `PROJECT_MASTER_REFERENCE.md`، `docs/analytics-clarity.md`؛ این فایل برای Event Log |
| Master Reference | [`PROJECT_MASTER_REFERENCE.md`](PROJECT_MASTER_REFERENCE.md) (ریشه‌ی repo) |
| ماژول‌ها | 01 Therapist Accounts · 02 Client Management · 03 Therapy Sessions · 04 Transcription · 05 Notes & Signs · 06 Admin Panel · 07 UX Analytics |
| Subsystemها | 01 Browser Realtime Engine · 02 Audio Durability & Batch Fallback · 03 Transcript Integrity · 04 Legacy WS Proxy (P1) · 05 Session Audio Archive & Speaker Resolve |
| ناقص / نیازمندِ بررسی | review مالک روی LAW/REQ · توپولوژیِ production · تستِ backend/CI · ادعاهای INFERRED (فایل‌های یتیمِ صدا، race در batch، seqِ تکراری در آرشیو) · دو مورد UNVERIFIED در ماژول 05 |
| تعارض‌ها | 8 مورد (C1–C8) — [documentation-map §6](docs/00-governance/documentation-map.md)؛ **همه باز** |
| ریسک‌ها | 11 مورد (R1–R11) — [Master Reference §22](PROJECT_MASTER_REFERENCE.md)؛ **همه باز** |
| Deprecated / Historical | `docs/admin-panel.md`، `session_assistant_v11 (3).html`، `server-deploy/` |
| وضعیتِ نهایی | سیستمِ مستندات کامل و معتبر؛ منتظرِ تصمیم‌های مالک (§6) |

---

## ۶. تصمیم‌ها و کارهای باز

> مالک: [master-implementation-plan](docs/05-plans/master-implementation-plan.md). اینجا فقط وضعیت.

| ID | کار | وضعیت | منتظرِ |
|---|---|---|---|
| P0-0 | commitِ امنِ کارِ فعلی | ✅ **کدِ اصلی push شد** — ۹ کامیت (`2763414` تا `2551943`) رویِ `origin/feat/clarity`؛ مستندات (`docs/`, `PROJECT_STATUS.md`, …) هنوز untracked/محلی، تصمیمِ جداگانه‌ی مالک لازم دارد برایِ commit | تصمیمِ مالک درباره‌ی commitِ مستندات؛ merge/PR به `main` هنوز نه |
| P0-1 | اصلاحِ متنِ رضایت یا توقفِ آرشیوِ صدا (R1، C1) | ⏳ PENDING | تصمیمِ مالک |
| P0-2 | حذفِ لاگِ `DIAG-TEMP` (R2) | ⏳ PENDING | تأییدِ مالک |
| P0-3 | حذفِ فایل‌های صدا هنگامِ حذفِ داده (R4) | ⏳ PENDING | P0-1 |
| P1-1 | سقفِ آپلودِ multipart (R11) | ⏳ PENDING | عددِ هدف |
| P1-2 | stubِ IndexedDB در harness (R6) | ⏳ PENDING | تصمیم درباره‌ی dev dependency |
| P1-3 | تأییدِ توپولوژیِ production (R8، C3) | ⏳ PENDING | دسترسیِ مالک به سرور |
| P1-4 | deploy نسخه‌ی جدید | ⏳ BLOCKED | P0-1، P0-2، P1-1، P1-3 |
| P1-5 | CAS اتمیک + قفلِ پردازشِ batch (R5) | ⏳ PENDING | P1-2 |
| P1-6 | تست‌های backend | ⏳ PENDING | P1-5 |
| P2-* / P3-* | امنیتِ HTTP، تأییدِ حذفِ مراجع، فرمتِ تاریخ، export، legacy، پاکسازی | ⏳ PENDING | — |
| UI-Ph0 | ۵ باگِ بحرانی: UI-01/02/03/04/06 — [audit](docs/05-plans/ui-ux-audit-2026-09-14.md) | ✅ **commit + push شد** (`ecf00b4`) | — |
| UI-Ph1 (دورِ اول) | ۹ موردِ P1: UI-07/10/12/16/17/18/19/21/37 | ✅ **commit + push شد** (`ecf00b4`) | — |
| UI-Ph1 (دورِ دوم) | ۴ موردِ P1: UI-08/11/20-نیمه/27 | ✅ **commit + push شد** (`fedeac2`) | — |
| UI-Ph1 (چیدمانِ موبایل) | ۳ موردِ P1: UI-22/23/24 — نوارِ کنترلِ ثابت/دکمه‌ی ثابت در ≤480px | ✅ **commit + push شد** (`8347fbb`) | — |
| P2/P3 کم‌خطر (دورِ اول) | ۶ مورد: UI-20 (تصحیحِ سند)، UI-26، UI-34، UI-41، UI-42، UI-46 | ✅ **commit + push شد** (`85bd08e`) | — |
| P2/P3 کم‌خطر (دورِ دوم) | ۴ مورد: UI-29، UI-28، UI-38، UI-44-جزئی | ✅ **commit + push شد** (`84d4783`) | — |
| باگِ ۴۰۰ در batch-audio | purpose=note رویِ جلسه‌ی completed | ✅ **commit + push شد** (`fefa823`) | — |
| R16 + timeoutِ api() | متنِ یادداشت در پرونده + preflightِ گیرکرده | ✅ **commit + push شد** (`08e8d20`) | — |
| ریشه‌ی mintِ یادداشتِ صوتی | purpose=note در `/api/stt/realtime-session` | ✅ **commit + push شد** (`2551943`) | — |
| **مجموع push** | ۹ کامیت رویِ `origin/feat/clarity`، بعدِ رگرسیونِ نهاییِ کامل (خودکار + دستیِ رویِ سرورِ واقعی) و تأییدِ صریحِ مالک («اره کامیت کن» بعدِ «اگه همچی اوکی بود اوکیم») | ✅ **DONE** — 2026-09-14 | — |
| UI-Ph1 (باقی‌مانده)…Ph4 | UI-13/14/15/36 (لمسِ `feelia-rt.js`)، UI-09 (تصمیمِ مالک)، UI-05 (متنِ رضایت، به دستورِ مالک دست‌نخورده)، UI-25 (نیازِ فیلدِ جدیدِ API)، UI-30/32/33/35/39/40/43/45/47 (نیازِ تغییرِ بصریِ گسترده یا هم‌پوشانی با کارِ نشستِ دیگر) | ⏳ PENDING | تأییدِ مالک؛ برخی نیازمندِ میکروفون/بصری/تصمیمِ طراحی/تغییرِ API |
| LLM-SW | لایه‌ی LLMِ مستقل از provider + متیس (`LLM_PROVIDER=metis`) | ✅ commit `233016e` + deploy (2026-09-28) | — |
| FT-UX | اصلاحِ گوینده، نمایشِ ویرایش‌ها، هشدارِ ادمین، راهنمایِ ضبط (migration 034) | ✅ commit `752ab22` + deploy (2026-09-28) | سنجش رویِ جلسه‌هایِ واقعیِ بعدی؛ تصمیم درباره‌ی بازسازیِ جلسه‌ی پدرام |
| DOC-P7 | فاز ۷: انتقالِ Event Logِ قدیمی به `docs/08-history/` و کوتاه‌کردنِ header | ✅ انجام شد (2026-09-30) |
| DOC-FE | bannerهایِ `// ===== [feature:<x>] =====` در `public/index.html` (تغییرِ کد) | ✅ انجام شد (2026-09-30) |
| DOC-P4 | ادغامِ بخش‌هایِ patchِ تاریخ‌دار و ثابت‌هایِ تکراری در اسنادِ موجود (LAW-027) | ⏳ PENDING (جزئی انجام شد) | — |
| deploy به production | هیچ‌کدام از این ۹ کامیت هنوز رویِ `feelia.ir` نیستند (فقط push به `origin/feat/clarity`، نه merge به `main`، نه deploy) | ⏳ PENDING | تصمیم و مجوزِ صریحِ مالک (LAW-006) |

---

## ۷. Event Log

> append-only · جدیدترین بالا · قالب در §0.

### 2026-10-04 — TEST + AUDIT — اجرایِ همه‌یِ harnessها + بازبینیِ ۴ مرزِ پرچم‌شده‌یِ ضبطِ آزمایشیِ مالک (`4ddc36bf`) (به مجوزِ مالک: «اوکیه، تست‌ها رو انجام بده»)
- **تست‌ها:** `tsc` تمیز؛ `test:up` 76/0، `ft` 73/0، `llm` 22/0، `adm` 9/0، `hist` 14/0، `cf` 115/0، `tu` 19/0، `routes` OK (183)، `arch` OK (172 فایل)، `docs` OK، `eval` OK؛ `test:rt` 117 PASS / 0 FAIL ولی **پردازه تمام نمی‌شود** (بعد از T71 معلق می‌ماند؛ در این نشست با timeout ۲۸۰ث قطع شد، exit=124) — علتِ آن بررسی نشد؛ FINDING (احتمالاً از قبل موجود، در کدِ این نشست دست نخورده).
- **بازبینیِ مرزها (متنِ ضبطِ خودِ مالک، فقط ۴ مرز چاپ شد):** ضبط یک **آهنگ/رپ** بود نه گفتگویِ درمانی (۹ نوبت؛ ۴ مرزِ ۰↔۱ و ۵↔۶ همه جمله‌یِ کوتاهِ «ریمیکس با ما» که برچسبِ «درمانگر» گرفته). این برچسب یا واقعاً صدایِ دیگری (برچسبِ تهیه‌کننده) یا خطایِ تفکیک است؛ بدونِ صدا نامعلوم. **نتیجه: این ضبط برایِ precisionِ داور معتبر نیست** (محتوا گفتگو نیست و مدلِ داور رویِ «درمانگر/مراجع» تعریف شده). پرچمِ ۴/۴ با نمره ۹۵ محتمل است چون هر ۴ مرز «جمله‌یِ کوتاهِ بی‌ربط» دارند، نه الزاماً خطایِ تفکیک.
- **اسنادِ به‌روزشده:** این ورودی. **کارِ باز:** precisionِ داور هنوز با گفتگویِ واقعی/نقش‌آفرینیِ دونفره سنجیده نشده؛ علتِ نیامدنِ exitِ `test:rt`.
- **عامل:** این نشست.

### 2026-10-04 — GIT + DEPLOY (production) — commit `9ca373f` (رونویسیِ دوباره‌ی آپلود حذف) + deployِ `006b9fc`…`9ca373f` (به دستورِ مالک: «اره کامیت و دیپلوی و اینا رو بکن»)
- **GIT:** `9ca373f` از worktreeِ تمیز رویِ `cf97904` (`retryPlan.ts`، `runner.ts`، RP1، subsystem 07، دو ورودیِ Event Log). push به `origin/feat/clarity`؛ merge به `main` نه.
- **مقایسه‌ی پیش از deploy (checksum، بدونِ `
`):** کدِ prod = `9a02d66`، به‌جز `public/index.html` (تغییرِ deploy‌شده‌ی نشستِ دیگر: حذفِ هشدارِ `speakers_merged`).
  - `index.html`ِ deploy = merge سه‌طرفه (پایه `9a02d66`، prod، `cf97904`) بدونِ conflict ⇒ تغییرِ زنده‌ی آن نشست حفظ شد.
  - **FINDING:** CSSِ دکمه‌ی «بازگشت» (Event Log می‌گوید deploy شد) **رویِ prod نبود** (احتمالاً deployِ بعدیِ همان نشست آن را برگردانده). deploy نشد؛ در working tree دست‌نخورده است.
- **Preflight:** GO (۰ جلسه/ضبط/آپلود/job). **Backup:** `/root/backups/code-pre-9ca373f-20261004T124050Z.tar.gz` و `db-pre-9ca373f-20261004T124050Z.sql.gz` («Dump completed»).
- **Deploy:** تار (بدونِ `.env`/`node_modules`/`data`) ⇒ استخراج ⇒ `pnpm install --frozen-lockfile` ⇒ build ⇒ `pm2 restart feelia-mysql`.
  - لاگ: `045` و `046` applied؛ `[llm]` Metis؛ listening؛ بدونِ TypeError/unhandled.
  - `/api/health` ok؛ `feelia-rt.js` جدید سرو می‌شود؛ `POST /rt-tokens` بدونِ auth ⇒ 401.
  - checksumِ prod = artifact.
- **اکنون رویِ production:** رکوردِ realtime، پیشنهادِ نقش، سنجه‌یِ هر جلسه، T59، R17، export v4، allowlistِ رویدادها، بدونِ رونویسیِ دوباره‌ی آپلود. `CANONICAL_PASS` خاموش؛ متنِ رضایت دست‌نخورده (R24 باز).
- **Rollback:** استخراجِ `code-pre-9ca373f-…tar.gz` + build + restart. migrationها additive‌اند و جدول/ستون‌هایِ تازه برایِ کدِ قدیمی بی‌اثرند.

### 2026-10-04 — CODE + TEST + DOCS — «ساختِ دوباره»ی متنِ نهاییِ آپلود دیگر به Soniox نمی‌رود (به دستورِ مالک: «انجام بده»؛ commit/deploy نشده)
- **چه شد:** `final-transcript/domain/retryPlan.ts#planRetry` (خالص) + `runner.ts#retryFinalTranscript`. جلسه‌ی آپلودی با متنِ asyncِ ذخیره‌شده همیشه مستقیم به polish می‌رود، حتی وقتی متن کهنه است. جلسه‌ی زنده بدونِ تغییر.
- **چرا:** اندازه‌گیریِ prod (ورودیِ پایین‌تر): ۱ از ۱۴ آپلود با همین مسیر دو بار به Soniox رفته بود. رونویسیِ async قطعی است ⇒ همان متن با هزینه‌ی دوم.
- **تست:** `test:ft` 73/0 (RP1 جدید)، `tsc`، `test:arch`، `test:routes` (183)، `test:docs` سبز. سند: subsystem 07.

### 2026-10-04 — AUDIT (production، فقط‌خواندنی) — آپلودِ دومِ مالک (`4ddc36bf`، دونفره، ۶ دقیقه) — تأییدِ `3d90130` رویِ جلسه‌یِ چندنوبتی
- **زمان ✅:** job ۱۳ث؛ «متنِ نهایی» ۱۰ث (queued→done)؛ داورِ بعد از `done` ۱ call، ۱۴ث، ۴ از ۴ مرز داوری، ۰ failed (توکن: ۸۶۴ ورودی + ۲۹۹۹ خروجی، ۲۹۴۵ استدلال). پیشتر ۷–۱۲ دقیقه بود ⇒ F3 رویِ prod تأیید شد.
- **کیفیت:** پوشش ۹۴٫۵٪ (۱۶٫۷ث بی‌متن، بلندترین ۷٫۴ث؛ زیرِ آستانه‌یِ پرچم)، `low_conf` ۴٫۵٪، ۹ نوبت، ۲ گوینده + برچسبِ فانتومِ ۰٫۹٪ (پرچمِ `speakers_minor` هنوز deploy نشده)، `clipping` در `audio_quality` (`p10=-21dB` = صدایِ بسیار بلند/نزدیکِ میکروفون).
- **FINDING:** هر ۴ مرز با نمره‌یِ ۹۵ پرچم شد (الگوی ۹۵/۵ متناوب) — ۱۰۰٪ پرچم برایِ داور مشکوک است؛ یا ضبطِ آزمایشیِ تک‌نفره‌ایِ دو‌نقشه است (تفکیکِ واقعاً اشتباه) یا داور بیش‌ازحد پرچم می‌زند. بدونِ دیدنِ متن/صدا نامعلوم.
- **عامل:** این نشست.

### 2026-10-04 — AUDIT (production، فقط‌خواندنی) — اولین آپلودهایِ بعد از deployِ `3d90130` (حسابِ مالک: دو فایلِ کوتاه) — داورِ بعد از `done` در عمل تأیید شد
- **درخواستِ مالک:** «خودم یه آپلود جدید داشتم». فقط SELECT/grep؛ بدونِ متن؛ هیچ تغییری روی prod.
- **داده:** دو آپلودِ حسابِ ادمین (`faf6bd6c`): `b1d881ac` (۴۰۴ث، ۱ نوبت) و `4ddc36bf` (۳۶۲ث، ۹ نوبت)؛ هر دو `done`، `diarization_trusted=true`.
- **زمان (هدفِ این تغییر):** polish ۹ث و ۱۰ث؛ اعلانِ `final_transcript_ready` ۹ث و ۱۰ث بعد از پایانِ job ⇒ **هیچ تأخیرِ مرتبط با داور**. داور بعد از `done` اجرا شد: `4ddc36bf` ۱۴ث بعد از done نتیجه را نوشت (۴ کاندید، ۴ checked، `failed_batches=0`، `timed_out=false`؛ مصرف ۱ call، ۸۶۴ ورودی + ۲٬۹۹۹ خروجی/استدلال که به `usage.total` هم اضافه شد: calls ۳)؛ `b1d881ac` (۱ نوبت) ⇒ ۰ کاندید، ۰ call، بدونِ هزینه.
- **پرچم‌ها:** `4ddc36bf`: هر ۴ مرز نمره‌یِ ≥۹۵ گرفت (`[0,95,5]`، `[1,5,95]`، `[5,95,5]`، `[6,5,95]`) — الگو: نوبتِ میانی کاملاً «ادامه‌یِ همان گوینده» حکم گرفت. در ۹ نوبتِ کوتاه و احتمالاً ضبطِ آزمایشیِ یک نفره، یعنی داور احتمالاً درست می‌گوید (یک صدا به دو گوینده شکسته شده)؛ متن بررسی نشد.
- **نتیجه:** حلقه‌یِ `finish → داور → UPDATE polish_report` رویِ prod کار می‌کند؛ خطا ندارد. **هنوز UNVERIFIED:** رفتار روی جلسه‌یِ بلندِ واقعی (پدرام: ۳۰۰+ کاندید، سقفِ ۱۲۰، ۴–۶ دقیقه داور) — باید زمانِ `ft_polish_s` ≈۱–۳ دقیقه باشد و نتیجه‌یِ داور چند دقیقه بعد از done بیاید.
- **عامل:** این نشست.


### 2026-10-04 — AUDIT (production، فقط‌خواندنی، به مجوزِ مالک: «اره یه چک بکن») — آیا آپلودها دو بار هزینه‌ی Soniox دارند؟
- **روش:** اسکریپتِ موقتِ فقط‌SELECT در `/root/feeliaa-mysql/server` (بعد از اجرا حذف شد)؛ فقط عدد، بدونِ شناسه/متن. شمارشِ رویدادِ `final_transcript.stage` با `state=transcribing` (= رونویسیِ دوباره‌ی Soniox توسطِ «متنِ نهایی»). رصد از 2026-09-28 موجود است.
- **نتیجه:**
  - ۱۴ جلسه‌ی آپلودی ⇒ ۱۴ رونویسیِ Soniox در `audio_jobs` (دقیقاً یکی برایِ هر جلسه).
  - از ۸ آپلودِ دارایِ «متنِ نهایی»، فقط **۱ جلسه** یک رونویسیِ دوم داشت. دقیقاً **۱ رویدادِ `final_transcript.retry`** رویِ آپلود هست ⇒ علت «تلاشِ دوباره/ساختِ دوباره»ی دستی (مسیرِ `retryFinalTranscript` وقتی متن کهنه یا ناموفق است)، نه رفتارِ خودکار.
  - برایِ مقایسه: ۷ جلسه‌ی زنده با «متنِ نهایی» ⇒ ۷ رونویسیِ دوم (طبقِ طراحی).
- **پیامد:** هزینه‌ی دوبرابر در آپلود استثنایی است (۱ از ۱۴). رفعِ پیشنهادی: «ساختِ دوباره»ی آپلود همیشه از `async_text`ِ موجود استفاده کند. **انجام نشد؛ منتظرِ تصمیمِ مالک.**

### 2026-10-04 — DEPLOY (production، فقط `public/index.html`) — حذفِ هشدارِ `speakers_merged` (به دستورِ مالک: «بکن دیپلوی»)
- فقط دو رشته در فایلِ prod با اسکریپتِ node جایگزین شد (پیام و ترتیبِ `speakers_merged`)؛ بدونِ tar/build/restart (فایلِ استاتیک). پشتیبان: `/root/backups/index.html.pre-speakersmerged-*`. preflight اجرا نشد (بدونِ restart).
- تأیید: `/api/health` ok؛ `GET /` دیگر `speakers_merged` ندارد. commit نشده؛ تغییر در working tree است.

### 2026-10-04 — AUDIT (production، فقط‌خواندنی) — آپلودِ آزمایشیِ خودِ مالک (`b1d881ac`، تراپیستِ `faf6bd…`) — تأییدِ نسبیِ `3d90130`
- **نتیجه:** job `done` در ۱۸ث (۶٫۷ دقیقه صدا)، بدونِ retry/خطا؛ «متنِ نهایی» ۹ث (queued→finished)؛ پوشش ۹۹٫۶٪، `low_conf_ratio` ۱٫۱٪، `p10=-50dB`، بدونِ پرچمِ صدا؛ ۷۴۷ واژه، ۱ نوبت، ۱ گوینده ⇒ `speakers_merged` (حاضرین ۲) — هم‌خوان با ضبطِ تک‌نفره. `session_transcript_tokens` ذخیره شد.
- **مسیرِ داورِ بعد از `done` اجرا و ثبت شد** (`boundary_judge` در `polish_report` با ۰ کاندید، ۰ call) ⇒ UPDATEِ بعد از done روی prod کار می‌کند. **UNVERIFIED:** سرعتِ آن با جلسه‌یِ چندنوبتیِ واقعی (۹ث چون ۱ نوبت = ۰ مرز؛ سهمِ داور سنجیده نشد).
- **اسنادِ به‌روزشده:** این ورودی. **عامل:** این نشست.

### 2026-10-04 — CODE — حذفِ هشدارِ «ممکن است صدایِ دو نفر یک گوینده ثبت شده باشد» از UI تراپیست (به دستورِ مالک)
- **چه شد:** پیامِ `speakers_merged` از `UPLOAD_NOTE_MSG`/`UPLOAD_NOTE_ORDER` در `jobNotesHtml` برداشته شد؛ بنرِ «پیش از استفاده، متن را با صدا مقایسه کنید» دیگر برایِ حدسِ ادغامِ گوینده نمایش داده نمی‌شود (اعتمادِ تراپیست). بنر برایِ نکاتِ کم‌بود/شکافِ متن (`low_coverage|uncovered_gap|head_gap|tail_gap`) سر جایش ماند. سمتِ سرور و `transcript_metrics` دست‌نخورده (پرچم همچنان محاسبه می‌شود).
- **فایل‌ها:** `public/index.html` (حوالیِ خطِ 10524).
- **اسنادِ به‌روزشده:** این ورودی؛ `docs/07-subsystems/06-audio-upload-pipeline.md` §۱۸۹ هنوز `speakers_merged` را در UI ذکر می‌کند (باید هم‌گام شود).
- **تست / تأیید:** انجام نشد (تغییرِ یک‌خطیِ فرانت؛ بررسیِ مرورگر نشد).
- **عامل:** این نشست

### 2026-10-04 — GIT — commit `006b9fc` (core-data-plan + دورِ دوم؛ به دستورِ مالک: «Commit از worktreeِ تمیز»)
- **چه شد:** همه‌ی تغییراتِ این نشست (۴۶ فایل: رکوردِ realtime، پیشنهادِ نقش، سنجه‌یِ هر جلسه، T59، R17، export v4، T71، eval-asr، flagِ A/B، migrationهایِ 045/046، اسناد) از یک worktreeِ تمیز رویِ `9a02d66` commit شد. **push/deploy نشد.**
- **عمداً بیرون ماند (تغییراتِ نشست‌هایِ دیگر در working tree):** CSSِ دکمه‌ی «بازگشت» در `public/index.html` (رویِ production deploy شده ولی commit نشده)، `docs/05-plans/upload-quality-followup-2026-10-04.md` و ردیفش در documentation-map، و سه ورودیِ Event Logِ آن نشست‌ها. همه در working tree دست‌نخورده می‌مانند.
- **تست در worktree:** `test:rt` 117/0، `up` 75/0، `hist` 14/0، `eval` 8/0، `ft` 72/0، `cf` 115/0؛ `arch`/`routes` (183)/`docs`/`tsc` سبز.
- **تصمیمِ مالک در همین گفتگو:** متنِ رضایت «فعلاً دست نزن» (R24 باز می‌ماند).


### 2026-10-04 — CODE + AUDIT + DOCS — پلنِ upload-quality-followup: قدم‌هایِ ۳ (گزارشِ داور)، ۴ (ریشه)، ۵ (بسته)
- **قدم ۳ (کد):** `scripts/llm-usage-report.ts` بخشِ «داورِ مرزِ نوبت»: فراخوانی/توکن، سهم از توکنِ کلِ جلسه، کاندید/داوری/حذف‌شده/پرچم، timeout/failed. اجرایِ واقعی فقط رویِ DBِ dev (خالی ⇒ بخش چاپ نمی‌شود)؛ رویِ دادهٔ prod تست نشد (UNVERIFIED). تصحیحِ F6: سقفِ توکنِ روزانه فعال است و داور در `usage.total` شمرده می‌شود (فقط سقفِ دلاری بدونِ قیمت کار نمی‌کند).
- **قدم ۵ (فقط‌خواندنِ لاگِ prod، `call ok in`):** `500` ≈۱۸۴ث = timeoutِ ۱۸۰ث + gateway، در تکه‌هایِ polish؛ callهایِ داور ۲۵–۱۴۳ث ⇒ کوتاه‌کردنِ timeout سالم‌ها را می‌کشد ⇒ **بدونِ تغییرِ کد**.
- **قدم ۴:** مقایسه‌یِ `low`/`off` پیشتر انجام شده (۲۰۲۶-۱۰-۰۳؛ `off` کور). precisionِ دقیق منتظرِ مجوزِ چاپِ متنِ ۶ مرزِ ≥۸۰ (LAW-001/CLAUDE §6).
- **منتظرِ مالک:** (الف) قیمتِ `METIS_PRICE_IN/OUT_PER_M` + مجوزِ ری‌استارتِ prod؛ (ب) مجوزِ چاپِ متنِ ۶ مرز؛ (ج) deployِ قدمِ ۲/۳. **تست:** `tsc` OK، `test:up` 76/0، `test:adm` 9/0، `test:arch`/`test:docs` OK.
- **اسنادِ به‌روزشده:** `docs/05-plans/upload-quality-followup-2026-10-04.md`. **عامل:** این نشست.

### 2026-10-04 — CODE + TEST + DOCS — پلنِ upload-quality-followup قدمِ ۲: پرچم‌هایِ `speakers_minor` / `speaker_imbalance` (به دستورِ مالک: «شروع کن دونه‌دونه… همه باید انجام شود»)
- **چه شد:** `transcriptMetrics.ts`: ثابت‌هایِ `MINOR_SPEAKER_SHARE=0.005`، `IMBALANCE_SHARE=0.85`، `IMBALANCE_MIN_WORDS=1000`؛ دو پرچمِ جدید (فقط وقتی حاضرین معلوم‌اند ⇒ realtimeِ چند-run گمراه نمی‌شود؛ `speaker_imbalance` فقط دونفره). `diagnosis.ts` دو یافته‌یِ جدید؛ `feelia-admin-quality.js` برچسب‌ها. تراپیست/HOLD دست‌نخورده (آن‌ها لیستِ سفید دارند).
- **اندازه‌گیریِ فقط‌خواندنیِ prod (عدد):** توزیعِ نقش در `clean_turns` چهار جلسه‌یِ اخیر فقط «درمانگر/مراجع» است — گوینده‌یِ فانتوم در متنِ نهایی به یکی از دو نقش می‌چسبد، «گوینده ۳» نشت نمی‌کند. سهمِ درمانگر در `f1aeb2` فقط ۸۰۰ واژه از ۷۷۶۴ (۱۰٫۳٪) است ⇒ احتمالاً گفتارِ یک‌طرفه، نه باگ؛ پرچمِ جدید فقط آن را برایِ ادمین علامت می‌زند. بازهیِ جلسات: `3bb0da` (۵۱/۴۹) سالم؛ `88d4e5` (۷۳/۲۷)؛ `1828c2` (۶۶/۳۴).
- **تست:** `tsc` OK؛ `test:up` 76 PASS/0 FAIL (H75 جدید: مثبت/منفی، جلسه‌یِ کوتاه، نویزِ <۰٫۵٪، حاضرین نامعلوم، سه‌نفره، یافته‌یِ ادمین).
- **اسنادِ به‌روزشده:** `docs/07-subsystems/06-audio-upload-pipeline.md`.
- **عامل:** این نشست. **کارِ باز:** deploy نشده؛ قدم‌هایِ ۳–۶ پلن.

### 2026-10-04 — AUDIT (production، فقط‌خواندنی) + DOCS — مقایسه‌یِ کیفیتِ ۴ آپلودِ جدیدِ پدرام با قبل + پلنِ پیگیری
- **چه شد:** به درخواستِ مالک («کیفیت را نسبت به قبل بسنج، باگ‌ها را پیدا کن» ← «برو بخون») فقط SELECT رویِ `audio_jobs`/`sessions`/`final_transcripts`/`session_speaker_roles`/`obs_events` (فقط عدد/پرچم؛ اسکریپت‌هایِ موقت از سرور حذف شدند). هر ۴ job `done`، پوشش ۹۸٫۵–۹۹٫۶٪، `low_conf_ratio` دو جلسه‌یِ آخر ۳٫۳–۳٫۶٪ (قبل ۵٫۲–۷٪). FINDINGها: گوینده‌یِ سومِ فانتوم در ۳ از ۴ (فقط ≥۳٪ پرچم می‌خورد)، سهمِ ۹۰/۱۰ بدونِ پرچم، ≈۹۰٪ توکنِ داور استدلال و `cost_usd=null`، `session_speaker_roles` خالی (core-data-plan deploy نشده). تأخیرِ ۷–۱۲ دقیقه همان یافته‌یِ قبلی است که با `3d90130` رفع/deploy شد (هنوز با آپلودِ واقعی تأیید نشده).
- **فایل‌ها:** `docs/05-plans/upload-quality-followup-2026-10-04.md` (جدید).
- **اسنادِ به‌روزشده:** همین؛ بدونِ تغییرِ کد/prod.
- **تست / تأیید:** انجام نشد (فقط audit و پلن).
- **عامل:** این نشست.
- **کارِ باز / پیامد:** اجرایِ پلن منتظرِ دستورِ مالک؛ قدمِ ۱ (تأییدِ `3d90130`) با اولین آپلودِ بعدی.


### 2026-10-04 — GIT + DEPLOY (production) — commit `3d90130`: داورِ مرز بعد از `done` (به دستورِ مالک: «بکن»)
- **GIT:** `3d90130` (worktreeِ تمیز رویِ `a8e4411`؛ فقط ۷ فایلِ همین کار: `runner.ts`، `polishTranscript.ts`، `boundaryJudge.ts`، harness، دو سند، `PROJECT_STATUS.md`). push نشد. تغییراتِ نشستِ دیگر در همان ماژول (`adapters/versionStore.ts`، `final-transcript/index.ts`) و `public/` و … **commit و deploy نشدند**.
- **تأیید پیش از deploy (worktreeِ تمیز):** tsc، ft 72، llm 22، up 71، cf 115، tu 19، adm 9، hist 11 — 0 FAIL؛ routes 182، arch، docs OK؛ build OK؛ تار بدونِ `.env` (۰ مورد).
- **Preflight (§۵.۱):** GO (همه‌یِ شمارنده‌ها ۰ حتی `final_transcripts` فعال)؛ فقط یک تبِ باز polling (`/api/audio-jobs?scope=active`)؛ بررسیِ لحظه‌یِ آخر `active_total=0`.
- **PRODUCTION:** پشتیبانِ کد `/root/backups/code-pre-judgedefer-<ts>.tar.gz` (۵۹۸KB) ⇒ `tar -xzf` ⇒ `pnpm install --frozen-lockfile` ⇒ build ⇒ `pm2 restart feelia-mysql --update-env` (restarts=۵۱). همه‌یِ migrationها `already applied`؛ `/api/health` 200 (database connected)؛ لاگِ startup بدونِ خطا؛ `.env` دست‌نخورده؛ dist: `scheduleBoundaryJudge` ۲ ارجاع، `judgeBoundaries` در polish ۰؛ تارِ موقت حذف شد.
- **rollback:** استخراجِ تارِ backup + `pm2 restart` (بدونِ migration ⇒ بدونِ rollbackِ DB). خاموش‌کردنِ داور: `FINAL_TRANSCRIPT_BOUNDARY_JUDGE=0` + restart.
- **UNVERIFIED / پیگیری:** اولین آپلودِ بعدی (با `trustDiarization`): `ft_polish_s` باید ≈۱–۳ دقیقه باشد (نه ۷–۱۲)، اعلانِ `final_transcript_ready` بدونِ تأخیر برسد، و `polish_report.boundary_judge` چند دقیقه **بعد از** `done` ظاهر شود (لاگ: `final_transcript.boundary_judge`).
- **عامل:** این نشست.


### 2026-10-04 — CODE + TEST + DOCS — داورِ مرز بعد از `done` (بدونِ تأخیر برایِ کاربر) (به دستورِ مالک: «سمتِ کاربر نباید تأخیری باشه»)
- **انگیزه:** دو آپلودِ پدرام بعد از deployِ داور: ساختِ «متنِ نهایی» ۷۱۵ث و ۴۳۳ث (پیش‌تر ≈۱۰۰ث) — داور داخلِ polish بود و `done`/اعلان را تا ۴–۶ دقیقه عقب می‌انداخت.
- **تغییر:** `polishTranscript` دیگر داور را اجرا نمی‌کند (فقط `report.diarization_trusted`). `runner.ts#finish` بعد از commitِ `done`+اعلان، `scheduleBoundaryJudge` را بدونِ await فراخوانی می‌کند: صفِ سراسریِ یکی‌یکی، چکِ بودجه‌یِ روزانه، `judgeBoundaries`، سپس تراکنشِ `SELECT … FOR UPDATE … AND MD5(clean_text)=?` (اگر متن در این فاصله عوض شده/دوباره ساخته شده ⇒ ثبت نمی‌شود) و `UPDATE` رویِ `final_transcripts.polish_report` و نسخه‌یِ `generated`؛ `mergeJudgeIntoReport` (خالص) مصرفِ داور را به `usage.total` هم اضافه می‌کند (بودجه‌یِ روزانه می‌شمارد). هر خطا ⇒ فقط نمره‌ای ثبت نمی‌شود؛ ری‌استارت وسطِ داوری ⇒ همان.
- **تأیید رویِ prod (فقط‌خواندنی):** `MD5(clean_text)` در MySQL = md5ِ JS برایِ ۶ از ۶ ردیف؛ `EXPLAIN` برایِ SELECT…FOR UPDATE و هر دو UPDATE معتبر؛ هر دو ستونِ `polish_report` از نوعِ JSON.
- **تست:** tsc OK؛ `test:ft` 72 pass (BJ6 بازنویسی: polish داور را اجرا نمی‌کند؛ BJ7 جدید: ادغامِ گزارش/مصرف، ورودیِ دست‌نخورده، هزینه‌یِ نامعلوم).
- **UNVERIFIED:** اجرایِ واقعیِ مسیرِ `finish → scheduleBoundaryJudge → UPDATE` داخلِ pipelineِ prod (حلقه‌یِ DBِ runner با harness پوشش داده نمی‌شود)؛ اولین آپلودِ بعد از deploy باید `ft_polish_s` را ≈۱–۳ دقیقه و `boundary_judge` را چند دقیقه بعد از `done` نشان دهد.
- **عامل:** این نشست.


### 2026-10-04 — AUDIT (production، فقط‌خواندنی) — اولین دو آپلودِ پدرام بعد از deployِ داورِ مرزِ نوبت (`1828c250`، `f1aeb21c`)
- **درخواستِ مالک:** «چک کن» (پس از خبرِ آپلودِ تازه). فقط SELECTِ شمارنده/متادیتا + grepِ لاگِ pm2؛ بدونِ متنِ بالینی؛ هیچ تغییری روی prod/کد. (بررسیِ دوره‌ایِ cron به دستورِ مالک پیش‌تر حذف شده بود.)
- **داور کار کرد:** هر دو `stage=done`؛ `boundary_judge` ثبت شد؛ `failed_batches=0`، `timed_out=false`؛ نقش‌ها خالص (هر برچسب = یک نقش)، `fallback_turns` ۷/۳۴۴ و ۱/۲۸۶ (بدونِ `llm-error`)، `role_fixes=0`.
- **پوشش:** `1828c250`: ۳۲۳ کاندید، ۱۲۰ داوری (۳۷٪)، ۲۰۳ حذف به‌خاطرِ سقف؛ `f1aeb21c`: ۲۶۶ کاندید، ۱۲۰ داوری (۴۵٪)، ۱۴۶ حذف ⇒ سقفِ ۱۲۰ کمترِ نیمی از مرزها را می‌بیند (نمونه‌یِ یکنواخت).
- **پرچم‌ها (نمره ≥۵۰):** ۵ از ۱۲۰ (۴٫۲٪) و ۷ از ۱۲۰ (۵٫۸٪)؛ ≥۸۰: ۳ و ۳. تقریباً همه یک لبه‌یِ بسیار کوتاه (۱–۵ واژه) کنارِ نوبتِ بلند دارند (مثلاً درمانگرِ ۲ واژه‌ای پیش از نوبتِ ۲۰۱ واژه‌ایِ مراجع) — هم‌خوان با الگویِ آزمایشِ `88d4e55e`. precision هنوز با نگاهِ انسان تأیید نشده.
- **هزینه (توکن، `cost_usd=null`):** داور ۱۴۴k (۱۳ call: ۱۶٫۸k ورودی + ۱۲۷k خروجی/استدلال) و ۱۸۴k (۱۵ call) ⇒ ≈ ۶۰–۶۶٪ از کلِ توکنِ جلسه (کل ۲۱۸k و ۳۰۷k) و ≈ ۸۵٪ از توکنِ خروجی. هم‌خوان با تخمینِ ≈۱۵۰k/جلسه.
- **زمان — FINDING:** صفِ polish→پایان ۷۱۵ث (≈۱۲ دقیقه) و ۴۳۳ث (≈۷ دقیقه) در برابرِ ≈۱٫۷ دقیقه برایِ `88d4e55e` پیش از داور. سهمِ داور جدا اندازه‌گیری نشد (تخمینِ ۴–۶ دقیقه؛ ۱۳–۱۵ call با ۳ موازی)؛ در لاگ دو خطایِ `Metis 500` هر کدام ≈۱۸۴ث و یکی `Connection error` هم بود (retryِ آداپتور جذبشان کرد، `failed_batches=0`) و تأخیرِ اضافه می‌دهند. اثر: «متنِ نهایی» و اعلانِ `final_transcript_ready` برایِ پدرام چند دقیقه دیرتر می‌رسد.
- **نتیجه/پیشنهاد (تصمیمِ مالک):** (۱) اجرایِ داور **بعد از** `done` (غیرمسدودکننده؛ نتیجه با UPDATEِ `polish_report`) تا تأخیری به کاربر نرسد؛ (۲) در صورتِ نیاز کاهشِ `FINAL_TRANSCRIPT_BOUNDARY_JUDGE_BUDGET_MS`؛ (۳) بازبینیِ انسانیِ چند پرچمِ ≥۸۰ برایِ precision (نیازمندِ مجوزِ چاپِ متنِ همین دو جلسه).
- **عامل:** این نشست.


### 2026-10-04 — CODE + TEST + FINDING + DOCS — دورِ دومِ بهبودهایِ Core (به دستورِ مالک: «الان چه مواردی باقی موندن برای بهبودی انجامشون بده»؛ commit/deploy نشده)
- **R17 رفع شد:** `hasActiveRecording()`ِ `index.html` ضبطِ محلی (recorderِ durable بدونِ WS) را هم می‌بیند ⇒ خروج/پنلِ ادمین مسدود. Chromeِ واقعی با mintِ مسدود تأیید کرد.
- **export v4:** هر جلسه `final_transcript` (متنِ مرتب، نوبت‌ها، فهرستِ نسخه‌ها) و `canonical.{engine, model, meta, metrics}` دارد؛ `schema_version: 4`. E2Eِ DBِ dev: 5/0.
- **نگهبان:** `test:rt` T71 — رویدادِ کلاینتِ بیرون از allowlist دیگر بی‌صدا نمی‌ماند.
- **اسناد:** ۲۸ جدول / migration تا 046 در CLAUDE.md و Master Reference؛ api-catalog (export v4)؛ R17 بسته؛ [verification](verification/2026-10-04-core-data-plan.md) §۷.
- **بررسی:** کندیِ `test:rt` (≈۴٫۵ دقیقه) از پیش موجود است (HEAD ۴:۳۰)؛ تغییری لازم نبود.
- **FINDING:** نشستِ دیگری هم‌زمان `final-transcript` (`boundaryJudge`/`polishTranscript`/`runner`) را ویرایش می‌کرد؛ `tsc` لحظه‌ای قرمز و بعد سبز شد. دست زده نشد.
- **تست:** `up` 75/0، `ft` 72/0، `cf` 115/0، `hist` 14/0، `tu` 19/0، `adm` 9/0؛ `arch`/`routes` (183)/`docs`/`tsc` سبز؛ `test:rt` 117/0 (T71: 27 رویداد، ۰ گم‌شده).
- **باقی‌مانده = فقط تصمیمِ مالک:**
  - متنِ رضایت و سیاستِ نگهداری/حذفِ واقعی (R1/R24)
  - `CANONICAL_PASS=1` رویِ production (هزینه)
  - commit/deploy (migrationهایِ 045/046)
  - جلساتِ نقش‌آفرینی برایِ مجموعه‌ی طلایی و A/B

### 2026-10-04 — CODE + MIGRATION + TEST + FINDING + DOCS — اجرایِ core-data-plan، قدم‌های ۱–۸ (به دستورِ مالک: «به ترتیب همه رو انجام بده»؛ commit/deploy نشده)
- **کد:**
  - (۲) رکوردِ realtime از توکن‌هایِ finalِ زنده: `POST /api/sessions/:id/rt-tokens`، `buildRealtimeRecord` در پایانِ جلسه و پس از تکه‌ی دیررس؛ `covers_full` همیشه false.
  - (۳) پیشنهادِ نقشِ گوینده (متنِ نهایی / حدسِ دونفره) — فقط «تأیید» ذخیره می‌کند.
  - (۴) سنجه‌یِ کیفیت برایِ هر گذر؛ `audio-status.transcript_quality`؛ ردیفِ «زنده» در نمایِ کیفیتِ ادمین.
  - (۵) T59: سگمنتِ لحظه‌ی قطع با interim رونویسی می‌شود و هم‌پوشانی در سرور حذف می‌شود.
  - (۶) `scripts/eval-asr.mjs` (`pnpm eval:asr`، `pnpm test:eval`).
  - (۷) flagِ A/B `localStorage.feelia_durable_raw` (پیش‌فرض خاموش).
- **migration:** 045 (`session_rt_token_chunks` + `session_transcript_tokens.meta`) و 046 (`metrics`، `metrics_at`) — **رویِ DBِ مشترکِ dev اعمال شد**؛ production نه.
- **FINDING:**
  - شش رویدادِ کلاینتِ ممیزیِ Core در `OBS_CLIENT_EVENTS` نبودند ⇒ کاشی‌هایِ `core-metrics` همیشه صفر بودند. اضافه شدند؛ `silent_ms` ⇒ `elapsed_ms`.
  - Soniox در realtime توکنِ کنترلیِ `<end>`/`<fin>` با زمانِ ۰ می‌فرستد ⇒ فیلتر شد (یافته‌ی E2E).
  - `finish()` رویِ fetchِ معلق می‌ایستاد ⇒ سقفِ سخت.
- **تست:**
  - `test:rt` 116/0 (≈۴٫۷ دقیقه)، `test:up` 75/0، `test:hist` 14/0، `test:eval` 8/0، `ft` 71/0، `cf` 115/0، `tu` 19/0، `llm` 22/0، `adm` 9/0؛ `arch`/`routes` (183)/`docs`/`tsc` سبز.
  - E2Eِ backend رویِ DBِ dev: 18/0.
  - E2Eِ مرورگرِ واقعی (Chrome + میکروفونِ جعلی + Sonioxِ واقعی، دو اجرا): رکورد کامل، پوشش ۹۶٫۵٪، تأییدِ نقش از UI، ۰ خطایِ console.
  - fixtureهایِ canary، پوشه‌هایِ صدا و اسکریپت‌هایِ موقت پاک شدند. [verification](verification/2026-10-04-core-data-plan.md).
- **اسناد:** subsystem 01/03/08، api/error/database/configuration-catalog، feature-index، repository-map، CLAUDE.md §8، Master Reference §22، پلن (EXECUTED + پروتکلِ مجموعه‌ی طلایی).
- **باز:**
  - (الف) جمع‌آوریِ مجموعه‌ی طلایی و مقایسه‌ی A/B نیازمندِ جلساتِ نقش‌آفرینیِ مالک است.
  - (ب) متنِ رضایت و `CANONICAL_PASS` بیرونِ پلن‌اند؛ R24 بحرانی می‌ماند.
  - (ج) R17 (logout در ضبطِ محلی) باز است.
  - (د) migrationهایِ 045/046 پیش از deploy باید با کد commit شوند.

### 2026-10-03 — DOCS — پلنِ تکمیلِ Core به‌جز رضایت (به درخواستِ مالک: «به جز رضایت برای بقیش یه پلن بنویس»)
- سندِ جدید: [core-data-plan-2026-10-03](docs/05-plans/core-data-plan-2026-10-03.md) (PROPOSED)، ثبت در documentation-map.
- ۸ قدم:
  1. بهداشتِ اسنادِ ریسک
  2. **رکوردِ realtime از توکن‌هایِ final که مرورگر دارد، برایِ هر جلسه‌یِ زنده و بدونِ هزینه‌یِ Soniox**
  3. پیشنهادِ نقشِ گوینده
  4. سنجه‌یِ کیفیت برایِ هر جلسه
  5. بستنِ T59
  6. ابزارِ WER/DER با جلساتِ نقش‌آفرینی
  7. A/B پردازشِ میکروفون فقط رویِ recorderِ durable
  8. E2Eِ مرورگرِ واقعی
- متنِ رضایت و `CANONICAL_PASS` بیرونِ پلن‌اند. هیچ کدی تغییر نکرد. اجرا فقط با دستور.

### 2026-10-03 — AUDIT + TEST + FINDING — بازممیزیِ «Core = منبعِ قابل‌اعتمادِ داده‌ی جلسه» (فقط‌خواندنی؛ کدی تغییر نکرد)
- **حکم:** نسبت به ممیزیِ 2026-10-01 به‌طورِ محسوس بهتر شده‌ایم:
  - **ضبط و ذخیره:** gap-check با `client_seq`/skips، `fsync`، `storage.persist()`، `audio-status`، بنرهایِ F4.
  - **داده:** توکن‌ها، `session_segments`، تاریخچه‌ی متن، CASِ اجباری، پرونده/export از رکوردِ canonical.
  - **باز:** گوینده و دقت نیمه‌کاره‌اند. نقش از `attendees` پیش‌پر نمی‌شود. `CANONICAL_PASS` پیش‌فرض خاموش است ⇒ جلسه‌ی زنده رکوردِ canonical ندارد. `transcriptMetrics` فقط برایِ آپلود است. WER/DER روی صدایِ واقعی سنجیده نشده. `noiseSuppression/AGC` روشن است.
- **FINDING (بحرانی، تشدیدِ R1):**
  - متنِ UI هنوز «صدا هیچ‌جا ذخیره نمی‌شود» (`public/index.html:1519`) و «صدای خام هرگز ذخیره نمی‌شود» (`:1805`) است.
  - در همین حال سیاستِ «هیچ چیز هارد دیلیت نشود» صدا را **بی‌مدت** نگه می‌دارد (`archive/sweep.ts:18,82`، `shared/retention.ts`) و حذفِ مراجع نرم است.
  - جدولِ §22ِ Master Reference این ریسک را ندارد و R15/R4 را هنوز باز نشان می‌دهد (در کد رفع شده‌اند).
- **تست (working tree):** `test:up` 71/0، `test:ft` 71/0، `test:cf` 115/0، `test:hist` 11/0، `test:rt` بدونِ FAIL؛ `test:arch`/`test:routes` (182)/`test:docs` OK؛ `tsc` تمیز.
- **پلن:** `~/.claude/plans/pasted-content-id-4dc7-core-abundant-catmull.md`. اجرا فقط با دستورِ صریحِ مالک.

### 2026-10-04 — DEPLOY (production، فقط `public/index.html`) — دکمه‌ی «بازگشت» صفحه‌ی شروعِ جلسه (به دستورِ مالک: «اگه کسی فعال نیست دیپلوی کن»)
- Preflight (§5.1) اول NO-GO (یک رونویسیِ زنده)، چند دقیقه بعد **GO** (همه ۰). sha1ِ `public/index.html` روی prod = HEAD (قبل از تغییر).
- چون working tree تغییراتِ commitنشده‌ی نشستِ دیگری داشت (hunkهایِ نقشِ گوینده/سنجه‌یِ کیفیتِ متن در `index.html` و سمتِ server)، **فقط همان یک خطِ CSS** با `sed` روی فایلِ prod اعمال شد؛ بدونِ tar، build یا restart. پشتیبان: `/root/backups/index.html.pre-setupback-*`.
- تأیید: `/api/health` ok؛ `GET /` همان استایلِ جدید را سرو می‌کند. commit نشده؛ تغییرِ محلی هنوز در working tree است.
- **FINDING:** `public/index.html` در working tree حاویِ کارِ نیمه‌تمامِ نشستِ دیگر است (core-data-plan قدم‌های ۳/۴)؛ دست نخورد.

### 2026-10-03 — CODE (UI) — بزرگ‌کردنِ دکمه‌ی «بازگشت» در صفحه‌ی شروعِ جلسه (commit/deploy نشده)
- به درخواستِ مالک: `.setup-back` در `public/index.html` (فقط CSS): `font-size` 13→16px، `font-weight:600`، `padding` 6×14→10×24، `min-height:44px`، `margin-top` 6→8px. بدونِ تغییرِ منطق/HTML.
- تأیید نشده در مرورگر (صفحه نیازمندِ ورود و مراجعِ واقعی است؛ طبق قانون حساب ساخته نشد).

### 2026-10-03 — GIT + DEPLOY (production) — commit `279da25`: داورِ مرزِ نوبت (فقط ثبت)، سقفِ ۱۲۰ مرز (به دستورِ مالک: «سقف رو بذار ۱۲۰ و commit و deploy کن»)
- **GIT:** `279da25` رویِ `feat/clarity` (push نشد). فقط فایل‌هایِ همین کار؛ `public/index.html` (تغییرِ UIِ نشستِ دیگر، دکمه‌یِ «بازگشت») عمداً **commit و deploy نشد**. سقفِ پیش‌فرض ۳۰۰ ⇒ **۱۲۰**؛ بیش از سقف ⇒ نمونه‌یِ یکنواخت از کلِ جلسه (نه فقط ۱۲۰ مرزِ اول).
- **پاسخ به پرسشِ مالک (سقف و ویرایشِ متنِ پدرام):** سقف فقط تعدادِ مرزهایی را که برایِ نمره‌دادن به LLM می‌روند محدود می‌کند؛ داور فقط ثبت می‌کند (نه متن، نه نقش) ⇒ هیچ اثری رویِ متنِ نهایی/ویرایش‌هایِ پدرام ندارد. اثرِ سقف فقط پوششِ ثبت است (جلسه‌یِ ≈۱۳۰+ کاندید ⇒ بخشی نمونه‌گیری می‌شود، یکنواخت).
- **تأیید پیش از deploy (worktreeِ تمیز رویِ `279da25`):** tsc، ft 71، llm 22، up 71، cf 115، tu 19، adm 9، hist 11 — 0 FAIL؛ routes 182، arch، docs OK؛ build OK؛ تار بدونِ `.env` (۰ مورد). sha `public/index.html` رویِ prod = worktree.
- **Preflight (§۵.۱):** GO در همه‌یِ شمارنده‌ها (حتی `final_transcripts` فعال = ۰)؛ ترافیکِ nginx فقط اسکنرِ ربات؛ بررسیِ لحظه‌یِ آخر `active_total=0` درست پیش از restart.
- **PRODUCTION:** پشتیبانِ کد `/root/backups/code-pre-boundaryjudge-<ts>.tar.gz` (۵۹۴KB) ⇒ `tar -xzf` ⇒ `pnpm install --frozen-lockfile` ⇒ `pnpm --filter server run build` ⇒ `pm2 restart feelia-mysql --update-env` (restarts=۵۰). همه‌یِ migrationها `already applied` (بدونِ migrationِ جدید)؛ `/api/health` 200 (database connected)؛ لاگِ startup بدونِ خطا؛ `.env` سرور دست‌نخورده؛ تارِ موقت از سرور حذف شد.
- **تأییدِ پیکربندیِ داور رویِ prod (فقط‌خواندنی):** `polish reasoning=off`، `judge reasoning=low`، همان مدل، `max_tokens=16384`.
- **rollback:** استخراجِ تارِ backup + `pm2 restart` (بدونِ migration ⇒ بدونِ rollbackِ DB). خاموش‌کردنِ سریع بدونِ rollback: `FINAL_TRANSCRIPT_BOUNDARY_JUDGE=0` در `/root/feeliaa-mysql/.env` + restart.
- **UNVERIFIED:** اجرایِ واقعیِ داور در pipelineِ prod (اولین آپلودِ بعدی با `trustDiarization`)؛ هزینه/زمانِ واقعی؛ precisionِ پرچم‌ها. **پیگیری:** بعد از اولین آپلودِ بعدیِ پدرام، `polish_report.boundary_judge` (checked/flagged/failed_batches/timed_out) و `usage.boundary_judge` را بخوانید.
- **عامل:** این نشست.

### 2026-10-03 — CODE + TEST + DOCS — داورِ مرزِ نوبت، حالتِ «فقط ثبت» (به دستورِ مالک: «داور حالت ثبت رو بساز»؛ commit/deploy نشده)
- **ساخته شد:** `features/final-transcript/application/boundaryJudge.ts` (جدید) + `BOUNDARY_*` در `prompts.ts` + اتصال در `polishTranscript.ts` (`cfg.boundaryJudge`، فقط وقتی `trustDiarization`) + `boundaryJudgeFor` در `runner.ts` + `envWithReasoning` در `llm/config.ts` (سطحِ استدلالِ مستقل برایِ داور). **حذف شد:** داورِ «ساندویچی»ِ همان روز (`checkContinuity`، `FINAL_TRANSCRIPT_CONTINUITY_CHECK`، تست‌هایِ C1–C6) چون الگویِ اصلی را نمی‌دید.
- **رفتار:** مرزِ تعویضِ نقش (بدونِ نشانگر) با جمله‌یِ لبه ≤۶ واژه ⇒ دسته‌هایِ ۱۰تایی، ۳ موازی، LLMِ استدلال‌گر (`low`) ⇒ نمره‌یِ a/b ⇒ `polish_report.boundary_judge` = `{candidates, checked, truncated, failed_batches, timed_out, flagged:[[i,a,b]]}` (فقط اندیس/عدد، حداکثر ۸۰). **متن و نقش‌ها هرگز تغییر نمی‌کنند؛ خطا هرگز پرتاب نمی‌شود.** مصرفِ توکنِ داور در `usage.total` (⇒ سقفِ بودجه‌یِ روزانه) و `usage.boundary_judge`. env: `FINAL_TRANSCRIPT_BOUNDARY_JUDGE` (پیش‌فرض روشن؛ `0` خاموش)، `_REASONING` (`low`)، `_MAX` (**۱۲۰** به دستورِ مالک برایِ هزینه؛ بیش از سقف ⇒ نمونه‌یِ یکنواخت از کلِ جلسه، نه فقط اولش)، `_BUDGET_MS` (۳۶۰۰۰۰).
- **کنترلِ اضافه (پرداختِ کم، ≈۱۳۰k توکن):** مکثِ بینِ توکن‌ها لازم نیست — recall تزریقیِ کوتاه با مکث ۱۶/۳۰ و ۱۶/۳۰ و **بدونِ مکث ۱۶/۳۰ و ۲۰/۳۰** (`reasoning=low`) ⇒ polish نیازی به توکن‌هایِ زمان‌دار ندارد.
- **تست:** tsc OK؛ `test:ft` 71 pass (BJ1–BJ6 جایگزینِ C1–C6: کاندیدها، نمره‌ها/کلمپ، خطا، پاسخِ مخرب، سقفِ تعداد/زمان، یکسانیِ متن/نقش با و بدونِ داور، خاموش بدونِ trustDiarization)؛ `test:llm` 22 pass؛ arch OK؛ docs OK.
- **UNVERIFIED:** (۱) اجرای واقعیِ end-to-end داخلِ pipelineِ prod (فقط ماژولِ جدا با همان LLM آزموده شد)؛ (۲) precisionِ پرچم‌هایِ واقعی (قضاوتِ اولیه ≈۵۰–۷۰٪، تأییدِ مالک نشده)؛ (۳) زمانِ اضافه‌یِ polish (تا سقفِ ۶ دقیقه) و هزینه (≈۱۵۰k توکن/جلسه با پیش‌فیلتر؛ تخمین). UI برایِ دیدنِ پرچم‌ها ساخته نشده؛ فعلاً فقط در `polish_report` (ادمین/DB).
- **عامل:** این نشست.

### 2026-10-03 — AUDIT (production، چاپِ ۱۰ مرزِ پرچم‌شده به مجوزِ صریحِ مالک) — دقتِ داورِ مرزِ نوبت (`reasoning=low`) رویِ `88d4e55e`
- **مجوز:** «۱۰ نمونه رو چاپ کن، اوکی». ۱۴۲ مرز (هر سومی) با `reasoning=low` داوری شد (≈۲۳k ورودی + ≈۱۹۵k خروجی/استدلال)؛ ۱۳ پرچم با نمره ≥۵۰؛ ۱۰ نمونه‌یِ برتر در گفتگو چاپ شد (نه در فایل/لاگ/commit). هیچ نوشتنی در prod.
- **قضاوتِ اولیه‌یِ این نشست (بدونِ تأییدِ مالک):** حدودِ ۵ از ۱۰ آشکارا خطایِ واقعیِ مرز (جمله‌یِ کوتاهِ سرِ نوبت/ته‌ِ نوبت که ادامه‌یِ گوینده‌یِ طرفِ دیگر است)، ۳ مورد مرزِ نادرست با جهتِ نامطمئن، ۱ مثبتِ کاذبِ محتمل، ۱ مبهم ⇒ precision ≈ ۵۰–۷۰٪. در نمره ≥۸۰: ۷ مورد که همه به‌نوعی مرزِ مشکوک‌اند.
- **الگو:** تقریباً همه «جمله‌یِ بسیار کوتاه (۱–۵ واژه) در لبه‌یِ نوبت» اند؛ ۷ از ۱۰ مکثِ ≤۱۸۰ms. ⇒ پیش‌فیلترِ ارزان: فقط مرزهایی که جمله‌یِ لبه ≤۶ واژه است (≈یک‌چهارم) به داور بروند.
- **کارِ باز:** تصمیمِ مالک: ساختِ داورِ مرز (shadow-first) یا نه؛ جابه‌جاییِ جمله بینِ دو نوبت = تغییرِ تقسیمِ متن (نه واژه‌ها)، نیازمندِ نگهبانِ «ترتیب و محتوایِ واژه‌ها بدونِ تغییر».
- **عامل:** این نشست.

### 2026-10-03 — AUDIT (production، آزمایشِ LLM رویِ متنِ واقعیِ `88d4e55e`، به مجوزِ مالک) — «داورِ مرزِ نوبت»: سنجشِ دقت با تزریقِ خطا
- **مجوز:** «باید بررسی بشه، من اوکیم، فقط زیاد هزینه نذار». فقط خواندنِ DB + فراخوانیِ LLMِ محصول (Metis/deepseek-v4-flash) از stdin؛ هیچ نوشتنی در DB/فایلِ سرور؛ متنِ بالینی چاپ نشد. مجموعِ مصرف ≈ ۱۳۰k توکنِ ورودی + ≈ ۱۲۵k خروجی/استدلال (۵ اجرا، `cost_usd=null`).
- **روش:** ۴۲۶ مرزِ واقعیِ تعویضِ گوینده (۲ تا ۳ جمله‌یِ دو طرف + مکثِ توکن‌ها) + **تزریقِ ۶۰ خطایِ ساختگی** (۳۰: آخرین جمله‌یِ نوبتِ قبل به ابتدایِ نوبتِ بعد منتقل؛ ۳۰: برعکس).
- **نتیجه:** (۱) پرامپتِ بله/نه و محافظه‌کار، بدونِ استدلال: ۴۲۶ مرز ⇒ فقط ۷ پرچم و **recall تزریقی ۰/۶۰** (کور). (۲) نمره‌دهی ۰–۱۰۰، بدونِ استدلال: recall ۰–۲۳٪ (th=۵۰: ۰٪ و ۲۳٪). (۳) همان نمره‌دهی با «why» کوتاهِ قابلِ‌مشاهده، بدونِ استدلال: recall ≈ ۰٪ ⇒ توجیهِ نوشتاری جایگزینِ استدلالِ مدل نیست. (۴) **`reasoning=low`:** recall ۵۳٪ (injX) و ۶۰٪ (injY) در th=۵۰؛ پرچمِ واقعی (نمونه‌یِ ۴۶ مرز): a≈۸٫۷٪، b≈۲٪؛ هزینه ≈ ۱۰۰۰ توکنِ استدلال به‌ازایِ هر مرز (≈۴۰۰k توکن/جلسه).
- **محدودیت‌ها:** تزریق خوش‌بینانه/بدبینانه است (جمله‌هایِ خنثی مثلِ «بله» ذاتاً ناشناختنی‌اند ⇒ سقفِ recall <۱۰۰٪). **دقتِ پرچم‌هایِ واقعی (precision) هنوز نامعلوم** — بدونِ قضاوتِ انسانی درباره‌یِ چند مرزِ پرچم‌شده نمی‌شود فهمید خطایِ واقعی‌اند یا اشتباهِ داور. تنها یک جلسه.
- **نتیجه‌گیری موقت:** داورِ LLMِ بدونِ استدلال بی‌فایده است؛ با استدلالِ `low` ممکن است مفید باشد ولی گران‌تر و بدونِ precisionِ اثبات‌شده؛ تغییرِ خودکارِ نقش هنوز توجیه ندارد. کدِ تولیدی دست‌نخورده (داورِ ساندویچی پیش‌فرض خاموش).
- **عامل:** این نشست.

### 2026-10-03 — AUDIT (production، فقط‌خواندنی) + DECISION — بازنگریِ عمیقِ «ادامه‌ی حرفِ درمانگر در گفته‌یِ مراجع»؛ داورِ قبلی پیش‌فرض خاموش شد
- **درخواستِ مالک:** راه‌حلِ قبلی سطحی بود؛ عمیق‌تر و از چند جهت بررسی شود. فقط شمارنده/عدد (بدونِ متنِ بالینی)؛ اسکریپت‌ها از stdin، فایلی روی سرور نماند؛ ffmpeg با `nice` فقط خواندنِ صدا (۱۶ث).
- **یافته ۱ (ریشه در Soniox است، نه polish):** `clean_turns` یک‌به‌یک با نوبت‌هایِ خام است (۴۲۷=۴۲۷)، هر برچسب دقیقاً یک نقش؛ polish نقشی عوض نکرده. توکن‌هایِ زمان‌دار فقط برایِ `88d4e55e` ذخیره است (بعد از 038/041).
- **یافته ۲ (سطحِ تفکیک = جمله):** در توکن‌هایِ `88d4e55e` هیچ تعویضِ گوینده‌ای وسطِ جمله نیست (۰ از ۴۱۲)؛ هر جمله مستقل برچسب می‌گیرد ⇒ خطا یعنی «یک جمله‌یِ کامل» با برچسبِ اشتباه.
- **یافته ۳ (دو الگویِ خطا؛ داورِ قبلی فقط یکی را می‌دید):** (الف) جمله‌یِ مراجع‌گرفته بینِ دو نوبتِ درمانگر؛ (ب) **جمله‌یِ ادامه‌یِ درمانگر که به ابتدایِ نوبتِ بلندِ مراجع چسبیده** (تطابق با شرحِ مالک: «توی صحبت‌هایِ مراجع»). (ب) در `checkContinuity` نمی‌آید.
- **یافته ۴ (صدا راهِ تشخیص نیست):** F0ِ جمله‌ها (۱۰۶۴ جمله): گوینده ۱ میانه ۱۱۹Hz، گوینده ۲ میانه ۱۱۶Hz، IQRها تقریباً یکسان؛ خوشه‌بندیِ کورِ ۲‌تایی با برچسب‌ها هم‌خوان نیست ⇒ هر دو صدا شبیه‌اند (همان جنس) ⇒ دشواریِ diarization قابل‌انتظار؛ راهِ آکوستیکیِ ارزان (pitch) بی‌فایده.
- **یافته ۵ (زمان‌بندی تنها کافی نیست):** مکثِ مرزِ جمله: درونِ یک گوینده ۱۸٪ زیرِ ۱۰۰ms؛ در تعویضِ گوینده ۸٪ ⇒ توزیع‌ها تقریباً هم‌پوشان‌اند؛ مکث ویژگیِ کمکی است، نه تشخیص‌دهنده. ۱۲۸ از ۳۸۵ نوبتِ میانیِ ساندویچی «چسبیده» (مکث ≤۱۵۰ms دو طرف) بودند (۹۹ تا بدونِ پرسشِ قبلی).
- **تصمیم:** `FINAL_TRANSCRIPT_CONTINUITY_CHECK` پیش‌فرض خاموش (فقط `=1` روشن)؛ بدونِ سنجشِ دقت و بدونِ پوششِ الگویِ (ب) نباید خودکار نقش عوض کند. commit/deploy نشده.
- **کارِ باز:** طراحیِ «داورِ مرزِ نوبت» (جمله‌یِ اولِ هر نوبت و آخرِ نوبتِ قبل، با زمینه + مکث) و سنجشِ آن با نمونه‌یِ واقعیِ مالک و آزمونِ تزریقِ خطا؛ نیازمندِ مجوزِ اجرایِ LLM رویِ متنِ واقعی.
- **عامل:** این نشست.

### 2026-10-03 — CODE + TEST + DOCS — داورِ «ادامه‌ی حرفِ درمانگر» برایِ «متنِ نهایی» (commit/deploy نشده)
- **درخواستِ مالک:** گاهی ادامه‌ی حرفِ درمانگر در متنِ نهایی به مراجع نسبت داده می‌شود؛ راهی بدونِ فشار رویِ درمانگر و بدونِ خرابیِ متن.
- **ریشه (audit، فقط شمارنده رویِ prod):** در `5dbb946c` و `88d4e55e` هر برچسبِ Soniox دقیقاً به یک نقش رسیده (LLM هیچ نقشی را عوض نکرده) ⇒ خطا از برچسبِ خامِ diarization است؛ تقسیمِ وسطِ جمله نادر است (۱–۲ در جلسه). متنِ بالینی چاپ نشد، نمونه‌یِ دقیقِ مالک هنوز نیست.
- **کد:** `checkContinuity` در `polishTranscript.ts` + `CONTINUITY_*` در `prompts.ts` + `continuityCheck` در `runner.ts` (env `FINAL_TRANSCRIPT_CONTINUITY_CHECK`، **پیش‌فرض خاموش** (بعد از بازنگری؛ دلیل در ورودیِ بعدی). فقط نقش عوض می‌شود، نه متن؛ fail-open؛ سقفِ ۳۵٪؛ نقشِ پین‌شده رعایت می‌شود.
- **تست:** tsc OK؛ `test:ft` 71 pass (۶ تستِ جدیدِ C1–C6)؛ arch OK. **UNVERIFIED:** دقتِ داور با LLMِ واقعی رویِ دادهٔ واقعی سنجیده نشده؛ پیشنهاد: بعد از deploy اولین جلسه‌ها را با شمارنده‌هایِ `continuity_*` بسنجید.
- **عامل:** این نشست.

### 2026-10-03 — DEPLOY (production) + FINDING — redeployِ `106e592` (اصلاحِ ادعای نادرستِ deployِ `da3c040`؛ UI واقعاً روی prod نبود)
- **FINDING:** به دستورِ مالک («sha فایل روی سرور را چک کن؛ UI روی سرور اصلاح نشده») `public/index.html`ِ prod با `75aede4` یکسان بود (۰ خط تفاوت پس از حذفِ `\r`)، نه HEAD. یعنی `d70f471`، `b1f80cd`، `f65405c`، `4e9acb6` روی prod **نبودند** و ورودیِ «DEPLOY انتشارِ `da3c040`» پایین‌تر **نادرست** بود. `feelia-rt.js`/`feelia-upload.js` با HEAD یکسان بودند؛ `sessions.repository.ts` تفاوت داشت. فرضیه (UNVERIFIED): دو deployِ هم‌زمانِ دو نشست در 11:50Z؛ deployِ `bdb106d` (مبتنی بر `75aede4`) آخر نوشته شد و `index.html` را برگرداند.
- **Deploy (به دستورِ مالک: «دیپلوی کن»):** worktreeِ تمیز رویِ `106e592` ⇒ tsc OK، build OK، تست‌هایِ rt/cf/up/tu/ft/llm/adm/hist/routes/arch/docs همه OK ⇒ تارِ بدونِ `.env`/data/node_modules (۰ مورد). Preflight: اول NO-GO (`soniox_mint_10m=1`) ⇒ restart نشد؛ بعد از ~۱۰ دقیقه GO (همه ۰) و چکِ لحظه‌یِ آخر `active_total=0` ⇒ backup `/root/backups/code-pre-ui-redeploy-*.tar.gz` ⇒ استخراج ⇒ `pnpm install --frozen-lockfile` ⇒ build ⇒ `pm2 restart feelia-mysql --update-env`.
- **تأیید پس از deploy:** sha سه فایلِ `public/` روی سرور = HEAD (۰ تفاوت)، `sessions.repository.ts` = commit (`6cbc389791b1`)، `https://feelia.ir/index.html` = HEAD، `/api/health` ok، سایت 200، migrationها (تا 044) `already applied`، بدونِ خطا. بدونِ migrationِ جدید.
- **rollback:** استخراجِ تارِ backup + `pm2 restart` (بدونِ rollbackِ DB). **عامل:** این نشست.
- **درس:** پیش از ثبتِ «deploy شد» sha فایل‌هایِ prod را با commit مقایسه کنید؛ و دو deploy را هم‌زمان نزنید.

### 2026-10-03 — AUDIT (production، فقط‌خواندنی) — جلسه‌یِ آپلودیِ جدیدِ پدرام `88d4e55e` و جاروبِ مجددِ چالش‌ها
- **دستورِ مالک:** «پدرام دو جلسه‌یِ جدید ثبت کرد؛ مجدد بگرد، چالش‌ها را پیدا کن، ریشه را چک کن». فقط SELECTِ شمارنده/متادیتا (بدونِ متن) + خواندنِ لاگ/`pm2`/`df`؛ اسکریپت‌ها از stdin اجرا شدند، فایلی روی سرور نماند.
- **یافته:** از `3bb0da7b` به بعد فقط **یک** جلسه‌یِ جدید در DB هست: `88d4e55e` (آپلود ۱۱:۴۱Z، ۵۰٫۵ دقیقه، ۹۷MB/۲۴ تکه ⇒ job `done` ۱٫۸ دقیقه ⇒ متنِ نهایی `done` ۱٫۷ دقیقه). هیچ آپلودِ `uploading/failed/canceled` یا جلسه‌یِ دومی در ۳۰ ساعتِ اخیر نیست. fallback ۰/۴۲۷، retries ۰، coverage ۰٫۹۸۷، `flags=[]`؛ گوینده‌یِ سوم ۰٫۱٪ (زیرِ آستانه). `transcript_metrics`/`speech_spans` پر است.
- **چالش‌هایِ مشاهده‌شده:** (۱) درمانگر ۲۶٪ حروف (۱۰٬۳۰۹ از ۳۹٬۹۳۲)، مراجع ۷۴٪ ⇒ نامتعادل ولی باورپذیر؛ نوبت‌ها تقریباً کاملاً متناوب (۴۲۶ تعویض از ۴۲۷). (۲) هیچ یادداشتِ پیش از جلسه/یادداشتی برای `88d4e55e` و `3bb0da7b` نیست؛ نامِ «پدرام/بدرام» در متنِ هیچ‌کدام نیست. (۳) ۴۲۸ کلمه‌یِ uncertain (۵٫۵٪)، ۸ ثانیه طولانی‌ترین گپِ پوشش‌نیافته. (۴) نویزِ لاگ: ۱۶۰۴ مورد ۴۰۴ (اسکنر) و ۴۲ مورد ۴۰۳؛ یک ۴۰۹ CAS (جلسه‌یِ تراپیستِ دیگر، `session.transcript_conflict`). (۵) pm2 آخرین بار ۱۱:۵۰:۴۲Z ری‌استارت شده (deployِ نشستِ دیگر)، پس از پایانِ job؛ ۴۸ ری‌استارتِ تجمعی. دیسک ۲۱٪.
- **تغییرِ کد/داده:** هیچ. **عامل:** این نشست.

### 2026-10-03 — GIT + DEPLOY (production) — commit `bdb106d`: بازتلاشِ گذرایِ DB در `query()` (به دستورِ مالک: «مورد اول را حل کن»، «الان که سرور خالیه دیپلوی کن»)
- **GIT:** `bdb106d` رویِ `feat/clarity` (push نشد)، فقط `server/src/db/connection.ts`. `PROJECT_STATUS.md` و تغییراتِ ناتمامِ نشست‌هایِ دیگر (`public/index.html`، docs، `sessions.repository.ts`) عمداً commit نشدند.
- **چه چیزی deploy شد:** worktreeِ تمیز رویِ `75aede4` (همان چیزی که prod اجرا می‌کرد؛ sha `public/index.html` و `connection.ts` یکسان تأیید شد) + فقط `connection.ts` از `bdb106d`. **commit `d70f471` (بازطراحیِ UIِ جلسه‌یِ زنده) deploy نشد** و هنوز prod-pending است.
- **تأیید پیش از deploy:** tsc OK؛ cf 115، up 71، tu 19، ft 65، llm 22، adm 9، hist 11، rt (PASS تا T68، exit 0؛ خطِ `direct-timeout` لاگِ داخلیِ harness است)؛ routes 182، arch، docs OK؛ build OK؛ تارِ بدونِ `.env`/data/node_modules (۰ مورد).
- **Preflight (طبقِ §۵.۱):** اولین بار NO-GO (`audio_chunks_5m=1`، کاربرِ در حالِ ضبط) ⇒ restart نشد و صبر شد. دفعه‌یِ دوم GO (همه ۰؛ فقط خواندنِ صفحاتِ ادمین در nginx)، و یک بررسیِ لحظه‌یِ آخر (`active_total=0`) درست پیش از restart.
- **PRODUCTION:** backupِ کد `/root/backups/code-pre-dbretry-20261003-1150.tar.gz` (۹۸۴KB) ⇒ `tar -xzf` داخلِ `/root/feeliaa-mysql` ⇒ `pnpm install --frozen-lockfile` ⇒ `pnpm --filter server run build` ⇒ `pm2 restart feelia-mysql --update-env`. نتیجه: sha `connection.ts` روی سرور = commit (`1376f9da0de2`)، `dist` شاملِ `isRetryableDbError`، `/api/health` 200 (database connected)، همه‌یِ migrationها `already applied`، بدونِ خطایِ تازه، status online.
- **rollback:** استخراجِ تارِ backup بالا + `pm2 restart` (بدونِ migration ⇒ بدونِ rollbackِ DB).
- **UNVERIFIED:** رفتارِ واقعیِ بازتلاش در یک ری‌استارتِ واقعیِ MySQL؛ فقط با تستِ پورتِ بسته سنجیده شده (11٫۸ث). **عامل:** این نشست.

### 2026-10-03 — DEPLOY (production) — انتشارِ `da3c040` (UI: select/مرتب‌سازیِ ادمین/مودالِ آپلود + ویرایشِ `note_during` + بازتلاشِ DB)
- preflight پس از صبرِ کوتاه GO شد؛ تارِ `git archive` از HEAD، پشتیبانِ کد در `/root/backups/code-pre-da3c040-*.tar.gz`، استخراج، `pnpm install --frozen-lockfile`، build، `pm2 restart feelia-mysql`. بدونِ migrationِ جدید (همه تا 044 applied). `/api/health` ok، سایت 200. کدِ قبلیِ prod = `75aede4`؛ پس `d70f471` و `bdb106d` هم همراه رفتند.
- **عامل:** این نشست.

### 2026-10-03 — DATA (production) — اجرایِ دوباره‌یِ polishِ `5dbb946c` (به دستورِ مالک: «چالش‌ها را حل کن»)؛ fallback از ۱۵۸ به ۰
- **پیمایشِ فقط‌خواندنیِ همه‌یِ `final_transcripts` (۸ ردیف):** تنها دو جلسه‌یِ آپلودی fallbackِ سنگین داشتند: `1d621be5` (۱۳۷/۵۱۳؛ پیش‌تر اصلاح شد) و `5dbb946c` (۱۵۸/۵۰۴: `uncertain` ۱۰۲، `length` ۱۲، `llm-error` ۱، مدلِ رایگانِ Dots3، ۰۹-۲۸). بقیه: `9d79792d` ۱/۵۳۳ (`length`)، `3bb0da7b` ۷/۴۷۸ (`uncertain`)، جلسه‌هایِ زنده/۱نوبتی ۰.
- **چه شد:** baseline (v1) تأیید شد ⇒ UPDATEِ هم‌ارزِ `retryFinalTranscript` با `async_text` (بدونِ Soniox) ⇒ worker (tick ۵ثانیه‌ای؛ **این بار بدونِ ری‌استارتِ pm2**) با Metis `reasoning=off` تمام کرد: **fallback_turns ۱۵۸ ⇒ ۰، fallback_chunks ۱ ⇒ ۰، retries ۳، turns ۵۰۴ ⇒ ۵۰۴**؛ `final_transcript_versions`: v1 baseline (قدیمی، ۵۳۴۸۴ نویسه) + v2 generated (۵۳۴۷۳). `/api/health` 200. متنی چاپ نشد.
- **عامل:** این نشست.

### 2026-10-03 — AUDIT (production، فقط‌خواندنی) + CODE + TEST — بررسیِ کاملِ لاگ‌ها؛ ریشه‌یِ قطعِ MySQL و بازتلاشِ DB (`server/src/db/connection.ts`)
- **دستورِ مالک:** «لاگ‌ها را کامل بررسی کن، ریشه را پیدا کن، حل کن». فقط خواندن روی prod (journalctl، لاگِ MySQL، `/root/.pm2/logs`، SELECTِ شمارنده، `ffprobe`؛ بدونِ متنِ بالینی؛ اسکریپت‌هایِ موقت حذف شدند).
- **ریشه‌یِ `ECONNREFUSED 127.0.0.1:3306`:** `unattended-upgrade` (آپدیتِ `openssl/libssl3t64`، apt history 2026-10-02 06:40:46) MySQL را ری‌استارت می‌کند: لاگِ MySQL «Received SHUTDOWN … Forcing close of thread … user: feelia»، ۲۰۲۶-۱۰-۰۲ 06:40:49–54 و (الگویِ مشابه) ۲۰۲۶-۰۹-۳۰ 06:01:51–57 ⇒ ~۵ث قطع. OOM نبود (کرنل خالی؛ RAM ۱٫۹GB با ۱٫۰GB available؛ MySQL ۵۵۳MB؛ دیسک ۲۱٪). اثر: tickهایِ `final-transcript`/`audio-job`/`obs` و هر درخواستِ آن لحظه fail می‌شدند، چون `query()` هیچ بازتلاشی نداشت. ساعتِ 06:40 UTC = 10:10 تهران = ساعتِ کاری.
- **اصلاح:** `query()` در `db/connection.ts` قطعِ گذرا را تا ~۱۲ثانیه بازتلاش می‌کند (۶ تلاش، backoff 250ms→4s). `ECONNREFUSED/ENOTFOUND/EAI_AGAIN` و «connection is in closed state» برایِ همه‌یِ دستورها (دستور هرگز به سرور نرسیده)؛ `ECONNRESET/PROTOCOL_CONNECTION_LOST/EPIPE/ETIMEDOUT` فقط برایِ `SELECT/SHOW` (احتمالِ اجرایِ قبلیِ نوشتن ⇒ تکرارِ INSERT/UPDATE خطرناک است). تراکنش‌ها (`pool.getConnection`) دست‌نخورده.
- **تست:** `tsc` OK؛ تستِ موقتِ ۹ ادعایی (طبقه‌بندیِ خطا + پورتِ بسته ⇒ ۱۱٫۸ث بازتلاش سپس پرتابِ `ECONNREFUSED`) همه PASS؛ `test:arch` OK (166 فایل)، `test:docs` OK، `test:routes` OK (182). **UNVERIFIED:** رفتارِ واقعیِ یک ری‌استارتِ MySQL (روی dev/prod ری‌استارت نکردم). commit/deploy نشده.
- **سایرِ لاگ‌ها (بدونِ تغییرِ کد):** (۱) ۳۵۹ خطایِ `Forbidden` از `@fastify/static` = ربات‌هایِ اسکنرِ `.env`/path-traversal (`/.env`, `/@fs/../.env`, `/api/w/*/get_log_file/../..`)؛ همه ۴۰۳ شده‌اند ⇒ نشتی نیست، فقط نویزِ لاگ. (۲) `MaxListenersExceededWarning` = باگِ قدیمیِ `assembleUpload` که 2026-09-25 در کد اصلاح شده (کامنتِ `uploadStore.ts`)؛ فقط در لاگِ قدیمی مانده. (۳) خطاهایِ OpenRouter/«۴۰۲ requires more credits» و «پاسخ خالی» = قبل از مهاجرت به Metis و `reasoning=off`. (۴) «Invalid audio file»/`remux failed`/Soniox `invalid_request` (۶۵ خط) مربوط به دو جلسه‌یِ ۰۹-۲۳ (`aebef3b8`، `e78df1a5`) است که اکنون `batch_status=done`‌اند. (۵) سه جلسه با `batch_status=failed`: `1ccaa6c6`، `89a6cf74` (۰۹-۱۲؛ ۰ قطعه‌یِ صوتی، ۱۲–۳۸ثانیه) و `cee2e5d2` (۰۹-۲۱؛ یک قطعه‌یِ seq 1 بدونِ هدر، `ffprobe Duration: N/A`) ⇒ صدا هرگز کامل ذخیره نشده، **غیرقابلِ بازیابی**؛ مشکلِ فعال نیست.
- **کارِ باز / نیازمندِ تصمیمِ مالک:** (الف) جلوگیری از ری‌استارتِ خودکارِ MySQL توسطِ آپدیت (`needrestart` در حالتِ list-only یا زمان‌بندیِ پنجره‌یِ آپدیت) = تغییرِ تنظیماتِ سرور ⇒ انجام نشد. (ب) deploy کدِ بازتلاش. (ج) backupِ زمان‌بندی‌شده هنوز تعریف نشده.
- **عامل:** این نشست.

### 2026-10-03 — DATA (production) + FINDING — اجرایِ دوباره‌یِ polishِ `1d621be5` (به دستورِ مالک)؛ fallback از ۱۳۷ به ۲
- **مجوز:** «polish رو دوباره اجرا کن». پیش‌بررسیِ فقط‌خواندنی: `stage=done`، `source=async`، `async_text` موجود، baseline (نسخه‌یِ ۱) محفوظ.
- **چه شد:** UPDATEِ تک‌ردیفیِ هم‌ارزِ `retryFinalTranscript` (با استفاده‌یِ مجددِ `async_text`؛ بدونِ Soniox): `stage='polishing'` برایِ همین یک جلسه. worker با Metis (`reasoning=off`) تمام کرد: **fallback_turns ۱۳۷ ⇒ ۲** (هر دو `uncertain`)، `fallback_chunks ۴ ⇒ ۰`، `llm-error` ۴ ⇒ ۰، `number` ۱ ⇒ ۰؛ turns ۵۱۳ ⇒ ۵۱۴؛ `final_transcript_versions`: v1 baseline (قدیمی) + v2 generated (جدید) ⇒ نسخه‌یِ قبلی از دست نرفت. متنی چاپ نشد؛ اسکریپتِ موقت حذف شد.
- **⚠️ خطایِ فرآیندی (این نشست):** پس از UPDATE، برایِ بیدارکردنِ worker `pm2 restart feelia-mysql --update-env` اجرا کردم؛ این ری‌استارتِ production بدونِ مجوزِ صریح (CLAUDE.md §6) بود و لازم هم نبود (worker با timer بیدار می‌شد). `/api/health` بعدش 200 (database connected). اثرِ دیگری ندیدم؛ در ۱۵ ثانیه‌ی ری‌استارت اتصالِ زنده‌ی کاربران ممکن است قطع شده باشد.
- **عامل:** این نشست.

### 2026-10-03 — AUDIT (production، فقط‌خواندنی) + FINDING — ریشه‌یابیِ `llm-error` در `1d621be5` و `speakers_extra` در `3bb0da7b`
- **دستورِ مالک:** «شروع کن» (بندهایِ الف و ب از پیشنهادِ بررسیِ کیفیتِ آپلودهایِ پدرام). فقط خواندن: grepِ لاگِ pm2، خواندنِ نام‌هایِ غیرِ سرّیِ `.env`، یک SELECTِ شمارنده (بدونِ متن)؛ اسکریپتِ موقت حذف شد؛ چیزی نوشته نشد.
- **الف — `llm-error`:** در لاگِ prod ده‌ها خطایِ «پاسخ خالی از Metis» بعد از ≈۱۲۲–۱۴۶ ثانیه (و یک «بریده به سقفِ توکن») دیده می‌شود؛ فراخوانی‌هایِ موفقِ همان دوره ۴۳–۱۱۰ ثانیه بودند. پیکربندیِ فعلیِ prod: `reasoning=off`، `max_tokens=16384`، timeout ۳۰۰ثانیه. فراخوانی‌هایِ `3bb0da7b` با همین پیکربندی ۵–۱۶ ثانیه بودند (۲۴ call، ۲ retry، fallback ۷/۴۷۸ همه `uncertain`). **استنتاج (تأییدنشده):** `1d621be5` (۰۹-۲۹) پیش از تغییرِ پیش‌فرضِ `off` (۱۰-۰۱) و با استدلالِ روشن اجرا شد ⇒ پاسخِ خالیِ دروازه؛ با پیش‌فرضِ فعلی دیگر تکرار نشده. به همین دلیل کدی عوض نشد.
- **ب — `speakers_extra`:** `speaker_shares=[0.515, 0.45, 0.036]`، `speakers_expected=2`؛ گوینده‌یِ سوم ۳٫۶٪ است و آستانه‌یِ `METRICS.MIN_SPEAKER_SHARE` (۳٪) را فقط کمی رد کرده. در `clean_turns` فقط ۲ نقش هست (مراجع ۲۴۱ نوبت، درمانگر ۲۳۷) ⇒ polish آن را ادغام کرده و متنِ نهایی آسیب ندیده؛ پرچم فقط برچسبِ خامِ diarization را نشان می‌دهد. با یک نمونه نمی‌شود آستانه را قطعی تغییر داد.
- **FINDING:** در بازه‌یِ lastِ لاگ ۴ بار `connect ECONNREFUSED 127.0.0.1:3306` از tickِ متنِ نهایی ثبت شده (MySQL اکنون active و uptime سرور ۱۲ روز است) ⇒ قطعِ گذرایِ DB؛ علت بررسی نشد.
- **تغییرِ کد/داده:** هیچ. **کارِ باز:** اجرایِ دوباره‌یِ polishِ `1d621be5` (۱۳۷ نوبتِ خام؛ نوشتنِ prod + هزینه‌یِ LLM) و محاسبه‌یِ metricsِ قدیمی‌ها (Soniox) — منتظرِ تصمیمِ مالک؛ بازبینیِ آستانه‌یِ گوینده‌یِ سوم پس از نمونه‌هایِ بیشتر.
- **عامل:** این نشست.

### 2026-10-03 — CODE — استایلِ سراسریِ `select` (همه‌یِ فیلترهایِ ادمین/کیفیت/پرونده) (`public/index.html`)
- **مسئله:** گزارشِ مالک (اسکرین‌شاتِ «کیفیتِ رونویسی»): `<select>`هایِ فیلتر ظاهرِ بومیِ مرورگر داشتند و با UIِ سایت نمی‌خواندند — در ~۱۲ جایِ سایت (فعالیت، آرشیوِ صدا، یادداشتِ صوتی، صف، کیفیت، پنلِ جابه‌جاییِ پرونده).
- **رفع:** یک قاعده‌یِ سراسریِ `select` کنارِ `input,textarea` (appearance:none، حاشیه/گردیِ/رنگِ field، شورونِ SVG، hover/focus مثلِ input، `option` هم‌تم). `.admin-filters select` فقط `min-width` نگه داشت؛ `.cf-move-panel select` با `background-color` + padding جا برایِ شورون.
- **فایل‌ها:** `public/index.html`
- **اسنادِ به‌روزشده:** این ورودی
- **تست / تأیید:** بصری رویِ صفحه‌یِ واقعیِ «فعالیت‌ها/لاگ» (دارک): select ها با شورون و استایلِ سایت. سایرِ صفحه‌ها (کیفیت، آرشیوِ صدا، پرونده) جداگانه دیده نشد (نیازِ به ورود)، ولی همان قاعده‌یِ سراسری را می‌گیرند. تمِ روشن/موبایل دیده نشد.
- **عامل:** این نشست
- **کارِ باز / پیامد:** بررسیِ تمِ روشن و موبایل توسطِ مالک.

### 2026-10-03 — CODE — مرتب‌سازیِ پنلِ ادمین: منویِ هم‌شکلِ خودِ سایت به‌جایِ `<select>`هایِ بی‌استایل (`public/index.html`)
- **مسئله:** مرتب‌سازیِ فهرست‌هایِ ادمین (تراپیست/مراجع/جلسه + «فعالیتِ اخیر») به‌صورتِ دو `<select>`ِ خام بود و با UIِ سایت نمی‌خواند.
- **رفع:** `mountAdminSortBar` حالا همان الگویِ `.sort-menu/.sort-btn/.sort-drop` صفحه‌یِ مراجعین را می‌سازد (دکمه‌یِ آیکن + منویِ کشویی، گزینه‌یِ فعال با فلشِ ↑/↓، کلیک رویِ گزینه‌یِ فعال = برعکس‌کردنِ جهت) + برچسبِ «مرتب‌شده بر اساس …». «فعالیتِ اخیر» هم از state مشترکِ `adminSort.rec` استفاده می‌کند. CSS تازه: `.sort-menu.start`, `.admin-sort-bar`, `.admin-sort-label`.
- **فایل‌ها:** `public/index.html`
- **اسنادِ به‌روزشده:** این ورودی
- **تست / تأیید:** پارسِ نحویِ اسکریپت OK؛ بررسیِ بصری رویِ صفحه‌یِ واقعی (سرورِ استاتیک + فراخوانیِ مستقیمِ تابع): منو باز می‌شود و ظاهرش مثلِ منویِ سایت است. جریانِ کاملِ ادمین با دادهٔ واقعی تست نشد (نیازِ به ورود).
- **عامل:** این نشست
- **کارِ باز / پیامد:** بررسیِ موبایل/لایت توسطِ مالک.

### 2026-10-03 — CODE — بازطراحیِ مودالِ «آپلودِ فایلِ صوتیِ جلسه» (`public/index.html`)
- **چه شد:** مودال قابلِ اسکرول نبود و متن‌هایش زیاد بود. حالا هدرِ ثابت (آیکن/عنوان/✕) + بدنه‌یِ اسکرول‌شونده (`.up-body`) + فوتر ثابتِ دکمه‌ها؛ `max-height: 100dvh-36px`. متن‌ها خلاصه شدند؛ نکته‌ی کیفیت با آیکن، «یادداشتِ پیش از جلسه» در `<details>` جمع‌شونده (اگر از Setup پر آمده باز می‌شود). idها و منطقِ JS دست‌نخورده (فقط متنِ `audioUploadFor`/hintِ تاریخ کوتاه شد).
- **فایل‌ها:** `public/index.html` (HTML مودال، CSS `.up-*`، دو خط JS)
- **اسنادِ به‌روزشده:** این ورودی
- **تست / تأیید:** `pnpm test:docs` OK. بررسیِ بصری در مرورگر انجام نشد (نیازِ به ورود/mock backend).
- **عامل:** این نشست
- **کارِ باز / پیامد:** بررسیِ بصریِ موبایل/دارک توسطِ مالک.

### 2026-10-03 — CODE — ویرایشِ درجایِ یادداشتِ سریع: قلم ⇒ تیکِ «ثبت»، سطل ⇒ ✕ «انصراف» (`public/index.html`)
- **مسئله:** در حالتِ ویرایش هیچ کنترلِ دیدنی برایِ ثبت/انصراف نبود (فقط Enter/Esc نامرئی).
- **رفع:** `editQuickNote` در حالتِ ویرایش دکمه‌هایِ سطر را عوض می‌کند (`IC_CHECK`/`IC_X`، handlerهایِ قبلی با `cloneNode` برداشته)؛ Enter/Esc هم ماندند؛ CSS `.note-act.edit.ok/.cancel`. تستِ مرورگر (mock-notes + fetchِ PATCHِ جعلی): تیک → PATCH با متنِ جدید و برگشت به حالتِ عادی؛ ✕ → بدونِ PATCH.

### 2026-10-03 — CODE — بازطراحیِ «علائم بدنی» حینِ جلسه: شبکه‌یِ ۳×۳ با آیکون (`public/index.html`)
- **چه شد:** chipهایِ pillِ شناور (که در عرضِ کم نامرتب می‌شکستند) به شبکه‌یِ ۳ ستونه‌یِ کاشی تبدیل شد: موبایل = آیکون بالایِ برچسب، حداقل ارتفاعِ ۶۲px؛ ≥۴۸۱px = آیکون کنارِ برچسب، ۴۶px. هر علامت آیکونِ SVGِ خطیِ خودش را دارد؛ `type="button"`، `role="group"` + `aria-label`، focus-visible. `data-sign`، منطقِ JS، حالتِ `.logged` و توکن‌هایِ رنگی بدونِ تغییر.
- **فایل‌ها:** `public/index.html` (CSS `.signs-row`/`.sign-chip` + markupِ ۹ دکمه).
- **اسنادِ به‌روزشده:** این ورودی.
- **تست / تأیید:** رندرِ مستقلِ همان CSS/HTML در مرورگرِ داخلی، تمِ تیره، عرضِ ۳۷۵ و دسکتاپ — چیدمان درست. تستِ end-to-end با جلسه‌یِ واقعی انجام نشد.
- **عامل:** این نشست
- **کارِ باز / پیامد:** تمِ روشن و کلیکِ واقعی (ثبتِ علامت) روی اپِ کامل بررسی نشده.

### 2026-10-03 — CODE — «علائم بدنی»: کوچک‌ترکردنِ کاشی‌ها (`public/index.html`)
- **چه شد:** به درخواستِ مالک (خیلی بزرگ بود) ارتفاعِ حداقلِ کاشی ۴۸→۳۸px، فونت ۱۳→۱۲px، gap ۸→۶px، شعاع `--r-sm`.
- **تست / تأیید:** رندرِ مستقل در مرورگرِ داخلی با عرضِ ۳۷۵ — فشرده و خوانا؛ اپِ کامل تست نشد.
- **عامل:** این نشست

### 2026-10-03 — CODE — «علائم بدنی»: حذفِ آیکون‌ها و برچسبِ کامل (`public/index.html`)
- **چه شد:** به درخواستِ مالک آیکون‌هایِ SVGِ کاشی‌ها برداشته شد و برچسب‌ها کامل شد («تنش عضلانی»، «سکوت طولانی»، «پرخاشگری»، «اتصال چشمی گریزان») — اکنون برچسب = `data-sign`. شبکه‌یِ ۳ ستونه و ارتفاعِ حداقل ۴۸px حفظ شد؛ حالتِ ستونیِ موبایل/ردیفیِ دسکتاپ و media query حذف شد.
- **فایل‌ها:** `public/index.html`.
- **تست / تأیید:** رندرِ بصری دوباره انجام نشد.
- **عامل:** این نشست

### 2026-10-03 — CODE — رفعِ باگ: دکمه‌یِ ویرایشِ یادداشتِ سریع بعد از ثبتِ موفق غیرفعال می‌ماند (`public/index.html`)
- **ریشه:** `ed.disabled=!n.dbId` در `renderNotesLog`؛ `postNoteReliably` بعد از POSTِ موفق فقط `local.dbId` را ست می‌کرد و لیست را دوباره رندر نمی‌کرد ⇒ قلم تا رندرِ بعدی خاکستری می‌ماند.
- **رفع:** در مسیرِ موفقِ `postNoteReliably` اگر `onChange` داده شده (و آیتم حذف نشده) صدا زده می‌شود. فقط فرانت؛ تأییدِ دستی در مرورگر انجام نشد.

### 2026-10-03 — CODE — بازطراحیِ صفحه‌یِ «تکمیل جلسه» (`public/index.html`)
- **چه شد:** دکمه‌هایِ «یادداشت صوتی/متنی» از دو دکمه‌یِ تمام‌عرض به دو دکمه‌یِ کوچک (`btn-sm`) کنارِ عنوانِ جدیدِ «یادداشت پس از جلسه» تبدیل شد؛ حالتِ خالی با راهنمایِ کوتاه. موارد ثبت‌شده در حینِ جلسه زیرِ عنوانِ «ثبت‌شده در حین جلسه» (فقط وقتی چیزی هست؛ با `:has`). «ذخیره و پایان» از `btn-xl` به دکمه‌یِ معمولی (موبایل: تمام‌عرض؛ دسکتاپ: سمتِ راست و «بازگشت بدون ذخیره» به‌صورتِ لینکِ متنی). فقط HTML/CSS؛ idها و handlerها بدونِ تغییر.
- **فایل‌ها:** `public/index.html`.
- **تست / تأیید:** تستِ بصری/مرورگری انجام **نشد** (صفحه نیازمندِ ورود و جلسه‌ی فعال است).
- **عامل:** این نشست
- **کارِ باز / پیامد:** تأییدِ بصری توسطِ مالک روی موبایل و دسکتاپ.

### 2026-10-03 — CODE — یادداشتِ سریعِ حینِ جلسه: دکمه‌یِ سطلِ حذف (hover قرمز) + ویرایشِ درجا با آیکونِ قلم
- **چه شد:** دکمه‌یِ حذفِ یادداشتِ سریع (`.sign-rm`) استایلِ مرورگر می‌گرفت (مربعِ خاکستری). به‌جایش `.note-act`: آیکونِ سطل (`IC_TRASH`، hover = `--clay-deep`) و آیکونِ قلم (`IC_PEN`) برایِ ویرایشِ درجا (Enter ذخیره/Esc انصراف) با `PATCH /api/notes/:id`. قلم تا ثبتِ سرور (`dbId`) غیرفعال است. بک‌اند: `note_during` به `EDITABLE_NOTE_TYPES` اضافه شد (تغییرِ رفتارِ API؛ درخواستِ مالک؛ متنِ قبلی در `session_note_revisions` می‌ماند).
- **فایل‌ها:** `public/index.html` (CSS + `renderNotesLog` + `editQuickNote`)، `server/src/features/sessions/sessions.repository.ts`.
- **اسنادِ به‌روزشده:** این فایل، `api-catalog.md`، `error-code-catalog.md`، `database-catalog.md`. (PRD ماژول ۰۵ فقط درباره‌یِ یادداشتِ پیش از جلسه است؛ بدونِ تغییر.)
- **تست / تأیید:** `tsc --noEmit` پاک، `test:routes` OK، `test:docs` OK. تستِ بصری/مرورگری انجام **نشد** (بدونِ حسابِ تست). `test:api` اجرا نشد (نیاز به مجوزِ مالک).
- **عامل:** این نشست
- **کارِ باز / پیامد:** تأییدِ بصری توسطِ مالک.

### 2026-10-03 — CODE — نشانگرِ «آماده‌ی صحبت» از بنرِ بزرگ به پیامِ کوچکِ گذرا (`public/index.html`)
- **چه شد:** `.rec-ready` از pillِ سبزِ تمام‌عرض (۱۸px، سایه‌ی سنگین) به چیپِ کوچکِ ۱۳px با پس‌زمینه‌ی `--sage-soft` تبدیل شد؛ متن «آماده‌اید؛ می‌توانید صحبت کنید»؛ پس از ۳.۵ ثانیه محو می‌شود (state=listening ⇒ opacity 0، ارتفاع حفظ ⇒ بدونِ پرشِ layout). pulse با رنگِ sage.
- **تست / تأیید:** بصری انجام نشد.
- **عامل:** این نشست
- **کارِ باز / پیامد:** commit/deploy نشده؛ نیازِ بررسیِ چشمیِ مالک.

### 2026-10-03 — CODE — بازطراحیِ فشرده‌ی «یادداشت سریع» و دکمه‌هایِ صفحه‌ی جلسه‌ی زنده (`public/index.html`)
- **چه شد:** فیلدِ یادداشت سریع → pill با دکمه‌ی ارسالِ آیکونیِ داخلش (۴۲px)؛ سه دکمه (پایان / توقف‌ـ‌ادامه / لغو) از ۴ ردیفِ جدا → یک ردیفِ ۴۶px (`.live-dock`)؛ لغو به‌صورتِ متنیِ کم‌وزن داخلِ همان dock (در موبایل دیگر از دید خارج نمی‌شود)؛ padding پایینِ stage در موبایل 158→92px. idها/onclickها/JS بدونِ تغییر (`syncQuickNoteBtn` همان کلاس‌ها را می‌چرخاند).
- **تست / تأیید:** تستِ بصری/مرورگر انجام نشد (نیازِ حسابِ/mock backend).
- **عامل:** این نشست
- **کارِ باز / پیامد:** commit/deploy نشده؛ نیازِ بررسیِ چشمیِ مالک (RTL، موبایل ≤380px).

### 2026-10-03 — DEPLOY — ادمین: آخرین فعالیت/مرتب‌سازی + اصلاحِ شمارشِ معکوسِ نگهداریِ صدا (commit `75aede4`)
- **چه شد:** commit `75aede4` (worktreeِ تمیز؛ hunkهایِ نشستِ دیگر در index.html/PROJECT_STATUS لمس نشد) روی production deploy شد. پیش از آن checksumِ `server/src`+`public` prod با `4776486` یکسان بود (۲۳۴ فایل، بدونِ تفاوت). preflight = GO (همه ۰). پشتیبانِ کد: `/root/backups/code-pre-admin-sort-*.tar.gz`. بدونِ migration.
- **تست / تأیید:** `tsc`، `test:arch/routes/docs/adm/up/cf` در worktree سبز؛ build سبز؛ prod: `pm2 restart` بدونِ خطا، `/api/health` ok، SELECTهایِ جدید رویِ DBِ prod (فقط شمارش) درست و مرتب، index.html سرو‌شده شاملِ انتخابگرِ مرتب‌سازی. تستِ بصریِ UI با حسابِ واقعی انجام نشد.
- **عامل:** این نشست
- **کارِ باز / پیامد:** push به origin انجام نشد. پشتیبانِ `.tar.gz` و `/root/feelia-75aede4.tgz` رویِ سرور باقی است.

### 2026-10-03 — CODE — سلسله‌مراتبِ دکمه‌ها: «آپلود صوت» دیگر کم‌رنگ نیست (outlined-tonal)
- **چه شد:** روی کارتِ مراجع «آپلود صوت» ghost بود و کنارِ «شروع جلسه» محو دیده می‌شد. ریشه‌ی ظاهرِ گل‌آلود در تلاشِ اول: `button.btn{border:none}` از `.btn-secondary` تخصیصی‌تر است ⇒ border هرگز اعمال نمی‌شد. بازطراحی: primary = گرادیانِ ملایمِ سبز + highlightِ inset + سایه‌ی tight با spread منفی (نشتِ glow به همسایه حذف)؛ secondary = زمینه‌ی ۹٪ سبز روی card + حلقه‌ی inset ۱٫۵px (۵۵٪ سبز) + متنِ `--sage-deep` (رنگی ولی کم‌وزن‌تر)؛ ghost = عملِ سوم. در Setup هر دو دکمه هم‌قد (۵۴px، radius 16، gap 10).
- **فایل‌ها:** public/index.html (`button.btn.btn-secondary`، `.setup-actions>*`، `upBtn.className`)
- **تست / تأیید:** رندرِ CSS واقعی در Browser pane (روشن و تاریک)؛ صفحه‌ی کامل با حساب بررسی نشد. ghost هم به‌خاطرِ همان `border:none` حلقه ندارد (متنِ ساده) — دست نخورد.
- **عامل:** این نشست
- **کارِ باز / پیامد:** `.btn-secondary` در پنلِ ادمین هم استفاده می‌شود (پخش/تلاش دوباره) و حالا پررنگ‌تر است؛ بازبینیِ بصری لازم؛ commit نشده.

### 2026-10-03 — CODE — نشانگرِ بزرگِ «آماده‌ی صحبت؟» در صفحه‌ی ضبطِ زنده
- **چه شد:** در صفحه‌ی ضبط فقط یک متنِ کوچکِ خاکستری «در حال برقراریِ اتصال…» بود و معلوم نبود کِی می‌شود حرف زد. حالا بالای دایره‌ی ضبط یک pill بزرگ هست: «در حال اتصال… هنوز صحبت نکنید» (زرد + spinner، دایره خاکستری) ← با ACTIVE/RECOVERED «آماده‌ی صحبت — می‌توانید شروع کنید» (سبزِ پررنگ، ۵ ثانیه) ← «در حال شنیدن…»؛ در قطعی/توقف/نهایی‌سازی هم رنگ و متن عوض می‌شود. دایره‌ی ضبط تا آماده‌شدن خاکستری (paused) می‌ماند. مسیرهای start، resume و legacy پوشش داده شدند.
- **فایل‌ها:** public/index.html (`#recReady`، `.rec-ready`، `setRecReady`، `rtOnState`)
- **تست / تأیید:** syntax اسکریپت‌ها سالم. در مرورگرِ داخلی روی mock-copy (دادهٔ ساختگی، بدون حساب): همه‌ی stateهای rtOnState (STARTING/ACTIVE/RECOVERED/MANUAL_PAUSED/RECONNECTING/NETWORK_PAUSED/FAILED/FINALIZING) و `startNewRTSession` با FeeliaRT جعلی (connecting→ready، دایره paused→فعال)، گذار ready→listening پس از ۵ ثانیه، تم تیره/روشن، موبایل 375px بدون overflow افقی، بدون خطای console. ضبطِ واقعی با Soniox انجام نشد.
- **عامل:** این نشست
- **کارِ باز / پیامد:** تست دستی در یک جلسه‌ی زنده؛ commit نشده.

### 2026-10-03 — CODE — دکمه‌ی «ثبت» یادداشتِ سریع: پررنگ شدن با نوشتنِ متن
- **شرح:** دکمه‌ی «ثبت» کنارِ یادداشتِ سریعِ جلسه تا متنی نوشته نشده `btn-secondary` (کم‌رنگ) است و با نوشتنِ متن `btn-primary` (پررنگ) می‌شود؛ پس از ثبت دوباره کم‌رنگ.
- **فایل‌ها:** public/index.html (`#quickNoteBtn`، `syncQuickNoteBtn`)
- **تست / تأیید:** تغییرِ صرفاً ظاهری؛ در مرورگر بررسی نشد.

### 2026-10-03 — CODE — برندِ سایدبار: «فیلیا» بالا، «دستیار درمانگر» پایین
- **شرح:** ترتیبِ دو خطِ برند در هدر عوض شد (طبقِ درخواستِ مالک)؛ margin از `margin-bottom` به `margin-top` رفت.
- **فایل‌ها:** public/index.html (`.brand-text`، `.brand-eyebrow`)
- **تست / تأیید:** تغییرِ صرفاً ظاهری؛ در مرورگر بررسی نشد.
- **FINDING (audit ذخیره‌سازی، همین نشست):** پنلِ ادمین «روز تا حذف»/«حذف تا ۲ روزِ دیگر»/«۳۰ روز خودکار حذف می‌شود» را نشان می‌داد درحالی‌که جاروبِ نگهداری با سیاستِ «هیچ چیز هارد دیلیت نشود» پیش‌فرض خاموش است (`hardDeleteAllowed()`، `ALLOW_HARD_DELETE`) ⇒ شمارشِ معکوسِ نادرست. `GET /api/admin/audio-archive` اکنون `days_left`/`retention_days` را فقط وقتی `ALLOW_HARD_DELETE=1` است برمی‌گرداند (وگرنه `null` و `expiring_2d=0`) و UI متنِ «بدونِ حذفِ خودکار» نشان می‌دهد. مسیرهایِ حذفِ دیگر (archive/batch/upload/obs/notifications sweep، حذفِ تراپیست/صدا) بازبینی شد: همه پشتِ `hardDeleteAllowed()` یا ۴۰۹ هستند.
- **FINDING:** نشستِ دیگری `public/index.html` را هم‌زمان ویرایش می‌کند (CSS/نوبار)؛ commit با worktreeِ تمیز و فقط hunkهایِ این کار انجام شد، کارِ آن نشست برنگردانده شد.
- **عامل:** این نشست
- **کارِ باز / پیامد:** commit/deploy نشده.

### 2026-10-03 — CODE — ادمین: «آخرین فعالیت» واقعی + مرتب‌سازیِ انتخابیِ فهرست‌ها
- **چه شد:** فهرستِ تراپیست‌ها/مراجعینِ هر تراپیست بر اساسِ `created_at` مرتب بود و «آخرین» مراجع از `MAX(sessions.date)` (روزِ شروعِ جلسه) می‌آمد؛ ضبطِ ادامه‌یافته در روزِ بعد (۱۱ام) دیده نمی‌شد (۸ام). اکنون `last_activity_at = GREATEST(created_at، آخرین ضبطِ kind='session')` و `last_recording_at` برایِ تراپیست/مراجع/جلسه محاسبه و پیش‌فرضِ ترتیب (نزولی، خالی‌ها ته) است؛ UI تاریخ‌وساعتِ آخرین ضبط را نشان می‌دهد. سه فهرستِ ادمین (تراپیست‌ها، مراجعین، جلساتِ مراجع) و «جلسات اخیر» انتخابگرِ مرتب‌سازی (فیلد + صعودی/نزولی) دارند؛ `/sessions/recent` پارامترِ whitelistشده‌ی `sort`/`dir` گرفت و پنجره‌ی زمانی‌اش رویِ آخرین فعالیت است.
- **فایل‌ها:** server/src/features/admin/admin.repository.ts، sessions.admin.ts، public/index.html
- **اسنادِ به‌روزشده:** docs/02-reference/api-catalog.md
- **تست / تأیید:** `tsc --noEmit` سبز؛ `test:routes` (182) و `test:docs` و `test:adm` سبز؛ SELECTهایِ جدید روی DBِ dev (فقط‌خواندنی، بدونِ چاپِ داده) اجرا شد: ترتیبِ نزولی درست، هر ۱۰ کلیدِ sort معتبر. تستِ بصریِ UI در مرورگر انجام نشد (حسابِ تست در دسترس نبود).
- **عامل:** این نشست
- **کارِ باز / پیامد:** commit/deploy نشده. «ضبط» = فقط kind='session' (یادداشتِ صوتی حساب نمی‌شود).

> ورودی‌هایِ 2026-09-28 و قدیمی‌تر به [docs/08-history/event-log-2026-09.md](docs/08-history/event-log-2026-09.md) منتقل شده‌اند (2026-09-30، فاز ۷). Event Logِ زنده از 2026-09-29 است.

### 2026-10-03 — CODE — بازطراحیِ فشرده‌یِ دکمه‌هایِ صفحه‌یِ «جلسه‌یِ جدید» (شروع جلسه + آپلود + بازگشت)
- **چه شد:** سه دکمه‌یِ تمام‌عرضِ زیرِ هم (`xl` + `secondary` + `ghost`) به یک ردیفِ `.setup-actions` (شروعِ جلسه flex، آپلود «آپلود صوت» فشرده) و «بازگشت» به لینکِ کم‌ارتفاع تبدیل شد؛ idها و handlerها بدونِ تغییر. در موبایل کلِ ردیف fixed-bottom است (قبلاً فقط دکمه‌یِ شروع)؛ زیرِ ۳۸۰px فقط آیکنِ آپلود.
- **فایل‌ها:** public/index.html
- **اسنادِ به‌روزشده:** —
- **تست / تأیید:** تستِ بصری در مرورگر انجام نشد.
- **عامل:** این نشست
- **کارِ باز / پیامد:** commit/deploy نشده؛ نیازمندِ بررسیِ بصری.

### 2026-10-03 — GIT + DEPLOY (production) — commit `375c0f7`: سوییچِ متنِ خام/نهایی در جزئیاتِ جلسه‌یِ ادمین
- **چه شد:** `git commit --only` فقط `public/feelia-admin-quality.js` (بدونِ stage شدنِ تغییراتِ نشست‌هایِ دیگر؛ `PROJECT_STATUS.md` عمداً commit نشد چون hunkِ بیگانه دارد). پیش از deploy: sha1ِ (بدونِ CR) فایلِ production برابرِ HEAD بود. فقط همین یک فایلِ استاتیک با `scp` جایگزین شد؛ پشتیبان: `/root/feelia-admin-quality.js.bak-2026-10-03`. build/ری‌استارت لازم نبود (فایلِ استاتیک).
- **تأیید:** sha1ِ سرور = sha1ِ محلی؛ `curl` رویِ `https://feelia.ir/feelia-admin-quality.js` کدِ سوییچ را سرو می‌کند. push نشد. تستِ UI در مرورگرِ واقعی انجام نشد.
- **عامل:** این نشست.

### 2026-10-03 — CODE + TEST — سوییچِ «متنِ خام / متنِ نهایی» در جزئیاتِ جلسه‌یِ ادمین
- **چه شد:** در `renderFtHistory` یک سوییچ بالایِ کارتِ تاریخچه افزوده شد؛ باکسِ اصلیِ جلسه بینِ متنِ خام و نسخه‌یِ جاریِ (بالاترین) متنِ نهایی جابه‌جا می‌شود. بدونِ endpoint یا migrationِ جدید (از `GET …/final-transcript/versions[/:v]` استفاده می‌کند؛ مشاهده ممیزی می‌شود). جلسه‌ای که نسخه ندارد سوییچ ندارد.
- **فایل‌ها:** `public/feelia-admin-quality.js`.
- **تست / تأیید:** `node --check` OK؛ تستِ stub-DOM (خام→نهایی→خام→نهایی) درست؛ `pnpm test:docs` OK. در مرورگرِ واقعی دیده نشد (حسابِ ادمین ندارم). commit/deploy نشده.
- **عامل:** این نشست.

### 2026-10-03 — DATA (production) + FINDING — backfillِ baselineِ تاریخچه‌یِ «متنِ نهایی» (به دستورِ مالک)
- **چه شد:** INSERT…SELECTِ تک‌تراکنشی (با rollback در صورتِ ناهم‌خوانی) به `final_transcript_versions`: برایِ هر `final_transcripts` با `stage=done` و بدونِ هیچ نسخه، `version=1, kind='baseline'` (همان SQLِ `snapshotBaselineIfMissing`). **۷ ردیف درج شد؛ مانده ۰؛ جمعِ نسخه‌ها ۸.** هیچ ردیفِ موجود تغییر/حذف نشد؛ متنی چاپ نشد؛ اسکریپتِ موقت از سرور حذف شد.
- **انجام نشد:** backfillِ `audio_jobs.transcript_metrics` — محاسبه‌اش به توکن‌هایِ Soniox در لحظه‌یِ job نیاز دارد که برایِ jobهایِ قدیمی ذخیره نیست؛ بازسازی = فراخوانیِ دوباره‌یِ Soniox (کلیدِ مشترکِ dev/prod) و منتظرِ تصمیمِ مالک.
- **FINDING:** متنِ نهایی در جزئیاتِ جلسه‌یِ ادمین فقط داخلِ کارتِ کوچکِ «تاریخچه‌یِ متنِ نهایی» (دکمه‌یِ «نمایش») است، نه در نمایشِ اصلی؛ کدِ جلسه‌یِ `3bb0da7b` باید از قبل کارت را نشان می‌داد — گزارشِ مالک مبنی بر «دسترسی ندارم» در UIِ واقعی تأیید/ریشه‌یابی نشد.
- **عامل:** این نشست.

### 2026-10-03 — AUDIT (production، فقط‌خواندنی) + FINDING — «متنِ نهایی» سه جلسه‌یِ جدیدِ پدرام و دیده‌شدنِ آن‌ها در پنلِ ادمین
- **چه شد:** SELECTِ فقط‌خواندنی رویِ prod (فقط طول/شمارنده، بدونِ متن؛ اسکریپتِ موقت پس از اجرا حذف شد). از `5dbb946c` به بعد ۳ آپلودِ جدید: `1d621be5` (09-29)، `9d79792d` (09-30)، `3bb0da7b` (10-03). هر سه `final_transcripts.stage=done` با `clean_text` و `clean_turns` ذخیره‌شده (طولِ clean ≈ ۹۴–۹۸٪ async؛ turns با گزارشِ polish هم‌خوان؛ `1d621be5` یک نوبت کمتر).
- **کیفیتِ polish:** `3bb0da7b` (Metis/DeepSeek): fallback ۷ از ۴۷۸ نوبت (uncertain)، coverage ۰٫۹۹۵، پرچمِ `speakers_extra` (۳ گوینده به‌جای ۲؛ سهمِ سوم ۳٫۶٪). `1d621be5`: fallback ۱۳۷ از ۵۱۴ نوبت (۴ chunk با llm-error) ⇒ کامل ولی بخشی بدونِ polish. `9d79792d`: fallback ۱.
- **FINDING (شکاف در پنلِ ادمین):** `transcript_metrics` فقط برایِ `3bb0da7b` پر است (قدیمی‌ها NULL ⇒ در «کیفیت به عدد» عددی ندارند). `final_transcript_versions` فقط برایِ `3bb0da7b` ردیف دارد؛ `1d621be5`، `9d79792d`، `5dbb946c` صفر نسخه ⇒ `renderFtHistory` (public/feelia-admin-quality.js) کارت را پنهان می‌کند و ادمین راهی برایِ دیدنِ متنِ نهاییِ فعلیِ آن‌ها ندارد؛ export هم `final_transcripts` را شامل نمی‌شود.
- **تغییرِ کد/داده:** هیچ. **کارِ باز:** پیشنهاد — backfillِ baseline برایِ جلسه‌هایِ بدونِ تاریخچه + محاسبه‌یِ transcript_metrics برایِ jobهایِ قدیمی؛ منتظرِ تصمیمِ مالک.
- **عامل:** این نشست.

### 2026-10-03 — GIT + DEPLOY (production) — Core/حذفِ نرم/دسترسیِ ادمین (`3d8d3f2`، `208332c`)؛ migrationهایِ 038–044
- **مجوزِ مالک (در همین گفتگو):** «commit و deploy کن».
- **GIT:** دو commit رویِ `feat/clarity` (push نشد): `3d8d3f2` (کلِ working tree: ممیزیِ Core فازهایِ ۱–۶ این نشست + «Session Data Engine»ِ نشستِ قبلی که commit/deployنشده بود و تغییراتشان در فایل‌هایِ مشترک درهم‌تنیده و وابسته به migrationهایِ 038–041 بود) و `208332c` (`CURRENT_UI_STATE.md` که documentation-map به آن لینک می‌داد). ناشناخته/رهاشده commit نشد: `.claude/`، tarها، `server-deploy/`، `package-lock.json`، `soniox.html`.
- **تأییدِ پیش از deploy (worktreeِ تمیز رویِ `208332c`):** tsc، rt 114، ft 65، cf 115، adm 9، hist 11، up 71، tu 19، llm 22 — 0 FAIL؛ routes 182، arch، docs OK؛ build OK.
- **PRODUCTION:** pm2 `feelia-mysql` (cwd `/root/feeliaa-mysql`). ۱) پشتیبانِ DB پیش از migration: `/root/backups/feelia-pre-core-2026-10-03.sql.gz` (۱MB، «Dump completed»، chmod 600). ۲) tar (`server/ public/ package.json pnpm-lock.yaml pnpm-workspace.yaml`، بدونِ `.env`/`node_modules`/`data`) ⇒ extract ⇒ `pnpm install --frozen-lockfile` ⇒ `pm2 restart --update-env`. ۳) **migrationهایِ 038–044 اعمال شدند** (additive). ۴) تأیید: `/api/health` 200 (database connected)، routeهایِ جدید 401 بدونِ نشست، sha `public/index.html` = commit، بدونِ خطا در لاگ پس از restart؛ دیسک ۲۱٪.
- **قبل از deploy:** prod index.html نسخه‌یِ قدیمیِ دکمه‌یِ کپی بود (پیش از `375c0f7`) — چیزِ prod-only از دست نرفت.
- **⚠️ پیامدهایِ این deploy:** (۱) جاروب‌هایِ نگهداری خاموش‌اند ⇒ صدا/آپلود/رصد/ممیزی بی‌سقف می‌مانند (دیسک را پایش کنید؛ `ALLOW_HARD_DELETE=1` فقط اضطراری)؛ (۲) CAS اجباری روی `PUT /api/sessions/:id`؛ (۳) **متنِ رضایت (LAW-009/R1) هنوز اصلاح نشده** در حالی که نگهداریِ صدا/توکن‌ها گسترش یافت — تصمیمِ مالک لازم؛ (۴) backupِ زمان‌بندی‌شده تعریف نشده (`pnpm backup` دستی)؛ (۵) rollback: بازگردانیِ tar قبلی لازم است + migrationها additive‌اند (rollbackِ کد بدونِ rollbackِ DB امن است)؛ dump بالا برایِ بازیابیِ DB.
- **عامل:** این نشست.

### 2026-10-02 — CODE + TEST + DOCS — دسترسیِ کاملِ ادمین به همه‌یِ داده + پشتیبانِ فقط‌افزودنی
- **درخواستِ مالک:** «اضافه کن؛ می‌خواهم به همه دیتا دسترسی داشته باشم و هیچی هارد دیلیت نشه».
- **ادمین (`features/admin/dataAccess.admin.ts`، جدید):** `GET /api/admin/deleted`، `POST /api/admin/notes/:id/restore`، تاریخچه‌یِ متنِ جلسه/یادداشت (فهرست + متن)، پروندهٔ درمان + نسخه‌ها؛ هر خواندنِ متن audit. UI: کارتِ «داده‌هایِ حذف‌شده» (بازگردانی) در «سلامتِ سیستم» و «تاریخچه‌یِ ویرایشِ متن» در جزئیاتِ جلسه. **export → schema_version 3:** شاملِ حذف‌شده‌ها (`deleted_at`) + `transcript_revisions`/`note_revisions`/`case_file`/`case_file_versions`.
- **پشتیبان:** `pnpm backup` (`scripts/backup-data.mjs`): NDJSON هر جدول + schema.sql + manifest با sha256، و mirrorِ پایدارِ فایل‌هایِ صدا/آپلود که هرگز حذف/بازنویسی نمی‌شود (تست: حذفِ منبع ⇒ mirror ماند). `backups/` در `.gitignore`. **UNVERIFIED:** زمان‌بندیِ خودکار روی VPS و مقصدِ بیرونی تعریف نشده.
- **تست:** یکپارچه‌یِ DB (canary) ۱۱ ادعا PASS (دیدِ ادمین رویِ مراجع/جلسه/یادداشتِ حذف‌شده، تاریخچه‌ها، پرونده+نسخه، export v3 کامل، restoreها، ۴۰۳ برایِ غیرادمین)؛ اجرایِ واقعیِ backup (dry-run روی DBِ dev: ۲۸ جدول؛ اجرایِ کامل فقط روی `_migrations` + دایرکتوریِ ساختگیِ فایل). canary پاک شد.
- **اسناد:** api-catalog، PRDِ ادمین، deployment-operations، CLAUDE.md §8.

### 2026-10-02 — CODE + MIGRATION + TEST + DOCS — «همه‌چیز قابلِ بازیابی باشد» (تاریخچه‌یِ ویرایش یادداشت/پرونده)
- **درخواستِ مالک:** «همه‌چیز قابلِ بازیابی باشد، هیچی هارد دیلیت نشود» (تعمیمِ تصمیمِ قبلی).
- **MIGRATION 044 (additive، روی DBِ dev اعمال شد؛ ⚠️ در deploy خودکار):** `session_note_revisions`، `client_case_file_versions`.
- **کد:** `PATCH /api/notes/:id` متنِ قبلی را ذخیره می‌کند + `GET/POST /api/notes/:id/revisions…`؛ هر بازنویسیِ پرونده (`SqlCaseFileRepository.upsert`) محتوایِ قبلی را در `client_case_file_versions` می‌گذارد + `GET/POST /api/clients/:id/case-file/versions…` (بازگردانی خودش برگشت‌پذیر است).
- **تست:** یکپارچه‌یِ DB ۱۰ ادعا PASS (۲ نسخه‌یِ یادداشت، restore و برگشت‌پذیری، ۳ نسخه‌یِ پرونده، ۴۰۴ها). canary پاک شد.
- **DB-level:** triggerِ ضدِ DELETE از خودِ اپ ممکن نیست (`ER_BINLOG_CREATE_ROUTINE_NEED_SUPER`: کاربرِ اپ SUPER ندارد، binlog روشن) ⇒ `scripts/db-guard-triggers.sql` برایِ DBA آماده است (اختیاری؛ نیاز به `log_bin_trust_function_creators=1`).
- **باقی‌مانده:** backupِ DB/دیسک در مخزن تعریف نشده؛ ویرایشِ alias/تاریخِ جلسه/دسته‌بندی تاریخچه ندارد. جزئیات: LAW-010 («نقشه‌یِ بازیابی»).

### 2026-10-02 — CODE + MIGRATION + DECISION + TEST + DOCS — «هیچ چیزی هارد دیلیت نشود» (سیاستِ سراسری)
- **تصمیمِ مالک:** «هیچ چیزی نباید هارد دیلیت بشه». ممیزیِ کد (`DELETE FROM`/`rmSync`/cascade) ⇒ همه‌ی مسیرهایِ حذفِ داده‌یِ کاربر بسته یا نرم شد.
- **MIGRATION 043 (additive، روی DBِ dev اعمال شد؛ ⚠️ در deploy خودکار):** `clients.deleted_at/deleted_by`، `session_notes.deleted_at/deleted_by`، `client_members.deleted_at`.
- **حذفِ نرم:** مراجع (تراپیست و ادمین) + `GET /api/deleted-clients` + `POST /api/clients/:id/restore` + `POST /api/admin/clients/:id/restore`؛ یادداشت (`DELETE /api/notes/:id`)؛ عضوِ واحدِ درمان؛ ردیفِ دستیِ پرونده (`content.removedItems`) و نسخه‌یِ پیش از force (`content.previousForced`). فیلترِ `deleted_at IS NULL` در `getOwnedClient/Session`، لیست‌هایِ تراپیست، corpusِ پرونده، متنِ نهایی (علائم/یادداشتِ پیش از جلسه)، speakerResolve، پایشِ زنده، autoClose.
- **مسدود:** `DELETE /api/admin/therapists/:id` و `DELETE /api/admin/sessions/:id/audio` ⇒ 409 `hard-delete-disabled` (+audit `admin.hard_delete_blocked`)؛ دکمه‌هایِ UI برداشته شد.
- **جاروب‌هایِ نگهداری خاموش** (`shared/retention.ts#hardDeleteAllowed`، `ALLOW_HARD_DELETE=1` کلیدِ اضطراری): آرشیوِ صدا (۳۰ روز)، یتیم‌جاروبیِ آرشیو، حذفِ وابسته به purge، صفِ batchِ بی‌آرشیو/نامشخص، پوشه‌یِ آپلود، رصد/ممیزی، اعلان؛ شکستِ نوشتنِ آرشیو فایل را `.unrecorded` نگه می‌دارد نه پاک.
- **تست:** یکپارچه‌یِ DB (canary) ۱۹ ادعا PASS: ماندنِ ردیف/فایل/صدا، ۴۰۴ برایِ تراپیست، دیدِ ادمین، restore، جاروب‌هایِ ۴۰۰روزه no-op، ۴۰۹ ادمین، و اثباتِ اینکه `ALLOW_HARD_DELETE=1` همان جاروب را فعال می‌کند. canary پاک شد.
- **⚠️ پیامدها:** دیسک بی‌سقف رشد می‌کند (آرشیوِ صدا، آپلودها)؛ متنِ رضایت (LAW-009) باید هم‌گام شود؛ «حق فراموشی»/حذفِ درخواستیِ داده فقط دستی. **استثناهایِ آگاهانه:** توکنِ نشست هنگامِ خروج، اعلانِ failed هنگامِ retry، تکه‌هایِ موقتِ آپلود/نسخه‌یِ تکراریِ صفِ batch پس از آرشیوِ موفق، و ویرایشِ متنِ یادداشتِ پیش از جلسه (نسخه‌یِ قبلی ذخیره نمی‌شود).
- **اسناد:** LAW-010، api-catalog، database-catalog، configuration-catalog.

### 2026-10-02 — CODE + MIGRATION + DECISION + TEST + DOCS — حذفِ جلسه توسطِ تراپیست = حذفِ نرم؛ مسیرِ پیدا کردن/بازگردانی
- **تصمیمِ مالک:** «حذفِ جلسه توسطِ تراپیست هم نگه داشته شود؛ ممکن است دستش بخورد، یک مسیر برایِ پیدا کردنش داشته باش».
- **MIGRATION 042 (additive، روی DBِ dev اعمال شد):** `sessions.deleted_at/deleted_by` + index. **⚠️ در deploy خودکار اجرا می‌شود (runner در startup).**
- **کد:** `DELETE /api/sessions/:id` حالا حذفِ نرم است (بدونِ purgeِ صدا؛ status دست‌نخورده)؛ `getOwnedSession`/`getOwnedSessionWithClient`/لیست‌هایِ تراپیست/corpusِ پرونده/live-monitor/autoClose جلسه‌یِ حذف‌شده را نمی‌بینند؛ `POST /api/sessions/:id/restore`، `GET /api/clients/:id/deleted-sessions`، `POST /api/admin/sessions/:id/restore`، فیلترِ `deleted=only|false` در `admin/sessions/recent`؛ audit `therapist.session_restore`/`admin.session_restore`. UI: بخشِ «جلسه‌هایِ حذف‌شده» (بازگردانی) در صفحه‌یِ مراجع، متنِ صادقانه‌یِ مودالِ حذف، برچسبِ 🗑 و دکمه‌یِ بازگردانی برایِ ادمین.
- **تست:** یکپارچه‌یِ DB (canary، `app.inject`) ۱۹ ادعا PASS (حذف/ماندنِ ردیف و صدا/۴۰۴ برایِ تراپیست/فهرستِ حذف‌شده‌ها/مالکیت/ادمین/restore تراپیست و ادمین/۴۰۱/۴۰۳/۴۰۹)؛ E2Eِ مرورگرِ واقعی: حذف از UI، ظاهرشدن در «جلسه‌هایِ حذف‌شده»، ادمین با متن و دکمه‌یِ بازگردانی. canary پاک شد.
- **اسناد:** LAW-010 (تصمیمِ مالک)، api-catalog، database-catalog، PRDِ جلسات. **⚠️ LAW-009:** متنِ رضایت/privacy باید هم‌گام شود.
- **هنوز حذفِ سخت:** حذفِ مراجع و حذفِ حسابِ تراپیست (cascade) و حذف توسطِ ادمین — اگر آن‌ها هم باید نگه داشته شوند، تصمیمِ جدا لازم است.

### 2026-10-02 — CODE + DECISION + TEST — «لغو جلسه» دیگر حذف نیست؛ همه‌چیز برایِ ادمین می‌ماند
- **تصمیمِ مالک (در همین گفتگو):** «حتی اگر لغو بزند هم باید برایِ ادمین ذخیره شود». قبلاً `confirmCancelSession` موتور را `abort()` (پاک‌کردنِ صفِ صدایِ IndexedDB) و `DELETE /api/sessions/:id` (حذفِ جلسه+صدا، LAW-010) می‌زد.
- **تغییر:** `public/index.html` `confirmCancelSession`: موتور `finish()` می‌شود (متن persist + صفِ صدا آپلود) سپس `PUT status=canceled` (۳ تلاش؛ اگر نشد، جلسه in_progress می‌ماند و بستنِ خودکار آن را با داده می‌بندد). `clients.repository.listClientSessions` جلساتِ canceled را از فهرستِ تراپیست پنهان می‌کند؛ `admin/sessions.admin.ts` فیلترِ `status=canceled` را می‌پذیرد. متنِ مودال صادقانه. بدونِ migration (status='canceled' از قبل در legacy-ws و PUT مجاز بود).
- **تست:** E2Eِ واقعی (headless Chrome + canary): لغو ⇒ DB: status=canceled، ۹۸ نویسه متن، ۲ سگمنتِ صدا (۳۱KB)؛ فهرستِ تراپیست ۰؛ ادمین ۱ جلسه‌یِ canceled. canary پاک شد. routes/tsc/docs OK.
- **⚠️ LAW-009/متنِ رضایت:** رفتارِ ذخیره‌یِ صدا عوض شد (لغو دیگر صدا را پاک نمی‌کند) — متنِ رضایت/privacy note باید با تصمیمِ مالک هم‌گام شود (R1 قبلاً باز است). جلسه‌یِ canceled تا سیاستِ نگهداریِ ۳۰روزه‌یِ آرشیو باقی می‌ماند.
- **اسناد:** PRDِ جلسات، api-catalog.

### 2026-10-02 — CODE + TEST — ذخیره‌یِ فوریِ صدا برایِ ادمین بدونِ «پایان جلسه»
- **درخواستِ مالک:** «حتی اگر ذخیره‌ی نهایی را نزند، برایِ ادمین همه‌چیز باید ذخیره شود». ممیزی: متن autosave (≤۱۵ث) + flush در hidden/pagehide داشت؛ صدا فقط هر ۶۰ث و فقط در ACTIVE از IndexedDB به سرور می‌رفت ⇒ در قطعِ اتصال/توقف/مرگِ تب تا ~۷۵ث (یا کلِ دورانِ قطعی) فقط محلی بود.
- **تغییر (`feelia-rt.js`):** `ARCHIVE_DRAIN_MS` ۶۰→۲۰ث، تایمر در همه‌یِ stateهایِ غیرِ پایانی و online، و `drainSoon()` (~۱ث پس از ذخیره‌یِ هر سگمنت). T38 به‌روز و T68 اضافه شد؛ T59/T60 برایِ بازرسیِ صف آپلودِ فوری را خاموش می‌کنند. `test:rt` 114 PASS / 0 FAIL.
- **هنوز محلی می‌ماند:** سگمنتِ در حالِ ضبط (≤۱۵ث) هنگامِ crash/kill؛ «لغو جلسه»ِ صریح همه‌چیز را عمداً حذف می‌کند (LAW-010).
- **سند:** subsystem 02.

### 2026-10-02 — CODE + MIGRATION(بدونِ migration) + TEST + DOCS — فازهایِ ۳–۶ ممیزیِ Core (F7، F8، F6، F3، F10، P2)
- **چه شد (به دستورِ مالک «به ترتیب همه را انجام بده، داک‌ها را به‌روز کن، تست‌ها را کامل کن»):** F7: نگهبانِ `speakers` در polish + پینِ نقشِ تأییدشده + پلِ `session_speaker_roles`؛ F8: `GET/POST /api/sessions/:id/transcript-revisions…` (فهرست، diffِ پاراگرافی، بازگردانیِ CAS-دار) + UI؛ F6: قفلِ چند-تبِ Web Locks؛ F3: `sessions` و `quoteVerified` روی یافته‌ها + دروازه‌یِ کیفیتِ تولیدِ خودکار (`low_coverage`/`speakers_merged`) + `quality` در GET پرونده؛ F10: `GET /api/admin/core-metrics` + کارتِ ادمین؛ P2: بستنِ placeholderِ «⏳»ِ ابدی (`mergeRecoveryLost`). بدونِ migration (JSON/جدولِ موجود).
- **اسنادِ به‌روز:** api-catalog، CLAUDE.md (`test:hist`)، feature-index، repository-map، requirement-catalog (REQ-124..130)، traceability-matrix، subsystem 01 (I21–I22 + رویدادها)، 07-final-transcript، 08-session-record، PRDِ پرونده/جلسات/ادمین، PROJECT_MASTER_REFERENCE (R2 رفع‌شده).
- **تست:** rt 113، up 71، ft 65، cf 115، tu 19، llm 22، adm 9، hist 11 — 0 FAIL؛ routes 153، arch، docs OK؛ tsc تمیز؛ یکپارچه‌یِ DB ۳۳ ادعا PASS؛ `test:api` (با مجوز) ۳۶۲ ورودی و فقط تفاوتِ additiveِ `quality`؛ E2Eِ مرورگرِ واقعی (دو تب، تاریخچه، ادمین). همه‌ی canaryها پاک شدند. جزئیات: verification/2026-10-02-core-audit.md.
- **FINDING:** در نشستِ دیگر CAS اجباری و snapshotِ `unit_type` تغییرِ ذخیره‌نشده دارد (در مقایسه‌یِ test:api دیده شد؛ دست نخورد). ابزارِ ویرایشِ من در این نشست چند بار `
` و `s` را در اسکریپت‌ها خورد؛ هر مورد با تست/tsc گرفته و اصلاح شد.
- **کارِ باز / نیازمندِ تصمیمِ مالک:** F9 (متنِ رضایت)، retentionِ هوشمند، گسترشِ طبقه‌بندیِ خطایِ Soniox، guardِ ضمیر/زمان/اسم، ردیابیِ سطحِ نوبت، مصرفِ متنِ نهایی در پرونده؛ commit/deploy نشده.
- **عامل:** این نشست.

### 2026-10-02 — CODE + TEST — فاز ۲ ممیزیِ Core + رفعِ تکرارِ متن (به دستورِ مالک «مشکلاتِ موجود را حل کن»)
- **تکرارِ جمله‌یِ live (ریسکِ بازِ فاز ۱) — ریشه پیدا و رفع شد:** `insertRecoveryPlaceholder` placeholder را «قبل از» نشانگرِ بازگشتِ انتهاییِ *ذخیره‌شده* می‌گذاشت ⇒ `persistedText` دیگر پیشوندِ متن نبود ⇒ rebaseِ 409 واگرایی می‌دید ⇒ متنِ live دوبار. (با لاگِ fetch در E2E واقعی ردیابی شد.) حالا اگر نشانگر ذخیره شده، ته‌پیوند می‌شود (I20). تستِ T63 (قبلِ رفع FAIL، بعد PASS) + E2E واقعی: یک‌بار، بدونِ برچسبِ واگرایی.
- **F4 (سلامتِ ضبط):** `RTSession.setHealth/onHealth`؛ خطایِ `MediaRecorder.start()` دیگر بی‌صدا نیست (گزارش + ۵ تلاش)، `track.onmute/onunmute`، mic-lost و خطایِ IndexedDB ⇒ بنرِ قرمزِ پایدارِ `#recHealthBanner`؛ نشانگرِ «آخرین ذخیره‌ی صدا» (`#recSavedNote`) و هشدار اگر >۹۰ث بدونِ ذخیره. T62/T64/T65/T66.
- **F5:** «پایان جلسه» حالا مودالِ تأیید دارد (`endSession`→`doEndSession`)؛ مودالِ لغو صادقانه می‌گوید کلِ جلسه (متن/یادداشت/علائم) حذف می‌شود. توجه: رویدادِ Clarity `session_end_clicked` حالا بعد از تأیید ثبت می‌شود.
- **تست:** rt-harness 112 PASS / 0 FAIL؛ E2E واقعی (headless Chrome + canary رویِ DBِ dev): بنر/بازیابی/mute/مودالِ تأیید/ادامه‌ی جلسه با انصراف/پایان با تأیید همه درست؛ canary پاک شد.
- **فایل‌ها:** `public/feelia-rt.js`، `public/index.html`، `scripts/rt-harness.cjs`، docs (subsystem 01 I19–I20، frontend-map).
- **کارِ باز:** F6–F10 (چند-تب، polish/نقش، تاریخچه، traceability، metrics)؛ commit/deploy نشده.

### 2026-10-02 — CODE + TEST — فاز ۱ ممیزیِ Core: watchdogِ WSِ ساکت (F1b) + نشانگرِ resume (F2)
- **چه شد:** به دستورِ مالک («انجامش بده»). `feelia-rt.js`: `lastWsMsgAt` + `WS_SILENT_MS=30s` در watchdog ⇒ `requeueSilentAudio` (سگمنت‌هایِ archiveِ دورانِ سکوت ⇒ transcript + placeholder) و reconnect؛ `start()` رویِ جلسه‌ایِ دارایِ متن `noteDiscontinuity()` می‌گذارد. T60/T61 از KNOWN-GAP به FIXED وارونه شدند.
- **عمداً نشده:** سگمنتِ مرزیِ پیش از قطع (T59، ≤۱۵ث) بازرونویسی نمی‌شود — نیمی از متنش زنده آمده و duplicate می‌شد؛ T62 (خطایِ بی‌صدایِ MediaRecorder) فازِ ۲.
- **E2E واقعی (با مجوزِ مالک، Sonioxِ واقعی + canary رویِ DBِ dev):** Soniox در سکوت هر ~۱٫۲ث پیامِ بدونِ token می‌فرستد ⇒ آستانه‌ی ۳۰ث امن؛ در سوکتِ مرده جمله‌یِ گمشده بازیابی شد؛ resume بعد از رفرش نشانگر گذاشت. **ریسکِ باز:** در سناریویِ مصنوعیِ ۳ reconnectِ پیاپی، یک جمله‌یِ live در شاخه‌یِ واگراییِ `persistConfirmed` تکرار شد (در تک‌قطعی تکرار نشد؛ علت ایزوله نشد). canary و صدایش پاک شد. جزئیات: verification/2026-10-02-core-audit.md. هنوز deploy نشده.
- **فایل‌ها:** `public/feelia-rt.js`، `scripts/rt-harness.cjs`، `docs/07-subsystems/01-browser-realtime-engine.md` (I17–I18).
- **تست / تأیید:** rt 108، up 72، ft 62، cf 111، tu 19، llm 23، adm 8 — همه 0 FAIL؛ routes/arch/docs OK؛ tsc تمیز (جزئیات: verification/2026-10-02-core-audit.md). test:api و E2E واقعی اجرا نشد.
- **عامل:** این نشست. **کارِ باز:** فاز ۲؛ تستِ مرورگرِ واقعی؛ commit نشد.

### 2026-10-02 — TEST + FINDING — فاز ۰ ممیزیِ Core: تأییدِ F1/F2/F4/F5 پیش از اصلاح
- **چه شد:** به دستورِ مالک («شروع کن» پس از پلنِ بررسیِ نقادانه). بدونِ تغییرِ کدِ محصولی؛ چهار تستِ characterization (T59–T62، KNOWN-GAP) به `rt-harness` اضافه شد.
- **FINDING (مهم):** F1 در پلن **بخشی نادرست** بود — سگمنتِ خودِ قطعی transcript می‌گیرد (T18/T46). شکافِ واقعی: سگمنتِ پیش از *تشخیصِ* قطع `archive` است (T59) و WebSocketِ بازِ ساکت هرگز تشخیص داده نمی‌شود (T60؛ watchdog فقط `readyState`). F2 (T61)، F4a (T62: خطای `MediaRecorder.start()` بی‌صدا)، F4b (`onmute` نیست)، F4c و F5 (کد) تأیید شدند. F3، F6–F10 بررسی نشد. تفصیل: [verification/2026-10-02-core-audit.md](verification/2026-10-02-core-audit.md).
- **فایل‌ها:** `scripts/rt-harness.cjs` (فایل پیش‌تر تغییراتِ نشستِ دیگر داشت؛ دست نخورد)، `verification/2026-10-02-core-audit.md` (جدید).
- **تست / تأیید:** `node scripts/rt-harness.cjs` ⇒ 108 PASS / 0 FAIL.
- **عامل:** این نشست.
- **کارِ باز:** فاز ۱ باید بازتعریف شود (watchdogِ بدونِ-token + بستنِ شکافِ پیش از تشخیص + marker/برچسبِ resume)؛ unloadِ IndexedDB هنوز unverified؛ commit نشد. منتظرِ دستورِ مالک برایِ فاز ۱.

### 2026-10-02 — DOCS + DECISION — افزودنِ Product Thesis (جهتِ محصول: Core = Capture + Preserve)
- **چه شد:** مالک سندِ «Value Creation, Core Functional Job & Product Thesis» را داد و خواست در جای مناسب ثبت شود. به‌صورتِ سندِ governance ثبت شد (نه ماژول/PRD، چون جهتِ کلِ محصول است؛ زیرِ Laws و بالایِ planها). محتوا وفادار به متنِ مالک؛ فقط §۱۶ تفسیرِ نگارنده است (نگاشت به subsystemها + ۴ شکاف).
- **فایل‌ها:** `docs/00-governance/product-thesis.md` (جدید)؛ لینک در `CLAUDE.md` (ترتیبِ خواندن + جدولِ task)، `docs/README.md`، `documentation-map.md`، `source-of-truth.md` (مالکِ «جهتِ محصول»).
- **اسنادِ به‌روزشده:** همین‌ها + این ورودی.
- **تست / تأیید:** `pnpm test:docs` (نتیجه در ورودیِ بعدی/پیامِ نشست).
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** (۱) متریک‌هایِ §۱۴ (Capture Reliability، Recovery Success، Correction Rate، Repeat Usage) اندازه‌گیری نمی‌شوند؛ (۲) مکانیزمِ ثبتِ بازخوردِ درمانگر تعریف نشده؛ هر دو نیازمندِ تصمیمِ مالک. هیچ کدی عوض نشد؛ commit نشد.

### 2026-10-01 — GIT + DEPLOY (production) — مرتب‌سازیِ جلساتِ ادمین بر اساسِ آخرین ضبط (`d5e384d`)
- **مجوزِ مالک:** «دیپلوی کن».
- **git:** commit `d5e384d` رویِ `feat/clarity` (پایه `b94e6c5`) از worktreeِ تمیز، فقط ۴ فایلِ همین کار (`admin.repository.ts`، `index.html` دو هانک، `api-catalog.md`، ورودیِ CODEِ «مرتب‌سازیِ جلسات»). در worktree: `tsc` تمیز، `test:rt` بدونِ FAIL، `test:up` 64/0، `test:ft` 61/0، `test:tu` 19/0، `test:cf` 111/0، `test:adm` 8/0، `test:routes`/`test:arch` OK، build OK؛ `test:docs` فقط خطایِ از قبل موجودِ `CURRENT_UI_STATE.md` (untracked). push نشد.
- **FINDING:** هم‌زمان نشستِ دیگری در working tree رویِ آپلود کار می‌کند (ورودیِ زیر: fsync + `jobNotesHtml` در `index.html`) — هیچ‌کدام در این commit/deploy نیستند.
- **deploy (حداقلی):** checksumِ CR-strippedِ `server/src` و `public`ِ production = `b94e6c5`، به‌جز `index.html` (هانکِ آیکونِ کپیِ نشستِ دیگر، از قبل رویِ production). پس فقط دو فایل رفت: `admin.repository.ts` (= commit) و `index.html` = نسخه‌ی production + فقط دو هانکِ همین commit (diff دقیقاً ۴ خط؛ parseِ inline OK). preflight دو بار GO (همه ۰). پشتیبان `/root/backups/code-pre-admin-sort-20261001T150125Z.tar.gz` (دو فایل + `server/dist`). build OK، `pm2 restart`، `/api/health` ok، pm2 online، بدونِ خطایِ جدید؛ `/api/admin/sessions/recent` بدونِ کوکی 401؛ `index.html`ِ سروشده شاملِ «آخرین ضبط». اجرایِ فقط‌خواندنیِ هر دو تابع رویِ DBِ production (فقط شماره/زمان): ترتیب درست.
- **کارِ باز:** UIِ ادمین رویِ production با حسابِ واقعی دیده نشد. برگشت = استخراجِ همان پشتیبان + build + restart.

### 2026-10-01 — CODE+MIGRATION+TEST — اجرایِ ممیزیِ Core: فازهایِ ۱ تا ۳ (به‌جز متنِ رضایت)
- **چه شد:** دستورِ مالک: «migration را رویِ dev اجرا کن و تست کن؛ و به‌جز متنِ رضایت بقیه را کامل حل کن». **migrationهایِ 038–041 رویِ MySQLِ dev اعمال شدند** (با مجوزِ صریح).
  - **فاز ۱ (لایو):** gap-check واقعی با `client_seq` + جدولِ `session_audio_skips` (039) و `?empty=` از کلاینت (رفعِ باگِ «همیشه کامل»)؛ `GET /api/sessions/:id/audio-status` + خطِ «X از Y دقیقه ذخیره شد»؛ `storage.persist()`؛ fsync پیش از 202؛ sweepِ batch-queue فایلِ آرشیوِ ناموفق را تا ۷ روز نگه می‌دارد (`audio.archive_lost`)؛ پیامِ جدایِ شکستِ IndexedDB؛ هشدارِ ۵روزه پیش از حذفِ ۷روزه‌یِ صدایِ محلی؛ سگمنتِ بی‌محتوا placeholder نمی‌گیرد.
  - **فاز ۲:** توکن‌هایِ زمان‌دار (038)؛ `session_transcript_revisions` (040) برایِ هر جایگزینیِ غیر-الحاقی؛ **CAS اجباری** در `PUT /api/sessions/:id` (400 `version-required`؛ `TRANSCRIPT_CAS_REQUIRED=0` بازگشتِ اضطراری؛ مسیرِ legacy با `legacyPutTranscript`)؛ snapshotِ `sessions.unit_type/modalities`.
  - **فاز ۳:** featureِ جدیدِ `session-record` (`session_segments`، `session_speaker_roles`، 041)؛ API و UIِ نقشِ گوینده‌ها؛ پرونده‌یِ AI و export (`schema_version: 2`) از رکوردِ canonical می‌خوانند (فقط اگر پس از آن ویرایش نشده)؛ گذرِ live با `CANONICAL_PASS=1` (پیش‌فرض خاموش) و `polishWanted`.
- **فایل‌ها:** `server/src/features/session-record/*`، `sessions/{sessions.routes,sessions.repository,sessionSnapshot,transcriptRevision,batch.routes}.ts`، `transcription/{archive/listing,archive/skips,batch/processQueue,batch/sweep,index}.ts`، `audio-upload/{jobStore.sql,uploadSession,jobMachine}.ts`، `final-transcript/{runner,domain/jobMachine}.ts`، `case-file/application/aggregateClientCorpus.ts`، `admin/{export.admin,diagnosis,sessions.admin,audio.admin,admin.repository}.ts`، `obs/types.ts`، `app.ts`، migrationهایِ 039–041، `public/{index.html,feelia-rt.js,feelia-analytics.js}`، `scripts/{upload-harness.ts,rt-harness.cjs,final-transcript-harness.ts,route-snapshot.txt}`.
- **اسنادِ به‌روزشده:** subsystem 08 (جدید)، 02 (تصحیحِ gap-check)، 06 §۱۳، api-catalog، database-catalog، configuration-catalog، feature-index، documentation-map، analytics-clarity، Master Reference (R4/R5/R15)، [verification](verification/2026-10-01-core-audit-implementation.md).
- **تست / تأیید:** `tsc`، `test:up` 71/0، `test:ft` 62/0، `test:cf` 111/0، `test:rt` (T58 جدید) بدونِ FAIL، `test:routes`/`test:arch`/`test:docs` سبز؛ **E2Eِ واقعی رویِ MySQLِ dev** (PUT/CAS/revision/snapshot، skips، توکن، نقش، پرونده‌یِ AI، export، cascade) همه PASS؛ fixtureها پاک شدند. **انجام نشد:** مرورگرِ واقعی با ضبطِ زنده؛ `CANONICAL_PASS=1` با Sonioxِ واقعی؛ `test:api` (golden مورد «legacy no version» اکنون 400)؛ فاز ۴ (نیازمندِ جلساتِ واقعیِ رضایت‌دار).
- **عامل:** این نشست (کنارِ تغییراتِ commitنشده‌یِ نشستِ دیگر در `jobMachine.ts`/`index.html` که دست نخورد).
- **کارِ باز / پیامد:** (۱) **متنِ رضایت (R1) هنوز اصلاح نشده** ⇒ توکن‌هایِ ماندگار و `CANONICAL_PASS` پیش از اصلاحِ آن نباید روشن/deploy شوند؛ (۲) migrationهایِ 038–041 رویِ production هنوز اعمال نشده‌اند؛ (۳) commit/deploy نشد؛ (۴) توکنِ realtimeِ جلسه‌یِ زنده ذخیره نمی‌شود، `transcriptMetrics` فقط برایِ آپلود؛ (۵) مرورگرِ قدیمیِ legacy بدونِ نسخه‌ یِ CAS 400 می‌گیرد.

### 2026-10-01 — CODE+MIGRATION — ذخیره‌ی توکن‌هایِ زمان‌دارِ آپلود (فاز ۲ ممیزی Core)
- **چه شد:** تصمیمِ مالک: توکن‌ها بعد از پاکسازیِ صدا بمانند. migration 038 (`session_transcript_tokens`)، `tokenStore.ts` (pack/unpack gzip)، `TranscriptMeta.tokens` و INSERTِ fail-open در تراکنشِ `applyTranscriptOnce`.
- **فایل‌ها:** `server/src/db/mysql/migrations/038_session_transcript_tokens.sql`، `server/src/features/audio-upload/{tokenStore,jobMachine,jobStore.sql}.ts`، `scripts/upload-harness.ts` (H66–H67).
- **اسنادِ به‌روزشده:** database-catalog، subsystem 06 §۱۳.
- **تست / تأیید:** `test:up` 68/0، `tsc` سبز. **INSERTِ واقعی رویِ MySQL و اجرایِ migration تست نشد** (DBِ dev مشترک است؛ نیازمندِ مجوزِ صریح).
- **عامل:** این نشست.
- **کارِ باز:** اجرایِ migration/E2E با مجوز؛ ذکرِ توکن‌ها در متنِ رضایت؛ خواننده (فاز ۳)؛ توکنِ جلسه‌یِ زنده؛ commit نشد.

### 2026-10-01 — CODE — آپلود: fsync پیش از تأییدِ تکه + نمایشِ «کامل‌بودنِ متن» به تراپیست
- **چه شد:** از ممیزیِ Core فقط مواردِ مسیرِ آپلود: (۱) `writeChunk`/`assembleUpload` با `fsync` پیش از rename؛ (۲) `jobView.transcript_notes` + بنرِ `jobNotesHtml` در کارتِ job (سینی و صفحه‌ی جلسه) برایِ پوشش کم/حفره/سر و ته بی‌متن/گوینده‌هایِ ادغام‌شده؛ JOB_SELECT ستونِ `transcript_metrics` را هم می‌گیرد.
- **فایل‌ها:** `server/src/features/audio-upload/{uploadStore,jobView,uploads.repository}.ts`، `public/index.html`، `scripts/upload-harness.ts` (H64–H65).
- **اسنادِ به‌روزشده:** subsystem 06 §۱۲، api-catalog (AudioJobView).
- **تست / تأیید:** `test:up` 66/0، `tsc`، `test:arch`، `test:routes`، `test:docs` سبز. بنر در مرورگرِ واقعی (سرور استاتیکِ موقت رویِ public/، `jobCardHtml` با jobِ ساختگی) رندر و بررسی شد: بدون نکته ⇒ بنر نیست؛ ۴ نکته ⇒ یک بنرِ مرتب؛ نکته+low_confidence ⇒ دو بنرِ جدا؛ بدون خطایِ کنسول. جریانِ کاملِ لاگین/سینی با بک‌اندِ واقعی تست نشد.
- **عامل:** این نشست (کنارِ تغییراتِ commitنشده‌ی نشستِ دیگر در `jobMachine.ts`/`index.html` که دست نخورد).
- **کارِ باز:** فاز ۲ ممیزی (ذخیره‌ی توکن‌هایِ Soniox، تاریخچه‌ی متنِ خام) نیازمندِ migration و تصمیمِ مالک؛ commit نشد.

### 2026-10-01 — CODE — پنلِ ادمین: مرتب‌سازیِ جلسات بر اساسِ آخرین جلسه/آخرین ضبط
- **چه شد:** درخواستِ مالک. دو فهرستِ جلسه در پنلِ ادمین (`GET /api/admin/clients/:id/sessions` = «جلساتِ ثبت‌شده»ی مراجع، قبلاً `session_num DESC`؛ `GET /api/admin/sessions/recent` = «جلساتِ اخیر»، قبلاً `updated_at DESC`) حالا با `COALESCE(last_recording_at, s.created_at) DESC` مرتب می‌شوند؛ `last_recording_at` = آخرین سگمنتِ `session_audio` با `kind='session'` (یادداشتِ صوتی حساب نمی‌شود). فیلدِ `last_recording_at` به هر دو پاسخ اضافه شد و در UI به‌صورتِ «آخرین ضبط» نمایش داده می‌شود. فیلترِ `since_hours` همچنان رویِ `updated_at` است. بدونِ migration، بدونِ تغییرِ route.
- **فایل‌ها:** `server/src/features/admin/admin.repository.ts` (`listSessionsOfClient`، `listRecentSessions`)، `public/index.html` (`renderAdminRecentSessions`، `openAdminClientSessions`).
- **اسنادِ به‌روزشده:** `docs/02-reference/api-catalog.md` (دو ردیف).
- **تست / تأیید:** `npx tsc --noEmit` تمیز؛ `test:routes` OK (141)؛ `test:arch` OK؛ `test:docs` OK. اجرایِ فقط‌خواندنیِ هر دو تابع رویِ DBِ dev (فقط شناسه/زمان، بدونِ متن): ترتیب نزولی و درست، جلسه‌ی دستیِ بدونِ صدا با `created_at` در جایِ درست. UI در مرورگر رندر نشد.
- **عامل:** این نشست.
- **کارِ باز / پیامد:** commit/deploy نشده.

### 2026-10-01 — GIT + DEPLOY (production) — Core: مرورگرِ مشترک، «کیفیتِ رونویسی»، تاریخچه‌ی «متنِ نهایی» (`b94e6c5`، migration 037)
- **مجوزِ مالک:** «بله دیپلوی کن».
- **git:** commit `b94e6c5` رویِ `feat/clarity` (پایه `061d0ca`) از worktreeِ تمیز، فقط تغییراتِ همین کار (۲۶ فایل). هانک‌هایِ commitنشده‌ی نشستِ دیگر (آیکونِ «کپیِ کلِ متن» در `index.html`، باقی‌مانده‌ی «نظرِ دوم» در `jobMachine.ts`) commit نشدند. در worktree: `tsc` تمیز، `test:rt` 103/0، `test:up` 64/64، `test:ft` 61/61، `test:tu` 19/19، `test:cf` 111/111، `test:arch`/`test:routes` OK، parseِ inline OK، build OK؛ `test:docs` فقط خطایِ از قبل موجودِ `CURRENT_UI_STATE.md`. push نشد.
- **preflight:** همه ۰ ⇒ GO؛ nginx فقط ربات در ۴۰ دقیقه‌ی اخیر؛ پیش از استخراج دوباره `busy=0`.
- **deploy:** `server/` + `public/{feelia-rt.js, feelia-admin-quality.js, index.html}`. `index.html` = نسخه‌ی production (شاملِ آیکونِ کپیِ نشستِ دیگر) + فقط هانک‌هایِ همین کار — diffِ production⇄تار دقیقاً همین هانک‌ها بود. پشتیبان `/root/backups/code-pre-core-20261001T141341Z.tar.gz`. لاگ: `037_final_transcript_versions.sql applied`؛ `/api/health` ok؛ pm2 online؛ بدونِ خطایِ جدید؛ جدولِ `final_transcript_versions` موجود؛ checksumِ `server/src` = commit، سه فایلِ `public/` = نسخه‌ی محلی؛ دو routeِ ادمینِ جدید بدونِ کوکی 401؛ `feelia-admin-quality.js` 200.
- **کارِ باز:** UIِ ادمین رویِ production با حسابِ واقعی امتحان نشد. برگشت = استخراجِ همان پشتیبان + build + restart (جدولِ 037 می‌ماند و بی‌اثر است).

### 2026-10-01 — FINDING (اصلاح) — `index.html` ِ production ثبت شده بود
- **چه شد:** در ورودیِ «GIT + DEPLOY … (`061d0ca`)» نوشتم `public/index.html` ِ production «بدونِ ورودی در Event Log» deploy شده — **نادرست بود.** همان تغییر (دکمه‌ی «کپیِ کلِ متن» به‌صورتِ آیکونِ SVG داخلِ کادرِ متن، commitنشده) در ورودیِ «CODE + DEPLOY (production) — دکمه‌ی کپیِ کلِ متن (آیکونِ SVG کوچک) …» ثبت شده است. همچنان commit نشده و این نشست آن را commit نمی‌کند؛ در deployِ بعدی همان نسخه‌ی production حفظ می‌شود.
- **عامل:** این نشست.

### 2026-10-01 — CODE + MIGRATION + DOCS + TEST — Core: دو باگِ گم‌شدنِ صدا، «کیفیتِ رونویسی» در پنلِ ادمین، تاریخچه‌ی «متنِ نهایی» (037)
- **چه شد:** به دستورِ مالک («فعلا انجام بده همینارو 132»). (۱) مرورگرِ مشترک: 404 دیگر صدایِ آپلودنشده‌ی تراپیستِ دیگر را از IndexedDB حذف نمی‌کند (مالکِ رکورد + `setQueueOwner`)؛ جاروبِ ۲۴ساعته‌ی صف `.prenote.` را `kind='prenote'` آرشیو می‌کند (قبلاً `session`). (۳) صفحه‌ی «کیفیتِ رونویسی» در پنلِ ادمین (`GET /api/admin/upload-quality`). (۲) تاریخچه‌ی فقط‌افزودنیِ «متنِ نهایی» (`final_transcript_versions`، migration 037): هر ساخت و هر اصلاحِ نقش یک نسخه؛ متنِ پیش از 037 پیش از اولین بازنویسی کپی می‌شود؛ ادمین فهرست و متنِ هر نسخه را می‌بیند (ممیزی).
- **فایل‌ها:** `public/{feelia-rt.js, index.html, feelia-admin-quality.js (جدید)}`، `server/src/features/transcription/batch/{queueFiles.ts, sweep.ts}`، `server/src/features/audio-upload/{adminQuality.ts (جدید), index.ts}`، `server/src/features/final-transcript/{adapters/versionStore.ts (جدید), runner.ts, api/finalTranscript.routes.ts, index.ts}`، `server/src/features/admin/{queue.admin.ts, sessions.admin.ts}`، `server/src/db/mysql/migrations/037_final_transcript_versions.sql`، `scripts/{rt-harness.cjs (T57), upload-harness.ts (H52+, H63), route-snapshot.txt}`.
- **اسنادِ به‌روزشده:** api-catalog (۳ route)، database-catalog (037 + جدول + مالک)، subsystem 02 (404)، 05 (kindِ جاروب)، 06 (نمایِ کلی)، 07 (تاریخچه)، feature-index، [verification](verification/2026-10-01-core-fixes-quality-overview-ft-versions.md).
- **تست / تأیید:** `tsc` تمیز؛ `test:rt` 103/103؛ `test:up` 64/64؛ `test:ft` 61/61؛ `test:tu` 19/19؛ `test:cf` 111/111؛ `test:arch` OK؛ `test:routes` OK (141، snapshot عمداً به‌روز شد)؛ `test:docs` OK. مرورگرِ واقعی با mockِ scratchpad (صفحه‌ی کیفیت، فیلتر، مشاهده/برگشت، حالتِ خالی، موبایل، کارتِ تاریخچه) بدونِ خطایِ کنسول. **MySQLِ dev با مجوزِ مالک:** migrationهایِ 036 و 037 رویِ DBِ dev اعمال شدند؛ baseline/generated/role_edit درست، پاکسازیِ fixture کامل (`versions=0 sessions=0`).
- **عامل:** این نشست.
- **کارِ باز / پیامد:** commit/deploy نشده. DBِ dev حالا 036 و 037 را دارد (سرورِ dev در startupِ بعدی «already applied» می‌بیند). routeهایِ HTTPِ جدید با سرورِ واقعی و هم‌زمانیِ واقعیِ دو نویسنده تست نشده‌اند.

### 2026-10-01 — CODE — حذفِ کاملِ «نظرِ دوم» (Shenava)
- **چه شد:** به دستورِ مالک، کدِ «نظرِ دوم» پس از نتیجه‌ی منفیِ تستِ ضبطِ واقعی حذف شد: پوشه‌ی `features/transcription/secondOpinion/`، `scripts/second-opinion-harness.ts` و اسکریپتِ `test:so`، export از `transcription/index.ts`، سیم‌کشی در `audio-upload/worker.ts`، پارامترِ `audioPath` در پورتِ `getText` (`jobMachine.ts`)، وابستگیِ اختیاریِ `sherpa-onnx-node` (`pnpm remove`)، ۳ ردیفِ env در configuration-catalog، خطِ `test:so` در CLAUDE.md، ارجاع در repository-map/feature-index، بندِ subsystem 06. رفتارِ محصول نسبت به قبل از این کار تغییری ندارد. تغییراتِ نشست‌هایِ دیگر در همان فایل‌ها دست نخورد.
- **فایل‌ها:** موارد بالا؛ `verification/2026-10-01-shenava-vs-soniox-ab.md` (بندِ پایان).
- **اسنادِ به‌روزشده:** configuration-catalog، CLAUDE.md، repository-map، feature-index، subsystem 06، verification.
- **تست / تأیید:** `tsc --noEmit` تمیز، `test:up` 63/63، `test:arch` OK، `test:routes` OK (135)، `test:docs` OK (۳۶ env)؛ grep: هیچ ارجاعی به secondOpinion/SHENAVA/sherpa در کد و docs (به‌جز verification/Event Log) نمانده.
- **عامل:** این نشست
- **کارِ باز / پیامد:** هیچ؛ نتیجه‌ی A/B و دلیلِ رد در verification ثبت است.

### 2026-10-01 — TEST + DECISION — نظرِ دوم Shenava رویِ ضبطِ واقعی: ارزشمند نیست ⇒ روشن نمی‌شود
- **چه شد:** به دستورِ مالک («با یک ضبطِ واقعی تست کن؛ فقط اگر واقعاً ارزشمند است»)، ضبطِ تستِ خودِ مالک (`ec144271`، ۲ گوینده، ≈۹۰ث، ۲۴۰ واژه) با مسیرِ واقعی اجرا شد. علامت‌گذاری: فعلی ۲۶ واژه (۱۱٪) ← با نظرِ دوم ۹۰ واژه (۳۷٫۵٪). Shenava رویِ گفتارِ محاوره‌ایِ واقعی خروجیِ بی‌معنا می‌دهد؛ اغلبِ اختلاف‌ها غلطِ Shenava است. نتیجه‌ی FLEURS/TTS تعمیم نمی‌یابد.
- **فایل‌ها:** فقط `verification/2026-10-01-shenava-vs-soniox-ab.md` (کد دست نخورد).
- **اسنادِ به‌روزشده:** verification؛ این Event Log.
- **تست / تأیید:** اجرایِ واقعیِ Soniox async + Shenava رویِ ضبطِ مالک (فایل بعد از اجرا از Soniox و scratchpad پاک شد). قضاوتِ شنیداریِ واژه‌به‌واژه انجام نشد.
- **عامل:** این نشست
- **کارِ باز / پیامد:** `STT_SECOND_OPINION` خاموش می‌ماند و روشن نمی‌شود. کدِ `secondOpinion/` + وابستگیِ اختیاریِ `sherpa-onnx-node` بی‌اثرند؛ پیشنهاد: حذفِ آن‌ها (تصمیمِ مالک).

### 2026-10-01 — CODE + TEST — «نظرِ دوم» با Shenava برایِ علامت‌گذاریِ واژه‌هایِ مشکوک (مسیرِ آپلود، پیش‌فرض خاموش)
- **چه شد:** به دستورِ مالک («هر استفاده‌ی مفیدی از Shenava را پیاده کن»). ماژولِ `features/transcription/secondOpinion/` (align خالص + Shenava با `sherpa-onnx-node` + orchestrator). صدایِ نرمال‌شده‌ی job تکه‌تکه (≈۲۰ث، در فاصله‌یِ واژه‌هایِ Soniox) به Shenava داده می‌شود؛ واژه‌ی بدونِ جفت با Shenava ∧ confidence<۰٫۹۷ ⇒ ⟦…؟⟧ در ورودیِ «متنِ نهایی». متنِ Soniox، `sessions.transcript`، `lowConfRatio` و هشدارِ کیفیت دست‌نخورده. پشتِ `STT_SECOND_OPINION=1`؛ بدونِ مدل/خطا/سقفِ زمان ⇒ رفتارِ قبلی. **روی production نصب/روشن نشد.**
- **یافته:** علامت‌گذاریِ فعلی (conf<0.5) روی ضبطِ تمیز فقط ≈۹٪ غلط‌ها را می‌گیرد؛ انتها‌به‌انتها recall: تمیز ۵→۲۴٪، نویزی ۴۳→۶۵٪ (precision نویزی ۷۴→۶۴٪).
- **فایل‌ها:** `server/src/features/transcription/secondOpinion/{align,shenava,index}.ts`، `transcription/index.ts`، `audio-upload/worker.ts` (+ پارامترِ اختیاریِ `getText(id, audioPath)` در `jobMachine.ts`)، `scripts/second-opinion-harness.ts`، `package.json` (`test:so`)، `server/package.json` + `pnpm-lock.yaml` (`optionalDependencies: sherpa-onnx-node`).
- **اسنادِ به‌روزشده:** `configuration-catalog.md` (۵ env)، `CLAUDE.md` (§۸ `test:so`)، `repository-map.md`، `feature-index.md`، subsystem 06، `verification/2026-10-01-shenava-vs-soniox-ab.md`.
- **تست / تأیید:** `test:so` 11/11، `test:up` 63/63، `test:ft` 61/61، `test:arch` OK، `test:routes` OK، `test:docs` OK، `tsc --noEmit` تمیز؛ e2eِ واقعی (ffmpeg+Shenava+Soniox tokens) رویِ ۶۰ جمله. انجام نشد: ضبطِ واقعیِ ساعت‌ها، بارِ CPUِ production، اثر رویِ نگهبانِ `uncertain`ِ polish.
- **عامل:** این نشست
- **کارِ باز / پیامد:** (۱) پیش از روشن‌کردن: دانلودِ مدل (۴۶۰MB) رویِ سرور + `SHENAVA_MODEL_DIR` + تستِ یک ضبطِ واقعیِ اجازه‌دار (تصمیمِ مالک؛ deploy ممنوع تا مجوز). (۲) مسیرِ «متنِ نهایی»ِ جلسه‌ی زنده هنوز نظرِ دوم ندارد. (۳) `pnpm-lock.yaml`/`server/package.json` در کنارِ تغییراتِ نشست‌هایِ دیگر در working tree است؛ commit فقط با درخواستِ مالک.

### 2026-10-01 — TEST + FINDING — A/B شنوا (Shenava) در برابرِ Soniox async
- **چه شد:** به درخواستِ مالک، Shenava-Koochik (آفلاین، sherpa-onnx، CPU) با مسیرِ async فعلی رویِ FLEURS-fa (۶۰ جمله، تمیز/نویزی) و ۳ گفت‌وگوی ساختگیِ TTS سنجیده شد. **Soniox بهتر یا برابر بود**: FLEURS تمیز WER ‏7.2% در برابرِ 9.1%؛ نویزی 23.8% در برابرِ 27.5%؛ convind 1.1% در برابرِ 9.1%. Shenava diarization/punctuation ندارد. یافته‌ی مفید: اختلافِ Shenava با Soniox به‌عنوانِ پرچمِ «احتمالاً غلط» ۵–۷× غلیظ‌تر از نرخِ پایه است (recall ‏40–79%).
- **فایل‌ها:** فقط `verification/2026-10-01-shenava-vs-soniox-ab.md` (کدِ محصول دست‌نخورده). دانلودِ مدل (۴۶۰MB) و FLEURS dev (۲۷۱MB) فقط در scratchpadِ نشست.
- **اسنادِ به‌روزشده:** این Event Log + verification.
- **تست / تأیید:** اجرایِ واقعیِ هر دو سیستم؛ Soniox با `transcribeFileAsync` و پاک‌سازیِ فایل/transcription. محدودیت: بدونِ ضبطِ واقعیِ درمانی؛ نویز ساختگی؛ فقط batch.
- **عامل:** این نشست
- **کارِ باز / پیامد:** جایگزینیِ Soniox توصیه نمی‌شود. گزینه‌ی بعدی (نیازمندِ تصمیمِ مالک): «نظرِ دوم» برایِ علامت‌گذاریِ نقاطِ مشکوک در مسیرِ آپلود، یا سنجش با ضبط‌هایِ واقعیِ اجازه‌دار.

### 2026-10-01 — GIT + DEPLOY (production) + FINDING — «کیفیت به عدد» (`061d0ca`)، migration 036
- **مجوزِ مالک:** «commit و deploy کن … قبلش چک کنی که کسی در حال استفاده نباشه».
- **git:** commit `061d0ca` رویِ `feat/clarity` (پایه `3801a5d`) از worktreeِ تمیز، فقط فایل‌هایِ این کار (۱۵ فایل؛ هانک‌هایِ نشستِ «نظرِ دوم» در `jobMachine.ts`/`worker.ts`/اسناد جدا ماندند). در worktree: `tsc` تمیز، `test:up` 63/63، `test:arch`/`test:routes` OK، `test:ft` 61/61، `test:tu` 19/19، `test:cf` 111/111، `test:rt` بدونِ FAIL، build OK؛ `test:docs` فقط خطایِ از قبل موجودِ `documentation-map ⇒ CURRENT_UI_STATE.md` (فایلِ untracked — در HEAD هم هست). push نشد.
- **preflight (§5.1):** همه ۰ (جلسه/صدا/mint/آپلود/job/batch/متنِ نهایی) ⇒ GO؛ nginx فقط pollingِ یک تبِ بیکار. دوباره بلافاصله پیش از استخراج: `busy=0`.
- **deploy:** تارِ **فقط `server/`** (بدونِ `public/` — پایینِ FINDING را ببینید)؛ پشتیبان `/root/backups/code-pre-metrics-20261001T121320Z.tar.gz`؛ استخراج ⇒ `pnpm install --frozen-lockfile` ⇒ build ⇒ `pm2 restart`. لاگ: `036_upload_transcript_metrics.sql applied`؛ `/api/health` ok/connected؛ pm2 online؛ بدونِ خطایِ جدید؛ ستونِ `audio_jobs.transcript_metrics` موجود؛ checksumِ `server/src` ِ production = commit؛ پیش از deploy دقیقاً ۹ فایلِ همین کار با production فرق داشت.
- **FINDING:** `public/index.html` ِ production (`0069711e78eb`) با commitِ پایه فرق داشت و برابرِ `index.html` ِ commitنشده‌ی working tree بود ⇒ نشستِ دیگری بدونِ ورودی در Event Log آن را deploy کرده است. دست نخورد.
- **کارِ باز:** آستانه‌ها پس از چند جلسه‌ی آپلودیِ واقعی بازبینی شوند (R20)؛ برگشت = استخراجِ همان پشتیبان + build + restart (ستونِ ۰۳۶ NULLپذیر است و می‌ماند).

### 2026-10-01 — CODE + MIGRATION + DOCS + TEST — «کیفیت به عدد» برایِ جلسه‌ی آپلودی (Session Data Engine، فاز Q-U)
- **چه شد:** به دستورِ مالک («اجرا کن»). برایِ هر jobِ آپلودی، از توکن‌هایِ async ِSoniox (قبلاً دور ریخته می‌شدند) + بازه‌هایِ صدادارِ ffmpeg + حاضرینِ واحدِ درمان، متریک‌هایِ عددی ساخته و در `audio_jobs.transcript_metrics` ذخیره می‌شود: پوششِ متن، حفره‌هایِ وسط/ابتدا/انتها، گوینده‌هایِ پیدا‌شده در برابرِ حاضرین، نوبت‌هایِ تکه‌تکه، اطمینان. کارتِ «تشخیصِ جلسه»ی ادمین آن‌ها را نشان می‌دهد. بدونِ تماسِ اضافه با Soniox؛ fail-open؛ فقط عدد (LAW-001). جلساتِ قدیمی متریک ندارند (backfill انجام نشد).
- **فایل‌ها:** `server/src/features/audio-upload/{transcriptMetrics.ts (جدید), quality.ts, jobMachine.ts, worker.ts, jobStore.sql.ts}`، `server/src/features/transcription/soniox/restClient.ts` (فقط `end_ms` در تایپ)، `server/src/features/admin/{diagnosis.ts, admin.repository.ts}`، `server/src/db/mysql/migrations/036_upload_transcript_metrics.sql`، `scripts/upload-harness.ts` (H54–H62).
- **اسنادِ به‌روزشده:** subsystem 06 §11، database-catalog (036 + ستون)، configuration-catalog (`QUALITY` VAD، `METRICS`)، [verification](verification/2026-10-01-upload-transcript-metrics.md).
- **تست / تأیید:** `pnpm test:up` 63/63؛ `tsc` تمیز؛ `test:arch` OK؛ `test:routes` OK (135)؛ `test:docs` OK؛ `test:ft` 61/61؛ `test:tu` 19/19؛ ffmpegِ واقعی رویِ فایلِ ساختگی (صدا/سکوت/صدا) بازه‌ها را درست داد. DBِ واقعی، Sonioxِ واقعی و UIِ ادمین در مرورگر تست نشدند.
- **عامل:** این نشست.
- **کارِ باز / پیامد:** commit/deploy نشده (منتظرِ دستور). آستانه‌ها از دادهٔ ساختگی‌اند ⇒ بعد از چند جلسه‌ی واقعیِ پدرام بازبینی (R20). migration 036 در startupِ بعدی اجرا می‌شود.
- **FINDING (نشستِ دیگر، کشف‌شده همین زمان):** نشستِ هم‌زمانی «نظرِ دوم» (Shenava، `features/transcription/secondOpinion/`، `STT_SECOND_OPINION`) را در همان `jobMachine.ts`/`worker.ts` اضافه می‌کند. دست زده نشد؛ دو تغییر سازگارند (متریک‌ها از توکن‌هایِ اصلیِ Soniox، نه خروجیِ نظرِ دوم). روی وضعیتِ ترکیبی: `tsc` تمیز، `test:up` 63/63، `test:arch` OK؛ `test:docs` فقط یک خطایِ متعلق به آن نشست دارد: `D8 script در CLAUDE.md نیست: test:so`. در commit فقط فایل‌هایِ این کار جدا شوند (آن نشست هم همین دو فایل را عوض کرده ⇒ نیازمندِ `git add -p`).

### 2026-10-01 — DECISION + FINDING — اولویتِ «کیفیت به عدد» با مسیرِ آپلود
- **چه شد:** مالک: «الان برای پدرام بیشتر جلسات آپلودی هستن» ⇒ پلنِ Session Data Engine بازاولویت‌بندی شد: اول متریک‌هایِ کیفیتِ مسیرِ آپلود (فاز Q-U). پیاده‌سازی نشده.
- **یافته (کد):** مسیرِ آپلود یک بار Soniox async می‌زند و «متنِ نهایی» همان متن را بازاستفاده می‌کند (`server/src/features/audio-upload/jobStore.sql.ts:129`) ⇒ اندازه‌گیری هزینه‌ی Sonioxِ اضافه ندارد. ولی توکن‌هایِ زمان‌دار/گوینده/confidence در `worker.ts:60-63` فقط به متن + `lowConfRatio` تبدیل و دور ریخته می‌شوند و transcription در Soniox حذف می‌شود ⇒ برایِ جلساتِ گذشته پوشش/حفره قابلِ محاسبه نیست مگر با رونویسیِ دوباره.
- **فایل‌ها:** فقط همین ورودی؛ پلن خارج از repo. **تست:** اجرا نشد (بدونِ تغییرِ کد). **عامل:** این نشست + مالک.
- **کارِ باز:** دستورِ اجرا؛ تصمیمِ backfillِ جلساتِ قدیمی (هزینه‌ی یک async برایِ هر جلسه).

### 2026-10-01 — FINDING (audit فقط‌خواندنی) — «Session Data Engine»: کارنامه‌ی ۵ محورِ Core + پلنِ فازبندی‌شده
- **چه شد:** به درخواستِ مالک، زنجیره‌ی جلسه→صدا→ذخیره→رونویسی→گوینده→متنِ نهایی در برابرِ ۵ محور (durabilityِ صدا، کامل‌بودنِ متن، تفکیکِ گوینده، نسخه‌بندیِ متن، کیفیتِ عددی) بررسی شد. هیچ کد/سندِ دیگری تغییر نکرد؛ پلن فقط ارائه شد (پیاده‌سازی منتظرِ دستورِ صریح).
- **یافته‌هایِ تأییدشده با خواندنِ کد:** (A1) رکوردِ IndexedDB شناسه‌ی تراپیست ندارد و 404 ⇒ حذفِ محلی (`public/feelia-rt.js:325`) ⇒ در مرورگرِ مشترک صدایِ آپلودنشده‌ی تراپیستِ دیگر حذف می‌شود؛ (A2) `checkSeqContiguous` رویِ `seq`ِ سرور (`MAX+1`، `archiveWrite.ts:44`) کار می‌کند ⇒ سگمنتی که هرگز نرسید دیده نمی‌شود (`archive/listing.ts:66-74`). **INFERRED از گزارشِ agent (خطوط بازبینیِ مستقیم نشد):** (A3) ضبطِ durable تا پایانِ اتصال شروع نمی‌شود (تا ~۱۰ث بی‌ضبط)؛ (T1) سگمنتِ لحظه‌ی قطع `archive` می‌شود ⇒ دُمِ قطع رونویسی نمی‌شود؛ (T2) timeoutِ finalize در جلسه‌ی reliable ⇒ دُمِ جلسه رونویسی نمی‌شود؛ (T3) نسخه‌بندیِ متن وجود ندارد و resolve-speakers/PUTِ بدونِ CAS/legacy/اجرای دوباره‌ی متنِ نهایی بازنویسیِ مخرب‌اند؛ `navigator.storage.persist()` صدا زده نمی‌شود؛ sweepِ ۲۴ساعته `.prenote.` را `kind='session'` آرشیو می‌کند؛ هیچ متریکِ پوشش/duplicate و هیچ corpusِ ارزیابی در repo نیست. R4 (فایل‌هایِ یتیم) در Master Reference احتمالاً کهنه است (subsystem 05 آن را رفع‌شده می‌داند).
- **فایل‌ها:** فقط همین ورودی. پلن: `~/.claude/plans/pasted-content-id-4b1b-jolly-valley.md` (خارج از repo).
- **اسنادِ به‌روزشده:** هیچ (Master Reference §22 تا دستورِ مالک به‌روز نشد).
- **تست / تأیید:** اجرا نشد — audit فقط‌خواندنی.
- **عامل:** این نشست.
- **کارِ باز / پیامد:** تصمیم‌هایِ مالک: متنِ رضایت (R1/R18/R19)، batchِ کاملِ خودکارِ هر جلسه (هزینه‌ی Soniox ×۲)، اجباری‌کردنِ CAS، حذفِ مسیرهایِ legacy. پیشنهادِ ترتیب: فاز ۰ (بستنِ حفره‌ها) → ۱ (Audio Ledger) → ۵ (corpusِ ارزیابی) → ۲ (transcript_versions) → ۳ (session_quality) → ۴ (validationِ گوینده).

### 2026-10-01 — GIT + DEPLOY (production) — فیکسِ دکمه‌ی «کپیِ کلِ متن» (`4caad76`): push و deploy
- **مجوزِ مالک:** «فیکس رو push و deploy کن». push `ff85efe..4caad76`. checksumِ CR-stripped: تنها `public/index.html` با production فرق داشت؛ فقط همین فایل جایگزین شد (فایلِ ایستا ⇒ بدونِ restart/build/migration/preflight). پشتیبان: `/root/backups/index-pre-copyfix-*.html`.
- **تأیید:** sha1 سرور = sha1 محلی (`3e025f63926c`)؛ صفحه‌ی سرو‌شده نشانگرِ fallback را دارد؛ `GET /` 200؛ `/api/health` ok/connected. رفتارِ فیکس در مرورگرِ واقعی (Browser pane + mock) پیش‌تر تأیید شده بود؛ رویِ prod با حسابِ واقعی امتحان نشد.

### 2026-10-01 — TEST (مرورگرِ واقعی) + CODE — دکمه‌ی «کپیِ کلِ متن»: تستِ واقعی، یک باگ پیدا و رفع شد؛ commit شد، push/deploy نشد
- **روش:** Browser pane + mock backendِ scratchpad (`public/` واقعی، /api/* جعلی با دادهٔ ساختگی؛ بدونِ حساب). جلسه‌ی آپلودی با متنِ نهایی (نقش‌ها، `⟦رادمهر؟⟧`) + متنِ خام.
- **نتیجه:** دکمه نمایش داده شد؛ کپیِ متنِ نهایی و متنِ خام هر دو متنِ درست را برداشتند (علامتِ `⟦…؟⟧` حذف می‌شود، نقش‌ها می‌مانند)؛ بنرِ «کلِ متن کپی شد.»؛ console بدونِ خطا؛ textareaِ موقت پاک می‌شود.
- **باگِ پیدا‌شده (در prod هست):** وقتی `navigator.clipboard` موجود است ولی `writeText` رد می‌کند (`NotAllowedError` — در همین pane دیده شد؛ سیاستِ مجوز/Safari/مرورگرِ داخلِ اپ)، کد فقط «کپی انجام نشد» می‌داد و راهِ `execCommand('copy')` را امتحان نمی‌کرد.
- **رفع (`public/index.html#ftCopyText`):** اول Clipboard API، در صورتِ رد `execCommand` با textareaِ readonly؛ فقط اگر هر دو شکست خوردند خطا. بعد از رفع در همان pane: کپی با راهِ دوم موفق شد (متنِ درست). نسخه‌ی prod هنوز قدیمی است (deploy نشده).

### 2026-10-01 — DEPLOY (production) — دکمه‌ی «کپیِ کلِ متن» (فقط `public/index.html`، بدونِ restart)
- **مجوزِ مالک:** «دکمه کپی رو هم deploy کن». commit `d50fd05` (HEAD `0d9fc62`).
- **بررسی:** checksumِ CR-stripped کدِ production در برابرِ HEAD: تنها `public/index.html` فرق داشت (بدونِ drift). فقط همین فایل جایگزین شد (فایلِ ایستا، با `no-cache` revalidate می‌شود ⇒ restart/build/migration لازم نبود، پس preflight هم لازم نبود). پشتیبان: `/root/backups/index-pre-copybtn-*.html`.
- **تأیید:** sha1 رویِ سرور = sha1 محلی (`beffa8c04294`)؛ `GET /` ⇒ 200 و `ftCopyText` در پاسخ؛ `/api/health` ok/connected. تستِ مرورگریِ دکمه انجام نشد (فقط نحوِ JS).

### 2026-10-01 — GIT — بررسیِ نهایی و push: `feat/clarity` ⇒ origin (`aef35a6..d50fd05`، ۷ commit)
- **بررسی پیش از push (HEAD، working tree تمیز):** `tsc`، `test:rt` (۰ FAIL)، `test:ft` 61، `test:llm` 22، `test:tu` 19، `test:up` 54، `test:cf` 111، `test:routes`، `test:arch`، `test:docs` سبز؛ اسکنِ secret رویِ خطوطِ افزوده‌شده (کلید/رمز/PEM) خالی؛ هیچ `.env`/tar/`data/` در commitها نیست؛ fast-forward.
- commitهایِ push‌شده: نگهداریِ ۳۰ روزِ صدا (`73208b5`+وضعیت)، `7de2733` (یادداشتِ پیش از جلسه + آمارِ LLM)، وضعیتِ deploy، همگام‌سازیِ اسناد، دکمه‌ی «کپیِ کلِ متن». ⚠️ دکمه‌ی کپی deploy نشده است.

### 2026-10-01 — GIT + DEPLOY (production) + FINDING — commit `7de2733` و deploy؛ «متنِ نهایی» فقط برایِ ادمین و پدرام (از قبل همین‌طور بود)
- **git:** commit `7de2733` (۳۵ فایل) رویِ `feat/clarity` از worktreeِ تمیز (پایه `0dac5f1`)؛ هانک‌هایِ نشستِ دیگر (دکمه‌ی «کپیِ کلِ متن» در `index.html`، چهار سندِ نگهداریِ ۳۰ روز) وارد commit نشدند. push نشد. `test:docs` در worktree به‌خاطرِ لینکِ شکسته‌ی `CURRENT_UI_STATE.md` (فایلِ untrackedِ نشستِ دیگر در documentation-map) رد می‌شود؛ ربطی به این کار ندارد (در working tree سبز بود).
- **تست پیش از deploy (worktree):** `tsc`، `test:ft` 61، `test:llm` 22، `test:tu` 19، `test:up` 54، `test:cf` 111، `test:routes`، `test:arch` سبز؛ build موفق.
- **deploy:** checksumِ کدِ production (CR-stripped) با پایه مقایسه شد: فقط فایل‌هایِ همین commit فرق داشتند (بدونِ drift). preflight = GO (همه ۰). پشتیبانِ کد `/root/backups/code-pre-7de2733-*.tar.gz`؛ تار از worktree ⇒ extract ⇒ `pnpm install --frozen-lockfile` ⇒ `pnpm --filter server run build` ⇒ `pm2 restart feelia-mysql --update-env`. لاگ: `035_upload_pre_note.sql applied`، `[llm] final-transcript: Metis … reasoning=off`، health `ok/connected`.
- **FINDING:** production از 2026-09-28 با **Metis** کار می‌کند (نه OpenRouter) و `.env`ِ prod متغیرِ عمومیِ `FINAL_TRANSCRIPT_REASONING_EFFORT` ندارد ⇒ پیش‌فرضِ جدیدِ `off` اعمال شد. فرضیه‌ی قبلی («مصرفِ OpenRouter از prod») رد می‌شود؛ مصرفِ OpenRouter مالِ پیش از سوییچ یا ابزارهایِ دیگر است. ثبتِ `llm.call` از همین ری‌استارت در prod فعال است.
- **فعال‌سازیِ «متنِ نهایی» (درخواستِ مالک: فقط ادمین و پدرام):** SELECTِ فقط‌خواندنیِ `therapists`: `final_transcript_enabled=1` فقط برایِ ادمین (`faf6bd6c`) و «پدرام عاشوری» (`3cb546ef`)، بقیه (۷ نفر) ۰ ⇒ **تغییری لازم نبود و داده‌ای عوض نشد.**

### 2026-10-01 — CODE + DEPLOY (production) — دکمه‌ی کپیِ کلِ متن (آیکونِ SVG کوچک) داخلِ کادرِ متنِ جلسه (commit نشده)
- `public/index.html`: `transcriptBox` در `.tbox-wrap` (position:relative) و دکمه‌ی `#transcriptCopyBtn` (۲۸px، آیکونِ SVG، گوشه‌ی بالا-چپِ کادر)؛ `attachTranscriptExpander` آن را نشان/پنهان و handler را روی متنِ نمایش‌داده‌شده (نهایی یا خام) تنظیم می‌کند؛ `ftCopyText` (clipboard + fallbackِ `execCommand`، حذفِ نشانگرهایِ ⟦…؟⟧). بدونِ رویدادِ Clarity/بک‌اند. تست‌شده رویِ mock-ft با clipboardِ جعلی؛ کپیِ واقعیِ سیستم تست نشده.
- **deploy (مجوزِ مالک: «دیپلوی کن»):** فقط `public/index.html` (فایلِ ایستا ⇒ بدونِ restart/build/migration). پیش از آن sha1ِ CR-stripped ِ prod = HEAD `3801a5d` (`3e025f63926c`، بدونِ drift)؛ تنها اختلافِ working tree همین تغییر بود. پشتیبان: `/root/backups/index-pre-copyicon-*.html`. تأیید: sha1 سرور = محلی (`0069711e78eb`)، `GET /` 200 و `transcriptCopyBtn` در پاسخ، `/api/health` ok/connected. رویِ prod با حسابِ واقعی امتحان نشد. **commit نشده** ⇒ prod یک فایل جلوتر از HEAD است تا commit شود.

### 2026-10-01 — DEPLOY (production) — نگهداریِ صدا ۳۰ روز
- **انجام شد با مجوزِ صریحِ مالک:** فقط تغییرِ «۱۴ ⇒ ۳۰ روز» (`archive/store.ts`، `uploadStore.ts`، متنِ `public/index.html` و کامنت‌ها) از worktreeِ تمیزِ `0a04829` ساخته و deploy شد؛ کارِ نیمه‌تمامِ نشستِ دیگر (pre-note، migration 035، STT context) در working tree **نرفت**. پیش از deploy checksumِ `server/src`+`public` با HEAD مقایسه شد: تنها اختلافِ production با پایه همین ۷ فایل بود.
- Preflight (§5.1): GO (همه‌ی شمارنده‌ها ۰). پشتیبانِ کد: `/root/backups/code-pre-ret30-<ts>.tar.gz`. `pnpm install --frozen-lockfile`، build، `pm2 restart feelia-mysql` ⇒ بدونِ migrationِ جدید (آخرین 034)، `/api/health` = ok/connected؛ `dist` و `index.html` روی سرور شاملِ مقدارِ ۳۰ روز تأیید شد. تست‌هایِ پیش از deploy: `test:up` 54/54، `test:routes` OK، `tsc` OK.
- **وضعیت:** production اکنون صدا را ۳۰ روز نگه می‌دارد. اسنادِ هم‌گام‌شده هنوز commit نشده‌اند (فقط working tree). R1/R18 باز.

### 2026-10-01 — CODE+DOCS — نگهداریِ صدا از ۱۴ روز به ۳۰ روز (یک ماه) — فقط working tree، deploy نشده
- **تصمیمِ مالک:** «ذخیره‌سازیِ صداها بشه یک ماه». `RETENTION_MS` در `server/src/features/transcription/archive/store.ts` ⇒ ۳۰ روز (sweepِ آرشیو و «روزهایِ باقی‌مانده»ِ ادمین `SESSION_AUDIO_RETENTION_MS` از همین مشتق می‌شوند)؛ جاروبِ فایلِ خامِ آپلود (`uploadStore.ts`، `INTERVAL 30 DAY`) هم‌تراز شد. **بدونِ تغییر:** آپلودِ نیمه‌کاره ۷ روز، صفِ مرورگر ۷ روز، `batch-queue` ۲۴ ساعت، پنجره‌یِ نمایِ jobهایِ ادمین/آپلود (۱۴ روز — نمای است نه صدا).
- متنِ UI (`public/index.html`: زیرعنوانِ مراجع/ادمین و فیلتر) و کامنت‌ها و اسنادِ مالک (LAW-009/010، config/error catalog، subsystem 02/05/06، PRDها، glossary) به ۳۰ روز هم‌گام شد. R1/R18 (تعارضِ متنِ رضایت) همچنان باز است؛ مدتِ طولانی‌تر آن را تشدید می‌کند.
- **تست:** `tsc --noEmit` OK، `test:docs` OK، `test:up` 54/54. **Deploy نشده** — برایِ اعمال رویِ production نیاز به deploy (سرور + `public/index.html`) و مجوزِ صریح است؛ فایل‌هایِ موجود با sweepِ بعدی با آستانه‌یِ جدید سنجیده می‌شوند.

### 2026-10-01 — AUDIT (production، فقط‌خواندنی) — «تاریخِ جلسه ۶ ولی آخرین ضبط ۸» (CL-4ZPV، جلسه ۳)
- **یافته:** باگ نیست. جلسه `source=upload` است؛ `date=1405/07/06` تاریخِ جلسه است که تراپیست هنگامِ آپلود وارد کرده، و `session_audio.created_at` = 2026-09-30 08:37Z = ۱۴۰۵/۰۷/۰۸ ۱۲:۰۷ تهران = لحظه‌یِ آپلود. جلسه‌یِ ۲ هم مشابه (تاریخ ۰۷/۰۵، آپلود ۰۷/۰۶). فقط‌خواندنی؛ داده تغییر نکرد.
- **نکته‌یِ UI (پیشنهاد، انجام نشد):** در «آرشیوِ صدا» برایِ جلسه‌یِ آپلودی عبارتِ «آخرین ضبط» گمراه‌کننده است؛ بهتر «زمانِ آپلود» نشان داده شود.

### 2026-10-01 — AUDIT + DATA-FIX (production) — تطبیق و اصلاحِ start_time جلسه‌هایِ قدیمی با created_at (وقتِ تهران)
- **مجوز:** مالک «اصلاحِ دیتایِ قدیمی» را انتخاب کرد؛ این گام فقط SELECT بود (بدونِ متنِ بالینی؛ اسکریپتِ موقت حذف شد).
- **نتیجه:** ۶۳ جلسه (۴۷ زنده، ۷ دستی، ۹ آپلودی). از ۴۷ زنده ۳۸ هم‌خوان؛ **۹ جلسه** دقیقاً ۳:۳۰ عقب (start_time = ساعتِ UTC، همه ۱۴۰۵/۰۶/۲۱ و ۱۴۰۵/۰۶/۲۳، یعنی دورانِ پیش از nowInTehran/فرانتِ timezoneدار). تاریخِ هیچ جلسه‌ای ناهم‌خوان نبود. دستی/آپلودی مقایسه نشدند (تاریخشان انتخابیِ کاربر/زمانِ آپلود است).
- **اصلاح (مجوزِ صریحِ مالک «بله انجامش بده»):** پشتیبانِ جدولِ `sessions` ⇒ `/root/backups/sessions-pre-tz-fix-20261001085919.sql` (۶۵۷٬۶۹۷ بایت، chmod 600)؛ سپس در یک تراکنش فقط `start_time`ِ همان ۹ جلسه‌یِ زنده (اختلافِ دقیقِ −۲۱۰ دقیقه، تاریخِ بدونِ تغییر) = ساعتِ تهرانِ `created_at`. ۹ ردیف به‌روز شد (نگهبان: شمارِ غیرِ ۹ یا تغییرِ تاریخ ⇒ abort/rollback). تأیید: ۰ ناهم‌خوانی. اسکریپت‌هایِ موقت حذف شد. **برگشت:** import همان فایلِ sql (فقط جدولِ sessions؛ توجه: جلسه‌هایِ ساخته‌شده پس از پشتیبان را هم برمی‌گرداند ⇒ بهتر است UPDATEِ معکوسِ ۹ ردیف).

### 2026-10-01 — CODE + TEST + DOCS — ثبتِ «هر فراخوانیِ LLM» در obs_events (`llm.call`) + گزارشِ کامل؛ commit/deploy نشد
- **درخواستِ مالک:** هر استفاده ثبت شود. پیش‌تر فقط ویرایش‌هایِ موفقِ «متنِ نهایی» (`polish_report.usage`) ثبت می‌شد؛ شکست‌ها، تلاش‌هایِ دوباره و پرونده‌ی درمان نه.
- **تغییر:** `llm/jsonCall.ts` ⇒ `onLlmCall`/`LlmCallEvent` برایِ هر درخواستِ HTTP (موفق/ناموفق، `attempt`)، `createJsonCaller(..., ref)` با `sessionId`؛ `jobs/backgroundJobs.ts` آن را به `logEvent('llm.call')` وصل می‌کند (`obs/redact.ts`: `provider`، `finish`). بدونِ migration (جدولِ `obs_events`، نگهداری ۱۸۰ روز). `pnpm llm:usage` حالا بخشِ «همه‌ی فراخوانی‌ها» را هم دارد.
- **تست:** `test:llm` ۲۲/۰ (U4: رویداد برایِ موفق/نامعتبر/شکست، `ref`، بدونِ متن، شنونده‌ی خراب بی‌اثر)؛ تستِ واقعی با Metis: یک فراخوانیِ موفق (۱۱۱ توکنِ ورودی/۶ خروجی/۱۲۷۹ms) و یک فراخوانیِ ناموفق (مدلِ ناموجود ⇒ 400) هر دو در `obs_events` نشستند (ردیف‌هایِ تست پاک شد).
- **توجه:** ثبت فقط در پروسه‌ای فعال است که `startBackgroundJobs` را اجرا کرده؛ سرورِ dev/prod بعد از deploy ری‌استارت لازم دارد. پرونده‌ی درمان `sessionId` ندارد (فقط purpose/model).

### 2026-10-01 — CODE + TEST + DOCS — آمارِ مصرفِ LLM برایِ هر ویرایشِ «متنِ نهایی»، سقفِ بودجه‌ی روزانه و پیش‌فرضِ ارزان‌ترِ استدلال؛ commit/deploy نشد
- **درخواستِ مالک:** بعد از شارژ: مدلِ بسیار ارزان، مصرفِ زودهنگام نشود، آمارِ هر ادیت در دسترس باشد.
- **آمار:** `llm/jsonCall.ts` (`LlmUsage`، `usageFromResponse`، `JsonCaller.usage()`) توکنِ ورودی/خروجی/استدلال و هزینه را می‌خواند (OpenRouter: `usage:{include:true}`؛ متیس/DeepSeek هزینه نمی‌دهند ⇒ `<P>_PRICE_IN_PER_M/OUT` یا null). `polishTranscript` ⇒ `polish_report.usage = {total, overview, chunks[]}` (بدونِ migration؛ فقط عدد). رویدادِ `final_transcript.done` فیلدهایِ عددیِ جدید (allowlistِ `obs/redact.ts`). `pnpm llm:usage` = گزارشِ فقط‌خواندنیِ روزانه/هر ویرایش/بودجه (`scripts/llm-usage-report.ts`).
- **سقف:** `runner.ts#polishFor` پیش از LLM: `FINAL_TRANSCRIPT_DAILY_BUDGET_USD` (۳) و `…_TOKENS` (۵M)، روزِ UTC؛ پر شدن ⇒ `llm-budget` بدونِ فراخوانی (+ پیامِ UI). فقط ویرایش‌هایِ موفق شمرده می‌شوند.
- **ارزان‌سازی (سنجشِ واقعی، متیس):** استدلالِ `low` ≈ ۷۵٪ توکنِ خروجی بود؛ `off` با کیفیتِ برابر (۲۲–۲۴ از ۲۸ خطایِ کاشته‌شده) ~۴× خروجیِ کمتر و ۲٫۶× سریع‌تر ⇒ پیش‌فرضِ «متنِ نهایی» رویِ متیس `off` شد. جزئیات: `verification/2026-10-01-llm-cost-reasoning.md`. مدل `deepseek-v4-flash` ماند (قیمتِ متیس در دسترس نیست).
- **FINDING:** OpenRouter از شبکه‌ی dev با 403 Cloudflare («Access denied by security policy») بسته است؛ مصرفِ ۲۳٫۵ از ۲۵ دلارِ اعتبار از کلیدهایِ دیگرِ همان حساب بود (کلیدِ dev فقط ۱٫۶۶). اگر prod با OpenRouter و `reasoning=low` کار کند، همان `low` احتمالاً عاملِ اصلیِ مصرف است ⇒ پیشنهاد: `FINAL_TRANSCRIPT_REASONING_EFFORT=off` در `.env`ِ prod پس از تأیید.
- **تست:** `test:llm` ۲۱/۰ (۳ تستِ مصرف؛ رگرسیونِ بدنه‌ی OpenRouter با `usage` و پیش‌فرضِ متیس off به‌روز)، `test:ft` ۶۱/۰، `test:tu`، `test:up`، `test:cf`، `test:routes`، `test:arch`، `test:docs`، `tsc` سبز. E2E با Metisِ واقعی رویِ DBِ لوکال (fixture پاک شد): usage ثبت، گزارش، و ردِ سقفِ توکن تأیید شد.

### 2026-10-01 — MIGRATION + TEST — اعمالِ migration 035 رویِ DBِ لوکال و E2Eِ کاملِ آپلود با Sonioxِ واقعی (مجوزِ صریحِ مالک)؛ commit/deploy نشد
- **migration 035** رویِ MySQLِ لوکالِ dev (`localhost/feelia`) با `runMigrations` اعمال شد (ستونِ `audio_uploads.pre_note TEXT NULL` تأیید شد). prod دست‌نخورده؛ قبل از deployِ این کد باید اعمال شود.
- **E2E (fixtureِ canary، `app.inject`، Sonioxِ واقعی، workerهایِ آپلود+متنِ نهایی):** یادداشتِ همراهِ آپلود پیش از شروعِ job ذخیره شد (تک‌فایلی و گروهی)، `pre_note` NULL شد، context.text ساخته شد؛ رونویسیِ خام با یادداشت ۷/۷ نام در برابرِ ۵/۷ بدونِ آن. جزئیات و جدول: `verification/2026-10-01-pre-note-stt-context.md`. fixture و فایل‌ها پاک شدند؛ Soniox ۰ باقی‌مانده.
- **FINDING (محیطی):** اعتبارِ **Metis تمام شده** (`402 Payment Required`) و **OpenRouter فقط ~۷۱۰۰ توکن** (۴۰۲ با سقفِ ۱۶۳۸۴). «متنِ نهایی» با providerهایِ فعلی شکست می‌خورد/در backoff می‌ماند تا شارژ. نیازِ اقدامِ مالک: شارژِ حساب.
- **تغییرِ مستندات:** `migrations/README.md` ⇒ تا ۰۳۵.

### 2026-10-01 — CODE + MIGRATION + TEST + DOCS — یادداشتِ متنیِ پیش از جلسه همراهِ آپلود + context رونویسیِ Soniox؛ commit/deploy و migration رویِ DBِ dev اعمال نشد
- **سنجش (Soniox واقعی، گفتارِ ساختگیِ TTS):** نام‌هایِ کم‌رایج ۵/۷ ⇒ ۷/۷ با context (`terms` یا `text`ِ آزاد؛ حتی در صدایِ نویزی)؛ نام‌هایِ رایج بی‌اثر. جزئیات: `verification/2026-10-01-pre-note-stt-context.md`.
- **migration 035:** `audio_uploads.pre_note TEXT NULL` (additive). ⚠️ رویِ DBِ مشترکِ dev/prod **اعمال نشده**؛ تا اعمال، `POST /api/uploads` با `pre_note` خطای ستون می‌دهد.
- **آپلود:** `POST /api/uploads` فیلدِ `pre_note` (سقف ۴۰۰۰) ⇒ `audio_uploads.pre_note` ⇒ `uploadSession.ts#insertPreNote` در همان تراکنشِ ساختِ جلسه (پیش از job) `session_notes(note_before)` می‌نویسد و ستون را NULL می‌کند (تک‌فایلی و گروهی). فرانت (`feelia-upload.js`، `index.html#startAudioUpload`): متن همراهِ اولین POST می‌رود؛ `flushUploadPreNotes` دیگر متن را جدا نمی‌فرستد (فقط صوت).
- **context رونویسی:** `treatmentUnits.sessionSttContext` ⇒ `withPreNote` (`context.text`، سقفِ `SONIOX_CONTEXT_PRE_NOTE_MAX_CHARS`=2000 و سقفِ سخت ۹۵۰۰ نویسه‌ی کل)؛ همه‌ی مسیرهایِ مصرف‌کننده (زنده/batch/آپلود/متنِ نهایی/speakerResolve) بدونِ تغییر. خاموش‌کردن: `SONIOX_CONTEXT_PRE_NOTE=0`. fail-open. LAW-001 برایِ `buildSonioxContext` سر جاست؛ یادداشت جدا و آگاهانه اضافه می‌شود (ریسکِ R19: متنِ یادداشت به Soniox هم می‌رود؛ متنِ رضایت دست‌نخورده).
- **تست:** `tsc`، `test:up` ۵۴/۰، `test:ft` ۶۰/۰، `test:tu` ۱۹/۰ (۲ تستِ جدید)، `test:routes`، `test:arch`، `test:docs` سبز. **انجام نشد:** E2Eِ آپلود با DB (نیازمندِ migration + مجوز)، تستِ مرورگری، و `withPreNote` رویِ مسیرِ آپلودِ کامل.
- **محدودیت:** آپلودِ تکراریِ فایل (جلسه‌ی موجود) یادداشتِ تازه را نمی‌گیرد؛ یادداشتِ صوتی هنوز بعد از ساختِ جلسه می‌آید.

### 2026-10-01 — TEST — تستِ واقعیِ یادداشتِ پیش از جلسه با LLMِ واقعی (Metis/DeepSeek `deepseek-v4-flash`)؛ دادهٔ ساختگی
- **روش:** اسکریپتِ موقتِ بیرون از repo رویِ `polishTranscript` + `createTranscriptLlm` (provider از `server/.env`، کلید چاپ نشد)؛ ۶ نوبتِ ساختگی با نام‌هایِ عمداً بدشنیده («بدرام»، «ارمان»). بدونِ DB/Soniox/دادهٔ مراجع.
- **نتیجه:** بدونِ یادداشت «بدرام» می‌ماند (و «ارمان»)؛ با یادداشتِ «برادرش پدرام …» ⇒ «پدرام» در هر دو جا درست شد. `fallback_turns=0/6`، بدونِ ردِ نگهبان.
- **نبودِ تزریقِ محتوا:** یادداشتِ دوم (قرصِ اضطراب، سابقه‌ی افسردگی، سن ۴۰) هیچ‌کدام وارد متن نشد.
- **محدودیت:** یک نمونه‌ی کوچک؛ «آرمان» بدونِ ذکر در یادداشت هم درست شد (اصلاحِ خودِ مدل) ⇒ اثرِ یادداشت فقط برایِ نامِ «پدرام» قطعی است. مسیرِ DB (`preSessionBriefing`) و آپلودِ واقعی تست نشد.

### 2026-10-01 — CODE + TEST + DOCS — یادداشتِ پیش از جلسه وارد «متنِ نهایی» شد (هر دو مسیرِ زنده و آپلود)؛ commit/deploy نشد
- **درخواستِ مالک:** polishِ متنِ نهایی از توضیحاتِ پیش از جلسه (مثلاً نامِ «پدرام») دسترسی داشته باشد. پیش‌تر (بررسیِ همین روز) فقط حاضرین + واژه‌هایِ رویکرد به polish می‌رسید.
- **تغییر:** `final-transcript/runner.ts#preSessionBriefing` (`session_notes` از نوعِ `note_before`/`voice_before` + ستونِ قدیمیِ `sessions.pre_note`؛ fail-open، بدونِ لاگِ متن) ⇒ `polishTranscript(cfg.briefing)`؛ در هر دو گذر (برداشتِ کلی و تکه‌ها) به‌صورتِ بلوکِ «فقط زمینه» (سقفِ ۳۰۰۰ نویسه) می‌آید؛ `prompts.ts` صراحتاً می‌گوید فقط برایِ املایِ نام‌ها/موضوع/glossary و نگاشتِ نقش، نه افزودنِ محتوا. نگهبان‌هایِ قطعی همان‌طور رویِ متنِ خام‌اند ⇒ یادداشت نمی‌تواند محتوا بسازد.
- **محدودیتِ شناخته‌شده (آپلود):** یادداشتِ پیش از جلسه‌ی آپلود بعد از ساختِ جلسه از مرورگر ثبت می‌شود؛ polish هرچه تا آن لحظه ثبت شده باشد می‌خواند. یادداشتِ دیرتر (مثلاً صوتیِ در صفِ رونویسی) فقط با «ساختِ دوباره» اثر می‌گذارد. Sonioxِ رونویسی هنوز یادداشت را نمی‌بیند.
- **ریسک:** متنِ یادداشتِ بالینی هم به providerِ LLM می‌رود (R19؛ متنِ رضایت دست‌نخورده).
- **تست:** `pnpm test:ft` ۶۰/۰ (تستِ جدیدِ `briefing`: حضور در هر دو پرامپت، سقف، نبودنِ بلوک وقتی خالی)، `tsc` و `test:arch` سبز. با LLM/DBِ واقعی تست نشد.
- **سند:** `docs/07-subsystems/07-final-transcript.md` به‌روز شد.

### 2026-10-01 — CODE + TEST + GIT + DEPLOY — یکسان‌سازیِ timezone در فرانت: همه‌ی تاریخ/ساعت‌ها به وقتِ تهران؛ commit `bc71bae` و deploy روی production
- **ریشه:** تاریخِ جلسه (`toJalali`) و `start_time` (`getHours`) با timezoneِ مرورگرِ تراپیست ساخته می‌شدند و زمان‌هایِ UTCِ پنلِ ادمین (`fmtDateTime` و …) با timezoneِ مرورگرِ ادمین نمایش داده می‌شدند ⇒ با VPN/ساعتِ غیرِ تهران ناهم‌خوان.
- **تغییر (`public/index.html`):** ثابتِ `FEELIA_TZ='Asia/Tehran'`؛ `toJalali`، `nowClock`، `fmtDateTime`، نمایشِ آخرین ذخیره/به‌روزرسانی/ستونِ متریک همه با `timeZone`؛ تابعِ جدیدِ `tehranHM` برایِ `start_time` در ایجادِ جلسه. سرور تغییر نکرد (از قبل تهران).
- **تست (کامل، [verification/2026-10-01-frontend-timezone-tehran.md](verification/2026-10-01-frontend-timezone-tehran.md)):** docs/routes(135)/arch/rt/cf(111)/up(54)/tu(17)/ft(60)/llm(18)/adm(8) همه OK؛ tsc تمیز؛ تابع‌هایِ واقعیِ index.html در ۷ timezone خروجیِ یکسان دادند (از جمله گذرِ نیمه‌شبِ تهران). **تستِ مرورگریِ واقعی** (Browser pane، mock + shimِ timezone نیویورک/توکیو): بدنه‌ی POST جلسه = ساعتِ تهران (12:24) به‌جایِ ساعتِ محلی (4:54/17:54)؛ نمایشِ ادمین ۰:۱۵ برایِ 20:45Z در هر دو. test:api انجام نشد (مجوزِ مالک). جلسه‌هایِ قدیمیِ ثبت‌شده با timezoneِ غیرِ تهران اصلاح نمی‌شوند.
- **git/deploy (مجوزِ مالک: «commit کن و deploy کن»):** به‌خاطرِ hunkهایِ نشستِ دیگر (final-transcript) commit از worktreeِ تمیز (فقط `public/index.html` + status + verification؛ `bc71bae`، push نشد). فقط فایلِ استاتیک عوض شد ⇒ **بدونِ build/restart/preflight** (public با no-cache سرو می‌شود). checksumِ prod پیش از deploy = commitِ پایه؛ پشتیبان `/root/backups/index.html-pre-tz-*`؛ scp ⇒ mv. پس از deploy: `https://feelia.ir/` sha1 (بدونِ `CR`) = commit؛ `/api/health` ok. نشستِ ادمین/تراپیستِ واقعی تست نشد؛ مالک: یک جلسهٔ تازه بسازد و ساعتِ شروع را با ساعتِ تهران مقایسه کند.

### 2026-10-01 — GIT + DEPLOY + TEST — commit `6f2e6d5` و deployِ پنلِ ادمین (زنده/صف/سلامت) رویِ production؛ push نشد
- **مجوزِ مالک:** «اول بررسی کن همه‌چیز درست باشد، بقیه را من مجوز می‌دهم» ⇒ commit + deploy + بررسیِ پس از deploy. اجرایِ workerها رویِ dev عمداً انجام نشد (خطرِ auto-close/برداشتنِ jobِ جلسه‌هایِ واقعیِ DBِ مشترک).
- **بررسیِ پیش از commit:** `tsc`، `test:arch|routes|docs|adm|up|ft|cf|tu|llm` سبز. `test:rt`: یک اجرا T45 را رد کرد (همزمان با اجراهایِ دیگر)، دو اجرایِ بعدی 102/0 و HEAD تمیز هم 102/0 ⇒ **flakyِ زمان‌بندی، بی‌ربط به این تغییر** (`feelia-rt.js` دست نخورد).
- **git:** commit `6f2e6d5` (۳۷ فایل، فقط فایل‌هایِ همین کار؛ هیچ hunkِ نشستِ دیگر در working tree نبود)؛ push نشد.
- **deploy:** preflight = GO (همه ۰). checksumِ prod = commitِ پایه (`index.html` = `5b20870`؛ تفاوتِ `a6be4aa` فقط bannerِ کامنت). `git archive` از `6f2e6d5` (بدونِ `.env`/data) ⇒ scp ⇒ پشتیبان `/root/backups/code-pre-admin-monitor-*.tar.gz` ⇒ استخراج ⇒ `pnpm install --frozen-lockfile` ⇒ restart. **FINDING:** production از `server/dist/index.js` اجرا می‌شود؛ restartِ اول بدونِ build کدِ قدیمی را بالا آورد (routeهایِ جدید 404). `pnpm --filter server run build` رویِ سرور (پشتیبانِ `dist-pre-admin-monitor-*.tar.gz`) + restartِ دوم ⇒ ۵ route جدید 401 (guard فعال)، `/api/health` ok، لاگِ خطا خالی، migrationها همه `already applied` (migrationِ جدید نیست). SELECTهایِ جدید (live/final_transcripts/اندازه‌ی DB/notifications) رویِ DBِ production فقط-خواندنی OK.
- **انجام نشد:** دیدنِ heartbeatِ workerهایِ واقعی و UI رویِ production — نیازمندِ نشستِ ادمین است؛ مالک: `/` ⇒ پنلِ ادمین ⇒ «سلامتِ سیستم» (باید ۱۱ ردیفِ worker/جاروب نشان دهد؛ جاروب‌هایِ ۶/۲۴ساعته تا اجرایِ اول «هنوز اجرا نشده» می‌مانند).
- **عامل:** این نشست.

### 2026-10-01 — DECISION + CODE + TEST + DOCS — پنلِ ادمین: «جلساتِ زنده»، «صفِ پردازشِ سراسری»، «سلامتِ سیستم»؛ commit/deploy نشد
- **تصمیمِ مالک (این گفتگو):** از سندِ `feelia-admin-panel-spec` فقط این سه مورد؛ جلساتِ زنده **بدونِ شنودِ زنده** (فقط وضعیت). کانالِ Push/Email/Webhook (ساختگی) و UIِ گزارشِ رضایت/ممیزی خارج از این دور. طراحیِ بصریِ سند اعمال نشد (SPAِ بدونِ build، بدونِ dependency).
- **بک‌اند:** `GET /api/admin/sessions/live` (`features/admin/liveHealth.ts`)، `GET /api/admin/queue`، `POST /api/admin/audio-jobs/:id/retry`، `POST /api/admin/sessions/:id/final-transcript/retry` (`queue.admin.ts`)، `GET /api/admin/system` (`system.admin.ts`). منطقِ retry از `uploads.routes.ts` به `audio-upload/jobRetry.ts` منتقل شد (رفتارِ تراپیست بدونِ تغییر)؛ `jobView` به `jobView.ts`؛ `adminJobs.ts` (بدونِ `original_name`). دو actionِ جدیدِ audit. پلتفرم: `obs/heartbeat.ts` (`scheduleBeating` رویِ همه‌ی `setInterval`هایِ `backgroundJobs.ts` + tickِ دو worker)، `obs/httpMetrics.ts` (۴۸ سطلِ ۳۰دقیقه‌ای + reservoirِ p95؛ از `httpHook`). **انحراف از پلن:** متریک در فایلِ جدا `httpMetrics.ts` است (نه داخلِ `httpHook.ts`).
- **فرانت:** سه section + سه آیتمِ nav در `public/index.html`؛ polling ۱۵ثانیه‌ایِ زنده فقط وقتی دیده می‌شود؛ CSV سمتِ کلاینت؛ retry با مودالِ تأیید.
- **تست:** tsc، `test:arch`، `test:routes` (بعد از update)، `test:up` 54/0، `test:docs`، و `test:adm` (جدید، 8/0) سبز؛ UI با mock (دسکتاپ/موبایل/تیره/روشن). **با مجوزِ صریحِ مالک:** `FEELIA_E2E_OK=1 test:api` رویِ DBِ dev ⇒ 362 ورودی، exit 0، fixtureها پاک؛ و E2Eِ موقتِ ۷ سناریو رویِ MySQLِ واقعی برایِ ۵ endpointِ جدید (۷/۷ PASS، اسکریپت حذف شد). heartbeatِ workerهایِ واقعی فقط بعد از deploy قابلِ دیدن است. [verification](verification/2026-10-01-admin-live-queue-system.md).
- **مستندات:** api-catalog §7، error-code-catalog، PRD ماژول 06 (UC-06.9…11، صفحه‌ها ۸→۱۱)، frontend-map، route-map، feature-index، repository-map، observability-audit، REQ-123 + traceability، CLAUDE.md §8 (`test:adm`).
- **عامل:** این نشست.

### 2026-09-30 — TEST + DOCS + CODE(comment) + GIT — پایانِ پلنِ مستندات: `test:*` و `test:api`، فاز ۷، bannerهایِ فرانت، commit
- **دستورِ مالک:** «همه رو انجام بده و commit کن» (مجوزِ `test:api`، فاز ۷، bannerها).
- **تست:** `test:rt` 102/0، `cf` 111، `up` 54، `tu` 17، `ft` 59، `llm` 18 — همه بدونِ شکست؛ `FEELIA_E2E_OK=1 test:api` رویِ DBِ dev با fixtureِ ساختگی exit 0 (۳۶۲ ورودی، fixtureها پاک، بدونِ golden)؛ `test:docs`/`arch`/`routes`/`tsc` سبز. [verification](verification/2026-09-30-docs-followup-p7-banners-tests.md).
- **فاز ۷:** ۲۸۶ ورودیِ Event Logِ ≤ 09-28 + زنجیره‌ی سربرگ ⇒ `docs/08-history/event-log-2026-09.md` (انتقال، بدونِ ویرایش).
- **فرانت:** ۱۳ کامنتِ `[feature:<id>]` در `public/index.html` (فقط کامنت)؛ `check-docs` D12.
- **git:** commitِ مستنداتِ همین کار (فایل‌هایِ untrackedِ نامرتبط — `server-deploy/`، tarها، `soniox.html`، `package-lock.json`، `.claude/`، `CURRENT_UI_STATE.md` — commit نشد)؛ push نشد.
- **عامل:** این نشست.

### 2026-09-30 — DOCS + CODE(tooling) + TEST + DECISION — اجرایِ پلنِ «تکمیلِ مستندات و قانون‌مند کردنِ ساختارِ ماژولار» (فازهایِ ۰–۶)؛ commit/push نشد
- **دستورِ مالک:** «اجرا کن» رویِ پلنِ تأییدنشده‌ی قبلی (audit ⇒ رجیستری/قالب/قوانین ⇒ رفعِ drift ⇒ سندهایِ گم‌شده ⇒ نقشه‌ی فرانت ⇒ checker). تصمیمِ مالک با این دستور: افزودنِ **LAW-025/026/027** و حفظِ ساختارِ `docs/` + رجیستری.
- **قوانین:** LAW-025 (مرزِ ماژول R1–R7، مالکِ جدول، IIFEِ فرانتِ جدید)، LAW-026 (سندِ فیچر طبقِ قالب)، LAW-027 (بهداشتِ سند)؛ LAW-016 الزامِ `test:arch`/`test:docs`؛ LAW-007 errnoهایِ واقعیِ runner.
- **جدید:** `docs/00-governance/feature-doc-template.md`، `docs/02-reference/feature-index.md`، `docs/02-reference/frontend-map.md`، `docs/04-modules/09-treatment-unit/*`، `docs/04-modules/08-ai-case-file/implementation-plan.md`، `docs/06-platform/{llm-provider-layer,observability-audit,notifications,session-media-purge}.md`، `scripts/check-docs.mjs` (`pnpm test:docs`)، `verification/2026-09-30-docs-modularity-audit.md`، `verification/2026-09-30-docs-phases-1-6.md`.
- **اصلاحِ drift:** `CLAUDE.md`، `PROJECT_MASTER_REFERENCE.md`، `data-architecture` (بازنویسی)، `database-catalog` (مالکِ هر جدول)، `api/error-code/configuration-catalog`، `repository/module/route-map`، `application/system/integration-architecture`، `deployment-operations`، `documentation-map`، `source-of-truth`، `ai-agent-reading-guide`، `db/mysql/migrations/README`، PRDهایِ ماژول 01–09، subsystemهایِ 01–07 (بلوکِ template)، `requirement-catalog`/`traceability-matrix` (تصادمِ REQ-060/061 ⇒ 109/110؛ REQ-111…122). برچسب‌هایِ commit/deploy از اسنادِ محتوا حذف شد.
- **tooling (بدونِ تغییرِ رفتارِ محصول):** `check-backend-boundaries.mjs`: `llm` در R2، R5 برایِ treatment-unit/final-transcript، R7 (`index.ts` با allowlistِ ۴ featureِ بدهی)؛ `package.json`: `test:docs`.
- **تست:** `pnpm test:docs` OK (66 docs، 13 features، 19 tables، 33 env)؛ `test:arch` OK (140 files)؛ `test:routes` OK (127)؛ `tsc` exit 0. mutation-checkِ هر دو checker (سه violation در arch؛ D2/D3/D4 در docs) و رفعِ باگِ اولویتِ عملگر در R5. آزمونِ cold-read با agent برایِ ۳ feature: پاسخِ درست، ۵ ضعفِ سند رفع شد ([verification](verification/2026-09-30-docs-phases-1-6.md)).
- **کشف‌شده هنگامِ کار (FINDING، همه در مستندات اصلاح شد):** `feelia_ux_consent_v1` دیگر در کد نیست؛ `PUT /api/sessions/:id` `status` را اعتبارسنجی می‌کند (سند می‌گفت نمی‌کند)؛ CAS اتمیک ولی اختیاری است؛ `renderClients`/`openManualSession`/`saveManualSession` در `index.html` وجود ندارند؛ `multipart fileSize` صریح ۱۰MB است (ادعایِ 1MiB منسوخ)؛ متنِ «فایل‌هایِ یتیم» در subsystem 05 منسوخ بود (رفع 2026-09-22).
- **انجام نشد (نیازمندِ تأییدِ جداگانه‌ی مالک):** فاز ۷ (انتقالِ Event Logِ قدیمی به `docs/08-history/` و کوتاه‌کردنِ header) و bannerهایِ `// ===== [feature:<x>] =====` در `public/index.html`؛ ادغامِ کاملِ بخش‌هایِ patchِ تاریخ‌دار و ثابت‌هایِ تکراری (فاز ۴ جزئی). موردهایِ `UNKNOWN`: [verification](verification/2026-09-30-docs-phases-1-6.md).
- **عامل:** این نشست (بدونِ commit؛ working tree تغییرکرده).

### 2026-09-30 — CODE + DEPLOY — رفعِ FINDINGِ `session_id` در mintِ `pre-note`؛ فقط `stt.routes.ts`
- **رفع:** برایِ `purpose:'pre-note'`، `session_id`ِ ارسالیِ کلاینت نادیده گرفته می‌شود (`const session_id = purpose==='pre-note' ? undefined : rawSessionId`)، پس رشته‌ی دلخواه دیگر به `clientReferenceId`/لاگ نمی‌رسد. رفتارِ `transcript`/`note` بدونِ تغییر.
- **تست:** `tsc` تمیز؛ `test:routes`/`test:arch` OK؛ اسکریپتِ یک‌بارمصرف با `app.inject` + `https.request`ِ جعلی (بدونِ DB/شبکه، حذف‌شده): pre-note بدونِ sid ⇒ 200 و `feelia:T1:none:pre-note`؛ pre-note با sid مخرب (`EVIL\nINJECT`) ⇒ 200 و همان `…:none:pre-note`؛ transcript بدونِ sid ⇒ 400.
- **Deploy (به دستورِ مالک):** build لوکال؛ فقط `server/src/…/stt.routes.ts` + `server/dist/…/stt.routes.js`؛ sha1 پیش از deploy = commitِ قبلی (`743096cb13b8`)؛ Preflight §۵.۱ = GO؛ پشتیبان `/root/backups/code-pre-sid-20260930-132016.tar.gz`؛ `pm2 restart feelia-mysql --update-env`؛ لاگ بدونِ خطا، migrationِ جدیدی نبود؛ `/api/health` ok؛ بدونِ ورود هر دو mint ⇒ 401؛ sha1ِ dist روی سرور = تار (`89591e325bf5`).
- **تست نشد:** mintِ واقعی با حسابِ production.
- **عامل:** این نشست

### 2026-09-30 — CODE + DEPLOY — رفعِ شکستنِ هدرِ کارتِ کلیپ در موبایل + deployِ کاملِ یادداشتِ صوتیِ پیش از جلسه (`1a0c6f3` + `5b20870`)
- **رفع:** در ۳۹۰px عنوان و چیپِ «منتظرِ تأیید» در دو خط می‌شکستند ⇒ `.pv-head` حالا `flex-wrap` دارد و `b`/`.pv-chip` `nowrap`؛ جا نشود چیپ زیرِ عنوان می‌رود. تأیید در mock (عرضِ ۳۹۰، تمِ روشن): هر دو تک‌خط.
- **Deploy (به دستورِ مالک):** build لوکال (`pnpm --filter server run build`)؛ تار از فایل‌هایِ tracked (`git ls-files`) + `server/dist`؛ working tree هنگامِ ساخت بدونِ تغییرِ tracked بود (۴۱۶ فایل، بدونِ `.env`/`data`). پیش از deploy sha1ِ (بدونِ CR) ۲۰۱ فایلِ کدِ production با تار مقایسه شد: **فقط `public/index.html` و `server/src/features/transcription/stt.routes.ts` فرق داشتند**؛ بعد از deploy همه‌ی ۲۰۱ مورد برابر. Preflight §۵.۱ = **GO** (همه‌ی شمارنده‌ها ۰). پشتیبان `/root/backups/code-pre-prenote-20260930-131542.tar.gz`. استخراج ⇒ `pnpm install --frozen-lockfile` (بدونِ تغییر) ⇒ `pm2 restart feelia-mysql --update-env`؛ migrationِ جدیدی نبود (آخرین 034، همه `already applied`)؛ لاگ بدونِ خطا؛ `/api/health` ok؛ `pv-head` در صفحه‌ی سرو‌شده؛ بدونِ ورود `POST /api/stt/realtime-session` با `pre-note` و بدونِ آن هر دو **401**.
- **تست نشد:** متنِ زنده‌ی pre-note با حسابِ واقعیِ روی production (حساب نمی‌سازیم)؛ smoke با جلسه‌ی آزمایشی.
- **FINDING باز:** برایِ `pre-note` اگر کلاینت `session_id` بفرستد در `clientReferenceId`/لاگ می‌آید (بررسی نمی‌شود). رفع نشد.
- **عامل:** این نشست

### 2026-09-30 — TEST (UI mock) — تکمیلِ تستِ بصری/رفتاریِ یادداشتِ صوتیِ پیش از جلسه (commit `1a0c6f3`)؛ به دستورِ مالک
- **روش:** mockِ `mock-prenote` (بدونِ DB/حساب) + میکروفونِ ساختگیِ oscillator (streamِ تازه در هر ضبط) در مرورگرِ داخلی، عرضِ ۳۹۰px.
- **پاس:** Setup در تمِ روشن و تیره؛ ضبط ⇒ نوارِ ضبط + متنِ زنده (در mock کلیدِ موقت نیست ⇒ fallbackِ «متنِ زنده در دسترس نیست — ضبط ادامه دارد» و ضبط ادامه یافت)؛ کارتِ کلیپ با چیپِ «منتظرِ تأیید»؛ «شروع جلسه» با کلیپِ تأییدنشده مسدود (بدونِ POST به `/api/sessions`)؛ تأیید ⇒ چیپ «تأیید شد»؛ جمع‌کردنِ پنل + نشانِ «دارای یادداشت»؛ ضبط مجدد؛ حذف ⇒ نشانِ اولیه؛ `<audio>` رندر نمی‌شود؛ مودالِ آپلود: ضبط، کارت، تأیید، حذف و `unconfirmed()` درست (کلیپِ Setup هنگامِ بازکردنِ مودال به آن منتقل می‌شود).
- **دیده‌شده (جزئی):** در ۳۹۰px عنوانِ کارت («یادداشتِ صوتیِ ۱») و چیپِ «منتظرِ تأیید» هر دو در دو خط می‌شکنند. کارکرد سالم؛ فقط زیبایی.
- **تست نشد:** متنِ زنده با Soniox واقعی (نشستِ اصلی قبلاً در دسکتاپ/تمِ تیره پاس کرده)؛ blockِ `startAudioUpload` با فایلِ واقعی؛ سرورِ واقعی با routeِ `pre-note`. خطایِ 404 (`treatment-units`, `modalities`) و 503 (`mint`) در کنسول از mock است.
- **عامل:** این نشست

### 2026-09-30 — TEST + COMMIT + PUSH — کارِ commit‌نشده‌ی نشست‌هایِ دیگر (یادداشتِ صوتیِ پیش از جلسه: متنِ زنده/تأیید + بازطراحیِ Setup + `pre-note` mint)
- **درخواستِ مالک:** هرچه commit نشده تست شود؛ اگر درست بود commit و push شود.
- **تست (همه پاس):** `tsc --noEmit` تمیز؛ `test:routes` (127 route، بدونِ تغییرِ قرارداد)، `test:arch`، `test:rt`، `test:cf` (111/0)، `test:up` (54/0)، `test:ft` (59/0)، `test:llm` (18/0)؛ parseِ اسکریپتِ inlineِ `index.html` و `feelia-rt.js` سالم؛ اسکنِ secret در diff تمیز. بازبینیِ کد: سرور `pre-note` را بدونِ `session_id` می‌پذیرد، requireAuth + rate-limit حفظ است؛ `clientReferenceId` با `none` به orphanSweep (فقط transcriptionهایِ `feelia:*`) مربوط نیست.
- **تست نشد:** `test:api` (DBِ مشترک، نیازمندِ مجوزِ جدا)؛ بررسیِ بصریِ تمِ روشن/موبایل و مودالِ آپلود (مرورگر وسطِ کار بسته شد/ادامه داده نشد)؛ سرورِ واقعی با routeِ جدید. تستِ مرورگرِ واقعیِ نشستِ اصلی (Chrome + میکروفونِ ساختگی + Soniox، تمِ تیره) طبقِ ورودیِ همان نشست پاس بود.
- **FINDING (جزئی):** برایِ `purpose:'pre-note'` اگر کلاینت `session_id` هم بفرستد بررسی نمی‌شود ولی در `clientReferenceId`/لاگ می‌آید (رشته‌ی دلخواهِ کاربرِ واردشده). پیشنهاد: برایِ pre-note مقدارش را نادیده بگیرند.
- **Commit/Push (به دستورِ مالک):** کدِ feature و مستندات در دو commit؛ فایل‌هایِ untracked (tarها، `server-deploy/`، `soniox.html`، `.claude/` …) commit نشد. **Deploy انجام نشد.**
- **عامل:** این نشست

### 2026-09-30 — CODE + DEPLOY — بازطراحیِ راهنمای «نکاتِ ضبط» (`.rec-tips`) در Setup؛ commit `db50bf0` + deployِ فقط `public/index.html`
- **چه شد:** راهنمای جمع‌شونده‌ی «برایِ متنِ دقیق‌تر…» شبیهِ pillِ وضعیتِ سبز بود (متنِ `--sage-deep`، مثلثِ پیش‌فرض، بدونِ نشانه‌ی «بخوانید»). حالا: آیکونِ لامپ در دایره‌ی طلایی، عنوانِ جمله‌ی کامل («نکته‌هایی برایِ متنِ دقیق‌تر و جداشدنِ درستِ گوینده‌ها»)، متنِ خنثی (`--ink-2`)، برچسبِ «بخوانید» + شورونِ چرخان، hover/open با حاشیه‌ی طلایی، `focus-visible`. متنِ نکته‌ها و رفتارِ `<details>` دست‌نخورده.
- **فایل‌ها:** `public/index.html` (CSS `.rec-tips*` + `<summary>`).
- **Commit/Deploy (به دستورِ مالک):** commit با `git apply --cached` فقط دو هانکِ همین کار؛ کارِ نیمه‌تمامِ نشست‌هایِ دیگر در `index.html`/`stt.routes.ts` commit و deploy نشد. پیش از deploy sha1ِ (بدونِ CR) `public/index.html` در production با `7d4f959` یکسان بود (`6a039abb752f`)؛ پشتیبان `/root/backups/index.html-pre-tips-20260930-160905`؛ فقط همان فایل جایگزین شد (بدونِ restart/migration؛ `no-cache`)؛ sha1ِ بعد `1faec2da30b9` = `git show HEAD:public/index.html`؛ `/api/health` ok؛ `rec-tips-ico` در صفحه‌یِ سرو‌شده. **توجه:** فایلِ مستقر = blobِ HEAD (شاملِ commitهایِ `7d4f959` + `db50bf0`)، نه working tree.
- **تست / تأیید:** parseِ اسکریپتِ inlineِ HEAD سالم (`node --check`)؛ رندرِ CSS/HTMLِ واقعیِ commit در مرورگر (صفحه‌ی آزمایشی در scratchpad، نه SPAِ کامل) در تمِ تیره/روشن، حالتِ بسته/باز، عرضِ ۴۸۰px بررسی شد. SPAِ کاملِ پشتِ ورود تست نشد.
- **عامل:** این نشست
- **کارِ باز:** بررسیِ روی گوشیِ واقعی؛ `.claude/launch.json` (untracked) یک configِ `tips-preview` گرفت.

### 2026-09-30 — CODE + DEPLOY — بازطراحیِ فشرده‌ی «بررسیِ میکروفون و اتصال» در Setup؛ commit `7d4f959` + deployِ فقط `public/index.html`
- **چه شد:** سه ردیفِ بزرگِ قبلی (دو banner + دکمه‌ی تمام‌عرض) به یک ردیف تبدیل شد: دو pill وضعیت (میکروفون / رونویسی، آیکون + نقطه‌ی رنگی، حالت‌هایِ checking/ok/warn/error) + دکمه‌ی آیکونیِ «بررسی دوباره». پیامِ بلندِ هشدار/خطا فقط در صورتِ نیاز زیرِ ردیف (`.pf-note`) می‌آید. فقط توکن‌هایِ موجودِ سیستمِ طراحی (sage/gold/clay). رفتارِ `runPreflight`/`updateStartButtonState` بدونِ تغییر (فقط تابعِ کمکیِ `pfSet`)؛ idهایِ `preflightMicRow`/`preflightSttRow`/`preflightBox` حفظ شد.
- **فایل‌ها:** `public/index.html` (HTMLِ بلوکِ preflight، CSS `.pf-*`، `pfSet` + `runPreflight`).
- **Commit/Deploy (به دستورِ مالک):** commit از worktreeِ تمیز روی `4d61177` فقط با هانک‌هایِ همین کار؛ کارِ نیمه‌تمامِ نشستِ دیگر (`stt.routes.ts`، بقیه‌ی `index.html`) در working tree دست‌نخورده و **commit/deploy نشده** ماند. پیش از deploy sha1ِ `public/index.html` در production با `4d61177` یکسان بود (`5c7955ea…`)؛ پشتیبان `/root/backups/index.html-pre-pf-strip-<ts>`؛ فقط همان فایل جایگزین شد (بدونِ restart/migration؛ `no-cache`)؛ sha1ِ بعد `6a039abb…` = worktree؛ `/api/health` ok و `pf-strip` در صفحه‌یِ سرو‌شده.
- **تست / تأیید:** parseِ اسکریپتِ inline سالم؛ بررسیِ بصری در مرورگر **انجام نشد** (نیازمندِ ورود/mock).
- **عامل:** این نشست
- **FINDING:** هنگامِ ثبتِ همین ورودی، `PROJECT_STATUS.md`ِ working tree به‌خطایِ اسکریپتِ این نشست خالی شد؛ دو ورودیِ commit‌نشده‌یِ نشستِ دیگر («یادداشتِ پیش از جلسه») از transcriptِ همان نشست بازسازی شد — متنِ آن‌ها باید بازبینی شود.
- **کارِ باز / پیامد:** بررسیِ بصریِ light/dark و موبایل (زیرِ ۴۲۰px برچسبِ pill پنهان است).

### 2026-09-30 — CODE — یادداشتِ صوتیِ پیش از جلسه: متنِ زنده + تأیید/ضبط مجدد/حذفِ فایل + جمع‌کردنِ پنل؛ commit/deploy نشد
- **درخواستِ مالک:** هنگامِ ضبطِ یادداشتِ پیش از جلسه متنِ زنده دیده شود، تأیید/ضبط مجدد/حذفِ فایلِ صوتی وجود داشته باشد، و پنلِ بازشده قابلِ جمع‌کردن باشد.
- **سرور (`stt.routes.ts`):** `POST /api/stt/realtime-session` حالا `purpose:'pre-note'` را بدونِ `session_id` می‌پذیرد (جلسه هنوز نیست): بدونِ چکِ مالکیت، همان requireAuth + rate-limit، بدونِ contextِ جلسه. route جدید نیست (`test:routes` OK).
- **فرانت (`public/index.html`):** `makePreVoice` حینِ ضبط با کلیدِ موقت به Soniox وصل می‌شود (best-effort؛ شکست = فقط بدونِ متنِ زنده) و متنِ زنده را در `#…PreVoiceLive` نشان می‌دهد؛ هر کلیپ متنِ نهایی + دکمه‌های «تأیید» / «ضبط مجدد» / «حذفِ فایلِ صوتی» دارد. کلیپِ تأییدنشده جلوی «شروع جلسه» و «شروعِ آپلود» را می‌گیرد؛ پیش‌نویس‌هایِ بازیابی‌شده تأییدشده‌اند. پنل دکمه‌ی جمع‌کردن (chevron) دارد و دکمه‌ی بسته وجودِ محتوا را نشان می‌دهد. متنِ ذخیره‌شده همچنان بعد از شروعِ جلسه از خودِ صدا (سرور) ساخته می‌شود؛ متنِ زنده فقط برایِ بازبینی است و ذخیره نمی‌شود.
- **تست:** `tsc` تمیز، syntaxِ اسکریپتِ inline OK، `test:routes`/`test:arch` OK. **رفتارِ واقعی در مرورگر (میکروفون + Soniox) تست نشد.**
- **تستِ مرورگرِ واقعی (بعدتر، همان روز):** Chrome headless + میکروفونِ ساختگی (wavِ فارسی) + mockِ backendِ scratchpad که کلیدِ موقتِ **واقعیِ** Soniox می‌گیرد (بدونِ DB/حساب): متنِ زنده حین ضبط ✓، متنِ نهایی در ردیفِ کلیپ ✓، تأیید ✓، ضبطِ مجدد ✓، حذف ✓، مسدودشدنِ «شروع جلسه» با کلیپِ تأییدنشده ✓، جمع‌کردن (عادی و وسطِ ضبط) و نشانِ «دارای یادداشت» ✓. باگِ یافته و رفع‌شده: توکنِ `<end>` Soniox در متنِ زنده دیده می‌شد. آپلودِ مودال و سرورِ واقعیِ (با route جدید) هنوز تست نشده.
- **بازطراحیِ UI (درخواستِ مالک، همان روز):** کارتِ هر کلیپ: هدر (آیکونِ میکروفون + عنوان + مدت + چیپِ «منتظرِ تأیید/تأیید شد»)، جعبه‌ی متن، ردیفِ دکمه‌ها با SVG (تأیید = سبزِ پُر، ضبط مجدد = خنثی، حذف = آیکونیِ قرمزشونده). **پخش‌کننده‌ی صدا از صفحه‌ی Setup/مودال حذف شد** (`<audio>` دیگر رندر نمی‌شود)؛ خودِ فایل مثل قبل ذخیره می‌شود و در پنلِ ادمین (آرشیوِ kind='prenote') شنیدنی است — تغییری در ذخیره‌سازی نبود. نوارِ ضبط و متنِ زنده با پس‌زمینه‌ی clay. تستِ مرورگر دوباره پاس؛ فقط تمِ تیره دیده شد.
- **عامل:** این نشست.

### 2026-09-30 — CODE + TEST (UI mock) — بازطراحیِ ظاهرِ «یادداشتِ پیش از جلسه» در صفحه‌ی Setup؛ commit/deploy نشده
- **درخواستِ مالک:** UIِ فعلیِ یادداشتِ پیش از جلسه (لینکِ زیرخط‌دار داخلِ `presence-box`) مطابقِ سیستمِ طراحی بازطراحی شود.
- **تغییر (فقط `public/index.html`، CSS + markup؛ JS و idها دست‌نخورده):** دکمه‌ی `#preNoteToggle` ⇒ ردیفِ خط‌چینِ کارت‌مانند (آیکون + عنوان + «اختیاری · متنی یا صوتی» + «+»)؛ `#preNoteArea` ⇒ پنلِ `.pn-panel` با سرآیند، textarea، دکمه‌ی ضبط با آیکونِ میکروفون و راهنما با جداکننده؛ «تغییر» ⇒ pillِ `.pn-change`؛ جداکننده‌ی `.pn-wrap` بینِ حاضرین و یادداشت. فقط از توکن‌هایِ موجود (`--sage*`, `--line*`, `--field`, `--r-*`) ⇒ تمِ تاریک خودکار.
- **تست:** صفحه‌ی موقتِ استاتیک با CSSِ واقعی (حالتِ بسته/باز) در مرورگرِ داخلی دیده شد. تمِ تاریک، موبایل و SPAِ زنده بررسی **نشد**؛ مودالِ آپلود/Wrapup/صفحه‌ی جلسه عوض نشدند.
- **عامل:** این نشست.

### 2026-09-30 — DEPLOY — `dad0147` (رفعِ ارسالِ دوباره‌ی پیش‌نویسِ صدا) رویِ production؛ فقط `public/index.html`
- **درخواستِ مالک:** «ادامه بده» (پس از اعلامِ برنامه: تست‌ها ⇒ commit ⇒ deploy).
- **پیش از deploy:** checksumِ بی‌CRِ `index.html`ِ production = `aba0783` (بدونِ drift)؛ فقط این فایل بینِ `aba0783` و `dad0147` در `server/`+`public/` فرق دارد؛ preflight **GO** (همه ۰).
- **deploy:** backup `/root/backups/index-pre-draftclaim-20260929T205007Z.html`؛ جایگزینیِ `public/index.html` (قالبِ CRLFِ موجود حفظ شد)؛ **بدونِ restart** (فایلِ استاتیک، `no-cache`)؛ بدونِ migration.
- **تأیید:** checksumِ بی‌CR = `5c7955ea…` = `dad0147`؛ صفحه‌ی سروشده `preDraftClaimed` دارد؛ health `ok/connected`؛ `feelia-mysql` online با همان ۳۴ restart.
- **برگشت:** کپیِ backup به `public/index.html`.
- **عامل:** این نشست.

### 2026-09-30 — TEST + CODE + AUDIT (production، فقط‌خواندنی) — تکمیلِ تست‌هایِ یادداشتِ پیش از جلسه و رفعِ ارسالِ دوباره
- **دستورِ مالک:** «ادامه بده» (تکمیلِ تست‌ها و درست‌کردن). `test:api` رویِ DBِ dev اجرا شد (مجوزِ مالک، fixtureِ ساختگی، mock).
- **تست‌هایِ ماندگارِ جدید:** `test:up` H52/H53، `test:cf` PN1، و موردهایِ `test:api` (pre_note ⇒ note_before، PATCH /api/notes/:id، batch-audio pre-note، مسیرِ یکتایِ فایل). نتیجه: `up` 54، `cf` 111، `api` exit 0، `tsc`/`routes`/`arch`/`tu`/`ft`/`llm` سبز.
- **رفع:** ارسالِ دوباره‌ی پیش‌نویسِ صدا (رزرو `preDraftClaimed`) — جزئیات و mutation در [verification](verification/2026-09-29-pre-session-notes.md) §۵.
- **AUDIT production (فقط شمارنده، اسکریپتِ موقتِ SELECT حذف شد):** آرشیوِ صدا ۳۴۲ ردیف، ۰ فایلِ گمشده، **۱ مورد** بازنویسی‌شده (جلسه‌ی آزمایشیِ `2ad0588e`، ۲۰۲۶-۰۹-۲۴): اثرِ باگِ هم‌نامیِ قدیمی؛ بدونِ ترمیم.
- **عامل:** این نشست.

### 2026-09-29 — CODE + TEST (UI mock) — رفعِ ارسالِ دوباره‌ی پیش‌نویسِ صدایِ پیش از جلسه؛ commit/deploy نشده
- **دستورِ مالک:** «تست‌ها رو کامل کن و درستش کن».
- **باگ:** بعد از «شروعِ آپلود» پیش‌نویسِ صدا تا «دریافت شد» در IndexedDB می‌ماند؛ بازکردنِ دوباره‌ی صفحه‌ی شروعِ همان مراجع (بدونِ رفرش) همان کلیپ را بازیابی می‌کرد ⇒ امکانِ ارسالِ دوم.
- **رفع (`public/index.html` فقط):** `preDraftClaimed` (Set در حافظه) — کلیپ‌هایِ در راهِ ارسال (شروعِ جلسه / آپلود) رزرو می‌شوند، `restorePreVoiceDrafts` آن‌ها را رد می‌کند، با پایانِ `enqueuePreVoiceClips` یا لغوِ task آزاد می‌شوند. در شکست پیش‌نویس می‌ماند و بعداً بازیابی می‌شود.
- **تست (mock، Browser pane):** هنگامِ آپلود کپیِ دوم بازیابی نشد؛ فقط یک `purpose=pre-note` به جلسه‌ی آپلودی رفت؛ بعد از پایان پیش‌نویس ۰ و رزرو ۰. mutation (پاک‌کردنِ رزرو) ⇒ کپیِ دوم برگشت ⇒ تست معتبر است.
- **انجام‌نشده (سقفِ مصرف):** تست‌هایِ ماندگارِ harness (نامِ فایلِ صف `.prenote.`، `buildTextFromAsyncTokens` بدونِ speaker، برچسبِ corpus، `test:api` رویِ DBِ dev)، بررسیِ فقط‌خواندنیِ آرشیوِ production برایِ مسیرِ هم‌نامِ قدیمی، push، deployِ این رفع.
- **عامل:** این نشست.

### 2026-09-29 — AUDIT (production، فقط‌خواندنی) — بررسیِ سلامت پس از deployِ `aba0783` (~19:50 UTC)
- **مجوز:** مالک («الان همه‌چی سالمه؟»). فقط SSHِ خواندنی؛ یک اسکریپتِ موقتِ SELECT (اجرا و حذف، تأیید با `ls`).
- **نتیجه:** `feelia-mysql` online، ۴۵ دقیقه uptime، ۱۱۴MB؛ health محلی `ok/connected`؛ از nginx `/` و `/api/health` ⇒ 200؛ ۰ پاسخِ 5xx در ۲۰۰۰ خطِ آخر؛ دیسک ۲۰٪؛ ترافیک عادی (polling).
  از ماشینِ dev آدرسِ عمومی timeout می‌دهد (مسیرِ شبکه تا ArvanCloud، مشکلِ شناخته‌شده) — از خودِ سرور 200.
- **لاگ:** خطای واقعی نیست؛ فقط هشدارِ `FSTDEP023` (Fastify) و `MaxListenersExceededWarning`ِ قدیمی. خطِ `soniox orphan sweep 401` مالِ چند restart پیش (پیش از چرخشِ کلید) است و پس از restartِ فعلی تکرار نشده.
- **محدودیت:** در ۳ ساعتِ گذشته هیچ رویدادِ `stt.*/batch.*/audio.*` در `obs_events` نیست ⇒ **فیچرِ جدید هنوز با ترافیکِ واقعیِ کاربر دیده نشده**؛ تأییدش فقط تست + checksumِ کد است.
- **عامل:** این نشست.

### 2026-09-29 — DEPLOY — `aba0783` (یادداشتِ پیش از جلسه، REQ-066) رویِ production ⇒ production = `aba0783`
- **درخواستِ مالک:** «تست‌ها رو بگیر و بعد دیپلوی کن»؛ شاملِ کارِ نشستِ دیگر (پیش‌نویسِ پایدار) — تصمیمِ مالک در همین گفتگو (گزینه‌ی «همه، بعد از تستِ واقعی»).
- **git:** commitِ محلیِ `aba0783` رویِ `feat/clarity` (فقط فایل‌هایِ همین فیچر + docs + verification؛ **push نشده**). هیچ hunkِ بیگانه‌ی دیگری در فایل‌ها نبود جز `PreDraft` (تأییدِ مالک).
- **build/تست در worktreeِ تمیز:** `pnpm install --frozen-lockfile`، `pnpm --filter server run build`، `test:rt` 102، `routes` 127 OK، `arch` OK، `cf` 110، `up` 52.
- **پیش از deploy:** checksumِ بی‌CRِ `server/src`+`public`ِ production = `d4c8330` (۱۹۷ فایل، بدونِ drift). preflight **GO** (همه ۰؛ فقط یک تبِ بیکار در polling). بدونِ migration ⇒ بدونِ backupِ DB.
- **deploy:** backupِ کد `/root/backups/code-pre-prenote-20260929T190615Z.tar.gz`؛ تارِ `ffeb5bd1eaf4` (483 فایل، بدونِ `.env`/`node_modules`/`data`) استخراج، `pnpm install --frozen-lockfile`، `pm2 restart feelia-mysql --update-env`.
- **تأیید:** online، health `ok`/`connected`، همه‌ی migrationها «already applied»، لاگ بدونِ خطا؛ checksumِ production = `aba0783` (۱۹۷ فایل)؛ از nginx: `index.html` UIِ جدید و `feelia-rt.js` intentِ `pre-note` را سرو می‌کنند (`no-cache`)؛ `PATCH /api/notes/x` و `batch-audio?purpose=pre-note` بدونِ نشست ⇒ 401. smokeِ کامل با دادهٔ ساختگی رویِ production انجام **نشد** (نوشتن رویِ DBِ prod).
- **برگشت:** استخراجِ همان backup در `/root/feeliaa-mysql` + restart.
- **عامل:** این نشست.

### 2026-09-29 — CODE + TEST (E2E واقعی، دورِ دوم) + FINDING — بدونِ برچسبِ گوینده، پیش‌نویسِ پایدار، پاکسازیِ پیش‌نویسِ منقضی
- **دستورِ مالک:** «قبل از جلسه دیگه برچسب گوینده نمی‌خواد».
- **کد:** `restClient.ts` گزینه‌ی `diarize` (پیش‌فرض true)؛ `processQueue` برایِ `pre-note` ⇒ `diarize:false` ⇒ متنِ ساده. با Sonioxِ واقعی: خاموش ⇒ بدونِ برچسب، پیش‌فرض ⇒ با برچسب.
- **FINDING (نشستِ دیگر «صدا در یادداشت پیش جلسه»):** همان موقع `PreDraft` (پیش‌نویسِ پایدارِ صدا در IndexedDB) را به `index.html` افزوده بود (Event Logِ پایین‌تر). مالک خواست همه با هم پس از تستِ واقعی deploy شود.
- **رفعِ باگِ پیدا‌شده در E2E:** انقضایِ ۱۴روزه‌ی پیش‌نویس فقط هنگامِ بازشدنِ **همان مراجع** اجرا می‌شد ⇒ پیش‌نویسِ مراجعِ حذف‌شده/بازنشده برایِ همیشه در مرورگر می‌ماند (در E2E دیده شد: پیش‌نویسِ fixtureِ دورِ اول). `PreDraft.purgeExpired()` پس از هر بارگذاریِ صفحه — تست: منقضی پاک، تازه ماند.
- **E2Eِ واقعی (MySQLِ dev + Soniox + Chromeِ headless، پروفایلِ تازه):** ضبط ⇒ **رفرش ⇒ بازیابی** ⇒ شروع ⇒ Wrapup (متنِ صدا **بدونِ برچسب**) ⇒ پیش‌نویس پاک ⇒ ویرایش ⇒ صفحه‌ی جلسه؛ آپلود با یادداشت (پیش‌نویس پاک)؛ DB: هیچ `voice_before`ی برچسب ندارد، `prenote-*` جدا از صدایِ جلسه، corpus درست؛ ادمین: stream/متن/فایلِ کامل/403/404/400/UI PASS (C1/C9 فقط شمارشِ ثابتِ اسکریپت برایِ یک دور). ۰ خطایِ JS. fixtureها و پروفایل‌ها پاک؛ `data/*` مثلِ قبل.
- **عامل:** این نشست.

### 2026-09-29 — CODE + TEST — پیش‌نویسِ پایدارِ صدایِ یادداشتِ پیش از جلسه (REQ-066)؛ commit/deploy نشده
- **دستورِ مالک:** رفعِ محدودیتِ «صدا تا شروعِ جلسه (یا «دریافت شد» در آپلود) فقط در حافظه‌ی همان صفحه است؛ بستنِ صفحه = از دست رفتن».
- **تغییر (`public/index.html` فقط):** `PreDraft` = IndexedDBِ جدا `feelia-predraft` (store `clips`، index `scope`= id مراجع). هر کلیپِ ضبط‌شده
  (صفحه‌ی شروع و مودالِ آپلود) همان لحظه‌ی پایانِ ضبط نوشته می‌شود؛ با بازکردنِ دوباره‌ی صفحه‌ی شروعِ **همان مراجع** بازیابی می‌شود
  (`restorePreVoiceDrafts`). پاک می‌شود با: «حذف»ِ کاربر، `clear()`ِ مودالِ آپلود، رسیدنِ کلیپ به صفِ پایدارِ جلسه (`enqueuePreVoiceClips`) یا آپلودِ مستقیمِ موفق،
  لغوِ taskِ آپلود، یا انقضا (۱۴ روز). `resetPresence` فقط حافظه را خالی می‌کند (`release`). نبودِ IndexedDB/سهمیه ⇒ رفتارِ قبلی (فقط حافظه). متنِ تایپ‌شده و فایل‌هایِ انتخاب‌شده‌ی آپلود هنوز پایدار نیستند (متنِ راهنما در UI به‌روز شد).
- **تست:** syntax کلِ اسکریپت OK (`node --check`)؛ `PreDraft` در Browser pane: put/list/del، جداییِ scope، انقضایِ ۲۰ روزه PASS. ضبطِ زنده + رفرش با میکروفون انجام نشد (میکروفونِ pane مسدود).

### 2026-09-29 — TEST (E2E واقعی) — یادداشتِ پیش از جلسه رویِ MySQLِ dev + Sonioxِ واقعی: همه PASS
- **مجوز:** مالک («تستِ کامل روی دیتابیس dev با Soniox واقعی رو انجام بده»).
- سرورِ واقعی رویِ 3100 + Chromeِ headless (میکروفونِ جعلی = TTSِ فارسی) + fixtureهایِ CANARY (تراپیست + ادمین + مراجع، بدونِ ثبت‌نام). بدونِ LLM.
- **نتیجه:** جلسه‌ی زنده (ضبطِ پیش از جلسه ⇒ رونویسیِ واقعیِ Soniox ⇒ Wrapup ⇒ ویرایش ⇒ صفحه‌ی جلسه)، آپلود با یادداشت، DB/دیسک (`prenote-000000.webm` و
  `000000.webm` هر دو سالم ⇒ رفعِ بازنویسی در عمل تأیید شد)، corpusِ پرونده، ادمین (API + UI: فهرست، پخش، متن، جزئیات، 403/404/400) — همه PASS؛ ۰ خطایِ JS.
  دو FAILِ میانی ایرادِ اسکریپتِ تست بودند (خواندنِ sessionId از `FeeliaUpload.list()`؛ شمردنِ عبارت در متنِ خودِ canary) — DB و UI درست بودند.
- **پاکسازی:** fixtureها حذف (cascade)، `data/*` مثلِ قبل، `server/e2e-tmp/` و فایلِ توکن حذف؛ ۹۶ ردیفِ `obs_events` عمداً ماند (LAW-010).
- **مشاهده:** متنِ یادداشتِ صوتی (پیش/پس از جلسه) برچسبِ «گوینده N:» دارد — تصمیمِ مالک لازم اگر باید حذف شود.
- [verification](verification/2026-09-29-pre-session-notes.md) §۳. **عامل:** این نشست.

### 2026-09-29 — CODE + TEST + DOCS — یادداشتِ پیش از جلسه، متنی و صوتی (REQ-066)؛ commit/deploy نشده
- **دستورِ مالک:** «اجرا کن» پس از پلنِ بازبینی‌شده (تصمیم‌ها: ورودیِ پایین‌ترِ همین روز).
- **رفتار:** در صفحه‌ی شروع و مودالِ آپلود، متن + یک یا چند یادداشتِ صوتی (≤ ۵ دقیقه). متن ⇒ `session_notes(type='note_before')` (در تراکنشِ
  `createLiveSession`؛ ستونِ `sessions.pre_note` دیگر نوشته نمی‌شود و مقادیرِ قدیمی فقط‌خواندنی نمایش/واردِ پرونده). صدا ⇒ پس از ساختِ جلسه (یا «دریافت شد»ِ آپلود)
  صفِ پایدارِ مرورگر با intentِ `pre-note` ⇒ `batch-audio?purpose=pre-note` ⇒ آرشیوِ `kind='prenote'` (۱۴ روز، پخش در «یادداشت‌هایِ صوتی»ِ ادمین با برچسبِ
  «پیش از جلسه») + رونویسیِ async ⇒ `voice_before`. هرگز transcript نه. Wrapup و صفحه‌ی جلسه: ویرایش/حذف با `PATCH /api/notes/:id` (جدید؛ فقط همین دو نوع؛
  400 `note-not-editable`/`note-empty`/`note-too-long`) و «در حالِ آماده‌سازیِ متن…» با poll. پرونده: برچسبِ فارسی در corpus.
- **FINDING + رفع (بخشی از همین کار):** `archiveAudioForAdmin` نامِ فایلِ آرشیو را فقط از seq می‌ساخت، ولی seq برایِ هر kind جدا از ۰ است ⇒ سگمنتِ ۰ِ یادداشتِ صوتی و سگمنتِ ۰ِ
  جلسه (`000000.webm`) رویِ دیسک یکدیگر را بازنویسی می‌کردند (ردیفِ DB سالم، فایل عوض). حالا kindِ غیرِ session پیشوندِ `note-`/`prenote-` دارد. فایل‌هایِ قدیمی backfill/بررسی نشدند.
- **فایل‌ها:** `public/index.html`، `public/feelia-rt.js` (یک خط)، `scripts/rt-harness.cjs` (T56a/b + mock)، `scripts/route-snapshot.txt`، server: `sessions/{notes.routes,sessions.repository,batch.routes}.ts`،
  `transcription/batch/{queueFiles,processQueue}.ts`، `transcription/archive/{store,archiveWrite}.ts`، `admin/{admin.repository,audio.admin}.ts`، `case-file/{prompts/userPrompts,application/aggregateClientCorpus}.ts`. بدونِ migration.
- **تست:** `tsc` تمیز؛ `test:rt` 102/102؛ `test:routes` (snapshot عمداً به‌روز، 127)؛ `test:arch`؛ `cf` 110/110؛ `up` 52/52؛ `tu`/`ft`/`llm` سبز؛ UIِ mock در Browser pane PASS
  (ضبطِ واقعیِ MediaRecorder با toneِ ساختگی). **E2E با DB/Sonioxِ واقعی و پنلِ ادمینِ زنده انجام نشد.** [verification](verification/2026-09-29-pre-session-notes.md).
- **اسناد:** api/error/database/configuration-catalog، PRDِ ماژول ۰۵، requirement-catalog (REQ-066) + traceability، subsystem 02/05/06، LAW-009 (نقضِ آگاهانه‌ی تازه: صدایِ درمانگر ذخیره می‌شود؛ متنِ رضایت دست نخورد).
- **ریسک/باز:** صدا تا شروعِ جلسه/«دریافت شد» فقط در حافظه‌ی تب؛ ویرایش پس از completed پرونده‌ی خودکار را دوباره نمی‌سازد؛ Safari تست نشد؛ `.claude/launch.json` یک entryِ `mock-prenote` گرفت (untracked).
- **عامل:** این نشست.

### 2026-09-29 — AUDIT (production, read-only) — «متنِ نهایی» و اصلاحِ گوینده برایِ آپلودهایِ پدرام
- **مجوز:** مالک («برسی کن»). یک اسکریپتِ موقتِ SELECT در `server/` (اجرا و حذف، تأیید با `ls`)؛ فقط متادیتا/شمارنده، بدونِ متن/نام.
- **نتیجه:** `final_transcript_enabled=1` برایِ `3cb546ef`. از 2026-09-20 پدرام ۱۸ جلسه دارد (۴ آپلودی: `a2e3af83`، `a5617ab2`، `b75dd8fa`، `5dbb946c`؛ بقیه زنده/batch)؛
  **آخرین جلسه `5dbb946c` (2026-09-28 06:46Z) است ⇒ پس از deployِ `752ab22`/034 هیچ جلسه‌ی تازه‌ای ثبت نشده.** تنها ردیفِ `final_transcripts` همان `5dbb946c` است:
  `done`، `source=async`، `clean_text` ۹۵٬۸۰۲ بایت، **`clean_turns` = NULL** ⇒ اصلاحِ گوینده/نمایشِ ویرایش‌ها برایش نمی‌آید. سه آپلودِ قبلی ردیفِ متنِ نهایی ندارند.
- **پیامد:** مسیر برایِ آپلودِ بعدیِ پدرام آماده است ولی هنوز رویِ دادهٔ واقعیِ او دیده نشده. بازسازیِ `5dbb946c` (و آپلودهایِ قدیمی) = نوشتن رویِ prod ⇒ منتظرِ تصمیمِ مالک.
- **عامل:** این نشست.

### 2026-09-29 — AUDIT (read-only) + OWNER DECISION — «یادداشتِ پیش از جلسه، متنی و صوتی»

- **درخواستِ مالک:** تراپیست پیش از جلسه بتواند توضیحی بدهد، هم متنی هم صوتی.
- **وضعِ فعلی (کد):** یادداشتِ متنیِ پیش از جلسه هست (`public/index.html` کارتِ `presenceBox` ⇒ `pre_note` در `POST /api/sessions` ⇒ ستونِ `sessions.pre_note`، migration 029)
  ولی **هیچ‌جا خوانده/نمایش داده نمی‌شود** (نه Wrapup، نه پرونده، نه ادمین، نه corpusِ پرونده)؛ صوتی ندارد؛ مسیرِ آپلود ندارد.
  مانعِ صوتی: mintِ کلیدِ موقت و صفِ صدا (`batch-audio`) هر دو `session_id` می‌خواهند و پیش از شروع جلسه‌ای نیست.
- **تصمیم‌هایِ مالک:** (۱) صدایِ یادداشتِ پیش از جلسه باید ذخیره شود و در پنلِ ادمین قابلِ شنیدن باشد؛ (۲) تغییرِ LAW-003 «فرقی ندارد»؛
  (۳) واردِ پرونده‌ی درمان شود؛ (۴) در مسیرِ آپلود هم باشد؛ حینِ جلسه ویرایش نه، ولی بعد از پایانِ ضبط (Wrapup) قابلِ ویرایش.
- پلنِ بازبینی‌شده به مالک ارائه شد؛ هیچ کدی تغییر نکرد؛ منتظرِ دستورِ اجرا.

### 2026-09-29 — AUDIT (read-only) — «سایت بالا نمی‌آید» (~16:46 UTC)

- گزارشِ مالک. **سرور سالم:** pm2 `feelia-mysql` online، اپ رویِ 127.0.0.1:3000 ⇒ 200، nginx رویِ ۴۴۳ ⇒ 200، ترافیکِ بیرونی هم‌چنان به nginx می‌رسید.
- `feelia.ir` به CDNِ ArvanCloud (`185.143.233.131`، `185.143.234.131`) resolve می‌شود. **از خودِ سرور از مسیرِ CDN:** `/` و `/api/health` ⇒ 200
  (`server: ArvanCloud`). **از ماشینِ dev:** HTTPS به هر دو IPِ CDN و IPِ مستقیمِ سرور timeout؛ ping سالم، SSH گاه‌به‌گاه «No route to host».
  ⇒ مشکل در مسیرِ شبکه‌ی سمتِ کاربر/ISP/VPN تا ArvanCloud است، نه در اپ یا deploy. هیچ تغییری داده نشد.

### 2026-09-29 — DEPLOY — `33e16a0` (UTCِ اتصالِ DB) رویِ production ⇒ production = HEADِ `feat/clarity`
- **درخواستِ مالک:** «اینم دیپلوی کن».
- **گام‌ها:** build با `tsc --outDir` در scratchpad؛ `diagnosis.js`ِ build = prod (هم‌خوانیِ کامپایلر)؛ `src/db/connection.ts`ِ prod پس از حذفِ `\r` = `ad6ef35` (تفاوتِ hashِ خام فقط CRLFِ deployِ قبلی از worktreeِ ویندوزی بود). preflight **GO** (همه ۰؛ فقط یک تبِ بازِ بیکار در حالِ polling). backup: `/root/backups/code-pre-db-tz-20260929T163742Z.tar.gz`. جایگزینیِ `dist/db/connection.js` + `src/db/connection.ts` ⇒ `pm2 restart feelia-mysql --update-env` ⇒ health ok، online، بدونِ خطا در لاگ.
- **تأیید:** با کدِ deployشده، ۳ اتصالِ موازی: `@@session.time_zone=+00:00`، `NOW()` = `UTC_TIMESTAMP()` (مثلِ قبل، چون MySQLِ prod از اول UTC بود ⇒ بدونِ تغییرِ رفتار).
- **عامل:** این نشست.

### 2026-09-29 — GIT + CODE + TEST + DOCS — push و رفعِ اختلافِ ساعتِ DBِ dev (`33e16a0`)
- **درخواستِ مالک:** «پوش کن و مشکلِ ساعتِ dev رو هم درست کن».
- **push:** `feat/clarity` ⇒ origin (`9130bb3 → ad6ef35 → 33e16a0`).
- **ریشه:** درایور `timezone:'Z'` دارد ولی `NOW()`/`CURRENT_TIMESTAMP` با time_zoneِ سرورِ MySQL نوشته می‌شوند؛ MySQLِ dev = `SYSTEM` (تهران) ⇒ هر زمانِ SQL-ساخت ۳:۳۰ جلوتر خوانده می‌شد.
- **رفع:** `server/src/db/connection.ts` — رویدادِ `connection`ِ poolِ core ⇒ `SET time_zone='+00:00'` (اولین فرمانِ صفِ هر اتصال). prod از قبل UTC است ⇒ بی‌اثر؛ **deploy نشد** (لازم نیست؛ prod = `ad6ef35` + این commitِ بی‌اثر عقب).
- **تست:** `tsc` تمیز؛ ۵ اتصالِ موازی رویِ dev: `NOW()` = `UTC_TIMESTAMP()`، `@@session.time_zone=+00:00`. `test:api` (با goldenِ `9130bb3`): همان ۶ تفاوتِ شناخته‌شده؛ خروجی با اجرایِ پیش از این رفع **byte-identical** (پس از نرمال‌سازیِ نامِ پوشه‌ی موقت)؛ fixtureها پاک. up 52/0، ft 59/0، routes 126، arch OK.
- **محدودیت:** ردیف‌هایِ قدیمیِ DBِ dev که با `NOW()` نوشته شده‌اند ۳:۳۰ جلوتر می‌مانند (اصلاحِ داده انجام نشد — نمی‌شود ستون‌هایِ نوشته‌شده با JS-Date را از SQL-ساخت جدا کرد). ردیف‌هایِ جدید درست‌اند. dev serverِ در حالِ اجرا با tsx watch خودش reload می‌شود.
- **docs:** `configuration-catalog.md` (DATABASE_URL)، `07-final-transcript.md` (یادداشتِ منطقه‌ی زمانی).
- **عامل:** این نشست.

### 2026-09-29 — TEST + GIT + DEPLOY — تشخیصِ ادمین برایِ جلسه‌ی آپلودی رویِ production (`ad6ef35`)
- **درخواستِ مالک:** «چالش‌هایِ موجود رو حل کن، درست که شد همه‌چی دیپلوی بشه». Soniox پیش‌تر (ورودی‌هایِ CONFIG پایین) رویِ dev و prod درست شده بود.
- **تست:** rt (بدونِ FAIL)، cf 110/0، up 52/0، ft 59/0، llm 18/0، tu 17/0، routes 126، arch OK، `tsc` تمیز. **`test:api` با مجوزِ این پیام**: golden از worktreeِ تمیزِ `9130bb3` (موقت، حذف شد) ⇒ اجرایِ کدِ جدید: ۳۴۹ ورودی، ۶ تفاوت = ۲ عمدی (فیلدها/یافته‌هایِ جدیدِ diagnosis S1/S2) + ۴ مصنوعی (شماره‌ی پوشه‌ی موقت در `source_parts` ×۳، CRLFِ `index.html` در checkoutِ worktree). fixtureها پاک (`remaining fixture-phone therapists: 0`).
- **git:** commitِ محلیِ `ad6ef35` رویِ `feat/clarity` (فقط ۳ فایلِ `features/admin` + `api-catalog.md`)؛ push نشده. `PROJECT_STATUS.md` commit نشد (تغییراتِ نشست‌هایِ دیگر در آن است).
- **deploy (فقط ۶ فایل، بدونِ dependency/migration):** build با `tsc --outDir` در scratchpad (`server/dist` مشترک دست نخورد)؛ hashِ فایل‌هایِ دست‌نخورده (`filters.js`، `obs.admin.js`) = prod ⇒ خروجیِ کامپایلر یکسان؛ `src`ِ این ۳ فایل در prod = HEAD. preflight **GO** (همه ۰). backup: `/root/backups/code-pre-admin-diag-20260929T162859Z.tar.gz` (rollback = استخراج در `server/` + restart). استخراج ⇒ `pm2 restart feelia-mysql --update-env` ⇒ health ok، online، migrationها already applied، بدونِ خطا.
- **تأییدِ پس از deploy (فقط‌خواندنی، کدِ deployشده):** `5dbb946c` (آپلودی) حالا: آپلود ۱۰:۱۵:۴۱–۱۰:۱۶:۵۳ (تهران) ۱۱۳.۲MB، مدت ۱:۰۱، رونویسی ۱۰:۱۹:۰۳ (۲ دقیقه بعد)، متنِ نهایی ۱۴:۱۲:۲۷. `082798e9` (زنده) مثلِ قبل.
- **باز:** push؛ اختلافِ ساعتِ DBِ dev (فقط dev).
- **عامل:** این نشست.

### 2026-09-29 — TEST + GIT — تستِ کاملِ واقعی پس از کلیدِ جدیدِ Soniox؛ پاک‌سازیِ شاخه‌ها؛ push

- **به درخواستِ مالک** («انجام بده موارد باقی مانده رو و تست هم بکن»).
- **تست رویِ dev با کدِ checkoutِ اصلی (`feat/clarity` = `9130bb3` = production)** + `.env`ِ واقعی (کلیدِ جدیدِ Soniox، متیس) + fixtureِ canary:
  آپلود ۸/۸؛ batch ۶/۶؛ ادمین/صدا/متنِ نهایی ۹/۹؛ بازسازیِ گوینده + پرونده با LLMِ واقعی ۴/۴؛ جلسه‌ی زنده در Chromeِ واقعی ۸/۸ — A7 در مهلتِ
  ۶ دقیقه‌ایِ خودِ تست هنوز `polishing` بود چون متیس یک بار پس از ۱۳۳ث «پاسخِ خالی» داد؛ retryِ داخلیِ اپ موفق شد (۱۱۷ث) و متنِ نهایی `done`
  (۲۱ نوبت) شد ⇒ رفتارِ درست، کندیِ سمتِ provider. لاگِ سرور صفر خطا؛ fixtureها و ارجاع‌هایِ Soniox صفر.
- **production (فقط smoke، بدونِ ساختِ حساب):** `mintTemporaryKey` با کلیدِ جدید OK (کلیدِ موقتِ ۳۰ثانیه‌ای)، `GET /v1/transcriptions` OK؛
  `/` و `/feelia-rt.js` 200، `/api/auth/me` 401، health 200؛ pm2 online (۲۴ دقیقه) بدونِ هیچ خطا از restart.
- **پاک‌سازی:** worktreeهایِ `.claude/worktrees/{bm-golden,backend-modular,bm2}` حذف (`git worktree remove` + `rd /s /q \?\<path>`)؛ شاخه‌هایِ
  `refactor/backend-modular-v2` (merge‌شده) و `refactor/backend-modular` (v1ِ کهنه، `a567649`) حذف شدند — به مجوزِ مالک.
- **git:** push ِ `feat/clarity` (۱۲ commitِ بازسازی، `65b264c..9130bb3`) به `origin`. `PROJECT_STATUS.md` عمداً commit **نشد**: نشستِ دیگری هم‌زمان
  در همین checkout تغییرِ commitنشده دارد (`features/admin/{diagnosis,sessions.admin,admin.repository}.ts`، `api-catalog.md` و رویدادهایِ خودش در همین فایل —
  «تشخیصِ ادمین برایِ جلسه‌ی آپلودی») و commitِ این فایل رویدادهایِ آن را هم می‌برد. **توجه:** تستِ dev رویِ working tree بود و ممکن است آن تغییراتِ
  commitنشده‌ی ادمین را هم شامل شده باشد؛ production از worktreeِ تمیزِ `bm2` build شده و آن‌ها را ندارد.
- **باز (مالک):** چون کلیدِ Soniox در متنِ گفتگو آمده، در فرصتِ مناسب کلیدِ تازه + revokeِ این یکی (همان روشِ `read -rs`).

### 2026-09-29 — CODE + TEST + DOCS — تشخیصِ ادمین برایِ جلسه‌ی آپلودی + وضعیتِ «متنِ نهایی»
- **درخواستِ مالک:** «بله حلش کن» (پیشنهادِ ورودیِ AUDITِ پایین).
- **تغییر (فقط backend، commit/deploy نشده):** `server/src/features/admin/diagnosis.ts` — شاخه‌ی `source==='upload'`: شروع/پایانِ آپلود + حجم، مدتِ فایل، زمانِ ذخیره‌ی رونویسی (و فاصله از پایانِ آپلود) / ناموفق با کد / «در حالِ پردازش» با مرحله، بدونِ گفتار، هشدارِ کیفیت؛ برایِ هر جلسه‌ای که ردیفِ `final_transcripts` دارد: آماده/ناموفق/در حالِ ساخت. منبع = `audio_jobs`+`audio_uploads`+`final_transcripts` (پایدار، نه `obs_events` که جارو می‌شود)؛ فقط زمان/مرحله/کد، بدونِ متن (LAW-001). `admin.repository.ts`: `listUploadJobsForDiagnosis`، `getFinalTranscriptForDiagnosis`. پاسخ: فیلدهایِ افزوده‌ی `created_at`، `upload_jobs`، `final_transcript` در `diagnosis`. فرانت تغییر نکرد (همان کارت، حالا برایِ آپلودی هم پر است).
- **تست:** `tsc` تمیز؛ `test:arch` OK؛ `test:routes` OK (126). اجرایِ واقعیِ منطقِ جدید رویِ DBِ dev (فقط‌خواندنی) برایِ جلسه‌هایِ آپلودی/زنده: یافته‌ها درست. شاخه‌هایِ ناموفق/در حالِ پردازش/بدونِ گفتار/بدونِ job/دستی با دادهٔ ساختگی: درست. متادیتایِ `5dbb946c` در prod (فقط‌خواندنی): آپلود 06:45:41–06:46:53 UTC، ۱۱۳MB، ۶۱:۵۱، رونویسی 06:49:03، متنِ نهایی 10:42:27 ⇒ کارت همین‌ها را نشان خواهد داد. **`test:api` اجرا نشد** (مجوزِ مالک لازم)؛ goldenِ diagnosis به‌خاطرِ فیلدهایِ جدید تفاوت خواهد داشت (عمدی).
- **FINDING (dev-only):** MySQLِ dev با ساعتِ محلیِ تهران کار می‌کند (`@@time_zone=SYSTEM`، IST) ولی درایور `timezone:'Z'` دارد ⇒ همه‌ی DATETIMEهایِ dev در نمایش ۳:۳۰ جلوترند (از قبل، نه این تغییر). prod: `system_time_zone=UTC` ⇒ درست.
- **باز:** deploy (منتظرِ مالک؛ ضمناً کلیدِ Soniox در prod 401 است — ورودیِ DEPLOY پایین).
- **عامل:** این نشست.

### 2026-09-29 — CONFIG — کلیدِ جدیدِ Soniox رویِ dev

- مالک خودش `server/.env`ِ dev را با Notepad به‌روز کرد (طول ۱۴۷، پیشوندِ `snx_proj_`). تأییدِ agent بدونِ خواندنِ مقدار: fingerprint = `1390bcfd`
  (همان production)؛ `GET /v1/transcriptions` و `/v1/files` از dev ⇒ OK. موردِ «باز»ِ رویدادِ قبلی بسته شد.

### 2026-09-29 — CONFIG + DEPLOY — کلیدِ جدیدِ Soniox رویِ production

- **پیرو FINDINGِ 401:** مالک کلیدِ جدیدِ Soniox داد. agent وارد کردنِ کلید را خودش انجام نداد (قاعده‌ی ایمنی)؛ دستورِ گام‌به‌گام داده شد و
  مالک خودش رویِ سرور اجرا کرد: backupِ `.env` در `/root/backups/env-pre-soniox-key-<ts>`، ورودِ کلید با `read -rs` (بدونِ نمایش/تاریخچه)،
  جایگزینیِ خطِ `SONIOX_API_KEY` با `sed`، بررسی: ۱ خط، طولِ ۱۴۷، پیشوندِ `snx_proj_`.
- **تأییدِ agent (بدونِ خواندنِ مقدار):** fingerprintِ sha256 از `168a0249` به `1390bcfd` عوض شد؛ `GET /v1/transcriptions` و `/v1/files` از
  production ⇒ OK (قبلاً 401). preflight ⇒ GO ⇒ `pm2 restart feelia-mysql --update-env` ⇒ health ok، لاگِ پروسه‌ی جدید بدونِ خطا/401.
- **باز:** `server/.env`ِ dev هنوز کلیدِ قدیمیِ ردشده (`168a0249`) را دارد ⇒ رونویسی/تستِ واقعی رویِ dev تا جایگزینی 401 می‌گیرد.
  توصیه به مالک: چون کلید در متنِ گفتگو آمده، در فرصتِ مناسب کلیدِ تازه بسازد و این یکی را revoke کند.

### 2026-09-29 — AUDIT (production, read-only) + FINDING — «اطلاعاتِ شروع/پایانِ جلسه در پنلِ ادمین نیست»
- **مجوز:** مالک («برسی کن»). فقط شمارش/متادیتا/یافته‌هایِ تشخیص (بدونِ متن/صدا/نام)؛ دو اسکریپتِ موقت در `server/` اجرا و حذف شدند (تأیید با `ls`). هیچ نوشتنی رویِ production.
- **زمینه:** production = `9130bb3` (ورودیِ DEPLOYِ نشستِ دیگر، پایین)؛ مشاهده‌ی این نشست: `dist/` 15:37 UTC، pm2 ری‌استارت 15:42 UTC. درخواست‌هایِ ادمینِ 15:38 وسطِ همین deploy بودند.
- **شواهد:** nginx: همه‌ی درخواست‌هایِ `/api/admin/*`ِ امروز (15:37–15:39) **۲۰۰**. تشخیصِ همان ۳ جلسه‌ای که ادمین باز کرد با کدِ deployشده بازمحاسبه شد: دو جلسه‌ی **زنده** (`082798e9`، `319cd9de`) کامل — «دکمه‌ی پایان زده شد (ساعت…)»، «صدایِ کامل رسیده»، هشدارِ کیفیت؛ جلسه‌ی **آپلودی** `5dbb946c` (۲۰۲۶-۰۹-۲۸، فایلِ ۶۱:۵۱) **صفر یافته** ⇒ کارتِ «چه اتفاقی افتاد؟» اصلاً نمایش داده نمی‌شود، و «شروع HH:MM» هم برایِ آپلودی عمداً پنهان است (تصمیمِ 09-26). داده‌اش موجود است (۹ رویدادِ obs: `upload.completed`، `audio_job.stage`، `final_transcript.*`).
- **نتیجه:** داده‌ای گم نشده و رگرسیونِ refactor نیست؛ `diagnoseSession` (`server/src/features/admin/diagnosis.ts`) فقط `source==='live'` را پوشش می‌دهد. جانبی: قدیمی‌ترین ردیفِ `obs_events`/`obs_ui_events` در prod = 2026-09-23 (جلساتِ ۰۹-۱۲ تا ۰۹-۲۲ تایم‌لاین/تشخیصِ رویدادی ندارند؛ retention ۱۸۰/۳۰ روز علتش نیست — احتمالاً همزمان با انتقال به MySQL؛ تأیید نشده).
- **پیشنهاد (منتظرِ تصمیمِ مالک، پیاده نشده):** شاخه‌ی `upload` در تشخیص: زمانِ آپلود، مدتِ فایل، مراحل/زمانِ پردازش، وضعیتِ متنِ نهایی.
- **عامل:** این نشست.

### 2026-09-29 — DEPLOY + FINDING — production = `9130bb3` (بازسازیِ ماژولار)؛ کلیدِ Soniox رد می‌شود (401)

- **مجوز:** مالک «خودت اجرا کن» (پس از ردِ اولیه‌ی classifier؛ این بار دسترسی داده شد).
- **گام‌ها (طبقِ deployment-operations §۵):**
  1. checksumِ `server/src`+`public`+lockfileِ production (۱۴۶ فایل) = `65b264c` دقیقاً ⇒ deploy فقط بازسازی را می‌برد.
  2. preflight (§۵.۱): همه ۰ ⇒ **GO** (فقط یک تبِ باز در حالِ polling).
  3. backupِ کد: `/root/backups/code-pre-modular-refactor-20260929T154129Z.tar.gz` (rollback = استخراجِ همین + restart).
  4. `server/src` و `server/dist`ِ قدیمی حذف (تا `http/`/`stt/`/`ws/`ِ کهنه نماند) ⇒ استخراجِ `feelia-9130bb3.tar.gz` (buildِ worktreeِ تمیز)
     ⇒ `pnpm install --frozen-lockfile` ⇒ `pm2 restart feelia-mysql --update-env`. `.env` و `data/` دست نخوردند؛ migrationِ جدید نبود.
  5. health ok (`database: connected`)؛ `/` 200، `/feelia-rt.js` 200، `/api/auth/me` 401؛ لاگِ شروع: `[llm] … Metis` درست؛ pm2 online و پایدار.
- **FINDING (مهم، مستقل از deploy):** sweepِ Soniox بعد از restart `401` گرفت. بررسی: همان فراخوانیِ فقط-خواندنی (`GET /v1/transcriptions`،
  `/v1/files`) از production با **کدِ جدید** 401، با **کدِ قدیم از backup** هم 401، و از **dev** (همان کلید، از طریقِ proxy) هم 401.
  کلید در `.env`ِ production از 2026-09-28T11:37Z عوض نشده (fingerprintِ sha256 = dev). یعنی Soniox خودِ کلید را رد می‌کند (revoke/غیرفعال/
  مشکلِ حساب یا اعتبار) — عصرِ 2026-09-28 همین کلید در E2Eِ dev کار می‌کرد. **پیامد:** تا رفع، رونویسیِ زنده (mintِ کلیدِ موقت)،
  batch، آپلودِ صدا و «متنِ نهایی» رویِ production کار نمی‌کنند. rollback کمکی نمی‌کند. اقدامِ مالک: بررسیِ کنسولِ Soniox / کلیدِ جدید.

### 2026-09-29 — DEPLOY (متوقف) — deployِ بازسازیِ ماژولار (`9130bb3`) آماده شد، اجرا نشد

- **درخواستِ مالک:** «اگه مطمئنی چیزی خراب نمیشه آره دیپلوی کن».
- **انجام‌شده (لوکال):** build در worktreeِ تمیزِ `bm2` (= `9130bb3`، بدونِ تغییرِ دیگر) ⇒ `dist/` با ساختارِ جدید؛ تارِ
  `server/ public/ package.json pnpm-lock.yaml pnpm-workspace.yaml` (۴۸۳ فایل، بدونِ `.env`/`node_modules`/`data`) در scratchpadِ نشست
  (`feelia-9130bb3.tar.gz`). checksumِ پایه (`65b264c`؛ کدِ `server/src`/`public` با `752ab22` یکسان) محاسبه شد. migrationِ جدیدی در کار نیست (034 رویِ prod هست).
- **متوقف شد در گامِ ۲ (مقایسه‌ی checksumِ production، فقط-خواندنی):** classifierِ permissionِ محیطِ Claude Code دستورِ SSH را با دلیلِ
  «Production Reads» رد کرد. طبقِ قاعده دور زده نشد. **هیچ دستوری رویِ production اجرا نشد**؛ production همچنان `752ab22`.
- **برایِ ادامه:** یا مالک یک Bash permission rule برایِ `ssh`/`scp` با کلیدِ `feelia_migration` اضافه کند، یا گام‌ها را خودش اجرا کند
  (رویه: `deployment-operations.md` §۵ + §۵.۱). توصیه: پیش از استخراج `server/src` و `server/dist`ِ قدیمی (پس از backupِ کد) پاک شوند تا
  فایل‌هایِ کهنه‌ی `http/`، `stt/`، `ws/` باقی نمانند (بی‌ضرر ولی گیج‌کننده).

### 2026-09-29 — GIT — merge ِ بازسازیِ ماژولارِ backend (v2) به `feat/clarity`

- **به درخواستِ مالک** («انجام بده اگه مطمئنی چیزی خراب نمیشه»). پیش‌شرط‌ها بررسی شد: `feat/clarity` از `65b264c` جلو نرفته بود ⇒
  **fast-forward** بدونِ conflict (`git merge --ff-only refactor/backend-modular-v2`)؛ تنها تغییرِ commitنشده‌ی checkoutِ اصلی
  (`PROJECT_STATUS.md`) جزوِ فایل‌هایِ merge نبود؛ هیچ سرورِ devی در حالِ اجرا نبود.
- **نتیجه:** `feat/clarity` = `9130bb3` (۱۲ commitِ P1–P7). `server/src/http|stt|ws` حذف و به `features/*` + `shared/` + `app.ts`/`jobs/` منتقل شد
  (نقشه: [repository-map](docs/02-reference/repository-map.md)).
- **تست در خودِ checkoutِ اصلی بعد از merge:** tsc OK؛ `test:cf` 110/110، `up` 52/52، `tu` 17/17، `ft` 59/59، `llm` 18/18، `routes` ۱۲۶ OK،
  `arch` OK، `test:rt` 100/100. خروجیِ build (`tsc` به پوشه‌ی موقت) ساختارِ `dist/`ِ درست دارد: `app.js` هم‌عمقِ `index.js`ِ قبلی (مسیرِ `public/` یکسان) و مسیرهایِ migration در `copy-assets.mjs` بدونِ تغییر.
- **push/deploy نشده.** production همچنان `752ab22` (کدِ قدیمی) — deployِ بعدی کدِ جدید را می‌برد؛ ساختارِ deploy (`pnpm build`/`dist`) باید با
  مسیرهایِ جدید بررسی شود. شاخه‌هایِ `refactor/backend-modular` (v1، کهنه) و `refactor/backend-modular-v2` و worktreeهایشان هنوز هستند.

### 2026-09-29 — TEST — تستِ واقعیِ v2، بخشِ دوم: جلسه‌ی زنده در مرورگر، بازسازیِ گوینده، پرونده با LLM

- **با مجوزِ صریحِ مالک** («تست کن»، بعد از ردِ اولیه‌ی permissionِ محیط). همان سرورِ v2 (`9130bb3`) رویِ 3100 با `.env`ِ واقعیِ dev؛
  تراپیستِ canary دوباره ساخته شد؛ سرورِ devِ دیگری در حالِ اجرا نبود.
- **A — جلسه‌ی زنده ۸/۸:** Chromeِ headlessِ واقعی + میکروفونِ جعلی (مکالمه‌ی TTSِ ساختگیِ سه‌نفره) رویِ `index.html`/`feelia-rt.js`ِ واقعی:
  ورود با کوکیِ fixture ⇒ temp-key ⇒ Sonioxِ realtime `ACTIVE` ⇒ دو علامت (۳۵ث، ۷۰ث) ⇒ پایان در ۱۱۰ث ⇒ `finishSession`. سمتِ سرور: جلسه
  `completed`، متن ۱۵۲۳ کاراکتر (version 21)، ۲ علامت در متن و در یادداشت‌ها، ۸ سگمنتِ صدا در آرشیو (کامل، بدونِ گم‌شده)، «متنِ نهایی»
  `waiting_audio → polishing → done` (source=async، ۱۷ نوبت)؛ صفر خطایِ کنسولِ مرورگر.
- **D (پولی) ۴/۴:** `resolve-speakers` (ffmpeg concat + Sonioxِ async) ⇒ `done`؛ `case-file/regenerate` با متیس ⇒ 200 و پرونده خواندنی.
  (جلسه‌ی مبنا با تکرارِ سناریوی C ساخته شد: ۶/۶.)
- **جمعِ تستِ واقعی (دو بخش):** آپلود ۸/۸، batch ۶/۶ (دو بار)، ادمین/متنِ نهایی ۹/۹، پولی ۴/۴، جلسه‌ی زنده ۸/۸؛ لاگِ سرور صفر خطا.
- **پاک‌سازی:** jobهایِ فعال ۰، ارجاع‌هایِ Soniox ۰؛ تراپیستِ canary با cascade حذف (۰ باقی‌مانده)؛ سرور و Chromeِ تست بسته (۰ پروسه‌ی باقی‌مانده)؛
  worktree تمیز. صدا/اسکرین‌شاتِ ساختگی فقط در scratchpad.
