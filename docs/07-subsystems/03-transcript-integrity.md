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
4. ~~CAS اتمیک (پیشنهاد)~~ **پیاده شد (2026-09-22):** `server/src/http/sessions.ts`، `UPDATE … WHERE id=? AND transcript_version=?` (بدونِ `RETURNING` چون MySQL آن را ندارد؛ `affectedRows` جایگزین شد).
