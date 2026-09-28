# 2026-09-28 — پیاده‌سازیِ پلنِ B «کیفیتِ فایلِ آپلودی» + رفعِ یافته‌هایِ فاز ۰B

> Evidence (مشاهده در همین زمان). مبنا: [فاز ۰B](2026-09-28-upload-audio-quality-phase0b.md). سندِ canonical: [subsystem 06 §۱۰](../docs/07-subsystems/06-audio-upload-pipeline.md)، [subsystem 07](../docs/07-subsystems/07-final-transcript.md).
> دستورِ مالک: «همه‌ی چالش‌ها را عمیق و دقیق حل و رفع کن». commit/deploy انجام نشده. migration 033 رویِ هیچ DBای اعمال نشده.

## چه ساخته شد
| چالش (از فاز ۰B) | رفع | کد |
|---|---|---|
| سرور هیچ سنجشی رویِ فایل نداشت | سنجشِ fail-open پیش از آرشیو، آستانه‌هایِ فاز ۰B (`too_quiet` −60؛ سهمِ ≥۳۰٪ پنجره‌ها) | `audio-upload/quality.ts` (جدید)، `jobMachine.ts` |
| آستانه‌هایِ زنده رویِ فایل مثبتِ کاذب داشتند | flagها فقط «علتِ احتمالی»؛ هرگز به‌تنهایی هشدار/اعلان | `quality.ts`، `index.html#jobQualityHtml` |
| متنِ خراب «متن آماده است» تحویل می‌شد | confidenceِ Soniox (تنها پیش‌بینی‌کننده) ⇒ `quality_warning=low_confidence` + اعلانِ `transcript_low_quality` + بنرِ زرد؛ متن در هر حال ذخیره (LAW-008) | `asyncTranscribe.lowConfidenceRatio`، `jobMachine.qualityWarningFor`، `jobRunner.applyTranscriptOnce`، `notify.ts` |
| «کم‌بازده» (نویسه/دقیقه) کار نمی‌کرد | حذف؛ جایگزین با confidence | — |
| polish رویِ متنِ خراب هیچ `⟦…؟⟧`ای نزد | علامت‌گذاریِ قطعیِ واژه‌هایِ کم‌اطمینان در ورودیِ polish (هر دو مسیرِ آپلود و صدایِ آرشیو) + نگهبانِ `uncertain` + پرامپت | `asyncTranscribe.markedTextFromTokens`، `polishGuards.ts`، `prompts.ts`، `final-transcript/runner.ts` |
| نگهبانی برایِ نقش نبود | نقشِ بیرون از فهرستِ حاضرین ⇒ نقشِ نگاشت‌شده/قبلی (`role_fixes`)؛ «نقشِ مجاز ولی غلط» همچنان بی‌نگهبان (R20) | `polishTranscript.ts` |
| هیچ فیلتری gate را رد نکرد | B-۲ ساخته نشد (بدونِ `filters`/`enhanced_path`/`UPLOAD_AUDIO_ENHANCE`) | — |
| 402ِ OpenRouter دائمی حساب می‌شد (متنِ نهایی بی‌برگشت failed) | 402 گذرا (مشترک با پرونده؛ تلاش‌ها سقف دارند) | `case-file/adapters/llm/chatJson.ts` |
| JSONِ نامعتبر پس از ۲۵۹ث در گذرِ برداشتِ کلی ⇒ failedِ دائمی | در این گذر گذرا (retry)؛ در گذرِ تکه همان تکه خام | `polishTranscript.ts` |
| **یافته‌ی تازه:** برچسبِ `[متنِ فایلِ صوتیِ آپلودشده]` با «\n» به نوبتِ بعد می‌چسبید ⇒ برچسبِ گوینده‌ی آن نوبت گم و خودِ برچسب به دستِ LLM | برچسب نشانگرِ دست‌نخورده شد | `transcriptText.parseTurns` |
| **یافته‌ی تازه:** متنِ نهاییِ جلسه‌ی الحاقی فقط بخشِ آپلودی را داشت و بخشِ قبلی را پنهان می‌کرد | کلِ متن + شماره‌ی گوینده‌هایِ جدا برایِ بخشِ آپلودی | `transcriptText.appendUploadForPolish`، `jobRunner.ts` |
| **اصلاحِ پلن:** «signها به متنِ آپلودی داده شوند» | عمداً انجام نشد: offsetِ علامت نسبت به صدایِ جلسه‌ی زنده است، نه فایلِ آپلودی، و علائم از قبل در بخشِ زنده‌اند (درج ⇒ تکراری و در جایِ غلط) | — |
| راهنمایی در مودالِ آپلود نبود | یک خط (بدترین حالت در فاز ۰B: گفت‌وگویِ دیگران/تلویزیون) | `index.html` |

داده: migration `033_upload_audio_quality.sql` (`audio_quality` JSON، `quality_warning`، `low_conf_ratio`). API: `AudioJobView.quality_flags/quality_warning`. env: `UPLOAD_LOW_CONF_RATIO` (۰٫۰۸)، `TRANSCRIPT_UNCERTAIN_CONFIDENCE` (۰٫۵). Clarity: `upload_quality_warned` (بدونِ پارامتر). obs: `audio_job.quality_flags`، `audio_job.low_confidence`، `role_fixes` در `final_transcript.done` (allowlistِ `redact.ts`).

## تست‌ها
| دستور | نتیجه |
|---|---|
| `cd server && npx tsc --noEmit` | ✅ exit 0 |
| `pnpm test:up` | ✅ **52/52** (۴۱ قبلی + H41–H51) |
| `pnpm test:ft` | ✅ **41/41** (۳۳ قبلی + B1–B8) |
| `pnpm test:cf` | ✅ 110/110 |
| `pnpm test:tu` | ✅ 17/17 |
| `pnpm test:rt` | ✅ 100 PASS، ۰ FAIL |

H50 (ffmpegِ واقعی، مسیرِ واقعیِ `normalizeAudio ⇒ measureAudioQuality`، ۱۰۰ث): تمیز + نویزِ اتاق، −40dB، mp3ِ ۳۲k و ۸kHz μ-law ⇒ **بدونِ flag**؛ −50dB ⇒ `too_quiet`؛ +30dB ⇒ `clipping`؛ SNR −5 ⇒ `noisy`. H51: فایلِ خراب/ناموجود/playlist ⇒ `null` بدونِ throw. H45: سکوتِ یک پنجره از چهار (مکثِ عادیِ جلسه) flag نمی‌سازد؛ تکه‌بندیِ ورودی نتیجه را عوض نمی‌کند.

**اولین اجرایِ H50 FAIL شد** — خطا در خودِ fixture بود (ویرگولِ داخلِ عبارتِ `aevalsrc` در filtergraph باید `\,` باشد)، نه در کد؛ رفع و PASS.

## UI (mock، بدونِ حساب؛ `mock-quality.cjs` در scratchpad، public/ِ واقعی)
- `low_confidence` + `noisy`: کارت در سینی ⇒ پیامِ «متن ذخیره شد، ولی بخش‌هایی از صدا واضح نبود.» + بنرِ زرد + علت؛ اعلان با آیکونِ هشدار و متنِ `transcript_low_quality`؛ رویدادِ Clarity یک بار برایِ `j1`.
- فقط `noisy`: بدونِ بنر، «نکته برایِ ضبطِ بعدی» خاکستری.
- صفحه‌ی جلسه در ۳۷۵px: بنر درست، بدونِ اسکرولِ افقی (`scrollWidth = 375`). کنسول بدونِ خطا.
- حالتِ بدونِ flag: پنل مثلِ قبل (رفتارِ موجود برایِ `case_file_status='disabled'`) — رگرسیون نیست.

## E2E رویِ MySQLِ dev (پیوست، همان روز — با اجازه‌ی صریحِ مالک)
- **migration 033 رویِ dev اعمال شد.** پیش‌شرطِ اسکریپت: تنها migrationِ اعمال‌نشده 033 باشد. ستون‌ها: `audio_quality` json، `quality_warning` varchar، `low_conf_ratio` decimal.
- **روش:**
  - درمانگرِ canary (رمزِ غیرقابلِ‌استفاده، ایمیلِ `.invalid`، `final_transcript_enabled=1`) + مراجعِ canary.
  - آپلودِ **از مسیرِ واقعیِ API** (`app.inject`: init ⇒ chunk ⇒ complete)، سپس **workerهایِ واقعی** (`startAudioJobWorker` و `startFinalTranscriptWorker` با productionDeps: ffmpeg، Soniox، MySQL، OpenRouter).
  - پیش‌شرطِ اجرا: هیچ jobِ فعالِ دیگری در DBِ dev نباشد. سرورِ dev در حالِ اجرا نبود.
  - ۴ فایلِ ساختگی از فاز ۰B: `babble0`، `quiet50`، `clean`، و `room` به‌عنوانِ «الحاقی» (جلسه پیش از ثبتِ متن متنِ قبلی داشت).
- **نتیجه: ۳۸/۴۰ PASS.** jobهایِ صوتی در ۲۱ث تمام شدند.

| مورد | flag | هشدار (low_conf_ratio) | اعلان | ⟦…؟⟧ در ورودیِ polish | متنِ نهایی |
|---|---|---|---|---|---|
| babble0 | `noisy` | `low_confidence` (۰٫۱۱۵۱) | `transcript_low_quality` | ۲۲ | done، **uncertain=22 (همه حفظ شدند)**، fallback 0 |
| quiet50 | `too_quiet` | — (۰٫۰۱۴۸) | `transcript_ready` | ۰ | done |
| clean | — | — (۰٫۰۱۶۵) | `transcript_ready` | ۰ | done |
| الحاقی | — | — (۰٫۰۱۴۸) | `transcript_ready` | ۰ | done؛ ورودی = متنِ قبلی + برچسب + گوینده‌هایِ ۴،۵،۶ (بعد از ۳) |

- **در هر ۴ مورد:**
  - `sessions.transcript` بدونِ `⟦`
  - API `GET /api/sessions/:id/audio-job` فیلدهایِ درست را برگرداند و سنجه‌هایِ عددی را افشا نکرد
  - ردیفِ `final_transcripts` با `source=async` ساخته شد
  - متنِ ذخیره‌شده‌ی الحاقی با قالبِ قبلی یکسان ماند
- **۲ FAIL — زمان‌بندیِ خودِ تست، نه کد:**
  - چه دیده شد: «Soniox refs cleaned» برایِ quiet50 و الحاقی، شناسه‌ها را هنوز رویِ ردیف دید.
  - علت: `applyTranscriptOnce` در همان تراکنش `stage='done'` را commit می‌کند و `cleanupRemote` بلافاصله بعد از آن اجرا می‌شود. تست ردیف را در همین فاصله خواند.
  - شواهدِ پاک‌شدن: `collectUploadSonioxRefs` در پایان (پیش از حذف) **۰** برگرداند. فهرستِ read-onlyِ حسابِ Soniox هم برایِ یک ساعتِ اخیر **۰ فایل و ۰ transcription** از مسیرهایِ `upload` و `final-transcript` نشان داد.
  - اگر پروسه دقیقاً در همین فاصله بمیرد، `sweepSonioxOrphans` (A4) منابعِ jobِ done را برمی‌دارد.
- **OpenRouter این بار پاسخ داد**، پس مسیرِ «402 ⇒ گذرا» در E2E دیده نشد (فقط هارنسِ H49). FINDINGِ 402 در dev دیگر بازتولید نمی‌شود. وضعیتِ prod بررسی نشد.
- **پاک‌سازی:** ۴ پوشه‌ی آرشیو حذف شد. `DELETE FROM therapists` (cascade) ⇒ ۰ ردیف در clients/audio_jobs/final_transcripts/notifications/audio_uploads. اسکریپت‌هایِ موقت (`server/e2e-tmp/`) حذف شدند.

## پیوستِ ۲ — رفعِ مشکلاتِ باقی‌مانده (همان روز، دستورِ مالک: «مشکلات را حل کن»)
1. **ریشه‌ی 402ِ OpenRouter پیدا و رفع شد.**
   - متنِ خطا: «402 This request requires more credits, or fewer max_tokens. You requested up to 131072 tokens, but can only afford 47064».
   - علت: درخواست‌ها `max_tokens` نداشتند، پس OpenRouter سقفِ کاملِ مدل را از اعتبار رزرو می‌کرد.
   - رفع:
     - `FINAL_TRANSCRIPT_MAX_TOKENS` (۱۶۳۸۴؛ برایِ OpenAI `max_completion_tokens`)
     - `CASE_FILE_MAX_TOKENS` (۳۲۷۶۸، فقط OpenRouter)
   - پس از رفع، ۸ فراخوانیِ polishِ واقعی با همان اعتبارِ کم موفق شدند.
   - همان خطا در لاگ `transient: true` بود، پس دسته‌بندیِ گذرا در عمل تأیید شد.
2. **نگهبانِ «نقشِ مجاز ولی غلط»:**
   - فقط برایِ متنِ asyncِ تک‌گذر و تفکیکِ ادغام‌نشده فعال است. طراحیِ اول (بدونِ شرطِ async) در متنِ realtime که با هر reconnect شماره‌گذاری را از نو شروع می‌کند، اصلاحِ درستِ LLM را برمی‌گرداند. همان‌جا اصلاح شد.
   - هارنس: B9–B12.
   - LLMِ واقعی رویِ ۴ متنِ asyncِ فاز ۰ (conv3، conv3hard، conv2w، convind):
     - بدونِ نگهبان: دقتِ نقش ۱۰۰/۱۰۰/۱۰۰/۱۰۰
     - با نگهبان: ۱۰۰/۱۰۰/۱۰۰/۱۰۰، و ۰ برگشت (بی‌ضرر)
3. **FAILِ زمان‌بندیِ E2E:** در E2Eِ UI بررسی با انتظار انجام شد ⇒ PASS (refs=0).
4. **UI با سرور و DBِ واقعی (قبلاً فقط mock):**
   - محیط: سرورِ واقعی رویِ پورتِ 3100، MySQLِ dev، workerهایِ خودِ سرور (Soniox، ffmpeg، OpenRouter)، و Chromeِ headless با CDP در عرضِ ۴۲۰px. کوکیِ نشستِ canary مستقیم ست شد و هیچ رمزی وارد نشد.
   - نتیجه: **۱۰/۱۰ PASS**
     - سینی: یک بنرِ هشدار (babble0)، اعلانِ `transcript_low_quality` با آیکونِ هشدار، و کارتِ عادی برایِ clean
     - صفحه‌ی جلسه: پنلِ هشدار، و ۲۴ span ِ «نامطمئن» در متنِ نهایی (همان ۲۴ علامتِ ورودی)
     - «نمایشِ متنِ خام» بدونِ علامت
     - بدونِ اسکرولِ افقی و بدونِ خطایِ کنسول
   - پاک‌سازی: ۰ ردیفِ باقی‌مانده، اسکریپت‌ها و پروفایلِ Chrome حذف شدند.
5. **یافته‌ی UI از همان E2E:** «؟»ِ نشانگر داخلِ span دیده می‌شد (مثلاً «حرف و حواس‌پرتی؟») و شبیهِ سؤال خوانده می‌شد. حالا فقط «؟»ِ پایانیِ نشانگر حذف می‌شود و علامتِ سؤالِ واقعیِ بیرونِ span می‌ماند. در مرورگر با `ftFillBox` تأیید شد.
- هارنس‌ها پس از همه‌ی تغییرها: tsc ✅، `test:ft` 45/45، `test:up` 52/52، `test:cf` 110/110.

## انجام‌نشده (صادقانه)
- وضعیتِ اعتبار/کلیدِ OpenRouterِ **prod** بررسی نشد: اجرایِ دستور رویِ production اجازه‌ی جدا لازم دارد.
- migration 033 رویِ **prod** اعمال نشده. کدِ جدید بدونِ آن در SQL خطا می‌دهد، پس deploy باید همراهِ 033 باشد (startup migrationها را اعمال می‌کند).
- آستانه‌ها از دادهٔ ساختگی‌اند (R20).
- UIِ واقعی با DB (Chromeِ headless) اجرا نشد؛ UI فقط رویِ mock و API رویِ DBِ واقعی تست شد.
