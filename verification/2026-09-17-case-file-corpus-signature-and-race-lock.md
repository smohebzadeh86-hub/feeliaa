# 2026-09-17 — رفعِ توکن‌سوزیِ الکی + race + گاردِ سمت-سرورِ force در AI Case File

## دامنه
پیاده‌سازیِ پلنی که مالک در چت داد (سه باگ در مسیرِ regenerate پرونده‌ی روندِ درمان):
۱) نبودِ چکِ «داده‌ی جدید» قبل از هر فراخوانیِ LLM، ۲) race بینِ دو درخواستِ هم‌زمانِ
regenerate، ۳) گاردِ `force` فقط سمتِ کلاینت.

## تغییرات
- migration جدید `019_case_file_corpus_signature.sql`: دو ستونِ `corpus_signature`
  و `generating_started_at` روی `client_case_file` (دو `ALTER TABLE` جدا، هم‌الگو با
  migrationِ 017، برایِ سازگاری با idempotencyِ errno-1060).
- `schema.sql` هم‌گام شد.
- `aggregateClientCorpus.ts`: یک کوئریِ سبکِ اضافه برایِ ساختِ `corpusSignature`
  (`sessionCount:latestSessionId:noteCount:latestSessionUpdate:latestNoteCreated`).
- `generateCaseFile.ts`: قبل از `markGenerating` — (الف) اگر رکوردِ قبلی `generating`
  و کمتر از ۳ دقیقه از `generatingStartedAt` گذشته → پرتابِ `CaseFileGenerationError('busy', …)`؛
  (ب) اگر `!force` و امضایِ کورپوس با رکوردِ `ready`ِ قبلی یکسان بود → بدونِ فراخوانیِ LLM
  برگرداندنِ `{record: previous, skipped: true}`. امضایِ moved قبل از `markGenerating` چون
  خودِ چک نیاز به aggregate دارد.
- `caseFileRepo.port.ts` / `caseFileRepository.sql.ts`: فیلدهایِ `corpusSignature`،
  `generatingStartedAt` در خواندن/نوشتن؛ `markGenerating` مقدارِ `NOW()` را در
  `generating_started_at` می‌نویسد.
- `caseFile.routes.ts`: کدِ خطایِ `busy` → HTTP 409؛ وقتی `force:true` است، `confirmPhrase`
  را از بدنه می‌خواهد و اگر برابرِ «بازتولید کامل» نبود → 400 (گاردِ سمتِ سرور، نه فقط UI).
- `public/index.html` `regenerateCaseFile()`: مقدارِ تایپ‌شده از `prompt()` را به‌عنوانِ
  `confirmPhrase` ارسال می‌کند؛ پیامِ متفاوت برایِ `data.skipped`.
- `errors.ts`: کدِ `'busy'` به union اضافه شد.

## تست / تأیید — بخشِ اول (همان نشست، قبل از آزاد شدنِ DB)

- **`cd server && npx tsc --noEmit`** → بدونِ خروجی، سبز.
- end-to-endِ زنده رویِ DB انجام نشد چون نشستِ دیگری همان لحظه از سرورِ dev/DBِ standalone
  استفاده می‌کرد (جزئیات در نسخه‌ی قبلیِ همین بخش، در تاریخچه‌ی گیت).

## تست / تأیید — بخشِ دوم (بعدِ دستورِ صریحِ مالک «DB آزاد شد»، همان روز)

- **Migration 019 از قبل apply شده بود** — چون سرورِ dev با `tsx watch` اجرا می‌شود و
  ذخیره‌ی فایل‌هایِ `.ts` (در دورِ اول همین کار) باعثِ ری‌استارتِ خودکار و اجرایِ
  `runMigrations()` شده بود. تأیید مستقیم رویِ DB:
  `SELECT name, applied_at FROM _migrations` → `019_case_file_corpus_signature.sql` در
  `2026-09-17T10:45:32Z`؛ `DESCRIBE client_case_file` هر دو ستونِ `corpus_signature` و
  `generating_started_at` را نشان داد.
- **end-to-endِ واقعی رویِ سرورِ درحالِ اجرا (پورت 3000) + MySQLِ standaloneِ لوکال + OpenRouترِ
  واقعی**، با یک اسکریپتِ HTTPِ خودکار (ثبت‌نامِ تراپیستِ canary → مراجعِ `inactive` →
  جلسه‌ی دستی با یادداشتِ synthetic)، همه‌ی ۵ سناریو تأیید شدند:

  | سناریو | نتیجه |
  |---|---|
  | اولین `regenerate` (بدونِ رکوردِ قبلی) | ✅ 200، `skipped:false`، فراخوانیِ واقعیِ OpenRouter، `corpusSignature` ذخیره شد |
  | `regenerate` دوباره بدونِ داده‌ی جدید | ✅ 200، `skipped:true`، `corpusSignature` بدونِ تغییر — **بدونِ فراخوانیِ LLM** (اصلِ درخواستِ مالک) |
  | یادداشتِ جدید روی همون جلسه + `regenerate` | ✅ `corpusSignature` عوض شد، `skipped:false`، تولیدِ واقعیِ جدید |
  | دو `regenerate(force:true)` تقریباً هم‌زمان (`Promise.all`) | ✅ یکی 200، دیگری **409 `{code:"busy"}`** |
  | `regenerate(force:true)` با `confirmPhrase` غلط | ✅ **400** بدونِ فراخوانیِ LLM |

  خروجیِ کاملِ اجرا (پاسخ‌هایِ خامِ API) در لاگِ اجرایِ اسکریپت ضبط شد؛ اسکریپت در
  scratchpadِ نشست بود (خارج از repo).
- **پاک‌سازیِ canary:** `DELETE FROM therapists WHERE id=...` (cascade تا clients/sessions
  /session_notes/client_case_file) برایِ هر دو therapistِ canaryِ ساخته‌شده در این تست
  (یکی از تلاشِ اولِ ناموفق که فقط ثبت‌نام شده بود، یکی از اجرایِ کاملِ موفق). تأییدِ نهایی
  با `SELECT COUNT(*)` رویِ هر ۵ جدول: فقط دیتایِ از‌پیش‌موجودِ حسابِ واقعیِ مالک
  (`09944113233`، ۲ مراجع/۳ جلسه/۴ یادداشت/۱ case_file) باقی ماند — صفر ردیفِ canary.

## کارِ باز
- کیفیتِ محتواییِ خروجیِ LLM (نه صحتِ فنیِ pipeline) رویِ یادداشتِ کوتاهِ synthetic
  ارزیابیِ عمیق نشد.
- Apply کردنِ migration 019 روی production (به دستورِ صریحِ مالک، طبقِ LAW-006/LAW-022 —
  این نشست خودش deploy نمی‌کند؛ فقط لوکال apply/تست شد).
