# Verification — رفعِ چالش‌هایِ تستِ واقعی (2026-09-26)

> Evidence (مشاهده در یک لحظه). ورودیِ کامل: `PROJECT_STATUS.md` §7، 2026-09-26.

## داده‌ی مشاهده‌شده در production (read-only، فقط متادیتا — هیچ متنِ بالینی خوانده/ثبت نشد)
- `sessions.cee2e5d2`: `batch_status='queued'` از 2026-09-21؛ `data/batch-queue` خالی؛ `session_audio` یک سگمنتِ `transcribed_at=NULL`.
- `obs_events` بر اساسِ `client_ts`: `8d56fe5c` COMPLETED در 07:09:23 بدونِ `rt.ws_close`؛ `rt.ws_close 1006` در 07:13:24 با `session_id=5bf52d71`؛ `session.transcript_put`ِ `5bf52d71` از len=473 به 1484 بدونِ وقفه ادامه داشت.
- در بقیه‌ی جلسه‌ها `rt.ws_close` ۱ تا ۶۰ ثانیه بعد از COMPLETED.
- `obs_ui_events`: `newClientCreateBtn` → nav `Setup` → `btnStartSession` → `btnEndSession` → `detailUploadBtn` (دو بار)؛ `DELETE /api/sessions/:id` → 404.
- `session_audio` با `kind='note'` برایِ `2ad0588e` رونویسی شده (`transcribed_at` پر) درحالی‌که realtimeِ یادداشت موفق بود.

## اجرا
| بررسی | نتیجه |
|---|---|
| `cd server && npx tsc --noEmit` | exit 0 |
| `pnpm test:rt` | 69 PASS / 0 FAIL (T35–T38 جدید) |
| همان harness رویِ `public/feelia-rt.js`ِ HEAD | می‌شکند (`isSessionActive is not a function`) |
| `pnpm test:up` | 41 PASS / 0 FAIL |
| `pnpm test:cf` | 108 PASS / 0 FAIL |
| مسیریابیِ نامِ فایلِ صف (tsx، بدونِ DB) | هر purpose (شاملِ `note-archive`) دقیقاً فایلِ خودش |
| مرورگر + mockِ اسکرچ‌پد (canary) — حذفِ جلسه | `DELETE /api/sessions/44444444-…` → 200، لیست خالی |
| مرورگر — دکمه‌ی آپلودِ Setup | دیده می‌شود؛ مودال باز؛ انصراف رویِ Setup؛ شروع → `screenClientDetail` |

## دورِ دوم — تستِ کامل پیش از commit
- snapshotِ staged (بدونِ کدِ نشستِ دیگر): `tsc` 0 · `test:rt` 69/0 · `test:up` 41/0 · `test:cf` 108/0.
- E2E رویِ MySQL 8.4ِ dev با fixtureهایِ canary و کدِ staged: **16/16** (reconcile ×6، note-archive ×5، سگمنتِ خراب ×4، پاک‌سازی ×1).
- بک‌آپِ production: `/root/backups/pre-realtest-fixes-20260926T110447Z/` (db.sql.gz + app-and-data.tar.gz + SHA256SUMS ✅).

## تست‌نشده
- routeِ HTTPِ `POST /batch-audio?purpose=note-archive` (یک خطِ نگاشت).
- ضبطِ واقعیِ میکروفون (در Browser pane مسدود است).
