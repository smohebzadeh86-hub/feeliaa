# Verification — اجرایِ ممیزیِ Core (فاز ۱ تا ۳) — 2026-10-01

> **نوع:** evidence (مشاهده در یک زمان، نه حقیقتِ فعلی). اجرا رویِ working tree شاخه‌ی `feat/clarity`؛ **commit/deploy نشد**.
> **محیط:** MySQLِ مشترکِ dev (با مجوزِ صریحِ مالک در همین گفتگو)، fixtureِ ساختگی با ایمیلِ `.invalid`، هیچ Sonioxِ واقعی، هیچ داده‌یِ مراجعِ واقعی. تمام fixtureها در پایانِ هر اسکریپت با `DELETE FROM therapists` (cascade) پاک شدند؛ اسکریپت‌ها حذف شدند.

## ۱. آنچه اجرا شد

| فاز | مورد | محل |
|---|---|---|
| آپلود | fsync پیش از تأییدِ تکه؛ بنرِ «کامل‌بودنِ متن» (`transcript_notes`) | `uploadStore.ts`، `jobView.ts`، `index.html` |
| ۱ | gap-check واقعی با `client_seq` + `session_audio_skips` (039) + `?empty=` | `archive/listing.ts`، `skips.ts`، `batch.routes.ts`، `feelia-rt.js` |
| ۱ | `GET /api/sessions/:id/audio-status` + خطِ «X از Y دقیقه» | `batch.routes.ts`، `index.html` |
| ۱ | `storage.persist()`، fsync پیش از 202، sweepِ batch-queue فقط پس از آرشیوِ موفق، پیامِ جدایِ شکستِ IndexedDB، هشدارِ ۵روزه | `feelia-rt.js`، `processQueue.ts`، `sweep.ts`، `index.html` |
| ۲ | توکن‌هایِ زمان‌دار (038) | `session-record/tokens.ts` |
| ۲ | تاریخچه‌یِ متنِ خام (040) + CAS اجباری + snapshotِ `unit_type`/`modalities` | `sessions.routes.ts`، `transcriptRevision.ts`، `sessionSnapshot.ts` |
| ۳ | رکوردِ canonical: `session_segments`، `session_speaker_roles` (041)، API و UIِ نقش، مصرفِ پرونده‌یِ AI و export (v2)، گذرِ live (`CANONICAL_PASS`) | `features/session-record/`، `final-transcript/runner.ts`، `aggregateClientCorpus.ts`، `export.admin.ts` |

## ۲. تستِ خودکار (بدونِ DB/شبکه)

| دستور | نتیجه |
|---|---|
| `cd server && npx tsc --noEmit` | سبز |
| `pnpm test:up` | **71 PASS / 0 FAIL** (H64–H70 جدید) |
| `pnpm test:ft` | **62 pass / 0 fail** (canonical-only جدید) |
| `pnpm test:cf` | 111 PASS / 0 FAIL |
| `pnpm test:rt` | بدونِ FAIL؛ T58 جدید PASS (سگمنتِ خالی ⇒ `?empty=1` رویِ سگمنتِ بعدی) |
| `pnpm test:routes` | OK (146 route؛ ۵ route تازه عمداً با `--update`) |
| `pnpm test:arch` | OK (159 فایل، بدونِ چرخه) |
| `pnpm test:docs` | OK |

## ۳. E2Eِ واقعی رویِ MySQLِ dev (migrationها 038–041 اعمال شدند)

1. **توکن‌ها (038):** `applyTranscriptOnce` با ۵۰۰۰ توکن ⇒ ۱ ردیف؛ اجرایِ دوباره `already`؛ ۵۰۰۰ توکن = ۲۶٬۴۷۷ بایتِ gzip (دادهٔ تکراری؛ واقعی بزرگ‌تر)؛ roundtrip برابر؛ جلسه‌یِ بدونِ توکن بدونِ ردیف؛ حذفِ جلسه ردیف را cascade کرد.
2. **skips (039):** `recordSkippedSegments` idempotent؛ `checkSeqContiguous` با/بدونِ skip ⇒ کامل/ناقص `[4]`؛ cascade.
3. **PUT واقعی (`app.inject`، 040):** بدونِ `transcript_version` ⇒ 400 `version-required`؛ resolve-speakers بعد از پایان ⇒ ۱ revision (نسخه/علت/actor/متنِ قبلی درست)؛ الحاق ⇒ بدونِ revision؛ نسخه‌یِ کهنه ⇒ 409 بدونِ revision؛ snapshot `unit_type='couple'`، `modalities=['cbt']`؛ `audio-status` ⇒ 200.
4. **رکوردِ canonical (041):** نوبت‌ها (سه نوبت، زمان/اطمینان درست)؛ `GET/PUT speakers` (نقشِ نامعتبر/گوینده‌یِ ناموجود ⇒ 400)؛ برچسبِ آزادِ حاوی `:`/خطِ جدید پاک‌سازی شد؛ **پرونده‌یِ AI** (`aggregateClientCorpus`) متنِ canonical با نقش گرفت؛ **ویرایشِ تراپیست** ⇒ canonical کهنه ⇒ بازگشت به `sessions.transcript`؛ **گذرِ جزئی** (بخشِ الحاقی) هرگز جایگزین نشد؛ گذرِ live standalone idempotent (`saved`/`exists`) و نقش‌ها رویِ گذرِ تازه هم اعمال شد؛ **export v2** با نوبت‌ها+نقش؛ cascadeِ هر سه جدول.

## ۴. یافته‌هایِ حینِ کار

- `parseEmptySeqs('7,3,,')` سگمنتِ ۰ را اشتباه «خالی» می‌کرد (`Number('') === 0`) ⇒ با تستِ H68 پیدا و رفع شد.
- ادعایِ «gap-check verified» در subsystem 02 (2026-09-22) واقعاً چیزی را اثبات نکرده بود (seqِ سرور همیشه پیوسته است) ⇒ در همان سند تصحیح شد.
- `api-contract-harness.mts` مورد «put transcript legacy (no version)» اکنون 400 می‌گیرد؛ **golden آن بازتولید نشد** (`test:api` اجرا نشد).

## ۵. تست‌نشده / انجام‌نشده

- مرورگرِ واقعی با ضبطِ زنده برایِ مسیرِ `?empty=`/`storage.persist()`/هشدارِ ۵روزه (فقط harnessِ شبیه‌ساز). UIِ نوارِ نقش و خطِ `audio-status` در مرورگرِ واقعی با بک‌اندِ واقعی دیده نشد (فقط API از طریقِ inject).
- `CANONICAL_PASS=1` با Sonioxِ واقعی اجرا نشد (هزینه + رضایت)؛ فقط ماشینِ حالت (`test:ft`) و ذخیره (E2E).
- **فاز ۴** (مجموعه‌یِ طلاییِ WER/DER، آزمایشِ `noiseSuppression/AGC=false`، بازتنظیمِ R20) نیازمندِ جلساتِ واقعیِ دارایِ رضایتِ صریح است.
- **متنِ رضایت (R1)** عمداً به دستورِ مالک دست‌نخورده ماند؛ توکن‌هایِ ماندگار و `CANONICAL_PASS` به آن وابسته‌اند.
- `test:api` (characterization) اجرا نشد.
