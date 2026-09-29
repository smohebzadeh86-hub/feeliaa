# 2026-09-29 — یادداشتِ پیش از جلسه (متنی + صوتی) — تست

> Evidence (مشاهده در یک لحظه). شاخه‌ی `feat/clarity`، working tree، **commit/deploy نشده**. REQ-066.

## ۱. تست‌هایِ خودکار

| دستور | نتیجه |
|---|---|
| `cd server && npx tsc --noEmit` | تمیز |
| `pnpm test:rt` | **102/102 PASS** — جدید: T56a (`intent='pre-note'` ⇒ `purpose=pre-note`)، T56b (drainِ جلسه‌ی زنده‌ی همان sessionId، رکوردِ pre-note را با purposeِ خودش می‌فرستد، نه transcript؛ صف خالی) |
| `pnpm test:routes` | یک diffِ عمدی: `PATCH /api/notes/:id` با `requireAuth` ⇒ snapshot با `--update` (127 route) و دوباره OK |
| `pnpm test:arch` | OK (140 فایل، بدونِ چرخه) |
| `pnpm test:cf` | 110/110 |
| `pnpm test:up` | 52/52 |
| `pnpm test:tu` / `test:ft` / `test:llm` | 18/18 / 59/59 / 18/18 |
| نام‌گذاریِ صف (tsx در scratchpad، cwdِ جدا از `data/`ِ واقعی) | PASS — `…-000000-pnabc123-<ts>.prenote.webm`؛ `pendingAudiosFor(pre-note)`=1؛ صفِ transcript و note آن را نمی‌بینند |

## ۲. تستِ UI (Browser pane + mockِ scratchpad، دادهٔ ساختگیِ CANARY، بدونِ حساب/DB/Soniox)

میکروفونِ Browser pane مسدود است ⇒ در HTMLِ سروشده‌ی mock (نه repo) `getUserMedia` با یک toneِ `OscillatorNode` جایگزین شد تا `MediaRecorder`ِ واقعی کار کند.

| سناریو | نتیجه |
|---|---|
| صفحه‌ی شروع: «+ یادداشتِ پیش از جلسه — متنی یا صوتی» ⇒ تایپ + دو ضبط (کلیکِ واقعی) | دو کلیپ با پخش‌کننده و «حذف»؛ تایمر و «پایان ضبط/انصراف» |
| «شروع جلسه» | `POST /api/sessions` با `pre_note` ⇒ ردیفِ `note_before`؛ دو `batch-audio?purpose=pre-note` (`audio/webm;codecs=opus`، ۲۵۵KB و ۳۰KB) بلافاصله؛ صفِ IndexedDB خالی |
| «پایان جلسه» ⇒ Wrapup | بخشِ «یادداشت‌هایِ پیش از جلسه»: ۱ متنی + ۲ صوتی |
| ویرایشِ یک یادداشتِ صوتی (کلیک) | `PATCH /api/notes/:id` با متنِ جدید؛ UI به‌روز |
| حذفِ یادداشتِ متنی (کلیک + مودالِ تأیید) | `DELETE /api/notes/:id`؛ از UI رفت |
| پایانِ جلسه پیش از رسیدنِ متنِ صدا | «در حالِ آماده‌سازیِ متنِ یادداشتِ صوتی…»؛ بعد از رسیدن جایگزین شد و poll متوقف شد |
| صفحه‌ی جلسه در پرونده | پیش از جلسه‌ها در `#sessionPreNotes` (با ویرایش/حذف)؛ `note_after` فقط در فهرستِ عادی — تکراری نیست |
| آپلود از صفحه‌ی شروع | متن/صدا به مودال منتقل؛ «انصراف» ⇒ برگشت به صفحه‌ی شروع؛ بعد از `complete` ⇒ `note_before` + `pre-note` رویِ جلسه‌ی آپلودی |
| ستونِ قدیمیِ `sessions.pre_note` | فقط‌خواندنی (بدونِ دکمه)؛ `note_after` واردِ این بخش نمی‌شود |
| خروج از صفحه‌ی شروع وسطِ ضبط | trackِ میکروفون `ended` (میکروفون باز نمی‌ماند)؛ کلیپ نگه داشته می‌شود |
| موبایل ۳۷۵px | بدونِ اسکرولِ افقی؛ ردیفِ ضبط wrap می‌شود (بعد از رفعِ کوچکِ CSS) |
| کنسول | فقط 404ِ endpointهایی که mock ندارد (`catalog/treatment-units`، `therapist/modalities`، `final-transcript`) و 503ِ عمدیِ mint |

## ۳. E2Eِ واقعی (همان روز، دستورِ مالک: «تستِ کامل روی دیتابیس dev با Soniox واقعی»)

سرورِ واقعیِ working tree رویِ 3100 (MySQLِ dev، کلیدِ واقعیِ Soniox، بدونِ سرورِ دیگری رویِ همان DB)؛ fixtureهایِ CANARY مستقیم با SQL (دو تراپیست
با رمزِ غیرقابلِ‌استفاده و ایمیلِ `.invalid`، یکی ادمین؛ یک مراجع با رضایتِ ثبت‌شده؛ توکن فقط در فایلِ scratchpad). Chromeِ headless با میکروفونِ جعلی =
مکالمه‌ی ساختگیِ TTSِ فارسی (`conv3.wav`)، رانده با CDP؛ UIِ واقعی کلیک شد. پرونده/متنِ نهایی برایِ fixture خاموش ⇒ LLM صدا زده نشد.

| # | سناریو | نتیجه |
|---|---|---|
| A1 | صفحه‌ی شروع: تایپِ متن + ضبطِ ۱۵ثانیه‌ای (کلیک) | PASS — کلیپ «۰۰:۱۵» |
| A2 | «شروع جلسه» ⇒ جلسه‌ی زنده با Sonioxِ realtime | PASS — `ACTIVE`، ۲۵ ثانیه |
| A3/A4 | «پایان جلسه» ⇒ Wrapup: یادداشتِ متنی + متنِ صدا با **رونویسیِ واقعیِ Soniox async** | PASS — متنِ صدا (۲۰۹ نویسه، فارسیِ درست) پیش از رسیدن به Wrapup آماده بود |
| A5 | ویرایشِ متنِ صوتی در Wrapup (کلیک) | PASS — در DB ذخیره شد |
| A6 | صفحه‌ی جلسه: هر دو پیش از جلسه، بدونِ تکرار در فهرستِ عادی | PASS |
| B | مودالِ آپلود: متن + ضبطِ ۱۰ثانیه‌ای + انتخابِ فایلِ `dialog.wav` (`DOM.setFileInputFiles`) ⇒ آپلود | PASS در DB (جلسه‌ی آپلودی `note_before` + `voice_before` رونویسی‌شده + صدا). چکِ خودِ درایور FAIL داد چون sessionId را از `FeeliaUpload.list()` می‌خواند — ایرادِ اسکریپتِ تست، نه محصول |
| DB | `session_audio`: `prenote-000000.webm` (۱۵.۴۸ث) کنارِ `000000.webm`ِ جلسه (۱۵ث) — **هر دو فایل رویِ دیسک، مسیرهایِ جدا** (رفعِ بازنویسی در عمل تأیید شد)؛ `sessions.pre_note`=NULL؛ متنِ یادداشت در transcript نیست | PASS |
| پرونده | `aggregateClientCorpus` + `buildCaseFilePrompt` رویِ همین داده: هر دو برچسبِ فارسی، بدونِ نشتِ نامِ نوع | PASS |
| C1–C3 | ادمین (API): فهرستِ «یادداشت‌هایِ صوتی» با `pre_session`، stream ِ صدایِ پیش از جلسه (200، webm)، متن با کلیکِ صریح | PASS |
| C4 | فایلِ کاملِ صدایِ جلسه صدایِ پیش از جلسه را ندارد | PASS |
| C5/C6 | غیرادمین ⇒ 403؛ PATCH غیرمالک ⇒ 404، متنِ خالی ⇒ 400 `note-empty` | PASS |
| C7–C9 | UIِ پنلِ ادمین: برچسبِ «پیش از جلسه»، پخش‌کننده (۱۰.۳۸ث، بدونِ خطا)، جزئیاتِ جلسه | PASS |
| کنسول | خطایِ JS در مرورگر | ۰ |

**پاکسازی:** `DELETE therapists` (cascade) ⇒ ۲ جلسه، `auth_sessions`/`clients`/`audio_jobs`/`notifications` = ۰؛ پوشه‌هایِ `data/session-audio|batch-queue|uploads`
دقیقاً مثلِ پیش از تست؛ اسکریپت‌هایِ `server/e2e-tmp/` و فایلِ توکن حذف شدند. ۹۶ ردیفِ `obs_events` (فقط شناسه) عمداً می‌مانند (LAW-010، D-E).

**مشاهده (نه باگِ این فیچر):** رونویسیِ async رویِ یادداشتِ صوتی برچسبِ «گوینده ۱/۲/۳:» می‌گذارد — مثلِ یادداشتِ صوتیِ بعد از جلسه. برایِ صدایِ تک‌نفره‌ی درمانگر
احتمالاً فقط «گوینده ۱:» می‌آید؛ اگر مالک بخواهد، برایِ `note`/`pre-note` می‌شود برچسب را حذف کرد.

## ۴. انجام‌نشده

- Safari/iOS (`audio/mp4`) تست نشد.
