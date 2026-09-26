# 2026-09-26 — اجرایِ کاملِ تست‌ها برایِ A1 + A3 + A4 (+ بخشی از A5/A6)

> Evidence (LAW-019). دستورِ مالک: «همه تست ها باید انجام بشه مطمئن بشی رفع شده و بعد ادامه بدی». commit/deploy نشده.

## ۱. harnessها و typecheck (اجرایِ واقعی)
| دستور | نتیجه |
|---|---|
| `cd server && npx tsc --noEmit` | تمیز |
| `pnpm test:rt` | **87 PASS / 0 FAIL** (exit 0) |
| `pnpm test:cf` | **110 PASS / 0 FAIL** |
| `pnpm test:up` | **41 PASS / 0 FAIL** |
| parseِ اسکریپتِ inlineِ `public/index.html` | ۰ خطا |

## ۲. E2E رویِ MySQLِ dev (دادهٔ canary، Sonioxِ جعلی) — **34 PASS / 0 FAIL**
- روش: اسکریپتِ tsx موقت در `server/e2e-tmp/` (بعد از اجرا حذف شد؛ کپی در scratchpadِ نشست)، `app.inject` با کوکیِ نشستِ تراپیستِ canary
  (`…@example.invalid`، password_hashِ غیرقابلِ‌استفاده)، Soniox = سرورِ https محلی با گواهیِ self-signed و **کلیدِ جعلی** (کلیدِ واقعی استفاده نشد)،
  `data/` در پوشه‌ی scratchpad (cwd) تا به صدایِ dev دست نخورد، فایل‌هایِ صوتیِ مصنوعی با ffmpeg (sine، opus/webm). سرورِ dev (پورت ۳۰۰۰) خاموش بود ⇒ هیچ workerی رقیب نبود.
- اثرِ جانبی رویِ DBِ dev: **migration `026` اعمال شد** (افزودنی). پاکسازی: `DELETE FROM therapists` (cascade) ⇒ `clients left = 0`. ردیف‌هایِ `obs_events`ِ canary (بدونِ FK، طبقِ LAW-010/D-E) می‌مانند.
- یک جلسه‌ی رهاشده‌ی واقعیِ dev (غیرِ fixture) وجود داشت؛ workerِ A3 با `therapistId` محدود اجرا شد و تأیید شد به آن دست نزد.

| بخش | تست | نتیجه |
|---|---|---|
| M026 | ستونِ `sessions.auto_closed_at` بعد از `runMigrations` | PASS |
| A3 | جلسه‌ی بی‌فعالیت (۳ ساعت) ⇒ completed + `auto_closed_at`؛ جلسه با صدایِ تازه / ذخیره‌ی تازه / upload ⇒ بسته نشد؛ رویدادِ `session.auto_closed`؛ اجرایِ محدود به جلسه‌ی دیگران دست نزد | 6 PASS |
| A3 | PUT `in_progress` جلسه‌ی خودکاربسته را باز و `auto_closed_at` را NULL می‌کند؛ mintِ رونویسی هم باز می‌کند (200)؛ mint رویِ جلسه‌ی عادیِ completed همچنان 400 | 3 PASS |
| A5 | completed→in_progress (عادی) 409؛ status نامعتبر 400؛ completed→completed 200؛ in_progress→completed 200 | 4 PASS |
| A4 | آرشیو برایِ جلسه‌ی ناموجود رد (`session-gone`) و پوشه‌ای ساخته نشد؛ حذفِ جلسه پوشه + فایلِ صفِ batch را پاک کرد؛ پوشه/فایلِ صفِ یتیم پاک شد؛ صدایِ جلسه‌ی زنده ماند؛ ترمزِ ایمنی (۱۰ از ۱۱ ناموجود ⇒ هیچ حذفی)؛ صفِ batchِ جلسه‌ی حذف‌شده دور ریخته شد؛ sweepِ روزانه پوشه‌ی بدونِ ردیف (`full.*`) را پاک کرد | 7 PASS |
| A4 Soniox | `deleteFile` شکست (500) ⇒ false، 404 ⇒ true؛ `cleanupRemote` شناسه‌ی حذف‌نشده را نگه داشت؛ sweepِ یتیم منبعِ jobِ done را پاک و منبعِ jobِ در جریان را نگه داشت | 3 PASS |
| A1.8 | بدونِ رضایت ⇒ 400؛ درخواستِ ردشده (تاریخِ نامعتبر) رضایت ثبت نکرد؛ درخواستِ معتبر 201 + ثبت؛ resume بدونِ consent با رضایتِ ثبت‌شده ⇒ resumed | 4 PASS |
| A1.3 | resumeِ بخشِ گروهِ کاملِ بی‌جلسه ⇒ جلسه ساخته شد (`duplicate` + `session_id`)؛ sweep گروهِ کامل را finalize کرد (نه expire) | 2 PASS |
| A1.7 | متنِ تازه ۲٪ متنِ فعلی ⇒ رد با پیامِ درصد؛ صدایِ کامل + متنِ کامل ⇒ پیش‌نمایش؛ seqِ گمشده ⇒ رد («کامل نیست»)؛ جلسه با فقط صدایِ یادداشت ⇒ 400 | 4 PASS |

## ۳. UI (Browser pane + mockِ scratchpad، بدونِ حساب)
- صفِ یادداشت (A1.5): قبلاً PASS ([A1 verification](2026-09-26-storage-fix-a1-data-loss.md)).
- A3: جلسه‌ی `completed` با `auto_closed_at` ⇒ بنرِ «جلسه‌ی زنده‌ی نیمه‌تمام» با برچسبِ «خودکار بسته شده»؛ «ادامه» اول `PUT {status:'in_progress'}` می‌فرستد؛ جلسه‌ی completedِ عادی ⇒ بدونِ بنر و کلیدِ localStorage پاک شد. PASS.

## ۴. تست‌نشده (صادقانه)
- هیچ‌چیز رویِ production اجرا/deploy نشد (دسترسیِ SSH توسطِ سیستمِ مجوزِ محیط رد شد).
- جلسه‌ی زنده با میکروفون و Sonioxِ واقعی (Browser pane میکروفون ندارد) — مسیرهایِ A1.4/A1.6 فقط با harness.
- mutation-check برایِ تست‌هایِ E2E انجام نشد (برایِ A1.9 انجام شد).

---
## پیوست (همان روز، بعد از ادامه‌ی پلن): A2، A5، A6، B1–B3 — اجرایِ نهایی
| دستور | نتیجه |
|---|---|
| `cd server && npx tsc --noEmit` | تمیز |
| `pnpm test:rt` | **91 PASS / 0 FAIL** (exit 0؛ جدید: T46–T48 برایِ A2، T49 برایِ A5) |
| `pnpm test:cf` | **110 PASS / 0 FAIL** |
| `pnpm test:up` | **41 PASS / 0 FAIL** |
| E2E رویِ MySQLِ dev (همان روش) | **77 PASS / 0 FAIL** — ۳۴ِ بالا + A2 ×10 (جایگزینیِ درجایِ placeholder، سکوت، fallback، ترتیبِ صف بینِ runها، ترتیبِ آرشیوِ دیررسیده با `client_seq`، فایلِ کامل) + A5 ×8 (`transcript-tail` ×4، نسخه در WSِ legacy، `batch_status`ِ jobِ آپلود ×3) + A6 ×13 (migration 028، ممیزیِ رضایت/بستنِ خودکار/مشاهده/پخشِ فقط-شروع/دانلود/تغییرِ تراپیست/حذفِ جلسه/لغوِ رضایت/حذفِ مراجع، sanitize، UI→JSONL، ۴۰۳ِ غیرِادمین) + B2 ×8 + B3 ×4 |
| UI (Browser pane، mockِ ادمین با دادهٔ ساختگی) | sidebarِ راست رویِ دسکتاپ (۲۲۴px) و tab barِ بالا رویِ موبایلِ ۳۷۵px بدونِ اسکرولِ افقی؛ تمِ تیره و روشن؛ آرشیو: نشان‌هایِ «کامل/سکوت/ناقص/در صف/حذف تا ۲ روز»، پخشِ واقعیِ فایل (۳ث)، حذف با مودال (موفق و ۴۰۹)، «جزئیات» و بازگشت به همان صفحه؛ یادداشت‌ها: متن فقط بعد از کلیک (یک درخواستِ `/text`)، پخشِ صدایِ یادداشت، گروهِ «صدا بدونِ متن». یک ایراد پیدا و رفع شد: تبِ فعالِ موبایل بیرونِ دید بود ⇒ `scrollIntoView` |

- اثر رویِ dev: migrationهایِ `026`، `027`، `028` اعمال شدند (افزودنی). همه‌ی fixtureها پاک شدند؛ ردیف‌هایِ `audit_log`/`obs_events`ِ canary عمداً ماندند.
- تست‌نشده: backoffِ `fileSink` (فقط بازبینیِ کد)؛ هیچ‌چیز رویِ production.

