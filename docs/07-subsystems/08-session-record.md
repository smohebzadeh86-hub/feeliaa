# Subsystem 08 — رکوردِ canonicalِ جلسه (Session Data Engine، فاز ۲ و ۳)

> **وضعیت:** ACTIVE-CANONICAL · ایجاد 2026-10-01 · migrationهای 038، 040، 041.
> **منشأ:** ممیزیِ «Core فیلیا = منبعِ قابل‌اعتمادِ دادهٔ جلسه» (فاز ۲ «دادهٔ خام را نگه داریم» و فاز ۳ «رکوردِ canonical»)؛ تصمیمِ مالک: توکن‌ها بعد از پاکسازیِ صدا بمانند، و **به‌جز متنِ رضایت** همه‌ی موارد اجرا شود.
> **کد:** `server/src/features/session-record/` (`tokens.ts`، `segments.ts`، `record.repository.ts`، `record.routes.ts`، `index.ts`) + نقاطِ اتصال: `audio-upload/jobStore.sql.ts`، `final-transcript/runner.ts`، `case-file/application/aggregateClientCorpus.ts`، `admin/export.admin.ts`، `sessions/sessions.routes.ts`.

> last-verified: 2026-10-01 · مالک: [feature-index](../02-reference/feature-index.md) (`session-record`) · قالب: [feature-doc-template](../00-governance/feature-doc-template.md) (LAW-026)

- **مرزها:** `features/session-record/index.ts` صادر می‌کند: `sessionRecordRoutes`، `saveCanonicalRecord` (داخلِ تراکنشِ فراخوان)، `saveCanonicalRecordStandalone`، `canonicalTextForSession`، `exportCanonicalRecord`، `packTokens`/`unpackTokens`، `buildSegments`، `renderCanonicalText`. وابسته به هیچ featureِ دیگر نیست (نوعِ `RecordToken` هم‌شکلِ `TimedToken`).
- **داده:** مالک: `session_transcript_tokens` (038 + ستون‌هایِ 041)، `session_segments`، `session_speaker_roles` (041). جدول‌هایِ فاز ۲ که sessions می‌نویسد: `session_transcript_revisions` (040).
- **تست:** `pnpm test:up` H66–H70 (بسته‌بندی، نوبت‌ها، متنِ canonical، برچسب)؛ `pnpm test:ft` (canonical-only)؛ E2Eِ واقعی رویِ MySQLِ dev: [verification](../../verification/2026-10-01-core-audit-implementation.md).
- **ریسک و بدهی:** داده‌یِ بالینیِ ماندگارِ بیشتر (توکن‌ها بعد از پاکسازیِ ۳۰روزه‌یِ صدا) ⇒ **متنِ رضایت/سیاستِ نگهداری هنوز باید اصلاح شود (R1، LAW-009/010 — عمداً دست‌نخورده به دستورِ مالک)**؛ گذرِ canonicalِ جلسه‌یِ زنده پیش‌فرض خاموش است (هزینه).

## ۱. مدل

```
گذر (pass) = یک ردیف session_transcript_tokens
   ├── tokens_gz       توکن‌هایِ زمان‌دار (gzip JSON v1: [text, start_ms, end_ms, speaker, conf×100])
   ├── source          upload | async
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

**گذرِ canonicalِ جلسه‌یِ زنده** تا امروز فقط وقتی اجرا می‌شد که درمانگر «متنِ نهایی» را روشن کرده بود. با `CANONICAL_PASS=1` برایِ **هر** جلسه‌یِ زنده‌یِ پایان‌یافته اجرا می‌شود؛ polish (LLM) فقط اگر درمانگر خواسته (`FtDeps.polishWanted`)، وگرنه job با `skipped`/`canonical-only` تمام می‌شود و UI چیزی نشان نمی‌دهد. **پیش‌فرض خاموش**: هزینه‌یِ Soniox تقریباً ۲برابر و صدا دوباره به Soniox می‌رود (باید با متنِ رضایتِ اصلاح‌شده هم‌زمان روشن شود).

## ۳. مصرف‌کننده‌ها

- **پرونده‌یِ AI:** `aggregateClientCorpus` برایِ هر جلسه `canonicalTextForSession` را می‌خواند؛ `null` ⇒ همان `sessions.transcript`. متنِ canonical فقط وقتی برمی‌گردد که گذرِ `covers_full` هست **و** `source_version === sessions.transcript_version` (تراپیست پس از آن متن را ویرایش نکرده). قالب «برچسب: متن» با برچسبِ نقش (درمانگر/مراجع/برچسبِ آزاد) یا «گوینده N» تا تأییدِ نقش.
- **export ادمین:** `schema_version: 2`؛ هر جلسه `canonical` (آخرین گذر + نوبت‌ها با نقش) و `unit_type`/`modalities` (snapshot، 040) دارد.
- **نقش‌ها (تراپیست):** `GET/PUT /api/sessions/:id/speakers`؛ UI: نوارِ `#speakerRolesBar` در صفحه‌یِ جلسه (فقط وقتی ≥۲ گوینده و نقش‌ها ناکامل). تأیید متنِ جلسه را عوض نمی‌کند.

## ۴. فاز ۲ (همین سند، بخشِ جانبی)

- **تاریخچه‌یِ متنِ خام (040):** `PUT /api/sessions/:id` هر جایگزینیِ *غیر-الحاقی* را (resolve-speakers، حذفِ مارکر، ویرایش) در `session_transcript_revisions` نگه می‌دارد (`transcriptRevision.ts#shouldRecordRevision`). حینِ جلسه (autosave) فقط با علتِ صریح (`change_reason`) یا کوتاه‌شدنِ بیش از ۱۰٪.
- **CAS اجباری:** `PUT` با `transcript` بدونِ `transcript_version` ⇒ 400 `version-required` (`TRANSCRIPT_CAS_REQUIRED=0` فقط بازگشتِ اضطراری). مسیرِ legacy (`SonioxDirect`) با `legacyPutTranscript` نسخه را از GET/پاسخ می‌گیرد.
- **snapshotِ جلسه:** `sessions.unit_type` و `sessions.modalities` در همان تراکنشِ ساختِ جلسه (`sessionSnapshot.ts`)؛ جلساتِ پیش از 040 = NULL (backfill نشده).

## ۵. محدودیت‌هایِ شناخته‌شده (صادقانه)

1. **توکنِ جلسه‌یِ زنده‌یِ realtime ذخیره نمی‌شود** (فقط گذرِ async روی صدایِ کامل). بدونِ `CANONICAL_PASS=1` و بدونِ «متنِ نهایی»، جلسه‌یِ زنده رکورد ندارد و مصرف‌کننده‌ها به `sessions.transcript` برمی‌گردند.
2. **معیارهایِ کیفیتِ `transcriptMetrics` هنوز فقط برایِ آپلود محاسبه می‌شوند** (به بازه‌هایِ صدادارِ ffmpeg نیاز دارد).
3. نقشِ گوینده از واحدِ درمان پیش‌پر نمی‌شود (تراپیست دستی تأیید می‌کند)؛ `attendees` به `speaker_key` وصل نشده.
4. jobهایِ پیش از 038/041 رکورد ندارند (توکن‌هایشان دور ریخته شده بود).
5. **فاز ۴ (مجموعه‌یِ طلاییِ WER/DER با رضایتِ صریح، آزمایشِ noiseSuppression/AGC=false، بازتنظیمِ آستانه‌هایِ R20) نیازمندِ دادهٔ واقعیِ جلسه است و اجرا نشد.**

## ۶. پلِ نقش با «متنِ نهایی» (2026-10-02، F7)
ویرایشِ نقشِ هم‌گوینده در «متنِ نهایی» (ردیفِ source=async) `session_speaker_roles` را هم می‌نویسد؛ «ساختِ دوباره» آن را می‌خواند و پین می‌کند ([subsystem 07](07-final-transcript.md)). دو سیستمِ نقش دیگر جدا نیستند؛ کلیدِ `session_speaker_roles.speaker_key` همان شمارهٔ لاتینِ Soniox است (برچسبِ فارسیِ متن ⇒ لاتین). API: `session-record/index.ts` حالا `getRoles`/`setRoles` را export می‌کند (مرزِ ماژول: LAW-025).
