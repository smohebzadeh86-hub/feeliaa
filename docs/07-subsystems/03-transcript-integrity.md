# Subsystem 03 — Transcript Integrity

> **وضعیت:** ACTIVE-CANONICAL · قانون: LAW-008 · مالکِ قواعدِ نوشتنِ `sessions.transcript`.

## ۱. همه‌ی نویسنده‌های `sessions.transcript`

| # | نویسنده | فایل | CAS؟ | نسخه +1؟ | رفتار |
|---|---|---|---|---|---|
| W1 | `PUT /api/sessions/:id` با `transcript_version` | `http/sessions.ts` | بله (غیراتمیک) | بله | replace |
| W2 | `PUT /api/sessions/:id` بدونِ `transcript_version` | همان | **خیر** (سازگاریِ عقب‌رو) | بله | replace — مصرف‌کننده‌ها: `endDirectLive`، `saveDirectTranscript` (legacy) |
| W3 | `mergeBatchTranscript` | `stt/batchqueue.ts` | خیر | بله | **append** |
| W4 | `/ws/t` onPreview/onFinished | `ws/transcription.ts` | خیر (فقط guardِ طولِ یکنواخت در حافظه) | **خیر** | replace |
| W5 | `/ws/t` finalize بدونِ موتور | همان | خیر | خیر | بازنویسیِ همان مقدار |
| W6 | `applyResolvedSpeakers` → W1 | `index.html` | بله | بله | replace کامل با متنِ resolve |

## ۲. CAS
- کلاینت `baseVersion` را در `start` از `GET /api/sessions/:id` می‌گیرد؛ پس از هر PUT موفق `baseVersion++`.
- سرور: `SELECT transcript_version` → مقایسه → `UPDATE … transcript_version = transcript_version + 1`. **دو گامِ جدا بدونِ قفل/شرطِ WHERE روی نسخه** → دو PUT هم‌زمان با نسخه‌ی یکسان هر دو می‌توانند موفق شوند (R5).
- 409 → `persistConfirmed` rebase: `GET`؛ اگر متنِ سرور ≥ متنِ محلی → سرور برنده (و confirmed محلی به آن ارتقا در صورتِ طولانی‌تر بودن)؛ وگرنه یک PUT دیگر با نسخه‌ی تازه.
- **قاعده‌ی «طولانی‌تر برنده است»** یک heuristic است؛ مثلاً جایگزینیِ resolve-speakers با متنِ کوتاه‌تر در تبِ دیگر ممکن است با autosaveِ تبِ قدیمی override شود (**INFERRED**).
- W3 و W4 نسخه‌ی کلاینت‌های دیگر را کهنه می‌کنند (W3 با +1) یا نه (W4) — W4 می‌تواند بدونِ اطلاعِ CAS بازنویسی کند.

## ۳. قواعدِ ترکیب

| قاعده | کجا |
|---|---|
| prefixِ DB فقط وقتی جایگزینِ confirmed محلی می‌شود که طولانی‌تر باشد | `RTSession.start`، `awaitBatchDrain` |
| batch = append با `\n\n` | W3 |
| مارکرِ ناپیوستگی: `[اتصال دوباره برقرار شد — شماره‌گذاری گوینده‌ها از این نقطه ممکن است با قبل فرق کند]` در هر اتصالِ Soniox بعد از اولین (reconnect، یا resumeی که اتصالش بسته شده بود). از 2026-09-14 توقف/ادامه‌ی عادی روی همان WS انجام می‌شود و مارکر نمی‌گیرد | `noteDiscontinuity` در `connectWithFreshMint` |
| برچسبِ گوینده `گوینده N:` در ابتدای پاراگراف، شماره‌ی فارسی | `handleSonioxMessage`، `buildTextFromTokens`، `buildTextFromAsyncTokens` |
| `cleanText`: حذفِ `<end>`/`</end>`/`<fin>`، فشرده‌سازیِ فاصله، حداکثر یک خطِ خالی | `feelia-rt.js` |
| interim هرگز persist نمی‌شود | FeeliaRT؛ legacy: `hint` فقط RAM |
| متنِ یادداشتِ صوتی هرگز در transcript | `purpose=note`، `mode:'note'` بدونِ persist |

## ۴. سناریوهای duplicate/گم‌شدن و محافظ‌ها

| سناریو | محافظ | وضعیت |
|---|---|---|
| reconnect و تکرارِ متن | confirmed محلی + prefix | T2 PASS |
| pause/resume عادی + drain | purpose=archive وقتی reliable | T6 PASS |
| drainِ دوگانه روی RECOVERED→ACTIVE | `_draining` | کد |
| finish هم‌زمان با drain | `_queueLock` | کد |
| دو پردازشِ هم‌زمانِ صف در سرور | — | **باز** ([subsystem 02 §8.5](02-audio-durability-batch-fallback.md)) |
| batch پس از متنِ realtime که بخشی از همان صدا را دارد | append (نه dedupe) | **طراحی‌شده:** بخشی از متن ممکن است دو بار بیاید اگر سگمنتی که realtime جزئی پوشش داده بود با purpose=transcript آپلود شود (INFERRED) |
| overwrite با متنِ کهنه | CAS (غیراتمیک) | جزئی |

## ۵. تغییرِ امن در این ناحیه
1. هر نوشتنِ جدید از مسیرِ W1 با `transcript_version`.
2. هرگز replace برای نتایجِ batch.
3. T1، T2، T6، T10، T14 را اجرا کنید؛ سناریوی جدید را به harness اضافه کنید.
4. CAS اتمیک (پیشنهاد): `UPDATE … WHERE id=$ AND transcript_version=$expected RETURNING` — [ماژول 04 plan](../04-modules/04-transcription/implementation-plan.md).
