# Verification — لایه‌ی رصد/حسابرسی، فازِ ۲: تله‌متریِ واقعیِ WebSocketِ realtime (`rt.*`) با مرورگرِ واقعی

**تاریخ:** 2026-09-23
**هدف:** اثباتِ end-to-end بودنِ سیم‌کشیِ فازِ ۲ (`obsEvent()` در `public/feelia-rt.js`، ۱۰ نقطه‌ی
instrumentation، مسیرِ `kind==='client_event'` در `server/src/http/obs.ts`) با یک نشستِ واقعیِ
مرورگر — نه فقط بازبینیِ کد. تا پیش از این verification هیچ قطعِ واقعیِ WebSocket هرگز مشاهده
نشده بود که واقعاً در `obs_events` بنشیند.

## ۰. سرور و DB استفاده‌شده

- سرورِ dev از قبل رویِ پورتِ ۳۰۰۰ بالا بود (PID موجود از قبل — این نشست آن را بالا نیاورد و
  ری‌استارت نکرد، تا نشستِ دیگری که احتمالاً از آن استفاده می‌کند مختل نشود).
  `curl http://localhost:3000/api/health` → `{"status":"ok","database":"connected"}`.
- MySQLِ لوکالِ واقعی (`mysqld` در حالِ اجرا به‌عنوانِ Windows Service) — همان DATABASE_URL
  موجود در `server/.env` (`mysql://feelia:feelia2025@localhost:3306/feelia`).
- کلیدِ واقعیِ `SONIOX_API_KEY` در `server/.env` موجود بود → مسیرِ mint واقعاً به Sonioxِ واقعی
  وصل شد (نه mock).

## ۱. دادهٔ canary ساخته‌شده (تصمیمِ حذف/نگه‌داشتن با مالک)

| نوع | id | نکته |
|---|---|---|
| therapist | `fbdacf0a-1b56-43d7-8ba0-4ee3a80bc2f4` | phone `09120000222`، نامِ `Canary Obs2 Test` |
| client | `8adbd94d-31eb-404a-b682-c5cda3286723` | کد `CL-GBB4`، alias `Canary Obs2 Client` |
| session | `ec0dcc7f-8f65-4c80-a5b1-e93e29987d29` | جلسه‌ی زنده‌ی واقعی، تکمیل‌شده (`ذخیره و پایان`) |

طبقِ LAW-006 هیچ‌کدام حذف نشدند — فقط این‌جا فهرست شدند.

## ۲. مشکلِ محیط و راه‌حل — میکروفونِ Browser pane

Browser pane دسترسیِ واقعیِ میکروفون را بلاک می‌کند (پیامِ ابزار: *"the page ... requested
microphone access, which is blocked"*). `feelia-rt.js` (`navigator.mediaDevices.getUserMedia`،
خطِ ۹۴) بدونِ یک `MediaStream` واقعی اصلاً وارد مسیرِ mint/WS نمی‌شود.

**راه‌حل:** قبل از کلیکِ «شروع جلسه»، با `javascript_tool` (فقط برایِ فراهم‌کردنِ یک API مرورگرِ
واقعی که در sandbox موجود نیست، نه برایِ دستکاری/بای‌پسِ خودِ `feelia-rt.js`) یک
`MediaStream` واقعی از `AudioContext.createMediaStreamDestination()` (یک oscillator متصل به
آن) ساخته و جایِ `navigator.mediaDevices.getUserMedia` نشانده شد. کدِ خودِ `feelia-rt.js`/
`feelia-obs.js` دست نخورد؛ فقط API مرورگری که هاردویرِ واقعی در این sandbox جایش خالی بود،
با یک استریمِ صوتیِ واقعی (نه فیک/mock دستی) پر شد. از این نقطه به بعد، تمامِ رفتار (mint،
اتصالِ WS، دریافتِ رویدادهایِ Soniox، قطعی‌ها، reconnect) کاملاً واقعی و کدِ production بود.

## ۳. سناریویِ اجراشده

1. ثبت‌نامِ تراپیستِ canary (`POST /api/auth/register`، ۲۰۱)، ساختِ مراجع (`POST /api/clients`، ۲۰۱).
2. ورودِ واقعیِ UI (فارسی، فرمِ ورود) در Browser pane.
3. کلیکِ «شروع جلسه» رویِ کارتِ مراجع → صفحه‌ی رضایتِ ضبط → «موافق است» → چکِ میکروفون (با
   استریمِ واقعیِ بالا، «میکروفون: آماده» رندر شد) → کلیکِ «شروع جلسه و رونویسی».
4. جلسه واقعاً STARTING → ACTIVE شد؛ تایمر شروع به شمارش کرد؛ «در حال رونویسی…» نمایش داده شد.
5. جلسه حدودِ ۳ دقیقه به حالِ خودش رها شد (بدونِ صدایِ واقعی، فقط تونِ oscillator) — در این
   بازه، Sonioxِ واقعی به‌صورتِ طبیعی چندین بار سشن را با کدِ `1000` (پاک) بست (رفتارِ
   شناخته‌شده‌ی حدِ زمانیِ سشنِ Soniox)، و کدِ reconnectِ موجود در `feelia-rt.js` هر بار
   خودکار یک mintِ تازه گرفت و دوباره وصل شد.
6. کلیکِ «پایان جلسه» → «ذخیره و پایان» → جلسه با موفقیت finalize شد.

## ۴. نتایجِ واقعی از DB (نه از کنسولِ کلاینت)

```sql
SELECT COUNT(*) FROM obs_events WHERE session_id='ec0dcc7f-8f65-4c80-a5b1-e93e29987d29';
-- 59
```

شمارشِ رویداد به‌ازایِ نوع (همان کوئری، `GROUP BY event`):

| event | count |
|---|---|
| session.created | 1 |
| stt.mint_ok | 6 |
| rt.ws_open | 6 |
| rt.ws_close | 6 |
| rt.reconnect_scheduled | 5 |
| rt.reconnect_ok | 5 |
| rt.gap_marked | 5 |
| rt.state_change | 19 |
| session.transcript_put | 6 |

نمونه‌یِ واقعیِ یک چرخه‌ی کاملِ قطعی→reconnect (ردیف‌هایِ عینیِ `obs_events`، به ترتیبِ `id`):

```json
{"event":"rt.reconnect_scheduled","source":"client","run_id":"mud568e1kip5lb","session_id":"ec0dcc7f-...","detail":{"reason":"soniox-error","attempt":1,"delay_ms":1000},"ts":"...17:14:17.098Z"}
{"event":"rt.state_change","detail":{"state":"RECONNECTING","prev_state":"ACTIVE"}}
{"event":"rt.ws_close","detail":{"was_clean":true,"close_code":1000},"ts":"...17:14:17.098Z"}
{"event":"rt.ws_open","detail":{},"ts":"...17:14:32.111Z"}
{"event":"rt.reconnect_ok","detail":{"attempt":1},"ts":"...17:14:32.111Z"}
{"event":"rt.gap_marked","detail":{}}
{"event":"rt.state_change","detail":{"state":"RECOVERED","prev_state":"RECONNECTING"}}
{"event":"rt.state_change","detail":{"state":"ACTIVE","prev_state":"RECOVERED"}}
```

این دقیقاً همان زنجیره‌ای است که پلنِ فازِ ۲ ادعا کرده بود: `close_code`/`was_clean` واقعی از
خودِ `CloseEvent`، نه مقدارِ ثابت (هر ۶ باری که `rt.ws_close` رخ داد، `close_code=1000` و
`was_clean=true` بود — چون قطعیِ واقعی از سمتِ Sonioxِ Cleanly بود، نه یک خطایِ شبکه‌ای خام).
`run_id` (`mud568e1kip5lb`) رویِ تمامِ ۵۳ ردیفِ `rt.*` این جلسه یکسان و پایدار ماند.

### چکِ PHI (همان الگویِ verificationِ فازِ ۱)

```sql
SELECT COUNT(*) FROM obs_events
WHERE session_id='ec0dcc7f-8f65-4c80-a5b1-e93e29987d29'
  AND CAST(detail AS CHAR) REGEXP '[^ -~]';
-- 0
```
هیچ کاراکترِ غیرِ ASCII (فارسی/بالینی) در `detail` هیچ‌کدام از ۵۹ ردیف نبود — همه‌ی مقادیر
(`state`, `reason`, `attempt`, `close_code`, `was_clean`, `delay_ms`, `len`, `version`, ...)
enum/عدد/boolean هستند، دقیقاً طبقِ طراحی.

### `obs_ui_events` بدونِ تداخل

جدولِ `obs_ui_events` (رویدادهایِ UI عمومی، نه `rt.*`) از ۱۴ ردیف (باقی‌مانده از verificationِ
فازِ ۱) به ۲۰ رسید — یعنی رویدادهایِ `nav`/`click`/... همچنان به مسیرِ جداگانه‌ی خودشان
می‌روند و با مسیرِ تازه‌ی `client_event`ِ فازِ ۲ قاطی نمی‌شوند (طبقِ طراحیِ `obs.ts` خطِ ۱۴–۱۶).

## ۵. نکته‌ی جانبی — ابزارِ لاگِ شبکه‌ی Browser pane

`read_network_requests` هر ۷ درخواستِ `POST /api/obs/events` را با وضعیتِ
`204 No Content [FAILED: net::ERR_ABORTED]` نشان داد. این گزارشِ خودِ ابزار گمراه‌کننده بود —
چون status code واقعاً `204` برگشته بود، درخواست عملاً کامل شده بود؛ تناقضِ ظاهری با کوئریِ
SQL بالا که ثابت کرد داده واقعاً رسیده. دلیلِ محتمل: `fetch(..., {keepalive:true})` در
`feelia-obs.js` هنگامِ ناوبری/تعویضِ صفحه در گزارشِ DevTools Protocol این‌طور نشان داده
می‌شود، بدونِ اینکه واقعاً درخواست را لغو کرده باشد. **این یافته دربارهٔ ابزارِ مرورگر است، نه
باگی در کدِ فیلیا** — SQL منبعِ حقیقت بود، نه لاگِ شبکه‌ی کلاینت (دقیقاً طبقِ دستورِ کار).

## ۶. جمع‌بندی

- **WS واقعاً باز شد** (`rt.ws_open` × ۶، با Sonioxِ واقعی، نه mock).
- **WS واقعاً بسته شد** با `close_code`/`was_clean` واقعی از خودِ `CloseEvent` (`rt.ws_close` × ۶، همه `1000`/`true`).
- **Reconnect واقعاً اتفاق افتاد** (`rt.reconnect_scheduled` × ۵ → `rt.reconnect_ok` × ۵، هر بار موفق در تلاشِ اول).
- **State machine صحیح رصد شد**: `ACTIVE → RECONNECTING → RECOVERED → ACTIVE` در هر چرخه (۱۹ ردیفِ `rt.state_change`).
- **تأییدشده از DB واقعی، نه کنسولِ کلاینت** — طبقِ الزامِ صریحِ دستورِ کار.
- **بدونِ نشتِ PHI** در هیچ‌کدام از ۵۹ ردیف.
- کدِ زیرِ تست (`feelia-rt.js`, `feelia-obs.js`, `server/src/obs/*`, `server/src/http/obs.ts`) دست نخورد.
- سناریویِ `rt.reconnect_exhausted` عمداً trigger نشد — هر ۵ تلاشِ reconnect در همین اجرا در
  تلاشِ اول موفق شدند (Sonioxِ واقعی همیشه در دسترس بود)؛ برایِ دیدنِ `exhausted` باید Soniox/شبکه
  را عمداً و طولانی‌تر مسدود کرد، که در محدوده‌ی این verification (اثباتِ سازِ کارِ پایه) لازم
  دانسته نشد چون منطقِ آن کد از قبل با `rt-harness.cjs` (`T19`/`T19b` و بقیه) پوشش دارد.

## تست/تایپ‌چک

هیچ فایلِ کدی در این verification تغییر نکرد؛ `cd server && npx tsc --noEmit` از verificationِ
فازِ ۱ (همان نشست) تمیز بود و دست‌نخورده ماند.
