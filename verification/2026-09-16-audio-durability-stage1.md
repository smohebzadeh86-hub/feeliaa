# Verification — audit صدا، مرحله‌ی ۱ (شناسه‌ی run/seqِ سرور، هرگز حذفِ بدونِ آرشیو) — 2026-09-16

## دامنه
پیاده‌سازیِ بخشِ **A + B** از پلنِ audit مسیرِ ضبط/ذخیره‌ی صدا (فایلِ ارسالی مالک، `SONIOX.md`):
یافته‌های بحرانی/بالا #1 (seq collision بینِ run/سگمنت‌ها)، #2 (حذفِ بدونِ آرشیو رویِ ۴۰۰)،
#3 (صفِ سرور بدونِ worker/idempotency، سکوتِ همیشه-در-صف)، #10 (پردازشِ هم‌زمانِ processBatchQueue)،
و بخشی از #14 (سقفِ multipart).

## فایل‌های تغییرکرده
`server/src/db/mysql/migrations/017_session_audio_run_kind_sha.sql` (جدید)،
`server/src/stt/sessionAudioArchive.ts`، `server/src/stt/batchqueue.ts`، `server/src/http/sessions.ts`،
`server/src/index.ts`، `public/feelia-rt.js`، `public/index.html` (`sweepOrphanedAudioQueue`).

## تست‌های استاتیک
| تست | نتیجه |
|---|---|
| `cd server && npx tsc --noEmit` | ✅ بدونِ خطا (بارِ اول و بعدِ تستِ زنده، دوباره) |
| `node --check public/feelia-rt.js` | ✅ |
| `pnpm test:rt` | ⚠️ **۲۹ PASS / ۶ FAIL — دقیقاً همان baseline** (با `git stash` روی نسخه‌ی قبلِ این تغییرات هم دقیقاً همین ۶ FAIL تکرار شد؛ بعدِ تستِ زنده هم دوباره اجرا شد، بازم همون ۲۹/۶ — هیچ رگرسیونی نیست: T2 unreliable→batch fallback، T15×3، T16×2 — همه از قبل‌موجود) |

## تستِ زنده — سرورِ واقعیِ dev + MySQLِ لوکالِ واقعیِ نصب‌شده (نه mock)

MySQL 8.4 لوکال (`C:\Users\Moheb\mysql-data\feelia`، همان دیتابیسِ واقعیِ توسعه با دیتایِ واقعیِ
مالک: ۱ تراپیست/۱ مراجع/۱ جلسه‌ی از قبل‌موجود) با `mysqld.exe` بالا آورده شد، `pnpm dev` روی آن اجرا شد.

### ۱. Migration 017 روی دیتابیسِ واقعی
- `[db] → applying 017_session_audio_run_kind_sha.sql...` → `[db] ✓ applied` — بدونِ خطا.
- `DESCRIBE session_audio` تأیید کرد: `run_id varchar(64) DEFAULT 'legacy'`، `kind varchar(8) DEFAULT
  'session'`، `sha256 char(64) NULL`.
- `SHOW INDEX`: `uq_session_audio_run_seq(session_id, run_id, seq)` و `uq_session_audio_sha(session_id,
  sha256)` هر دو ساخته شدند؛ ایندکسِ قدیمیِ `uq_session_audio_seq` حذف شد.
- **idempotency در سطحِ statement (نه فقط جدولِ `_migrations`):** ردیفِ `017` از `_migrations` دستی حذف
  و سرور دوباره ری‌استارت شد — هر ۶ statement دقیقاً با پیامِ `statement already applied (errno
  1060/1091/1061), skipping` رد شدند و migration بدونِ خطا کامل شد. یعنی حتی اگر جدولِ ردیابی به هر
  دلیلی هماهنگ نباشد (مثلاً چند سرورِ موازی)، اجرایِ دوباره امن است.

### ۲. سناریویِ اصلیِ باگ — دو run با seq=0 (بحرانی‌ترین یافته)
مراجع/جلسه‌ی canaryِ واقعی ساخته شد (ثبت‌نامِ واقعی، `POST /api/clients`، `POST /api/sessions`).
دو فایلِ صوتیِ جعلیِ متفاوت با `run=runA111&seq=0` و `run=runB222&seq=0` (`purpose=archive`) آپلود شدند:

```
seq  run_id    sha256(اول ۱۲ کاراکتر)
0    runA111   b7fd870b51a5…
1    runB222   3604e37f85a1…
```

**قبل از این فیکس، هر دو seq=0 می‌شدند و دومی اولی را بازنویسی می‌کرد (`ON DUPLICATE KEY UPDATE`).
الان هر دو فایل با seqِ متمایزِ سرورساخته (۰ و ۱) کاملاً روی دیسک و DB باقی ماندند — صفر از دست‌رفتگی.**

### ۳. idempotency با sha256 (retryِ همون بایت‌ها)
همون فایلِ `runA111/seq=0` دوباره آپلود شد. نتیجه: **هیچ ردیفِ تکراری** ساخته نشد (همچنان فقط ۲ ردیف،
همچنان فقط ۲ فایل رویِ دیسک) — تشخیصِ sha256 قبل از نوشتنِ فایل کار کرد.

### ۴. قفلِ per-session زیرِ race واقعی
۳ آپلودِ هم‌زمان (`curl ... & curl ... & curl ... & wait`) با seqِ کلاینتِ یکسان (۰) از ۳ runِ مختلف
به جلسه‌ی دومِ canary فرستاده شد. نتیجه: seqهایِ سرورساخته‌ی `1`, `2`, `3` — بدونِ collision، بدونِ
race، دقیقاً طبقِ طراحیِ قفلِ in-memory per-session.

### ۵. آرشیو-قبل-از-رونویسی + «سکوت = موفقیت» با Soniوxِ واقعی
- **یادداشتِ صوتیِ جعلی (نه webmِ واقعی) با `purpose=note` روی جلسه‌ی completed:** سرور با ۲۰۲ پذیرفت،
  فایل **قبل از تلاشِ رونویسی** آرشیو شد (`kind='note'` در DB، فایل رویِ دیسک)، بعد Soniوx واقعاً با
  خطایِ «Invalid audio file» رد کرد. لاگ: `[batch] async transcribe error, kept queued (already
  archived)`. فایل در صفِ retry ماند — **صدا هرگز از دست نرفت**، فقط رونویسی عقب افتاد (دقیقاً طبقِ
  طراحی).
- **فایلِ webmِ سکوتِ واقعی (۲ ثانیه، ساخته‌شده با ffmpeg، فرستاده به `purpose=transcript` رویِ
  جلسه‌ی in_progress):** Soniوxِ واقعی متنِ خالی برگرداند. قبلاً این حالت «برایِ همیشه در صف» می‌ماند؛
  الان لاگِ `[batch] empty result (silence, treated as success)` → آرشیو شد (`duration_ms=2010`،
  تأییدِ جانبیِ اینکه ری‌ماکسِ ffmpeg هم درست کار می‌کند)، از صف حذف شد، `batch_status='done'`.
- **`purpose=transcript` روی جلسه‌ی completed:** `400 {"error":"جلسه پایان یافته است"}` — همان رفتارِ
  قبلی، دست‌نخورده.
- **فایلِ کوتاه‌تر از حدِ مجاز (۴ بایت):** `400 {"error":"فایلِ صوتی خیلی کوتاه است"}` — بدونِ صف‌شدن،
  همان رفتارِ قبلی.
- **`GET /batch-status` و `POST /batch-retry?purpose=note`:** هر دو پاسخِ صحیح دادند (`retrying`).

### ۶. پاکسازیِ کامل (LAW-001/LAW-016)
- `DELETE /api/clients/:id` رویِ مراجعِ canary → کاسکیدِ ۲ جلسه/۰ یادداشت تأیید شد؛ تراپیستِ canary
  مستقیماً از DB حذف شد.
- شمارش‌هایِ قبل/بعد دقیقاً برابر شدند: `therapists=1, clients=1, sessions=1, session_audio=0,
  session_notes=0` (همون ۱/۱/۱ی واقعیِ از قبل‌موجودِ مالک، دست‌نخورده).
- دو پوشه‌ی `data/session-audio/<canary-session-id>` و فایل‌هایِ باقی‌مانده در `data/batch-queue`
  دستی حذف شدند؛ ۱۹ پوشه‌ی دیگرِ از قبل‌موجود در `data/session-audio` دست‌نخورده ماندند (فقط ۲ موردِ
  خودم پاک شد).
- `mysqld`/`tsx watch` بعدِ تست متوقف شدند — محیط به همون حالتِ قبل از این نشست برگشت.

## کارِ بازِ صریح (خارج از دامنه‌ی این مرحله — هنوز پیاده نشده)
- **بخش C** (رونویسیِ صدایِ آفلاینِ بعدِ پایانِ جلسه با `late-transcript` + برچسب).
- **بخش D — باقی‌مانده:** چرخشِ `DURABLE_ROTATE_MS` به ۱۵ ثانیه، `beforeunload`/`pagehide`،
  `startQueueUploader` (آپلودِ دوره‌ای/`online`)، `track.onended`، شمارشِ بایتِ IndexedDB با cursor.
- **بخش E — باقی‌مانده:** فوروارد کردنِ mimeِ واقعیِ کلاینت (الان همیشه `audio/webm` هاردکد در
  فراخوانی‌هایِ `archiveAudioForAdmin`).
- **بخش F** (پنلِ ادمین: فایلِ کاملِ چسبیده‌شده به‌جایِ سگمنت‌ها).
- **تستِ مرورگریِ واقعی** (offline/online با DevTools emulation، رفرشِ وسطِ جلسه با میکروفونِ
  شبیه‌سازی‌شده) هنوز انجام نشده — این مرحله فقط مسیرِ سرور را با curl/MySQL/Soniوxِ واقعی تست کرد،
  نه کلاینتِ `feelia-rt.js` را در مرورگرِ واقعی.

## نتیجه‌گیریِ صادقانه
بخشِ A+B این‌بار **رویِ زیرساختِ کاملاً واقعی** (MySQLِ لوکالِ واقعی با دیتایِ واقعیِ مالک، Soniوxِ
واقعی، curl به سرورِ واقعی) تست شد — نه فقط typecheck. هر ۵ سناریویِ کلیدیِ پلن (seq-collision بینِ
runها، idempotencyِ sha256، race زیرِ قفل، آرشیو-قبل-از-رونویسیِ Soniوxِ واقعی، سکوت=موفقیت) دقیقاً
طبقِ طراحی کار کردند و **هیچ رگرسیونی** در تست‌هایِ موجود (`tsc`، `pnpm test:rt`) دیده نشد. دیتای
canary و فرآیندهایِ کمکی کاملاً پاکسازی شدند. آنچه هنوز باقی‌ست: تستِ مرورگریِ واقعیِ کلاینت، و
بخش‌هایِ C/D-باقی/E-باقی/F که اصلاً پیاده نشده‌اند.
