/* FeeliaRT — production realtime engine (Browser → Soniox, direct).
 *
 * اصول (بر اساس خود Feelia، نه کپی کور):
 *  - Realtime اصلی مستقیم به Soniox با Temporary API Key کوتاه‌عمرِ single-use است؛
 *    هر connection (شروع/reconnect) یک mint تازه از POST /api/stt/realtime-session می‌گیرد.
 *    کلید اصلی Soniox هرگز در این فایل نیست و در هیچ لاگی چاپ نمی‌شود.
 *  - یک getUserMedia مشترک بین استریمر زنده و ضبط durable (دو MediaRecorder روی یک stream).
 *  - State machine صریح جدا از DB status. قطع WS هرگز خودکار یعنی پایان session نیست.
 *  - confirmed (final) حفظ می‌شود، interim روی reconnect دور ریخته می‌شود.
 *  - unreliable یک‌طرفه است و finalize را به batch fallback می‌برد.
 *  - finish event/state-based است (نه sleep کور) با timeout صریح.
 *  - abort از هر state امن است (بدون promise معلق، بدون نشت mic/WS/recorder).
 *  - صوت durable فقط در failure به سرور می‌رود (صف batch) و بعد حذف می‌شود.
 */
'use strict';
(function () {
  var STATES = {
    IDLE: 'IDLE',
    STARTING: 'STARTING',
    ACTIVE: 'ACTIVE',
    NETWORK_PAUSED: 'NETWORK_PAUSED',
    RECONNECTING: 'RECONNECTING',
    MANUAL_PAUSED: 'MANUAL_PAUSED',
    FINALIZING: 'FINALIZING',
    COMPLETED: 'COMPLETED',
    CANCELED: 'CANCELED',
    RECOVERED: 'RECOVERED',
    FAILED: 'FAILED'
  };

  var MAX_RECONNECT_ATTEMPTS = 4;
  var RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000];
  // ⭐ resume() (کلیکِ دستیِ «ادامه») برخلافِ reconnectِ خودکار فقط یه‌بار
  // connectWithFreshMint رو امتحان می‌کرد — یه لغزشِ گذرا (شبکه، mint، ردِ موقتِ
  // Soniox) یعنی کاربر باید خودش پیامِ خطا رو می‌دید و دوباره «ادامه» می‌زد؛ از
  // بیرون شبیهِ «گاهی ادامه کار نمی‌کنه» به‌نظر می‌رسید. الان مثلِ reconnectِ خودکار
  // چندبار با backoffِ کوتاه امتحان می‌کنه.
  var RESUME_MAX_ATTEMPTS = 3;
  var RESUME_RETRY_BACKOFF_MS = [800, 1600];
  // ⭐ طبقِ مستنداتِ رسمیِ Soniox (Connection keepalive + Pause/resume): pause واقعیِ
  // Soniox یعنی «اتصال زنده بمونه، فقط صدا نره» — با فرستادنِ {"type":"keepalive"}
  // حداقل هر ۲۰ ثانیه (توصیه‌شون: هر ۵-۱۰ ثانیه). این دقیقاً نگه‌داشتنِ context
  // (شماره‌گذاریِ گوینده‌ها، زبان) رو هم تضمین می‌کنه. پیاده‌سازیِ قبلیِ ما (بستنِ WS
  // و mintِ کاملاً تازه سرِ هر resume) دقیقاً برخلافِ این بود — هم دیارizationِ
  // هرجلسه رو سرِ هر توقف/ادامه ریست می‌کرد، هم لگ/شکنندگیِ resume رو ایجاد می‌کرد.
  var KEEPALIVE_INTERVAL_MS = 5000;
  var CONNECT_TIMEOUT_MS = 10000; // explicit: باز نشدن WS
  var REQUEST_TIMEOUT_MS = 12000; // explicit: fetch بدونِ AbortController می‌تونه رویِ شبکه‌ی ناپایدار بی‌نهایت معلق بمونه
  var FINALIZE_TIMEOUT_MS = 8000; // explicit: نیامدن finished
  var PAUSE_FLUSH_MS = 2000; // explicit: انتظار دم جمله روی pause
  // طبقِ docsِ Soniox: finalize باید بعدِ ~۲۰۰ms سکوت فرستاده بشه، وگرنه دقتِ
  // diarization برایِ همون لحظه پایین میاد. قبلاً finalize بی‌درنگِ کلیکِ pause
  // می‌رفت — بدونِ هیچ زمینه‌ی صوتیِ اضافه برایِ بستنِ درستِ آخرین گفته.
  var PAUSE_SILENCE_BUFFER_MS = 250;
  var AUTOSAVE_MS = 5000;
  // ⭐ برخلافِ handleWSClose (که به رویدادِ onclose/onerrorِ خودِ WebSocket وابسته است)،
  // یک قطعیِ «بی‌صدا» (کابل/WiFی که بدونِ FIN/RST محو می‌شه) می‌تونه تا مدتی هیچ رویدادی
  // فایر نکنه — در همون فاصله، durable segment هنوز state=ACTIVE می‌بینه و intent=archive
  // می‌گیره، درحالی‌که واقعاً دیگه چیزی به Soniox نمی‌رسه (گپِ متنی، نه دوپلیکیت). این
  // watchdog فقط readyStateِ خودِ WS را چک می‌کند (بدونِ فرضی درباره‌ی cadence پیام‌هایِ
  // Soniox، پس رویِ سکوتِ طبیعیِ گفتگو false-positive نمی‌دهد) — اگه دیگه OPEN نیست ولی
  // state هنوز ACTIVEه، یعنی onclose/onerror دیر یا هیچ‌وقت فایر نشده؛ همون reconnect
  // معمولی را دستی صدا می‌زنیم تا مرزِ سگمنت هرچه زودتر بسته شود.
  var WS_WATCHDOG_MS = 3000;
  var BATCH_POLL_MS = 5000;
  var BATCH_TIMEOUT_MS = 15 * 60 * 1000; // explicit: سقف انتظار batch
  var MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];
  // ⭐ ضبطِ durable چرخش می‌کنه (سگمنتِ فعلی بسته، یکیِ تازه شروع) — نه فقط سرِ
  // pause/resume. چرا: قبلاً یه ضبطِ durableِ واحد از اولِ جلسه تا اولین pause/پایان
  // ادامه داشت — یعنی (۱) کلِ صدا توی حافظه‌یِ RAM (یه آرایه‌ی chunk) جمع می‌شد
  // بدونِ سقف، (۲) اگه چیزی وسطِ جلسه خراب می‌شد (تب بسته/کرش)، کلِ صدایِ اون جلسه
  // از دست می‌رفت، نه فقط چند ثانیه‌ی آخر. هر سگمنت یه فایلِ کاملِ مستقله که بلافاصله
  // قابلِ‌آپلوده. (audit صدا/۲۰۲۶-۰۹-۱۶، تصمیمِ مالک): از ۶۰ به ۱۵ ثانیه — پنجره‌ی
  // صدایِ در-خطر (فقط در RAM، هنوز در IndexedDB نیست) به یک‌چهارم کاهش می‌یابد.
  var DURABLE_ROTATE_MS = 15 * 1000;
  // ⭐ این فقط رویِ ضبطِ durable (نسخه‌ی پشتیبان/fallback) اعمال می‌شه، نه رویِ استریمِ
  // زنده‌ای که مستقیم به Soniox می‌ره — کیفیتِ اون نباید کم بشه چون رویِ دقتِ
  // رونویسیِ زنده اثر می‌ذاره. ۲۴kbps مونو برایِ گفتار و برایِ رونویسیِ batch/شنیدنِ
  // ادمین کاملاً کافیه، ولی حجم رو تقریباً ۵ برابر نسبت به پیش‌فرضِ مرورگر کم می‌کنه.
  var DURABLE_BITRATE = 24000;

  function pickMime() {
    try {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported) {
        for (var i = 0; i < MIME_CANDIDATES.length; i++) {
          if (MediaRecorder.isTypeSupported(MIME_CANDIDATES[i])) return MIME_CANDIDATES[i];
        }
      }
    } catch (e) {}
    return '';
  }

  function reqStream() {
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
  }

  // شناسه‌ی یکتایِ هر RTSession (هر بارِ start/resume یکی تازه می‌گیره) — کلیدِ
  // IndexedDB و پارامترِ آپلود رو با این می‌سازیم تا دو run هیچ‌وقت رویِ seqِ
  // یکسان تصادم نکنن (یادداشتِ صوتی هم‌زمان با جلسه، یا ادامه‌ی جلسه بعدِ رفرش).
  function genRunId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function stopStream(s) {
    if (!s) return;
    try { s.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); } catch (e) {}
  }

  function cleanText(t) {
    var s = String(t || '').replace(/<\/?end>/g, '').replace(/<fin>/g, '');
    s = s.split('\n').map(function (ln) {
      return ln.replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+|[ \t]+$/g, '');
    }).join('\n');
    return s.replace(/\n{3,}/g, '\n\n').trim();
  }

  // ————————————————— صفِ آفلاینِ صدا (IndexedDB) —————————————————
  // چرا این لازمه: قبلاً هر سگمنتِ durable فقط توی یه آرایه‌ی RAM (self.durableSegs)
  // نگه داشته می‌شد — با رفرش/بستنِ تب/کرش، همه‌شون برای همیشه از بین می‌رفتن، حتی
  // اگه اتصالِ اینترنت هیچ‌وقت قطع نشده باشه (کافی بود کاربر تب رو ببنده). الان همون
  // لحظه‌ای که یه سگمنتِ ۶۰ثانیه‌ای بسته می‌شه، توی IndexedDB هم نوشته می‌شه — یعنی
  // بعدِ رفرش هم می‌مونه، تا وقتی که واقعاً آپلود و تاییدِ سرور بشه.
  var AUDIO_DB_NAME = 'feelia-audio';
  var AUDIO_DB_VERSION = 1;
  var AUDIO_STORE = 'segments';
  // سقفِ کلِ صفِ آفلاین (همه‌ی جلسات با هم) — تا حافظه‌ی مرورگر بی‌نهایت پر نشه.
  // وقتی رد شد، سگمنتِ جدید ذخیره نمی‌شه (نه اینکه بی‌صدا دور ریخته بشه — تابعِ
  // add صراحتاً false برمی‌گردونه تا caller بتونه به کاربر هشدار بده).
  var AUDIO_QUEUE_MAX_BYTES = 300 * 1024 * 1024; // ۳۰۰ مگابایت

  var AudioQueueDB = (function () {
    var dbPromise = null;
    function open() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise(function (resolve, reject) {
        if (!window.indexedDB) { reject(new Error('no-indexeddb')); return; }
        var req = indexedDB.open(AUDIO_DB_NAME, AUDIO_DB_VERSION);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains(AUDIO_STORE)) {
            var store = db.createObjectStore(AUDIO_STORE, { keyPath: 'id' });
            store.createIndex('sessionId', 'sessionId', { unique: false });
          }
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error || new Error('indexeddb-open-failed')); };
      });
      return dbPromise;
    }
    // باگِ واقعی که با تستِ زنده پیدا شد: قبلاً این تابع با خروجیِ خامِ fn(store)
    // (خودِ IDBRequest، نه data ی که request.onsuccess می‌ده) resolve می‌کرد —
    // یعنی get/getAll همیشه یه IDBRequest برمی‌گردوند، نه آرایه‌ی واقعی؛ .sort()
    // رویِ اون throw می‌کرد، catch می‌شد، و همیشه [] برمی‌گشت — بی‌صدا. الان request
    // رو مستقیم می‌گیریم و منتظرِ خودِ onsuccess/request.result می‌مونیم.
    function withStore(mode, fn) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(AUDIO_STORE, mode);
          var store = tx.objectStore(AUDIO_STORE);
          var request;
          try { request = fn(store); } catch (e) { reject(e); return; }
          tx.onerror = function () { reject(tx.error || new Error('indexeddb-tx-failed')); };
          tx.onabort = function () { reject(tx.error || new Error('indexeddb-tx-aborted')); };
          if (request && ('onsuccess' in request)) {
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = function () { reject(request.error || new Error('indexeddb-request-failed')); };
          } else {
            tx.oncomplete = function () { resolve(request); };
          }
        });
      });
    }
    function totalBytes() {
      return withStore('readonly', function (store) { return store.getAll(); }).then(function (all) {
        return (all || []).reduce(function (sum, r) { return sum + (r.bytes || 0); }, 0);
      }).catch(function () { return 0; });
    }
    // اضافه‌کردنِ یه سگمنت. اگه از سقف رد بشه، false برمی‌گردونه (ذخیره نمی‌شه).
    // ⭐ کلید شاملِ runId هم می‌شه (نه فقط sessionId_seq) — وگرنه یادداشتِ صوتیِ
    // هم‌زمان یا ادامه‌ی جلسه بعدِ رفرش (که هر دو seq رو از ۰ شروع می‌کنن) رکوردِ
    // سگمنتِ آپلودنشده‌ی run قبلی رو بی‌صدا رویِ هم می‌نوشتن (store.put با کلیدِ تکراری).
    // intent: قصدِ ضبط در همون لحظه ('archive'|'transcript'|'note') — تعیین‌کننده‌ی
    // purposeِ آپلود در آینده است، نه وضعیتِ لحظه‌ایِ RTSession در زمانِ آپلود (audit
    // صدا/۲۰۲۶-۰۹-۱۶، بخشِ C). رکوردهایِ قدیمی‌ترِ بدونِ این فیلد در uploadQueuedSegment
    // با fallbackِ 'archive' هندل می‌شن.
    function add(sessionId, runId, seq, blob, mime, intent) {
      return totalBytes().then(function (used) {
        if (used + blob.size > AUDIO_QUEUE_MAX_BYTES) return false;
        var rec = {
          id: sessionId + '_' + runId + '_' + seq,
          sessionId: sessionId,
          runId: runId,
          seq: seq,
          blob: blob,
          mime: mime || 'audio/webm',
          bytes: blob.size,
          intent: intent || 'archive',
          createdAt: Date.now(),
        };
        return withStore('readwrite', function (store) { return store.put(rec); }).then(function () { return true; });
      }).catch(function () { return false; });
    }
    function listForSession(sessionId) {
      return withStore('readonly', function (store) {
        var idx = store.index('sessionId');
        return idx.getAll(IDBKeyRange.only(sessionId));
      }).then(function (rows) {
        return (rows || []).sort(function (a, b) { return a.seq - b.seq; });
      }).catch(function () { return []; });
    }
    // با idِ کاملِ رکورد (نه بازسازیِ دستی) — امن‌تره چون رکوردهایِ قدیمی‌ترِ قبلِ این
    // نسخه (فرمتِ sessionId_seq بدونِ runId) هم درست حذف می‌شن.
    function remove(id) {
      return withStore('readwrite', function (store) { return store.delete(id); }).catch(function () {});
    }
    // ⭐ وقتی مسیرِ realtime قابلِ‌اعتماد بود (unreliable=false)، صدایِ durable هیچ‌وقت
    // آپلود نمی‌شه (طبقِ همون قاعده‌ی حریمِ خصوصیِ همیشگی: صدایِ خام فقط توی مسیرِ
    // شکست به سرور می‌ره) — پس نسخه‌هایِ محلی‌اش دیگه لازم نیستن، همین‌جا پاک می‌شن.
    function clearForSession(sessionId) {
      return listForSession(sessionId).then(function (rows) {
        return Promise.all(rows.map(function (r) { return remove(r.id); }));
      }).catch(function () {});
    }
    // همه‌ی sessionId هایی که هنوز صدایِ آپلودنشده دارن — برایِ جاروبِ هر بارِ لودِ صفحه
    // (شاملِ جلساتی که هیچ‌وقت resume نشدن، مثلاً تب برای همیشه بسته شده).
    function listSessionIdsWithPending() {
      return withStore('readonly', function (store) { return store.getAll(); }).then(function (all) {
        var seen = {};
        (all || []).forEach(function (r) { seen[r.sessionId] = true; });
        return Object.keys(seen);
      }).catch(function () { return []; });
    }
    return {
      add: add, listForSession: listForSession, remove: remove, clearForSession: clearForSession,
      totalBytes: totalBytes, listSessionIdsWithPending: listSessionIdsWithPending
    };
  })();

  // ⭐ منطقِ یکتایِ انتخابِ purpose از رویِ intentِ خودِ رکورد + آپلود + fallback
  // (audit صدا/۲۰۲۶-۰۹-۱۶، بخشِ C). همه‌ی مسیرهایی که صفِ IndexedDB را آپلود می‌کنند
  // (uploadBatchSegments، drainQueuedAudioInBackground، archiveQueuedAudioOnly، و
  // sweepOrphanedAudioQueueِ index.html) از همین یک تابع استفاده می‌کنند — قبلاً هرکدام
  // purpose را جدا و با دانشِ لحظه‌ایِ ناقص (وضعیتِ *فعلیِ* RTSession، نه وضعیتِ واقعیِ
  // رکورد در لحظه‌ی ضبط) حدس می‌زدند؛ چون همه‌ی صف‌ها با sessionId مشترک خونده می‌شن،
  // ممکن بود سگمنتی از یه runِ قبلی با فرضِ اشتباهِ runِ فعلی آپلود بشه. الان هر رکورد
  // دقیقاً با intentِ خودش (که موقعِ ضبط تعیین شده) آپلود می‌شه.
  // برمی‌گرداند Promise<boolean> — true یعنی رکورد باید از صف حذف شود.
  function uploadQueuedSegment(sessionId, rec) {
    var intent = rec.intent || 'archive'; // legacy بدونِ intent → رفتارِ قبلی (فقط آرشیو)
    var purpose = intent === 'note' ? 'note' : (intent === 'transcript' ? 'transcript' : 'archive');
    var run = rec.runId || 'legacy';
    var send = function (p) {
      var fd = new FormData();
      fd.append('file', rec.blob, 'segment-' + rec.seq + '.webm');
      return fetch('/api/sessions/' + sessionId + '/batch-audio?purpose=' + p + '&seq=' + rec.seq + '&run=' + encodeURIComponent(run), { method: 'POST', body: fd });
    };
    return send(purpose).then(function (res) {
      if (res.ok) return true;
      if (res.status === 404) return true; // جلسه دیگه وجود نداره — نگه‌داشتن بی‌فایده‌ست
      if (res.status === 400) {
        return res.json().catch(function () { return {}; }).then(function (d) {
          if (d && String(d.error || '').indexOf('کوتاه') >= 0) return true; // غیرقابلِ‌بازیابی
          if (purpose === 'transcript') {
            // ⭐ تصمیمِ مالک: صدایِ آفلاینی که رونویسی‌اش بعدِ پایانِ جلسه رسیده گم نمی‌شود —
            // به‌جایِ آرشیوِ بی‌صدا، با purpose=late-transcript رونویسی و با برچسبِ صریح
            // به انتهایِ متن append می‌شود.
            return send('late-transcript').then(function (res2) { return res2.ok; }).catch(function () { return false; });
          }
          return false; // ۴۰۰ِ دیگر (نباید عادی باشه) — نگه‌دار، دفعه‌ی بعد دوباره
        });
      }
      return false; // شکستِ شبکه/۵xx — توی صف بمونه، دفعه‌ی بعد دوباره امتحان می‌شه
    }).catch(function () { return false; });
  }

  // ————————————————— قفلِ سراسریِ صف‌خوانی/آپلودِ صدا —————————————————
  // ⭐ باگِ واقعی (audit صدا/۲۰۲۶-۰۹-۱۶، مشاهده‌شده در تستِ زنده): قبلاً هر RTSession فقط
  // با یک قفلِ per-instance (`self._queueLock`) خودش را هماهنگ می‌کرد — این قفل هیچ
  // ارتباطی با `sweepOrphanedAudioQueue`ِ سراسریِ index.html (که صفِ همون sessionId را
  // مستقل می‌خواند/آپلود/پاک می‌کند) نداشت. در تستِ زنده دیده شد که اگر sweep و یک
  // RTSessionِ فعال هم‌زمان روی یک sessionId کار کنند (مثلاً چند تبِ باز، یا مسیری که
  // `feelia_active_session` را ست نکرده)، می‌توانند رویِ هم بیفتند — sha256/قفلِ سرور
  // جلویِ خرابیِ داده را می‌گرفت، ولی خودِ race واقعی بود. الان یک قفلِ **مشترکِ ماژول**
  // (`navigator.locks` اگر مرورگر پشتیبانی کند — واقعاً بینِ تب‌ها هم مشترک است؛ وگرنه
  // یک promise-lockِ سطحِ ماژول که حداقل داخلِ همین تب هماهنگ می‌کند) کلیدشده با
  // sessionId، همه‌جا (RTSession.prototype.*، و sweepِ index.html از طریقِ همین تابع)
  // استفاده می‌شود — دیگر دو مسیر هیچ‌وقت هم‌زمان صفِ یک session را دست‌کاری نمی‌کنند.
  var moduleAudioLocks = {};
  function withAudioLock(sessionId, fn) {
    try {
      if (window.navigator && navigator.locks && navigator.locks.request) {
        return navigator.locks.request('feelia-audio-' + sessionId, fn);
      }
    } catch (e) {}
    var prev = moduleAudioLocks[sessionId] || Promise.resolve();
    var run = prev.catch(function () {}).then(fn);
    moduleAudioLocks[sessionId] = run.catch(function () {});
    return run;
  }

  // باگِ ریشه‌ای: fetch به‌خودیِ‌خود هیچ سقفِ زمانی نداره — رویِ شبکه‌ی ناپایدار
  // (مثلاً پکت‌هایی که بدونِ خطای صریح گم می‌شن)، این promise می‌تونست تا ابد معلق
  // بمونه. چون resume()/connectWithFreshMint() دقیقاً منتظرِ همین fetch (mint) هستن،
  // نتیجه‌ش «گیرکردنِ» دکمه‌ی ادامه/توقف بود — نه خطا، نه موفقیت، فقط سکوتِ ابدی.
  function reqJson(path, opts) {
    opts = opts || {};
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timedOut = false;
    var timer = controller ? setTimeout(function () {
      timedOut = true;
      try { controller.abort(); } catch (e) {}
    }, REQUEST_TIMEOUT_MS) : null;
    return fetch(path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || 'خطا');
          err.status = res.status;
          err.code = data && data.code;
          throw err;
        }
        return data;
      });
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      if (timedOut) { var e = new Error('request-timeout'); e.status = 0; throw e; }
      throw err;
    });
  }

  function mintCredential(sessionId, purpose) {
    return reqJson('/api/stt/realtime-session', { method: 'POST', body: { session_id: sessionId, purpose: purpose } });
  }

  // ————————————————— تله‌متریِ فازِ ۲ (rt.*) —————————————————
  // قلابِ کلاینتِ فازِ ۱ (FeeliaObs) اینجا واقعاً صدا زده می‌شود. هیچ dependencyِ
  // سخت‌ای رویِ FeeliaObs نیست — window.FeeliaObs ممکنه اصلاً وجود نداشته باشه
  // (مثلاً scripts/rt-harness.cjs که این فایل را بدونِ document/window.FeeliaObs
  // اجرا می‌کند) — هر فراخوانی کاملاً بی‌اثر و بی‌خطا می‌ماند.
  // scheduleReconnect(reason) already only receives short machine codes (closed,
  // soniox-error, temp-key-expired, watchdog-ws-not-open, retry, online,
  // online-after-failed) — همه با الگویِ SAFE_TOKEN_RE سمتِ سرور (redact.ts) سازگارند.
  // این تابع فقط یک لایه‌ی دفاعیِ اضافه است: اگه یه‌روز یه reasonِ آزاد/بلند به این‌جا
  // برسه، به‌جایِ فرستادنِ متنِ نامعتبر (که سرور بی‌صدا حذفش می‌کنه)، یه کدِ عمومیِ
  // امن جایگزین می‌شه.
  var RT_REASON_TOKEN_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
  function safeReasonToken(reason) {
    return (typeof reason === 'string' && RT_REASON_TOKEN_RE.test(reason)) ? reason : 'unknown';
  }

  function obsEvent(name, detail) {
    try {
      if (window.FeeliaObs && typeof window.FeeliaObs.event === 'function') {
        window.FeeliaObs.event(name, detail || {});
      }
    } catch (e) {}
  }

  function isAvailable() {
    try {
      return !!(window.fetch && window.WebSocket && window.MediaRecorder &&
        navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    } catch (e) { return false; }
  }

  // ————————————————— Session —————————————————
  function RTSession(sessionId, opts) {
    opts = opts || {};
    this.sessionId = sessionId;
    this.runId = genRunId();
    this.mode = opts.mode === 'note' ? 'note' : 'live'; // note: بدون persistence transcript
    this.persist = this.mode === 'live';
    this.cb = {
      onState: opts.onState || function () {},
      onResult: opts.onResult || function () {},
      onError: opts.onError || function () {}
    };
    this.state = STATES.IDLE;
    this.generation = 0;
    this.ws = null;
    this.keepaliveTimer = null;
    this.stream = null;
    this.liveRec = null;
    this.durableRec = null;
    this.durableRotateTimer = null;
    this.durableSeq = 0; // شماره‌ی افزایشیِ سگمنت — کلیدِ ردیفِ IndexedDB می‌شه (sessionId_seq)
    // (chunkهای durable عمداً رویِ self نیستند — محلیِ هر recorder در startDurable؛ race چرخش)
    this.confirmed = '';
    this.interim = '';
    this.baseVersion = 0; // transcript_version پایه برای CAS
    this.persistedText = ''; // آخرین متنی که با همین baseVersion رویِ سرور است (rebaseِ 409 در persistConfirmed)
    this.dirty = false;
    this.autosaveFailStreak = 0;
    this.unreliable = false;
    this.reconnectAttempts = 0;
    this.reconnectInFlight = false;
    this.hadGap = false;
    this.curSpeaker = null;
    // باگِ ریشه‌ای: Soniox دیاریزیشنِ گوینده‌ها رو per-connection حساب می‌کنه — هر
    // reconnect یا resumeِ دستی یه دیاریزیشنِ کاملاً تازه‌ست (شماره‌گذاریِ گوینده از
    // صفر شروع می‌شه). یعنی اگه نفرِ سوم و چهارم بعدِ یه reconnect حرف بزنن، Soniox
    // بهشون دوباره شماره‌ی ۰ و ۱ می‌ده — که با نفرِ اول و دوم (قبل از reconnect) قاطی
    // می‌شه و توی متنِ نهایی همه‌شون زیرِ همون دو برچسبِ «گوینده ۰»/«گوینده ۱» میان.
    // راه‌حل: هر (نسل، شماره‌ی خامِ Soniox) یه برچسبِ سراسریِ تازه می‌گیره — پس گوینده‌ها
    // بعدِ هر reconnect/resume، به‌جایِ قاطی‌شدن با گوینده‌هایِ قبلی، شماره‌ی جدید می‌گیرن.
    this.speakerLabelMap = {};
    this.nextSpeakerLabel = 0;
    // ⭐ توکنِ pause/resume — برایِ خنثی‌کردنِ پاکسازیِ تاخیریِ pauseِ قدیمی وقتی
    // کاربر توی همون فاصله resume زده (پایینِ همین فایل، تابعِ pause را ببین).
    this.pauseToken = 0;
    // ⭐ قفلِ صفِ IndexedDB: سه تابعِ جدا (drainQueuedAudioInBackground حینِ جلسه،
    // uploadBatchSegments و archiveQueuedAudioOnly توی finish) هر کدوم صفِ همین
    // sessionId رو می‌خونن/آپلود می‌کنن/پاک می‌کنن — و از بیرون، sweepOrphanedAudioQueueِ
    // سراسری هم می‌تونه هم‌زمان همون کار رو بکنه. بدونِ یه قفلِ مشترک، دو تا از این‌ها
    // می‌تونستن رویِ هم بیفتن (متن دوبار merge بشه، یا هر دو یه سگمنتِ نیمه‌حذف‌شده رو
    // ببینن). قفلِ واقعی حالا سطحِ ماژوله، نه per-instance — رجوع به withAudioLock
    // (تعریف‌شده کنارِ uploadQueuedSegment)، که همین sessionId رو با sweep هم مشترک است.
    this.timers = [];
    this.autosaveTimer = null;
    this.wsWatchdogTimer = null;
    this.finishResolver = null;
    this.aborted = false;
    this.closingIntentional = false;
    // ISSUE 1: نسل اتصال — هر mint/WS متعلق به یک epoch است؛ finalize/abort آن را باطل می‌کند
    // تا نتیجه‌ی دیررسیده نتواند COMPLETED/CANCELED را به ACTIVE برگرداند.
    this.connEpoch = 0;
    this.noNewConnections = false;
    this.realtimeUp = false;
    this.startedAt = 0;
    this.offlineHandler = null;
    this.onlineHandler = null;
  }

  RTSession.prototype.setState = function (s) {
    var prevState = this.state;
    this.state = s;
    if (prevState !== s) obsEvent('rt.state_change', { state: s, prev_state: prevState });
    try { this.cb.onState(s, this.snapshot()); } catch (e) {}
    // ⭐ هر بار که واقعاً به ACTIVE/RECOVERED می‌رسیم (شروع، resume، یا reconnect
    // موفق)، اگه صدایی از یه outage قبلی توی صفِ آفلاین مونده، همون‌جا آپلودش کن —
    // نه اینکه کاربر مجبور باشه صبر کنه تا «پایان جلسه» رو بزنه.
    if ((s === STATES.ACTIVE || s === STATES.RECOVERED) && this.persist) {
      try { this.drainQueuedAudioInBackground(); } catch (e) {}
    }
  };

  RTSession.prototype.snapshot = function () {
    return {
      state: this.state, generation: this.generation,
      confirmed: this.confirmed, interim: this.interim,
      unreliable: this.unreliable, reconnectAttempts: this.reconnectAttempts
    };
  };

  RTSession.prototype.later = function (fn, ms) {
    var self = this;
    var id = setTimeout(function () {
      self.timers = self.timers.filter(function (t) { return t !== id; });
      fn();
    }, ms);
    this.timers.push(id);
    return id;
  };

  RTSession.prototype.clearTimers = function () {
    this.timers.forEach(function (t) { clearTimeout(t); });
    this.timers = [];
    if (this.autosaveTimer) { clearInterval(this.autosaveTimer); this.autosaveTimer = null; }
    if (this.wsWatchdogTimer) { clearInterval(this.wsWatchdogTimer); this.wsWatchdogTimer = null; }
  };

  // ——— audio مشترک ———
  RTSession.prototype.ensureStream = function () {
    var self = this;
    if (self.stream && self.stream.active) return Promise.resolve(self.stream);
    return reqStream().then(function (s) { self.stream = s; self.watchTrackEnded(s); return s; });
  };

  // ⭐ باگِ واقعی (audit صدا/۲۰۲۶-۰۹-۱۶): جداشدنِ فیزیکیِ میکروفون (هدست/OS/تماسِ
  // تلفن) به MediaRecorder هیچ خطایی نمی‌ده — ضبط فقط بی‌صدا متوقف می‌شه، بدونِ
  // هیچ نشانه‌ای برایِ کاربر یا کد. تنها رویدادِ قابلِ‌اعتماد track.onended است.
  RTSession.prototype.watchTrackEnded = function (stream) {
    var self = this;
    try {
      var tracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
      tracks.forEach(function (t) { t.onended = function () { self.handleMicLost(); }; });
    } catch (e) {}
  };

  // بازیابیِ خودکار: میکروفونِ ازدست‌رفته را با backoff دوباره می‌گیرد و ضبطِ
  // durable/livePusher را رویِ streamِ تازه از نو شروع می‌کند — بدونِ دست‌زدن به
  // state machineِ اصلی (WS/finalize) که مستقل است.
  RTSession.prototype.handleMicLost = function () {
    var self = this;
    if (self.aborted || self.state === STATES.COMPLETED || self.state === STATES.CANCELED ||
        self.state === STATES.MANUAL_PAUSED || self.state === STATES.FINALIZING) return;
    if (self._micRecovering) return;
    self._micRecovering = true;
    try { self.cb.onError('میکروفون قطع شد — در حال تلاش برای اتصالِ دوباره'); } catch (e) {}
    self.stopLivePusher();
    var wasDurable = !!(self.durableRec && self.durableRec.state === 'recording');
    self.stopDurableSegment();
    self.stream = null;
    var attempt = function (n) {
      if (self.aborted || self.state === STATES.COMPLETED || self.state === STATES.CANCELED) { self._micRecovering = false; return; }
      self.ensureStream().then(function () {
        self._micRecovering = false;
        try { self.cb.onError('میکروفون دوباره وصل شد'); } catch (e) {}
        if (self.hasOpenWS()) self.startLivePusher();
        if (wasDurable) self.startDurable();
      }).catch(function () {
        if (self.aborted) { self._micRecovering = false; return; }
        var delay = RECONNECT_BACKOFF_MS[Math.min(n, RECONNECT_BACKOFF_MS.length - 1)];
        self.later(function () { attempt(n + 1); }, delay);
      });
    };
    attempt(0);
  };

  RTSession.prototype.startLivePusher = function () {
    var self = this;
    self.stopLivePusher();
    if (!self.stream) return;
    var mime = pickMime();
    try {
      self.liveRec = mime ? new MediaRecorder(self.stream, { mimeType: mime }) : new MediaRecorder(self.stream);
    } catch (e) { return; }
    // ⭐ باگِ واقعی (گزارشِ مالک ۲۰۲۶-۰۹-۲۳: «بعدِ وصل‌شدنِ دوباره رونویسی نشد» + «Audio decode error»):
    // هر recorder فقط به همان WSی می‌فرستد که هنگامِ ساختش self.ws بوده. قبلاً ondataavailable
    // همیشه به self.wsِ *لحظه‌ی* رسیدنِ chunk می‌فرستاد — liveRecِ اتصالِ قبلی تا reconnect روشن
    // می‌ماند و stop()ش ناهمگام است، پس دُمِ بی‌هدرش اولین بایت‌هایِ WSِ تازه می‌شد؛ Soniox
    // (audio_format:auto) با «Audio decode error» می‌بست و همین چرخه بعد از هر reconnect تکرار
    // می‌شد (فقط برچسبِ «اتصال دوباره برقرار شد»، بدونِ هیچ متن). T21 در scripts/rt-harness.cjs.
    var targetWs = self.ws;
    self.liveRec.ondataavailable = function (e) {
      if (e.data && e.data.size > 0 && targetWs && self.ws === targetWs && targetWs.readyState === WebSocket.OPEN) {
        try { targetWs.send(e.data); } catch (err) {}
      }
    };
    try { self.liveRec.start(250); } catch (e) {}
  };

  RTSession.prototype.stopLivePusher = function () {
    if (this.liveRec) {
      try { if (this.liveRec.state !== 'inactive') this.liveRec.stop(); } catch (e) {}
      this.liveRec = null;
    }
  };

  // طبقِ Soniox: حینِ pause، به‌جایِ صدا، پیامِ کنترلیِ keepalive بفرست تا اتصال و
  // context (شماره‌گذاریِ گوینده‌ها) زنده بمونه. حداکثر هر ۲۰ ثانیه لازمه؛ ۵ ثانیه
  // (پیش‌فرضِ خودِ SDKِ Soniox) با حاشیه‌ی امنِ کافی حتی اگه یه تیک دیر بشه.
  RTSession.prototype.startKeepalive = function () {
    var self = this;
    self.stopKeepalive();
    self.keepaliveTimer = setInterval(function () {
      try {
        if (self.ws && self.ws.readyState === WebSocket.OPEN) {
          self.ws.send(JSON.stringify({ type: 'keepalive' }));
        }
      } catch (e) {}
    }, KEEPALIVE_INTERVAL_MS);
  };
  RTSession.prototype.stopKeepalive = function () {
    if (this.keepaliveTimer) { clearInterval(this.keepaliveTimer); this.keepaliveTimer = null; }
  };

  RTSession.prototype.startDurable = function () {
    var self = this;
    if (!self.stream) return;
    // ⭐ فیکسِ race چرخش (۲۰۲۶-۰۹-۲۳، verification/2026-09-23-durable-rotation-race.md):
    // آرایه‌ی chunk محلیِ *همین* recorder است، نه یک property مشترک رویِ self. rec.stop()
    // ناهمگام است — آخرین dataavailable و onstop بعداً می‌رسند، وقتی caller (چرخش/مرزِ
    // قطعی) با startDurable() بلافاصله recorderِ بعدی را ساخته. قبلاً دُمِ recorderِ قبلی
    // به آرایه‌ی تازه می‌افتاد و onstopِ قبلی فقط همان دُمِ بی‌هدرِ EBML را ذخیره می‌کرد —
    // بدنه‌ی اصلیِ سگمنت (هدر + ~۱۴ثانیه) در RAM رها و گم می‌شد.
    var chunks = [];
    var mime = pickMime();
    try {
      self.durableRec = mime
        ? new MediaRecorder(self.stream, { mimeType: mime, audioBitsPerSecond: DURABLE_BITRATE })
        : new MediaRecorder(self.stream, { audioBitsPerSecond: DURABLE_BITRATE });
    } catch (e) {
      // بعضی مرورگرها ترکیبِ mimeType+audioBitsPerSecond رو رد می‌کنن؛ بدونِ بیت‌ریتِ صریح امتحان کن
      try {
        self.durableRec = mime ? new MediaRecorder(self.stream, { mimeType: mime }) : new MediaRecorder(self.stream);
      } catch (e2) { return; }
    }
    // ⭐ mimeِ واقعیِ گزارش‌شده توسطِ خودِ MediaRecorder (audit صدا/۲۰۲۶-۰۹-۱۶، بخشِ E) —
    // باید همین‌جا (بلافاصله بعدِ ساخت) گرفته بشه، نه داخلِ onstop: تا اون لحظه
    // stopDurableSegment از قبل self.durableRec رو null کرده (رجوع به همون تابع).
    var recordedMime = self.durableRec.mimeType || mime || 'audio/webm';
    self.durableRec.ondataavailable = function (e) {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    var rec = self.durableRec;
    // ⭐ نوشتنِ مستقیم به IndexedDB همین‌جا (نه فقط نگه‌داشتن توی RAM) — تا رفرش/بستنِ
    // تب/کرش این سگمنت رو از بین نبره. seq قبل از async شدن گرفته می‌شه که با سگمنتِ
    // بعدی (که veryممکنه بلافاصله بعدِ چرخش شروع بشه) قاطی نشه.
    // باگِ واقعی (پیدا شده بعدِ گزارشِ کاربر «صدایی ذخیره نشده»): MediaRecorder.onstop
    // غیرهمزمانه — stopDurableSegment قبلاً بی‌آنکه منتظرِ این رویداد بمونه برمی‌گشت،
    // یعنی finish() بلافاصله سراغِ archiveQueuedAudioOnly/uploadBatchSegments می‌رفت
    // درحالی‌که آخرین سگمنت (که برایِ جلساتِ کوتاه‌تر از ۶۰ثانیه، تنها سگمنتِ کلِ
    // جلسه‌ست) هنوز به IndexedDB اضافه نشده بود — نتیجه: هیچ صدایی آرشیو نمی‌شد.
    // الان یه promiseِ مشخص (rec._flushPromise) رویِ خودِ MediaRecorder نگه داشته
    // می‌شه که فقط بعدِ تمومِ AudioQueueDB.add (یا تصمیمِ «چیزی برایِ ذخیره نبود»)
    // resolve می‌شه؛ stopDurableSegment همین promise رو برمی‌گردونه.
    var resolveFlush;
    rec._flushPromise = new Promise(function (res) { resolveFlush = res; });
    rec.onstop = function () {
      // اگه abort() صدا زده شده باشه (لغوِ صریحِ کاربر)، این تکه رو دور بریز — وگرنه
      // بعدِ پاک‌سازیِ صف دوباره اضافه می‌شد و برایِ همیشه یتیم می‌موند.
      if (!chunks.length || self.aborted) { resolveFlush(); return; }
      // seq و state در لحظه‌ی stopDurableSegment ثبت شده‌اند (نه اینجا، که ممکن است بعد از
      // تغییرِ state و شروعِ سگمنتِ بعدی اجرا شود). fallback فقط برایِ recorderی است که
      // خودش (مثلاً با پایانِ track) بدونِ stopDurableSegment متوقف شده.
      var seq = typeof rec._seqAtStop === 'number' ? rec._seqAtStop : self.durableSeq++;
      var stateAtStop = rec._stateAtStop || self.state;
      // ⭐ intent تصمیمِ همین لحظه است (نه بعداً حدس‌زده‌شده در زمانِ آپلود، audit صدا/
      // ۲۰۲۶-۰۹-۱۶، بخشِ C): یادداشتِ صوتی همیشه 'note'؛ اگه realtime همین الان غیرقابل‌اعتماد
      // است یا وضعیتِ ناپایدار (reconnect/network-paused/failed)، این سگمنت باید رونویسی
      // بشه ('transcript') چون شاید هنوز جایی ثبت نشده؛ وگرنه فقط برایِ بازبینیِ ادمین
      // آرشیو کافیه ('archive'، متن از قبل از رویِ realtime درست ذخیره شده).
      // ⭐ فیکسِ باگِ duplicate واقعی (اولویتِ بالا): self.unreliable یک‌طرفه است (I4) و
      // برایِ کلِ عمرِ RTSession ثابت می‌ماند — استفاده از آن اینجا یعنی بعدِ فقط یک
      // قطعیِ کوتاه، تمامِ سگمنت‌هایِ *بعدی* هم (حتی آن‌هایی که کاملاً توی ACTIVEِ سالمِ
      // بعدِ reconnect ضبط شدند) intent='transcript' می‌گرفتند و دوباره رونویسی و با
      // mergeBatchTranscript (append) به transcript اضافه می‌شدند — متنِ از قبل درستِ
      // realtime برایِ باقیِ جلسه دوبار می‌آمد. تنها stateِ *لحظه‌ی بستنِ همین سگمنت*
      // باید تعیین‌کننده باشد، نه پرچمِ سراسریِ unreliable.
      // ⭐ و «لحظه‌ی بستن» یعنی لحظه‌ی صدا زدنِ stopDurableSegment (stateAtStop)، نه لحظه‌ی
      // اجرایِ همین onstopِ ناهمگام: callerهای مرزِ قطعی بلافاصله بعد از stop، state را
      // عوض می‌کنند — قبلاً سگمنتِ سالمِ پیش از قطعی transcript و سگمنتِ خودِ قطعی
      // archive می‌گرفت (برعکس؛ ۲۰۲۶-۰۹-۲۳).
      var intent = self.mode === 'note' ? 'note' :
        (stateAtStop === STATES.RECONNECTING || stateAtStop === STATES.NETWORK_PAUSED || stateAtStop === STATES.FAILED)
          ? 'transcript' : 'archive';
      try {
        var blob = new Blob(chunks, { type: recordedMime });
        AudioQueueDB.add(self.sessionId, self.runId, seq, blob, recordedMime, intent).then(function (ok) {
          if (!ok) {
            // سقفِ صفِ آفلاین رد شده — این سگمنت ذخیره نشد. صادقانه به caller اطلاع بده
            // تا UI بتونه هشدارِ واضح نشون بده، نه اینکه بی‌صدا صدا گم بشه.
            try { self.cb.onError('فضایِ ذخیره‌ی محلیِ صدا پر شده — صدایِ جدید ذخیره نمی‌شود'); } catch (e) {}
          }
        }).catch(function () {}).then(resolveFlush);
      } catch (e) { resolveFlush(); }
    };
    try { self.durableRec.start(1000); } catch (e) {}
    // چرخشِ خودکارِ ۱۵ثانیه‌ای — نه فقط سرِ pause/resume (توضیح بالایِ DURABLE_ROTATE_MS).
    // stop و بلافاصله start امن است چون chunks/seq/state هر recorder مالِ خودش است (بالا).
    self.durableRotateTimer = self.later(function () {
      if (self.durableRec && self.durableRec.state === 'recording') {
        self.stopDurableSegment();
        self.startDurable();
      }
    }, DURABLE_ROTATE_MS);
  };

  // برمی‌گردونه promiseِ «آخرین سگمنت واقعاً توی IndexedDB نوشته شد» — caller هایی
  // مثلِ finish() که بلافاصله بعدش سراغِ آرشیو/آپلودِ صف می‌رن باید صبر کنن (وگرنه
  // دقیقاً همون race که بالا توضیح داده شد رخ می‌ده). callerهایی که فقط می‌خوان
  // durable rotation رو ببندن (چرخشِ دوره‌ای، pause، cleanupAudio) نیازی به await
  // ندارن — promise رو نادیده می‌گیرن، بی‌ضرره.
  // ⭐ نگهبان از ۱۵۰۰ms به ۱۰۰۰۰ms افزایش یافت (audit صدا/۲۰۲۶-۰۹-۱۶): AudioQueueDB.add
  // قبل از نوشتن، totalBytes() را با خواندنِ همه‌ی blobهایِ صفِ آفلاین حساب می‌کند —
  // رویِ صفِ بزرگ (نزدیکِ سقفِ ۳۰۰MB) یا دیسکِ کندِ کاربر، این می‌تونه بیشتر از ۱.۵
  // ثانیه طول بکشه؛ اگه نگهبان زودتر fire بشه، finish()/pause() سراغِ صفی می‌رن که
  // آخرین سگمنت هنوز توش نیست — نه throw، فقط صدا بدونِ خبر جا می‌مونه.
  var DURABLE_FLUSH_GUARD_MS = 10000;
  // stateOverride: فقط finish() — که پیش از بستنِ آخرین سگمنت به FINALIZING رفته — stateِ واقعیِ
  // لحظه‌ی «پایانِ جلسه» را می‌دهد تا intentِ همان سگمنت درست حساب شود.
  RTSession.prototype.stopDurableSegment = function (stateOverride) {
    if (this.durableRotateTimer) { clearTimeout(this.durableRotateTimer); this.durableRotateTimer = null; }
    if (!this.durableRec) return Promise.resolve();
    var rec = this.durableRec;
    this.durableRec = null;
    if (rec.state === 'inactive') return Promise.resolve();
    // seq و state همین حالا (همگام) ثبت می‌شوند — onstop بعداً اجرا می‌شود (توضیحِ startDurable).
    rec._seqAtStop = this.durableSeq++;
    rec._stateAtStop = stateOverride || this.state;
    var flushP = rec._flushPromise || Promise.resolve();
    // نگهبان: اگه onstop به هر دلیلی (خطای مرورگر/state عجیب) هیچ‌وقت fire نشه،
    // finish() تا ابد قفل نمونه.
    var guarded = new Promise(function (res) {
      var done = false;
      var finish = function () { if (!done) { done = true; res(); } };
      flushP.then(finish);
      setTimeout(finish, DURABLE_FLUSH_GUARD_MS);
    });
    try { rec.stop(); } catch (e) {}
    return guarded;
  };

  // ——— WS مستقیم ———
  // ISSUE 1: ساخت WS هم به epoch گره خورده — open دیررسیده‌ی بعد از finalize/timeout
  // attach نمی‌شود، بلافاصله بسته و reject می‌شود (بدون resurrection، بدون leak).
  RTSession.prototype.openDirectWS = function (cred) {
    var self = this;
    var myEpoch = self.connEpoch;
    var epochAlive = function () {
      return !self.aborted && !self.noNewConnections && self.connEpoch === myEpoch;
    };
    return new Promise(function (resolve, reject) {
      var settled = false;
      var ws;
      try { ws = new WebSocket(cred.websocket_url); } catch (e) { reject(e); return; }
      ws.binaryType = 'arraybuffer';
      var timer = setTimeout(function () {
        if (!settled) { settled = true; try { ws.close(); } catch (e) {} reject(new Error('direct-timeout')); }
      }, CONNECT_TIMEOUT_MS);
      ws.onopen = function () {
        if (!epochAlive()) {
          clearTimeout(timer);
          if (!settled) { settled = true; }
          try { ws.close(); } catch (e) {}
          reject(new Error('superseded'));
          return;
        }
        obsEvent('rt.ws_open', {});
        try {
          ws.send(JSON.stringify({
            api_key: cred.api_key,
            model: (cred.stt_defaults && cred.stt_defaults.model) || cred.model || 'stt-rt-v5',
            audio_format: 'auto',
            language_hints: ['fa'],
            enable_language_identification: true,
            enable_speaker_diarization: true,
            // برگردوندم به true: طبقِ docsِ Soniox خاموش‌کردنش دقتِ دیاریزیشن رو کمی
            // بالا می‌بره، ولی قیمتش تاخیرِ محسوسِ finalize‌شدنِ متنِ زنده‌ست (کاربر
            // با صدایِ واقعی امتحان کرد: کاملاً کند و غیرقابل‌قبول). سرعتِ کپشنِ زنده
            // اولویتِ بالاتریه — این معاوضه به نفعِ سرعت برگشت.
            enable_endpoint_detection: true
          }));
        } catch (e) { clearTimeout(timer); if (!settled) { settled = true; reject(e); } return; }
        clearTimeout(timer);
        if (!settled) { settled = true; resolve(ws); }
      };
      ws.onerror = function () {
        clearTimeout(timer);
        obsEvent('rt.ws_error', {});
        if (!settled) { settled = true; try { ws.close(); } catch (e) {} reject(new Error('direct-error')); }
        // بعد از resolve، خطا از onclose/reconnect مدیریت می‌شود
      };
      self.attachWSHandlers(ws);
      self.ws = ws;
    });
  };

  RTSession.prototype.attachWSHandlers = function (ws) {
    var self = this;
    ws.onmessage = function (ev) { self.handleSonioxMessage(ev); };
    ws.onclose = function (ev) { self.handleWSClose(ev); };
  };

  RTSession.prototype.handleSonioxMessage = function (ev) {
    var self = this;
    var msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (msg.error_code || msg.error_type) {
      var t = String(msg.error_type || msg.error_code || '');
      if (t.indexOf('temp_api_key_session_expired') >= 0) {
        // سقف session کلید موقت — با mint تازه ادامه بده
        self.scheduleReconnect('temp-key-expired');
        return;
      }
      // خطای سرویس: کل transcript مشکوک است
      self.unreliable = true;
      try { self.cb.onError(msg.error_message || t); } catch (e) {}
      if (self.state === STATES.ACTIVE || self.state === STATES.STARTING) self.scheduleReconnect('soniox-error');
      return;
    }
    var toks = msg.tokens || [];
    if (!toks.length && !msg.finished) return;
    var nonFinal = '';
    var grew = false;
    toks.forEach(function (tk) {
      if (!tk.text) return;
      if (tk.is_final) {
        if (tk.speaker != null) {
          // شماره‌ی خامِ Soniox فقط داخلِ همین نسلِ اتصال معتبره — کلید رو با نسل قاطی می‌کنیم
          // تا گوینده‌هایِ نسل‌هایِ مختلف هیچ‌وقت زیرِ یه برچسب قاطی نشن.
          var speakerKey = self.generation + ':' + tk.speaker;
          if (!(speakerKey in self.speakerLabelMap)) {
            self.speakerLabelMap[speakerKey] = self.nextSpeakerLabel++;
          }
          var globalSpeaker = self.speakerLabelMap[speakerKey];
          if (globalSpeaker !== self.curSpeaker) {
            self.curSpeaker = globalSpeaker;
            var faSp = String(globalSpeaker).replace(/[0-9]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; });
            self.confirmed += (self.confirmed ? '\n\n' : '') + 'گوینده ' + faSp + ': ';
          }
        }
        self.confirmed += tk.text;
        grew = true;
      } else {
        nonFinal += tk.text;
      }
    });
    self.interim = nonFinal;
    if (grew) self.dirty = true;
    try { self.cb.onResult({ final: cleanText(self.confirmed), interim: cleanText(self.interim) }); } catch (e) {}
    if (msg.finished && self.state === STATES.FINALIZING && self.finishResolver) {
      var r = self.finishResolver; self.finishResolver = null;
      r({ finishedEvent: true });
    }
  };

  RTSession.prototype.handleWSClose = function (ev) {
    var self = this;
    // ⭐ فازِ ۲: کدِ بستنِ واقعیِ WS (مثلاً ۱۰۰۶ برایِ قطعیِ غیرطبیعی) ثبت می‌شود.
    // ev.reason عمداً هیچ‌وقت خوانده/فرستاده نمی‌شود — متنِ آزادِ سرور/Soniox است و
    // با اسکیمای allowlistِ redact.ts (LAW-001) خودش فیلتر می‌شد؛ برای وضوح همین‌جا
    // هم لمسش نمی‌کنیم.
    obsEvent('rt.ws_close', {
      close_code: ev && typeof ev.code === 'number' ? ev.code : null,
      was_clean: ev && typeof ev.wasClean === 'boolean' ? ev.wasClean : null
    });
    if (self.closingIntentional || self.aborted) return;
    if (self.state === STATES.MANUAL_PAUSED || self.state === STATES.FINALIZING ||
        self.state === STATES.COMPLETED || self.state === STATES.CANCELED) return;
    // قطع غافلگیرانه وسط ضبط → reconnect (confirmed حفظ، interim دور)
    self.scheduleReconnect('closed');
  };

  RTSession.prototype.scheduleReconnect = function (reason) {
    var self = this;
    if (self.aborted) return;
    if (self.state === STATES.MANUAL_PAUSED || self.state === STATES.FINALIZING ||
        self.state === STATES.COMPLETED || self.state === STATES.CANCELED) return;
    // ⭐ الان سه منبعِ مستقل می‌توانند scheduleReconnect را صدا بزنند: handleWSClose،
    // خطایِ Soniox، و watchdogِ readyState (پایین‌ترِ همین فایل). اگه یک تلاشِ reconnect
    // از قبل زمان‌بندی‌شده/در حالِ اجراست، دوباره schedule نکن — وگرنه دو mint/WS موازی
    // برایِ همون قطعیِ واحد باز می‌شد. این با retryِ داخلیِ خودِ همین تابع (که عمداً
    // وقتی state از قبل RECONNECTING است دوباره صدا زده می‌شود) تداخل ندارد چون پرچم
    // دقیقاً قبل از همون فراخوانیِ داخلی پاک می‌شود (پایین‌ترِ همین تابع).
    if (self.reconnectInFlight) return;
    // ⭐ مکملِ فیکسِ intent بالا: اگه همین الان ACTIVE بودیم (مرزِ واقعیِ خروج از حالتِ
    // سالم — نه یه retryِ دیگه از وسطِ RECONNECTING)، سگمنتِ durableِ در حالِ ضبط را
    // همین‌جا ببند و یکیِ تازه شروع کن. وگرنه یه سگمنتِ ۱۵ثانیه‌ایِ در حالِ چرخش می‌توانست
    // هم صدایِ سالمِ قبل از قطعی هم صدایِ بعدِ قطعی را با هم داشته باشد و با یک intent
    // (لزوماً درست برایِ کلِ محتوایش نه) آپلود شود.
    if (self.state === STATES.ACTIVE && self.durableRec) {
      self.stopDurableSegment();
      self.startDurable();
    }
    if (self.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      obsEvent('rt.reconnect_exhausted', { attempt: self.reconnectAttempts, reason: safeReasonToken(reason) });
      if (!self.unreliable) obsEvent('rt.unreliable_set', { reason: 'reconnect_exhausted' });
      self.unreliable = true;
      self.setState(STATES.FAILED);
      try { self.cb.onError('اتصالِ زنده قطع شد؛ ضبط ادامه دارد و متن پس از پایان آماده می‌شود'); } catch (e) {}
      return;
    }
    var delay = RECONNECT_BACKOFF_MS[Math.min(self.reconnectAttempts, RECONNECT_BACKOFF_MS.length - 1)];
    self.reconnectAttempts++;
    obsEvent('rt.reconnect_scheduled', { reason: safeReasonToken(reason), attempt: self.reconnectAttempts, delay_ms: delay });
    self.hadGap = true;
    if (!self.unreliable) obsEvent('rt.unreliable_set', { reason: 'reconnect' });
    self.unreliable = true; // یک‌طرفه: گپ احتمالی یعنی دیگر قابل‌اعتماد کامل نیست
    self.interim = ''; // interim قبلی discard — از نقطه امن ادامه
    try { if (self.ws) self.ws.close(); } catch (e) {}
    self.ws = null;
    self.stopLivePusher(); // WSش رفته؛ اتصالِ تازه recorderِ تازه (با هدر) می‌سازد — startLivePusher
    self.setState(STATES.RECONNECTING);
    // از همین‌جا تا resolveِ connectWithFreshMint (چه موفق چه ناموفق) «در حالِ کار» است.
    self.reconnectInFlight = true;
    self.later(function () {
      if (self.aborted || self.noNewConnections) { self.reconnectInFlight = false; return; }
      if (self.state !== STATES.RECONNECTING) { self.reconnectInFlight = false; return; }
      self.connectWithFreshMint().then(function (ok) {
        self.reconnectInFlight = false;
        if (!ok && !self.noNewConnections && self.state === STATES.RECONNECTING) self.scheduleReconnect('retry');
      });
    }, delay);
  };

  // BUG-FIX (speaker continuity): Soniox شماره‌گذاری speaker را در هر اتصال WS تازه
  // از صفر شروع می‌کند (مستند نیست، ولی هیچ پارامتری هم برای ادامه‌ی آن بین اتصال‌ها
  // وجود ندارد). یعنی «گوینده ۰» قبل از یک reconnect/resume ربطی به «گوینده ۰» بعد از
  // آن ندارد. به‌جای وانمود به تداوم (که می‌تواند حرف اشتباه را به شخص اشتباه نسبت
  // دهد — خطرناک برای یادداشت درمانی)، این نقطه را صریح در transcript علامت می‌زنیم
  // و شماره‌گذاری را از نو (با اولین لیبل تازه) شروع می‌کنیم.
  RTSession.prototype.noteDiscontinuity = function () {
    obsEvent('rt.gap_marked', {});
    this.curSpeaker = null;
    this.confirmed += (this.confirmed ? '\n\n' : '') +
      '[اتصال دوباره برقرار شد — شماره‌گذاری گوینده‌ها از این نقطه ممکن است با قبل فرق کند]';
    this.dirty = true;
  };

  // اتصال با credential تازه (هر reconnect یک mint — single_use).
  // موفق → true؛ ناموفق → false (caller تصمیم reconnect/FAILED می‌گیرد).
  // ISSUE 1: هر تلاش به connEpoch لحظه‌ی شروع گره خورده؛ اگر تا زمان resolve،
  // finalize/abort epoch را باطل کرده باشد، نتیجه دور ریخته می‌شود.
  RTSession.prototype.connectWithFreshMint = function () {
    var self = this;
    if (self.aborted || self.noNewConnections) return Promise.resolve(false);
    var myEpoch = self.connEpoch;
    var epochAlive = function () {
      return !self.aborted && !self.noNewConnections && self.connEpoch === myEpoch;
    };
    // ⭐ فیکسِ باگِ واقعی: بدونِ این، mint برایِ یادداشتِ صوتی (که همیشه بعدِ
    // PUT status='completed' اتفاق می‌افتد — همون‌جا که endNewRTSession صدا می‌زند)
    // همیشه با ۴۰۰ رد می‌شد، چون سرور جلسه‌ی completed را برای mint مسدود می‌کرد.
    // نتیجه: یادداشتِ صوتی هیچ‌وقت credential نمی‌گرفت، همیشه fail-open به
    // durable-only می‌رفت — نه گاه‌به‌گاه، صددرصد. جلسه‌ی زنده (mode:'live')
    // چون هنوز completed نیست، هیچ‌وقت این مانع را نمی‌دید.
    return mintCredential(self.sessionId, self.mode === 'note' ? 'note' : 'transcript').then(function (cred) {
      if (!epochAlive()) return false;
      return self.openDirectWS(cred).then(function (ws) {
        if (!epochAlive()) {
          try { ws.close(); } catch (e) {}
          if (self.ws === ws) self.ws = null;
          return false;
        }
        self.ws = ws;
        // BUG-FIX: هر اتصال بعد از اولین (چه reconnect چه resume دستی) یک دیارizationِ
        // تازه‌ی Soniox است — قبل از افزایش generation علامت بزن (شرط روی مقدار فعلی).
        var isReconnect = self.generation > 0;
        var attemptsUsed = self.reconnectAttempts;
        self.generation++;
        self.reconnectAttempts = 0;
        self.realtimeUp = true;
        if (isReconnect) {
          obsEvent('rt.reconnect_ok', { attempt: attemptsUsed });
          self.noteDiscontinuity();
        }
        // استریمر زنده روی همان stream با MediaRecorder تازه (هدر تازه)؛ durable دست‌نخورده ادامه می‌دهد
        self.startLivePusher();
        // ⭐ همان مرزبندیِ سگمنت، سمتِ بازگشت: اگه این reconnect دنباله‌ی یک gapِ واقعی
        // است (hadGap)، سگمنتِ در حالِ ضبط (که تا همین لحظه با state=RECONNECTING/
        // NETWORK_PAUSED/FAILED بسته می‌شد و درست intent=transcript می‌گرفت) را ببند و
        // یکیِ تازه شروع کن — تا سگمنت‌هایِ *بعدِ* این نقطه (حالا که واقعاً ACTIVE شدیم)
        // به‌درستی intent=archive بگیرند، نه اینکه توی همون سگمندِ مرزی قاطی بمانند.
        if (self.hadGap && self.durableRec) {
          self.stopDurableSegment();
          self.startDurable();
        }
        self.setState(self.hadGap ? STATES.RECOVERED : STATES.ACTIVE);
        if (self.hadGap) {
          // RECOVERED گذراست — بلافاصله ACTIVE با پرچم gap
          self.setState(STATES.ACTIVE);
        }
        return true;
      });
    }).catch(function (err) {
      // DIAG-TEMP: قبلاً دلیلِ واقعیِ شکستِ mint/اتصال (mint-transport، direct-timeout،
      // direct-error، رِیت‌لیمیت، …) هیچ‌جا لاگ نمی‌شد — فقط false برمی‌گشت و کاربر/توسعه‌دهنده
      // هیچ راهی برایِ فهمیدنِ «چرا رونویسیِ زنده وصل نشد» نداشت (نه دادهٔ حساس؛ فقط status/code).
      try {
        console.warn('[feelia-rt] connect failed: status=' + (err && err.status) +
          ' code=' + (err && err.code) + ' message=' + (err && err.message));
      } catch (e) {}
      // فازِ ۲: mint-fail (و هر شکستِ دیگرِ همین مسیر — direct-timeout/direct-error هم
      // از همین catch رد می‌شن چون از .then(mintCredential).then(openDirectWS) هستن) —
      // فقط status/code (نه message/متنِ آزاد) که از قبل هم در allowlistِ redact.ts است.
      obsEvent('rt.mint_failed', {
        status: (err && typeof err.status === 'number') ? err.status : null,
        code: (err && typeof err.code === 'string') ? err.code : null
      });
      // 401 یعنی نشست Feelia مرده — reconnect بی‌فایده است
      if (err && err.status === 401) {
        self.setState(STATES.FAILED);
        try { self.cb.onError('نشست منقضی شده — دوباره وارد شوید'); } catch (e) {}
        return false;
      }
      return false;
    });
  };

  // ——— lifecycle ———
  // ISSUE 4: شروع fail-open است — اگر میکروفون آماده ولی mint/connect ناموفق بود،
  // به‌جای fallback به legacy proxy (که همان egress خراب را لازم دارد)، وارد حالت
  // durable-only می‌شود: ضبط محلی ادامه می‌یابد و finish از صف batch استفاده می‌کند.
  // فقط وقتی false برمی‌گردد که میکروفون هم در دسترس نباشد (آن‌وقت glue پیام می‌دهد).
  RTSession.prototype.start = function () {
    var self = this;
    if (self.state !== STATES.IDLE) return Promise.resolve(false);
    self.aborted = false;
    self.noNewConnections = false;
    self.realtimeUp = false;
    self.startedAt = Date.now();
    // فازِ ۲: قلابِ فازِ ۱ که تا اینجا از هیچ‌کجا صدا زده نمی‌شد — همین‌جا rt.* بعدی‌ها
    // به session_id/run_idِ درستِ همین RTSession متصل می‌شوند (obs_events.run_id ⟷
    // session_audio.run_id، هر دو از همین genRunId()).
    try { if (window.FeeliaObs && typeof window.FeeliaObs.setSession === 'function') window.FeeliaObs.setSession(self.sessionId, self.runId); } catch (e) {}
    self.setState(STATES.STARTING);
    // نسخه پایه transcript برای CAS (اگر DB متنی از قبل دارد، ادامه همان)
    var baseP = self.persist
      ? reqJson('/api/sessions/' + self.sessionId).then(function (r) {
          var t = (r.session && r.session.transcript) || '';
          if (t && t.length > self.confirmed.length) self.confirmed = t;
          self.persistedText = t;
          self.baseVersion = (r.session && r.session.transcript_version) || 0;
        }).catch(function () {})
      : Promise.resolve();
    return baseP.then(function () {
      if (self.aborted) return false;
      return self.ensureStream().then(function () {
        if (self.aborted) return false;
        return self.connectWithFreshMint().then(function (ok) {
          // ISSUE 1: اگر حین mint/connect، finish/abort آمده باشد، هیچ تغییری در state نده —
          // فقط تمیز کن و false بده (COMPLETED/CANCELED هرگز برنمی‌گردد).
          if (self.noNewConnections || self.aborted) { self.cleanupAudio(); return false; }
          if (!ok) {
            // FAIL-OPEN (ISSUE 4): realtime بالا نیامد ولی میکروفون داریم —
            // صادقانه FAILED با ضبط durable؛ legacy proxy صدا زده نمی‌شود.
            if (!self.unreliable) obsEvent('rt.unreliable_set', { reason: 'start_fail_open' });
            self.unreliable = true;
            self.realtimeUp = false;
            self.startDurable();
            self.watchOnline(); // اگر اینترنت برگشت، reconnect می‌تواند realtime را بالا بیاورد
            self.setState(STATES.FAILED);
            try { self.cb.onError('رونویسیِ زنده در دسترس نیست؛ صدا در حال ضبط است و متن پس از پایان آماده می‌شود'); } catch (e) {}
            return true;
          }
          self.startDurable();
          self.startAutosave();
          self.startWsWatchdog();
          self.watchOnline();
          self.setState(STATES.ACTIVE);
          return true;
        });
      });
    }).catch(function () {
      // اینجا فقط خطای میکروفون/abort می‌رسد (connect خودش false می‌دهد، نه throw)
      if (!self.aborted) self.setState(STATES.FAILED);
      self.cleanupAudio();
      return false;
    });
  };

  RTSession.prototype.watchOnline = function () {
    var self = this;
    try {
      self.offlineHandler = function () {
        if (self.state === STATES.ACTIVE || self.state === STATES.RECONNECTING) {
          // همان مرزبندیِ سگمنت — فقط وقتی از ACTIVEِ سالم واردِ آفلاین می‌شویم (نه از
          // RECONNECTINGی که قبلاً خودش مرز را بسته)، سگمنتِ جاری را ببند/دوباره شروع کن.
          if (self.state === STATES.ACTIVE && self.durableRec) {
            self.stopDurableSegment();
            self.startDurable();
          }
          self.setState(STATES.NETWORK_PAUSED);
        }
      };
      self.onlineHandler = function () {
        if (self.state === STATES.NETWORK_PAUSED) { self.scheduleReconnect('online'); return; }
        // ⭐ باگِ واقعی (audit صدا/۲۰۲۶-۰۹-۱۶، یافته‌ی #۱۶ — با تستِ زنده‌ی قطعیِ کاملِ
        // شبکه پیدا شد): بعد از اتمامِ MAX_RECONNECT_ATTEMPTS، state=FAILED می‌شود و این
        // handler قبلاً فقط NETWORK_PAUSED را می‌دید — یعنی برگشتنِ اینترنت هیچ‌وقت
        // رونویسیِ زنده را دوباره فعال نمی‌کرد (چه سشنی که واقعاً قطع شده بود، چه سشنی
        // که از همون اول durable-only شروع شده بود، هر دو با state=FAILED به اینجا
        // می‌رسند)؛ صدا حفظ می‌شد ولی متن تا پایانِ جلسه/batch fallback صبر می‌کرد.
        // الان با شمارشِ تازه‌ی reconnectAttempts یک تلاشِ کاملِ دیگر می‌کند.
        if (self.state === STATES.FAILED && !self.aborted && !self.noNewConnections) {
          self.reconnectAttempts = 0;
          self.scheduleReconnect('online-after-failed');
        }
      };
      window.addEventListener('offline', self.offlineHandler);
      window.addEventListener('online', self.onlineHandler);
    } catch (e) {}
  };

  RTSession.prototype.unwatchOnline = function () {
    try {
      if (this.offlineHandler) window.removeEventListener('offline', this.offlineHandler);
      if (this.onlineHandler) window.removeEventListener('online', this.onlineHandler);
    } catch (e) {}
    this.offlineHandler = this.onlineHandler = null;
  };

  // مکملِ فیکسِ intent/segment-boundary: تنگ‌کردنِ پنجره‌ی تشخیصِ قطعیِ «بی‌صدا» — چون
  // readyStateِ خودِ WebSocket را می‌خواند (نه cadenceِ پیام‌های Soniox)، رویِ سکوتِ
  // طبیعیِ گفتگو هرگز فایر نمی‌شود.
  RTSession.prototype.startWsWatchdog = function () {
    var self = this;
    if (self.wsWatchdogTimer) clearInterval(self.wsWatchdogTimer);
    self.wsWatchdogTimer = setInterval(function () {
      if (self.state === STATES.ACTIVE && (!self.ws || self.ws.readyState !== WebSocket.OPEN)) {
        obsEvent('rt.watchdog_fired', {});
        self.scheduleReconnect('watchdog-ws-not-open');
      }
    }, WS_WATCHDOG_MS);
  };

  RTSession.prototype.startAutosave = function () {
    var self = this;
    if (!self.persist) return;
    if (self.autosaveTimer) clearInterval(self.autosaveTimer);
    self.autosaveFailStreak = 0;
    self.autosaveTimer = setInterval(function () {
      if (self.dirty && (self.state === STATES.ACTIVE || self.state === STATES.RECOVERED)) {
        self.dirty = false;
        self.persistConfirmed().then(function () {
          self.autosaveFailStreak = 0;
        }).catch(function () {
          self.dirty = true;
          self.autosaveFailStreak++;
          // BUG-FIX: قبلاً شکست‌های پیاپی ذخیره‌سازی کاملاً بی‌صدا بودند — کاربر تا پایان
          // جلسه متوجه نمی‌شد که متن چند دقیقه است ذخیره نشده. بعد از ۳ شکست پیاپی
          // (~۱۵ ثانیه) یک بار هشدار بده؛ متن هنوز در RAM/durable حفظ است.
          if (self.autosaveFailStreak === 3) {
            try { self.cb.onError('ذخیره‌ی خودکار متن چند بار پیاپی ناموفق بوده — اتصال اینترنت را بررسی کنید؛ متن فعلی و ضبط محلی حفظ است'); } catch (e) {}
          }
        });
      }
    }, AUTOSAVE_MS);
  };

  // ذخیره امن با CAS؛ هرگز overwrite کور نیست. برمی‌گرداند متن مرجع فعلی.
  RTSession.prototype.persistConfirmed = function () {
    var self = this;
    if (!self.persist) return Promise.resolve(self.confirmed);
    var text = cleanText(self.confirmed);
    return reqJson('/api/sessions/' + self.sessionId, {
      method: 'PUT',
      body: { transcript: text, transcript_version: self.baseVersion, realtime_reliable: !self.unreliable, stt_mode: 'realtime' }
    }).then(function () {
      self.baseVersion++;
      self.persistedText = text;
      return text;
    }).catch(function (err) {
      if (err && err.status === 409) {
        // نسخه جدیدتر آمده — تازه‌سازی و rebase (متن طولانی‌تر برنده است)
        return reqJson('/api/sessions/' + self.sessionId).then(function (r) {
          var serverText = (r.session && r.session.transcript) || '';
          self.baseVersion = (r.session && r.session.transcript_version) || 0;
          // ⭐ باگِ واقعی (گزارشِ مالک ۲۰۲۶-۰۹-۲۳: «نوشت متنش بعداً اضافه می‌شه، ولی متنی ذخیره نشد»):
          // صدایِ دوره‌ی قطعی حینِ جلسه آپلود و سمتِ سرور به انتهایِ transcript *append* می‌شود
          // (mergeBatchTranscript) و نسخه بالا می‌رود. اینجا قبلاً فقط طول مقایسه می‌شد: اگر متنِ
          // زنده‌ی مرورگر از آخرین ذخیره بیشتر از متنِ batch رشد کرده بود، کلِ متنِ سرور — همراهِ
          // متنِ بازیابی‌شده‌ی قطعی — با متنِ مرورگر بازنویسی و برای همیشه گم می‌شد (LAW-008).
          // اگر هر دو طرف فقط به همان آخرین متنِ ذخیره‌شده اضافه کرده‌اند، هر دو افزوده حفظ می‌شوند.
          var base = self.persistedText || '';
          var nowText = cleanText(self.confirmed);
          if (serverText.length > base.length && serverText.indexOf(base) === 0 && nowText.indexOf(base) === 0) {
            var tail = nowText.slice(base.length).replace(/^\s+/, '');
            self.confirmed = serverText + (tail ? '\n\n' + tail : '');
            self.curSpeaker = null; // بعد از بلوکِ batch، گفته‌ی بعدی دوباره برچسبِ گوینده بگیرد
            var merged = cleanText(self.confirmed);
            return reqJson('/api/sessions/' + self.sessionId, {
              method: 'PUT',
              body: { transcript: merged, transcript_version: self.baseVersion, realtime_reliable: !self.unreliable, stt_mode: 'realtime' }
            }).then(function () { self.baseVersion++; self.persistedText = merged; return merged; });
          }
          if (serverText.length >= text.length) {
            if (serverText.length > self.confirmed.length) self.confirmed = serverText;
            self.persistedText = serverText;
            return serverText;
          }
          // سرور کوتاه‌تر است (مثلاً قدیمی) — یک بار با نسخه تازه تلاش کن
          return reqJson('/api/sessions/' + self.sessionId, {
            method: 'PUT',
            body: { transcript: text, transcript_version: self.baseVersion, realtime_reliable: !self.unreliable, stt_mode: 'realtime' }
          }).then(function () { self.baseVersion++; self.persistedText = text; return text; });
        });
      }
      throw err;
    });
  };

  RTSession.prototype.pause = function () {
    var self = this;
    if (self.state !== STATES.ACTIVE && self.state !== STATES.RECOVERED) return Promise.resolve(false);
    self.setState(STATES.MANUAL_PAUSED);
    self.stopDurableSegment(); // سگمنت durable این بازه بسته شد — مستقل از Soniox، فوری
    // باگِ ریشه‌ای: این پاکسازی همیشه ۲ ثانیه (PAUSE_FLUSH_MS) بعد اجرا می‌شد، بدونِ
    // هیچ چک‌ای که آیا کاربر توی همین فاصله «ادامه» زده یا نه. اگه زده باشه، resume()
    // تا اون لحظه یه WS و MediaRecorder کاملاً تازه ساخته، ولی این done()ی قدیمی
    // (که فکر می‌کرد هنوز داره از همون pause حرف می‌زنه) دقیقاً همون WS/streamِ تازه
    // رو می‌بست و پاک می‌کرد — نتیجه: رونویسیِ زنده برای همیشه فریز می‌شد، حتی با
    // اینترنتِ کاملاً سالم. الان با یه توکن مشخص می‌شه این pause هنوز معتبره یا
    // یه resume از وسط اومده و باطلش کرده.
    var myPauseToken = ++self.pauseToken;
    // قبلاً finalize بی‌درنگِ همین لحظه فرستاده می‌شد و live-pusher هم بی‌درنگ می‌ایستاد
    // — یعنی صفر میلی‌ثانیه زمینه‌ی صوتیِ اضافه بعدِ آخرین کلمه. با کمی صبر (که میکروفون
    // و ارسالِ صدا در همین حین ادامه دارن)، Soniox زمینه‌ی کافی برایِ بستنِ درستِ آخرین
    // گفته و نسبت‌دادنِ درستِ گوینده داره.
    var sendFinalize = function () {
      if (self.pauseToken !== myPauseToken) return; // resume از وسط اومده
      self.stopLivePusher();
      try {
        if (self.ws && self.ws.readyState === WebSocket.OPEN) {
          try { self.ws.send(JSON.stringify({ type: 'finalize' })); } catch (e) {}
        }
      } catch (e) {}
    };
    var done = function () {
      if (self.pauseToken !== myPauseToken) return; // resume از وسط اومده — این pause دیگه بی‌اعتباره
      // ⭐ باگِ ریشه‌ایِ معماری (طبقِ مستنداتِ رسمیِ Soniox — «Connection keepalive»،
      // «Pause and resume»): WS رو نبند! pauseِ واقعیِ Soniox یعنی «اتصال زنده بمونه،
      // فقط صدا نره»؛ به‌جاش هر چندثانیه یه پیامِ کنترلیِ {"type":"keepalive"} بفرست.
      // این دقیقاً «Session context (e.g., speaker labels...) is preserved» رو هم
      // تضمین می‌کنه. پیاده‌سازیِ قبلی (بستنِ WS + mintِ کاملاً تازه سرِ resume)
      // دقیقاً برخلافِ این بود — هم شماره‌گذاریِ گوینده رو سرِ هر توقف/ادامه‌ی عادی
      // ریست می‌کرد، هم لگ/شکنندگیِ resume (mint دوباره، WSِ تازه، ری‌اکوایرِ میکروفون
      // هم‌زمان) ایجاد می‌کرد — دقیقاً همون چیزی که با صدایِ واقعی گزارش شد.
      // ⭐ باگِ واقعی: برخلافِ scheduleReconnect (که interim رو دور می‌ریزه چون اون
      // اتصال دیگه برنمی‌گرده)، اینجا self.interim دست‌نخورده می‌موند — یعنی اگه کاربر
      // وسطِ یه جمله‌ی نیمه‌تموم توقف می‌زد، همون تکه‌ی «در حالِ نوشتنِ» قدیمی رویِ صفحه
      // می‌موند تا هر وقت اولین پیامِ بعدی برسه. تا این لحظه (۲ ثانیه بعدِ finalize)
      // Soniox فرصتِ کافی برایِ نهایی‌کردنش داشته؛ هرچی نهایی نشده باشه واقعاً از دست
      // رفته — پس محلی هم پاکش کن.
      self.interim = '';
      // میکروفون آزاد شود (حریم خصوصی/موبایل) — resume دوباره می‌گیرد؛ خودِ WS
      // دست‌نخورده باز می‌مونه (cleanupAudio هیچ‌وقت به self.ws دست نمی‌زنه)
      self.cleanupAudio();
      self.startKeepalive();
      if (self.persist) self.persistConfirmed().catch(function () {});
    };
    return new Promise(function (res) {
      var t1 = setTimeout(sendFinalize, PAUSE_SILENCE_BUFFER_MS);
      self.timers.push(t1);
      var t2 = setTimeout(function () { done(); res(self.pauseToken === myPauseToken); }, PAUSE_SILENCE_BUFFER_MS + PAUSE_FLUSH_MS);
      self.timers.push(t2);
    });
  };

  RTSession.prototype.resume = function () {
    var self = this;
    if (self.state !== STATES.MANUAL_PAUSED) return Promise.resolve(false);
    self.pauseToken++; // هر pauseِ درحال‌انتظار رو باطل کن — دیگه حق نداره WS/streamِ تازه رو ببنده
    self.stopKeepalive();
    self.setState(STATES.STARTING);
    if (self.aborted) return Promise.resolve(false);
    // ⭐ مسیرِ سریع (طبقِ Soniox): چون pause دیگه WS رو نمی‌بنده، همون اتصال هنوز
    // بازه — فقط میکروفون رو دوباره بگیر و صدا رو رویِ همون WS از سر بگیر. نه
    // mintِ تازه، نه WSِ تازه، نه ریست‌شدنِ شماره‌گذاریِ گوینده‌ها.
    if (self.ws && self.ws.readyState === WebSocket.OPEN) {
      return self.ensureStream().then(function () {
        if (self.aborted) { self.cleanupAudio(); return false; }
        if (!self.ws || self.ws.readyState !== WebSocket.OPEN) return self.resumeWithFreshConnection();
        self.startLivePusher();
        self.startDurable(); // سگمنت durable جدید
        self.setState(STATES.ACTIVE);
        return true;
      }).catch(function () { return self.resumeWithFreshConnection(); });
    }
    // مسیرِ کندترِ fallback: اتصال واقعاً بسته شده (مثلاً یه قطعیِ واقعیِ شبکه‌یِ
    // طولانی‌تر از تحملِ keepalive) — دقیقاً مثلِ reconnectِ خودکار، mint/WS تازه.
    return self.resumeWithFreshConnection();
  };

  // باگِ واقعی (گزارشِ کاربر: «بعدِ ادامه یکی‌دو بار زدم تا گرفت»): ری‌ترایِ قبلی
  // فقط رویِ connectWithFreshMint بود، نه ensureStream — یعنی اگه گرفتنِ دوباره‌ی
  // میکروفون رویِ سخت‌افزارِ واقعی یه‌بار گذرا شکست می‌خورد یا کند بود، کلِ resume
  // بدونِ هیچ retry شکست می‌خورد و کاربر مجبور بود خودش دوباره «ادامه» بزنه. الان
  // ensureStream هم داخلِ همون حلقه‌ی retryه.
  RTSession.prototype.resumeWithFreshConnection = function () {
    var self = this;
    self.closingIntentional = false;
    if (self.aborted) return Promise.resolve(false);
    var attempt = 0;
    var tryConnect = function () {
      return self.ensureStream().then(function () {
        if (self.aborted) return false;
        return self.connectWithFreshMint();
      }).catch(function () { return false; }).then(function (ok) {
        // ISSUE 1: مثل start — نتیجه‌ی دیررسیده حق تغییر state نهایی را ندارد.
        if (self.noNewConnections || self.aborted) { self.cleanupAudio(); return false; }
        if (ok) {
          self.startDurable(); // سگمنت durable جدید
          self.setState(STATES.ACTIVE);
          return true;
        }
        attempt++;
        // اگه کاربر همون حین (مثلاً با «پایان جلسه») state رو عوض کرده، دیگه تلاشِ
        // بعدی معنی نداره — connEpoch/noNewConnections از قبل جلویِ resurrection رو گرفته
        if (attempt >= RESUME_MAX_ATTEMPTS || self.state !== STATES.STARTING) return false;
        return new Promise(function (res) {
          self.later(res, RESUME_RETRY_BACKOFF_MS[Math.min(attempt - 1, RESUME_RETRY_BACKOFF_MS.length - 1)]);
        }).then(function () {
          if (self.aborted || self.noNewConnections || self.state !== STATES.STARTING) return false;
          return tryConnect();
        });
      });
    };
    return tryConnect().then(function (ok) {
      if (!ok && !self.aborted && !self.noNewConnections && self.state === STATES.STARTING) {
        self.setState(STATES.MANUAL_PAUSED);
      }
      return ok;
    });
  };

  // finish رویدادمحور: توقف ورودی → finalize → انتظار finished/timeout صریح →
  // تعیین reliability → persist → در صورت نیاز آپلود batch (بدون انتظار برای drain) → COMPLETED.
  // ISSUE 1: در ابتدای finalize، epoch باطل می‌شود تا mint/WS دیررسیده نتواند resurrection کند.
  // ISSUE 2: finish منتظر drain شدن batch نمی‌ماند؛ تخلیه صف در پس‌زمینه با awaitBatchDrain دنبال می‌شود.
  RTSession.prototype.finish = function (opts) {
    var self = this;
    opts = opts || {};
    if (self.state === STATES.COMPLETED || self.state === STATES.CANCELED) {
      return Promise.resolve({ text: cleanText(self.confirmed), reliable: !self.unreliable, mode: 'realtime' });
    }
    // باگِ ریشه‌ای (دفاعی — از مسیرِ UI فعلی قابلِ‌تریگر نیست چون دکمه سنکرون قفل
    // می‌شه، ولی خودِ کلاس امن نبود): اگه finish() دوباره صدا زده بشه وقتی یه finish
    // قبلی هنوز FINALIZING است، clearTimers() پایین‌ترِ همین تابع، هم تایمرِ fallback
    // هم finishResolverِ تماسِ اول رو پاک/بازنویسی می‌کرد — یعنی promiseِ تماسِ اول
    // برای همیشه معلق می‌موند. الان تماسِ دوم همون promiseِ در-حالِ-اجرا رو می‌گیره.
    if (self.state === STATES.FINALIZING && self._finishPromise) {
      return self._finishPromise;
    }
    self.noNewConnections = true; // ابطال همه mint/WS/reconnect در-flight
    self.connEpoch++;
    // ⭐ stateِ لحظه‌ی پایان — آخرین سگمنتِ durable پایین‌تر (بعد از FINALIZING) بسته می‌شود؛ بدونِ این،
    // پایان در FAILED/RECONNECTING/NETWORK_PAUSED آن سگمنت را archive می‌کرد و صدایش هرگز رونویسی
    // نمی‌شد (در جلسه‌ی durable-only کوتاه‌تر از ۱۵ث یعنی کلِ متن). ۲۰۲۶-۰۹-۲۳، T16x/T16y.
    var stateAtFinish = self.state;
    self.setState(STATES.FINALIZING);
    self.clearTimers();
    self.stopKeepalive(); // اگه از MANUAL_PAUSED مستقیم finish شده، تایمرِ keepalive نشتی نمونه
    self.stopLivePusher();
    var waitFinished;
    if (self.ws && self.ws.readyState === WebSocket.OPEN) {
      try { self.ws.send(JSON.stringify({ type: 'finalize' })); } catch (e) {}
      try { self.ws.send(''); } catch (e) {}
      waitFinished = new Promise(function (res) {
        self.finishResolver = res;
        self.later(function () {
          if (self.finishResolver) { self.finishResolver = null; res({ timeout: true }); }
        }, FINALIZE_TIMEOUT_MS);
      });
    } else {
      waitFinished = Promise.resolve({ timeout: true });
    }
    self._finishPromise = waitFinished.then(function () {
      self.closingIntentional = true;
      try { if (self.ws) self.ws.close(); } catch (e) {}
      self.ws = null;
      self.closingIntentional = false;
      // ⭐ باید صبر کرد تا آخرین سگمنتِ durable واقعاً توی IndexedDB نوشته بشه — وگرنه
      // archiveQueuedAudioOnly/uploadBatchSegments (پایین همین زنجیره) صفِ خالی
      // می‌دیدن و برایِ جلساتِ کوتاه‌تر از ۶۰ثانیه هیچ صدایی آرشیو نمی‌شد.
      return self.stopDurableSegment(stateAtFinish).then(function () {
        var realtimeText = cleanText(self.confirmed);
        if (!self.unreliable) {
          // مسیر موفق: persist نهایی و تمام
          var p = self.persist ? self.persistConfirmed().catch(function () { return realtimeText; }) : Promise.resolve(realtimeText);
          return p.then(function (saved) {
            if (self.persist) {
              reqJson('/api/sessions/' + self.sessionId, {
                method: 'PUT', body: { realtime_reliable: true, stt_mode: 'realtime' }
              }).catch(function () {});
              // ⭐ متن از قبل کامل و درسته (رونویسیِ دوباره لازم نیست، ریسکِ duplicate هم
              // داره) — پس فقط صدا رو برایِ بازبینیِ ادمین آرشیو کن، نه merge.
              self.archiveQueuedAudioOnly();
            }
            self.cleanupAudio();
            self.unwatchOnline();
            self.setState(STATES.COMPLETED);
            return { text: saved, reliable: true, mode: 'realtime' };
          });
        }
        // مسیر unreliable → اول متن realtime به‌عنوان پایه persist شود (CAS)، بعد سگمنت‌ها
        // آپلود شوند؛ COMPLETED بلافاصله برمی‌گردد و drain در پس‌زمینه است (ISSUE 2).
        // merge سمت سرور همیشه به متنِ فعلی append می‌کنه (نه جایگزین) — باگِ قبلی همین‌جا بود.
        var baseP = self.persist ? self.persistConfirmed().catch(function () { return realtimeText; }) : Promise.resolve(realtimeText);
        return baseP.then(function () {
          return self.uploadBatchSegments().then(function () {
            if (self.persist) {
              // وضعیت صادقانه: realtime غیرقابل‌اعتماد، batch در صف (تخلیه در پس‌زمینه)
              reqJson('/api/sessions/' + self.sessionId, {
                method: 'PUT', body: { realtime_reliable: false, stt_mode: 'batch-pending' }
              }).catch(function () {});
            }
            if (opts.awaitBatch) {
              // فقط callerهای صریح (تست/یادداشت کوتاه) منتظر drain می‌مانند — با سقف مجزا.
              return self.awaitBatchDrain({ timeoutMs: opts.batchWaitMs, forNote: self.mode === 'note' }).then(function (drained) {
                self.cleanupAudio();
                self.unwatchOnline();
                self.setState(STATES.COMPLETED);
                if (drained && drained.ok) return drained.result;
                return { text: cleanText(self.confirmed), reliable: false, mode: self.mode === 'note' ? 'batch-pending-note' : 'batch-pending' };
              });
            }
            self.cleanupAudio();
            self.unwatchOnline();
            self.setState(STATES.COMPLETED);
            return { text: cleanText(self.confirmed), reliable: false, mode: self.mode === 'note' ? 'batch-pending-note' : 'batch-pending' };
          });
        });
      });
    });
    return self._finishPromise;
  };

  // ISSUE 2+3: آپلود سگمنت‌های durable به صف سرور — سریع و بدون poll.
  // purpose: حالت note به صف یادداشت می‌رود، نه transcript جلسه.
  // باگِ قبلی: آپلودها با Promise.allSettled موازی می‌رفتن و اسمِ فایلِ سمتِ سرور فقط
  // از Date.now() ساخته می‌شد — دو سگمنت در یک میلی‌ثانیه یعنی یک اسمِ فایل، یعنی یکی
  // رویِ دیگری می‌نوشت (صدا/متن گم می‌شد)؛ و چون موازی می‌رفتن، ترتیبِ رسیدن (نه ترتیبِ
  // واقعیِ ضبط) تعیین‌کننده‌ی ترتیبِ merge بود. الان: seq صریح فرستاده می‌شه (سرور
  // توی اسمِ فایل zero-pad می‌کنه) و آپلود کاملاً ترتیبی (یکی‌یکی) انجام می‌شه.
  // ⭐ منبعِ واحدِ سگمنت‌هایِ در-انتظار، IndexedDBه (نه یه آرایه‌ی RAM جدا) — یعنی این
  // تابع سگمنت‌هایِ همین runِ فعلی رو هم آپلود می‌کنه، هم هر سگمنتِ باقی‌مانده از یه
  // crash/رفرشِ قبلیِ همین session رو (اگه به‌جایِ ساختنِ RTSessionِ تازه، دوباره روی
  // همون sessionId صدا زده بشه). بعدِ آپلودِ موفقِ هر سگمنت، از IndexedDB پاک می‌شه.
  RTSession.prototype.uploadBatchSegments = function () {
    var self = this;
    return withAudioLock(self.sessionId, function () {
      return AudioQueueDB.listForSession(self.sessionId).then(function (pending) {
        var segs = pending.filter(function (r) { return r.blob && r.blob.size > 100; });
        if (!segs.length) {
          if (self.persist) {
            self.persistConfirmed().catch(function () {});
            reqJson('/api/sessions/' + self.sessionId, {
              method: 'PUT', body: { realtime_reliable: false, stt_mode: 'realtime-unreliable-noaudio' }
            }).catch(function () {});
          }
          return false;
        }
        var anyOk = false;
        var chain = Promise.resolve();
        segs.forEach(function (rec) {
          chain = chain.then(function () {
            return uploadQueuedSegment(self.sessionId, rec).then(function (done) {
              if (done) { anyOk = true; return AudioQueueDB.remove(rec.id); }
            }).catch(function () {});
          });
        });
        return chain.then(function () { return anyOk; });
      }).catch(function () { return false; });
    });
  };

  // ⭐ تخلیه‌ی فرصت‌طلبانه: هر بار که اتصال واقعاً برقرار شد (ACTIVE/RECOVERED)، اگه
  // از یه outage/crashِ قبلیِ همین session صدایی توی صف مونده باشه، همون‌جا (نه فقط
  // آخرِ finish()) آپلودش کن — تا کاربر مجبور نباشه صبر کنه تا «پایان جلسه» رو بزنه.
  // باگِ واقعی که با ردیابیِ دقیقِ کد پیدا شد: connectWithFreshMint گاهی پشتِ سرِ هم
  // setState(RECOVERED) بعد بلافاصله setState(ACTIVE) صدا می‌زنه (برایِ نمایشِ UI) —
  // یعنی این تابع بدونِ گارد، دوبار پشتِ سرِ هم اجرا می‌شد، هر دو همون سگمنتِ
  // آپلودنشده رو می‌دیدن (چون هنوز حذف نشده بود) و هر دو آپلودش می‌کردن — نتیجه:
  // همون متن دوبار merge می‌شد توی transcript. با شبیه‌سازی تایید و با این گارد فیکس شد.
  RTSession.prototype.drainQueuedAudioInBackground = function () {
    var self = this;
    if (self._draining) return;
    self._draining = true;
    withAudioLock(self.sessionId, function () {
      return AudioQueueDB.listForSession(self.sessionId).then(function (pending) {
        if (!pending.length) return;
        // باگِ واقعی (پیدا شده با کلیکِ واقعیِ دکمه‌های «توقف موقت»/«ادامه» توی مرورگر):
        // این تابع رویِ هر ACTIVE/RECOVERED صدا زده می‌شه — یعنی رویِ یه توقف/ادامه‌ی
        // کاملاً عادی هم (نه فقط یه قطعیِ واقعیِ شبکه). سگمنتِ durableِ بسته‌شده‌ی همون
        // توقف، دقیقاً همون بازه‌ایه که realtime (وقتی self.unreliable هنوز false بود)
        // از قبل درست رونویسی و persist کرده. بدونِ این چک، همیشه با purpose=transcript
        // آپلود می‌شد — یعنی همون متن یه‌بارِ دیگه رونویسی و به transcript append می‌شد:
        // دوپلیکیت‌شدنِ متن رویِ هر توقف/ادامه‌ی معمولی، نه فقط رویِ خطایِ واقعی.
        // ⭐ الان دیگه این تابع purpose را حدس نمی‌زنه — هر رکورد intentِ خودش (که موقعِ
        // ضبطِ همون سگمنت تعیین شده، نه وضعیتِ *فعلیِ* self.unreliable) را با
        // uploadQueuedSegment دنبال می‌کنه؛ رفعِ همون ریسکِ duplicate از ریشه.
        var chain = Promise.resolve();
        pending.forEach(function (rec) {
          if (!rec.blob || rec.blob.size <= 100) { chain = chain.then(function () { return AudioQueueDB.remove(rec.id); }); return; }
          chain = chain.then(function () {
            return uploadQueuedSegment(self.sessionId, rec).then(function (done) {
              if (done) return AudioQueueDB.remove(rec.id);
            }).catch(function () {});
          });
        });
        return chain.catch(function () {});
      }).catch(function () {});
    }).then(function () { self._draining = false; });
  };

  // ⭐ وقتی realtime کاملاً موفق بود: متنِ تاییدشده از قبل کامل و درسته، پس رونویسیِ
  // دوباره‌ی صدا لازم نیست (و ریسکِ duplicate هم داره) — این تابع فقط سرِ راه است؛
  // هر سگمنت طبقِ intentِ خودش می‌رود (uploadQueuedSegment). اگه سگمنتی از یه runِ
  // قبلیِ همین session که هنوز intent='transcript' مونده باشه (مثلاً crashِ قبل از
  // آپلود)، درست رونویسی می‌شه، نه فقط آرشیو — به‌جایِ فرضِ کورکورانه‌ی archive.
  RTSession.prototype.archiveQueuedAudioOnly = function () {
    var self = this;
    withAudioLock(self.sessionId, function () {
      return AudioQueueDB.listForSession(self.sessionId).then(function (pending) {
        if (!pending.length) return;
        var chain = Promise.resolve();
        pending.forEach(function (rec) {
          if (!rec.blob || rec.blob.size <= 100) { chain = chain.then(function () { return AudioQueueDB.remove(rec.id); }); return; }
          chain = chain.then(function () {
            return uploadQueuedSegment(self.sessionId, rec).then(function (done) {
              if (done) return AudioQueueDB.remove(rec.id);
            }).catch(function () {}); // شکستِ شبکه: توی صف می‌مونه، sweepِ سراسریِ بعدی امتحان می‌کنه
          });
        });
        return chain.catch(function () {});
      }).catch(function () {});
    });
  };

  // تخلیه صف در پس‌زمینه: poll مستقل از finalize؛ merge امن سمت سرور با CAS انجام می‌شود.
  // برمی‌گرداند {drained, ok, result?} — هرگز throw نمی‌کند.
  RTSession.prototype.awaitBatchDrain = function (opts) {
    var self = this;
    opts = opts || {};
    var timeoutMs = (typeof opts.timeoutMs === 'number') ? opts.timeoutMs : BATCH_TIMEOUT_MS;
    var forNote = !!opts.forNote;
    var started = Date.now();
    var poll = function () {
      return reqJson('/api/sessions/' + self.sessionId + '/batch-status').then(function (st) {
        var pending = forNote ? st.note_audio_pending : st.audio_pending;
        var terminal = forNote ? !pending : (!pending && (st.batch_status === 'done' || st.batch_status === 'failed'));
        if (terminal) return true;
        if (Date.now() - started > timeoutMs) return false;
        return new Promise(function (res) { setTimeout(res, BATCH_POLL_MS); }).then(poll);
      }).catch(function () { return false; });
    };
    return poll().then(function (terminal) {
      if (!terminal) return { drained: false, ok: false };
      if (forNote) return self.readNewVoiceNote();
      return reqJson('/api/sessions/' + self.sessionId).then(function (r) {
        var t = (r.session && r.session.transcript) || cleanText(self.confirmed);
        if (t.length > self.confirmed.length) self.confirmed = t;
        return { drained: true, ok: true, result: { text: t, reliable: false, mode: 'batch' } };
      }).catch(function () { return { drained: true, ok: false }; });
    });
  };

  // یادداشت صوتی تازه‌ای که بعد از startedAt ساخته شده (batch-note) را پیدا کن.
  RTSession.prototype.readNewVoiceNote = function () {
    var self = this;
    return reqJson('/api/sessions/' + self.sessionId).then(function (r) {
      var notes = (r && r.notes) || [];
      var best = null;
      notes.forEach(function (n) {
        if (!n || n.type !== 'voice' || !n.text) return;
        var ts = 0;
        try { ts = new Date(n.created_at).getTime() || 0; } catch (e) {}
        if (ts >= self.startedAt - 1000 && (!best || ts >= best.ts)) best = { note: n, ts: ts };
      });
      if (best) return { drained: true, ok: true, result: { text: best.note.text, noteId: best.note.id, reliable: false, mode: 'batch-note' } };
      return { drained: true, ok: false };
    }).catch(function () { return { drained: false, ok: false }; });
  };

  RTSession.prototype.cleanupAudio = function () {
    this.stopLivePusher();
    this.stopDurableSegment();
    stopStream(this.stream);
    this.stream = null;
  };

  // abort امن از هر state: بدون hang، بدون نشت — و ابطال epoch (ISSUE 1).
  RTSession.prototype.abort = function () {
    this.aborted = true;
    this.noNewConnections = true;
    this.connEpoch++;
    this.clearTimers();
    this.stopKeepalive(); // اگه از MANUAL_PAUSED لغو شده، تایمرِ keepalive نشتی نمونه
    if (this.finishResolver) {
      var r = this.finishResolver; this.finishResolver = null;
      try { r({ aborted: true }); } catch (e) {}
    }
    this.closingIntentional = true;
    try { if (this.ws) this.ws.close(); } catch (e) {}
    this.ws = null;
    this.cleanupAudio();
    this.unwatchOnline();
    // سگمنت‌های durable (هم RAM هم IndexedDB) دور ریخته می‌شوند — abort یعنی این
    // جلسه اصلاً ذخیره نمی‌شه، پس نسخه‌ی پشتیبانِ صداش هم دیگه لازم نیست. زیرِ همون
    // قفلِ سراسری تا با sweep/drainِ هم‌زمانِ همین sessionId تداخل نکنه.
    var sid = this.sessionId;
    withAudioLock(sid, function () { return AudioQueueDB.clearForSession(sid); });
    if (this.state !== STATES.COMPLETED) this.setState(STATES.CANCELED);
  };

  RTSession.prototype.hasOpenWS = function () {
    try { return !!(this.ws && this.ws.readyState === WebSocket.OPEN); } catch (e) { return false; }
  };

  // ————————————————— registry برای beforeunload —————————————————
  var live = [];
  function createSession(sessionId, opts) {
    var s = new RTSession(sessionId, opts);
    live.push(s);
    return s;
  }
  function hasOpenConnection() {
    return live.some(function (s) { return s.hasOpenWS(); });
  }
  // ⭐ باگِ واقعی (audit صدا/۲۰۲۶-۰۹-۱۶): beforeunload فقط WSِ باز را چک می‌کرد —
  // در حالتِ durable-only/آفلاین (mint شکست خورده یا reconnect تمام شد، FAILED) هیچ
  // WSای باز نیست ولی میکروفون هنوز دارد ضبط می‌کند؛ کاربر بدونِ هیچ هشداری تب را
  // می‌بست و چند ثانیه‌ی آخرِ صدا (هنوز flush نشده به IndexedDB) از دست می‌رفت.
  function hasActiveRecording() {
    return live.some(function (s) {
      if (s.aborted || s.state === STATES.COMPLETED || s.state === STATES.CANCELED) return false;
      return s.hasOpenWS() || (s.durableRec && s.durableRec.state === 'recording');
    });
  }
  function forget(s) {
    live = live.filter(function (x) { return x !== s; });
  }

  // ⭐ فلاشِ فوریِ سگمنتِ durableِ جاری وقتی صفحه پنهان/بسته می‌شود (audit صدا/۲۰۲۶-۰۹-۱۶):
  // بدونِ این، تا ۱۵ ثانیه‌ی آخرِ صدا فقط در RAM (chunksِ recorderِ جاری) است — رفرش/بستنِ
  // تب/کرش همان چند ثانیه را از بین می‌برد. stopDurableSegment سگمنتِ جاری را به
  // IndexedDB می‌نویسد؛ اگر صفحه فقط پنهان شده (نه واقعاً بسته)، بلافاصله سگمنتِ
  // بعدی شروع می‌شود تا ضبطِ زنده قطع نشود.
  function flushAllDurable() {
    live.forEach(function (s) {
      try {
        if (!s.durableRec || s.durableRec.state !== 'recording') return;
        s.stopDurableSegment().then(function () {
          if (!s.aborted && s.state !== STATES.COMPLETED && s.state !== STATES.CANCELED &&
              s.stream && s.stream.active) {
            s.startDurable();
          }
        });
      } catch (e) {}
    });
  }
  try {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushAllDurable();
    });
    window.addEventListener('pagehide', function () { flushAllDurable(); });
  } catch (e) {}

  window.FeeliaRT = {
    STATES: STATES,
    isAvailable: isAvailable,
    createSession: createSession,
    hasOpenConnection: hasOpenConnection,
    hasActiveRecording: hasActiveRecording,
    forget: forget,
    cleanText: cleanText,
    MAX_RECONNECT_ATTEMPTS: MAX_RECONNECT_ATTEMPTS,
    // ⭐ برایِ جاروبِ سراسری (index.html) — آپلودِ صداهایِ باقی‌مانده از جلساتِ قبلی
    // که هیچ‌وقت resume نشدن (مثلاً تب برای همیشه بسته شده بود).
    audioQueue: AudioQueueDB,
    // ⭐ همون منطقِ intent→purpose که RTSession خودش برایِ صفِ فعال استفاده می‌کنه —
    // sweepOrphanedAudioQueueِ index.html هم باید دقیقاً همین رفتار را داشته باشد،
    // نه purpose=archive کورکورانه (audit صدا/۲۰۲۶-۰۹-۱۶، بخشِ C).
    uploadQueuedSegment: uploadQueuedSegment,
    // ⭐ قفلِ سراسریِ صف/session (audit صدا/۲۰۲۶-۰۹-۱۶) — sweepOrphanedAudioQueueِ index.html
    // باید همین قفل را بگیرد، وگرنه ممکن است با درایني‌کردنِ همزمانِ RTSession رویِ همون
    // sessionId تداخل کند (رجوع به تعریفِ withAudioLock بالای همین فایل).
    withAudioLock: withAudioLock
  };
})();
