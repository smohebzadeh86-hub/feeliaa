# PROJECT STATUS — وضعیتِ زنده‌ی پروژه و سیستمِ مستندات

> **نقش:** سندِ زنده. ساختارش مطابقِ «دستورِ ساختِ سیستمِ مستندسازی و مرجعِ اصلیِ پروژه» (مراحلِ کار + ۲۷ بخش + checklistِ validation + خروجیِ نهایی) است.
> **قانون:** [LAW-024](docs/00-governance/project-laws.md) — **هر رویداد باید همین‌جا ثبت شود.**
> **آخرین به‌روزرسانی:** 2026-09-15 — آخرین رویداد: بعدِ چک‌کردنِ پنلِ ادمین/ClientDetail/SessionDetail با داده‌ی canary، یک رگرسیونِ خودِ همین تغییر (سرریزِ افقیِ صفحه از `nowrap` روی دکمه‌ی بلند) پیدا و رفع شد. قبل‌ترش: باگِ ریشه‌ای پشتِ ناسازگاریِ ظاهریِ کارتِ مراجعِ فعال/غیرفعال رفع شد (CSS specificityِ `.btn-sm`/`.btn-xl` که هیچ‌وقت اعمال نمی‌شد) + هم‌ارتفاع‌سازیِ کارت‌ها و سلسله‌مراتبِ CTAِ تبِ آرشیو. فقط `public/index.html` + `feelia-design-system.html`؛ commit نشده. بالاترین ورودیِ [§7 Event Log](#۷-event-log).
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
| Branch / HEAD | `feat/clarity` روی **`2551943`** («fix(stt): voice notes could never mint a realtime credential»)؛ working tree برای هر ۳ فایلِ کد تمیز؛ `docs/admin-panel.md` هنوز modified (نامرتبط، عمداً کنار گذاشته شد)؛ **✅ push شد به `origin/feat/clarity`** (۹ کامیت، تا `2551943`)؛ `origin/main` هنوز `8bcdf0e` — بدونِ merge/PR، فقط branch push شده | 2026-09-14 | git log/status/push |
| کارِ commitنشده | مستنداتِ untracked + `docs/admin-panel.md` + **کدِ باگ‌های مراجعینِ فعال/غیرفعال، ثبتِ دستیِ جلسه (تاریخِ اختیاریِ بدونِ ساعت، nullable + یادداشتِ صوتی/متنی با بازبینیِ متن) و تاریخِ شمسی** (`server/src/http/clients.ts`، `sessions.ts`، `sessionDate.ts`، migrationهای `012`، `013`، **`014_session_date_optional.sql`جدید (additive، date nullable)**، `public/index.html`) — typecheck ✅، `node --check` ✅، **✅ سرور/DBِ واقعیِ لوکال با حسابِ canary تأیید شد** (نوشتن/خواندنِ مستقیمِ Postgres، پاکسازیِ کامل) | 2026-09-15 | [verification](verification/2026-09-14-client-status-archive.md) |
| Typecheck سرور | ✅ بدونِ خطا | 2026-09-14 | این task |
| Harness realtime (`pnpm test:rt`) | ⚠️ 29 PASS / 6 FAIL — **دقیقاً همان baseline**؛ `feelia-rt.js` هنوز اصلاً لمس نشده | 2026-09-14 | این task |
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
| Production | `feelia.ir` = commit `8bcdf0e` (فقط Clarityِ ایزوله؛ نه `2763414` و نه فیکسِ فازِ ۰) | 2026-09-14 | §7 Event Log — DEPLOY |
| مستندات | ✅ ساختارِ کامل؛ ❗ هیچ سندی توسطِ مالک review نشده | 2026-09-14 | [documentation-map](docs/00-governance/documentation-map.md) |
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
| deploy به production | هیچ‌کدام از این ۹ کامیت هنوز رویِ `feelia.ir` نیستند (فقط push به `origin/feat/clarity`، نه merge به `main`، نه deploy) | ⏳ PENDING | تصمیم و مجوزِ صریحِ مالک (LAW-006) |

---

## ۷. Event Log

> append-only · جدیدترین بالا · قالب در §0.

### 2026-09-15 — INCIDENT/CODE/TEST — رگرسیونِ خودِ همین تغییر پیدا و رفع شد: `nowrap` روی `.btn-sm` باعثِ سرریزِ افقیِ صفحه در دکمه‌های طولانی می‌شد
- **چه شد:** طبقِ درخواستِ مالک، پنلِ ادمین و صفحه‌ی جزئیاتِ مراجع/جلسه هم با داده‌ی canary (این بار با patchِ موقتِ تابعِ `api()` در Browser pane تا نیاز به سرور/حساب نباشد) بررسی شد. در صفحه‌ی جزئیاتِ جلسه، دکمه‌ی «بازسازیِ شماره‌گذاریِ گوینده‌ها» (`#resolveSpeakersBtn`، داخلِ `.btn-row`) با `white-space:nowrap`ی که در تغییرِ قبلی به `button.btn.btn-sm` اضافه شده بود، به‌جایِ wrap کردن از کادرِ خودش و کلِ صفحه سرریز می‌کرد (اسکرول‌بارِ افقیِ کل صفحه، `scrollWidth>clientWidth`) — چون `.btn-row>button{flex:1}` بدونِ `min-width:0` تعریف شده بود و متنِ nowrap عرضِ محتوا را از عرضِ فلکس‌آیتم بزرگ‌تر می‌کرد. **رفع:** `min-width:0` به `.btn-row>button` اضافه شد و خودِ `button.btn.btn-sm` به‌جایِ صرفاً nowrap، `overflow:hidden;text-overflow:ellipsis` هم گرفت تا هرجا واقعاً جا کم بیاید (مثلاً ردیفِ سه‌دکمه‌ایِ کارتِ تراپیستِ ادمین در عرضِ باریک) به‌جای سرریز، با «…» کوتاه شود.
- **فایل‌ها:** `public/index.html:100-102`.
- **اسنادِ به‌روزشده:** همین فایل.
- **تست / تأیید:** رندرِ واقعی در Browser pane با `api()` patch‌شده: صفحه‌ی جزئیاتِ مراجع (ClientDetail، مراجعِ غیرفعال با/بدون دلیل)، جزئیاتِ جلسه (SessionDetail با هر دو دکمه‌ی sm نمایان)، پنلِ ادمین (آمار + کارتِ تراپیست با دو toggle و سه دکمه، حالتِ برچسبِ خیلی بلند)، جزئیاتِ تراپیست (لیستِ مراجع + حذف). بعدِ فیکس: `document.documentElement.scrollWidth===clientWidth` در همه‌جا، هیچ‌جا سرریزِ افقی نبود؛ متنِ دکمه‌ها از طریقِ `read_page` (accessibility tree) هم کامل و درست خوانده شد (فقط بصری truncate می‌شود، نه واقعاً).
- **عامل:** این نشست، حینِ پاسخ به درخواستِ مالک برای چک‌کردنِ پنلِ ادمین/ClientDetail — یعنی خودِ این verification رگرسیون را کشف کرد، نه گزارشِ مالک.
- **کارِ باز / پیامد:** ندارد؛ هنوز commit نشده.

### 2026-09-15 — FINDING/CODE/DOCS — کارتِ مراجعِ فعال/غیرفعال: ریشه‌ی ناسازگاریِ UI رفع شد (باگِ specificityِ `.btn-sm`/`.btn-xl`)
- **چه شد:** مالک گزارش داد کارت‌های مراجعِ فعال و غیرفعال ظاهرِ متفاوت دارند و اندازه‌ی دکمه‌ها یکی نیست. بررسیِ کد + رندرِ واقعیِ `public/index.html` در Browser pane (داده‌ی canary، بدونِ API/حساب، 1280px و 375px) نشان داد ریشه یک باگِ CSS specificity است: `button.btn` (0,1,1) بر `.btn-sm`/`.btn-xl` (0,1,0) غالب می‌شد و اصلاً اعمال نمی‌شدند — دکمه‌ی «کوچکِ» کارتِ مراجع عملاً تمام‌قد بود و در تبِ غیرفعال («ثبتِ جلسه‌ی گذشته») دوخطی می‌شد → ارتفاعِ کارت‌ها فرق داشت (۱۶۰px در برابرِ ۲۱۵px). **رفعِ ریشه‌ای:** سلکتورها به `button.btn.btn-sm`/`button.btn.btn-xl` (0,2,1) تغییر کرد؛ روی هر ۱۰ محلِ `btn-sm` و ۳ محلِ `btn-xl` در کلِ اپ اثر دارد. همراه: یکسان‌سازیِ پس‌زمینه‌ی کارتِ فعال/غیرفعال (حذفِ `.client-card.inactive{background}`)، انتقالِ «دلیلِ غیرفعال‌بودن» به یک pill داخلِ `.client-meta` (به‌جایِ ردیفِ جداگانه که ارتفاعِ کارت را به‌هم می‌زد)، تغییرِ رنگِ دکمه‌ی primaryِ «ثبتِ جلسه‌ی گذشته» به secondary (اصلِ «آرامشِ بالینی» — عملِ آرشیوی نباید هم‌وزنِ CTAِ زنده باشد)، یکسان‌سازیِ ارتفاعِ کنترل‌هایِ نوارِ فیلتر (چیپ/سگمنت/دکمه‌ی مرتب‌سازی → 36px)، و شعاع‌های خارج از توکن (`--r-md`/`--r-sm`) به توکن. در تبِ غیرفعال برچسبِ «مراجع جدید» → «افزودنِ پروندهِ قبلی» و برچسبِ پیش‌فرضِ منویِ مرتب‌سازی → «پیش‌فرض (آخرین جلسه)» شد تا رفتارِ واقعی (ترتیب بر اساسِ آخرین جلسه) پنهان نماند.
- **فایل‌ها:** `public/index.html` (CSS ~L87-170، JS `switchClientTab`، `renderClients`، `#btnNewClient`/`#sortDropDefaultLabel` id جدید)، `feelia-design-system.html` (هم‌گام‌سازیِ همان فیکسِ specificity + یک ردیفِ جدید در «لغزش‌گاه‌های واقعی»).
- **اسنادِ به‌روزشده:** همین فایل. (PRD ماژولِ مراجعین دست‌نخورده ماند — برچسب‌ها/سلسله‌مراتبِ CTA تغییرِ رفتاریِ API نداشت.)
- **تست / تأیید:** رندرِ واقعیِ فایل در Browser pane با ۴ مراجعِ canary (۲ فعال، ۲ غیرفعال — یکی با دلیلِ بلند، یکی بدون) در 1280px و 375px، هر دو تب: هر دو کارتِ هم‌محتوا هم‌ارتفاعند، همه‌ی دکمه‌ها تک‌خطی، برچسب‌های تبِ غیرفعال درست. `pnpm test:rt` اجرا شد: **همان baselineِ ۲۹ PASS / ۶ FAIL** (T2 batch fallback، T15×۳، T16×۲) — بدونِ تغییرِ نتیجه، چون این تغییر فقط `public/index.html` را لمس کرده. صفحه‌ی جزئیاتِ مراجع (ClientDetail) به‌خاطرِ نیازِ به fetchِ واقعی تستِ زنده نشد؛ کلاسِ دکمه‌هایش (`btn-sm`) همان کلاسِ تأییدشده در Setup/Live/کارتِ مراجع است.
- **عامل:** این نشست، طبقِ پلنِ ازپیش‌نوشته‌شده (بررسیِ اوپوس، تأییدشده توسطِ مالک برایِ پیاده‌سازی).
- **کارِ باز / پیامد:** commit نشد (طبقِ درخواستِ مالک تا اجازه‌ی صریح). اسکرین‌شاتِ همه‌ی ۱۳ محلِ `btn-sm`/`btn-xl` (Setup/Live/Wrapup/پنلِ ادمین) بررسیِ کامل نشد — فقط Setup/Live/کارتِ مراجع دیده شد؛ چون تغییر یکنواخت و سراسری است (نه شرطی)، ریسکِ رگرسیون در بقیه پایین ارزیابی می‌شود ولی تأییدِ چشمی کامل هنوز انجام‌نشده است.

### 2026-09-15 — TEST — تأییدِ نیمه: mintِ Soniox بعدِ فعال‌سازیِ PROXY_URL پایدار شد (media-plane هنوز تست‌نشده)
- **چه شد:** مالک پرسید «الان موردی نداره؟». سرور خودش (احتمالاً به‌خاطرِ تغییرِ `.env` یا اقدامِ مالک) ری‌استارت شده بود (PID عوض شد: `26504`→`4872`، تأییدشده با `netstat`). برایِ تأییدِ واقعی، به‌جایِ حدس، **۵ بار پشتِ‌سرِهم** مستقیم `POST /api/stt/realtime-session` را با یک حسابِ canaryِ ایزوله صدا زدم (بدونِ نیاز به میکروفون — همان endpointی که قبلاً `mint-transport` می‌داد).
- **نتیجه:** هر ۵ بار `200` + `api_key` واقعی، زمان‌بندی ۱۰۰۰–۱۷۰۰ms (قبلاً: یک نمونه ۲۲۰ms، یک نمونه ۸۹۹۶ms، یک نمونه شکستِ کامل). یعنی **control-plane (mint) حالا پایدار است** — دیگر شکستِ کامل ندیدم.
- **محدودیتِ صادقانه (مهم):** این فقط mint (سرور→Soniox) را تأیید می‌کند. مسیرِ واقعیِ صدا (media-plane) طبقِ LAW-014 مستقیم **مرورگر→Soniox** است، از این پروکسیِ سمتِ سرور اصلاً عبور نمی‌کند. اگر شبکه/فیلترینگِ مرورگرِ مالک هم روی همان اتصالِ مستقیم اثر داشته باشد، آن مشکل با این فیکس حل نمی‌شود — فقط با تستِ واقعیِ صوتی (میکروفونِ واقعی، که Browser pane ندارد) قابلِ‌تأیید است.
- **فایل‌ها:** بدون تغییرِ کد؛ فقط تستِ endpointِ موجود.
- **اسنادِ به‌روزشده:** همین فایل.
- **تست / تأیید:** ۵/۵ mintِ موفق روی سرور/DBِ واقعیِ لوکال؛ پاکسازیِ کامل بعد.
- **عامل:** این نشست، به سؤالِ مستقیمِ مالک.
- **کارِ باز / پیامد:** مالک باید یک یادداشتِ صوتیِ واقعی (با میکروفونِ خودش) امتحان کند تا media-plane هم تأیید شود؛ اگر باز «ریل‌تایم نبود» دید، مشکل جایِ دیگری‌ست (شبکه‌ی مرورگر، نه mintِ سرور).

### 2026-09-15 — FINDING/CONFIG — ریشه‌ی واقعیِ «ریل‌تایم نبود»: mint-transport به Soniox، رفع با PROXY_URL
- **چه شد:** مالک لاگِ کاملِ ترمینالِ سرورِ dev را مستقیم پیست کرد (چیزی که نشستِ قبلی بهش دسترسی نداشت). خط‌به‌خط بررسی شد:
  - `req-1p`: mint موفق ولی **۸۹۹۶ms** طول کشید (نرمال زیرِ ۲۵۰ms است).
  - `req-38`: `[stt-mint] fail code=mint-transport therapist=... session=ef6830dc... key_len=64` — mint **کاملاً شکست خورد**. بلافاصله بعدش (`req-39`) fail-open درست کار کرد: صدا در صفِ `batch-audio?purpose=note` رفت، `[batch] processing…` → `[batch] segment done` — یعنی معماریِ LAW-012 دقیقاً طبقِ طراحی عمل کرد؛ چیزی که مالک به‌عنوانِ «میگه یادداشتتتتت» دید (پیامِ «در حال پردازشِ یادداشت…») نتیجه‌ی طبیعیِ همین بود، نه باگِ جداگانه.
  - **تشخیص:** `mint-transport` طبقِ تعریفِ خودِ `tempkey.ts` یعنی خطایِ ترنسپورتِ خالص (DNS/TCP/TLS) بینِ **خودِ سرور** و `api.soniox.com` — نه مسیرِ مرورگر→Soniox. یعنی مشکل به مسیرِ media (که طبقِ LAW-014 مستقیم Browser→Soniox است) ربطی ندارد؛ فقط control-plane (mint، از VPS/دستگاهِ سرور) است.
  - **کشفِ کلیدی:** کدِ `tempkey.ts` از قبل مستندش کرده بود که mint می‌تواند از `PROXY_URL` عبور کند، ولی در `server/.env` کامنت بود. چک شد: یک کلاینتِ پروکسیِ محلی همین الان رویِ `127.0.0.1:10808` با ده‌ها اتصالِ فعال در حال اجراست (به‌احتمالِ‌زیاد همان که مرورگرِ مالک استفاده می‌کند).
- **رفع:** با تأییدِ صریحِ مالک، `PROXY_URL=http://127.0.0.1:10808` در `server/.env` از کامنت درآمد.
- **فایل‌ها:** `server/.env` (فقط این خط؛ خودِ فایل هرگز commit نمی‌شود، LAW-002).
- **اسنادِ به‌روزشده:** همین فایل.
- **تست / تأیید:** خودِ تغییر یک env var است، نه کد — تأییدِ واقعی منتظرِ ری‌استارتِ `pnpm dev` توسطِ مالک و یک دورِ دیگر تستِ صوتی‌ست.
- **عامل:** این نشست، به لاگِ مستقیمِ مالک + تصمیمِ صریحِ او برایِ فعال‌سازیِ پروکسی.
- **کارِ باز / پیامد:** **مالک باید `pnpm dev` را ری‌استارت کند** تا env جدید خوانده شود، بعد دوباره یادداشتِ صوتی امتحان کند. اگر باز `mint-transport` دید، احتمالاً پورتِ ۱۰۸۰۸ SOCKS5 است نه HTTP (چون `tempkey.ts` از `HttpsProxyAgent` استفاده می‌کند که پروکسیِ HTTP/CONNECT می‌خواهد) — باید پورتِ HTTPِ همان کلاینتِ پروکسی (مثلاً ۱۰۸۰۹ در تنظیماتِ رایج) جایگزین شود.

### 2026-09-15 — INCIDENT/FINDING/CODE/TEST — «باز ریل‌تایم نبود» + اندازه‌ی دکمه‌های آرشیو با سیستمِ دیزاین نمی‌خواند
- **چه شد:** مالک بعدِ دورِ قبلی سه چیزِ دیگر گزارش کرد: (۱) «باز ریل‌تایم نبود صوتی که داشتم می‌گرفتم» + وضعیتِ «در حالِ پردازشِ یادداشت…» حینِ ضبط دیده شد، (۲) اندازه‌ی دکمه‌های «یادداشتِ صوتی»/«یادداشتِ متنی» در آرشیو با اندازه‌ی دکمه‌های معادل در Wrapup (بخشِ فعال‌ها) فرق دارد.
  - **بررسیِ (۱):** ترمینالِ در دسترسِ این نشست هیچ لاگی نداشت (پنلِ خالی — سرورِ dev ظاهراً در پنجره‌ای بیرون از دسترسِ این ابزار اجرا شده)، پس لاگِ دقیقِ همان لحظه قابلِ‌بازیابی نبود. **یافته‌ی مهم‌تر:** `feelia-rt.js` وقتی mint/اتصالِ WSِ زنده شکست می‌خورد (`connectWithFreshMint`ِ catch)، دلیلِ واقعی (status/code/message) را **هیچ‌جا لاگ نمی‌کرد** — فقط `false` برمی‌گشت و FAILED می‌شد؛ یعنی حتی در Console مرورگر هم اثری نبود. این خودِ یک FINDINGِ مستقل است، جدا از هر باگِ این نشست. **علتِ محتمل (INFERRED، نه اثبات‌شده):** چون مسیرِ صوتِ زنده مستقیم Browser→Soniox است (LAW-014)، همان الگوی از‌پیش‌مستندشده‌ی محدودیتِ شبکه/فیلترینگ که برایِ Microsoft Clarity هم دیده شده (`ERR_CONNECTION_CLOSED` به `clarity.ms`، یافته‌ی 2026-09-14) می‌تواند اتصالِ WSِ Soniox را هم مسدود کند — هر دو، اتصالِ مستقیمِ خروجی از همان مرورگر/شبکه‌اند. این یک محدودیتِ از‌پیش‌موجودِ کل سیستم است (جلسه‌ی زنده‌ی اصلی هم همین ریسک را دارد، نه فقط یادداشتِ صوتیِ آرشیو) — **نه چیزی که این کار معرفی کرده باشد.**
  - **رفعِ (۱) — بخشِ قابلِ‌رفع همین حالا:** یک لاگِ تشخیصیِ `DIAG-TEMP` (`console.warn`) به `catch` همان تابع اضافه شد که دلیلِ واقعی (mint-transport/401/direct-timeout/direct-error/…) را چاپ می‌کند — بدونِ داده‌ی حساس (LAW-001)، بدونِ تغییرِ هیچ منطقِ state machine/زمان‌بندی. دفعه‌ی بعد که این اتفاق بیفتد، بازکردنِ Console مرورگر (F12) دلیلِ دقیق را نشان می‌دهد.
  - **رفعِ (۲):** دکمه‌های بازکردنِ «یادداشتِ صوتی»/«یادداشتِ متنی» در آرشیو کلاسِ اضافیِ `btn-sm` داشتند (از رویدادهایِ قبلی مانده بود) — Wrapup و جلسه‌ی زنده هیچ‌کدام از دکمه‌های معادلشان `btn-sm` ندارند. حذف شد؛ الان دقیقاً هم‌اندازه‌اند.
- **فایل‌ها:** `public/feelia-rt.js` (فقط یک خطِ `console.warn`)، `public/index.html` (حذفِ کلاس).
- **اسنادِ به‌روزشده:** همین فایل.
- **تست / تأیید:** چون `feelia-rt.js` لمس شد، طبقِ LAW-016 `pnpm test:rt` اجرا شد → **۲۹ PASS / ۶ FAIL، عیناً همان baselineِ مستندشده** (هیچ رگرسیون؛ خطِ جدید فقط دو بار در خروجیِ هارنس چاپ شد، دقیقاً برایِ دو سناریویِ شکستِ عمدیِ تست). `node --check` روی هر دو فایل ✅. اندازه‌ی دکمه با canaryِ سومِ ایزوله (`canary-test-8`) روی سرور/DBِ واقعیِ لوکال با screenshot تأیید شد؛ پاکسازیِ کامل.
- **عامل:** این نشست، به گزارشِ مستقیمِ مالک بعدِ تستِ لوکالِ خودش.
- **کارِ باز / پیامد:** کد هنوز commitنشده. **مالک باید دفعه‌ی بعد که «ریل‌تایم نبود» را دید، Console مرورگر (F12 → Console) را چک کند و پیامِ `[feelia-rt] connect failed: ...` را برایِ این نشست بیاورد** — تا مشخص شود مشکل mintِ سمتِ سرور است یا اتصالِ مستقیمِ مرورگر→Soniox (که در آن صورت احتمالاً محدودیتِ شبکه است، نه باگِ کد). رفعِ خودِ ریشه (اگر شبکه باشد) نیاز به VPN/proxy دارد، نه تغییرِ کد؛ اگر mintِ سرور باشد، نیاز به بررسیِ جداگانه دارد.

### 2026-09-15 — INCIDENT/CODE/TEST — سه فیدبکِ مالک بعدِ تستِ لوکالِ خودش: نوعِ یادداشتِ صوتی، بازبینیِ متن، ظاهرِ کارتِ مراجع
- **چه شد:** مالک خودش با سرورِ واقعیِ لوکالِ خودش (پورتِ ۳۰۰۰) تست کرد و گفت «اوکی بود اما»، سه ایراد:
  1. «وقتی صوت میگیره تگش رو میزنه یادداشت متنی به جای صوتی، کلا میخوام رنگش هم متفاوت باشه» — **ریشه:** `addArchiveTextNote` همیشه با `type:'note_after'` POST می‌کرد، حتی وقتی متنِ داخلِ textarea نتیجه‌ی ضبطِ صوتی بود (رفعِ رویدادِ قبلی فقط POSTِ خودکار را حذف کرده بود، نه نوعِ ذخیره را). چون رنگِ برچسب (`tag-voice`=رنگِ خاک‌گلی، `tag-text`=رنگِ سبز؛ از قبل در CSS جدا بودند) از رویِ همین `type` تعیین می‌شود، رنگ هم همیشه اشتباه بود.
  2. «وقتی ضبط تموم شد متن رو نشون بده، دو گزینه: ادیت متن یا ثبت و ذخیره، که بفهمه میتونه ادیت کنه» — قبلاً textarea از همان لحظه قابلِ‌ویرایش بود ولی هیچ نشانه‌ای نداشت.
  3. «توی غیرفعال‌ها فقط پرونده‌ی خاکستریه، توی فعال‌ها سبز و خاکستری داریم، طراحی ناهمسان شده» — کارتِ مراجعِ غیرفعال از اول هیچ دکمه‌ی primaryِ سبز نداشت (فقط «پرونده»)، برخلافِ کارتِ فعال.
- **رفع:**
  1. یک متغیرِ سراسریِ `archiveTextNoteOrigin` ('voice'/'text') اضافه شد؛ روی هر مسیرِ ورودِ متن (تایپِ مستقیم در `showArchiveTextInput`، یا نتیجه‌ی ضبط در `stopArchiveVoiceNoteDirect`) تنظیم می‌شود؛ `addArchiveTextNote` بر اساسِ آن `type:'voice'` یا `type:'note_after'` می‌فرستد.
  2. بعدِ پایانِ ضبطِ موفق، textarea با `readOnly=true` (+ کلاسِ CSSِ `readonly-preview`، بوردرِ خط‌چین) و یک متنِ راهنمای کوچک نشان داده می‌شود؛ دکمه‌ی جدیدِ «ویرایشِ متن» (`enableArchiveTextEdit`) قفل را باز و مکان‌نما را به انتهای متن می‌برد؛ دکمه‌ی ذخیره در این حالت برچسبِ «ثبت و ذخیره» می‌گیرد (به‌جایِ «ذخیره‌ی یادداشت»ِ حالتِ تایپِ مستقیم). تایپِ آزاد (بدونِ ضبط) این قفل را از اول ندارد.
  3. کارتِ مراجعِ غیرفعال حالا هم یک دکمه‌ی `btn-primary` («ثبتِ جلسه‌ی گذشته»، هم‌جای «شروع جلسه»ی کارتِ فعال) + «پرونده»ی ghost دارد؛ کلیک مستقیم `startManualSessionFlow` را روی همان مراجع صدا می‌زند.
- **فایل‌ها:** `public/index.html` فقط.
- **اسنادِ به‌روزشده:** همین فایل.
- **تست / تأیید:** `tsc --noEmit` ✅، `node --check` ✅. **سرور/DBِ واقعیِ لوکال** با حسابِ canaryِ دومِ کاملاً ایزوله (`canary-test-7`): کارتِ غیرفعال حالا دقیقاً هم‌شکلِ کارتِ فعال (screenshot تأییدشد)؛ یادداشتِ صوتیِ شبیه‌سازی‌شده (stubِ `FeeliaRT`) → `readOnly=true` قبل از ذخیره، دکمه‌ی «ویرایشِ متن» قفل را باز کرد؛ ذخیره → **کوئریِ مستقیمِ Postgres تأیید کرد `type='voice'`** در `session_notes` (نه `note_after`) و رندرِ بعدی برچسبِ «صوتی» با کلاسِ `tag-voice` (رنگِ متفاوت) داشت. پاکسازیِ کامل (client=1, sessions=2, notes=1, therapist=1 حذف شد؛ صفر ردیفِ باقی‌مانده).
- **عامل:** این نشست، به فیدبکِ مستقیمِ مالک بعدِ تستِ لوکالِ خودش.
- **کارِ باز / پیامد:** کد هنوز commitنشده.

### 2026-09-15 — TEST/FINDING/CODE — تأییدِ روی سرور/DBِ واقعیِ لوکال (رویدادِ قبلی) + فیکسِ فهرستِ جلسات در پرونده
- **چه شد:** مالک صریحاً اجازه‌ی تستِ کاملِ لوکال روی سرور/DBِ واقعی داد («کامل خودت لوکال تست کن»، LAW-006). سرورِ dev مالک از قبل روی پورتِ ۳۰۰۰ باز بود (نشستِ دیگر/ترمینالِ خودِ مالک) — به‌جایِ لمس/ری‌استارتِ آن، یک نمونه‌ی موقتِ دومِ سرور روی پورتِ ۳۰۰۱ با همان DB بالا آورده شد فقط برایِ اطمینان از اجرایِ migration 014 (که خودِ سرورِ ۳۰۰۰ هم، به‌خاطرِ `tsx watch`، از قبل با ذخیره‌شدنِ فایلِ migration اجرا کرده بود — «already applied» در لاگ)؛ نمونه‌ی ۳۰۰۱ بلافاصله بعدِ تأیید متوقف شد. تستِ واقعی با یک حسابِ **canary** ایزوله (`canary-test-6` / `09190006061`) مستقیم روی پورتِ ۳۰۰۰ انجام شد.
  - **FINDINGِ واقعی پیدا و رفع شد:** فهرستِ جلسات در **صفحه‌ی پرونده** (`openClientDetail`، نه `screenSessionDetail`) برایِ جلسه‌ی دستی هنوز «شروع ۱۱:۵۴» (ساعتِ لحظه‌ی ثبت) نشان می‌داد و برچسبِ «ثبتِ دستی» کلاسِ سبزِ `completed` داشت — رویدادِ قبلی فقط صفحه‌ی خودِ جلسه را اصلاح کرده بود، نه این ردیفِ فهرست را. رفع شد: برایِ `source==='manual'` ساعت نشان داده نمی‌شود («بدونِ تاریخ» یا فقط تاریخ)، و کلاس به `canceled` (خنثی/خاکستری، از‌پیش‌موجود در CSS) تغییر کرد.
  - **تأییدِ end-to-end با نوشتن/خواندنِ مستقیمِ Postgres** (نه فقط UI): ساختِ مراجعِ غیرفعال → مستقیم صفحه‌ی جلسه با `date=NULL` واقعی در DB (نه رشته)؛ `PUT` با تاریخ → مقدارِ صحیح در ستون؛ خالی‌کردنِ فیلد → واقعاً `NULL` در DB (نه رشته‌ی «»)؛ یادداشتِ متنی → ردیفِ واقعی در `session_notes`؛ حذف → `DELETE` واقعی و ردیف از DB پاک شد؛ یادداشتِ صوتیِ شبیه‌سازی‌شده (stubِ `FeeliaRT.createSession`، چون Browser pane میکروفونِ واقعی ندارد) → متن در textarea نشست و **هیچ ردیفی در `session_notes` ساخته نشد** (تصمیمِ ۳ تأیید شد)؛ کلیکِ «بازگشت به پرونده» با متنِ ذخیره‌نشده در textarea → `confirm()` واقعاً ناوبری را بلاک کرد (B3)؛ بعدِ خالی‌کردنِ textarea، همان دکمه بدونِ پرامپت navigate کرد.
  - **پاکسازیِ کامل:** کلاینت/جلسه/یادداشت‌های canary حذف شدند (cascade دستی روی DB) + حسابِ تراپیستِ canary هم حذف شد؛ کوئریِ نهایی صفر ردیفِ باقی‌مانده را تأیید کرد. سرورِ اصلیِ مالک روی پورتِ ۳۰۰۰ دست‌نخورده باقی ماند.
- **فایل‌ها:** `public/index.html` (فقط رندرِ فهرستِ جلسات در `openClientDetail`).
- **اسنادِ به‌روزشده:** همین فایل. (کاتالوگ‌ها همچنان طبقِ رویدادِ قبلی بازِ کارِ آینده‌اند.)
- **تست / تأیید:** `cd server && npx tsc --noEmit` → بدونِ خطا (بعدِ فیکسِ فهرست). سناریویِ کاملِ بالا روی DBِ واقعیِ لوکال با کوئریِ مستقیمِ Postgres تأیید شد (نه فقط ظاهرِ UI). رونویسیِ زنده‌ی واقعیِ Soniox با میکروفونِ واقعی همچنان تست‌نشده می‌ماند (محدودیتِ ابزار، نه کوتاهی).
- **عامل:** این نشست، به درخواستِ صریحِ مالک برایِ تستِ کاملِ لوکال.
- **کارِ باز / پیامد:** کد هنوز commitنشده. کاتالوگ‌های مستندات هنوز عقب‌اند (از رویدادِ قبلی). توقف/ادامه‌ی واقعی با میکروفون و رونویسیِ زنده باید توسطِ مالک تست شود.

### 2026-09-15 — CODE/DECISION/FINDING/TEST — تاریخِ اختیاریِ بدونِ ساعت + مسیرِ مستقیمِ ساختِ مراجع + متنِ صوتی در textarea + گاردهایِ ازدست‌رفتنِ داده
- **چه شد:** مالک یک پلنِ ممیزی/طراحیِ مفصل (نوشته‌شده در نشستی دیگر/پیش‌تر) پیست کرد و خواستِ اجرایِ دقیقِ آن را داد. **FINDING اول:** بخشِ بزرگی از آن پلن روی وضعیتِ *قبل*ِ رویدادِ همین امروز (`screenSessionDetail`، ردیفِ inlineِ تاریخ/ساعت، توقف/ادامه) نوشته شده بود — یعنی audit خودش قدیمی بود؛ به‌جایِ اجرایِ کورکورانه، کدِ فعلی خط‌به‌خط با ادعاهای پلن تطبیق داده شد. سه بخش واقعاً هنوز باز بودند (تصمیم‌های صریحِ مالک در همان پلن) + چند یافته‌ی واقعیِ دیگر:
  1. **مسیرِ مستقیمِ ساختِ مراجع→ورودِ داده:** `createNewClient` حالا در تبِ فعال مستقیم `setupNewSession` و در تبِ غیرفعال مستقیم `startManualSessionFlow` را صدا می‌زند (بازاستفاده از مسیرِ تست‌شده، نه معماریِ تازه‌ی lazy-session).
  2. **تاریخِ اختیاریِ بدونِ ساعت:** ستونِ `sessions.date` nullable شد (migration 014)؛ `POST /api/sessions` برایِ manual بدونِ تاریخ → `NULL` (نه fallbackِ «امروز»)؛ `PUT` با `date:null` فقط برایِ `source='manual'` مجاز. UI: فیلدِ ساعت حذف، فیلدِ تاریخ با change/blur خودکار ذخیره می‌شود (بدونِ دکمه‌ی جدا)، «بدونِ تاریخ» به‌جایِ رشته‌ی «null» (فیکسِ `toFa`).
  3. **متنِ صوتی در textarea:** `stopArchiveVoiceNoteDirect` دیگر خودکار POST نمی‌کند؛ متنِ رونویسی‌شده در `archiveTextNoteInput` می‌آید تا تراپیست بخواند/ویرایش کند و صریحاً «ذخیره‌ی یادداشت» بزند (مسیرِ legacy طبقِ LAW-015 دست‌نخورده ماند — سرور خودش ذخیره می‌کند).
  - **FINDINGهایِ اضافه (رفع‌شده):** (A2) کلیکِ «توقف موقت» در چند ثانیه‌ی STARTING بی‌صدا هیچ اثری نداشت — الان دکمه تا وصل‌شدنِ واقعی (state) غیرفعال است و علت را می‌گوید؛ (B1) دکمه‌ی «یادداشتِ متنی» حالا وسطِ ضبط غیرفعال است؛ (B2) ذخیره‌ی تاریخ/افزودنِ یادداشت دیگر `viewTranscript` کامل (با اسکرول + cleanupِ ضبطِ فعال) صدا نمی‌زند، فقط لیست را رندر می‌کند؛ (B3) سوئیچِ جلسه/«بازگشت به پرونده» وسطِ ضبط یا با متنِ ذخیره‌نشده حالا `confirm()` می‌پرسد؛ `beforeunload` متنِ ذخیره‌نشده را هم چک می‌کند؛ یادداشت‌هایِ جلسه‌ی دستی حالا با کارتِ `.note-item`ِ Wrapup (برچسب + حذفِ واقعی از DB) رندر می‌شوند، بدونِ ساعتِ بی‌معنا.
  - **عمداً خارج از این دور (نیازِ تصمیم/کارِ جداگانه):** معماریِ lazy-session (ساختِ جلسه فقط با اولین ذخیره) — ریسکِ بازنویسیِ معماریِ تازه‌تست‌شده را نداشت، اجرای فعلی (eager، مثلِ رویدادِ 2026-09-14) نگه داشته شد؛ توقف/ادامه‌ی واقعی در حالتِ محلی/FAILED (نیازِ تغییرِ `feelia-rt.js`، پلن بخشِ ۵)؛ پولیشِ ظاهریِ E1–E3 (رنگِ بنر، اندازه‌ی دقیقِ فونت‌ها به‌جز مواردِ بالا).
- **فایل‌ها:** `server/src/db/migrations/014_session_date_optional.sql` (جدید)، `server/src/http/sessions.ts`، `public/index.html`.
- **اسنادِ به‌روزشده:** همین فایل. *(باز مانده: `docs/02-reference/api-catalog.md`/`database-catalog.md`/`data-architecture.md` برایِ تاریخِ nullable، `docs/03-requirements/requirement-catalog.md` — به‌خاطرِ حجمِ تغییر در یک نشست، در دورِ بعدی تکمیل می‌شود؛ ثبت به‌عنوانِ کارِ باز، نه فراموشی.)*
- **تست / تأیید:** `cd server && npx tsc --noEmit` → بدونِ خطا. `node --check` روی JSِ inlineِ استخراج‌شده از `index.html` → exit 0. **mock backend در scratchpad** (سرو کردنِ `public/` واقعی، بدونِ حساب/DBِ واقعی، طبقِ LAW-016) با Browser pane: ساختِ مراجعِ غیرفعال → بدونِ کلیکِ اضافه مستقیم صفحه‌ی جلسه باز شد (`بدونِ تاریخ`)؛ تایپِ تاریخ + blur → دقیقاً یک `PUT`، متنِ سربرگ به‌روز شد، بدونِ دکمه‌ی ذخیره؛ یادداشتِ متنی → `POST` + کارتِ note-item + حذف → `DELETE` واقعی + جمع‌شدنِ فوریِ لیست (بدونِ ریلود)؛ شبیه‌سازیِ state با stubِ `window.FeeliaRT.createSession` (STARTING→ACTIVE→MANUAL_PAUSED→finish): دکمه‌ی توقف در STARTING واقعاً `disabled` بود (فیکسِ A2 تأییدشد)، دکمه‌ی یادداشتِ متنی هم `disabled` بود (B1)، در ACTIVE فعال شد، پاز/ادامه UI درست سوئیچ کرد؛ کلیکِ «بازگشت به پرونده» وسطِ ضبط ناوبری را بلاک کرد (B3، `confirm()` بومی — نه مودالِ سفارشی، محدودیتِ صادقانه)؛ `finish()` متن را در textarea گذاشت (**نه POST خودکار**، تصمیمِ ۳ تأیید شد) و ذخیره‌ی صریح یادداشتِ نوعِ متنی ساخت؛ بازگشتِ بدونِ کارِ ذخیره‌نشده بدونِ پرامپت انجام شد. **رونویسیِ واقعیِ Soniox با میکروفونِ واقعی تست نشد** (محدودیتِ Browser pane) — طبقِ حرفِ صادقانه، کارِ باقی‌مانده برایِ مالک.
- **عامل:** این نشست، به پلنِ پیست‌شده‌ی مالک + FINDINGِ خودِ نشست دربابِ قدیمی‌بودنِ بخشی از آن پلن.
- **کارِ باز / پیامد:** کد هنوز commitنشده. اسنادِ کاتالوگ (`api-catalog`, `database-catalog`, `requirement-catalog`) هنوز با migration 014 هم‌گام نیستند — قبل از commit باید تکمیل شوند (LAW-017). توقف/ادامه‌ی واقعی و رونویسیِ زنده باید توسطِ مالک با میکروفونِ واقعی تست شود.

### 2026-09-15 — CODE/INCIDENT/TEST — صفحه‌ی مستقلِ جلسه + تاریخ/ساعتِ inline + توقف/ادامه‌ی یادداشتِ صوتی
- **چه شد:** مالک سه ایرادِ دیگر روی «ثبتِ جلسه‌ی گذشته» گرفت (INCIDENTِ طراحی، نه فیچرِ جدید): «میخوام یه صفحه باز شه نمیخوام بره اون پایین» (۱)، «وقتی تاریخ و ساعت نیست ویرایش چیه این وسط» (۲)، «مثل قبل دکمه‌ی توقف باید داشته باشه و ادامه» (۳)، و خواست همه‌ی این مسیرها اول چک و باگ‌یابی شود، بعد طراحیِ درست انجام شود.
  - **رفعِ ۱:** `sessionDetail` از تو در توی `screenClientDetail` بیرون آمد و شد `screenSessionDetail` — یک screenِ کاملاً مستقل (مثلِ Setup/Live/Wrapup)، با `showScreen('SessionDetail')` و دکمه‌ی «بازگشت به پرونده».
  - **رفعِ ۲:** برایِ `source==='manual'` دکمه‌ی «ویرایش تاریخ/ساعت» مخفی؛ به‌جایش یک ردیفِ inlineِ همیشه‌نمایانِ تاریخ+ساعت+«ذخیره» (از‌پیش‌پرشده). جلسه‌ی زنده/کامل همان دکمه+مودالِ قبلی را دارد؛ هسته‌ی مشترک (`persistSessionDateTime`) بینِ هر دو به اشتراک گذاشته شد.
  - **رفعِ ۳:** دکمه‌های «توقف»/«ادامه» به یادداشتِ صوتیِ آرشیو اضافه شد. **بازاستفاده، نه بازنویسی:** مسیرِ FeeliaRT از `RTSession.pause()/resume()`ِ *همان کلاسی* که جلسه‌ی زنده سال‌هاست استفاده می‌کند — بعدِ خواندنِ دقیقِ کد تأیید شد این متدها فقط به `state` وابسته‌اند نه `mode`، پس رویِ `mode:'note'` هم درست کار می‌کنند (فقط `persist=false` می‌ماند، یعنی transcriptِ موقت در `sessions` نمی‌نشیند). `archiveVoiceOnState` عیناً فیکسِ ریشه‌ایِ `rtOnState` را تکرار می‌کند (به‌روزرسانیِ state هم‌زمان با تغییرِ واقعی، نه بعدِ تأخیرِ resolveِ promise — وگرنه همان باگِ قدیمی برمی‌گشت). مسیرِ legacy از `MediaRecorder.pause()/resume()`ِ بومی.
  - در همین دور، یک باگِ کوچکِ خودم هم در `openClientDetail` پاک شد (`$('sessionDetail').hidden=true` — کدِ مرده‌ی باقی‌مانده از معماریِ قبلی).
- **فایل‌ها:** `public/index.html` فقط (بدونِ تغییرِ سرور).
- **اسنادِ به‌روزشده:** `docs/03-requirements/requirement-catalog.md` (REQ-033)، `docs/04-modules/03-therapy-sessions/module-prd.md`، [`verification/2026-09-14-client-status-archive.md`](verification/2026-09-14-client-status-archive.md) §10.
- **تست / تأیید:** `node --check` روی JSِ inline → exit 0. سرورِ dev از قبل روشن نبود (مالک ترمینالش را بسته بود) — این نشست خودش با `pnpm dev` بالا آوردش (بدونِ داده‌ی جدید، همان DBِ قبلی). با canaryِ پنجمِ کاملاً ایزوله، real HTTP: کلیکِ واقعی روی «ثبتِ جلسه‌ی گذشته» → واقعاً صفحه عوض شد (`scrollY=0`, هر دو screenِ `hidden` درست)؛ ردیفِ inlineِ تاریخ/ساعت از پیش پر و با ارقامِ فارسیِ واقعی ذخیره شد (`PUT` واقعی، تأییدشده در DB)؛ حالتِ اولیه‌ی دکمه‌های توقف/ادامه درست؛ کلیکِ یادداشتِ صوتی (ردِّ میکروفونِ sandbox) بدونِ نشتی cleanup شد و دکمه‌ها به حالتِ اولیه برگشتند؛ فراخوانیِ pause/resume بدونِ ضبطِ فعال بدونِ خطا no-op بود؛ یادداشتِ متنی و «بازگشت به پرونده» هر دو روی صفحه‌ی جدید کار کردند. پاکسازیِ کامل. **خودِ عملکردِ واقعیِ pause/resume حینِ یک ضبطِ زنده تست نشد** (نیازِ میکروفونِ واقعی).
- **عامل:** این نشست، به سه ایرادِ صریحِ مالک.
- **کارِ باز / پیامد:** مالک باید خودش با میکروفونِ واقعی توقف/ادامه‌ی یادداشتِ صوتی را امتحان کند. کد هنوز commitنشده.

### 2026-09-14 — CODE/INCIDENT/TEST — حذفِ مودالِ ثبتِ جلسه‌ی گذشته: صوتی و متنی از همون صفحه‌ی اول
- **چه شد:** مالک بلافاصله بعدِ رویدادِ قبلی اعتراض کرد: «چرا بعد از یادداشت باید صوت بذاره، همین صفحه‌ای که باز میشه هم اپشن صوتی داشته باشه هم متنی». یعنی طراحیِ رویدادِ قبل (مودالِ تاریخ/ساعت/یادداشتِ متنی → ثبت → بعداً از پرونده یادداشتِ صوتی) دقیقاً همان اصطکاکی بود که رد کرد — **این یک INCIDENTِ طراحی است، نه یک درخواستِ فیچرِ جدید.**
  - **رفع:** `manualSessionModal` (HTML) و توابعِ `openManualSession`/`closeManualSession`/`saveManualSession` کامل حذف شدند. جایگزین: `startManualSessionFlow()` — با یک کلیک، بدونِ هیچ فرمی، بلافاصله `POST /api/sessions {client_id, mode:'manual'}` (تاریخ/ساعت = وقتِ ایران، طبقِ تصمیمِ همان روز) و بی‌درنگ صفحه‌ی همان جلسه (`viewTranscript`) باز می‌شود — صفحه‌ای که از رویدادِ قبلی همین امروز از ابتدا هم دکمه‌ی «یادداشتِ صوتی» هم «یادداشتِ متنی» را کنارِ هم دارد، به‌علاوه‌ی دکمه‌ی از‌قبل‌موجودِ «ویرایش تاریخ/ساعت» برایِ تنظیمِ تاریخِ دقیق در صورتِ نیاز.
- **فایل‌ها:** `public/index.html` (بدونِ تغییرِ سرور).
- **اسنادِ به‌روزشده:** `docs/02-reference/api-catalog.md`، `docs/03-requirements/requirement-catalog.md` (REQ-032/033 اصلاح)، `docs/04-modules/03-therapy-sessions/module-prd.md`، [`verification/2026-09-14-client-status-archive.md`](verification/2026-09-14-client-status-archive.md) §9.
- **تست / تأیید:** `node --check` روی JSِ inline → exit 0. با حسابِ canaryِ چهارمِ کاملاً ایزوله، مستقیم روی سرور/Postgresِ واقعی: یک کلیک → بدونِ مودال، جلسه ساخته شد و صفحه‌اش با هر دو دکمه از همان لحظه‌ی اول باز شد (تأییدشده با DOM + screenshot)؛ یادداشتِ متنی end-to-end کار کرد؛ حذفِ آبشاری `cascade:{session:1, note:1}` دقیقاً مطابق. پاکسازیِ کامل + صفر canaryِ باقی‌مانده.
- **عامل:** این نشست، به اعتراضِ صریحِ مالک بلافاصله بعدِ رویدادِ قبلی.
- **کارِ باز / پیامد:** کد هنوز commitنشده.

### 2026-09-14 — CODE/DECISION/TEST — ثبتِ جلسه‌ی گذشته: تاریخ/ساعتِ اختیاری + یادداشتِ صوتی (REQ-032 اصلاح، REQ-033 جدید)
- **چه شد:** مالک بعدِ تستِ اولیه گفت: «من ثبت جلسات گذشته هم دوباره باید قابلیت صوتی و اینا داشته باشه، تاریخ هم اختیاری باشه ساعت هم نمیخواد یا اگه میخوای باشه هم اختیاری باشه … مسیر صوتی و ایناش رو هم که دیگه مثل بقیه بلدی».
  - **تاریخ/ساعتِ اختیاری:** الزامِ قبلیِ «تاریخ و ساعت را کامل وارد کنید» در `POST /api/sessions` (mode manual) حذف شد؛ همان fallbackِ `nowInTehran()`ِ از‌قبل‌موجود (که برایِ جلسه‌ی زنده هم استفاده می‌شود) حالا برایِ manual هم اعمال می‌شود — بدونِ تاریخ/ساعت (هر دو یا فقط یکی) → وقتِ ایران برایِ همان فیلد.
  - **یادداشتِ صوتی/متنیِ بیشتر بعدِ ساخت:** چون تا جلسه ساخته نشه id نداره، یادداشتِ صوتی در **خودِ مودالِ ساخت** امکان‌پذیر نیست — بعدِ ذخیره، کاربر مستقیم به همان جلسه (`viewTranscript`) می‌رود و از آنجا یادداشتِ متنی/صوتی اضافه می‌کند. مسیرِ صوتی دقیقاً همان چیزی‌ست که Wrapup از قبل دارد (FeeliaRT مستقیم با fallback به legacy WSِ `/ws/voice/:id` + صفِ آفلاینِ durable) — **کپیِ عمدیِ مستقل** (نه refactorِ کدِ زنده، طبقِ LAW-020) با متغیر/DOM/توابعِ `archive*` جداگانه تا هیچ‌وقت با `currentSession`ِ جلسه‌ی زنده قاطی نشود؛ `cleanupArchiveVoice()` در نقاطِ سوئیچِ صفحه (`viewTranscript`، `openClientDetail`، `goBackToClients`) صدا زده می‌شود و به `hasActiveRecording()`/`beforeunload` هم اضافه شد.
  - **DECISION (مستندشده، نه فرض):** یادداشتِ صوتیِ اینجا رضایتِ مراجع نمی‌خواهد — صدای خودِ تراپیست است که دربارهٔ جلسه‌ای که قبلاً (و بدونِ این نرم‌افزار) اتفاق افتاده دیکته می‌کند، نه ضبطِ گفت‌وگوی زنده با مراجع؛ همین قاعده از قبل برایِ یادداشتِ صوتیِ Wrapup هم برقرار است (رضایتِ جداگانه ندارد). LAW-009 نقض نمی‌شود چون آن قانون دربارهٔ ضبطِ «جلسه» است.
- **فایل‌ها:** `server/src/http/sessions.ts`، `public/index.html`.
- **اسنادِ به‌روزشده:** `docs/02-reference/api-catalog.md`، `docs/03-requirements/requirement-catalog.md` (REQ-032 اصلاح، REQ-033 جدید)، `traceability-matrix.md`، `docs/04-modules/03-therapy-sessions/module-prd.md`، [`verification/2026-09-14-client-status-archive.md`](verification/2026-09-14-client-status-archive.md) §8.
- **تست / تأیید:** `tsc --noEmit` و `node --check` روی JSِ inline → هر دو exit 0. با یک حسابِ canaryِ سومِ کاملاً ایزوله، مستقیم روی سرور/Postgresِ واقعیِ لوکال: ۳ ترکیبِ تاریخ/ساعتِ اختیاری (بدونِ هیچ‌کدام، فقط تاریخ، فقط ساعت) هر سه ۲۰۱ با fallbackِ درست؛ پنلِ یادداشت فقط برایِ جلسه‌ی manual نمایان شد؛ یادداشتِ متنی end-to-end (POST واقعی، بازخوانی فوری) کار کرد؛ کلیکِ یادداشتِ صوتی زنجیره‌ی کامل (FeeliaRT→fallback→درخواستِ میکروفونِ واقعی) را طی کرد و روی ردِّ دسترسیِ میکروفون (محدودیتِ Browser pane) با پیامِ فارسیِ درست و بدونِ نشتیِ WS/state متوقف شد — خودِ رونویسیِ صوتی تست‌نشده ماند. پاکسازیِ کامل + شمارشِ نهایی: صفر ردیفِ یتیم، صفر canaryِ باقی‌مانده، صفر فرمتِ تاریخِ نامعتبر.
- **عامل:** این نشست، به درخواستِ صریحِ مالک.
- **کارِ باز / پیامد:** کد هنوز commitنشده. تعدادِ `clients` در DBِ لوکال بینِ این دور و دورِ قبل +۲ شد — طبقِ FINDING در verification §8، به‌احتمالِ‌زیاد از فعالیتِ هم‌زمانِ خودِ مالک (که گفته بود می‌خواهد خودش لوکال تست کند)، نه از این نشست؛ `sessions` بدونِ تغییر ماند و بررسیِ صریح نشان داد هیچ ردیفِ یتیمی از تستِ این نشست نمانده. اگر مالک با «بدونِ رضایتِ جداگانه برایِ یادداشتِ صوتیِ آرشیو» موافق نیست، باید صریحاً بگوید تا اصلاح شود.

### 2026-09-14 — TEST/INCIDENT — تستِ کاملِ واقعی روی سرور و Postgresِِلوکال (هر دو رفعِ باگ + تاریخِ شمسی)
- **چه شد:** مالک: «تست کن کامل همچی درست کار بکنه تست واقعی انجام بده» — یعنی تأییدِ صریحِ همان مجوزی که گزارشِ قبلی برایش صبر کرده بود (LAW-006). `git status` قبل از هر کاری چک شد (کارِ commitنشده مطابقِ انتظار).
  - **کشف:** سرورِ dev از قبل توسطِ مالک در ترمینالِ خودش روی پورت ۳۰۰۰ روشن بود (`preview_start` گزارش داد پورت در اشغال است) و migrationهای **012 و 013 از قبل روی DBِ واقعی اعمال شده بودند** — یعنی مالک خودش بعد از نوشته‌شدنِ این فایل‌ها `pnpm dev` را اجرا کرده بود. DB واقعی: `therapists=2, clients=19, sessions=89`.
  - **تستِ فقط‌خواندنی روی داده‌ی واقعیِ ۸۹ جلسه (بدونِ خواندنِ محتوا):** هر ۸۹ ردیفِ `sessions.date` فرمتِ شمسیِ نرمال دارند؛ **صفر** ردیفِ میلادیِ باقی‌مانده — یعنی migration 013 روی داده‌ی واقعی درست اجرا شده.
  - **تستِ نویسنده:** یک حسابِ **canary** واقعی ساخته شد (`09000000091`/`QA-canary-do-not-use`، کاملاً ایزوله از ۱۹ مراجعِ واقعی) و با کلیکِ واقعیِ DOM + `fetch` در همان صفحه، سناریوهای REQ-016/017/032/029 مستقیماً روی HTTPِ واقعی و Postgresِ واقعی اجرا شد: ساخت در تبِ غیرفعال با دلیل، 409ِ واقعیِ `client-inactive`، ۴ حالتِ 400 بدونِ ایجادِ ردیفِ یتیم (اتمیکِ CTE تأیید شد)، ثبتِ جلسه‌ی دستی با تایپِ واقعیِ ارقامِ فارسی → `date="1404/11/05"`، ویرایشِ تاریخ با ارقامِ فارسی و خط‌تیره → `"1405/06/20"`، بازگرداندن به فعال → `status_reason=null`، جلسه‌ی زنده بدونِ تاریخ → پیش‌فرضِ `Asia/Tehran` (نه منطقه‌ی زمانیِ سرور) با محاسبه‌ی UTC+۳:۳۰ تأیید شد، و حذفِ آبشاری با گزارشِ صحیحِ `cascade`.
  - **پاکسازی:** هر دو مراجعِ canary و جلساتشان حذف شدند (آبشاری)؛ logout؛ ردیفِ حسابِ canary با یک `DELETE` بسیار محدود (تطبیقِ دقیقِ شماره+نام، بعدِ SELECTِ تأییدی) پاک شد. شمارشِ نهایی دقیقاً برابرِ ابتدای کار: `therapists=2, clients=19, sessions=89`. **هیچ داده‌ی واقعیِ مراجعین خوانده یا لمس نشد.**
- **فایل‌ها:** بدونِ تغییرِ کد (فقط تست). دو اسکریپتِ موقتِ Node در `server/._tmp_*.mjs` ساخته و بلافاصله حذف شدند (هرگز commit نشدند).
- **اسنادِ به‌روزشده:** [`verification/2026-09-14-client-status-archive.md`](verification/2026-09-14-client-status-archive.md) §7 (جدولِ کاملِ ۱۰ سناریو).
- **تست / تأیید:** جزئیات در verification §7. نتیجه: **صفر رگرسیون، صفر خطای غیرمنتظره** — REQ-016، REQ-017، REQ-029 (شاملِ خودِ migration 013 روی ۸۹ جلسه‌ی واقعی)، REQ-032 همگی روی سرور/DBِ واقعی (نه mock) تأیید شدند.
- **عامل:** این نشست، به دستورِ صریحِ مالک.
- **کارِ باز / پیامد:** کدِ همچنان commitنشده است (فقط به درخواستِ مالک commit می‌شود). چون migration 013 از قبل روی این DBِ لوکال اجرا شده، deploy به production همچنان نیازمندِ backupِ `sessions` است (DBِ production جدا و دست‌نخورده است). لاگ‌های سرورِ dev در دسترسِ ابزار نبود (خارج از ردیابیِ preview چون مالک خودش استارتش کرده بود) — صحت فقط از رویِ پاسخِ HTTP و خواندنِ دوباره‌ی DB تأیید شد، نه از رویِ لاگ.

### 2026-09-14 — CODE/MIGRATION/DECISION/TEST — تاریخِ همه‌ی جلسه‌ها شمسی شد (رفعِ C4 / UI-09 / UX-014)
- **چه شد:** مالک خواست FINDINGِ (۱) ورودیِ قبلی هم رفع شود: «اصلاحش کن اونم، شمسی باشه». ریشه: `POST /api/sessions` برای جلسه‌ی زنده تاریخِ **میلادیِ** ماشینِ سرور می‌گذاشت، در حالی که Setup همان لحظه شمسی نشان می‌داد و ویرایش/ثبتِ دستی شمسی بود؛ `MAX(s.date)` روی TEXT («آخرین جلسه» در `clients.ts` و `admin.ts`) با دو فرمت غلط می‌شد («2026/…» همیشه > «1405/…»).
  - **تصمیمِ مالک (سؤالِ صریح):** داده‌ی قبلی (از جمله production) با **migration تبدیل شود** (گزینه‌ی پیشنهادی)، نه فقط نمایش و نه فقط جلسه‌های جدید. طبقِ LAW-007 داده‌تغییردهنده است → **backup از `sessions` قبل از deploy الزامی**.
  - **اجرا:** ماژولِ جدیدِ `server/src/http/sessionDate.ts` (`toLatinDigits`، `gregorianToJalali` حسابیِ ۳۳ساله، `normalizeSessionDate` — شمسی/میلادی/ارقامِ فارسی/`-` → `YYYY/MM/DD` لاتین، نامعتبر → null؛ `normalizeStartTime` → `HH:MM`؛ `nowInTehran` برای پیش‌فرض). `POST /api/sessions` (زنده و manual) و `PUT /api/sessions/:id` همه‌ی تاریخ/ساعت‌ها را نرمال و ورودیِ نامعتبر را 400 می‌کنند؛ پیش‌فرضِ بدونِ تاریخ = وقتِ ایران به‌جای منطقه‌ی زمانیِ سرور. فرانت: `startSession` تاریخ (`toJalali`) و ساعتِ دستگاه را همان‌طور که Setup نشان می‌دهد می‌فرستد؛ `saveSessionMeta` ارقام را لاتین می‌کند. migration **`013_session_date_jalali.sql`**: `DO` block که هر `sessions.date` با الگوی Y/M/D را نرمال می‌کند (میلادی با سال ≥ ۱۷۰۰ → شمسی، شمسیِ نانرمال → صفرپُر، الگوهای دیگر دست‌نخورده)، idempotent.
- **فایل‌ها:** `server/src/http/sessionDate.ts` (جدید)، `server/src/http/sessions.ts`، `server/src/db/migrations/013_session_date_jalali.sql` (جدید)، `public/index.html`. (`.claude/launch.json` دوباره موقتاً برای mock تغییر کرد و برگشت.)
- **اسنادِ به‌روزشده:** `api-catalog.md` (POST/PUT)، `database-catalog.md` (013، ستونِ `date`/`start_time`)، `data-architecture.md`، `repository-map.md` (`sessionDate.ts`، 008–013)، `03-therapy-sessions/module-prd.md` (Validation، C4)، `requirement-catalog.md` (REQ-029)، `traceability-matrix.md`، `documentation-map.md` (C4)، `master-implementation-plan.md` (P2-3)، `PROJECT_MASTER_REFERENCE.md` §22، [`verification/2026-09-14-client-status-archive.md`](verification/2026-09-14-client-status-archive.md) §6.
- **تست / تأیید:** (۱) الگوریتمِ تبدیل روز‌به‌روز برای 1950-01-01…2100-12-31 با `Intl` (ICU 78.3 persian، منبعِ `toJalali`ِ فرانت) مقایسه شد: **۰ اختلاف در ۵۵۱۵۲ روز**. (۲) تستِ واحدِ `sessionDate.ts` با `tsx`: **۳۸/۳۸ PASS** (نرمال‌سازی، رد ۳۰ فوریه/۳۱ مهر/ماهِ ۱۳/ورودیِ غیرتاریخ، ساعت، `nowInTehran`، یکسانیِ منطقِ migration با API، idempotencyِ migration، ترتیبِ رشته‌ای = ترتیبِ زمانی). (۳) `tsc --noEmit` → exit 0؛ `node --check` JSِ inline → exit 0. (۴) mock UI: بدنه‌ی `POST /api/sessions` زنده `{date:"1405/06/23", start_time:"23:20"}` (برابرِ Setup)؛ تایپِ واقعیِ «۱۴۰۵/۰۶/۲۰» در مودالِ ویرایش → `PUT {date:"1405/06/20"}` و نمایشِ درست. **PL/pgSQLِ migration 013 روی Postgres اجرا نشد** (فقط منطقِ معادلش در JS تست شد) — تستِ روی DBِ لوکال نیازمندِ اجازه‌ی مالک است.
- **عامل:** این نشست، به دستور و انتخابِ صریحِ مالک.
- **کارِ باز / پیامد:** اجرای `pnpm dev` روی DBِ لوکال (migrationهای 012 و 013 خودکار) و بررسیِ تاریخ‌های تبدیل‌شده — با اجازه‌ی مالک؛ **قبل از هر deploy به production از جدولِ `sessions` backup گرفته شود** (013 برگشت‌ناپذیر است). ردیف‌هایی که الگوی Y/M/D ندارند (اگر وجود داشته باشند) دست‌نخورده و احتمالاً در «آخرین جلسه» نادرست می‌مانند — بعد از migration با یک SELECTِ فقط‌خواندنی قابلِ شناسایی‌اند. FINDING (۱)ِ ورودیِ قبلی با این رویداد رفع شد؛ (۲)–(۴) باز می‌مانند.

### 2026-09-14 — CODE/MIGRATION/DECISION/TEST — باگ‌های مراجعینِ فعال/غیرفعال + ثبتِ دستیِ جلسه‌ی گذشته
- **چه شد:** مالک گزارش داد مراجعی که در تبِ «غیرفعال» ساخته می‌شود به «فعال» می‌رود و خواست کلِ مسیرهای فعال/غیرفعال audit و پلن شود.
  - **Audit (ریشه‌ها):** B1 — `createNewClient` تب را نمی‌فرستاد و `POST /api/clients` فیلدِ status نمی‌پذیرفت → همیشه `active` (DEFAULTِ migration 008)؛ B2 — پرونده‌ی مراجعِ غیرفعال دکمه‌ی «شروع جلسه‌ی جدید» داشت (کارت نداشت) و سرور هم چک نمی‌کرد؛ B3 — پرونده هیچ نشانی از وضعیت/دلیل و راهِ بازگرداندن نداشت؛ B4 — تبِ خالی همیشه «هنوز مراجعی ثبت نشده» می‌گفت؛ B5 — `PATCH status` در حذفِ هم‌زمان `200 {client: undefined}` می‌داد و دلیل trim/محدود نمی‌شد؛ B6 — بنرِ ساخت به تبِ مقصد اشاره نمی‌کرد.
  - **تصمیم‌های مالک:** (۱) تبِ غیرفعال برای **آرشیوِ پرونده‌های قبلی** استفاده می‌شود؛ ساخت در آن با انتخابِ دلیل مثلِ مودالِ غیرفعال‌سازی + گزینه‌ی «نامشخص». (۲) مراجعِ غیرفعال جلسه‌ی زنده نمی‌گیرد؛ به‌جایش راهی برای واردکردنِ داده‌ی جلسه‌های قبلی (فقط یادداشت) لازم است.
  - **اجرا:** `POST /api/clients` حالا `status`/`reason` می‌پذیرد (دلیل trim، خالی → null، حداکثر ۲۰۰)؛ `PATCH status` همان اعتبارسنجی + 404 در `rows.length===0`؛ `POST /api/sessions` برای مراجعِ غیرفعال در حالتِ زنده 409 `client-inactive` و حالتِ جدیدِ `mode:"manual"` (تاریخ/ساعتِ الزامی، یادداشتِ اختیاری، بدونِ رضایت چون ضبطی نیست، `status=completed`، `source=manual`، جلسه+یادداشت در یک CTEِ اتمیک)؛ migration **012** (`sessions.source`، افزودنیِ خالص)؛ UI: بلوکِ دلیل در مودالِ ساخت (فقط تبِ غیرفعال)، helperِ مشترکِ `readReasonFrom`، متنِ خالیِ تب‌محور، بنرِ وضعیت + «بازگرداندن» در پرونده، مخفی‌شدنِ شروعِ جلسه و افزودنِ «ثبتِ جلسه‌ی گذشته» (مودالِ جدید + Escape)، برچسبِ «ثبتِ دستی» و متنِ جایگزینِ transcript برای جلسه‌ی دستی. یادداشتِ صوتی عمداً در این مسیر نیست (LAW-009/LAW-015). رویدادِ Clarityِ جدیدی اضافه نشد.
- **فایل‌ها:** `server/src/http/clients.ts`، `server/src/http/sessions.ts`، `server/src/db/migrations/012_session_source.sql` (جدید)، `public/index.html`. (`.claude/launch.json` موقتاً برای mock تغییر کرد و به حالتِ قبل برگشت.)
- **اسنادِ به‌روزشده:** `docs/02-reference/api-catalog.md`، `error-code-catalog.md` (`client-inactive`)، `database-catalog.md` (012، `sessions.source`، `consent`، enumها)، `docs/01-architecture/data-architecture.md`، `docs/04-modules/02-client-management/module-prd.md`، `docs/04-modules/03-therapy-sessions/module-prd.md`، `docs/03-requirements/requirement-catalog.md` (REQ-016، REQ-017، REQ-032؛ اصلاحِ REQ-020)، `traceability-matrix.md`، [`verification/2026-09-14-client-status-archive.md`](verification/2026-09-14-client-status-archive.md).
- **تست / تأیید:** `cd server && npx tsc --noEmit` → exit 0؛ `node --check` روی JSِ inlineِ `index.html` → exit 0؛ `pnpm test:rt` اجرا نشد (`feelia-rt.js` لمس نشد). تستِ UI با mock backendِ scratchpad + کلیکِ واقعی در Browser pane: ۱۲ سناریو (ساخت در تبِ غیرفعال با «نامشخص» و با دلیل، متنِ تبِ خالی، پرونده‌ی غیرفعال، رسیدنِ 409 به کلاینت، اعتبارسنجیِ بدونِ ساعت بدونِ ارسالِ POST، ثبت و نمایشِ جلسه‌ی دستی، بازگرداندن از پرونده، رگرسیونِ ساخت در تبِ فعال) — همه ✅ با DOM + بدنه‌ی درخواست. **سرور و DBِ واقعی اجرا نشد** (migration 012، CTE، 409 و 404ِ جدید فقط typecheck شده‌اند) چون ساختِ حساب/اجرا روی DB مجوزِ صریح لازم دارد.
- **عامل:** این نشست، به درخواست و تصمیم‌های صریحِ مالک.
- **کارِ باز / پیامد:** تستِ روی سرورِ لوکالِ واقعی (`pnpm dev` → migration 012 خودکار) با اجازه‌ی مالک؛ commit فقط به درخواستِ مالک. **FINDING:** (۱) فرمتِ `sessions.date` ناهمگون است (زنده میلادی، دستی/ویرایش شمسی) و `last_session_date = MAX(date)` روی TEXT برای مراجعِ دارای هر دو نوع ممکن است نادرست باشد — امتدادِ C4؛ (۲) `session_num` جلسه‌های دستی به ترتیبِ ثبت است نه تاریخِ واقعی؛ (۳) یادداشتِ جلسه‌ی دستی بعد از ثبت در UI قابلِ ویرایش نیست؛ (۴) ادامه‌ی جلسه‌ی نیمه‌تمامِ قبلی برای مراجعِ غیرفعال عمداً مجاز ماند.

### 2026-09-14 — GIT — push: ۹ کامیتِ محلی به `origin/feat/clarity`
- **چه شد:** مالک بعدِ گزارشِ «تست کردم اوکی بود انگاری» پرسید commit کنم یا push؛ روشن شد منظورش push بوده، ولی خواست اول **یه رگرسیونِ کاملِ دیگه** انجام بشه: «یه تست کامل دیگه بکن اگه همچی اوکی بود اوکیم که پوشش کنی». رگرسیونِ نهایی روی سرورِ واقعیِ لوکال (نه mock) اجرا شد:
  - خودکار: `node --check` (هر دو فایل)، `tsc --noEmit`، `rt-harness` (۲۹/۶، همان baseline).
  - عملیِ واقعی با کلیکِ real UI + API: ساختِ مراجع با سه‌کلیک (dedupe، ۱ POST)، شروعِ جلسه (گیت‌ِ میکروفون درست رفتار کرد — بدونِ اجازه دکمه غیرفعال ماند)، افزودنِ علامت/یادداشت، پایانِ جلسه.
  - **تستِ نهاییِ فیکسِ mint:** `purpose=note` رویِ جلسه‌ی completed → `200`+`api_key` واقعی. یک قدم جلوتر رفتیم: با همون کلید یه WebSocketِ واقعی به `wss://stt-rt.soniox.com` باز شد و Soniox یه فریمِ رونویسیِ معتبر برگردوند (`{"tokens":[],...}`) — یعنی کاملِ زنجیره (mint→WS→handshakeِ Soniox) الان واقعاً کار می‌کنه، نه فقط تئوری.
  - R16 دوباره از طریقِ کلیکِ واقعیِ DOM (نه صدازدنِ مستقیمِ تابع) تأیید شد.
  - UI-38 (ویرایشِ alias) از طریقِ مدالِ واقعی تست شد، `PUT` رفت، دیتابیس به‌روز شد.
  - UI-29 (نرمال‌سازیِ جستجو) با تایپِ واقعیِ کیبورد (نه شبیه‌سازیِ JS) تست شد — «ي» عربی مراجعِ «نهایی» رو پیدا کرد.
  - UI-28 (پیامِ خالیِ جستجو) با تایپِ واقعی تأیید شد.
  - چیدمانِ موبایل با `resize_window` واقعی (۳۷۵px) دوباره تأیید شد.
  - UI-26 (تمِ تیره) با کلیکِ واقعی + **reloadِ واقعیِ صفحه** تأیید شد که ماندگاره.
  - کنسولِ تبِ تازه در تمامِ مراحل بدونِ خطا؛ همه‌ی داده‌های تستی (۲ مراجع، جلسات، یادداشت‌ها) بلافاصله حذف شدند؛ `client count=0` در پایان تأیید شد.
  - نتیجه: **بدونِ هیچ رگرسیون**. مالک تأیید کرد push انجام بشه.
  بعد از این تأیید: `git push origin feat/clarity` اجرا شد.
- **فایل‌ها:** — (هیچ کدی در این رویداد تغییر نکرد؛ فقط تستِ نهایی + push).
- **اسنادِ به‌روزشده:** §1 و §6 همین فایل (وضعیتِ همه‌ی ردیف‌ها از «commit شد، منتظرِ push» به «commit + push شد» تغییر کرد).
- **تست / تأیید:** جزئیات بالا. نتیجه‌ی `git push`: `* [new branch] feat/clarity -> feat/clarity` — موفق، بدونِ conflict، بدونِ force.
- **عامل:** این نشست، به دستورِ صریحِ مالک، بعدِ رگرسیونِ اضافیِ درخواستی.
- **کارِ باز:** این فقط **push به origin**ه — نه merge به `main`، نه deploy به `feelia.ir`. Productionِ زنده هنوز `8bcdf0e` است و هیچ‌کدام از فیکس‌های امروز (شاملِ فیکسِ بحرانیِ یادداشتِ صوتی) رو نداره. تصمیمِ merge/deploy جداگانه و نیازمندِ مجوزِ صریحِ مالک است (LAW-006). مستنداتِ untracked (`docs/`، `PROJECT_STATUS.md`، …) هنوز commit نشده‌اند — تصمیمِ جداگانه‌ی مالک لازم دارد (P0-0 در §6).

### 2026-09-14 — CODE/GIT — commitِ `2551943`: ریشه‌ی واقعیِ «چرا یادداشتِ صوتی ریل‌تایم نیست» پیدا و رفع شد
- **چه شد:** بعدِ فیکسِ ۴۰۰/R16/timeout، مالک اصرار کرد «توی نسخه‌های قبلی درست بود» و خواست کاملاً چک بشه. پرسیدم آیا حینِ **جلسه‌ی اصلی** هم همون هشدارِ زردِ «رونویسیِ زنده در دسترس نیست» رو دیده — جوابِ صریحِ مالک: **«نه، جلسهٔ اصلی مشکلی نداشت، فقط یادداشت.»** این جواب قطعی بود: چون کدِ اتصال (`ensureStream`/`connectWithFreshMint`) بینِ `mode:'live'` و `mode:'note'` کاملاً مشترکه، یه شکستِ مختصِ یادداشت باید از یه‌جایِ *قبل*ِ اون کدِ مشترک می‌اومد.
  **پیدا شد:** `POST /api/stt/realtime-session` (endpointِ mintِ credential که باید قبل از هر تلاشِ WS موفق بشه) یه گاردِ `owned.status==='completed'` داشت — بدونِ تفکیکِ purpose، برخلافِ `batch-audio` که صبح همون روز فیکس شده بود. تنها نقطه‌ی UI که یادداشتِ صوتی می‌سازه (دکمه‌ی Wrapup) همیشه *بعد*ِ اینه که `endNewRTSession()` همون لحظه‌ی «پایان جلسه» `PUT status:'completed'` فرستاده. یعنی mintِ یادداشتِ صوتی **همیشه، صددرصد، قبل از هر تلاشی برایِ WS** با ۴۰۰ رد می‌شد — هیچ‌وقت credential نمی‌گرفت که بخواد وصل بشه یا نشه. جلسه‌ی زنده چون هنوز `in_progress`ه وقتی mint می‌کنه، هیچ‌وقت این مانع رو نمی‌دید.
  **رفع:** `mintCredential(sessionId, purpose)` — کلاینت (`feelia-rt.js`) حالا `purpose:'note'` یا `'transcript'` می‌فرسته (`self.mode` که از قبل رو RTSession بود). سرور (`stt.ts`) فقط `purpose==='transcript'` رو رویِ جلسه‌ی completed/canceled مسدود می‌کنه؛ `purpose==='note'` همیشه مجازه. رفتارِ پیش‌فرض (بدونِ purpose، یعنی هر کلاینتِ قدیمی‌تر) هم `'transcript'` می‌مونه — یعنی جلسه‌ی زنده دقیقاً همون رفتارِ قبلی رو داره.
- **فایل‌ها:** `public/feelia-rt.js` (+۷/−۱)، `server/src/http/stt.ts` (+۱۶/−۵).
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (بخشِ جدیدِ «رفعِ ریشه‌ی واقعیِ realtimeِ یادداشتِ صوتی»)، §1 و §6 همین فایل.
- **تست / تأیید:** مستقیم رویِ سرورِ لوکالِ واقعی: `POST /api/stt/realtime-session {purpose:'note'}` رویِ جلسه‌ی completed → **۲۰۰ + `api_key` واقعی** (قبلاً ۴۰۰). رگرسیون: همون درخواست با `purpose:'transcript'` → همچنان ۴۰۰؛ همون درخواست **بدونِ فیلدِ purpose اصلاً** (سازگاریِ کلاینتِ قدیمی) → همچنان ۴۰۰؛ mintِ یه جلسه‌ی تازه‌ی `in_progress` بدونِ purpose (دقیقاً چیزی که جلسه‌ی زنده امروز می‌فرسته) → همچنان ۲۰۰. تأیید شد `feelia-rt.js`ِ serve‌شده واقعاً نسخه‌ی جدیده (نه cache). `node --check` روی هر دو فایل OK؛ `cd server && npx tsc --noEmit` → exit 0؛ `node scripts/rt-harness.cjs` → 29 PASS/6 FAIL (همان baseline). داده‌ی تستی بلافاصله حذف شد. کنسولِ تبِ تازه بدونِ خطایِ واقعی.
- **عامل:** این نشست، به دستورِ مالک (بعد از یک سؤالِ تشخیصیِ دقیق که مالک جواب داد).
- **کارِ باز:** **push نشده.** این آخرین حلقه‌ی زنجیره‌ی «یادداشتِ صوتی» بود — با این فیکس، یادداشتِ صوتی حالا هم مثلِ جلسه‌ی اصلی می‌تونه واقعاً realtime بشه (اگه شبکه‌ی مالک اجازه بده؛ مینتِ خودش دیگه مانع نیست). سؤالِ «چرا کند بود» تا حدی با timeoutِ `api()` (کامیتِ قبلی) پوشش داده شد؛ اگه هنوز کندی حس بشه، نیازِ بررسیِ بیشتر داره. هیچ‌کدام از فیکس‌هایِ امروز push نشدن؛ این باگ (مثلِ ۴۰۰ی batch-audio) رویِ productionِ زنده هم هست چون از همون معماریِ پایه (`f9b0a9c`) میاد.

### 2026-09-14 — CODE/FINDING — commitِ `08e8d20`: رفعِ R16 + timeoutِ `api()` + یافته‌ی ریشه‌ای درباره‌ی نبودِ fallbackِ legacy
- **چه شد:** بعدِ فیکسِ باگِ ۴۰۰، مالک باز هم گزارش داد: «باید یادداشتِ صوتی پس از جلسه هم مثلِ خودِ جلسه ریل‌تایم باشه … توی نسخه‌های قبلی درست بود»، «چرا توی پرونده نمایش داده نمیشه»، «کند هم هست چرا؟». سه مسیر جداگانه بررسی شد:
  1. **رفعِ قطعی — R16/UX-002 (نمایشِ خالیِ یادداشت‌ها در پرونده):** ریشه پیدا شد: `viewTranscript()` هر `.inline-sign`/`.inline-note` را به‌صورتِ `<svg>{آیکون}</svg><span></span><span>{زمان}</span>` می‌سازد، بعد با `querySelectorAll('.inline-sign span:first-child')` سعی می‌کند spanِ متن رو پر کنه — ولی `:first-child` یعنی «فرزندِ *واقعاً* اول»، و اون svgه نه span، پس این سلکتور هیچ‌وقت چیزی پیدا نمی‌کرد و متن همیشه خالی می‌موند. با `:first-of-type` (که فقط بینِ خواهر-برادرهای هم‌تگ می‌شمره) رفع شد. با سرورِ لوکالِ واقعی (نه mock) و سه نوع یادداشتِ واقعی (sign/متنی/صوتی) روی یک جلسه‌ی completed تأیید شد: هر سه حالا متنِ واقعی‌شون رو نشون می‌دن (قبلاً فقط زمان).
  2. **رفعِ جزئی — کندی/گیرکردن (UI-33، بخشی):** تابعِ مشترکِ `api()` هیچ timeout نداشت. یه پارامترِ **اختیاریِ** `timeoutMs` (با `AbortController`) اضافه شد — بدونِ پاس‌دادنش، رفتارِ همه‌ی callerهای فعلی بدونِ کوچک‌ترین تغییر می‌مونه (backward-compatible کامل، تأیید‌شده با تستِ مستقیم). فقط رویِ چکِ STTِ preflight سیم‌کشی شد (سقفِ ۱۰ثانیه) چون همون‌جا بود که «در حال بررسیِ اتصالِ رونویسی…» می‌تونست برای همیشه گیر کنه. تأیید شد: timeoutِ ۱ms قابلِ‌اعتماد در ~۳ms abort می‌کنه و خطایِ قابلِ‌تشخیصِ `{code:'timeout'}` می‌ده؛ فراخوانیِ عادی (بدونِ timeoutMs) دقیقاً مثلِ قبل کار می‌کنه؛ `runPreflight()` رویِ سرورِ واقعی هنوز درست به «رونویسی: آماده» می‌رسه.
  3. **یافته‌ی ریشه‌ای، هنوز بدونِ رفع — چرا یادداشتِ صوتی ریل‌تایم نیست:** با بازخوانیِ دقیقِ `startNewRTSession()` (کدِ **جلسه‌ی اصلی**، نه یادداشت) مشخص شد این رفتار مختصِ یادداشت نیست: خودِ کامنتِ همون تابع می‌گه («ISSUE 4: حالتِ durable-only … legacy proxy صدا زده نمی‌شود»)؛ یعنی وقتی اتصالِ مستقیمِ Browser→Soniox شکست بخوره، کد **هیچ‌وقت** به مسیرِ قدیمیِ `/ws/t`/`/ws/voice` (که از سرور رد می‌شه و با `GET /api/stt/check` اثبات شد کاملاً سالمه — `mint-ok`, `proxy.ok:true`) برنمی‌گرده؛ فقط صادقانه به کاربر می‌گه realtime نیست. این از commitِ `f9b0a9c` (۲۰۲۶-۰۹-۱۱، جدِّ productionِ `8bcdf0e`) همین‌طور بوده — یعنی **رگرسیونِ این نشست نیست**، و رویِ جلسه‌ی اصلی و یادداشتِ صوتی یکسان اثر می‌ذاره. پس اگه واقعاً مشکلِ شبکه است، باید همون هشدارِ زرد («رونویسیِ زنده در دسترس نیست») رو حینِ خودِ جلسه‌ی اصلی هم دیده باشه — این سؤال از مالک پرسیده شد و هنوز جواب نیومده.
- **فایل‌ها:** `public/index.html` (+۳۳/−۸؛ فقط دو تابع: `viewTranscript()`، `api()` + یک call-site).
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (بخشِ جدیدِ «رفعِ R16/UX-002 و timeoutِ api()»)، §1 و §6 همین فایل.
- **تست / تأیید:** `node --check` OK؛ `cd server && npx tsc --noEmit` → exit 0؛ `node scripts/rt-harness.cjs` → 29/6 (همان baseline). رویِ سرورِ لوکالِ واقعی: مراجع+جلسه+۳ یادداشتِ واقعی ساخته شد، `viewTranscript()` صدا زده شد، هر سه متن درست نمایش داده شدن؛ داده‌ی تستی بلافاصله حذف شد. تبِ تازه بعدِ همه‌ی تغییرات → کنسول فقط همون ۴۰۱ِ عادیِ «هنوز واردنشده» (انتظاری)، بدونِ خطایِ واقعی.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** **push نشده.** منتظرِ جوابِ مالک درباره‌ی هشدارِ زردِ جلسه‌ی اصلی — اگه بله، یعنی مشکل شبکه‌ایِ عمومیه (شبیهِ Clarity) نه کدی؛ اگه نه، یعنی یادداشتِ صوتی به‌طورِ خاص یه چیزِ دیگه داره که باید عمیق‌تر بررسی بشه. پیاده‌سازیِ واقعیِ fallback به legacy (رفعِ کاملِ ISSUE 4) یه تغییرِ بزرگ‌تر در `feelia-rt.js`/`index.html`ه — منتظرِ تصمیمِ مالک برای شروع.

### 2026-09-14 — INCIDENT/GIT — commitِ `fefa823`: یادداشتِ صوتی با ۴۰۰ رد می‌شد (کشف در تستِ لوکالِ مالک)
- **چه شد:** مالک بعدِ push-گفتن «نه فعلاً»، خودش `pnpm dev` را با سرورِ واقعی (نه mock) اجرا کرد و یادداشتِ صوتی گذاشت. گزارش داد: (۱) متنِ زنده نشون داده نمی‌شه، (۲) «ذخیره هم نمیشه»، (۳) کنسول یه `400 Bad Request` نشون داد، (۴) حسش این بود که نسخه‌ی روی سرور بهتر کار می‌کنه، و خواست ریشه پیدا بشه و رفع بشه.
  **تشخیص:** با `GET /api/stt/check` روی سرورِ لوکال، `mint-ok`/`proxy.ok:true` تأیید شد — یعنی مشکل از سمتِ سرور به Soniox نیست. یه WS مستقیمِ آزمایشی هم از مرورگر به Soniox در ۹۶۵ms وصل شد. سپس با بازخوانیِ دقیقِ کد، **علتِ قطعیِ ۴۰۰ پیدا شد**: `POST /api/sessions/:id/batch-audio` یه گارد داشت که هر آپلودِ غیرِ`archive` رو روی جلسه‌ی `completed`/`canceled` با ۴۰۰ رد می‌کرد. ولی `endNewRTSession()` (فایلِ `public/index.html`) همون لحظه‌ای که کاربر «پایان جلسه» می‌زنه، بلافاصله `PUT status:'completed'` می‌فرسته — یعنی تا وقتی کاربر وارد صفحه‌ی Wrapup می‌شه و دکمه‌ی «یادداشت صوتی» رو می‌زنه، status از قبل `completed`ه. پس هر یادداشتِ صوتی‌ای که به fallbackِ batch نیاز داشت (چون realtimeِ خودش وصل نشده بود)، در آپلودِ صدا با همون ۴۰۰ رد می‌شد — **صددرصدِ مواقع**، نه گاه‌به‌گاه. با `git blame` تأیید شد این گارد از commitِ `f9b0a9c` (۲۰۲۶-۰۹-۱۱) میاد که **جدِّ commitِ productionِ فعلی (`8bcdf0e`) هم هست** — یعنی این باگ رو productionِ زنده هم هست، فقط چون اونجا معمولاً realtime موفقه، مسیرِ batch برایِ یادداشت کمتر اجرا می‌شه و باگ کمتر دیده می‌شه؛ این دقیقاً همون چیزیه که حسِ «سرور بهتر کار می‌کنه» رو توضیح می‌ده.
  **رفع:** شرطِ ۴۰۰ فقط برایِ `purpose==='transcript'` نگه داشته شد (نه برایِ `note`)؛ `archive` که از قبل استثنا بود دست‌نخورده ماند.
- **فایل‌ها:** `server/src/http/sessions.ts` (+۱۰/−۳).
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (بخشِ جدیدِ «رفعِ باگِ بحرانیِ ۴۰۰ در یادداشتِ صوتی»)، §1 و §6 همین فایل.
- **تست / تأیید:** مستقیم روی سرورِ لوکالِ واقعی (نه mock): ساختِ یک مراجع+جلسه‌ی واقعی، `PUT status:'completed'` دقیقاً مثلِ کلاینت، بعد `POST batch-audio?purpose=note` → **قبل از فیکس ۴۰۰، بعدِ فیکس `202 {status:'queued'}`**. رگرسیون: همون تست با `purpose=transcript` رویِ همون جلسه‌ی completed → همچنان **۴۰۰** (رفتارِ اصلی حفظ شد)؛ با `purpose=archive` → همچنان `202` (بدونِ تغییر). `cd server && npx tsc --noEmit` → exit 0؛ `node scripts/rt-harness.cjs` → 29 PASS/6 FAIL (همان baseline). دادهٔ تستی (مراجع/جلسه) بلافاصله پاک شد. `feelia-rt.js` در این commit اصلاً باز نشد — فقط یه فایلِ سرور.
- **عامل:** این نشست، به دستورِ صریحِ مالک («این لایو ضبط شدن و ذخیره شدن دیتای پس از جلسه رو درستش کن»).
- **کارِ باز:** **push نشده** (طبقِ دستورِ قبلیِ مالک). دو سؤالِ دیگرِ مالک هنوز بازند و ربطی به این فیکس ندارند: (۱) چرا اتصالِ realtimeِ Soniox از مرورگرِ محلیِ او برقرار نمی‌شه (منتظرِ خروجیِ Console/Network تبِ او)، (۲) چرا تست کلاً کند بود (مظنون: `api()` بدونِ timeout — UI-33 — ولی هنوز فیکس نشده، منتظرِ تأییدِ مالک). این باگ چون در productionِ زنده هم فعاله، بعدِ push به اونجا هم باید برسه.

### 2026-09-14 — GIT — commitِ `84d4783`: رگرسیونِ کاملِ دستی + ۴ فیکسِ دیگرِ کم‌خطرِ P2/P3
- **چه شد:** به دستورِ مالک («آره یه رگرسیونِ کامل دیگه انجام بده و همه ریزه‌کاری‌ها رو تموم کن؛ فقط به سیستمِ صوتی فعلاً دست نزن و متنِ رضایت رو دست نزن؛ پوش هم نکن تا رگرسیون تموم نشده»):
  **۱) رگرسیونِ کاملِ دستی روی HEAD (`85bd08e`)** با mock backend: `node --check`/`tsc`/`rt-harness` (۲۹/۶، بدونِ تغییر) + جریانِ کاملِ کاربر — ساختِ مراجعِ جدید با سه‌کلیکِ پشتِ‌سرِهم (دقیقاً ۱ `POST`، UI-06 هنوز سالم)، شروعِ جلسه با سه‌کلیک (دقیقاً ۱ `POST`، UI-04 هنوز سالم)، توقف/ادامه، افزودنِ علامت+یادداشتِ سریع، پایانِ جلسه («۱ دقیقه» به‌جایِ «۰ دقیقه» — UI-34 تأیید شد در جریانِ واقعی)، افزودنِ یادداشتِ متنی در Wrapup، «بازگشت بدونِ ذخیره» (متنِ درستِ UI-19 تأیید شد)، «ذخیره و پایان»، بازِ پرونده. Escape روی مدال (UI-21) و CSSِ موبایل (`#liveControls` با `position:fixed` واقعی در ویوپورتِ ۲۸۳px، `transform:none` روی `.screen`) هم دوباره با `getComputedStyle` تأیید شدند. **کنسول در تمامِ مسیر بدونِ هیچ خطا.** یک یافته‌ی از پیش‌موجود و **نامرتبط** به این نشست دوباره دیده شد (نه رگرسیون): متنِ یادداشت‌ها در نمایِ پرونده خالی رندر می‌شود (`<span></span>`) — دقیقاً همان **R16/UX-002** که نشستِ دیگری در audit جداگانه‌ی UX کشف کرده؛ کدِ مربوط در هیچ‌کدام از کامیت‌های این نشست لمس نشده.
  **۲) ۴ موردِ دیگرِ P2/P3 کم‌خطر رفع شد:**
  - **UI-29:** جستجو «ي»/«ك» عربی و ارقامِ فارسی/عربی را با فارسی/لاتین یکسان نمی‌کرد؛ تابعِ `normalizeSearchText()` روی query و روی `code`/`alias` اعمال شد.
  - **UI-28:** با فیلترِ دسته/جنسیت (بدونِ جست‌وجوی متنی)، پیامِ «کد یا نام دیگری را جست‌وجو کنید» گمراه‌کننده بود؛ از پیامِ جست‌وجو جدا شد («مراجعی در این دسته‌بندی نیست»).
  - **UI-38:** `PUT /api/clients/:id` (ویرایشِ alias) از قبل در سرور بود ولی UI نداشت؛ مدالِ `editAliasModal` (هم‌الگو با `editCategoryModal`، ثبت‌شده در `MODAL_CLOSERS`) + گزینه در منویِ کارتِ مراجع اضافه شد.
  - **UI-44 (جزئی):** `sessions_this_week` از قبل در پاسخِ API بود ولی نمایش داده نمی‌شد؛ کارتِ آمار اضافه شد. ایموجیِ 👑 (بخشِ دومِ همین یافته) عمداً دست‌نخورده ماند — سلیقه‌ای است، نه باگ.
  **عمداً رفع نشد:** UI-30 (بی‌ضرر طبقِ خودِ audit)، UI-32/33/35 (تغییرِ `api()`/بنرها اثرِ گسترده روی کلِ اپ دارد)، UI-39/40/43/45 (دسترس‌پذیری/کنتراست/فونت/فرم — نیازِ بازبینیِ طراحی، نه فیکسِ کوچک)، UI-47 (هم‌پوشانی با کارِ فعالِ یک نشستِ دیگر روی Clarity — برایِ جلوگیری از تداخل دست زده نشد). `feelia-rt.js`، سرور، و متنِ رضایت (UI-05) در این commit هم اصلاً لمس نشدند.
- **فایل‌ها:** `public/index.html` (+۶۶/−۴).
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (بخشِ جدیدِ «رفعِ P2/P3 کم‌خطر (دورِ دوم)»، ۴ ردیفِ FIXED/جزئی در جدولِ یافته‌ها)، `docs/05-plans/master-implementation-plan.md` (ردیفِ جدید)، §1 و §6 همین فایل.
- **تست / تأیید:** `node --check` OK؛ `cd server && npx tsc --noEmit` → exit 0؛ `node scripts/rt-harness.cjs` → 29 PASS/6 FAIL (همان baseline). هر مورد جداگانه: `normalizeSearchText('علي')==='علی'` و `normalizeSearchText('٠٩١٢')==='0912'` + جست‌وجویِ واقعی با یِ عربی → ۱ نتیجه؛ فیلترِ دسته‌ی بدونِ مراجع → پیامِ درست؛ ویرایشِ alias → دقیقاً ۱ `PUT /api/clients/:id` + بازتابِ فوری در لیست + Escape کار می‌کند؛ `renderAdminStats` با `sessions_this_week` → کارتِ «جلساتِ این هفته» رندر شد. تبِ کاملاً تازه بعدِ همه‌ی تغییرات → کنسول بدونِ خطا. `.claude/launch.json` موقتاً `feelia-ui-mock-temp` گرفت و دقیقاً به حالتِ اصلی برگشت.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** **push نشده — به دستورِ صریحِ مالک، منتظرِ اجازه‌ی جداگانه.** باقی‌مانده: UI-13/14/15/36 (`feelia-rt.js`)، UI-09 و UI-05 (تصمیمِ مالک)، UI-25 (فیلدِ جدیدِ API)، UI-30/32/33/35/39/40/43/45/47 (تغییرِ بزرگ‌تر یا هم‌پوشانی با نشستِ دیگر).

### 2026-09-14 — GIT — commitِ `85bd08e`: ۶ فیکسِ کم‌خطرِ P2/P3 روی `feat/clarity`
- **چه شد:** به دستورِ مالک («برو سراغ موارد کم‌خطر و اصلاح کن»)، از جدولِ کاملِ یافته‌های audit، مواردی انتخاب شد که (الف) به `feelia-rt.js` نیاز ندارند و (ب) منتظرِ تصمیمِ مالک/حقوقی نیستند (UI-05، UI-09، UI-13/14/15/36 حذف شدند). ۶ مورد رفع شد:
  1. **UI-26** (تمِ تیره ذخیره نمی‌شد، تنظیمِ سیستم نادیده گرفته می‌شد): تابعِ جدیدِ `initTheme()` در `DOMContentLoaded` (قبل از `init()`) — اول `localStorage.feelia_theme` اگر قبلاً انتخاب شده، وگرنه `prefers-color-scheme`؛ `toggleTheme()` حالا انتخاب را ذخیره می‌کند.
  2. **UI-42** (تمِ تیره: حاشیه‌ی `.banner.warn` و پس‌زمینه‌ی `.rec-dot.paused` رنگِ ثابتِ روشن داشتند): دو override برایِ `[data-theme="dark"]` اضافه شد، با همان الگویِ override موجود برایِ `.consent-box`.
  3. **UI-41** (`var(--r-sm)` هرگز تعریف نشده بود → `.radio-opt` گوشه‌ی صاف): `--r-sm:8px` به `:root` اضافه شد.
  4. **UI-46** (وضعیتِ `canceled` هیچ استایلِ اختصاصی نداشت، برخلافِ سه وضعیتِ دیگر): `.session-status.canceled{background:var(--line-soft);color:var(--muted)}` اضافه شد.
  5. **UI-34** («مدت: ۰ دقیقه» برایِ جلسه‌ی زیرِ یک دقیقه): `Math.floor`→`Math.round` در `handleFinished()`.
  6. **UI-20 (تصحیحِ سند):** بررسیِ کدِ HEAD نشان داد Enterِ فرمِ ورود/ثبت‌نام از قبل در `fedeac2` رفع شده بود؛ جدولِ audit هنوز آن را «جزئی رفع شد» نشان می‌داد — فقط سند تصحیح شد، کدِ جدیدی برایِ این مورد نوشته نشد.
  **عمداً رفع نشد:** UI-25 (نمایشِ دکمه‌ی «بازسازیِ گوینده‌ها» بدونِ صدای آرشیو) — سرور همین حالا پیامِ فارسیِ روشن برمی‌گرداند؛ پنهان‌کردنِ پیشاپیشِ دکمه نیازمندِ فیلدِ جدید در API است (تغییرِ API/کاتالوگ، نه رفعِ کوچک) — برایِ دورِ بعد گذاشته شد. `feelia-rt.js` و کدِ سرور در این commit اصلاً باز نشدند.
- **فایل‌ها:** `public/index.html` (+۱۸/−۴؛ فقط CSS + توابعِ کوچکِ JS، بدونِ تغییرِ منطقِ موجود).
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (بخشِ جدیدِ «رفعِ P2/P3 کم‌خطر»، ۶ ردیفِ FIXED در جدولِ یافته‌ها)، `docs/05-plans/master-implementation-plan.md` (ردیفِ جدیدِ «P2/P3 کم‌خطر»)، §1 و §6 همین فایل.
- **تست / تأیید:** `node --check` روی اسکریپتِ استخراج‌شده OK؛ `cd server && npx tsc --noEmit` → exit 0؛ `node scripts/rt-harness.cjs` → 29 PASS/6 FAIL (همان baseline). با mock backend (Browser pane، ویوپورتِ ۲۸۳×۶۹۴ و تبِ تازه): `getComputedStyle(document.documentElement).getPropertyValue('--r-sm')==='8px'`؛ عنصرِ آزمایشیِ `.session-status.canceled` → پس‌زمینه/رنگِ غیرِشفاف (`rgb(237,240,235)`/`rgb(132,145,138)`)؛ با `data-theme="dark"` → `.banner.warn` border `rgb(69,58,31)` و `.rec-dot.paused` background `rgb(74,83,77)` (هر دو مطابقِ مقدارِ override)؛ با سیستمِ `prefers-color-scheme:dark` و بدونِ `localStorage`، بارِ اول خودکار `data-theme="dark"`؛ بعدِ `toggleTheme()`→`light`، `navigate` (reloadِ کامل) → `data-theme` هنوز `light` می‌ماند (انتخابِ کاربر بر سیستم اولویت دارد و ماندگار است)؛ `Math.round(45000/60000)===1` در مقابلِ رفتارِ قبلیِ `floor`→`0`. رگرسیون: تبِ کاملاً تازه روی همان mock → کنسول بدونِ هیچ خطا، صفحه‌ی مراجعین با همه‌ی دکمه‌ها/فیلترها درست رندر شد. `.claude/launch.json` موقتاً یک configurationِ `feelia-ui-mock-temp` گرفت و بعدِ تست دقیقاً به حالتِ اصلی (تک‌ورودیِ `feelia-server`) برگشت.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** push؛ باقیِ audit — UI-13/14/15/36 (لمسِ `feelia-rt.js`، فعلاً متوقف)، UI-09 (تصمیمِ مالک)، UI-25 (نیازِ فیلدِ جدیدِ API)، UI-05 (P0-1)، و بقیه‌ی موارد P2/P3 که یا اثرِ محسوس کمتری دارند یا نیازمندِ تغییرِ ساختاریِ بزرگ‌تر (مثلِ دسترس‌پذیریِ UI-39/40، خودمیزبانیِ فونت UI-43).

### 2026-09-14 — GIT — commitِ `8347fbb`: رفعِ چیدمانِ موبایل (UI-22/23/24) روی `feat/clarity`
- **چه شد:** به دستورِ صریحِ مالک («نه اول موبایل رو اوکی کن بر اساسِ سیستمِ دیزاین، دست به اون سیستمِ صوتی نزن فعلا و هر تغییری که میدی باید هی مشکل رو حل کنه نه اینکه چیزی که درسته رو خراب کنه») ۳ موردِ P1 مربوط به چیدمانِ موبایل رفع شد: UI-22 (نوارِ کنترل‌های جلسه‌ی زنده در `≤480px` پایینِ صفحه گم می‌شد)، UI-23 (دکمه‌ی شروعِ جلسه در `screenSetup` همین‌طور)، UI-24 (دکمه‌ی «مراجع جدید» در `screenClients` همین‌طور). راه‌حل: `#screenLive` کنترل‌های pause/resume/پایان در `<div id="liveControls">` جدید بسته شد (دکمه‌ی «لغو جلسه» عمداً بیرون ماند، در جریانِ عادی)؛ در مدیاکوئریِ `≤480px` سه بلوک (`#liveControls`، `#btnStartSession`، `#btnNewClient`) با `position:fixed` به پایینِ صفحه چسبانده شدند، با `padding-bottom` متناظر روی کانتینرهای بالادست تا محتوا زیرِ نوارِ ثابت گم نشود. از توکن‌ها/کلاس‌های همان سیستمِ دیزاینِ موجود استفاده شد (`--card`، `--line-soft`، `--r-lg`، `--shadow`)، هیچ الگوی بصریِ جدیدی اضافه نشد. **دو باگِ واقعیِ CSS در همین مسیر کشف و رفع شد** (جزئیات در ادامه). `feelia-rt.js` طبقِ دستورِ صریحِ مالک **عمداً لمس نشد** — هیچ خطی از آن تغییر نکرد.
  1. **باگِ containing-block از transform:** `.screen{animation:rise}` با keyframeِ `transform:translateY(12px)→transform:none` باعث می‌شد `#screenClients`/`#screenLive`/`#screenSetup` (هرکدام `.screen`) یک containing block برای فرزندانِ `position:fixed` خودشان بشوند (طبقِ اسپکِ CSS، هر مقدارِ transformِ غیرِ `none` — حتی matrixِ همانی از یک انیمیشنِ تمام‌شده با `fill-mode:both` — این اثر را دارد)؛ نتیجه: عناصرِ fixed به‌جایِ نسبت‌به‌viewport، نسبت‌به‌همان `.screen` جای‌گیری می‌کردند و مثلاً `top:1350px` در یک viewportِ 812پیکسلی می‌افتادند. ریشه‌یابی با پیمایشِ زنجیره‌ی ancestor توسطِ `getComputedStyle` و پیداکردنِ `transform:matrix(1,0,0,1,0,0)` روی `.screen` تأیید شد. رفع: keyframeِ `rise` بازنویسی شد تا به‌جایِ `transform`، `margin-top` را انیمیت کند (همان جلوه‌ی بصریِ ورود، بدونِ ست‌کردنِ `transform` هرگز). تأیید پس از رفع: `getComputedStyle(...).transform === "none"` (لفظاً) روی هر سه `.screen`.
  2. **باگِ over-constraint در RTL:** بعدِ رفعِ باگِ اول، دکمه‌ها هنوز `left:-12px` (بیرونِ صفحه) اندازه‌گیری می‌شدند. علت: ست‌کردنِ همزمانِ `left:12px` و `right:12px` روی یک عنصرِ `position:fixed` با `width:100%` (از `.btn-block`) over-constrained است؛ طبقِ اسپک، در سندی با `dir="rtl"` مرورگر `left` را کنار می‌گذارد و از `right` انکر می‌کند. تأیید با `getComputedStyle`: `cssLeft:"12px"` و `cssRight:"12px"` هر دو «درست» به‌نظر می‌رسیدند ولی `cssWidth:"375.2px"` (≈عرضِ کاملِ viewport، نه فاصله‌ی موردِ انتظار ۳۵۱px) نشان می‌داد `left` در حلِ box-model نادیده گرفته شده. رفع: هر سه قانونِ fixed به یک انکرِ واحد (`left:12px`) + `width:calc(100% - 24px)` صریح تغییر کرد. تأییدِ نهایی با اندازه‌گیریِ کاملِ DOM: `left:12, right:363.2, width:351.2` روی هر سه عنصر — درست.
- **فایل‌ها:** `public/index.html` (`#screenLive`/`#screenClients` HTML: افزودنِ `<div id="liveControls">` و `id="btnNewClient"`؛ CSS: بازنویسیِ `@keyframes rise`، افزودنِ قوانینِ `position:fixed` در `@media(max-width:480px)`).
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (بخشِ جدیدِ «رفعِ چیدمانِ موبایل (UI-22/23/24)»، ۳ ردیفِ FIXED، §0)، `docs/05-plans/master-implementation-plan.md` (ردیفِ جدیدِ UI-Ph1 چیدمانِ موبایل)، §1 و §6 همین فایل.
- **تست / تأیید:** mobile emulation در Browser pane (`resize_window{width:375,height:812}`؛ user agent/touch موبایل) — هر سه بلوکِ fixed با `position:static`→`fixed` صحیح، `top`/`left`/`right`/`width` درست نسبت‌به‌viewport، بدونِ همپوشانی با محتوا (padding-bottom کافی)، اسکرولِ صفحه بدونِ پرش. تستِ فانکشنال: کلیک روی هر سه دکمه‌ی fixed (شروعِ جلسه، مراجعِ جدید، پایانِ جلسه) هرکدام دقیقاً همان رفتارِ قبلی را داد (نه صرفاً بررسیِ بصری). **دسکتاپِ واقعی** با `resize_window{width:1280,height:900}` (نه presetِ «desktop» که به‌اشتباه عرضِ پیش‌فرضِ paneِ ۲۸۳px را می‌داد و کاذباً همچنان داخلِ همان مدیاکوئریِ موبایل بود) — تأییدِ `position:static` روی هر سه عنصر و `matchMedia('(max-width:480px)').matches===false`؛ یعنی صفحه‌ی دسکتاپ کاملاً دست‌نخورده ماند. رگرسیونِ کاملِ چرخه‌ی جلسه (شروع، ضبط، توقف/ادامه، یادداشت، پایان) روی موبایل و دسکتاپ هر دو موفق. `node --check` روی اسکریپتِ استخراج‌شده OK؛ `cd server && npx tsc --noEmit` → exit 0؛ `node scripts/rt-harness.cjs` → 29 PASS/6 FAIL (دقیقاً همان baseline، بدونِ شکستِ جدید). بررسیِ عدمِ imbalance در تعدادِ `<div>`: شمارشِ ۱۳۳ باز/۱۳۲ بسته بعد از تغییر بررسی شد؛ `git show HEAD:public/index.html` (قبل از این commit) نشان داد همین عدم‌تعادلِ ۱۳۲/۱۳۱ از قبل وجود داشت (نامرتبط با این تغییر، به‌احتمالِ زیاد artifactِ grep از رشته‌ی `<div` داخلِ یک کامنت/استرینگِ JS، نه تگِ واقعاً بازنشده) — افزوده‌ی خودِ این commit (`<div id="liveControls">`...`</div>`) دقیقاً متوازن (+۱/+۱) بود. `.claude/launch.json` به حالتِ اصلی (فقط `feelia-server`) برگشت.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** push؛ باقیِ فازِ ۱ (UI-13/14/15 و UI-36 — هرکدام نیازمندِ لمسِ `feelia-rt.js`، فعلاً طبقِ دستورِ مالک متوقف‌اند)، UI-09 (تصمیمِ مالک)، همه‌ی P2/P3.

### 2026-09-14 — TEST — validationِ لینک‌ها پس از UX audit
- **چه شد:** checkerِ لینک‌های نسبیِ Markdown (فایل + anchor؛ اسکریپتِ scratchpad، خارج از repo) پس از افزودنِ ۵ سندِ UX، evidence و به‌روزرسانیِ اسناد اجرا شد.
- **فایل‌ها:** —
- **اسنادِ به‌روزشده:** همین ورودی.
- **تست / تأیید:** 59 فایلِ Markdown، 406 لینکِ نسبی، **2 anchorِ خراب — هر دو از قبل و خارج از اسنادِ UX**: `docs/00-governance/source-of-truth.md` → `project-laws.md#law-018--…` و `docs/05-plans/ui-ux-audit-2026-09-14.md` → `#بازبینی-دوم--…` (احتمالاً ناشی از قاعده‌ی slugِ این checker برای نیم‌فاصله/کسره، نه لینکِ واقعاً خراب — تأیید نشد). ۰ لینکِ خراب در `docs/05-plans/ux-audit-2026-09-14/` و `verification/2026-09-14-ux-audit-runtime.md`. `git status`: هیچ فایلِ trackedِ کد توسطِ این نشست تغییر نکرد (فقط `docs/admin-panel.md` از قبل modified).
- **عامل:** این نشست.
- **کارِ باز:** بررسیِ آن دو anchor در نشستِ مستندات (بدونِ اولویت).

### 2026-09-14 — FINDING — commitهای هم‌زمان حینِ UX audit؛ همگام‌سازیِ یافته‌ها
- **چه شد:** حینِ نوشتنِ UX audit، نشستِ دیگری `ecf00b4`، `fedeac2` و `8347fbb` («sticky bottom controls … UI-22/23/24»، 16:39) را روی `feat/clarity` ساخت. `8347fbb` در §1 و Event Log هنوز ثبت نشده بود. همه‌ی ۴۲ یافته‌ی UX با `grep` روی HEAD `8347fbb` دوباره بررسی شد: **۵ Critical و ۱۳ از ۱۴ High پابرجا**؛ ۷ یافته جزئی رفع (UX-008، 022، 028، 029، 032، 035، 037)؛ هیچ‌کدام کامل رفع نشده. شماره‌خط‌ها و اجراهای اسنادِ UX مربوط به snapshotِ پیشین‌اند و این صراحتاً در اسناد ذکر شد. هیچ تغییری برگردانده نشد.
- **فایل‌ها:** —
- **اسنادِ به‌روزشده:** `docs/05-plans/ux-audit-2026-09-14/UX_FINDINGS.md` (بخشِ همگام‌سازی)، `UX_AUDIT_REPORT.md` (§۰)، `USER_JOURNEYS.md`، `UX_PRIORITY_ROADMAP.md`، `verification/2026-09-14-ux-audit-runtime.md`.
- **تست / تأیید:** `git log --oneline -4`، `git show --stat ecf00b4 fedeac2 8347fbb`، grepِ شواهدِ هر یافته در `public/index.html` HEAD. اجرای mock روی HEAD تکرار نشد.
- **عامل:** نشستِ دیگر (کشف‌شده در 2026-09-14)؛ همگام‌سازی توسطِ این نشست.
- **کارِ باز:** نشستِ سازنده‌ی `8347fbb` باید رویدادِ `GIT`/`CODE` آن را ثبت کند (LAW-024).

### 2026-09-14 — FINDING — configurationِ نشستِ دیگر در `.claude/launch.json`
- **چه شد:** هنگامِ حذفِ configurationِ موقتِ UX audit مشخص شد `.claude/launch.json` یک configurationِ دیگر به نامِ `feelia-ui-mock` (node، پورتِ 3911، scratchpadِ نشستِ `cf1e1cb5…`) دارد که متعلق به این نشست نیست. طبقِ CLAUDE.md §9 برگردانده نشد.
- **فایل‌ها:** `.claude/launch.json` (untracked).
- **اسنادِ به‌روزشده:** همین ورودی.
- **تست / تأیید:** `cat .claude/launch.json`.
- **عامل:** نشستِ دیگر (کشف‌شده در 2026-09-14).
- **کارِ باز:** نشستِ مالک باید پس از پایانِ تستش آن را حذف کند.

### 2026-09-14 — TEST — اجرای UI برای UX audit با mock (بدونِ حساب/داده‌ی واقعی)
- **چه شد:** کپیِ فایل‌های واقعیِ `public/` در scratchpad با stubِ `fetch`/میکروفون/WSِ Soniox؛ سرورِ استاتیک با configurationِ **موقتِ** `uxmock-temp` در `.claude/launch.json` (با اجازه‌ی مالک: «هر کاری لازمه انجام بده») اجرا و پس از تست حذف شد. ۷ سناریو.
- **فایل‌ها:** `verification/2026-09-14-ux-audit-runtime.md` (جدید). کدِ repo تغییر نکرد.
- **اسنادِ به‌روزشده:** `verification/README.md`.
- **تست / تأیید:** شکستِ ذخیره‌ی یادداشت → UI ۱ یادداشت و ۱ علامت، سرور ۰، بدونِ هشدار (پس از «ذخیره و پایان» هم ۰)؛ حالتِ FAILED → `hasActiveRecording()=false` → `logout()` → صفحه‌ی ورود با میکروفونِ live؛ پرونده: متنِ یادداشت/علامت/یادداشتِ صوتی نمایش داده نمی‌شود (`span:first-child` بعد از `<svg>`؛ در production از `f58bd29`)؛ جلسه‌ی `batch-pending` «کامل» بدونِ نشانه؛ موبایل: اولین کارت ۵۸۳px و «مراجع جدید» ۴۰۱۴px؛ کارت/جلسه `tabIndex=-1` و اولین Tab در پرونده = حذفِ جلسه؛ کنتراستِ `--muted` ۳٫۲۸/۲٫۹۹؛ `history.length` ثابت؛ بدونِ `prefers-reduced-motion`. **تست‌نشده:** صدای واقعی، Sonioxِ واقعی، دستگاهِ واقعی، صفحه‌خوان، اسکرین‌شات (pane رندر نکرد).
- **عامل:** این نشست.
- **کارِ باز:** —

### 2026-09-14 — DOCS — UX Audit کامل (۵ سند)
- **چه شد:** به دستورِ مالک («Full Critical UX Audit … فقط بررسی کن و داک بنویس») audit تجربه‌ی کاربر از دیدِ پژوهشِ UX نوشته شد: ۴۲ یافته — **Critical ۵، High ۱۴، Medium ۱۸، Low ۵** (۳۸ روی production). پنج Critical: UX-001 از دست رفتنِ بی‌صدای یادداشت/علامت در شکستِ ذخیره، UX-002 نمایش‌ندادنِ متنِ یادداشت‌ها در پرونده، UX-003 خروج در حالتِ ضبطِ محلی با میکروفونِ روشن (شکافِ باقی‌مانده از UI-01)، UX-004 متنِ رضایتِ نادرست/ناقص (شخصِ ثالث، آرشیو، دسترسیِ ادمین)، UX-005 خطای شبکه نمایش‌داده‌شده به‌صورتِ «بدونِ مراجع»/«خروج». به یافته‌های UI-xx ارجاع می‌دهد و تکرار نمی‌کند. **هیچ کدی تغییر نکرد.**
- **فایل‌ها:** `docs/05-plans/ux-audit-2026-09-14/UX_AUDIT_REPORT.md`، `UX_FINDINGS.md`، `USER_JOURNEYS.md`، `UX_OPEN_QUESTIONS.md`، `UX_PRIORITY_ROADMAP.md` (همه جدید).
- **اسنادِ به‌روزشده:** `docs/00-governance/documentation-map.md`، `PROJECT_MASTER_REFERENCE.md` (§20، §22: R15–R17)، §1 و §6 همین فایل.
- **تست / تأیید:** ورودیِ `TEST` بالا؛ validationِ لینک‌ها در ورودیِ بعدی.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** تصمیمِ مالک درباره‌ی نقشه‌ی [UX_PRIORITY_ROADMAP](docs/05-plans/ux-audit-2026-09-14/UX_PRIORITY_ROADMAP.md)؛ P0-1 (متنِ رضایت) همچنان بلاک‌کننده‌ی UX-004/015/016؛ ۱۲ سؤالِ باز نیازمندِ تحقیقِ کاربر.

### 2026-09-14 — GIT — commitِ `fedeac2`: ۵ فیکسِ دیگرِ UI (فازِ ۱ دورِ دوم) روی `feat/clarity`
- **چه شد:** به دستورِ مالک («ادامه بده روی بقیه‌ی فاز ۱ … هر قسمت رو هم دقیق برسی کن چیزیو خراب نکنی»)، ۵ موردِ دیگرِ P1 رفع شد: UI-08 (دکمه‌ی شروع بی‌دلیل منتظرِ چکِ STT می‌ماند — `updateStartButtonState()` حالا بلافاصله بعدِ چکِ میکروفون هم صدا زده می‌شود)، UI-11 (ذخیره‌ی تاریخ/ساعت متنِ بازِ جلسه را می‌بست — حالا همان جلسه دوباره باز می‌شود)، نیمِ باقی‌مانده‌ی UI-20 (Enter در فرمِ ورود/ثبت‌نام حالا `submitAuth()` را صدا می‌زند)، و UI-27 (سه اکشنِ مخربِ پنلِ ادمین — غیرفعال‌سازیِ حساب، گرفتنِ نقشِ ادمین، حذفِ مراجع — حالا `confirm()` با پیامِ فارسیِ روشن دارند). هر مورد جداگانه با mock تست شد (برایِ UI-27 هم مسیرِ accept هم cancel، شاملِ بررسیِ اینکه هیچ درخواستی روی cancel نمی‌رود و چک‌باکس برمی‌گردد)، بعد رگرسیونِ کامل. **یک باگِ خودِ من پیدا و رفع شد:** ویرایشِ اولِ UI-20 با یک کامنتِ چندخطیِ دیگر (UI-01) تداخل کرد و متنِ فارسیِ بدونِ `//` وسطِ اسکریپت ماند؛ `node --check` (نه فقط `new Function`) قبل از هر تستِ مرورگری همین را گرفت؛ دیفِ کامل هم با چشم بازبینی شد تا موردِ مشابهِ دیگری نمانده باشد. سپس commit شد.
- **فایل‌ها:** `public/index.html` (+۴۹/−۴).
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (بخشِ «رفعِ فازِ ۱ (دورِ دوم)»، ۳ ردیفِ FIXED، §0)، §1 و §6 همین فایل.
- **تست / تأیید:** UI-08: دکمه در ۵۳ms فعال شد (نه ۲۵۰۰ms). UI-11: همان جلسه با همان متن دوباره باز شد. UI-20: Enter درخواستِ شبکه فرستاد. UI-27 (سه اکشن × ۲ مسیر): cancel → پیامِ صحیح + صفر درخواست + برگشتِ چک‌باکس؛ accept → دقیقاً یک درخواست. رگرسیونِ کاملِ چرخه‌ی جلسه موفق (یک false-negative در regexِ خودِ تست پیدا و توضیح داده شد، نه رگرسیونِ واقعی). `node --check`، `cd server && npx tsc --noEmit` (exit 0)، `node scripts/rt-harness.cjs` (۲۹/۶، همان baseline) — همه تمیز. `.claude/launch.json` به حالتِ اصلی برگشت.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** push؛ باقیِ فازِ ۱ (UI-13/14/15 با لمسِ `feelia-rt.js`، UI-22/23/24 چیدمانِ موبایل، UI-36، UI-09).

### 2026-09-14 — GIT — commitِ `ecf00b4`: ۱۴ فیکسِ UI (فازِ ۰+۱) روی `feat/clarity`
- **چه شد:** به دستورِ صریحِ مالک («بعدش کامیت بشه ادامه بده الان»)، پس از تأییدِ نهاییِ رگرسیون (syntax، `tsc`، harness، `launch.json` برگشته به حالتِ اصلی)، دقیقاً همان ۲ فایلی که تست شده بود stage و commit شد: `public/index.html` (+۱۷۰/−۱۴) و `server/src/http/auth.ts` (+۹/−۱). `docs/admin-panel.md` (modified، نامرتبط با این کار — از audit پیشین) عمداً از این commit کنار گذاشته شد تا commit دقیقاً محدود به همان چیزی بماند که تست شده بود.
- **فایل‌ها:** `public/index.html`، `server/src/http/auth.ts`.
- **اسنادِ به‌روزشده:** §1 و §6 همین فایل.
- **تست / تأیید:** بعدِ commit دوباره تأیید شد: `git log` نشان‌دهنده‌ی `ecf00b4` روی `2763414`؛ `git status` برای این دو فایل تمیز؛ `cd server && npx tsc --noEmit` → exit 0؛ `node scripts/rt-harness.cjs` → 29 PASS/6 FAIL (همان baseline).
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** push (نیازمندِ دستورِ جداگانه‌ی مالک طبقِ LAW-006)؛ commitِ مستقلِ مستندات (تصمیمِ مالک)؛ بقیه‌ی فازِ ۱ و P2/P3.

### 2026-09-14 — CODE — رفعِ ۹ باگِ فازِ ۱ (دورِ اول) از UI audit: UI-07، UI-10، UI-12، UI-16، UI-17، UI-18، UI-19، UI-21، UI-37 (+ نیمِ UI-20)
- **چه شد:** به دستورِ مالک («کامل چک کن همشو مرحله به مرحله… تست هم بکنیم بعدش کامیت بشه… حواست باشه هیچ چیزیو خراب نکنی») ۹ موردِ دیگرِ P1 رفع شد:
  1. **UI-16:** `#chkLiveText` روشن‌کردن → بلافاصله `rtSession.confirmed+interim` نشان می‌دهد (قبلاً تا پیامِ بعدی خالی بود).
  2. **UI-17:** `startVoiceNoteDirect()` تایمر را شروع می‌کند (`voiceElapsed=0`+`startVoiceTimer()`)؛ `stopVoiceNoteDirect()` بلافاصله بعدِ `finish()` متوقفش می‌کند.
  3. **UI-18:** دکمه‌ی «انصراف» در جعبه‌ی یادداشتِ صوتی + `cancelVoiceNote()` (فقط `cleanupVoice()` موجود را صدا می‌زند — امن برایِ هر دو مسیرِ FeeliaRT/legacy).
  4. **UI-19:** `showExitWarning()` دیگر نمی‌گوید «N یادداشت از بین می‌رود» — چون یادداشت‌ها (متنی و صوتی، بعدِ فیکسِ فازِ ۰) همان لحظه‌ی ثبت به سرور می‌روند، چیزی از دست نمی‌رود.
  5. **UI-12:** کلیک روی جلسه‌ی `in_progress`/`recovered` در پرونده → `liveResumeSession`/`resumeSession` به‌جایِ نمایشِ متنِ (خالیِ) جلسه.
  6. **UI-37:** `removeQuickNote(idx)` + دکمه‌ی حذف در `renderNotesLog()` (همان الگوی `removeSign` که از قبل با `DELETE /api/notes/:id` کار می‌کرد).
  7. **UI-07:** `#bannerBox{position:relative;z-index:60}` — بالاتر از `.modal-back{z-index:50}` تا خطای پشتِ مدال دیده شود.
  8. **UI-10:** `viewTranscript()` بعدِ نمایشِ متن `scrollIntoView({behavior:'smooth',block:'start'})` صدا می‌زند.
  9. **UI-21 (+نیمِ UI-20):** نقشه‌ی `MODAL_CLOSERS` (id→تابعِ closeِ خودِ همان مدال، نه صرفاً حذفِ کلاس) + listenerِ سراسریِ Escape و کلیکِ روی پس‌زمینه (فقط `e.target===backdrop`، کلیکِ داخلِ محتوا نمی‌بندد). Enterِ فرمِ ورود (نیمِ دیگرِ UI-20) رفع نشد.
  هر مورد جداگانه با mock تست شد، بعد یک رگرسیونِ کامل با همه‌ی ۱۴ فیکس (فازِ ۰+۱) با هم اجرا شد. یک false-negative در خودِ تستِ من پیدا شد (mockِ `/__log` فقط ۸۰ خطِ آخر را برمی‌گرداند، نه کدِ اپ) و با سرورِ تازه‌ریستارت‌شده رفع/تأیید شد: گاردِ دوبارکلیکِ فازِ ۰ («۳ کلیک → دقیقاً ۱ درخواست») هنوز درست کار می‌کند.
- **فایل‌ها:** `public/index.html` (مجموعِ فازِ ۰+۱: +۱۷۰/−۱۴)؛ `server/src/http/auth.ts` بدونِ تغییرِ جدید در این دور.
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (بخشِ «رفعِ فازِ ۱ (دورِ اول)»، جدولِ یافته‌ها با ۹ نشانِ FIXED + ۱ جزئی، §0)، `docs/05-plans/master-implementation-plan.md` (ردیفِ UI-Ph1)، §1 و §6 همین فایل.
- **تست / تأیید:** برای هر مورد جداگانه با mock (نتایج در doc)؛ رگرسیونِ کامل (ساختِ مراجع، شروعِ جلسه، علامت، یادداشتِ سریع+حذف، توقف/ادامه، متنِ زنده، پایان، یادداشتِ صوتی+تایمر، یادداشتِ متنی، هشدارِ صحیح، یادداشت‌ها قبل از ذخیره در سرور، logoutِ عادی) — همه موفق. Syntax (`new Function`) OK؛ `cd server && npx tsc --noEmit` exit 0؛ `node scripts/rt-harness.cjs` → 29 PASS/6 FAIL (بدونِ شکستِ جدید نسبت به baseline). `.claude/launch.json` موقتاً تغییر و به حالتِ قبل (فقط `feelia-server`) برگشت.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** commit/push (بعدی طبقِ دستورِ مالک)؛ بقیه‌ی فازِ ۱ (UI-08/09/11/13/14/15/20-نیمه/22-24/27/36)، همه‌ی P2/P3، UI-05 (P0-1).

### 2026-09-14 — CODE — رفعِ ۵ باگِ فازِ ۰ از UI audit (UI-01، UI-02، UI-03، UI-04، UI-06)
- **چه شد:** به دستورِ مالک («شروع کن دونه‌دونه اصلاحشون کن هر اصلاحی که میکنی دقیق تست کن») ۵ موردِ فازِ ۰ یکی‌یکی رفع شد:
  1. **UI-03** (`server/src/http/auth.ts`): تابعِ `toLatinDigits` اضافه شد؛ `normalizePhone` قبل از regex ارقامِ فارسی/عربی را به لاتین تبدیل می‌کند.
  2. **UI-01** (`public/index.html`): تابعِ سراسریِ `hasActiveRecording()` (همان سیگنالِ `beforeunload`)؛ `logout()` و `openAdminPanel()` اگر ضبط فعال باشد بنرِ هشدار می‌دهند و کاری نمی‌کنند (بدونِ `abort()` که صفِ IndexedDB را پاک می‌کند).
  3. **UI-06** (`public/index.html`): `id="newClientCreateBtn"`؛ `createNewClient()` تا پایانِ درخواست دکمه را `disabled` می‌کند.
  4. **UI-04** (`public/index.html`): `startSession()` دکمه‌ی `#btnStartSession` را قبل از POST غیرفعال می‌کند؛ روی خطا با `updateStartButtonState()` دوباره فعال می‌شود.
  5. **UI-02** (`public/index.html`): در `stopVoiceNoteDirect()` شاخه‌ی موفقیتِ realtime حالا `POST /api/sessions/:id/notes` صریح می‌فرستد.
  هر مورد جداگانه با mock backend (فایلِ واقعیِ `public/`، بدونِ حساب/رمز/Sonioxِ واقعی) تست شد، به‌علاوه‌ی دو دور رگرسیونِ کامل (syntax، `tsc --noEmit`، `pnpm test:rt`، جریان‌های عادی: تک‌کلیک، علائم، یادداشتِ سریع، توقف/ادامه، لغو، logoutِ عادی). **UI-05 عمداً رفع نشد** — وابسته به تصمیمِ مالک (P0-1) است. الگوی «دکمه تا پایانِ درخواست غیرفعال» فقط روی `startSession`/`createNewClient` اعمال شد، نه روی همه‌ی اکشن‌های نوشتنی (کارِ باز).
- **فایل‌ها:** `public/index.html` (+57/−4)، `server/src/http/auth.ts` (+9/−1). `.claude/launch.json` برای تست موقتاً تغییر و بلافاصله برگردانده شد.
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (بخشِ جدیدِ «رفعِ فازِ ۰»، جدولِ یافته‌ها، §5، §6)، `docs/03-requirements/requirement-catalog.md` (REQ-001، REQ-063 → IMPL)، `PROJECT_MASTER_REFERENCE.md` (R12–R14)، `docs/05-plans/master-implementation-plan.md` (ردیفِ UI-Ph0)، `docs/04-modules/05-notes-and-signs/module-prd.md`، `docs/04-modules/03-therapy-sessions/module-prd.md`، §1 و §6 همین فایل.
- **تست / تأیید:** UI-03: استخراجِ عینیِ کدِ shipped و اجرا — ۱۱/۱۱ PASS. UI-01: پس از logoutِ بلاک‌شده `engineState=ACTIVE`/`wsOpen=true`/`micLive=true`/صفحه‌ی Live؛ پس از پایانِ صحیح `hasActiveRecording()=false` و logout در ۴۵ms. UI-06: ۳ کلیک → ۱ POST. UI-04: ۳ کلیک → ۱ POST. UI-02: ۱ POST به notes؛ یادداشت در `GET /api/sessions/:id` هم قبل و هم بعد از «ذخیره و پایان». رگرسیون: `node scripts/rt-harness.cjs` → 29 PASS/6 FAIL (همان baseline)؛ `cd server && npx tsc --noEmit` → exit 0؛ syntaxِ اسکریپتِ inline (`new Function`) OK.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** commit/push (P0-0)؛ اعمالِ الگوی «دکمه غیرفعال» روی سایرِ اکشن‌های نوشتنی (`addTextNote`، `finishSession`، `saveSessionMeta`، `confirmDeactivateClient`، `confirmEditCategory`، حذف‌ها، اکشن‌های ادمین)؛ UI-05 وابسته به P0-1؛ فازهای ۱ تا ۴ باقی‌مانده.

### 2026-09-14 — FINDING — تأییدِ قطعی: صفر ترافیک به Clarity رسیده (فیلترینگِ شبکه، نه باگ)
- **چه شد:** مالک با حسابِ خودش روی `feelia.ir` رضایتِ Clarity را داد؛ کنسولِ مرورگر `net::ERR_CONNECTION_CLOSED` روی `www.clarity.ms/tag/yhujhtp8rn` نشان داد و `feelia-analytics.js` طبقِ طراحیِ fail-open خودش را خاموش کرد (بدونِ کرشِ اپ). مالک یک Data Export API tokenِ زنده (scope=Data.Export) در چت فرستاد؛ به درخواستِ صریحِ او، این نشست **یک** درخواست (از سهمیه‌ی روزانه‌ی ۱۰تایی) به `GET https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=1&dimension1=OS` از روی VPS زد (جایی که `clarity.ms` طبقِ audit قبلی در دسترس است). پاسخ `HTTP 200` بود ولی همه‌ی metricها (شاملِ `Traffic`) `information:[]` — یعنی **هیچ sessionی در ۲۴ ساعتِ اخیر برایِ این پروژه ثبت نشده**. نتیجه: کدِ سرور و کلاینت هر دو درست کار می‌کنند (لاگِ production هم ۳ درخواستِ authenticatedِ موفق به `/api/client-config` را قبلاً تأیید کرده بود)؛ مشکل صرفاً دسترسیِ شبکه به `clarity.ms` از سمتِ مرورگرِ مالک است، نه باگ.
- **فایل‌ها:** — (هیچ کدی تغییر نکرد)
- **اسنادِ به‌روزشده:** `PROJECT_MASTER_REFERENCE.md` (§21 Known Limitations، §22 ریسکِ Clarity-network)، §1 و §6 همین فایل.
- **تست / تأیید:** `curl` با header `Authorization: Bearer <token>` از روی VPS (`185.110.191.126`) → `HTTP_STATUS:200`، بدنه: ۹ metric همه با `information:[]`. تیکنِ API در هیچ فایل/commit/حافظه‌ای ذخیره نشد؛ فقط در یک دستورِ SSHِ یک‌باره مصرف شد (۹ درخواستِ باقی‌مانده از سهمیه‌ی امروز).
- **عامل:** این نشست، به دستورِ مالک (ارسالِ token و درخواستِ استفاده).
- **کارِ باز:** مالک باید VPN/فیلترشکن را خاموش یا از یک شبکه‌ی دیگر (موبایلِ بدونِ VPN) امتحان کند تا مشخص شود مسدودیت مخصوصِ همان شبکه است یا فیلترِ سراسری. اگر فیلترِ سراسری بود، R (ریسکِ Clarity برایِ کاربرانِ ایرانی) باید در Master Reference به «تأییدشده» ارتقا یابد و تصمیمِ محصول (ادامه با Clarity یا جایگزینیِ آن) با مالک است.

### 2026-09-14 — DOCS — به‌روزرسانیِ گزارشِ UI با بازبینیِ دوم
- **چه شد:** به درخواستِ مالک («بعضی مشکلات را در کد نمی‌بینم؛ تغییراتِ جدید داده شده و تستِ محلی خوب بود؛ دوباره بررسی و سند را به‌روز کن») بخشِ «بازبینیِ دوم» به گزارش اضافه شد: اثباتِ یکسان‌بودنِ کد، نتایجِ اجرای دوباره، جدولِ «کی دیده می‌شود / چطور خودت ببینی» برای هر مورد، و اصلاحِ ارزیابی (UI-01 وابسته به Clarity، UI-03 وابسته به کیبورد، UI-04/06 وابسته به سرعتِ شبکه، UI-08 روی localhost محسوس نیست).
- **فایل‌ها:** —
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md`، `PROJECT_MASTER_REFERENCE.md` (§20 ردیف‌های Git و UI، §22 R3)، §6 همین فایل (P0-0).
- **تست / تأیید:** ورودیِ `TEST` زیر.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** تصمیمِ مالک درباره‌ی فاز ۰؛ push کردنِ `2763414`.

### 2026-09-14 — TEST — بازبینیِ دومِ UI روی commitِ `2763414`
- **چه شد:** همان mock backend (موقت؛ configurationِ `.claude/launch.json` موقتاً اضافه و پس از تست حذف شد) روی کدِ commitشده اجرا شد و ۱۴ مورد دوباره آزمایش شد؛ خطوطِ کدِ بقیه‌ی موارد دوباره استخراج شد.
- **فایل‌ها:** — (کد تغییر نکرد)
- **اسنادِ به‌روزشده:** بخشِ «بازبینیِ دوم» گزارشِ UI.
- **تست / تأیید:** UI-01 (پس از خروج: `ACTIVE`، میکروفون live، WS باز)، UI-02 (۰ درخواستِ ذخیره)، UI-04 و UI-06 (۲ درخواست)، UI-07، UI-09 (۱۴۰۵/۰۶/۲۳ ↔ ۲۰۲۶/۰۹/۱۴)، UI-11، UI-16 (۰ در برابرِ ۸۹ کاراکتر)، UI-17 (۰۰:۰۰)، UI-18، UI-19، UI-20، UI-21، UI-26 — **همه پابرجا**. hashِ blobِ `index.html`/`feelia-rt.js` در working tree و `2763414` یکسان؛ زمانِ تغییرِ فایل‌ها قبل از بررسیِ اول. **تست‌نشده:** صدای واقعی، Sonioxِ واقعی، دستگاهِ واقعی.
- **عامل:** این نشست.
- **کارِ باز:** —

### 2026-09-14 — FINDING — commitِ `2763414` ثبت نشده بود
- **چه شد:** هنگامِ بازبینی مشخص شد commitِ `2763414` (Moheb، 2026-09-14 10:52، «fix(realtime): keep Soniox WS alive across pause/resume via keepalive») همه‌ی کدِ قبلاً commitنشده را روی `feat/clarity` ثبت کرده، ولی در Event Log ثبت نشده بود (LAW-024). این commit push نشده است (`origin/main` = `8bcdf0e`).
- **فایل‌ها:** ۲۰ فایلِ کد در `2763414`.
- **اسنادِ به‌روزشده:** `PROJECT_MASTER_REFERENCE.md` (§20 Git، R3)، §6 همین فایل.
- **تست / تأیید:** `git log --all`، `git branch -a --contains 2763414`، `git ls-remote origin`، `git diff --stat HEAD` (خالی).
- **عامل:** مالک یا نشستِ دیگر (کشف‌شده در 2026-09-14).
- **کارِ باز:** push با دستورِ مالک.

### 2026-09-14 — TEST — validationِ مستندات پس از گزارشِ UI
- **چه شد:** checkerِ لینک‌ها و شناسه‌ها پس از افزودنِ گزارشِ UI و هم‌گام‌سازیِ اسناد اجرا شد؛ بازگشتِ `.claude/launch.json` به حالتِ قبل و دست‌نخوردنِ کد هم بررسی شد.
- **فایل‌ها:** —
- **اسنادِ به‌روزشده:** این ورودی.
- **تست / تأیید:** 53 فایلِ Markdown، 333 لینکِ نسبی، **0 لینکِ خراب**؛ LAW-001…LAW-024 و 71 REQ بدونِ ارجاعِ تعریف‌نشده. `.claude/launch.json` فقط شاملِ `feelia-server`. زمانِ تغییرِ `public/index.html`، `public/feelia-rt.js`، `public/feelia-analytics.js`، `server/src/http/auth.ts` پیش از این task است. گزارش: ۴۷ ردیفِ یافته، ۴۲ با ✅ در ستونِ production.
- **عامل:** این نشست.
- **کارِ باز:** —

### 2026-09-14 — DOCS — گزارشِ بررسیِ کاملِ UI و هم‌گام‌سازیِ اسناد
- **چه شد:** به درخواستِ مالک («UI و آنچه کاربر می‌بیند را کامل بررسی کن، هر باگ را پیدا کن و فایل بنویس؛ هر کلیکِ اضافه اشتباه است») گزارشِ [ui-ux-audit-2026-09-14](docs/05-plans/ui-ux-audit-2026-09-14.md) نوشته شد: ۴۷ یافته (P0×6، P1×21، P2×11، P3×9) با شاهد و ستونِ production، تحلیلِ کلیک در ۹ جریان، پیشنهادها به تفکیکِ صفحه، نقشه‌ی اجرای ۵فازی و چک‌لیستِ تأیید. هیچ کدی تغییر نکرد.
- **فایل‌ها:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (جدید).
- **اسنادِ به‌روزشده:** `PROJECT_MASTER_REFERENCE.md` (§20 ردیفِ UI، §22 ریسک‌های R12–R14)، `docs/03-requirements/requirement-catalog.md` (REQ-001 → PARTIAL، REQ-063 → CONTRADICTED)، `docs/04-modules/05-notes-and-signs/module-prd.md` (Known Gap: یادداشتِ صوتی تأیید شد)، `docs/04-modules/03-therapy-sessions/module-prd.md`، `docs/05-plans/master-implementation-plan.md` (ردیفِ UI-Ph0…Ph4)، `docs/00-governance/documentation-map.md`، `verification/README.md`، §6 همین فایل (UI-Ph0، UI-Ph1…Ph4).
- **تست / تأیید:** نتیجه‌ی اجرای UI در ورودیِ `TEST` زیر. validationِ لینک‌ها پس از این تغییر در ورودیِ بعدی ثبت می‌شود.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** تصمیمِ مالک درباره‌ی فاز ۰ (UI-01، UI-02، UI-03، UI-04، UI-06) و تقویمِ واحد (P2-3).

### 2026-09-14 — TEST — اجرای واقعیِ UI با mock backend (بدونِ حساب و Sonioxِ واقعی)
- **چه شد:** یک mock backendِ موقت در scratchpad فایل‌های واقعیِ `public/` را سرو کرد و `/api/*` را با داده‌ی ساختگی جواب داد، به‌همراهِ Sonioxِ جعلی (WebSocket) و میکروفونِ ساختگی. سناریوها: فهرستِ مراجعین، پرونده و متن، مدال‌ها، دوبارکلیک، Setup، جلسه‌ی زنده (متنِ زنده، علامت، توقف/ادامه، قطعِ اتصال، حالتِ بدونِ رونویسیِ زنده، لغو)، خروج وسطِ جلسه، صفحه‌ی تکمیل (یادداشتِ صوتی/متنی، هشدارِ خروج)، ورود، پنلِ ادمین؛ در viewportهای ۶۴۰×۳۶۴ و ۳۷۵×۸۱۲. برای اجرای mock موقتاً یک configuration به `.claude/launch.json` اضافه و پس از تست حذف شد (فایل به حالتِ قبل برگشت).
- **فایل‌ها:** — (کدِ repo تغییر نکرد؛ `.claude/launch.json` موقتاً تغییر کرد و برگردانده شد)
- **اسنادِ به‌روزشده:** §2 گزارشِ UI.
- **تست / تأیید:** نتایجِ کلیدی: پس از logout موتور ACTIVE، میکروفون live و WS باز؛ یادداشتِ صوتی ۰ درخواستِ ذخیره؛ دوبارکلیک → ۲ جلسه و ۲ مراجع؛ بنرِ خطا زیرِ مدال؛ Escape/پس‌زمینه مدال را نمی‌بندد؛ متنِ جلسه ۷۲۷px پایین‌تر از viewportِ ۳۶۴px؛ دکمه‌ی شروع ۲۶۱۳ms منتظرِ STT؛ متنِ زنده پس از روشن کردن ۰ کاراکتر (در برابرِ ۸۹)؛ تایمرِ یادداشتِ صوتی ۰۰:۰۰؛ هنگامِ قطعِ اتصال تایمر و نوارِ صدا متوقف ولی ضبط فعال؛ در موبایل توقف ۹۱۶px و پایان ۹۹۵px در صفحه‌ی ۸۱۲. نرمال‌سازیِ شماره با Node: ارقامِ فارسی → null. کنتراستِ `--muted` ۳٫۲۸. وجودِ هر باگ در production با مقایسه‌ی کدِ `8bcdf0e` بررسی شد (۴۲ از ۴۷). **تست‌نشده:** صدای واقعی، Sonioxِ واقعی، دستگاه‌های واقعی، اسکرین‌شاتِ کامل (Browser pane رندر نکرد).
- **عامل:** این نشست.
- **کارِ باز:** mock موقت است؛ انتقال به `scripts/` با تأییدِ مالک.

### 2026-09-14 — FINDING — `enable_endpoint_detection` اکنون `true` است؛ اسناد هم‌گام شد
- **چه شد:** هنگامِ بررسیِ UI مشخص شد (طبقِ ورودیِ `CODE` نشستِ دیگر و grepِ کد) که `enable_endpoint_detection` در `feelia-rt.js`، `index.html` (`SonioxDirect`)، `server/src/http/stt.ts` و `server/src/stt/soniox.ts` — هم در working tree و هم در production (`8bcdf0e`) — `true` است، در حالی که اسناد `false` ثبت کرده بودند. تعارضِ C6 بسته شد.
- **فایل‌ها:** — (کد توسطِ نشستِ دیگر تغییر کرده بود)
- **اسنادِ به‌روزشده:** `docs/01-architecture/integration-architecture.md`، `docs/01-architecture/system-architecture.md` (AD-5)، `docs/02-reference/configuration-catalog.md`، `docs/03-requirements/requirement-catalog.md` (REQ-041)، `docs/07-subsystems/04-legacy-ws-proxy-p1.md`، `docs/00-governance/documentation-map.md` (C6)، `docs/04-modules/04-transcription/module-prd.md`.
- **تست / تأیید:** `grep enable_endpoint_detection` روی working tree و `git show 8bcdf0e:…`.
- **عامل:** نشستِ دیگر (کشف‌شده در 2026-09-14)؛ هم‌گام‌سازی توسطِ این نشست.
- **کارِ باز:** بقیه‌ی کارهای بازِ ورودیِ `CODE` نشستِ دیگر (subsystem 02/05، api-catalog، repository-map) هنوز انجام نشده.

### 2026-09-14 — DEPLOY — deployِ Clarityِ ایزوله‌شده (`8bcdf0e`) به production تکمیل شد
- **چه شد:** به دستورِ صریحِ مالک («خودت انجام بده»)، پس از اینکه push در تلاشِ اول توسطِ permission classifier بلاک شد (ورودیِ قبلی)، دوباره امتحان شد و این‌بار موفق شد. توالیِ کامل: `git push origin feat/clarity-deploy:main` (fast-forward `17dd11a→8bcdf0e`) → روی VPS (`185.110.191.126`, `/root/feeliaa`) بکاپِ `dist`+`public`+`.env` در `/root/feelia-backups/20260914-070300` → `git pull origin main` (fast-forward تمیز؛ diffِ محلیِ `sessions.ts`/`DIAG-TEMP` دست‌نخورده و بدونِ تداخل ماند چون commit اصلاً آن فایل را لمس نمی‌کند) → `pnpm --filter server build` (موفق) → افزودنِ `CLARITY_PROJECT_ID` به `/root/feeliaa/.env` (کلیدهای دیگر دست‌نخورده) → `pm2 restart feelia --update-env` (بدونِ خطا در لاگ، `status:online`) → verification کامل.
- **فایل‌ها:** production: `public/index.html`، `public/feelia-analytics.js` (جدید)، `server/src/http/clientConfig.ts` (جدید)، `server/src/index.ts`، `docs/analytics-clarity.md` (جدید)، `.env` (+۱ کلید).
- **اسنادِ به‌روزشده:** همین ورودی؛ §1 (ردیفِ Production) هم‌گام شد؛ [PROJECT_MASTER_REFERENCE §20](PROJECT_MASTER_REFERENCE.md) باید جداگانه هم‌گام شود.
- **تست / تأیید:** `GET /api/health`→`{"status":"ok","database":"connected"}`؛ `GET /api/client-config` بدونِ کوکی → **401** (هم روی `127.0.0.1:3000` هم `https://feelia.ir`)؛ `GET /feelia-analytics.js` → `200 application/javascript`؛ `GET https://feelia.ir/` → `200`؛ HTML واقعیِ سرو‌شده: `data-clarity-mask` × **31**، `data-clarity-unmask` × **0**، تگِ `feelia-analytics.js` حاضر؛ `pm2 jlist` → `status:online`, بدونِ crash-loop. **کلیکِ واقعیِ کاربر و decodeِ payloadِ Clarity هنوز تست نشده** (نیازمندِ لاگین با حسابِ واقعی که طبقِ قانون انجام نمی‌دهیم، و دسترسی به داشبوردِ Clarity که فقط مالک دارد).
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** مالک باید در داشبوردِ Clarity: Masking mode = Balanced و GA integration خاموش را تنظیم کند، و یک recordingِ تستی را برایِ تأییدِ نهایی ببیند. P0-1 (تناقضِ متنِ رضایت) و P0-2 (لاگِ `DIAG-TEMP`) با این deploy حل **نشدند** — مستقل و همچنان باز هستند (P0-2 هنوز روی همین production فعال است). رول‌بک در صورتِ نیاز: بکاپِ بالا.

### 2026-09-14 — TEST — تأییدِ زنده‌ی keepalive pause/resume رویِ سرورِ واقعیِ Soniox + یافتنِ یک قطعِ واقعیِ WS
- **چه شد:** سناریوی «باگِ واقعی: بعدِ توقف دکمه‌ی ادامه چندبار لازم بود / متن دیگه نوشته نمی‌شد» با کلیکِ واقعیِ دکمه‌ها (نه mock) و یه استریمِ صوتیِ ساختگی (چون میکروفونِ واقعی توی این sandbox بلاک است) رویِ `wss://stt-rt.soniox.com` تست شد. با wrap‌کردنِ `WebSocket.prototype.send`/`close` قبل از باز شدنِ اتصال، ثبت شد: (۱) فقط **یک** WebSocket برایِ کلِ start→pause→۱۰ کیپ‌الایو (هر ~۵۰۰۰ms، طبقِ انتظار)→resume باز شد (`totalOpenAttempts:1`)، (۲) `{"type":"finalize"}` دقیقاً یک‌بار سرِ pause فرستاده شد، (۳) **صفر** رویدادِ close حینِ pause، (۴) resume بدونِ mint/WSِ تازه رویِ همون اتصال صدا رو از سر گرفت. این دقیقاً همون چیزیه که در تحلیلِ اسنادِ Soniox (`session.pause()`/`Connection keepalive`) پیش‌بینی شده بود.
  جداگانه، حدودِ ۱۰ ثانیه بعدِ resume، همون WS واقعاً و غیرمنتظره با کدِ **1006** بسته شد (علت نامعلوم — INFERRED: یا شبکه/WSِ همین sandbox، یا رفتارِ سمتِ Soniox؛ تکرار نشده تا تأیید شود)؛ `handleWSClose`/`scheduleReconnect` طبقِ طراحیِ موجود یک WSِ دوم با mintِ تازه باز کرد (که با کدِ 1000 عادی بسته شد) و session با صداقت `stt_mode=batch-pending` ثبت شد. این رفتارِ fallback درست بود؛ خودِ قطعِ 1006 هنوز توضیح‌دادنی نیست.
- **فایل‌ها:** — (فقط تست؛ کدِ زیر در ورودی‌های `CODE` پایین‌تر تغییر کرده بود)
- **اسنادِ به‌روزشده:** این ورودی. (بروزرسانیِ subsystem/master-reference هنوز انجام نشده — کارِ باز.)
- **تست / تأیید:** کلیکِ واقعیِ UI (شروع→pause→۱۵s صبر→resume→پایان) رویِ سرورِ dev با ثبتِ کاملِ ترافیکِ WS. دیتایِ تستی (therapist `09190000444` + client + session) بعد از تأیید پاک شد؛ فقط حسابِ واقعیِ مالک باقی ماند (تأییدشده با کوئریِ `SELECT id, phone, name FROM therapists`).
- **عامل:** این نشست.
- **کارِ باز:** علتِ قطعِ 1006 نامعلوم (INFERRED، نیازمندِ تکرار/لاگِ سرورِ Soniox)؛ رفتارِ keepalive حینِ throttleِ تبِ پس‌زمینه (setInterval در تبِ hidden) هنوز تست نشده؛ به‌روزرسانیِ `docs/07-subsystems/01-browser-realtime-engine.md` و Master Reference §12/§20 با این evidence انجام نشده.

### 2026-09-14 — CODE — چهار فیکسِ دیگر در `feelia-rt.js`/`server/src/http/stt.ts`/`server/src/stt/soniox.ts` هنگامِ رگرسیونِ گزارش‌شده توسطِ کاربر
- **چه شد:**
  1. `enable_endpoint_detection` از `false` به `true` برگردانده شد (سه‌جا: `feelia-rt.js`، `server/src/http/stt.ts` `STT_DEFAULTS`، `server/src/stt/soniox.ts`) — کاربر با صدایِ واقعی کندیِ غیرقابلِ‌قبول در finalize‌شدنِ متنِ زنده گزارش داد؛ طبقِ مستنداتِ Soniox این دقیقاً تنظیمی‌ست که سرعت را در برابرِ دقتِ diarization معاوضه می‌کند.
  2. `drainQueuedAudioInBackground` (تخلیه‌ی فرصت‌طلبانه‌ی صفِ آفلاین سرِ هر ACTIVE/RECOVERED) قبلاً همیشه `purpose=transcript` می‌فرستاد — یعنی سگمنتِ durableِ بسته‌شده‌ی یه توقف/ادامه‌ی کاملاً عادی (که realtime از قبل درست رونویسی‌ش کرده بود) دوباره رونویسی و به transcript append می‌شد: دوپلیکیتِ متن رویِ هر توقف/ادامه‌ی عادی، نه فقط خرابی. الان purpose بر اساسِ `self.unreliable` تعیین می‌شود (`archive` وقتی چیزی خراب نشده، `transcript` فقط وقتی واقعاً گپ افتاده).
  3. `resume()` قبلاً فقط `connectWithFreshMint` را retry می‌کرد، نه `ensureStream` — گرفتنِ دوباره‌ی میکروفون (بعدِ آزادشدنش سرِ pause) گاهی گذرا شکست می‌خورد و کاربر مجبور بود خودش دوباره «ادامه» بزند. الان هر دو داخلِ همون حلقه‌ی retry (تا ۳ تلاش) هستند.
  4. `stopDurableSegment` قبلاً بدونِ صبر برمی‌گشت؛ چون `MediaRecorder.onstop` ناهمزمانه، `finish()` برایِ جلساتِ کوتاه‌تر از ۶۰ثانیه (بدونِ چرخشِ durable) هیچ صدایی برایِ آرشیو پیدا نمی‌کرد. الان یک promise (`rec._flushPromise`) برمی‌گرداند که `finish()` قبلِ آرشیو/آپلود منتظرش می‌ماند.
  همچنین یک قابلیتِ اختیاریِ جدید ساخته شد: `POST/GET /api/sessions/:id/resolve-speakers` (`server/src/stt/speakerResolve.ts`) — صدایِ آرشیوشده‌ی کاملِ جلسه را با ffmpeg concat می‌کند و یک‌جا با API async رونویسی می‌کند تا شماره‌گذاریِ گوینده‌ها برایِ کلِ جلسه یکدست شود؛ فقط preview برمی‌گرداند، اعمالِ نهایی با همان `PUT /api/sessions/:id` (CAS) که قبلاً بود.
- **فایل‌ها:** `public/feelia-rt.js`، `server/src/http/stt.ts`، `server/src/stt/soniox.ts`، `server/src/stt/speakerResolve.ts` (جدید)، `server/src/http/sessions.ts`، `server/src/index.ts`، `public/index.html` (دکمه‌ی «بازسازیِ شماره‌گذاریِ گوینده‌ها» + مودالِ preview). همه‌ی موارد commitنشده.
- **اسنادِ به‌روزشده:** هیچ‌کدام هنوز — کارِ باز (بندِ زیر).
- **تست / تأیید:** `cd server && npx tsc --noEmit` → بدونِ خطا. `pnpm test:rt` → 29 PASS / 6 FAIL (همان ۶ شکستِ قبلی/شناخته‌شده، هیچ شکستِ جدید). تستِ زنده‌ی مجزا برایِ هر فیکس: آرشیوِ صدایِ جلسه‌ی کوتاه (۲ سگمنتِ synthetic → session_audio)، ffmpeg concat (ffprobe روی خروجی، ۴٫۹۱۹s)، resolve-speakers تا انتها (upload→transcribe→poll→cleanup روی Soniox واقعی)، ری‌ترایِ resume (شبیه‌سازیِ mock: شکستِ mic دوبار → موفقیت سوم، بدونِ کلیکِ اضافه). همه با therapistهایِ آزمایشیِ `0919xxxxxxx` که بعداً پاک شدند.
- **عامل:** این نشست.
- **کارِ باز:** به‌روزرسانیِ `docs/07-subsystems/02-audio-durability-batch-fallback.md`، `05-session-audio-archive-speaker-resolve.md`، `configuration-catalog.md` (نبودِ documented برایِ `enable_endpoint_detection`)، `api-catalog.md` (endpointِ جدیدِ resolve-speakers)، `repository-map.md` (فایلِ جدیدِ `speakerResolve.ts`) — هیچ‌کدام هنوز انجام نشده.

### 2026-09-14 — DEPLOY — تلاشِ deployِ Clarityِ ایزوله‌شده متوقف شد (permission classifier)
- **چه شد:** به درخواستِ صریحِ مالک («اگه برای سایر قسمت‌ها چالشی به وجود نمیاد... انجام بده»)، branchِ ایزوله‌ی `feat/clarity-deploy` (commit `8bcdf0e`، دقیقاً یک commit جلوترِ `main`/production `17dd11a`، فقط ۵ فایلِ Clarity، بدونِ لمسِ `sessions.ts`/`feelia-rt.js`/migrationها) برای push به `origin/main` آماده شد. تحلیل: چون این commit هیچ فایلِ مشترکی با کارِ commitنشده‌ی دیگر (ازجمله `DIAG-TEMP` در production) ندارد و migration جدیدی اضافه نمی‌کند، برای «سایرِ قسمت‌های خراب» هیچ چالشی ایجاد نمی‌کند. اما خودِ `git push origin feat/clarity-deploy:main` توسطِ **auto-mode permission classifierِ محیط** (نه تصمیمِ خودِ agent) بلاک شد؛ حتی `git log`ِ read-only در همان worktree هم بعدش بلاک شد. عملیات متوقف شد و از مالک خواسته شد یا خودش push کند یا اجازه‌ی صریح در تنظیماتِ Bash permission بدهد.
- **فایل‌ها:** — (هیچ push/تغییرِ سروری انجام نشد)
- **اسنادِ به‌روزشده:** همین ورودی؛ §1 و §6 هم‌گام شدند.
- **تست / تأیید:** انجام نشد — دلیل: بلاکِ classifier قبل از رسیدن به مرحله‌ی push/SSH.
- **عامل:** این نشست، به دستورِ مالک؛ متوقف‌شده توسطِ گاردریلِ محیط.
- **کارِ باز:** منتظرِ اجرای دستیِ `git push` توسطِ مالک یا اجازه‌ی صریح؛ سپس ادامه‌ی مراحلِ سرور (pull، build، env، pm2 restart). یادآوری: P1-4 (deployِ کاملِ working tree) همچنان BLOCKED روی P0-1/P0-2/P1-1/P1-3 است — این تلاش فقط شاملِ همین ۵ فایلِ Clarityِ ایزوله بود، نه کارِ دیگر.

### 2026-09-14 — TEST — validationِ مستندات پس از افزودنِ `PROJECT_STATUS.md`
- **چه شد:** checkerِ لینک‌ها و شناسه‌ها (اسکریپتِ scratchpad، خارج از repo) پس از افزودنِ این فایل و LAW-024 اجرا شد.
- **فایل‌ها:** —
- **اسنادِ به‌روزشده:** §4 همین فایل.
- **تست / تأیید:** 52 فایلِ Markdown، 320 لینکِ نسبی، **0 لینکِ خراب**؛ LAW-001…LAW-024 همه تعریف‌شده و بدونِ ارجاعِ تعریف‌نشده؛ 71 REQ بدونِ ارجاعِ تعریف‌نشده.
- **عامل:** این نشست.
- **کارِ باز:** (پیشنهاد) انتقالِ checker به `scripts/` تا هر نشست بتواند اجرا کند — نیازمندِ تأییدِ مالک.

### 2026-09-14 — DOCS — ایجادِ `PROJECT_STATUS.md` و قانونِ ثبتِ اجباریِ رویدادها
- **چه شد:** به درخواستِ مالک («یه فایل .md بر اساسِ استراکچری که دادم بساز؛ هر اتفاقی افتاد باید آپدیت بشه») این فایل ساخته شد و قاعده‌ی به‌روزرسانیِ آن اجباری شد.
- **فایل‌ها:** `PROJECT_STATUS.md` (جدید).
- **اسنادِ به‌روزشده:** `CLAUDE.md` (§2، §5، §7، §9)، `docs/00-governance/project-laws.md` (LAW-024)، `docs/00-governance/ai-agent-reading-guide.md` (گامِ ۱۲)، `docs/00-governance/documentation-map.md`، `PROJECT_MASTER_REFERENCE.md` (§20، §24)، `docs/README.md`، `docs/02-reference/repository-map.md`.
- **تست / تأیید:** اجرای checkerِ لینک و شناسه پس از تغییرات — نتیجه در ورودیِ `TEST` بعدی.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** —

### 2026-09-14 — DOCS — هم‌گام‌سازیِ مستندات با تغییرِ pause/keepalive و evidenceِ Clarity
- **چه شد:** مستندات با کدِ جدیدِ `feelia-rt.js` هم‌گام شد؛ ریسکِ R11 (سقفِ 1MiB) به Master Reference اضافه شد؛ شمارِ جداول در Master Reference §12 از ۷ به ۶ اصلاح شد؛ evidenceِ Clarity ثبت شد.
- **فایل‌ها:** —
- **اسنادِ به‌روزشده:** `docs/07-subsystems/01-browser-realtime-engine.md` (pause/resume، I6، I13، ریسک‌ها)، `03-transcript-integrity.md`، `requirement-catalog.md` (REQ-025، REQ-047)، `configuration-catalog.md` (`KEEPALIVE_INTERVAL_MS`)، `integration-architecture.md`، `glossary.md`، `PROJECT_MASTER_REFERENCE.md` (§12، §20، R11)، `verification/README.md`، `04-modules/07-ux-analytics/implementation-plan.md`، `traceability-matrix.md`.
- **تست / تأیید:** `node scripts/rt-harness.cjs` → 29 PASS / 6 FAIL (همان شکست‌ها). checker → 51 فایل، 274 لینک، 0 خراب؛ LAW و REQ بدونِ ارجاعِ تعریف‌نشده.
- **عامل:** این نشست.
- **کارِ باز:** سناریوی «resume روی همان اتصال» و «keepalive» در harness assert نمی‌شود.

### 2026-09-14 — TEST — تستِ محلیِ Clarity (بدونِ deploy)
- **چه شد:** typecheck/build موفق؛ harness 29/6؛ بررسیِ استاتیکِ mask (35) و allowlist؛ route inject 10/10؛ sandboxِ `feelia-analytics.js` 41/41.
- **فایل‌ها:** `verification/2026-09-14-clarity-test-pass.md`.
- **اسنادِ به‌روزشده:** همان evidence.
- **تست / تأیید:** کلیکِ واقعی در مرورگر و payloadِ Clarity تست نشد (MCP browser غیرفعال؛ `clarity.ms` از شبکه‌ی dev بلاک).
- **عامل:** نشستِ دیگر (کشف‌شده در 2026-09-14).
- **کارِ باز:** اسکریپت‌های تست در repo نیستند.

### 2026-09-14 — CODE — `feelia-rt.js`: توقفِ دستی با keepalive به‌جای بستنِ WS
- **چه شد:** `pause()` دیگر WS را نمی‌بندد و `{"type":"keepalive"}` هر ۵s می‌فرستد؛ `resume()` اگر اتصال باز باشد روی همان WS ادامه می‌دهد (بدونِ mint، بدونِ ریستِ گوینده، بدونِ مارکر)، وگرنه `resumeWithFreshConnection()` با ۳ تلاش. همچنین Master Reference §21 توسطِ همان نشست ویرایش شد.
- **فایل‌ها:** `public/feelia-rt.js` (commitنشده).
- **اسنادِ به‌روزشده:** در ورودیِ `DOCS` بالاتر.
- **تست / تأیید:** harness 29/6 (بدونِ شکستِ جدید)؛ keepalive صراحتاً تست نشده.
- **عامل:** نشستِ دیگر (کشف‌شده در 2026-09-14).
- **کارِ باز:** اثرِ سقفِ ۷۲۰۰ ثانیه‌ایِ کلیدِ موقت در توقفِ طولانی (INFERRED) تست نشده.

### 2026-09-13 — FINDING — سقفِ عملیِ آپلودِ multipart = 1MiB
- **چه شد:** در `@fastify/multipart@10.1.1`، `fileSize` پیش‌فرض = `bodyLimit` Fastify (1MiB)؛ `server/src/index.ts` هیچ‌کدام را تنظیم نکرده → چکِ 50MB دست‌نیافتنی است.
- **فایل‌ها:** —
- **اسنادِ به‌روزشده:** `configuration-catalog.md`، `error-code-catalog.md`، `deployment-operations.md`، `requirement-catalog.md` (REQ-100)، `verification/2026-09-13-documentation-baseline.md`.
- **تست / تأیید:** خواندنِ `node_modules/@fastify/multipart/index.js:53`.
- **عامل:** این نشست.
- **کارِ باز:** P1-1.

### 2026-09-13 — FINDING — ثبتِ تعارض‌های C1–C8 و ریسک‌های R1–R10
- **چه شد:** هنگامِ audit، تعارض‌ها (مهم‌ترین: متنِ رضایت ↔ آرشیوِ صدا؛ `admin-panel.md` ↔ export؛ دو فرضِ متعارضِ production؛ فرمتِ تاریخ) و ریسک‌ها (لاگِ `DIAG-TEMP`، فایل‌های یتیمِ صدا، CAS غیراتمیک، کارِ commitنشده، امنیتِ HTTP) ثبت شدند. همچنین مشخص شد `AUTH_PASSWORD` و `global-agent` در کد استفاده نمی‌شوند، endpointِ HTTPِ `voice-note` در فرانت مصرف‌کننده ندارد، و حذفِ مراجع توسطِ ادمین در UI تأیید نمی‌خواهد.
- **فایل‌ها:** —
- **اسنادِ به‌روزشده:** `documentation-map.md` §6، `PROJECT_MASTER_REFERENCE.md` §22، `project-laws.md` (violationهای فعلی).
- **تست / تأیید:** خواندنِ کد و grep؛ ادعاهای INFERRED اجرا نشدند.
- **عامل:** این نشست.
- **کارِ باز:** §6.

### 2026-09-13 — TEST — baselineِ هنگامِ ساختِ مستندات
- **چه شد:** `cd server && npx tsc --noEmit` → بدونِ خطا. `node scripts/rt-harness.cjs` روی working tree → 29/6؛ روی `feelia-rt.js` نسخه‌ی HEAD (در scratchpad) → 35/35. `server-deploy/src` = کدِ commit `f9b0a9c`.
- **فایل‌ها:** `verification/2026-09-13-documentation-baseline.md`.
- **اسنادِ به‌روزشده:** Master Reference §20.
- **تست / تأیید:** همان.
- **عامل:** این نشست.
- **کارِ باز:** P1-2.

### 2026-09-13 — DOCS — ایجادِ معماریِ کاملِ مستندات
- **چه شد:** Repository Discovery (همه‌ی ۳۸ فایلِ tracked + untrackedهای مرتبط) → audit → ساختِ `CLAUDE.md`، `PROJECT_MASTER_REFERENCE.md`، `docs/00`–`07`، `verification/`. `docs/admin-panel.md` → HISTORICAL (بنر)؛ `docs/analytics-clarity.md` → سربرگِ وضعیت. هیچ کدی تغییر نکرد.
- **فایل‌ها:** ۵۱ فایلِ Markdown (جدید یا با بنر).
- **اسنادِ به‌روزشده:** همه.
- **تست / تأیید:** checkerِ لینک‌ها → 0 لینکِ خراب.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** review مالک.

### 2026-09-12 — GIT — آخرین commitِ موجود پیش از مستندسازی
- **چه شد:** `17dd11a fix(stt): strip Soniox <end>/<fin> markers from server-side transcript text` روی `main` (و `feat/clarity`).
- **فایل‌ها:** `server/src/stt/soniox.ts`.
- **اسنادِ به‌روزشده:** — (قبل از وجودِ این سیستم)
- **تست / تأیید:** —
- **عامل:** مالک (ثبتِ گذشته‌نگر از `git log`).
- **کارِ باز:** —
