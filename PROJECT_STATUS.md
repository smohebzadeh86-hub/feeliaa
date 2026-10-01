# PROJECT STATUS — وضعیتِ زنده‌ی پروژه و سیستمِ مستندات

> **نقش:** سندِ زنده. ساختارش مطابقِ «دستورِ ساختِ سیستمِ مستندسازی و مرجعِ اصلیِ پروژه» (مراحلِ کار + ۲۷ بخش + checklistِ validation + خروجیِ نهایی) است.
> **قانون:** [LAW-024](docs/00-governance/project-laws.md) — **هر رویداد باید همین‌جا ثبت شود.**
> **آخرین به‌روزرسانی:** 2026-09-30 — آخرین رویداد: **پلنِ مستندات کامل شد (فازهایِ ۰–۷ + bannerهایِ فرانت) و commit شد؛ تست‌هایِ رفتاریِ همه‌ی harnessها و `test:api` سبز؛ push/deploy نشد.** سابقه‌ی زنجیره‌ی «قبل‌ترش»ها: [docs/08-history/event-log-2026-09.md](docs/08-history/event-log-2026-09.md).
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

> ورودی‌هایِ 2026-09-28 و قدیمی‌تر به [docs/08-history/event-log-2026-09.md](docs/08-history/event-log-2026-09.md) منتقل شده‌اند (2026-09-30، فاز ۷). Event Logِ زنده از 2026-09-29 است.

### 2026-10-01 — CODE + TEST + GIT + DEPLOY — یکسان‌سازیِ timezone در فرانت: همه‌ی تاریخ/ساعت‌ها به وقتِ تهران؛ commit `bc71bae` و deploy روی production
- **ریشه:** تاریخِ جلسه (`toJalali`) و `start_time` (`getHours`) با timezoneِ مرورگرِ تراپیست ساخته می‌شدند و زمان‌هایِ UTCِ پنلِ ادمین (`fmtDateTime` و …) با timezoneِ مرورگرِ ادمین نمایش داده می‌شدند ⇒ با VPN/ساعتِ غیرِ تهران ناهم‌خوان.
- **تغییر (`public/index.html`):** ثابتِ `FEELIA_TZ='Asia/Tehran'`؛ `toJalali`، `nowClock`، `fmtDateTime`، نمایشِ آخرین ذخیره/به‌روزرسانی/ستونِ متریک همه با `timeZone`؛ تابعِ جدیدِ `tehranHM` برایِ `start_time` در ایجادِ جلسه. سرور تغییر نکرد (از قبل تهران).
- **تست (کامل، [verification/2026-10-01-frontend-timezone-tehran.md](verification/2026-10-01-frontend-timezone-tehran.md)):** docs/routes(135)/arch/rt/cf(111)/up(54)/tu(17)/ft(60)/llm(18)/adm(8) همه OK؛ tsc تمیز؛ تابع‌هایِ واقعیِ index.html در ۷ timezone خروجیِ یکسان دادند (از جمله گذرِ نیمه‌شبِ تهران). **تستِ مرورگریِ واقعی** (Browser pane، mock + shimِ timezone نیویورک/توکیو): بدنه‌ی POST جلسه = ساعتِ تهران (12:24) به‌جایِ ساعتِ محلی (4:54/17:54)؛ نمایشِ ادمین ۰:۱۵ برایِ 20:45Z در هر دو. test:api انجام نشد (مجوزِ مالک). جلسه‌هایِ قدیمیِ ثبت‌شده با timezoneِ غیرِ تهران اصلاح نمی‌شوند.

### 2026-10-01 — GIT + DEPLOY + TEST — commit `6f2e6d5` و deployِ پنلِ ادمین (زنده/صف/سلامت) رویِ production؛ push نشد
- **git/deploy (مجوزِ مالک: «commit کن و deploy کن»):** به‌خاطرِ hunkهایِ نشستِ دیگر (final-transcript) commit از worktreeِ تمیز (فقط `public/index.html` + status + verification؛ `bc71bae`، push نشد). فقط فایلِ استاتیک عوض شد ⇒ **بدونِ build/restart/preflight** (public با no-cache سرو می‌شود). checksumِ prod پیش از deploy = commitِ پایه؛ پشتیبان `/root/backups/index.html-pre-tz-*`؛ scp ⇒ mv. پس از deploy: `https://feelia.ir/` sha1 (بدونِ `CR`) = commit؛ `/api/health` ok. نشستِ ادمین/تراپیستِ واقعی تست نشد؛ مالک: یک جلسهٔ تازه بسازد و ساعتِ شروع را با ساعتِ تهران مقایسه کند.
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
