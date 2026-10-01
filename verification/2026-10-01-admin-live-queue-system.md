# Verification — پنلِ ادمین: جلساتِ زنده / صفِ پردازش / سلامتِ سیستم (2026-10-01)

**دامنه:** سه صفحه‌ی جدید + ۵ endpoint (api-catalog §7). فقط متادیتا؛ بدونِ شنودِ زنده.

## نتایج
- `cd server && npx tsc --noEmit` — exit 0.
- `pnpm test:arch` — OK (مرزِ ماژول؛ `admin` فقط از `audio-upload/index.ts`، `final-transcript/index.ts`، `transcription/index.ts` import می‌کند).
- `pnpm test:routes -- --update` سپس `test:routes` — فقط ۵ route (+HEAD) اضافه شد، همه `requireAdmin`؛ routeهایِ موجود (از جمله retryِ تراپیست) بدونِ تغییر.
- `pnpm test:up` — 54 PASS / 0 FAIL (جابه‌جاییِ منطقِ retry به `jobRetry.ts` رفتارِ تراپیست را عوض نکرد).
- `pnpm test:adm` (جدید) — 8 PASS (شاملِ `scheduleBeating`): مرزهایِ `liveHealth`، heartbeat، percentile، سطل‌بندی/پنجره‌ی ۲۴ساعته و reservoirِ متریکِ HTTP.
- UI با mock backend (scratchpad، public/ واقعی، دادهٔ canary، بدونِ حساب): سه صفحه رندر شدند؛ nav فعال درست؛ polling صفحه‌ی زنده ≈ هر ۱۵ث و **بعد از خروج متوقف** (`adminLiveTimer=null`، بدونِ درخواستِ تازه)؛ تب‌هایِ صف، فیلتر، مودالِ تأیید + `POST …/retry`، CSV (بدونِ نامِ فایل، خنثی‌سازیِ `= + - @`)؛ حالتِ «bad» سلامت فهرستِ مشکل‌ها را نشان داد؛ نمودارِ ۴۸ستونی؛ موبایل ۳۷۵px بدونِ overflowِ افقی؛ تیره و روشن.
- کنسول: فقط 404هایِ endpointهایِ mockنشده (غیرِ مرتبط).

## تکمیل (با مجوزِ صریحِ مالک، همان روز)
- `FEELIA_E2E_OK=1 pnpm test:api` رویِ DBِ dev — **362 ورودی (برابرِ اجرای قبلی)، exit 0، fixtureها پاک** (بدونِ golden ⇒ مقایسه‌ی diff انجام نشد؛ فقط عدمِ شکست).
- E2Eِ موقتِ سه صفحه رویِ MySQLِ واقعیِ dev با fixtureِ ساختگی (اسکریپتِ موقت، بعد از اجرا حذف شد؛ Sonioxِ واقعی/LLM لمس نشد، سرورِ dev خاموش بود، jobها `locked_until` آینده): **7 PASS** — non-admin ⇒ 403 روی ۵ route؛ `live` (recording/stalled، شمارشِ سگمنت، بدونِ متن، upload خارج)؛ `queue` (بدونِ `original_name`/متن، فیلترِ تراپیست/stage، counts)؛ retryِ job (requeue، 409 `not-failed`، 410 `audio-expired`، 404)؛ retryِ متنِ نهایی (queued، 409 `busy`، 404)؛ دو ردیفِ `audit_log` با `actor_is_admin`؛ `system` (ping، حجمِ DB از `information_schema`، `fs.statfs`، چهار پوشه‌ی data، ۴۸ سطل، p95، شمارِ obs/llm). fixtureها پاک (`fixtures left: 0`).

## محدودیت‌هایِ باقی‌مانده
- heartbeatِ workerهایِ **واقعی** رویِ سرورِ زنده دیده نشد: `startBackgroundJobs` رویِ DB/Sonioxِ مشترکِ dev اجرا نمی‌شود (جاروبِ یتیمِ Soniox مخرب است — فقط production). منطقِ `scheduleBeating`/`beat` با harness پوشش داده شد و فراخوانی‌ها در کد (`backgroundJobs.ts`، tickِ دو worker) با `tsc` بررسی شد؛ بعد از deploy، `GET /api/admin/system` باید ۱۱ ردیفِ worker نشان دهد.
- UI فقط با mock دیده شد (نه سرورِ واقعی با حسابِ ادمین).
- commit/deploy نشد.
