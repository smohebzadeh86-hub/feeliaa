# Subsystem 08 — رکوردِ canonicalِ جلسه (Session Data Engine، فاز ۲ و ۳)

> **وضعیت:** ACTIVE-CANONICAL · ایجاد 2026-10-01 · migrationهای 038، 040، 041، 045.
> **منشأ:** ممیزیِ «Core فیلیا = منبعِ قابل‌اعتمادِ دادهٔ جلسه» (فاز ۲ «دادهٔ خام را نگه داریم» و فاز ۳ «رکوردِ canonical»)؛ تصمیمِ مالک: توکن‌ها بعد از پاکسازیِ صدا بمانند، و **به‌جز متنِ رضایت** همه‌ی موارد اجرا شود.
> **کد:** `server/src/features/session-record/` (`tokens.ts`، `segments.ts`، `rtChunks.ts`، `record.repository.ts`، `record.routes.ts`، `index.ts`) + `public/feelia-rt.js` (`captureRtToken`، `flushRtTokens`، `audioClockMs`) + نقاطِ اتصال: `audio-upload/jobStore.sql.ts`، `final-transcript/runner.ts`، `case-file/application/aggregateClientCorpus.ts`، `admin/export.admin.ts`، `sessions/sessions.routes.ts`.

> last-verified: 2026-10-03 · مالک: [feature-index](../02-reference/feature-index.md) (`session-record`) · قالب: [feature-doc-template](../00-governance/feature-doc-template.md) (LAW-026)

- **مرزها:** `features/session-record/index.ts` صادر می‌کند: `sessionRecordRoutes`، `saveCanonicalRecord` (داخلِ تراکنشِ فراخوان)، `saveCanonicalRecordStandalone`، `canonicalTextForSession`، `exportCanonicalRecord`، `packTokens`/`unpackTokens`، `buildSegments`، `renderCanonicalText`. وابسته به هیچ featureِ دیگر نیست (نوعِ `RecordToken` هم‌شکلِ `TimedToken`).
- **داده:** مالک: `session_transcript_tokens` (038 + ستون‌هایِ 041 + `meta` 045)، `session_segments`، `session_speaker_roles` (041)، `session_rt_token_chunks` (045). جدول‌هایِ فاز ۲ که sessions می‌نویسد: `session_transcript_revisions` (040).
- **تست:** `pnpm test:up` H66–H72 (H71–H72: تکه‌ها و مونتاژِ realtime)؛ `pnpm test:rt` T69 (ارسالِ تکه‌ها از موتورِ زنده)؛ `pnpm test:up` H66–H70 (بسته‌بندی، نوبت‌ها، متنِ canonical، برچسب)؛ `pnpm test:ft` (canonical-only)؛ E2Eِ واقعی رویِ MySQLِ dev: [verification](../../verification/2026-10-01-core-audit-implementation.md).
- **ریسک و بدهی:** داده‌یِ بالینیِ ماندگارِ بیشتر (توکن‌ها بعد از پاکسازیِ ۳۰روزه‌یِ صدا) ⇒ **متنِ رضایت/سیاستِ نگهداری هنوز باید اصلاح شود (R1، LAW-009/010 — عمداً دست‌نخورده به دستورِ مالک)**؛ گذرِ canonicalِ جلسه‌یِ زنده پیش‌فرض خاموش است (هزینه).

## ۱. مدل

```
گذر (pass) = یک ردیف session_transcript_tokens
   ├── tokens_gz       توکن‌هایِ زمان‌دار (gzip JSON v1: [text, start_ms, end_ms, speaker, conf×100])
   ├── source          upload | async | realtime
   ├── covers_full     آیا کلِ صدایِ جلسه را پوشش می‌دهد؟
   ├── source_version  sessions.transcript_version در لحظه‌یِ ثبت (مبنایِ «کهنه‌شدن»)
   └── session_segments (نوبت‌هایِ گوینده: speaker_key، start/end، text، confidence_pct)
session_speaker_roles   نقشِ هر گوینده (therapist|client|member|other + label) — تأییدِ تراپیست، مستقل از گذر
```

- **فقط‌افزودنی:** گذرِ تازه = ردیفِ تازه؛ گذرِ قبلی نمی‌ماند به‌عنوان «جاری» ولی پاک هم نمی‌شود. حذفِ جلسه همه را پاک می‌کند (FK CASCADE).
- **exactly-once:** `UNIQUE(job_id)`؛ برایِ گذرِ live کلیدِ قطعی `deterministicJobId('ft:'+transcriptionId)` (retryِ getText گذرِ تکراری نمی‌سازد).
- **fail-open:** هر خطا در ذخیره فقط لاگ می‌شود؛ ثبتِ متنِ جلسه (LAW-008) هرگز نمی‌افتد.

## ۲. چه چیزی رکورد را می‌سازد

| مسیر | کجا | covers_full |
|---|---|---|
| آپلودِ صدا | `jobStore.sql.ts#applyTranscriptOnce` — داخلِ همان تراکنشِ ثبتِ متن | فقط اگر جلسه پیش از آن متن نداشت (وگرنه گذر فقط بخشِ آپلودی است) |
| جلسه‌یِ زنده (گذرِ async روی صدایِ کاملِ آرشیو) | `final-transcript/runner.ts#getText` (همان رونویسیِ «متنِ نهایی») | بله |
| جلسه‌یِ زنده (توکن‌هایِ خودِ رونویسیِ زنده، بدونِ هزینه) | `buildRealtimeRecord` در پایانِ جلسه (`sessions.routes.ts`، `autoClose.ts`) و پس از تکه‌ی دیررس | **همیشه خیر** (§۲.۱) |

**گذرِ canonicalِ جلسه‌یِ زنده** تا امروز فقط وقتی اجرا می‌شد که درمانگر «متنِ نهایی» را روشن کرده بود. با `CANONICAL_PASS=1` برایِ **هر** جلسه‌یِ زنده‌یِ پایان‌یافته اجرا می‌شود؛ polish (LLM) فقط اگر درمانگر خواسته (`FtDeps.polishWanted`)، وگرنه job با `skipped`/`canonical-only` تمام می‌شود و UI چیزی نشان نمی‌دهد. **پیش‌فرض خاموش**: هزینه‌یِ Soniox تقریباً ۲برابر و صدا دوباره به Soniox می‌رود (باید با متنِ رضایتِ اصلاح‌شده هم‌زمان روشن شود).

### ۲.۱ رکوردِ realtime (2026-10-03، [core-data-plan](../05-plans/core-data-plan-2026-10-03.md) قدمِ ۲)
**چرا:** بدونِ `CANONICAL_PASS` جلسه‌ی زنده (رایج‌ترین مسیر) هیچ رکوردی نداشت ⇒ نوارِ نقش ظاهر نمی‌شد و سنجه‌ای نبود. مرورگر توکن‌هایِ final را با زمان/گوینده/اطمینان از Soniox *دارد*؛ فقط دور ریخته می‌شدند.

- **مرورگر:** هر توکنِ final ⇒ `[text, start_ms+genOffset, end_ms+genOffset, speaker_key, confidence]`. `genOffset` = «زمانِ صدایِ ضبط‌شده» (`audioClockMs`: زمانِ دیواری منهای توقف‌هایِ دستی) در لحظه‌ی شروعِ هر نسلِ اتصال؛ تقریبی (±۱–۲ث). `speaker_key` = `<۵ نویسه‌ی آخرِ runId>-<برچسبِ سراسری>` — همان «گوینده N»ِ متن، یکتا بینِ رفرش‌ها.
- **توکن‌هایِ کنترلی:** `<end>` (endpoint detection) و `<fin>` (finalize)ِ Soniox زمانِ ۰ دارند و واژه نیستند ⇒ در `captureRtToken` و `parseRtChunk` دور ریخته می‌شوند (یافته‌ی E2Eِ 2026-10-04: پایانِ همه‌ی نوبت‌ها برابرِ offset می‌شد).
- **ارسال:** هر تیکِ autosave (۵ث)، در `hidden/pagehide` (keepalive) و در `finish` (تکه‌ی پایانی با `final/reliable/dropped`) به `POST /api/sessions/:id/rt-tokens`. تکه در حالِ ارسال منجمد است ⇒ retryِ گذرا همان محتوا با همان `chunk_seq` (سرور `INSERT IGNORE`)؛ ردِ دائمیِ 4xx ⇒ کنار گذاشته و در `dropped` شمرده می‌شود. سقفِ بافر ۲۰٬۰۰۰ توکن. **fail-open:** هیچ شکستی ضبط/متن را متوقف نمی‌کند. حالتِ note چیزی نمی‌فرستد.
- **سرور:** `session_rt_token_chunks` (staging) ⇒ `buildRealtimeRecord` ⇒ گذرِ `source='realtime'`، `engine=soniox-rt`، `model=stt-rt-v5`، `meta = {runs, chunks, missing_chunks, final_seen, reliable, dropped, complete}`. کلیدِ گذر با هر تکه‌ی تازه عوض می‌شود ⇒ ساختِ دوباره = ردیفِ تازه (فقط‌افزودنی). اگر گذرِ async/upload هست، realtime ساخته نمی‌شود (کامل‌تر است).
- **`covers_full` همیشه false:** متنِ جلسه نشانگرِ علائم، placeholder و متنِ بازیابی‌شده از صدا را دارد که توکن‌هایِ زنده ندارند؛ اگر پرونده‌ی AI متنِ canonicalِ realtime را می‌خواند، این‌ها گم می‌شدند. پس پرونده همان `sessions.transcript` را می‌خواند؛ رکوردِ realtime مبنایِ نقشِ گوینده، سنجه و export است. `meta.complete` می‌گوید رکورد کلِ گفتارِ زنده را دارد یا نه.

### ۲.۲ سنجه‌هایِ کیفیتِ هر گذر (2026-10-03، قدمِ ۴، migration 046)
- پس از ذخیره‌ی هر گذرِ تازه، `notifyRecordSaved` (با ~۵ث تأخیر تا تراکنشِ فراخوان commit شود) ⇒ شنونده‌ی تزریق‌شده در `app.ts` ⇒ `audio-upload/recordMetrics.ts#enqueueRecordMetrics` (صفِ سریال، یک ffmpeg در هر لحظه).
- بازه‌هایِ صدادار از **صدایِ کاملِ آرشیو** (`getFullSessionAudio` + `measureAudioQuality`، فقط وقتی آرشیو کامل است) + توکن‌هایِ همان گذر ⇒ همان `computeTranscriptMetrics`ِ آپلود ⇒ `session_transcript_tokens.metrics`.
- **هم‌ترازی (`alignmentFor`):** realtimeِ چند-run ⇒ پوشش حساب نمی‌شود (null)؛ realtimeِ ناقص (reconnect) ⇒ مقایسه با تعدادِ حاضرین نمی‌شود (شماره‌ی گوینده‌ها یکدست نیست). عمداً «نامعلوم» به‌جایِ پرچمِ غلط.
- **نمایش:** تراپیست — `transcript_quality` در `GET /api/sessions/:id/audio-status` ⇒ یک جمله کنارِ خطِ «X از Y دقیقه» (پوشش، بخشِ بی‌متن، گوینده‌ی کم/زیاد، صدایِ نامفهوم). ادمین — نمایِ «کیفیتِ رونویسی» جلسه‌هایِ زنده را هم دارد (`listRecordMetricsForAdmin`، برچسبِ «زنده»).
- آستانه‌ها همان R20 (دادهٔ ساختگی) — قدمِ ۶ برایِ بازتنظیم با دادهٔ واقعی است.

## ۳. مصرف‌کننده‌ها

- **پرونده‌یِ AI:** `aggregateClientCorpus` برایِ هر جلسه `canonicalTextForSession` را می‌خواند؛ `null` ⇒ همان `sessions.transcript`. متنِ canonical فقط وقتی برمی‌گردد که گذرِ `covers_full` هست **و** `source_version === sessions.transcript_version` (تراپیست پس از آن متن را ویرایش نکرده). قالب «برچسب: متن» با برچسبِ نقش (درمانگر/مراجع/برچسبِ آزاد) یا «گوینده N» تا تأییدِ نقش.
- **export ادمین:** `schema_version: 2`؛ هر جلسه `canonical` (آخرین گذر + نوبت‌ها با نقش) و `unit_type`/`modalities` (snapshot، 040) دارد.
- **نقش‌ها (تراپیست):** `GET/PUT /api/sessions/:id/speakers`؛ UI: نوارِ `#speakerRolesBar` در صفحه‌یِ جلسه (فقط وقتی ≥۲ گوینده و نقش‌ها ناکامل). تأیید متنِ جلسه را عوض نمی‌کند.
- **پیشنهادِ نقش (2026-10-03، `suggest.ts`):** GET برایِ هر گوینده `suggested_role/suggested_label/suggestion_source` و `display` (برایِ realtime همان «گوینده N»ِ متن، با «بخشِ k» در چند run) و `member_options` (برچسبِ اعضایِ حاضرِ واحدِ درمان) می‌دهد. منابع: (۱) نقشِ اکثریتِ هر شماره‌ی گوینده در «متنِ نهایی»ِ done با source=async (`final-transcript/adapters/speakerRoles.ts`؛ فقط وقتی گذرِ جاری async است؛ تساوی ⇒ بدونِ پیشنهاد)؛ (۲) **حدس** فقط برایِ جلسه‌ی دونفره‌ی فردی (دقیقاً ۲ گوینده و حداکثر ۱ عضو): گوینده‌ای که زودتر حرف زده ⇒ درمانگر. چندعضوی ⇒ فقط گزینه، بدونِ حدس. منابع از `app.ts` تزریق می‌شوند (`setSpeakerSuggestionSources`) چون final-transcript خودش session-record را import می‌کند. UI پیشنهاد را از پیش انتخاب و با «(پیشنهاد)/(حدس)» علامت می‌زند؛ **فقط «تأیید» ذخیره می‌کند**.

## ۴. فاز ۲ (همین سند، بخشِ جانبی)

- **تاریخچه‌یِ متنِ خام (040):** `PUT /api/sessions/:id` هر جایگزینیِ *غیر-الحاقی* را (resolve-speakers، حذفِ مارکر، ویرایش) در `session_transcript_revisions` نگه می‌دارد (`transcriptRevision.ts#shouldRecordRevision`). حینِ جلسه (autosave) فقط با علتِ صریح (`change_reason`) یا کوتاه‌شدنِ بیش از ۱۰٪.
- **CAS اجباری:** `PUT` با `transcript` بدونِ `transcript_version` ⇒ 400 `version-required` (`TRANSCRIPT_CAS_REQUIRED=0` فقط بازگشتِ اضطراری). مسیرِ legacy (`SonioxDirect`) با `legacyPutTranscript` نسخه را از GET/پاسخ می‌گیرد.
- **snapshotِ جلسه:** `sessions.unit_type` و `sessions.modalities` در همان تراکنشِ ساختِ جلسه (`sessionSnapshot.ts`)؛ جلساتِ پیش از 040 = NULL (backfill نشده).

## ۵. محدودیت‌هایِ شناخته‌شده (صادقانه)

1. ~~توکنِ جلسه‌یِ زنده‌یِ realtime ذخیره نمی‌شود~~ — از 2026-10-03 رکوردِ realtime (§۲.۱). محدودیتِ باقی‌مانده: گوینده‌ها بینِ reconnect/رفرش یکدست نیستند (هر نسل/run کلیدِ خودش)، زمان تقریبی است، و `covers_full=false` ⇒ پرونده‌ی AI از آن نمی‌خواند. گوینده‌ی یکدست و متنِ canonical فقط با گذرِ async (`CANONICAL_PASS=1`).
2. ~~معیارهایِ کیفیت فقط برایِ آپلود~~ — از 2026-10-03 برایِ هر گذر (§۲.۲)؛ پوششِ realtimeِ چند-run و جلسه‌ی دارایِ صدایِ ناقص «نامعلوم» است.
3. نقشِ گوینده فقط *پیشنهاد* می‌شود (§۳)؛ برایِ زوج/خانواده بدونِ «متنِ نهایی» حدسی زده نمی‌شود (فقط برچسبِ اعضا به‌عنوانِ گزینه) — نگاشتِ صدا به فرد (voice-print) وجود ندارد.
4. jobهایِ پیش از 038/041 رکورد ندارند (توکن‌هایشان دور ریخته شده بود).
5. **فاز ۴ (مجموعه‌یِ طلاییِ WER/DER با رضایتِ صریح، آزمایشِ noiseSuppression/AGC=false، بازتنظیمِ آستانه‌هایِ R20) نیازمندِ دادهٔ واقعیِ جلسه است و اجرا نشد.**

## ۶. پلِ نقش با «متنِ نهایی» (2026-10-02، F7)
ویرایشِ نقشِ هم‌گوینده در «متنِ نهایی» (ردیفِ source=async) `session_speaker_roles` را هم می‌نویسد؛ «ساختِ دوباره» آن را می‌خواند و پین می‌کند ([subsystem 07](07-final-transcript.md)). دو سیستمِ نقش دیگر جدا نیستند؛ کلیدِ `session_speaker_roles.speaker_key` همان شمارهٔ لاتینِ Soniox است (برچسبِ فارسیِ متن ⇒ لاتین). API: `session-record/index.ts` حالا `getRoles`/`setRoles` را export می‌کند (مرزِ ماژول: LAW-025).
