/* FeeliaAnalytics — Microsoft Clarity، فقط برای تحلیلِ رفتارِ UI.
 *
 * اصول:
 *  - Clarity dependencyِ حیاتی نیست: هر خطا/قطعی/offline/بلاک‌شدن → بی‌صدا خاموش.
 *    هیچ مسیری از اپ منتظرِ این فایل نمی‌ماند و هیچ متدی throw نمی‌کند.
 *  - هرگز داده ارسال نمی‌شود: فقط نامِ رویداد از EVENTS، نامِ صفحه از SCREENS و نامِ
 *    خطای میکروفونِ مرورگر از MIC_ERRORS. identify هرگز صدا زده نمی‌شود (نه ID تراپیست، نه مراجع).
 *  - فقط وقتی لود می‌شود که: login شده + ادمین نیست + CLARITY_PROJECT_ID روی سرور ست است.
 *    (تصمیمِ مالک D1، 2026-09-15: بدونِ پرسیدنِ اجازه از تراپیست — نقضِ آگاهانه‌ی LAW-011.)
 *  - پوشاندنِ محتوا (data-clarity-mask) در خودِ index.html روی عناصرِ حساس است، مستقل از
 *    تنظیمِ داشبورد. data-clarity-unmask در این پروژه ممنوع است.
 *  - مستندات: docs/analytics-clarity.md
 */
'use strict';
(function () {
  var CONFIG_URL = '/api/client-config';
  var CONFIG_TIMEOUT_MS = 3000;
  var TAG_URL = 'https://www.clarity.ms/tag/';
  var PROJECT_ID_RE = /^[a-z0-9]{6,20}$/;
  var MAX_BUFFER = 50;

  // ⚠️ فقط نام — هیچ رویدادی پارامتر ندارد. رویدادِ جدید = اضافه‌کردن به همین لیست + docs.
  var EVENTS = toSet([
    'signup_completed', 'login_completed', 'logout_clicked',
    'client_create_opened', 'client_created', 'client_create_failed',
    'client_deactivated', 'client_reactivated', 'client_category_edited', 'client_deleted',
    'clients_tab_switched', 'client_pinned', 'client_unpinned', 'all_clients_opened',
    'transcript_opened', 'session_meta_edited', 'session_deleted',
    'client_consent_given', 'client_consent_declined', 'preflight_mic_failed',
    'session_start_clicked', 'session_started', 'session_start_failed',
    'session_pause_clicked', 'session_resume_clicked', 'session_end_clicked',
    'session_canceled', 'session_saved', 'session_exit_without_save',
    'session_live_resume_clicked', 'session_interrupted_resume_clicked',
    'live_text_toggled', 'sign_added', 'quick_note_added', 'text_note_added',
    'voice_note_started', 'voice_note_stop_clicked'
  ]);
  // نامِ screen در index.html → نامِ امن. Auth و Admin* عمداً اینجا نیستند.
  var SCREENS = {
    Clients: 'clients',
    AllClients: 'all_clients',
    Setup: 'session_setup',
    Live: 'session_live',
    Wrapup: 'session_wrapup',
    ClientDetail: 'client_profile'
  };
  var MIC_ERRORS = toSet([
    'NotAllowedError', 'PermissionDeniedError', 'NotFoundError', 'DevicesNotFoundError',
    'NotReadableError', 'TrackStartError', 'OverconstrainedError', 'ConstraintNotSatisfiedError',
    'AbortError', 'SecurityError', 'NotSupportedError', 'TypeError'
  ]);

  // off: قبل از boot / بعد از logout | pending: در حالِ گرفتنِ config | active: Clarity فعال |
  // disabled: ادمین/سرور/شبکه — تا boot بعدی خاموش
  // ⭐ (تصمیمِ مالک D1، 2026-09-15): دیگر حالتِ ask/denied و پرسیدنِ اجازه وجود ندارد —
  // با projectId معتبر مستقیم activate می‌شود. نقضِ آگاهانه‌ی LAW-011 («هرگز بدونِ رضایتِ
  // ذخیره‌شده‌ی تراپیست») به دستورِ مالک؛ باقیِ LAW-011 (بدونِ identify، فقط allowlist،
  // mask، هرگز برایِ ادمین) دست‌نخورده می‌ماند.
  var state = 'off';
  var projectId = null;
  var scriptInjected = false;
  var bootSeq = 0;
  var currentScreen = null;
  var buffer = [];

  function toSet(arr) {
    var o = Object.create(null);
    for (var i = 0; i < arr.length; i++) o[arr[i]] = true;
    return o;
  }
  function warn(reason) {
    try { console.warn('[feelia-analytics] ' + reason); } catch (e) {}
  }

  function callClarity() {
    if (!scriptInjected || typeof window.clarity !== 'function') return;
    try { window.clarity.apply(null, arguments); } catch (e) { warn('clarity call failed'); }
  }

  function send(item) {
    if (item[0] === 'event') callClarity('event', item[1]);
    else if (item[0] === 'tag') callClarity('set', item[1], item[2]);
  }
  // قبل از boot/در حینِ گرفتنِ config (مثلاً login_completed) نگه داشته می‌شود؛ فقط اگر
  // اجازه از قبل داده شده باشد ارسال می‌شود، وگرنه دور ریخته می‌شود.
  function enqueue(item) {
    if (state === 'active') { send(item); return; }
    if ((state === 'off' || state === 'pending') && buffer.length < MAX_BUFFER) buffer.push(item);
  }
  function sendScreen(name) {
    callClarity('set', 'screen', name);
    callClarity('event', 'screen_' + name);
  }

  function setInactive(next) {
    state = next;
    buffer = [];
    renderUI();
  }

  // معادلِ snippetِ رسمیِ Microsoft (Settings → Setup → Install manually) ولی بدونِ inline
  // script: صفِ window.clarity + یک <script async> به www.clarity.ms/tag/<id>. فقط یک‌بار.
  function injectScript(id) {
    if (scriptInjected) return true;
    try {
      if (!document.querySelector('script[data-feelia-clarity]')) {
        window.clarity = window.clarity || function () {
          (window.clarity.q = window.clarity.q || []).push(arguments);
        };
        var s = document.createElement('script');
        s.async = true;
        s.src = TAG_URL + encodeURIComponent(id);
        s.setAttribute('data-feelia-clarity', '1');
        s.onerror = function () {
          warn('clarity script failed to load — disabled');
          if (state === 'active') setInactive('disabled');
        };
        (document.head || document.documentElement).appendChild(s);
      }
      scriptInjected = true;
      return true;
    } catch (e) {
      warn('clarity inject failed');
      return false;
    }
  }

  function activate() {
    if (!projectId || !injectScript(projectId)) { setInactive('disabled'); return; }
    state = 'active';
    // اجازه فقط برای analytics است؛ ad storage هرگز.
    callClarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' });
    if (currentScreen) sendScreen(currentScreen);
    var pendingItems = buffer;
    buffer = [];
    for (var i = 0; i < pendingItems.length; i++) send(pendingItems[i]);
    renderUI();
  }

  function fetchConfig() {
    var ctrl = null;
    var timer = null;
    try { ctrl = new AbortController(); } catch (e) {}
    if (ctrl) timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, CONFIG_TIMEOUT_MS);
    return fetch(CONFIG_URL, {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error('status ' + r.status);
      return r.json();
    }).then(function (v) {
      clearTimeout(timer);
      return v;
    }, function (e) {
      clearTimeout(timer);
      throw e;
    });
  }

  // از enterApp() صدا زده می‌شود — fire-and-forget؛ هیچ promiseی برنمی‌گرداند.
  function boot(therapist) {
    try {
      if (state === 'active') return;
      bootSeq++;
      var seq = bootSeq;
      if (!therapist || !therapist.id || therapist.is_admin) { setInactive('disabled'); return; }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        state = 'off';
        window.addEventListener('online', function () {
          if (seq === bootSeq && state === 'off') boot(therapist);
        }, { once: true });
        return;
      }
      state = 'pending';
      fetchConfig().then(function (cfg) {
        if (seq !== bootSeq || state !== 'pending') return;
        var id = cfg && cfg.clarity && cfg.clarity.projectId;
        if (typeof id !== 'string' || !PROJECT_ID_RE.test(id)) { setInactive('disabled'); return; }
        projectId = id;
        activate();
      }, function () {
        if (seq === bootSeq && state === 'pending') setInactive('disabled');
      }).catch(function () {});
    } catch (e) {
      warn('boot failed');
      try { setInactive('disabled'); } catch (ee) {}
    }
  }

  function screen(name) {
    try {
      currentScreen = SCREENS[name] || null;
      renderUI(name);
      if (currentScreen && state === 'active') sendScreen(currentScreen);
    } catch (e) {}
  }

  function event(name) {
    try {
      if (typeof name === 'string' && EVENTS[name]) enqueue(['event', name]);
    } catch (e) {}
  }

  function micError(errName) {
    try {
      enqueue(['event', 'preflight_mic_failed']);
      enqueue(['tag', 'mic_error', (typeof errName === 'string' && MIC_ERRORS[errName]) ? errName : 'other']);
    } catch (e) {}
  }

  // true یعنی اسکریپتِ Clarity در این صفحه لود شده و index.html باید reload کند تا
  // ضبط برای کاربرِ بعدیِ همین تب/دستگاه ادامه پیدا نکند.
  function onLogout() {
    try {
      bootSeq++;
      projectId = null;
      setInactive('off');
      return scriptInjected;
    } catch (e) { return false; }
  }

  function renderUI() {}

  window.FeeliaAnalytics = {
    boot: boot,
    screen: screen,
    event: event,
    micError: micError,
    onLogout: onLogout,
    state: function () { return state; }
  };
})();
