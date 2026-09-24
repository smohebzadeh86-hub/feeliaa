/* FeeliaUpload — موتورِ آپلودِ مقاومِ فایلِ صوتیِ جلسه (بدونِ build، بدونِ وابستگیِ خارجی — LAW-014).
 *
 * مسیر: انتخابِ فایل → اثرِ انگشت (sha256 از نام/حجم/تاریخ + ۱MBِ اول و آخر) → نگه‌داریِ فایل در
 * IndexedDB (تا بعد از رفرش/بستنِ تب بدونِ انتخابِ دوباره ادامه یابد) → POST /api/uploads (سرور
 * تکه‌هایِ از قبل رسیده را برمی‌گرداند) → فقط تکه‌هایِ نرسیده با PUT (۴MB، sha256 در هدر) →
 * POST complete → از این لحظه همه‌چیز رویِ سرور است و صفحه می‌تواند بسته شود.
 *
 * شبکه‌ی ضعیف: هر تکه جدا تکرار می‌شود (backoff)؛ با offline منتظرِ رویدادِ online می‌ماند؛ با قطعیِ
 * وسطِ آپلود، از همان تکه ادامه می‌دهد — هرگز از صفر.
 * آفلاینِ کامل هنگامِ انتخاب: کار با وضعیتِ «منتظرِ اینترنت» در IndexedDB می‌ماند و به‌محضِ وصل‌شدن
 * (تا وقتی اپ باز است) خودکار شروع می‌شود.
 *
 * حریمِ خصوصی: فایل فقط در IndexedDBِ همین مرورگر و فقط تا پایانِ آپلود می‌ماند (بعد پاک می‌شود)؛
 * هر کار به therapistId گره خورده و برایِ حسابِ دیگرِ همین مرورگر ادامه داده نمی‌شود. خروج با آپلودِ ناتمام
 * (index.html) از تراپیست می‌پرسد فایل بماند (دستگاهِ شخصی) یا پاک شود (کامپیوترِ مشترک — purgeLocal).
 * چندتب: Web Locks — هر فایل فقط در یک تب آپلود می‌شود (withTaskLock).
 */
(function () {
  'use strict';
  var DB_NAME = 'feelia-uploads';
  var STORE = 'tasks';
  var EDGE = 1024 * 1024;
  var MAX_CHUNK_RETRIES = 8;
  var PERMANENT_CODES = ['consent-required', 'file-too-small', 'file-too-large', 'unsupported-format', 'bad-fingerprint',
    'not-audio', 'no-audio', 'unreadable', 'too-long', 'upload-closed', 'read-failed'];

  var tasks = {};          // key → task (حالتِ درون‌حافظه‌ای برایِ UI)
  // «لغو» در یک تب به تب‌هایِ دیگرِ فیلیا هم برسد (همان فایل ممکن است آن‌جا در حالِ آپلود باشد — L2).
  var bc = null;
  try { if (typeof BroadcastChannel !== 'undefined') bc = new BroadcastChannel('feelia-upload'); } catch (e) {}
  var listeners = [];
  var therapistId = null;

  function emit() {
    var list = FeeliaUpload.list();
    listeners.forEach(function (fn) { try { fn(list); } catch (e) {} });
  }

  // ————— IndexedDB (همه‌چیز fail-open: اگر نشد، فقط ادامه بعد از رفرش را از دست می‌دهیم) —————
  function openDb() {
    return new Promise(function (resolve, reject) {
      try {
        var req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function () { req.result.createObjectStore(STORE, { keyPath: 'key' }); };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      } catch (e) { reject(e); }
    });
  }
  function idb(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var out;
        tx.oncomplete = function () { db.close(); resolve(out); };
        tx.onerror = function () { db.close(); reject(tx.error); };
        tx.onabort = function () { db.close(); reject(tx.error); };
        out = fn(tx.objectStore(STORE));
      });
    });
  }
  function idbPut(rec) { return idb('readwrite', function (s) { s.put(rec); }); }
  function idbDelete(key) { return idb('readwrite', function (s) { s.delete(key); }).catch(function () {}); }
  // undefined یعنی «رکورد نیست»؛ null یعنی «IndexedDB در دسترس نبود» (نامعلوم — محتاطانه ادامه بده).
  function idbGet(key) {
    return idb('readonly', function (s) {
      var r = { v: undefined };
      var q = s.get(key);
      q.onsuccess = function () { r.v = q.result; };
      return r;
    }).then(function (r) { return r ? r.v : undefined; }, function () { return null; });
  }
  function idbAll() {
    return idb('readonly', function (s) {
      var res = { items: [] };
      s.openCursor().onsuccess = function (e) {
        var c = e.target.result;
        if (c) { res.items.push(c.value); c.continue(); }
      };
      return res;
    }).then(function (r) { return r ? r.items : []; });
  }

  function hex(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += ('0' + b[i].toString(16)).slice(-2);
    return s;
  }
  function sha256(buf) { return crypto.subtle.digest('SHA-256', buf).then(hex); }

  function fingerprint(file) {
    var head = file.slice(0, Math.min(EDGE, file.size));
    var tail = file.slice(Math.max(0, file.size - EDGE), file.size);
    return Promise.all([head.arrayBuffer(), tail.arrayBuffer()]).then(function (parts) {
      var meta = new TextEncoder().encode(file.name + '|' + file.size + '|' + (file.lastModified || 0) + '|');
      var all = new Uint8Array(meta.length + parts[0].byteLength + parts[1].byteLength);
      all.set(meta, 0);
      all.set(new Uint8Array(parts[0]), meta.length);
      all.set(new Uint8Array(parts[1]), meta.length + parts[0].byteLength);
      return sha256(all.buffer);
    });
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function waitOnline() {
    if (navigator.onLine) return Promise.resolve();
    return new Promise(function (resolve) {
      window.addEventListener('online', function h() { window.removeEventListener('online', h); resolve(); });
    });
  }

  function jsonReq(method, url, body) {
    return fetch(url, {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) { var e = new Error(data.error || 'خطا'); e.status = res.status; e.code = data.code; e.data = data; e.finalStatus = data.status === 'failed'; throw e; }
        return data;
      });
    });
  }

  // PUT با XHR تا پیشرفتِ واقعیِ بایت‌ها (نوارِ روان رویِ اینترنتِ کند) دیده شود.
  function putChunk(task, n, blob, digest) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      task._xhr = xhr;
      xhr.open('PUT', '/api/uploads/' + task.uploadId + '/chunks/' + n);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('X-Chunk-Sha256', digest);
      xhr.timeout = 120000;
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) { task.inflightBytes = e.loaded; throttleEmit(); }
      };
      xhr.onload = function () {
        task._xhr = null;
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        var data = {};
        try { data = JSON.parse(xhr.responseText); } catch (e) {}
        var err = new Error(data.error || ('HTTP ' + xhr.status));
        err.status = xhr.status; err.code = data.code; err.finalStatus = data.status === 'failed';
        reject(err);
      };
      xhr.onerror = function () { task._xhr = null; var e = new Error('network'); e.network = true; reject(e); };
      xhr.ontimeout = function () { task._xhr = null; var e = new Error('timeout'); e.network = true; reject(e); };
      xhr.onabort = function () { task._xhr = null; var e = new Error('aborted'); e.aborted = true; reject(e); };
      xhr.send(blob);
    });
  }

  var emitTimer = null;
  function throttleEmit() {
    if (emitTimer) return;
    emitTimer = setTimeout(function () { emitTimer = null; emit(); }, 250);
  }

  function setState(task, state, extra) {
    task.state = state;
    if (extra) for (var k in extra) task[k] = extra[k];
    emit();
  }

  function persist(task) {
    if (!task.persistable) return Promise.resolve();
    return idbPut({
      key: task.key, therapistId: task.therapistId, clientId: task.clientId, clientLabel: task.clientLabel,
      sessionDate: task.sessionDate, fileName: task.fileName, size: task.size, mime: task.mime,
      fingerprint: task.fingerprint, uploadId: task.uploadId || null, createdAt: task.createdAt, file: task.file,
    }).catch(function () { task.persistable = false; });
  }

  function finishTask(task, state, extra) {
    setState(task, state, extra);
    idbDelete(task.key);
    task.file = null; // رهاکردنِ ارجاع به فایل (حافظه)
  }

  // ————— رفعِ L2 (audit 2026-09-24): یک فایل فقط در یک تب آپلود شود —————
  // هر تبِ فیلیا کارهایِ IndexedDB را resume می‌کند؛ بدونِ قفل، دو تبِ باز همان فایل را هم‌زمان می‌فرستادند (پهنای‌باندِ
  // دوبرابر) و تبِ دوم پیامِ کاذبِ «قبلاً آپلود شده» می‌داد. Web Locks (هم‌مبدأ، با بسته‌شدنِ تب خودکار آزاد می‌شود):
  // تبِ دوم «در تبِ دیگر» منتظر می‌ماند و اگر تبِ اول بسته شد خودش ادامه می‌دهد؛ اگر تبِ اول کار را تمام کرد
  // (رکورد از IndexedDB رفته)، تبِ دوم کارت را بی‌صدا برمی‌دارد. مرورگرِ بدونِ Web Locks ⇒ رفتارِ قبلی.
  function withTaskLock(task, fn) {
    if (!(navigator.locks && navigator.locks.request)) return fn();
    var name = 'feelia-upload:' + task.key;
    return navigator.locks.request(name, { ifAvailable: true }, function (lock) {
      return lock ? Promise.resolve(fn()).then(function () { return true; }) : false;
    }).then(function (got) {
      if (got) return;
      setState(task, 'other-tab');
      var ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
      task._lockAbort = ac;
      return navigator.locks.request(name, ac ? { signal: ac.signal } : {}, function () {
        task._lockAbort = null;
        if (task.canceled) return;
        return idbGet(task.key).then(function (rec) {
          if (rec === undefined && task.persistable) {
            // تبِ دیگر کار را تمام/لغو کرد ⇒ این‌جا چیزی برایِ ادامه نیست.
            if (tasks[task.key] === task) { delete tasks[task.key]; emit(); }
            return;
          }
          return fn();
        });
      });
    }).catch(function () {});
  }

  function run(task) {
    if (task.running) return;
    task.running = true;
    task.canceled = false;
    withTaskLock(task, function () { return runBody(task); }).then(function () { task.running = false; }, function () { task.running = false; });
  }

  async function runBody(task) {
    try {
      // ⭐ آپلودی که سرور بسته است (مثلاً بعد از > ۲۴ساعت بی‌فعالیتی آزاد شد — `upload-closed`) دیگر «خطایِ دائمی» نیست:
      // کار با یک آپلودِ تازه از نو شروع می‌شود، به‌جایِ پاک‌کردنِ نسخه‌ی IndexedDB و خواستنِ انتخابِ دوباره‌ی فایل.
      for (var restart = 0; ; restart++) {
        try {
          await uploadOnce(task);
          return;
        } catch (e) {
          if (e && e.code === 'upload-closed' && !e.finalStatus && restart < 2 && !task.canceled) {
            task.uploadId = null;
            continue;
          }
          throw e;
        }
      }
    } catch (e) {
      if (task.canceled) return;
      if (e && e.status === 401) { setState(task, 'paused-auth'); return; }
      var code = (e && e.code) || 'upload-failed';
      var extra = { errorCode: code, errorMessage: (e && e.message) || 'آپلود ناموفق بود' };
      // خطایی که با تلاشِ دوباره درست نمی‌شود ⇒ فایل رها می‌شود؛ بقیه (مثلاً خطایِ سرور) فایل را نگه
      // می‌دارند تا «تلاشِ دوباره» بدونِ انتخابِ دوباره ممکن باشد.
      if (PERMANENT_CODES.indexOf(code) !== -1) finishTask(task, 'error', extra);
      else setState(task, 'error', extra);
    }
  }

  async function uploadOnce(task) {
    var init;
    for (;;) {
      await waitOnlineWithState(task);
      setState(task, 'starting');
      try {
        init = await jsonReq('POST', '/api/uploads', {
          client_id: task.clientId, file_name: task.fileName, size: task.size, mime: task.mime,
          fingerprint: task.fingerprint, session_date: task.sessionDate || undefined, consent: true,
        });
        break;
      } catch (e) {
        if (task.canceled) return;
        if (!isNetwork(e)) throw e;
        setState(task, 'retrying');
        await sleep(3000);
      }
    }
    if (init.duplicate) {
      finishTask(task, 'duplicate', { job: init.job || null, requeued: !!init.requeued, sessionId: init.upload && init.upload.session_id });
      return;
    }
    task.uploadId = init.upload.id;
    task.chunkSize = init.upload.chunk_size;
    task.chunksTotal = init.upload.chunks_total;
    // عمداً دوباره persist نمی‌شود: ادامه بعد از رفرش با fingerprint انجام می‌شود (سرور همان آپلود را برمی‌گرداند)،
    // و put ِ دوباره‌ی رکورد ممکن بود کلِ فایل (تا ۱GB) را دوباره در IndexedDB بنویسد.
    var have = {};
    (init.upload.received || []).forEach(function (n) { have[n] = true; });
    task.doneBytes = 0;
    for (var i = 0; i < task.chunksTotal; i++) if (have[i]) task.doneBytes += chunkLen(task, i);
    setState(task, 'uploading');

    for (var n = 0; n < task.chunksTotal; n++) {
      if (have[n]) continue;
      await sendChunkWithRetry(task, n);
      have[n] = true;
      task.doneBytes += chunkLen(task, n);
      task.inflightBytes = 0;
      throttleEmit();
    }

    setState(task, 'finalizing');
    var done;
    for (var attempt = 0; ; attempt++) {
      try {
        done = await jsonReq('POST', '/api/uploads/' + task.uploadId + '/complete');
        break;
      } catch (e) {
        if (e.code === 'chunks-missing' && e.data && e.data.missing && attempt < 3) {
          setState(task, 'uploading');
          for (var k = 0; k < e.data.missing.length; k++) await sendChunkWithRetry(task, e.data.missing[k]);
          setState(task, 'finalizing');
          continue;
        }
        if (isNetwork(e) && attempt < 20) { await waitOnlineWithState(task); await sleep(2000); setState(task, 'finalizing'); continue; }
        throw e;
      }
    }
    finishTask(task, 'done', { job: done.job, sessionId: done.upload && done.upload.session_id });
  }

  function isNetwork(e) { return !!(e && (e.network || e instanceof TypeError || e.status === 502 || e.status === 503 || e.status === 504)); }

  function chunkLen(task, n) {
    return n === task.chunksTotal - 1 ? task.size - task.chunkSize * (task.chunksTotal - 1) : task.chunkSize;
  }

  async function waitOnlineWithState(task) {
    if (!navigator.onLine) {
      setState(task, 'waiting-network');
      await waitOnline();
    }
  }

  async function sendChunkWithRetry(task, n) {
    var start = n * task.chunkSize;
    var blob = task.file.slice(start, start + chunkLen(task, n));
    var digest = await sha256(await blob.arrayBuffer());
    for (var attempt = 0; ; attempt++) {
      if (task.canceled) { var c = new Error('canceled'); c.aborted = true; throw c; }
      try {
        await putChunk(task, n, blob, digest);
        if (task.state !== 'uploading') setState(task, 'uploading');
        return;
      } catch (e) {
        task.inflightBytes = 0;
        if (e.aborted && task.canceled) throw e;
        var retryable = e.network || e.status === 422 || e.status >= 500 || e.status === 408 || e.status === 429;
        if (!retryable) throw e;
        if (!navigator.onLine) { await waitOnlineWithState(task); continue; }
        if (attempt >= MAX_CHUNK_RETRIES) {
          // شبکه مدتی است جواب نمی‌دهد ولی «online» است (اینترنتِ خیلی ضعیف) — بی‌نهایت صبر، با فاصله‌ی ثابت.
          setState(task, 'waiting-network');
          await sleep(15000);
          continue;
        }
        setState(task, 'retrying');
        await sleep(Math.min(30000, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  function stopTask(t) {
    t.canceled = true;
    if (t._xhr) try { t._xhr.abort(); } catch (e) {}
    if (t._lockAbort) try { t._lockAbort.abort(); } catch (e) {}
  }

  var FeeliaUpload = {
    setTherapist: function (id) {
      therapistId = id || null;
      // کارهایِ حسابِ دیگر از نمایش حذف می‌شوند (ولی رویِ دیسک برایِ خودِ آن حساب می‌مانند).
      Object.keys(tasks).forEach(function (k) {
        if (tasks[k].therapistId !== therapistId) {
          // canceled برایِ همه (نه فقط XHRِ در جریان) — وگرنه taskی که وسطِ hash/انتظار بود بعد از خروج ادامه می‌داد.
          stopTask(tasks[k]);
          delete tasks[k];
        }
      });
      emit();
    },
    onChange: function (fn) { listeners.push(fn); },
    list: function () {
      return Object.keys(tasks).map(function (k) {
        var t = tasks[k];
        var sent = (t.doneBytes || 0) + (t.inflightBytes || 0);
        return {
          key: t.key, state: t.state, fileName: t.fileName, size: t.size, clientId: t.clientId, clientLabel: t.clientLabel,
          progress: t.size ? Math.min(1, sent / t.size) : 0, sentBytes: sent,
          job: t.job || null, requeued: !!t.requeued, sessionId: t.sessionId || null, errorCode: t.errorCode || null, errorMessage: t.errorMessage || null,
          needsFile: !!t.needsFile, createdAt: t.createdAt,
        };
      }).sort(function (a, b) { return b.createdAt - a.createdAt; });
    },
    isBusy: function () {
      return Object.keys(tasks).some(function (k) {
        var s = tasks[k].state;
        return s === 'hashing' || s === 'starting' || s === 'uploading' || s === 'retrying' || s === 'finalizing' || s === 'waiting-network';
      });
    },
    start: function (opts) {
      var file = opts.file;
      var task = {
        key: null, therapistId: therapistId, clientId: opts.clientId, clientLabel: opts.clientLabel || '',
        sessionDate: opts.sessionDate || '', fileName: file.name, size: file.size, mime: file.type || '',
        file: file, state: 'hashing', createdAt: Date.now(), persistable: true, doneBytes: 0, inflightBytes: 0,
      };
      var tmpKey = 'tmp-' + task.createdAt;
      task.key = tmpKey;
      tasks[tmpKey] = task;
      emit();
      return fingerprint(file).then(function (fp) {
        task.fingerprint = fp;
        var key = fp + ':' + opts.clientId;
        delete tasks[tmpKey];
        // همان فایل برایِ همان مراجع هنوز در جریان است (حتی اگر هنوز به run نرسیده، مثلاً وسطِ persist) ⇒ کارِ دوم ساخته نشود.
        var ex = tasks[key];
        if (ex && ex.state !== 'error' && ex.state !== 'done' && ex.state !== 'duplicate') { emit(); return ex; }
        task.key = key;
        tasks[key] = task;
        return persist(task).then(function () { run(task); return task; });
      }).catch(function (e) {
        delete tasks[tmpKey];
        task.key = tmpKey;
        tasks[tmpKey] = task;
        finishTask(task, 'error', { errorCode: 'read-failed', errorMessage: 'خواندنِ فایل از دستگاه ممکن نشد' });
        return task;
      });
    },
    // بعد از ورود: کارهایِ نیمه‌کاره‌ی همین حساب از IndexedDB ادامه می‌یابند.
    resumePending: function () {
      if (!therapistId || !window.indexedDB) return Promise.resolve();
      // کارهایی که به‌خاطرِ نشستِ منقضی (۴۰۱) متوقف شده بودند، بعد از ورودِ دوباره ادامه می‌یابند.
      Object.keys(tasks).forEach(function (k) {
        if (tasks[k].state === 'paused-auth' && tasks[k].therapistId === therapistId) run(tasks[k]);
      });
      return idbAll().then(function (items) {
        items.forEach(function (rec) {
          if (rec.therapistId !== therapistId || tasks[rec.key]) return;
          var task = {
            key: rec.key, therapistId: rec.therapistId, clientId: rec.clientId, clientLabel: rec.clientLabel,
            sessionDate: rec.sessionDate, fileName: rec.fileName, size: rec.size, mime: rec.mime,
            fingerprint: rec.fingerprint, uploadId: rec.uploadId, file: rec.file, createdAt: rec.createdAt,
            state: 'starting', persistable: true, doneBytes: 0, inflightBytes: 0,
          };
          tasks[rec.key] = task;
          if (!rec.file) { task.state = 'error'; task.needsFile = true; task.errorCode = 'file-lost'; task.errorMessage = 'فایل در این مرورگر نگه داشته نشد — لطفاً دوباره انتخابش کنید'; return; }
          run(task);
        });
        emit();
      }).catch(function () {});
    },
    cancel: function (key, fromOtherTab) {
      var t = tasks[key];
      if (!t) return;
      stopTask(t);
      if (!fromOtherTab && bc) try { bc.postMessage({ type: 'cancel', key: key }); } catch (e) {}
      if (t.uploadId && t.state !== 'done' && t.state !== 'duplicate') jsonReq('DELETE', '/api/uploads/' + t.uploadId).catch(function () {});
      idbDelete(key);
      delete tasks[key];
      emit();
    },
    dismiss: function (key) {
      var t = tasks[key];
      if (!t || t.running) return;
      // رفعِ B3 (audit 2026-09-24): بستنِ کارتِ خطا یعنی رهاکردنِ آپلود ⇒ ردیفِ نیمه‌کاره‌ی سرور هم لغو شود؛ وگرنه تا
      // ۷ روز جزوِ سقفِ ۵ آپلودِ هم‌زمان می‌ماند. (برایِ آپلودِ complete/failed سرور 409 می‌دهد — بی‌اثر.)
      if (t.uploadId && t.state === 'error') jsonReq('DELETE', '/api/uploads/' + t.uploadId).catch(function () {});
      idbDelete(key);
      delete tasks[key];
      emit();
    },
    // رفعِ M5 (audit 2026-09-24): پیش از خروج — چند فایلِ این حساب هنوز در این مرورگر نگه داشته شده (آپلودِ ناتمام)؟
    localPendingCount: function () {
      if (!therapistId || !window.indexedDB) return Promise.resolve(0);
      var mine = therapistId;
      return idbAll().then(function (items) {
        return items.filter(function (r) { return r.therapistId === mine; }).length;
      }).catch(function () { return 0; });
    },
    // «کامپیوترِ مشترک»: نسخه‌یِ فایل‌هایِ این حساب از همین مرورگر پاک می‌شود. هیچ داده‌ای از دست نمی‌رود: فایلِ اصلی
    // رویِ دستگاهِ کاربر است و تکه‌هایِ رسیده رویِ سرور ۷ روز می‌مانند — انتخابِ دوباره‌ی همان فایل (حتی از دستگاهِ
    // دیگر) از همان‌جا ادامه می‌دهد، چون اثرِ انگشت از خودِ فایل است. آپلودِ سرور عمداً لغو نمی‌شود.
    purgeLocal: function () {
      var mine = therapistId;
      Object.keys(tasks).forEach(function (k) {
        if (tasks[k].therapistId === mine) { stopTask(tasks[k]); delete tasks[k]; }
      });
      emit();
      if (!mine || !window.indexedDB) return Promise.resolve(0);
      return idbAll().then(function (items) {
        var del = items.filter(function (r) { return r.therapistId === mine; });
        return Promise.all(del.map(function (r) { return idbDelete(r.key); })).then(function () { return del.length; });
      }).catch(function () { return 0; });
    },
    retry: function (key) {
      var t = tasks[key];
      if (!t || t.running || !t.file) return;
      t.errorCode = null; t.errorMessage = null;
      run(t);
    },
  };
  if (bc) bc.onmessage = function (ev) {
    var m = ev && ev.data;
    if (m && m.type === 'cancel' && tasks[m.key]) FeeliaUpload.cancel(m.key, true);
  };
  window.FeeliaUpload = FeeliaUpload;
})();
