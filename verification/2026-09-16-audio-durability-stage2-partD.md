# Verification — audit صدا، مرحله‌ی ۲ (بخشِ D: چرخشِ ۱۵s، مچ‌کردنِ mic، فلاشِ pagehide، جارویِ دوره‌ای) — 2026-09-16

## دامنه
ادامه‌ی audit مسیرِ ضبط/ذخیره‌ی صدا (`SONIOX.md`)، بخشِ **D** (بعد از تأییدِ زنده‌ی بخشِ A+B در
مرحله‌ی قبل): یافته‌های ۴ (پنجره‌ی صدایِ در-RAM)، ۷ (بدونِ retryِ خودکار بعدِ برگشتِ اینترنت)،
۱۱ (قطعِ فیزیکیِ میکروفون بی‌صدا ضبط را متوقف می‌کند)، بخشی از ۹ (نگهبانِ ۱.۵ثانیه‌ایِ کوتاه).

## تغییرات
- `DURABLE_ROTATE_MS`: ۶۰۰۰۰ → ۱۵۰۰۰ (تصمیمِ صریحِ مالک در پلن).
- `DURABLE_FLUSH_GUARD_MS`: ۱۵۰۰ → ۱۰۰۰۰ (نگهبانِ `stopDurableSegment`، برایِ صفِ بزرگ/دیسکِ کند).
- `RTSession.prototype.watchTrackEnded` + `handleMicLost`: تشخیصِ `track.onended` و بازیابیِ خودکارِ
  استریم با backoff، بدونِ دست‌زدن به state machineِ WS/finalize.
- `flushAllDurable` + listenerهایِ `visibilitychange`(hidden)/`pagehide` در سطحِ ماژول: فلاشِ فوریِ
  سگمنتِ جاری وقتِ پنهان‌شدن/بسته‌شدنِ تب، با ازسرگیریِ بلافاصله اگه صفحه واقعاً بسته نشده.
  - `window.FeeliaRT.hasActiveRecording()` (جدید، عمومی): برخلافِ `hasOpenConnection` که فقط WSِ
    باز را می‌بیند، حالتِ durable-only (بدونِ WS، ولی میکروفون هنوز ضبط می‌کند) را هم پوشش می‌دهد.
- `public/index.html`: `beforeunload` از `hasActiveRecording` استفاده می‌کند (نه فقط `hasOpenConnection`)؛
  `sweepOrphanedAudioQueue` حالا هر ۶۰ ثانیه + رویِ رویدادِ `online` هم اجرا می‌شود (قبلاً فقط سرِ لودِ صفحه).

## تست‌هایِ استاتیک
| تست | نتیجه |
|---|---|
| `node --check public/feelia-rt.js` | ✅ |
| syntax-checkِ همه‌ی `<script>`های `index.html` (با `new Function`) | ✅ |
| `cd server && npx tsc --noEmit` | ✅ (این مرحله کدِ سرور را لمس نکرد، فقط برایِ اطمینان دوباره اجرا شد) |
| `pnpm test:rt` | ⚠️ ۲۹ PASS/۶ FAIL — **همون baseline، بدونِ رگرسیون** |

## تستِ زنده — مرورگرِ واقعی (Browser pane) + سرورِ dev واقعی + MySQLِ لوکالِ واقعی + Soniوxِ واقعی
میکروفونِ واقعی در Browser pane در دسترس نیست؛ طبقِ روشِ خودِ پلن، میکروفون با یک `AudioContext`
اسیلاتور (۲۲۰Hz) + `MediaStreamDestination` شبیه‌سازی شد (`navigator.mediaDevices.getUserMedia`
monkey-patch شد تا این استریمِ واقعی را برگرداند — MediaRecorder/IndexedDB/WebSocket همه واقعی‌اند،
فقط منبعِ صدا مصنوعی است). یک تراپیست/مراجع/جلسه‌ی **canary** با ثبت‌نامِ واقعی ساخته شد (نه حسابِ
واقعیِ مالک — چک شد قبل از شروع که کوکیِ تبِ Browser pane مالِ حسابِ ادمینِ واقعی بود، پس با
ثبت‌نامِ یک حسابِ جدید کوکی عوض شد تا هیچ عملیاتی زیرِ هویتِ واقعیِ مالک انجام نشود).

`window.FeeliaRT.createSession(...).start()` مستقیماً (نه از طریقِ UI) صدا زده شد — mint واقعی موفق
شد، WS به Soniوx واقعی وصل شد (`state=ACTIVE`).

1. **چرخشِ ۱۵ثانیه‌ای:** بعدِ ~۱۸ ثانیه، دقیقاً ۲ سگمنت (`seq=0,1`) در IndexedDB بودند — کلیدها
   `sessionId_runId_seq` (تأییدِ جانبیِ فیکسِ بخشِ A هم).
2. **`hasActiveRecording()`:** حینِ ACTIVE → `true` (هم `hasOpenConnection` هم این).
3. **قطعِ فیزیکیِ میکروفون (finding #11):** `track.stop()` + دیسپچِ دستیِ `onended` (چون استریمِ
   مصنوعی رویدادِ واقعیِ device-loss نمی‌ده) → لاگِ `onError`: «میکروفون قطع شد — در حال تلاش…» →
   کمتر از ۵۰۰ms بعد «میکروفون دوباره وصل شد» → `stream` با **trackِ کاملاً جدید** (idِ متفاوت)،
   `durableRec.state==='recording'`، `liveRec.state==='recording'`، `wsOpen===true` — همه‌چیز بدونِ
   قطعِ رونویسیِ زنده یا تغییرِ `state` (همچنان `ACTIVE`) بازیابی شد.
4. **فلاشِ `visibilitychange=hidden` (finding #4):** قبل از رسیدنِ چرخشِ ۱۵ثانیه‌ایِ بعدی،
   شبیه‌سازیِ پنهان‌شدنِ تب یک سگمنتِ جدید فوری به IndexedDB نوشت (تعداد از ۱ به ۲ رفت) و بلافاصله
   ضبطِ durableِ تازه از سر گرفته شد (`state==='recording'`) — بدونِ وقفه در ضبط.
5. **`finish()` کاملِ جلسه:** `reliable:true`، `state=COMPLETED`؛ هر ۷ سگمنتِ تولیدشده در طولِ تست
   (شاملِ سگمنتِ اضافیِ ناشی از بازیابیِ میکروفون/فلاشِ visibility) با آپلودِ واقعی به
   `POST /batch-audio?purpose=archive&run=<runId>` رسیدند و صفِ IndexedDB کاملاً خالی شد.
6. **تأییدِ نهاییِ سمتِ سرور:** `SELECT * FROM session_audio` نشان داد هر ۷ ردیف با `run_id` درست
   (همون runIdِ RTSession، حتی بعدِ بازیابیِ میکروفون) و `seq` پیوسته (۰ تا ۶) — بدونِ collision،
   بدونِ ردیفِ گمشده.

## پاکسازی
`DELETE /api/clients/:id` (کاسکید: ۱ جلسه) + حذفِ دستیِ تراپیستِ canary از DB؛ شمارش‌ها دقیقاً به
`۱/۱/۱/۰` (دیتایِ واقعیِ مالک) برگشتند. پوشه‌ی آرشیوِ canary از دیسک پاک شد (۱۹ پوشه‌ی دیگر
دست‌نخورده ماندند). IndexedDBِ `feelia-audio` در تبِ Browser pane با `indexedDB.deleteDatabase`
پاک شد (نتیجه‌ی `blocked-but-ok` — با بستنِ تب کامل شد). `mysqld`/سرورِ dev متوقف شدند.

## کارِ بازِ صریح
- بخشِ **C** (late-transcriptِ آفلاین)، بقیه‌ی **E** (mimeِ واقعیِ کلاینت)، و **F** (پنلِ ادمین:
  فایلِ کاملِ چسبیده‌شده) هنوز پیاده نشده‌اند.
- شمارشِ بایتِ IndexedDB با cursor (به‌جایِ `getAll` که همه‌ی blobها را می‌خواند) — بخشِ کوچک‌ترِ
  یافته‌ی #۹ که هنوز پیاده نشده (نگهبانِ زمانی به‌جایش افزایش یافت، که خطرِ عملیِ همون مشکل را
  به‌طورِ چشمگیری کم می‌کند، ولی ریشه‌ی کندیِ خودِ `totalBytes()` دست‌نخورده مانده).
- تستِ سناریویِ «آفلاینِ DevTools» (قطعِ کاملِ شبکه، نه فقط قطعِ میکروفون) هنوز انجام نشده.

## نتیجه‌گیری
بخشِ D این‌بار هم **رویِ زیرساختِ کاملاً واقعی** (مرورگرِ واقعی، MediaRecorder/IndexedDBِ واقعی،
سرورِ dev واقعی، MySQLِ واقعی، Soniوxِ واقعی) تست شد. هر ۴ سناریویِ کلیدی (چرخشِ ۱۵s، قطعِ
میکروفون، فلاشِ visibilitychange، آپلودِ نهاییِ کاملِ صف) دقیقاً طبقِ طراحی کار کردند. `tsc`/
`pnpm test:rt` بدونِ رگرسیون. دیتای canary کاملاً پاکسازی شد.
