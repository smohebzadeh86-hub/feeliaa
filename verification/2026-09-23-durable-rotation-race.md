# 2026-09-23 — race چرخشِ durable (سگمنت‌های بی‌هدر) + intentِ معکوسِ مرزهای قطعی

> Evidence (مشاهده در همین تاریخ). وضعیت: commit در `3e732b1`، push، و **deploy به production (`50c0fe7`)**.

## زمینه
جلسه‌ی واقعی `aebef3b8-7910-493f-bf47-d50277ba951c`: چند سگمنت (مثلاً `000005.webm`) را هم ffmpeg
(`Invalid data found`) و هم Soniox async (`Invalid audio file`) رد کردند؛ این فایل‌ها با purpose=`transcript`
در `data/batch-queue` مانده بودند و worker هر ۵ دقیقه دوباره امتحانشان می‌کرد.

## مرحله‌ی ۰ — تأییدِ روی سرور (پیش از deploy، read-only)
صفِ batch: `…-000000-….webm` 125 بایت `8c8100b4` و `…-000002-….webm` 1779 بایت `43b67501` (بی‌هدر). آرشیو:
`000003.webm` 29137 بایت `1a45dfa3` (سالم)، `000004`/`000005` همان دو دُم. **فرضیه تأیید شد.**

## پس از deploy (`50c0fe7`)
لاگِ اولین دورِ worker: هر دو فایل `reason=bad-container` از صف خارج شدند، `remaining=0`؛ صف خالی؛ health `ok`.

## مرحله‌ی ۱ — بازتولید در Chromeِ واقعی (Browser pane)
صفحه‌ی مستقل در scratchpad (سرورِ استاتیکِ موقتِ `python -m http.server`؛ نه در `public/`) که
**`public/feelia-rt.js`ِ واقعی** را لود و با stream ساختگیِ `AudioContext` (oscillator →
`MediaStreamDestination`، بدونِ میکروفون/دادهٔ واقعی) الگویِ callerها را اجرا کرد:
`startDurable` → ۳.۵s → `stopDurableSegment(); startDurable(); state=RECONNECTING` → ۳.۵s →
`stopDurableSegment(); startDurable(); state=ACTIVE` → ۳.۵s → `state=FINALIZING; await stopDurableSegment()`.
سپس رکوردهایِ IndexedDB (`feelia-audio/segments`) خوانده شدند. mime: `audio/webm;codecs=opus`.

| | seq | bytes | ۴ بایتِ اول | intent | انتظار |
|---|---|---|---|---|---|
| **پیش از رفع** | 0 | 1487 | `40b78101` | transcript | ~10KB، `1a45dfa3`، archive |
| | 1 | 1503 | `40b78103` | archive | ~10KB، `1a45dfa3`، transcript |
| | 2 | 10997 | `1a45dfa3` | archive | ✓ (سگمنتِ finish) |
| **بعد از رفع** | 0 | 10067 | `1a45dfa3` | archive | ✓ |
| | 1 | 10997 | `1a45dfa3` | transcript | ✓ |
| | 2 | 10997 | `1a45dfa3` | archive | ✓ |

فرضیه در مرورگرِ واقعی ثابت شد: سگمنت‌هایِ بسته‌شده با «stop و بلافاصله start» فقط دُمِ بی‌هدرِ
~۱.۵KB بودند و intentِ هر دو مرز برعکس بود؛ سگمنتِ finish (که پس از آن ضبطِ تازه‌ای شروع نمی‌شود) سالم بود.

## مرحله‌ی ۴ — harness (`pnpm test:rt`)
`FakeRecorder` واقع‌گرا شد (اولین chunk با `HDR`، `stop()` → `TAIL` + `onstop` در `setTimeout(0)`).
تستِ تازه‌ی `T20` (a, a2, b, c, d). اجرایِ همان harness رویِ نسخه‌ی پیش از رفع (کپیِ scratchpad):

```
FAIL T18 exactly one segment uploaded as purpose=transcript (the outage segment)
FAIL T20a2 one stored segment per durable recorder (no body lost) — segments=5 durableRecorders=8
FAIL T20b segments closed while ACTIVE (rotation + entering outage) → archive
FAIL T20c outage segment closed on recovery (RECONNECTING at stop) → transcript, exactly one
FAIL T20d final segment → archive, seqs contiguous from 0
```
بعد از رفع: **49/49 PASS**، exit 0. (`T18`ِ موجود با FakeRecorderِ همگامِ قبلی تصادفاً سبز بود.)

یادداشتِ harness: `FakeWS.close()` رویدادِ `onclose` را همگام صدا می‌زند و در `scheduleReconnect`
بازگشتی چند سگمنتِ کوتاهِ اضافی در ACTIVE می‌سازد — artifactِ harness است (مرورگر close را ناهمگام
فایر می‌کند)؛ `T20` مستقل از تعدادِ دقیقِ سگمنت نوشته شد. FakeWS تغییر نکرد.

## مرحله‌ی ۳ — سرور
- `cd server && npx tsc --noEmit` → exit 0.
- `looksLikeValidContainer`/`isPermanentTranscribeError` با اجرایِ مستقیمِ متنِ تابع:
  `{"webm_ok":true,"webm_tail":false,"ogg_ok":true,"m4a_ok":true,"tiny":false,"perm":true,"transient":false}`
  (`webm_tail` = دقیقاً هدرِ `40b78101` مشاهده‌شده در مرحله‌ی ۱).
- **اجرایِ واقعیِ `enqueueBatch` → `processBatchQueue` با MySQLِ لوکال + Sonioxِ واقعی** (اسکریپتِ
  scratchpad با cwdِ ایزوله، پس `server/data/` دست نخورد؛ رویِ جلسه‌ی QA canaryِ موجود
  `fb60e450-…`، بدونِ دادهٔ واقعیِ مراجع):

| سناریو | ورودی | نتیجه |
|---|---|---|
| A | دُمِ بی‌هدر، ۱۴۸۷ بایت، `40b78101` | Soniox صدا زده **نشد**؛ `reason=bad-container`؛ فایل از صف خارج؛ `batch_status` queued→**done**؛ آرشیو ماند (`session_audio` ۱۴۸۷ بایت، `duration_ms=NULL` — ffmpeg دقیقاً همان «Invalid data found» ِ production را داد) |
| B | `1a45dfa3` + بدنه‌ی تصادفی، ۴۰۰۴ بایت | Soniox واقعاً رد کرد → `reason=soniox-invalid-audio`؛ از صف خارج؛ done |
| C | webm/opusِ سالم (ffmpeg، سینوسِ ۳ث) | مسیرِ عادی: نتیجه‌ی خالی = موفق، فایل حذف، done — بدونِ رگرسیون |
| D | همان webmِ سالم با کلیدِ نامعتبر (401) | خطایِ **موقت** → فایل در صف **ماند**، `batch_status=queued` (رفتارِ قبلی حفظ شد) |

  رویدادهایِ `obs_events` (`batch.segment_unrecoverable` با severity=warn و detailِ `{purpose,seq,bytes,reason}`)
  در DB تأیید شدند. پس از D، صفِ canary با کلیدِ درست تخلیه شد (`batch_status=done`). ردیف‌هایِ
  `session_audio`ِ تست (`run_id=bqtest`) رویِ جلسه‌ی canary در DBِ لوکال باقی ماندند (طبقِ رویه حذف نشدند).
- انتظار پس از deploy: دو فایلِ گیرکرده‌ی `aebef3b8` در اولین دورِ worker با
  `batch.segment_unrecoverable reason=bad-container` از صف خارج و `batch_status=done` شوند.
- **تست نشده:** جلسه‌ی end-to-endِ واقعی در اپ (ورود + Sonioxِ زنده بیش از ۱۵ثانیه) — رمزِ حسابِ canary
  در دست نیست و ساختِ حسابِ تازه بدونِ مجوز ممنوع است؛ موتورِ واقعی جداگانه در Chrome (مرحله‌ی ۱) تأیید شد.

## سایر
- `pnpm test:cf` → 108 PASS / 0 FAIL.
- entryِ موقتِ `rt-repro` در `.claude/launch.json` بعد از تست حذف شد.
