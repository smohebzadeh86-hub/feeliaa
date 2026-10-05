// ===== [feature:admin-quality] ===== «کیفیت رونویسی» در پنل ادمین (Session Data Engine، 2026-10-01).
// نمای کلی audio_jobs.transcript_metrics: جمع‌بندی + جلسات آپلودی، بدترین اول. فقط عدد/پرچم — هیچ متن بالینی (LAW-001).
// از helperهای سراسری index.html (api، $، toFa، fmtDur، adminStatTile، adminBadge، adminBtn، fillAdminTherapistFilter،
// openAdminSessionDetail، showScreen، hasActiveRecording، showBanner، clearBanner، adminDetailReturn) فقط در زمان فراخوانی استفاده می‌کند.
(function () {
  'use strict';

  var FLAG_FA = {
    low_coverage: 'پوشش کم',
    uncovered_gap: 'حفره‌ی وسط',
    head_gap: 'ابتدا بی‌متن',
    tail_gap: 'انتها بی‌متن',
    speakers_merged: 'گوینده‌ی ادغام‌شده',
    speakers_extra: 'گوینده‌ی اضافه',
    speakers_minor: 'گوینده‌ی فانتوم',
    speaker_imbalance: 'سهم نامتعادل',
    fragmented_turns: 'نوبت‌های تکه‌تکه'
  };
  var data = null;

  function pct(x) { return (x === null || x === undefined) ? '—' : toFa(Math.round(x * 100)) + '٪'; }

  async function open() {
    if (hasActiveRecording()) { showBanner('warn', 'ابتدا جلسه‌ی زنده را پایان دهید یا لغو کنید.'); return; }
    clearBanner();
    adminDetailReturn = 'quality';
    showScreen('AdminQuality');
    await fillAdminTherapistFilter('adminQualityTherapist');
    await load();
  }

  async function load() {
    try {
      var parts = [];
      var t = $('adminQualityTherapist').value; if (t) parts.push('therapist_id=' + encodeURIComponent(t));
      var d = $('adminQualityDays').value; if (d) parts.push('days=' + encodeURIComponent(d));
      data = await api('/api/admin/upload-quality' + (parts.length ? '?' + parts.join('&') : ''));
      render();
    } catch (e) { showBanner('error', e.message); }
  }

  function render() {
    var s = (data && data.summary) || {};
    var flagged = s.flagged || 0;
    $('adminQualityStats').innerHTML =
      adminStatTile('جلسه‌ی سنجیده‌شده', toFa(s.sessions || 0)) +
      adminStatTile('میانه‌ی پوشش متن', pct(s.coverage_median), s.coverage_median !== null && s.coverage_median < 0.85) +
      adminStatTile('کمترین پوشش', pct(s.coverage_min), s.coverage_min !== null && s.coverage_min < 0.85) +
      adminStatTile('جلسه با هشدار', toFa(flagged), flagged > 0);
    var fc = s.flag_counts || {};
    var keys = Object.keys(fc).sort(function (a, b) { return fc[b] - fc[a]; });
    $('adminQualityFlags').textContent = keys.length
      ? 'پرتکرارترین مشکل‌ها: ' + keys.map(function (k) { return (FLAG_FA[k] || k) + ' (' + toFa(fc[k]) + ')'; }).join('، ')
      : '';
    var list = $('adminQualityList');
    list.innerHTML = '';
    var rows = (data && data.rows) || [];
    $('adminQualityEmpty').hidden = rows.length > 0;
    rows.forEach(function (r) { list.appendChild(row(r)); });
  }

  function row(r) {
    var m = r.metrics || {};
    var flags = m.flags || [];
    var cls = flags.length ? (flags.indexOf('low_coverage') >= 0 || flags.indexOf('speakers_merged') >= 0 ? 'bad' : 'warn') : 'ok';
    var el = document.createElement('div'); el.className = 'card admin-row';
    var head = document.createElement('div'); head.className = 'admin-row-head';
    var title = document.createElement('div'); title.className = 'admin-row-title';
    var label = (r.therapist_name || '—') + ' · ' + (r.client_code || '—') + (r.session_num ? ' · جلسه‌ی ' + toFa(r.session_num) : '') +
      (r.source === 'realtime' ? ' · زنده' : r.source === 'async' ? ' · زنده (رونویسی کامل)' : '');
    title.textContent = label;
    var badges = document.createElement('div'); badges.className = 'admin-row-badges';
    if (!flags.length) badges.appendChild(adminBadge('ok', 'بدون هشدار'));
    flags.forEach(function (f) { badges.appendChild(adminBadge(cls, FLAG_FA[f] || f)); });
    head.appendChild(title); head.appendChild(badges);
    var meta = document.createElement('div'); meta.className = 'admin-row-meta';
    var bits = ['پوشش ' + pct(m.coverage)];
    var sp = 'گوینده ' + toFa(m.speakers_found || 0) + (m.speakers_expected ? ' از ' + toFa(m.speakers_expected) : '');
    bits.push(sp);
    if (m.longest_uncovered_ms) bits.push('بلندترین بی‌متن ' + toFa(Math.round(m.longest_uncovered_ms / 1000)) + 'ث');
    if (m.low_conf_ratio !== null && m.low_conf_ratio !== undefined) bits.push('کم‌اطمینان ' + pct(m.low_conf_ratio));
    if (r.duration_ms) bits.push(fmtDur(r.duration_ms));
    bits.push(new Date(r.created_at).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' }));
    meta.textContent = bits.join(' · ');
    el.appendChild(head); el.appendChild(meta);
    var actions = document.createElement('div'); actions.className = 'admin-row-actions';
    actions.appendChild(adminBtn('مشاهده', 'btn-ghost', function () { adminDetailReturn = 'quality'; openAdminSessionDetail(r.session_id, label); }));
    el.appendChild(actions);
    return el;
  }

  // ——— تاریخچه‌ی «متن نهایی» در جزئیات جلسه‌ی ادمین (migration 037) ———
  // فهرست فقط متادیتاست؛ متن هر نسخه فقط با کلیک «نمایش» گرفته می‌شود (سرور مشاهده را ممیزی می‌کند).
  var KIND_FA = { baseline: 'نسخه‌ی پیش از تاریخچه', generated: 'ساخت خودکار', role_edit: 'اصلاح نقش توسط درمانگر' };
  async function renderFtHistory(sessionId) {
    var box = $('adminFtHistory');
    if (!box) return;
    box.innerHTML = ''; box.hidden = true;
    var d;
    try { d = await api('/api/admin/sessions/' + encodeURIComponent(sessionId) + '/final-transcript/versions'); } catch (e) { return; }
    var vs = (d && d.versions) || [];
    if (!vs.length) return;
    var card = document.createElement('div'); card.className = 'card';

    // سوییچ «متن خام / متن نهایی» روی باکس اصلی جلسه. نسخه‌ی جاری = بالاترین نسخه (هر نوشتن final_transcripts نسخه می‌گذارد).
    var tBox = $('adminSessionDetailTranscript');
    if (tBox) {
      var rawText = tBox.textContent, showingFinal = false, finalText = null;
      var sw = document.createElement('div'); sw.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px';
      var swLabel = document.createElement('span'); swLabel.textContent = 'متن نمایش‌داده‌شده: متن خام';
      var swBtn = adminBtn('نمایش متن نهایی', 'btn-primary', async function () {
        try {
          if (!showingFinal) {
            if (finalText === null) {
              var t = await api('/api/admin/sessions/' + encodeURIComponent(sessionId) + '/final-transcript/versions/' + vs[0].version);
              finalText = t.clean_text || '';
            }
            if ($('adminSessionDetailTranscript') !== tBox || box.hidden) return;
            tBox.textContent = finalText; showingFinal = true;
            swLabel.textContent = 'متن نمایش‌داده‌شده: متن نهایی (نسخه‌ی ' + toFa(vs[0].version) + ')'; swBtn.textContent = 'نمایش متن خام';
          } else {
            tBox.textContent = rawText; showingFinal = false;
            swLabel.textContent = 'متن نمایش‌داده‌شده: متن خام'; swBtn.textContent = 'نمایش متن نهایی';
          }
          attachTranscriptExpander(tBox, tBox.textContent, null, null);
        } catch (e) { showBanner('error', e.message); }
      });
      sw.appendChild(swLabel); sw.appendChild(swBtn); card.appendChild(sw);
    }

    var h = document.createElement('strong'); h.textContent = 'تاریخچه‌ی متن نهایی (' + toFa(vs.length) + ' نسخه)';
    card.appendChild(h);
    vs.forEach(function (v, i) {
      var row = document.createElement('div'); row.className = 'admin-row-meta'; row.style.marginTop = '8px';
      var bits = ['نسخه‌ی ' + toFa(v.version) + (i === 0 ? ' (جاری)' : ''), KIND_FA[v.kind] || v.kind, toFa(v.chars) + ' نویسه'];
      if (v.turns !== null && v.turns !== undefined) bits.push(toFa(v.turns) + ' نوبت');
      bits.push(new Date(v.created_at).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' }));
      var label = document.createElement('span'); label.textContent = bits.join(' · ');
      var pre = document.createElement('pre'); pre.hidden = true;
      pre.style.cssText = 'white-space:pre-wrap;max-height:320px;overflow:auto;font-family:inherit;font-size:13px;margin:6px 0 0;padding:8px;border:1px solid var(--line);border-radius:8px';
      var btn = adminBtn('نمایش', 'btn-ghost', async function () {
        if (!pre.hidden) { pre.hidden = true; btn.textContent = 'نمایش'; return; }
        try {
          var t = await api('/api/admin/sessions/' + encodeURIComponent(sessionId) + '/final-transcript/versions/' + v.version);
          pre.textContent = t.clean_text || ''; pre.hidden = false; btn.textContent = 'بستن';
        } catch (e) { showBanner('error', e.message); }
      });
      btn.style.marginInlineStart = '8px';
      row.appendChild(label); row.appendChild(btn);
      card.appendChild(row); card.appendChild(pre);
    });
    box.appendChild(card); box.hidden = false;
  }

  window.FeeliaAdminQuality = { open: open, load: load, renderFtHistory: renderFtHistory };
})();
