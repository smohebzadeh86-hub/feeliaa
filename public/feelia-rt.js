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
  var CONNECT_TIMEOUT_MS = 10000; // explicit: باز نشدن WS
  var FINALIZE_TIMEOUT_MS = 8000; // explicit: نیامدن finished
  var PAUSE_FLUSH_MS = 2000; // explicit: انتظار دم جمله روی pause
  var AUTOSAVE_MS = 5000;
  var BATCH_POLL_MS = 5000;
  var BATCH_TIMEOUT_MS = 15 * 60 * 1000; // explicit: سقف انتظار batch
  var MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];

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

  function reqJson(path, opts) {
    opts = opts || {};
    return fetch(path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || 'خطا');
          err.status = res.status;
          err.code = data && data.code;
          throw err;
        }
        return data;
      });
    });
  }

  function mintCredential(sessionId) {
    return reqJson('/api/stt/realtime-session', { method: 'POST', body: { session_id: sessionId } });
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
    this.stream = null;
    this.liveRec = null;
    this.durableRec = null;
    this.durableSegs = []; // Blob[] — هر pause/resume یک سگمنت
    this.durableChunks = [];
    this.confirmed = '';
    this.interim = '';
    this.baseVersion = 0; // transcript_version پایه برای CAS
    this.dirty = false;
    this.autosaveFailStreak = 0;
    this.unreliable = false;
    this.reconnectAttempts = 0;
    this.hadGap = false;
    this.curSpeaker = null;
    this.timers = [];
    this.autosaveTimer = null;
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
    this.state = s;
    try { this.cb.onState(s, this.snapshot()); } catch (e) {}
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
  };

  // ——— audio مشترک ———
  RTSession.prototype.ensureStream = function () {
    var self = this;
    if (self.stream && self.stream.active) return Promise.resolve(self.stream);
    return reqStream().then(function (s) { self.stream = s; return s; });
  };

  RTSession.prototype.startLivePusher = function () {
    var self = this;
    self.stopLivePusher();
    if (!self.stream) return;
    var mime = pickMime();
    try {
      self.liveRec = mime ? new MediaRecorder(self.stream, { mimeType: mime }) : new MediaRecorder(self.stream);
    } catch (e) { return; }
    self.liveRec.ondataavailable = function (e) {
      if (e.data && e.data.size > 0 && self.ws && self.ws.readyState === WebSocket.OPEN) {
        try { self.ws.send(e.data); } catch (err) {}
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

  RTSession.prototype.startDurable = function () {
    var self = this;
    if (!self.stream) return;
    self.durableChunks = [];
    var mime = pickMime();
    try {
      self.durableRec = mime ? new MediaRecorder(self.stream, { mimeType: mime }) : new MediaRecorder(self.stream);
    } catch (e) { return; }
    self.durableRec.ondataavailable = function (e) {
      if (e.data && e.data.size > 0) self.durableChunks.push(e.data);
    };
    self.durableRec.onstop = function () {
      try {
        if (self.durableChunks.length) self.durableSegs.push(new Blob(self.durableChunks, { type: (mime || 'audio/webm') }));
      } catch (e) {}
      self.durableChunks = [];
    };
    try { self.durableRec.start(1000); } catch (e) {}
  };

  RTSession.prototype.stopDurableSegment = function () {
    if (this.durableRec) {
      try { if (this.durableRec.state !== 'inactive') this.durableRec.stop(); } catch (e) {}
      this.durableRec = null;
    }
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
        try {
          ws.send(JSON.stringify({
            api_key: cred.api_key,
            model: (cred.stt_defaults && cred.stt_defaults.model) || cred.model || 'stt-rt-v5',
            audio_format: 'auto',
            language_hints: ['fa'],
            enable_language_identification: true,
            enable_speaker_diarization: true,
            enable_endpoint_detection: true
          }));
        } catch (e) { clearTimeout(timer); if (!settled) { settled = true; reject(e); } return; }
        clearTimeout(timer);
        if (!settled) { settled = true; resolve(ws); }
      };
      ws.onerror = function () {
        clearTimeout(timer);
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
    ws.onclose = function () { self.handleWSClose(); };
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
        if (tk.speaker != null && tk.speaker !== self.curSpeaker) {
          self.curSpeaker = tk.speaker;
          var faSp = String(tk.speaker).replace(/[0-9]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; });
          self.confirmed += (self.confirmed ? '\n\n' : '') + 'گوینده ' + faSp + ': ';
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

  RTSession.prototype.handleWSClose = function () {
    var self = this;
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
    if (self.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      self.unreliable = true;
      self.setState(STATES.FAILED);
      try { self.cb.onError('اتصال realtime قطع شد؛ ضبط durable ادامه دارد و batch در دسترس است'); } catch (e) {}
      return;
    }
    var delay = RECONNECT_BACKOFF_MS[Math.min(self.reconnectAttempts, RECONNECT_BACKOFF_MS.length - 1)];
    self.reconnectAttempts++;
    self.hadGap = true;
    self.unreliable = true; // یک‌طرفه: گپ احتمالی یعنی دیگر قابل‌اعتماد کامل نیست
    self.interim = ''; // interim قبلی discard — از نقطه امن ادامه
    try { if (self.ws) self.ws.close(); } catch (e) {}
    self.ws = null;
    self.setState(STATES.RECONNECTING);
    self.later(function () {
      if (self.aborted || self.noNewConnections) return;
      if (self.state !== STATES.RECONNECTING) return;
      self.connectWithFreshMint().then(function (ok) {
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
    return mintCredential(self.sessionId).then(function (cred) {
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
        self.generation++;
        self.reconnectAttempts = 0;
        self.realtimeUp = true;
        if (isReconnect) self.noteDiscontinuity();
        // استریمر زنده روی همان stream با MediaRecorder تازه (هدر تازه)؛ durable دست‌نخورده ادامه می‌دهد
        self.startLivePusher();
        self.setState(self.hadGap ? STATES.RECOVERED : STATES.ACTIVE);
        if (self.hadGap) {
          // RECOVERED گذراست — بلافاصله ACTIVE با پرچم gap
          self.setState(STATES.ACTIVE);
        }
        return true;
      });
    }).catch(function (err) {
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
    self.setState(STATES.STARTING);
    // نسخه پایه transcript برای CAS (اگر DB متنی از قبل دارد، ادامه همان)
    var baseP = self.persist
      ? reqJson('/api/sessions/' + self.sessionId).then(function (r) {
          var t = (r.session && r.session.transcript) || '';
          if (t && t.length > self.confirmed.length) self.confirmed = t;
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
            self.unreliable = true;
            self.realtimeUp = false;
            self.startDurable();
            self.watchOnline(); // اگر اینترنت برگشت، reconnect می‌تواند realtime را بالا بیاورد
            self.setState(STATES.FAILED);
            try { self.cb.onError('realtime در دسترس نیست؛ ضبط محلی فعال است و batch در پایان استفاده می‌شود'); } catch (e) {}
            return true;
          }
          self.startDurable();
          self.startAutosave();
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
          self.setState(STATES.NETWORK_PAUSED);
        }
      };
      self.onlineHandler = function () {
        if (self.state === STATES.NETWORK_PAUSED) self.scheduleReconnect('online');
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
      return text;
    }).catch(function (err) {
      if (err && err.status === 409) {
        // نسخه جدیدتر آمده — تازه‌سازی و rebase (متن طولانی‌تر برنده است)
        return reqJson('/api/sessions/' + self.sessionId).then(function (r) {
          var serverText = (r.session && r.session.transcript) || '';
          self.baseVersion = (r.session && r.session.transcript_version) || 0;
          if (serverText.length >= text.length) {
            if (serverText.length > self.confirmed.length) self.confirmed = serverText;
            return serverText;
          }
          // سرور کوتاه‌تر است (مثلاً قدیمی) — یک بار با نسخه تازه تلاش کن
          return reqJson('/api/sessions/' + self.sessionId, {
            method: 'PUT',
            body: { transcript: text, transcript_version: self.baseVersion, realtime_reliable: !self.unreliable, stt_mode: 'realtime' }
          }).then(function () { self.baseVersion++; return text; });
        });
      }
      throw err;
    });
  };

  RTSession.prototype.pause = function () {
    var self = this;
    if (self.state !== STATES.ACTIVE && self.state !== STATES.RECOVERED) return Promise.resolve(false);
    self.setState(STATES.MANUAL_PAUSED);
    self.stopLivePusher();
    // دم جمله flush شود (event-based با سقف صریح)، بعد ببند
    try {
      if (self.ws && self.ws.readyState === WebSocket.OPEN) {
        try { self.ws.send(JSON.stringify({ type: 'finalize' })); } catch (e) {}
        try { self.ws.send(''); } catch (e) {}
      }
    } catch (e) {}
    self.stopDurableSegment(); // سگمنت durable این بازه بسته شد
    self.closingIntentional = true;
    var done = function () {
      try { if (self.ws) self.ws.close(); } catch (e) {}
      self.ws = null;
      self.closingIntentional = false;
      // میکروفون آزاد شود (حریم خصوصی/موبایل) — resume دوباره می‌گیرد
      self.cleanupAudio();
      if (self.persist) self.persistConfirmed().catch(function () {});
    };
    return new Promise(function (res) {
      var to = setTimeout(function () { done(); res(true); }, PAUSE_FLUSH_MS);
      self.timers.push(to);
    });
  };

  RTSession.prototype.resume = function () {
    var self = this;
    if (self.state !== STATES.MANUAL_PAUSED) return Promise.resolve(false);
    self.setState(STATES.STARTING);
    self.closingIntentional = false;
    return self.ensureStream().then(function () {
      if (self.aborted) return false;
      return self.connectWithFreshMint().then(function (ok) {
        // ISSUE 1: مثل start — نتیجه‌ی دیررسیده حق تغییر state نهایی را ندارد.
        if (self.noNewConnections || self.aborted) { self.cleanupAudio(); return false; }
        if (!ok) { self.setState(STATES.MANUAL_PAUSED); return false; }
        self.startDurable(); // سگمنت durable جدید
        self.setState(STATES.ACTIVE);
        return true;
      });
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
    self.noNewConnections = true; // ابطال همه mint/WS/reconnect در-flight
    self.connEpoch++;
    self.setState(STATES.FINALIZING);
    self.clearTimers();
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
    return waitFinished.then(function () {
      self.closingIntentional = true;
      try { if (self.ws) self.ws.close(); } catch (e) {}
      self.ws = null;
      self.closingIntentional = false;
      self.stopDurableSegment();
      var realtimeText = cleanText(self.confirmed);
      if (!self.unreliable) {
        // مسیر موفق: persist نهایی و تمام
        var p = self.persist ? self.persistConfirmed().catch(function () { return realtimeText; }) : Promise.resolve(realtimeText);
        return p.then(function (saved) {
          if (self.persist) {
            reqJson('/api/sessions/' + self.sessionId, {
              method: 'PUT', body: { realtime_reliable: true, stt_mode: 'realtime' }
            }).catch(function () {});
          }
          self.cleanupAudio();
          self.unwatchOnline();
          self.setState(STATES.COMPLETED);
          return { text: saved, reliable: true, mode: 'realtime' };
        });
      }
      // مسیر unreliable → اول متن realtime به‌عنوان پایه persist شود (CAS)، بعد سگمنت‌ها
      // آپلود شوند؛ COMPLETED بلافاصله برمی‌گردد و drain در پس‌زمینه است (ISSUE 2).
      // merge سمت سرور چون baseVersion را می‌شناسد، متن کامل batch را جایگزین می‌کند (نه duplicate).
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
  };

  // ISSUE 2+3: آپلود سگمنت‌های durable به صف سرور — سریع و بدون poll.
  // purpose: حالت note به صف یادداشت می‌رود، نه transcript جلسه.
  RTSession.prototype.uploadBatchSegments = function () {
    var self = this;
    var segs = self.durableSegs.filter(function (b) { return b && b.size > 100; });
    if (!segs.length) {
      var t = cleanText(self.confirmed);
      if (self.persist) {
        self.persistConfirmed().catch(function () {});
        reqJson('/api/sessions/' + self.sessionId, {
          method: 'PUT', body: { realtime_reliable: false, stt_mode: 'realtime-unreliable-noaudio' }
        }).catch(function () {});
      }
      return Promise.resolve(false);
    }
    var purpose = self.mode === 'note' ? 'note' : 'transcript';
    var uploads = segs.map(function (blob, i) {
      var fd = new FormData();
      fd.append('file', blob, 'segment-' + i + '.webm');
      return fetch('/api/sessions/' + self.sessionId + '/batch-audio?purpose=' + purpose, { method: 'POST', body: fd })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (d) {
          if (!res.ok) throw new Error((d && d.error) || 'upload failed');
          return d;
        }); });
    });
    return Promise.allSettled(uploads).then(function (rs) {
      return rs.some(function (r) { return r.status === 'fulfilled'; });
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
    if (this.finishResolver) {
      var r = this.finishResolver; this.finishResolver = null;
      try { r({ aborted: true }); } catch (e) {}
    }
    this.closingIntentional = true;
    try { if (this.ws) this.ws.close(); } catch (e) {}
    this.ws = null;
    this.cleanupAudio();
    this.unwatchOnline();
    // سگمنت‌های durable دور ریخته می‌شوند (abort = عدم نیاز) مگر caller نگه دارد
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
  function forget(s) {
    live = live.filter(function (x) { return x !== s; });
  }

  window.FeeliaRT = {
    STATES: STATES,
    isAvailable: isAvailable,
    createSession: createSession,
    hasOpenConnection: hasOpenConnection,
    forget: forget,
    cleanText: cleanText,
    MAX_RECONNECT_ATTEMPTS: MAX_RECONNECT_ATTEMPTS
  };
})();
