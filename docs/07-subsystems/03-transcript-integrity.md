# Subsystem 03 — Transcript Integrity

> **وضعیت:** ACTIVE-CANONICAL · قانون: LAW-008 · مالکِ قواعدِ نوشتنِ `sessions.transcript`.

## ۱. همه‌ی نویسنده‌های `sessions.transcript`

| # | نویسنده | فایل | CAS؟ | نسخه +1؟ | رفتار |
|---|---|---|---|---|---|
| W1 | `PUT /api/sessions/:id` با `transcript_version` | `features/sessions/` | بله (غیراتمیک) | بله | replace |
| W2 | `PUT /api/sessions/:id` بدونِ `transcript_version` | همان | **خیر** (سازگاریِ عقب‌رو) | بله | replace — مصرف‌کننده‌ها: `endDirectLive`، `saveDirectTranscript` (legacy) |
| W3 | `mergeBatchTranscript` | `features/transcription/batch/` | خیر | بله | **append** |
| W4 | `/ws/t` onPreview/onFinished | `features/legacy-ws/transcription.routes.ts` | خیر (فقط guardِ طولِ یکنواخت در حافظه) | **خیر** | replace |
| W5 | `/ws/t` finalize بدونِ موتور | همان | خیر | خیر | بازنویسیِ همان مقدار |
| W6 | `applyResolvedSpeakers` → W1 | `index.html` | بله | بله | replace کامل با متنِ resolve |

## ۲. CAS
- کلاینت `baseVersion` را در `start` از `GET /api/sessions/:id` می‌گیرد؛ پس از هر PUT موفق `baseVersion++`.
- سرور: پیش‌بررسیِ سریع با `SELECT transcript_version` (برایِ پیامِ 409ِ واضح) + **گاردِ اتمیکِ واقعی: `UPDATE sessions SET transcript=…, transcript_version=transcript_version+1 WHERE id=? AND client_id IN (…) AND transcript_version=?`** — **رفع شد (2026-09-22)**: قبلاً UPDATE هیچ شرطی رویِ نسخه نداشت، فقط پیش‌بررسیِ جدا داشت؛ بینِ آن SELECT و UPDATE یک پنجره‌ی race باز بود. با MySQLِ لوکالِ واقعی (دیتایِ canary، پاک‌شده بعدِ تست) تأیید شد: با الگویِ قدیمی هر دو نویسنده‌ی هم‌زمان موفق می‌شدند (یکی متنِ دیگری را بی‌صدا overwrite می‌کرد، `transcript_version` دو واحد جلو می‌رفت)؛ با گاردِ جدید فقط یکی `affectedRows=1` می‌گیرد، دیگری `409` (`rowCount=0` → recheck برایِ تشخیصِ 404 در برابرِ 409).
- 409 → `persistConfirmed` rebase: `GET`؛ اگر متنِ سرور ≥ متنِ محلی → سرور برنده (و confirmed محلی به آن ارتقا در صورتِ طولانی‌تر بودن)؛ وگرنه یک PUT دیگر با نسخه‌ی تازه.
- **قاعده‌ی «طولانی‌تر برنده است»** یک heuristic است؛ مثلاً جایگزینیِ resolve-speakers با متنِ کوتاه‌تر در تبِ دیگر ممکن است با autosaveِ تبِ قدیمی override شود (**INFERRED**).
- W3 و W4 نسخه‌ی کلاینت‌های دیگر را کهنه می‌کنند (W3 با +1) یا نه (W4) — W4 می‌تواند بدونِ اطلاعِ CAS بازنویسی کند.

## ۳. قواعدِ ترکیب

| قاعده | کجا |
|---|---|
| prefixِ DB فقط وقتی جایگزینِ confirmed محلی می‌شود که طولانی‌تر باشد | `RTSession.start`، `awaitBatchDrain` |
| batch = append با `\n\n` | W3 |
| مارکرِ ناپیوستگی: `[اتصال دوباره برقرار شد — شماره‌گذاری گوینده‌ها از این نقطه ممکن است با قبل فرق کند]` در هر اتصالِ Soniox بعد از اولین (reconnect، یا resumeی که اتصالش بسته شده بود). از 2026-09-14 توقف/ادامه‌ی عادی روی همان WS انجام می‌شود و مارکر نمی‌گیرد. از 2026-09-23 همین لحظه رویدادِ تله‌متریِ `rt.gap_marked` هم فایر می‌شود (بدونِ متنِ بالینی، فقط signal) — رجوع به `docs/07-subsystems/01-browser-realtime-engine.md` §۶.۵ | `noteDiscontinuity` در `connectWithFreshMint` |
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
| بعدِ یک قطعی/reconnect، تمامِ سگمنت‌هایِ *بعدیِ* durable (حتی ACTIVEِ سالم) دوباره purpose=transcript می‌گرفتند و append می‌شدند | intentِ per-segment روی stateِ لحظه‌ای (نه `self.unreliable`ِ سراسری) + بستنِ اجباریِ مرزِ سگمنت روی هر گذارِ ACTIVE↔قطعی | **رفع شد (2026-09-22):** `scheduleReconnect`/`offlineHandler`/`connectWithFreshMint` در `feelia-rt.js`؛ T18 در `scripts/rt-harness.cjs` PASS (و بدونِ فیکس عمداً FAIL می‌شود) |
| batch پس از متنِ realtime که بخشی از همان صدا را دارد | append (نه dedupe) | **بهبود یافت (2026-09-22):** ریسکِ اصلی این بود که یک قطعیِ «بی‌صدا» (WSای که readyState اش دیگه OPEN نیست ولی onclose/onerror دیر یا هیچ‌وقت فایر نمی‌شه، مثلِ WiFiای که بدونِ FIN/RST محو می‌شه) پنجره‌ی تشخیص را طولانی می‌کرد و مرزِ سگمنت دیر بسته می‌شد. `startWsWatchdog` (تایمرِ ۳ثانیه‌ای که فقط `ws.readyState` را چک می‌کند، بدونِ فرضی دربارهٔ cadenceِ پیام‌هایِ Soniox — رویِ سکوتِ طبیعی false-positive نمی‌دهد) این پنجره را به حدِ چند ثانیه محدود کرد؛ با T19/T19b در `scripts/rt-harness.cjs` تأیید شد (قطعیِ بی‌صدایِ شبیه‌سازی‌شده تشخیص داده شد؛ سکوتِ طبیعی هیچ reconnectِ کاذبی نساخت). یک پنجره‌ی بسیار کوچک‌ترِ نظری (چند صدم ثانیه، تا فاصله‌ی واقعیِ رخدادِ WS.onclose تا اجرایِ handlerِ جاوااسکریپت) هنوز به‌طورِ تئوریک باز است — قابلِ‌اندازه‌گیری/رفعِ کامل نیست بدونِ صفر کردنِ event-loop latency (INFERRED، عملاً بی‌اهمیت) |
| overwrite با متنِ کهنه | CAS | **کامل شد (2026-09-22):** حالا اتمیک (`AND transcript_version=?` در WHEREِ UPDATE)، نه فقط چکِ جدا |

## ۵. تغییرِ امن در این ناحیه
1. هر نوشتنِ جدید از مسیرِ W1 با `transcript_version`.
2. هرگز replace برای نتایجِ batch.
3. T1، T2، T6، T10، T14 را اجرا کنید؛ سناریوی جدید را به harness اضافه کنید.
4. ~~CAS اتمیک (پیشنهاد)~~ **پیاده شد (2026-09-22):** `server/src/features/sessions/`، `UPDATE … WHERE id=? AND transcript_version=?` (بدونِ `RETURNING` چون MySQL آن را ندارد؛ `affectedRows` جایگزین شد).

## رفعِ A1 (2026-09-26)
- `persistConfirmed`: `baseVersion` از پاسخِ PUT (`session.transcript_version`) خوانده می‌شود، نه `++`ِ محلی. تست: `T44`.
- rebaseِ 409 هرگز متنِ هیچ طرف را حذف نمی‌کند: متنِ ما فقط وقتی نوشته می‌شود که با متنِ سرور شروع شود؛ اگر سرور متنِ ما را در بر دارد همان پذیرفته می‌شود؛ در واگرایی دُمِ ذخیره‌نشده با برچسبِ `[متنِ زنده‌ای که هم‌زمان با تغییرِ دیگری ذخیره نشده بود]` پشتِ متنِ سرور می‌آید (+ رویدادِ `rt.transcript_diverged`). قبلاً شاخه‌ی «سرور کوتاه‌تر» کورکورانه overwrite و شاخه‌ی «سرور بلندتر» متنِ محلی را دور می‌ریخت. تست: `T44`.
- پایانِ جلسه با ذخیره‌ی نهاییِ ناموفق دیگر دُمِ متن را بی‌صدا گم نمی‌کند (بازیابی از صدا، [subsystem 02](02-audio-durability-batch-fallback.md)؛ رویدادِ `rt.final_persist_failed`).
## A2 (2026-09-26) — متنِ بازیابی‌شده در جایِ زمانیِ درست (تصمیمِ مالک)
- **کلاینت:** هر سگمنتِ durable که در قطعی بسته می‌شود (intent=`transcript`) همان لحظه placeholderِ `[⏳ بازه‌ی قطعیِ اینترنت — متن در حالِ بازیابی · #<run>:<seq>]` را در `confirmed` می‌گذارد (`insertRecoveryPlaceholder`؛ قبل از نشانگرِ «اتصال دوباره برقرار شد» اگر همان لحظه اضافه شده باشد).
- **سرور:** `applyBatchSegmentOnce(…, key)` با `mergeRecoveredSegment` همان placeholder را **درجا** با `[بازیابی‌شده از صدایِ بازه‌ی قطعی · #key]
<متن>` جایگزین می‌کند؛ سکوت ⇒ `[بازه‌ی قطعی — گفتاری تشخیص داده نشد · #key]`. بدونِ placeholder (کلاینتِ قدیمی یا placeholderِ هنوز ذخیره‌نشده) ⇒ append با همان برچسب/کلید (رفتارِ قبلیِ append، حالا برچسب‌دار). LAW-008 («batch همیشه append») به این شکل اصلاح می‌شود: متنِ batch هرگز متنِ موجود را حذف/بازنویسی نمی‌کند؛ فقط placeholderِ خودش را پر می‌کند.
- **rebaseِ 409:** `serverFilledPlaceholders` (سرور placeholderهایِ متنِ پایه را پر کرده ⇒ متنِ سرور + دُمِ تازه) و `dropResolvedPlaceholders` (placeholderِ دُمِ محلی که کلیدش در متنِ سرور هست حذف می‌شود).
- **ترتیب:** صفِ سرور (`filesFor`) و صفِ مرورگر (`listForSession`) به ترتیبِ ضبط: (زمانِ شروعِ run، seq) / (createdAt، seq)؛ آرشیو با `client_seq` (migration 027).
- **تست:** `test:rt` T46–T48؛ E2E رویِ DBِ dev ۱۰ تست ([verification](../../verification/2026-09-26-storage-fixes-full-test-run.md)).

## نشانگرِ علامتِ بدنی در متن (2026-09-27، درخواستِ مالک)
- **قالب (یک قرارداد، سه جا):** `[علامت · <دقیقه:ثانیه با ارقامِ فارسی> — <نوعِ علامت>]` در یک پاراگرافِ جدا. زمان = `offset_ms`ِ همان علامت
  (تایمرِ جلسه) با قالبِ `formatTimer`. مالک‌هایِ کد: `signMarker` در `public/feelia-rt.js`، `formatTimer` در `public/index.html`،
  `server/src/features/transcription/signMarkers.ts`. هر تغییرِ قالب باید هر سه را با هم عوض کند (حذفِ علامت نشانگر را با همین قالب پیدا می‌کند).
- **درج (کلاینت):** کلیکِ چیپِ علامت ⇒ `rtSession.insertSignMarker` همان لحظه نشانگر را به `confirmed` اضافه می‌کند (مثلِ
  `noteDiscontinuity`)؛ `curSpeaker=null` تا گفته‌ی بعدی دوباره برچسبِ گوینده بگیرد. فقط در stateهایی که متن هنوز ذخیره می‌شود
  (ACTIVE/RECONNECTING/RECOVERED/FAILED/MANUAL_PAUSED/NETWORK_PAUSED)؛ STARTING/FINALIZING/COMPLETED/حالتِ `note` ⇒ درج نمی‌شود.
  مسیرِ legacyِ `SonioxDirect` نشانگر نمی‌گیرد (LAW-015).
- **دقتِ جایگاه:** نشانگر بعد از آخرین متنِ confirmed و پیش از گفته‌ای که هنوز interim است می‌آید (چند ثانیه). در قطعیِ اینترنت،
  placeholderِ A2ِ سگمنتی که علامت در آن زده شده بعد از نشانگر درج می‌شود (سگمنت هنگامِ بسته‌شدن placeholder می‌گذارد) — خطایِ
  جایگاه حداکثر به اندازه‌ی یک سگمنتِ durable.
- **حذفِ علامت:** حینِ جلسه `removeSignMarker` آخرین رخدادِ نشانگر را از `confirmed` و — اگر آنجا هم هست — از `persistedText` برمی‌دارد
  تا پایه‌ی rebase پیشوندِ متنِ محلی بماند؛ PUTِ بعدی (CAS) آن را از سرور هم برمی‌دارد. اگر بینِ دو ذخیره نویسنده‌ی دیگری (batch)
  نسخه را بالا برده باشد، شاخه‌ی واگرایی نشانگر را در متنِ سرور نگه می‌دارد (بدونِ تکرار/گم‌شدنِ متن — T52). بعد از پایان (Wrapup)
  `removeSignMarkerFromTranscript` در `index.html`: `GET` ⇒ برشِ نشانگر ⇒ `PUT` با `transcript_version` (W1)، یک retry رویِ 409.
- **بازسازیِ گوینده‌ها (W6):** `speakerResolve.ts` علامت‌هایِ جلسه را از `session_notes` می‌خواند و `buildTextFromAsyncTokens(tokens, signs)`
  هر نشانگر را پیش از اولین توکنی که `start_ms ≥ offset_ms` می‌گذارد؛ علامتِ بعد از آخرین توکن (یا توکن‌هایِ بدونِ `start_ms`) در انتها
  به ترتیبِ زمانی. **تأییدشده با Sonioxِ asyncِ واقعی (E2E، 2026-09-27):** توکن‌ها `start_ms` دارند و نشانگرها وسطِ متن می‌آیند؛
  جایِ آن‌ها ~۲–۳ث دیرتر از جایِ زنده است (زنده قبل از کلماتی می‌آید که هنوز interim بودند). هم‌ترازیِ `offset_ms` (تایمر) با زمانِ صدایِ آرشیو
  در همان E2E درست بود؛ در توقفِ دستی/قطعی **INFERRED** می‌ماند.
- **ادغامِ بعد از حذف:** `removeMarkerFromText` (مشترکِ موتور و Wrapup) اگر پاراگرافِ بعد از نشانگر با همان «گوینده N:»ِ پاراگرافِ قبل شروع شود،
  دو تکه را یک پاراگراف می‌کند (گفته‌ای که علامت وسطش زده و بعد حذف شده دوباره یکی می‌شود). اگر هنوز متنی بعد از نشانگر نیامده، `curSpeaker`
  به گوینده‌ی پاراگرافِ قبل برمی‌گردد تا ادامه‌ی گفته برچسبِ تکراری نگیرد.
- **تست:** `test:rt` T50–T55؛ منطقِ درج در متنِ async با تستِ واحدِ موقت (R1–R6)؛ E2Eِ واقعی (Chrome + Soniox realtime/async + MySQLِ dev)
  ([verification](../../verification/2026-09-27-sign-markers-in-transcript.md)).
