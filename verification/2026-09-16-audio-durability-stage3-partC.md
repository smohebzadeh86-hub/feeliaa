# Verification — audit صدا، مرحله‌ی ۳ (بخشِ C: رونویسیِ آفلاینِ برچسب‌دارِ late-transcript) — 2026-09-16

## دامنه
بخشِ **C** از پلنِ `SONIOX.md` (یافته‌های ۵، ۶ — تصمیمِ صریحِ مالک): صدایِ آفلاینی که *بعدِ*
پایانِ جلسه به صفِ کلاینت می‌رسد، دیگر فقط بی‌صدا آرشیو نمی‌شود — رونویسی و با برچسبِ صریح به
انتهایِ متنِ جلسه append می‌شود. همچنین یک باگِ واقعی از مرحله‌ی قبل (نه بخشِ C) هنگامِ کار
پیدا و رفع شد.

## تغییرات

### سرور
- `BatchPurpose` یک عضوِ جدید گرفت: `'late-transcript'` — مارکِ فایلِ جداگانه (`.late.`) تا
  workerِ retry (که purpose را از رویِ نامِ فایل حدس می‌زند) آن را با `'transcript'`ِ ساده
  اشتباه نگیرد.
- `mergeBatchTranscript` پارامترِ اختیاریِ `label` گرفت — اگر بدهی، قبل از متنِ append‌شده
  (نه کلِ transcript) می‌آید: `[بخشِ ضبط‌شده در زمانِ قطعیِ اینترنت — بعداً رونویسی شد]`.
- `POST /api/sessions/:id/batch-audio?purpose=late-transcript` رویِ جلسه‌ی **completed مجاز**
  است (بر خلافِ `purpose=transcript` که همچنان ۴۰۰ می‌دهد)؛ رویِ **canceled مسدود** است («جلسه
  لغو شده است»).
- `batch-retry`/`batch-status` از `late-transcript` پشتیبانی می‌کنند (`late_transcript_pending`).
- بقیه‌ی رفتارهایِ بخشِ B (آرشیو-قبل-از-رونویسی، idempotencyِ sha256، قفلِ per-session، سکوت=
  موفقیت) بدونِ تغییر برایِ late-transcript هم اعمال می‌شوند (کدِ مشترک).

### کلاینت (`feelia-rt.js`)
- هر رکوردِ IndexedDB حالا فیلدِ `intent` دارد (`'archive'|'transcript'|'note'`) — **در لحظه‌ی
  بستنِ سگمنت** تعیین می‌شود (نه بعداً در لحظه‌ی آپلود حدس زده شود): یادداشتِ صوتی همیشه
  `'note'`؛ اگر `self.unreliable` یا state ∈ {RECONNECTING, NETWORK_PAUSED, FAILED} →
  `'transcript'`؛ وگرنه `'archive'`.
- تابعِ مشترکِ جدیدِ `uploadQueuedSegment(sessionId, rec)`: از رویِ `rec.intent` تصمیم می‌گیرد
  چه purposeای بفرستد؛ اگر `purpose=transcript` با ۴۰۰ رد شد (جلسه completed شده)، **خودکار
  دوباره با `purpose=late-transcript` تلاش می‌کند** — به‌جایِ افتادن به آرشیوِ بی‌صدا.
  `uploadBatchSegments`، `drainQueuedAudioInBackground`، `archiveQueuedAudioOnly`، و
  `sweepOrphanedAudioQueue`ِ `index.html` همگی از همین یک تابع استفاده می‌کنند (رفعِ حدسِ
  purpose جدا-جدا و ناهماهنگ در هر تابع).
- `sweepOrphanedAudioQueue` سگمنت‌هایِ جلسه‌ای را که در `localStorage.feelia_active_session`
  است رد می‌کند — مالکِ آن صف همون RTSessionِ resume‌شونده است.
- **باگِ واقعیِ پیدا‌شده حینِ کار (نه بخشِ C — از مرحله‌ی ۱):** `AudioQueueDB.clearForSession`
  (صدا‌زده‌شده از `abort()`) هنوز با امضایِ قدیمیِ ۲-آرگومانیِ `remove(sessionId, seq)` صدا
  می‌شد، درحالی‌که `remove` در مرحله‌ی ۱ به امضایِ تک-آرگومانیِ `remove(id)` تغییر کرده بود —
  یعنی لغوِ یک جلسه دیگر صفِ محلی‌اش را درست پاک نمی‌کرد (کلیدِ اشتباه حذف می‌شد). با
  `remove(r.id)` رفع شد.

## تست‌هایِ استاتیک
| تست | نتیجه |
|---|---|
| `node --check public/feelia-rt.js` | ✅ |
| syntax-checkِ `<script>`هایِ `index.html` | ✅ |
| `cd server && npx tsc --noEmit` | ✅ |
| `pnpm test:rt` | ⚠️ ۲۹ PASS/۶ FAIL — همون baseline، بدونِ رگرسیون |

## تستِ زنده — سرورِ dev واقعی + MySQLِ لوکالِ واقعی + Soniوxِ واقعی + مرورگرِ واقعی
حسابِ canary جدا از حسابِ ادمینِ واقعیِ مالک.

1. **صدایِ واقعیِ TTS** (`System.Speech` ویندوز → ffmpeg به webm/opus) رویِ یک جلسه‌ی
   **completed**:
   - `purpose=transcript` → `400 {"error":"جلسه پایان یافته است"}` (رفتارِ قبلی، دست‌نخورده).
   - `purpose=late-transcript` → `202 queued` → بعدِ رونویسیِ واقعیِ Soniوx:
     ```
     transcript = "[بخشِ ضبط‌شده در زمانِ قطعیِ اینترنت — بعداً رونویسی شد]
     گوینده ۱: This is a test recording for the late transcript feature."
     ```
     دقیقاً برچسبِ صحیح + متنِ درستِ رونویسی‌شده؛ `transcript_version` درست +۱ شد.
   - `session_audio` ردیفِ درست با `run_id`/`duration_ms` ثبت شد؛ صفِ سرور خالی شد.
2. **`purpose=late-transcript` رویِ جلسه‌ی canceled** → `400 {"error":"جلسه لغو شده است"}`.
3. **تستِ مکانیزمِ fallbackِ کلاینت** (مستقیم از کنسولِ مرورگرِ واقعی، `window.FeeliaRT.
   uploadQueuedSegment`): رکوردی با `intent='transcript'` رویِ همون جلسه‌ی completed →
   لاگِ سرور نشان داد دقیقاً همون توالی که کد پیش‌بینی می‌کرد: اول `purpose=transcript`
   (۴۰۰)، بعد خودکار `purpose=late-transcript` (۲۰۲). داده‌ی صوتیِ این تست بایت‌هایِ معتبرِ
   webm نبودند (عمداً، برایِ تستِ مسیرِ خطا) → Soniوxِ واقعی «Invalid audio file» داد →
   `[batch] async transcribe error, kept queued (already archived)` — دقیقاً طبقِ طراحیِ
   بخشِ B: صدا از قبل آرشیو شده بود، فقط رونویسی عقب افتاد، فایل توی صف موند (marker `.late.`).
   `batch-retry?purpose=late-transcript` و `batch-status.late_transcript_pending` هر دو درست
   کار کردند.
4. **تستِ `feelia_active_session` skip:** رکوردی مستقیم در IndexedDB گذاشته شد،
   `localStorage.feelia_active_session` روی همون sessionId ست شد → `sweepOrphanedAudioQueue()`
   رکورد را دست نخورد (هنوز در صف بود). بعدِ حذفِ آن کلید از localStorage، همون sweep دقیقاً
   همان رکورد را آپلود و از صف حذف کرد — رفعِ راهِ برخوردِ sweep/RTSession روی یک sessionId.

## پاکسازی
دو جلسه‌ی canary (کاسکید از `DELETE /api/clients/:id`) + تراپیستِ canary از DB حذف شدند؛
شمارش‌ها دقیقاً به `۱/۱/۱/۰`ِ قبل از تست برگشتند. پوشه‌هایِ آرشیوِ canary و فایل‌هایِ TTSِ
اسکرچ از دیسک پاک شدند (۱۹ پوشه‌ی دیگر دست‌نخورده). IndexedDB و تبِ Browser pane بسته شدند؛
`mysqld`/سرورِ dev متوقف شدند.

## کارِ بازِ صریح
- بقیه‌ی **E** (mimeِ واقعیِ کلاینت به‌جایِ `audio/webm` هاردکد) و **F** (پنلِ ادمین — فایلِ
  کاملِ چسبیده‌شده به‌جایِ سگمنت‌ها) هنوز پیاده نشده‌اند.
- تستِ سناریویِ کاملِ مرورگری با میکروفونِ شبیه‌سازی‌شده که واقعاً آفلاین برود، جلسه از UI
  کامل شود، و بعد آنلاین برگردد (به‌جایِ فراخوانیِ مستقیمِ `uploadQueuedSegment` از کنسول)
  هنوز انجام نشده — این مرحله مکانیزمِ زیرینِ آن را مستقیماً و کامل تست کرد، نه مسیرِ UI.

## نتیجه‌گیری
بخشِ C این‌بار هم رویِ **زیرساختِ کاملاً واقعی** (MySQLِ واقعی، Soniوxِ واقعی، مرورگرِ واقعی)
تست شد. برچسبِ صریح، مجازبودنِ late-transcript روی completed/مسدودبودن روی canceled، fallbackِ
خودکارِ کلاینت، و اسکیپِ sessionِ فعال همگی طبقِ طراحیِ پلن کار کردند. یک باگِ واقعیِ پنهان از
مرحله‌ی قبل هم حینِ کار پیدا و رفع شد. `tsc`/`pnpm test:rt` بدونِ رگرسیون.
