# ریشه‌یابیِ خطایِ `[soniox] … "No audio received."` در لاگِ production (2026-09-24)

> **Evidence** (LAW-019). read-only رویِ production؛ بازتولید رویِ dev با کلیدِ مشترکِ Soniox. فقط اتصالِ WS بدونِ صدا بود: بی‌هزینه و غیرمخرب.
> **هیچ کدی تغییر نکرد.** درخواستِ مالک: «بررسی کن … حداقل پلن بنویس».

## مشاهده (production)
- ۲۴ خطِ `[soniox] error from service … error_code 400 "No audio received."` در `/root/.pm2/logs/feelia-mysql-out.log`.
- **۰** خطِ `[soniox] forwarding chunk` ⇒ مسیرِ legacyِ `/ws/t` (تنها جایی که صدا از سرور به Soniox می‌رود) اصلاً استفاده نشده است.
- پیش از هر خطا، `[batch] archived (no transcribe)`ِ سگمنت‌هایِ جلسه آمده است، یعنی پایانِ یک جلسه و آماده‌شدن برایِ جلسه‌ی بعد.
- `data/logs/obs.jsonl`: ۱۲ درخواستِ `GET /api/stt/check`، هر کدام حدودِ ۶۵۰ تا ۷۶۰ms.

## ریشه (CONFIRMED)
- `server/src/stt/soniox.ts:164` پیامِ خطایِ Soniox را لاگ می‌کند.
- در `server/src/http/stt.ts:87-122` (`GET /api/stt/check`، preflightِ صفحه‌ی شروعِ جلسه در `index.html:5254`) بعد از mint، یک «probeِ legacy» اجرا می‌شود.
  این probe یک `SonioxEngine` با master key باز می‌کند و بلافاصله `engine.stop()` را صدا می‌زند. `stop()` پیامِ `{"type":"finalize"}` و رشته‌ی خالی (پایانِ صدا) را می‌فرستد، **بدونِ اینکه هیچ صدایی فرستاده شده باشد** ⇒ Soniox جواب می‌دهد «No audio received».
- **بازتولید:** `start()` و بعد `stop()` ⇒ همین خطا (1 از 1). `start()` و بعد `abort()` ⇒ ۰ خطا.
- نتیجه‌ی probe (`proxy`) در **هیچ** کدی خوانده نمی‌شود: UI فقط `res.ok` را می‌خواند (نتیجه‌ی mint).

## اثر
- **رونویسیِ زنده خراب نیست.** رونویسیِ واقعی مستقیم از مرورگر با کلیدِ موقت انجام می‌شود و این خطا به هیچ جلسه‌ای ربط ندارد.
- هزینه‌ها:
  - لاگِ گمراه‌کننده: شبیهِ خطایِ رونویسی است و همین بررسی را لازم کرد.
  - به ازایِ هر preflight یک اتصالِ WS با **master key** از سرور به Soniox (مسیرِ LEGACY، LAW-015).
  - حدودِ ۱ تا ۱.۳ ثانیه تأخیر در پاسخِ check. اگر Soniox یا proxy کند باشد، تا ۸ ثانیه؛ UI منتظر می‌ماند ولی دکمه‌ی شروع قفل نیست.

## اجرایِ گزینه‌ی B (همان روز، دستورِ مالک: «گزینه B رو اجرا کن»)
- **تغییر:**
  - `server/src/http/stt.ts`: probeِ legacy، importِ `SonioxEngine` و فیلدِ `proxy` حذف شدند. `ok` مثلِ قبل فقط از mint می‌آید.
  - `public/index.html`: فقط کامنت اصلاح شد (رفتارِ UI بدونِ تغییر).
  - مسیرِ legacyِ `/ws/t` و `/ws/voice` و خودِ `SonioxEngine` دست‌نخورده ماندند (تصمیمِ جدا، LAW-015).
- **تست (dev):** handlerِ واقعی با Fastifyِ درون‌پروسه، بدونِ DB و حساب، و mintِ واقعیِ کلیدِ موقتِ single-use.
  ۳ بار پشتِ‌سرِ‌هم: `200 ok:true mint-ok`، بدونِ `proxy`، **۰** لاگِ `error from service`.
  `test:rt` 55/0، `test:cf` 108/108، `test:up` 31/31، `tsc` تمیز، build.
- **deploy (production):** در ۳ ساعتِ گذشته جلسه‌ی زنده، آپلود یا jobِ فعال نبود. backup: `/root/backups/code-before-sttcheck-20260924T200405Z.tar.gz`. health ok، online (restarts=7).
- **تست (production):** handlerِ deploy‌شده در پروسه‌ی جدا ⇒ `200 ok:true mint-ok`، `hasProxy:false`، **۳۴۰ms** (پیش‌تر ۶۵۰ تا ۷۶۰ms در obs)، ۰ خطایِ Soniox.
- **خطِ مبنا برایِ پایش:** ۲۴ خطِ «No audio received» در لاگِ pm2 تا لحظه‌ی deploy. بعد از چند شروعِ جلسه‌ی واقعی، این عدد نباید بالا برود.
