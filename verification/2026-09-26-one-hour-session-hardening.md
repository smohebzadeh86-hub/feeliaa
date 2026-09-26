# Verification — آماده‌سازیِ جلسه‌ی ۱ساعته (رونویسیِ زنده + آپلود) — 2026-09-26

> Evidence (LAW-019): مشاهده در همین لحظه روی working treeِ `feat/clarity`؛ commit/deploy نشده.

## تغییرات (خلاصه)
| # | فایل | تغییر |
|---|---|---|
| 1 | `public/feelia-rt.js` | Screen Wake Lock (`syncWakeLock`) تا وقتی یک RTSession زنده است؛ گرفتنِ دوباره در `visibilitychange` |
| 2 | `public/feelia-rt.js` + `public/index.html` | `RTSession.cleanConfirmed()` (کشِ cleanText)؛ `setLiveTextParts` (رندرِ افزایشیِ پاراگراف‌به‌پاراگراف) |
| 3 | `public/feelia-rt.js` | autosave: یک PUTِ هم‌زمان، فاصله‌ی متناسب با طولِ متن (سقف ۱۵s)، timeoutِ ۳۰sِ PUTِ متن؛ شاخه‌ی 409 برایِ PUTِ timeoutخورده‌ی اعمال‌شده (بدونِ تکرارِ متن) |
| 4 | `public/feelia-rt.js` | شمارنده‌ی bytesِ صفِ IndexedDB به‌جایِ `getAll()` در هر add |
| 5 | `public/feelia-upload.js` | timeoutِ تکه `max(120s, حجم/4KB·s)` + قطعِ stallِ ۶۰ثانیه‌ای |
| 6 | `server/src/features/audio-upload/media.ts` | timeoutِ ffmpeg `max(5min, duration/3)` |
| 7 | `public/feelia-rt.js` | retryِ دوره‌ایِ ۳۰ثانیه‌ای از FAILED (به‌جز 401)؛ autosave/watchdog در شروعِ fail-open |

## نتایج
- `pnpm test:rt`: **62 PASS / 0 FAIL** (baseline همین نشست: 55/55). تست‌هایِ جدید: T30 (شمارنده‌ی صف، ۰ `getAll` برایِ ۵ add، جمع = محتوایِ واقعی)،
  T31 (409 بعد از PUTِ timeoutخورده ⇒ بدونِ تکرار)، T32 (retry از FAILED زمان‌بندی، پیامِ خطا ۱ بار، finish پاکش می‌کند)،
  T33 (PUTِ معلق ⇒ فقط ۱ PUT در ~۱۱s؛ متنِ نهایی ذخیره)، T34 (wake lock در pause نگه، در finish آزاد).
- `pnpm test:up`: **41 PASS / 0 FAIL**. `cd server && npx tsc --noEmit`: تمیز.
- **رندر در Chromium (Browser pane، `index.html` استاتیک، متنِ ساختگیِ ~۷۵هزار کاراکتر، ۱۳۲۹۸ به‌روزرسانی، ۵۳۲ پاراگراف):**
  میانگینِ هر به‌روزرسانی + layoutِ اجباری — روشِ قبلی: ۰.۶۱ms در شروع ⇒ **۵۸.۸ms در انتهایِ ساعت**؛ روشِ جدید: ۰.۲۸ms ⇒ **۰.۹۵ms**.
  درستی: الحاقِ پاراگراف‌ها با `\n\n` دقیقاً برابرِ متنِ نهایی؛ interim در انتهای پاراگرافِ آخر؛ متنِ غیرادامه (merge) و
  `textContent`ِ مسیرِ legacy ⇒ بازسازیِ کامل و درست؛ ارتفاع و ظاهر با روشِ قبلی یکسان (۱۱۲px در نمونه، اسکرین‌شاتِ کنارِ هم).

## افزوده (همان روز، پیش از deploy)
- `index.html#rtOnState`: تایمرِ جلسه در قطعی (RECONNECTING/NETWORK_PAUSED/FAILED) دیگر متوقف نمی‌شود مگر میکروفون نباشد. تستِ خودکار ندارد (glueِ UI)؛ فقط بارگذاریِ بدونِ خطا در Browser pane.
- deploy به production به‌صورتِ commit `a20ccdb`؛ health ok؛ نسخه‌ی سروشده از nginx تأیید شد.

## تست‌نشده (صادقانه)
- Wake Lock رویِ موبایلِ واقعی و رفتارِ تبِ پنهان (فقط harness با stub).
- stall/timeoutِ تکه در `feelia-upload.js` — فقط بررسیِ کد و syntax؛ اجرا با XHRِ واقعی/شبکه‌ی کند انجام نشد.
- timeoutِ ffmpeg با فایلِ ۱ساعته رویِ CPUِ شلوغ.
- retryِ ۳۰ثانیه‌ای تا اتصالِ واقعی (T32 فقط زمان‌بندی را تأیید می‌کند، نه شلیکِ تایمر).
- جلسه‌ی ۶۰ دقیقه‌ایِ کامل با mock backend (برنامه‌ی audit) اجرا نشد؛ به‌جایش سنجشِ رندر و تست‌هایِ واحدِ harness.
