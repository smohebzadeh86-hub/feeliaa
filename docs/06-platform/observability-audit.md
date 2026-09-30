# رصد و ممیزی (observability / audit)

> last-verified: 2026-09-30 @ `17d6919` · مالک: [feature-index](../02-reference/feature-index.md) (`obs`) · وضعیت: ACTIVE-CANONICAL

## ۱. چرا (Why)
- **مسئله:** «چه اتفاقی افتاد؟» برایِ جلسه‌هایِ مشکل‌دار بدونِ داده قابلِ پاسخ نبود (کشف‌پذیریِ ضعیفِ پنلِ ادمین؛ باگ‌هایِ ضبط/قطعی فقط از شکایتِ کاربر معلوم می‌شد). همچنین ردِ حسابرسیِ کنش‌هایِ حساسِ ادمین وجود نداشت.
- **تصمیم‌ها** (منبع: Event Log 2026-09-22 «لایه‌ی رصد/حسابرسیِ فازِ ۱»، 2026-09-26 «A6»؛ [LAW-010/LAW-011](../00-governance/project-laws.md)):
  - **D-E:** حذفِ تراپیست/مراجع/جلسه ردِ `obs_*` را پاک نمی‌کند (بدونِ FK)؛ پاکسازی فقط بر اساسِ سن. به دستورِ مالک.
  - **D-F:** `FeeliaObs` برایِ ادمین هم فعال است و بدونِ پرسیدنِ اجازه؛ فقط `data-obs`/`id`/`role`/`tagName` (هرگز متن) — نقضِ آگاهانه‌ی LAW-011 (داده رویِ سرورِ خودمان می‌ماند).
  - **ممیزی (A6، 2026-09-26):** `audit_log` جدا از `obs_events`، با نگهداریِ بلندتر (۲ سال، تصمیمِ مالک).
  - هیچ لاگی داده‌ی بالینی ندارد؛ `detail` فقط از `sanitizeDetail()` می‌گذرد (LAW-001).

## ۲. چه می‌کند (What)
- **رصدِ سرور:** `logEvent()` رویدادِ ساختارمند (`obs_events`) را در صفِ درون‌حافظه می‌گذارد؛ drain دوره‌ای به DB و JSONLِ چرخشی (`fileSink.ts`). `registerObsHooks` هر درخواستِ HTTP را (با الگویِ route، نه URLِ خام) ثبت می‌کند.
- **رصدِ کلاینت:** `feelia-obs.js` کلیک/ناوبری/visibility/شبکه/خطا را batch می‌کند و به `POST /api/obs/events` می‌فرستد (`obs_ui_events`؛ رویدادهایِ `client_event` مثلِ `rt.ws_open` به `obs_events`). `GET /api/client-config` مقدارِ `obs.enabled/sample` را می‌دهد.
- **ممیزی:** `recordAudit()` کنش‌هایِ حساس را در `audit_log` می‌نویسد: export، تغییر/حذفِ تراپیست، حذفِ مراجع/جلسه، مشاهده‌ی متن و پخش/دانلودِ صدا توسطِ ادمین، ثبت/لغوِ رضایت، بستنِ خودکارِ جلسه، ادمین‌شدنِ خودکار.
- **پنلِ ادمین:** فهرستِ جلساتِ اخیر، timeline، diagnosis («چه اتفاقی افتاد؟»)، آمارِ سلامتِ obs — [ماژول 06](../04-modules/06-admin-panel/module-prd.md).
- **sweep:** `sweepOldObsEvents` (روزانه + startup) بر اساسِ سن برایِ `obs_events`، `obs_ui_events`، `audit_log`.

## ۳. مرزها (Boundaries)
- platform: `server/src/obs/` (`types`، `redact`، `fileSink`، `eventLog`، `httpHook`، `audit`، `sweep`، `obs.routes.ts`). R2: `obs/` از `features/` import نمی‌کند.
- مصرف: همه‌ی featureها `logEvent`/`recordAudit` را از `obs/` می‌گیرند؛ `features/admin/obs.admin.ts` و `diagnosis.ts` می‌خوانند.
- فرانت: `public/feelia-obs.js` (`window.FeeliaObs`)، `feelia-rt.js` (فقط `client_event`).

## ۴. کد (Code)
`eventLog.ts` (`logEvent`، صف، drain)، `redact.ts` (`sanitizeDetail`)، `httpHook.ts`، `audit.ts` (`recordAudit`)، `sweep.ts`، `obs.routes.ts`؛ در فرانت `FeeliaObs` ([frontend-map](../02-reference/frontend-map.md)).

## ۵. داده (Data)
مالک: `obs_events`، `obs_ui_events`، `audit_log` — [database-catalog §۰](../02-reference/database-catalog.md). **بدونِ FK** (عمدی، LAW-010). فایلِ JSONL: `<cwd>/data/logs/obs.jsonl` با چرخشِ ۵ نسخه (سقفِ دیسک؛ مقدار: configuration-catalog).

## ۶. API و config
`POST /api/obs/events`، `GET /api/admin/obs/*`، `GET /api/admin/sessions/recent|:id/timeline|:id/diagnosis` — [api-catalog §6.1، §7.1](../02-reference/api-catalog.md). env (`OBS_*`، `AUDIT_LOG_RETENTION_DAYS`): [configuration-catalog](../02-reference/configuration-catalog.md). خطاها: `obs-bad-payload`، `obs-rate-limited`.

## ۷. تست (Tests)
`pnpm test:api` (فقط با مجوزِ مالک، DBِ dev). چرخشِ کاملِ JSONL و idempotencyِ migration با تستِ دستیِ واقعی تأیید شد ([verification](../../verification/2026-09-23-obs-log-rotation-full-cascade.md)). **پوشش نمی‌دهد:** DB-down resilience (موکول به تصمیمِ مالک).

## ۸. ریسک و بدهی
`FeeliaObs` نقضِ آگاهانه‌ی LAW-011 است؛ لاگِ `DIAG-TEMP` در sessions ([LAW-001/023](../00-governance/project-laws.md)) هنوز دُمِ متن را چاپ می‌کند؛ obs فایرهوز است و ممکن است بارِ DB بسازد (نمونه‌برداری با `OBS_CLIENT_SAMPLE`).
