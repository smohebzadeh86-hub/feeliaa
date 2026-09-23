/* FeeliaObs — لایه‌ی رصد/حسابرسیِ فازِ ۱، سمتِ کلاینت.
 *
 * ⚠️ قاعده‌ی سخت (LAW-001): این فایل هرگز نباید محتوایِ متنیِ صفحه را بخواند.
 * جست‌وجو کن، نباید هیچ‌کدام از این‌ها این‌جا باشد:
 *   textContent, innerText, innerHTML, .value, placeholder, title, alt,
 *   aria-label, dataset (به‌جز data-obs)
 * برایِ هر کلیک فقط ۴ خاصیت از DOM خوانده می‌شود: data-obs/id → target_id،
 * role → target_role، tagName → target_tag، و value_num که همیشه برایِ کلیک null است.
 *
 * اصول (هم‌راستا با feelia-analytics.js):
 *  - dependencyِ حیاتی نیست: هر خطا/آفلاین/بلاک‌شدن → بی‌صدا خاموش، هیچ throw.
 *  - برخلافِ Clarity، برایِ ادمین هم فعال است (نیازِ خودِ ادمین به دیدنِ کلیک/ناوبریِ خودش).
 *  - کلیدِ روشن/خاموش از سرور (GET /api/client-config → obs:{enabled,sample}).
 *  - مستندات: docs/02-reference/api-catalog.md, PROJECT_STATUS.md (فازِ ۱ِ رصد).
 */
'use strict';
(function () {
  var CONFIG_URL = '/api/client-config';
  var EVENTS_URL = '/api/obs/events';
  var CONFIG_TIMEOUT_MS = 3000;
  var MAX_BUF = 200;
  var BATCH_MAX_DEFAULT = 50;
  var FLUSH_INTERVAL_MS = 15000;
  var BACKOFF_STEPS = [5000, 15000, 60000, 300000];
  var SAFE_TOKEN_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
  var SAFE_ROLE_RE = /^[a-z-]{1,32}$/;
  // فازِ ۲ — allowlistِ کلیدهایِ detailِ رویدادهایِ rt.* (باید زیرمجموعه‌یِ
  // ALLOWED_DETAIL_KEYSِ سرور در server/src/obs/redact.ts باشد؛ این‌جا فقط یک لایه‌ی
  // دفاعیِ اضافه‌ست، مرجعِ نهایی همیشه sanitizeDetail سمتِ سرور است).
  var CLIENT_DETAIL_KEYS = {
    attempt: 1, attempts: 1, duration_ms: 1, delay_ms: 1, elapsed_ms: 1,
    status: 1, code: 1, reason: 1, state: 1, prev_state: 1,
    close_code: 1, was_clean: 1, retries: 1, ok: 1
  };
  var MAX_DETAIL_KEYS = 12;

  var state = 'off'; // off | pending | active | disabled | silenced
  var bootSeq = 0;
  var enabled = false;
  var sample = 1;
  var batchMax = BATCH_MAX_DEFAULT;
  var navId = null;
  var seq = 0;
  var screenEnteredAt = 0;
  var currentScreen = null;
  var sessionId = null;
  var runId = null;
  var buffer = [];
  var dropped = 0;
  var sending = false;
  var backoffIdx = -1;
  var backoffTimer = null;
  var flushTimer = null;
  var listenersBound = false;

  function warn(reason) {
    try { console.warn('[feelia-obs] ' + reason); } catch (e) {}
  }

  function safeToken(v) {
    return (typeof v === 'string' && SAFE_TOKEN_RE.test(v)) ? v : null;
  }
  function safeRole(v) {
    return (typeof v === 'string' && SAFE_ROLE_RE.test(v)) ? v : null;
  }
  function safeTag(v) {
    return (typeof v === 'string' && /^[A-Z0-9]{1,16}$/.test(v)) ? v : null;
  }

  function newNavId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    } catch (e) {}
    // fallback ساده — فقط وقتی crypto.randomUUID نباشد (مرورگرِ خیلی قدیمی)
    var s = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    return s.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function pushRaw(item) {
    if (state === 'silenced') return;
    if (buffer.length >= MAX_BUF) {
      buffer.shift();
      dropped++;
    }
    buffer.push(item);
    if (state === 'active' && buffer.length >= batchMax) tryFlush();
  }

  function baseItem(kind) {
    return {
      nav_id: navId,
      seq: seq++,
      kind: kind,
      screen: currentScreen,
      session_id: sessionId,
      ts: Date.now(),
    };
  }

  // ————— کلیک (capture phase — مودال‌ها stopPropagation می‌زنند) —————
  function onAnyClick(e) {
    try {
      var t = e && e.target;
      if (!t || t.nodeType !== 1) return;
      var rawId = null;
      try { rawId = (t.getAttribute && t.getAttribute('data-obs')) || t.id || null; } catch (e2) {}
      var rawRole = null;
      try { rawRole = t.getAttribute && t.getAttribute('role'); } catch (e3) {}
      var item = baseItem('click');
      item.target_id = safeToken(rawId);
      item.target_role = safeRole(rawRole);
      item.target_tag = safeTag(t.tagName);
      item.value_num = null;
      pushRaw(item);
    } catch (e4) {}
  }

  function bindListeners() {
    if (listenersBound) return;
    listenersBound = true;
    try { document.addEventListener('click', onAnyClick, true); } catch (e) {}
    try {
      document.addEventListener('visibilitychange', function () {
        try {
          var item = baseItem('visibility');
          item.target_id = document.visibilityState === 'hidden' ? 'hidden' : 'visible';
          pushRaw(item);
          if (document.visibilityState === 'hidden') flushUnload();
        } catch (e) {}
      });
    } catch (e) {}
    try {
      window.addEventListener('online', function () {
        try { var item = baseItem('net'); item.target_id = 'online'; pushRaw(item); } catch (e) {}
      });
      window.addEventListener('offline', function () {
        try { var item = baseItem('net'); item.target_id = 'offline'; pushRaw(item); } catch (e) {}
      });
    } catch (e) {}
    try {
      window.addEventListener('pagehide', function () { flushUnload(); });
    } catch (e) {}
    try {
      window.addEventListener('error', function (ev) {
        try {
          var ctorName = (ev && ev.error && ev.error.constructor && ev.error.constructor.name) || 'Error';
          var item = baseItem('error');
          item.target_id = safeToken(ctorName) || 'Error';
          pushRaw(item);
        } catch (e) {}
      });
      window.addEventListener('unhandledrejection', function (ev) {
        try {
          var reason = ev && ev.reason;
          var ctorName = (reason && reason.constructor && reason.constructor.name) || 'Error';
          var item = baseItem('error');
          item.target_id = safeToken(ctorName) || 'Error';
          pushRaw(item);
        } catch (e) {}
      });
    } catch (e) {}
  }

  // ————— بافر/بچ/backoff —————
  function scheduleBackoff() {
    if (backoffTimer) return;
    backoffIdx = Math.min(backoffIdx + 1, BACKOFF_STEPS.length - 1);
    var delay = BACKOFF_STEPS[backoffIdx];
    backoffTimer = setTimeout(function () {
      backoffTimer = null;
      tryFlush();
    }, delay);
  }
  function resetBackoff() {
    backoffIdx = -1;
    if (backoffTimer) { clearTimeout(backoffTimer); backoffTimer = null; }
  }

  function buildPayload(limit) {
    var items = buffer.splice(0, limit || batchMax);
    if (dropped > 0) {
      var d = baseItem('lifecycle');
      d.target_id = 'obs.client_dropped';
      d.value_num = dropped;
      dropped = 0;
      items.push(d);
    }
    return items;
  }

  function tryFlush() {
    try {
      if (state !== 'active' || sending || !buffer.length) return;
      if (backoffTimer) return; // در حالِ backoff — نگه‌دار تا تایمر برسد
      var items = buildPayload(batchMax);
      if (!items.length) return;
      sending = true;
      var body = JSON.stringify({ events: items });
      fetch(EVENTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        keepalive: true,
        body: body,
      }).then(function (r) {
        sending = false;
        if (r.status === 401) { state = 'silenced'; buffer = []; return; }
        if (r.status === 413) { batchMax = Math.max(5, Math.floor(batchMax / 2)); scheduleBackoff(); return; }
        if (r.status === 429) { buffer = []; scheduleBackoff(); return; }
        if (r.ok) { resetBackoff(); if (buffer.length) tryFlush(); return; }
        scheduleBackoff();
      }, function () {
        sending = false;
        scheduleBackoff();
      });
    } catch (e) {
      sending = false;
    }
  }

  // مسیرِ unload — sendBeacon (Blob با نوعِ صریح، وگرنه متنِ خام با text/plain می‌رود
  // که body-parserِ Fastify نمی‌گیرد)؛ fallback fetch keepalive.
  function flushUnload() {
    try {
      if (state !== 'active' || !buffer.length) return;
      var items = buildPayload(MAX_BUF);
      if (!items.length) return;
      var body = JSON.stringify({ events: items });
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        var ok = navigator.sendBeacon(EVENTS_URL, blob);
        if (ok) return;
      }
      fetch(EVENTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        keepalive: true,
        body: body,
      }).catch(function () {});
    } catch (e) {}
  }

  function startTimers() {
    if (flushTimer) return;
    flushTimer = setInterval(function () { tryFlush(); }, FLUSH_INTERVAL_MS);
  }

  // ————— API عمومی —————
  function fetchConfig() {
    var ctrl = null;
    var timer = null;
    try { ctrl = new AbortController(); } catch (e) {}
    if (ctrl) timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, CONFIG_TIMEOUT_MS);
    return fetch(CONFIG_URL, {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: ctrl ? ctrl.signal : undefined,
    }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('status ' + r.status);
      return r.json();
    }, function (e) {
      clearTimeout(timer);
      throw e;
    });
  }

  // از enterApp() صدا زده می‌شود — fire-and-forget، بدونِ promiseِ برگشتی.
  function boot() {
    try {
      bootSeq++;
      var mySeq = bootSeq;
      state = 'pending';
      navId = newNavId();
      seq = 0;
      screenEnteredAt = Date.now();
      bindListeners();
      startTimers();
      fetchConfig().then(function (cfg) {
        if (mySeq !== bootSeq) return;
        var obs = cfg && cfg.obs;
        enabled = !!(obs && obs.enabled);
        var s = obs && typeof obs.sample === 'number' ? obs.sample : 1;
        sample = (s > 0 && s <= 1) ? s : 1;
        // sample per-page-load — یک قرعه‌کشیِ واحد در همین boot، نه به‌ازایِ هر رویداد.
        var picked = Math.random() < sample;
        if (!enabled || !picked) { state = 'disabled'; buffer = []; return; }
        state = 'active';
        resetBackoff();
        if (buffer.length) tryFlush();
      }, function () {
        if (mySeq === bootSeq) { state = 'disabled'; buffer = []; }
      }).catch(function () {});
    } catch (e) {
      warn('boot failed');
      try { state = 'disabled'; } catch (ee) {}
    }
  }

  function setScreen(name) {
    try {
      var now = Date.now();
      var stayedMs = currentScreen ? (now - screenEnteredAt) : 0;
      var item = baseItem('nav');
      item.target_id = safeToken(typeof name === 'string' ? name : null);
      item.value_num = Number.isFinite(stayedMs) ? Math.min(stayedMs, 2147483647) : null;
      currentScreen = typeof name === 'string' ? name : null;
      screenEnteredAt = now;
      pushRaw(item);
    } catch (e) {}
  }

  function setSession(newSessionId, newRunId) {
    try {
      sessionId = (typeof newSessionId === 'string' && newSessionId) ? newSessionId : null;
      runId = (typeof newRunId === 'string' && newRunId) ? newRunId : null;
    } catch (e) {}
  }

  function sanitizeClientDetail(input) {
    var out = {};
    if (!input || typeof input !== 'object') return out;
    var n = 0;
    for (var k in input) {
      if (!Object.prototype.hasOwnProperty.call(input, k)) continue;
      if (n >= MAX_DETAIL_KEYS) break;
      if (!CLIENT_DETAIL_KEYS[k]) continue;
      var v = input[k];
      if (typeof v === 'number' && isFinite(v)) { out[k] = Math.trunc(v); n++; continue; }
      if (typeof v === 'boolean') { out[k] = v; n++; continue; }
      if (typeof v === 'string' && SAFE_TOKEN_RE.test(v)) { out[k] = v; n++; }
      // بقیه (رشته‌ی ناامن، object تودرتو، array، null) بی‌صدا حذف می‌شود — دفاعِ
      // این‌جا مکملِ sanitizeDetailِ سمتِ سرور است، نه جایگزینِ آن.
    }
    return out;
  }

  // فازِ ۲ — rt.* از خودِ feelia-rt.js صدا زده می‌شود (window.FeeliaObs.event، همیشه
  // در try/catch سمتِ caller). دو شکلِ ورودی پشتیبانی می‌شود تا سازگاریِ عقب‌رو حفظ شود:
  //  - event(name, {..detail..})  → رویدادِ ساختاریافته (kind='client_event')، برایِ
  //    obs_events سمتِ سرور (که run_id/detail JSON دارد) — نه obs_ui_events.
  //  - event(name, number)        → شکلِ سادهِ فازِ ۱ (lifecycle/value_num)، دست‌نخورده.
  function event(name, arg) {
    try {
      var evName = safeToken(typeof name === 'string' ? name : null);
      if (!evName) return;
      if (arg !== null && typeof arg === 'object') {
        var citem = baseItem('client_event');
        citem.event = evName;
        citem.detail = sanitizeClientDetail(arg);
        citem.run_id = runId;
        pushRaw(citem);
        return;
      }
      var item = baseItem('lifecycle');
      item.target_id = evName;
      item.value_num = (typeof arg === 'number' && isFinite(arg)) ? Math.trunc(arg) : null;
      pushRaw(item);
    } catch (e) {}
  }

  function flush() {
    try { tryFlush(); } catch (e) {}
  }

  // true یعنی این تب واقعاً در حالِ فرستادن بود — index.html می‌تواند تصمیمِ reload بگیرد
  // (هم‌راستا با الگویِ onLogout در feelia-analytics.js).
  function onLogout() {
    try {
      flushUnload();
      bootSeq++;
      var wasActive = state === 'active';
      state = 'off';
      buffer = [];
      sessionId = null;
      runId = null;
      return wasActive;
    } catch (e) { return false; }
  }

  window.FeeliaObs = {
    boot: boot,
    setScreen: setScreen,
    setSession: setSession,
    event: event,
    flush: flush,
    onLogout: onLogout,
    state: function () { return state; },
  };
})();
