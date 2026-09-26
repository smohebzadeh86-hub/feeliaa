# 2026-09-26 — A1: رفعِ مسیرهایِ از دست رفتنِ داده (پلنِ «رفعِ ذخیره‌سازی + ادمین فاز ۱»)

> Evidence (مشاهده در یک لحظه، LAW-019). commit/deploy نشده. دستورِ مالک: «شروعِ اجرا از A1».

## تغییرات (۹ مورد)
| # | مشکل | رفع | فایل |
|---|---|---|---|
| A1.1 | لغوِ یادداشتِ صوتی کلِ صفِ صدایِ جلسه را پاک می‌کرد | `abort()` → `clearForRun(sessionId, runId)` | `public/feelia-rt.js` |
| A1.2 | آپلودِ سگمنت بدونِ timeout زیرِ قفلِ سراسری | `AbortController` + `SEGMENT_UPLOAD_TIMEOUT_MS` (۶۰ث) | `public/feelia-rt.js` |
| A1.3 | گروهِ چندبخشیِ کاملِ بدونِ جلسه تا ۷ روز «منتظر» و بعد حذف | finalize دوباره در `POST /api/uploads` و در `sweepStaleUploads` | `uploads.routes.ts`، `uploadStore.ts`، `index.ts` |
| A1.4 | شکستِ ذخیره‌ی نهایی در `finish` بلعیده می‌شد | `persistFinal` (۳ تلاش) + `requeueUnsavedAudio` + نتیجه‌ی `batch-pending` | `public/feelia-rt.js` |
| A1.5 | علامت/یادداشت/یادداشتِ صوتیِ «ثبت‌شده» که ثبت نشده بود | صفِ `feelia_note_outbox` + «ذخیره نشده» + retry | `public/index.html` |
| A1.6 | rebaseِ 409 متن را دور می‌ریخت/overwrite می‌کرد؛ نسخه با `++` | نسخه از پاسخِ PUT؛ rebase بدونِ حذف (برچسبِ واگرایی) | `public/feelia-rt.js` |
| A1.7 | resolve-speakers صدایِ قاطی (note) یا بریده را جایگزینِ متن می‌کرد | `getFullSessionAudio` + ردِ ناقص + ردِ متنِ <۶۰٪ | `speakerResolve.ts`، `sessions.ts` |
| A1.8 | resume/retryِ آپلود رضایتِ لغوشده را دوباره ثبت می‌کرد | `consent` فقط در شروعِ دستی تا اولین پاسخِ موفق؛ ثبتِ رضایت بعد از validation | `feelia-upload.js`، `uploads.routes.ts` |
| A1.9 | regenerate ردیفِ تأییدشده را حذف می‌کرد؛ force پاسخ‌ها را پاک می‌کرد | `keepManual` + reviewed؛ `keepAnswered` در force | `mergeTherapistEdits.ts`، `generateCaseFile.ts` |

## تست‌ها (اجرایِ واقعی)
- `cd server && npx tsc --noEmit` → بدونِ خطا.
- `pnpm test:rt` → تست‌هایِ جدید T42 (A1.1)، T43 (A1.2)، T44 ×۳ (A1.6)، T45 (A1.4) همه PASS؛ کلِ suite: **87 PASS / 0 FAIL** (exit 0؛ قبل از تغییرات 81/81).
- `pnpm test:cf` → 110 PASS / 0 FAIL (۲ تستِ جدید A1.9a/A1.9b). **mutation-check:** با `mergeTherapistEdits.ts`ِ HEAD هر دو تستِ جدید FAIL شدند (108/2).
- `pnpm test:up` → 41 PASS / 0 FAIL (بدونِ رگرسیون؛ تستِ جدیدی برایِ A1.3/A1.8 ندارد — این دو مسیرِ route/DB هستند).
- **UI (Browser pane + mock در scratchpad، `public/` واقعی، بدونِ حساب):** POSTِ 503 → دو آیتم در `feelia_note_outbox`، نشانِ «ذخیره نشده — تلاشِ دوباره…» کنارِ علامت و یادداشت، بنرِ هشدار؛ حذفِ یادداشتِ صف‌شده → از صف برداشته و هرگز فرستاده نشد؛ حالتِ ok + `flushNoteOutbox` → علامت ثبت (`dbId=n1`)، نشان حذف، صف خالی؛ آیتمِ صف‌شده + رفرشِ صفحه → بعد از لود خودکار فرستاده شد؛ 404 → صف نشد، `unsaved='failed'`. کنسول فقط خطاهایِ شبکه‌ایِ عمدیِ mock.

## تست‌نشده (صادقانه)
- A1.3، A1.7، A1.8 سمتِ سرور با MySQL/Soniox/ffmpegِ واقعی اجرا نشدند (E2E رویِ DBِ dev نیازمندِ مجوزِ صریحِ مالک است).
- A1.4/A1.6 با مرورگر و Sonioxِ واقعی تست نشدند (میکروفون در Browser pane مسدود است) — فقط harness.

## ریسک‌ها / نکات
- A1.4: سگمنتی که کمی بعد از آخرین ذخیره‌ی موفق بسته شده دوباره رونویسی می‌شود ⇒ ممکن است چند ثانیه متن با برچسبِ batch تکرار شود (تکرار بر گم‌شدن ترجیح داده شد). سگمنت‌هایی که drainِ ۶۰ثانیه‌ای قبلاً آرشیو کرده دیگر در صف نیستند و برنمی‌گردند.
- A1.5: POSTی که timeout خورده ولی سرور اعمالش کرده، با retry تکراری می‌شود (سرور کلیدِ idempotency ندارد). متنِ یادداشت تا ارسالِ موفق در localStorage می‌ماند.
- A1.8: اگر اولین POSTِ آپلودِ تازه هرگز به سرور نرسیده و صفحه رفرش شود، resume بدونِ رضایتِ ثبت‌شده `consent-required` می‌گیرد و باید دوباره انتخاب شود.
- A1.9: محورِ تأییدشده‌ای که مدل با عنوانِ دیگری بازنویسی کرده، کنارِ نسخه‌ی تازه می‌ماند (تکراریِ ظاهری؛ تراپیست می‌تواند حذف کند).
