// Harness: تست state machine موتور FeeliaRT با Soniox و Backend جعلی (بدون شبکه/DB واقعی).
const fs = require('fs');
const path = require('path');

const MASTER = 'MASTER-SECRET-XYZ';
let mintCount = 0;
const sessions = {}; // id -> {transcript, transcript_version, notes: []}
let batchQueue = []; // transcript segs {sessionId}
let noteQueue = []; // note segs {sessionId}
let batchPolls = 0;
let notePolls = 0;
let neverDrain = false; // برای T14: صف عمداً تخلیه نمی‌شود
let mintFailMode = false; // برای T16: mint همیشه 503
const fetchUrls = [];
let wsCreatedCount = 0;

function newSession(id) { sessions[id] = { transcript: '', transcript_version: 0, notes: [] }; }

// ——— stub های مرورگر ———
const sentBlobs = [];
// ⭐ واقع‌گرا مثلِ MediaRecorderِ واقعی (۲۰۲۶-۰۹-۲۳، race چرخشِ durable): اولین chunk هدرِ
// container (نشانگرِ 'HDR') را دارد، و stop() ناهمگام است — دُمِ صدا ('TAIL') و onstop در
// یک taskِ بعدی می‌رسند. نسخه‌ی قبلیِ کاملاً همگام این race را هرگز بازتولید نمی‌کرد.
class FakeRecorder {
  constructor(stream, opts) { this.stream = stream; this.durable = !!(opts && opts.audioBitsPerSecond); this.state = 'inactive'; this.ondataavailable = null; this.onstop = null; }
  start(ts) {
    this.state = 'recording';
    if (this.durable) FakeRecorder.durableStarts++; // فقط durable (liveRec بیت‌ریتِ صریح ندارد)
    setTimeout(() => { if (this.ondataavailable) this.ondataavailable({ data: new Blob(['HDR' + 'x'.repeat(500)]) }); }, 0);
  }
  stop() {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    setTimeout(() => {
      if (this.ondataavailable) this.ondataavailable({ data: new Blob(['TAIL']) });
      if (this.onstop) this.onstop();
    }, 0);
  }
}
globalThis.MediaRecorder = FakeRecorder;
FakeRecorder.isTypeSupported = () => true;
FakeRecorder.durableStarts = 0;
Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: { getUserMedia: async (c) => (globalThis.lastGumConstraints = c, { active: true, getTracks: () => [{ stop() {} }] }) } }, configurable: true, writable: true });

class FakeWS {
  constructor(url) { this.url = url; this.readyState = 0; this.sent = []; FakeWS.last = this; wsCreatedCount++; }
  close() { this.readyState = 3; if (this.onclose) this.onclose(); }
}
FakeWS.CONNECTING = 0; FakeWS.OPEN = 1; FakeWS.CLOSED = 3;
globalThis.WebSocket = FakeWS;
function serverOpen(ws) { ws.readyState = 1; if (ws.onopen) ws.onopen(); }
FakeWS.prototype.send = function (d) { this.sent.push(d); };
function serverTokens(ws, tokens, finished) {
  if (ws.onmessage) ws.onmessage({ data: JSON.stringify({ tokens, finished: !!finished }) });
}
function serverClose(ws) { ws.readyState = 3; if (ws.onclose) ws.onclose(); }

globalThis.fetch = async (url, opts = {}) => {
  const method = opts.method || 'GET';
  fetchUrls.push(method + ' ' + url);
  const json = (status, data) => ({ ok: status < 300, status, json: async () => data });
  if (url === '/api/stt/realtime-session' && method === 'POST') {
    if (mintFailMode) return json(503, { error: 'mint failed', code: 'mint-transport' });
    mintCount++;
    const body = JSON.parse(opts.body);
    if (!sessions[body.session_id]) return json(404, { error: 'not found' });
    return json(200, { websocket_url: 'wss://fake-soniox', model: 'stt-rt-v5', api_key: 'TEMP-' + mintCount, expires_in_seconds: 120, single_use: true, stt_defaults: { model: 'stt-rt-v5', context: { general: [{ key: 'speakers', value: 'FAKE-CTX' }] } } });
  }
  let m = url.match(/^\/api\/sessions\/([^/?]+)$/);
  if (m && method === 'GET' && !url.endsWith('batch-status')) {
    const s = sessions[m[1]]; if (!s) return json(404, {});
    return json(200, { session: { transcript: s.transcript, transcript_version: s.transcript_version }, notes: s.notes });
  }
  if (m && method === 'PUT') {
    const s = sessions[m[1]]; const body = JSON.parse(opts.body);
    if (body.transcript !== undefined) {
      if (typeof body.transcript_version === 'number' && body.transcript_version !== s.transcript_version) {
        const e = new Error('conflict'); e.status = 409; throw eWithStatus(409, { error: 'version-conflict', current_version: s.transcript_version });
      }
      s.transcript = body.transcript; s.transcript_version++;
    }
    return json(200, { session: { transcript: s.transcript, transcript_version: s.transcript_version } });
  }
  m = url.match(/^\/api\/sessions\/([^/?]+)\/batch-audio/);
  if (m && method === 'POST') {
    const q = new URLSearchParams(url.split('?')[1] || '');
    sentBlobs.push({ sessionId: m[1], purpose: q.get('purpose'), seq: Number(q.get('seq')), blob: opts.body && opts.body.f ? opts.body.f[0] : null });
    const purpose = q.get('purpose') || 'transcript';
    // ⭐ archive فقط آرشیو می‌شود، هرگز رونویسی — قبلاً mock آن را هم در batchQueue می‌گذاشت و
    // سگمنتی که اشتباهاً archive گرفته بود (مثلاً آخرین سگمنتِ finish در FAILED) تست را سبز نگه می‌داشت.
    const archiveOnly = purpose === 'archive' || purpose === 'note-archive';
    if (!archiveOnly) (purpose === 'note' ? noteQueue : batchQueue).push({ sessionId: m[1] });
    return json(202, { status: archiveOnly ? 'archived' : 'queued', purpose });
  }
  m = url.match(/^\/api\/sessions\/([^/?]+)\/batch-status$/);
  if (m) {
    const sid = m[1];
    const s = sessions[sid];
    batchPolls++;
    // transcript drain
    let tPending = batchQueue.some((q) => q.sessionId === sid);
    if (tPending && !neverDrain && batchPolls >= 2) {
      s.transcript = s.transcript ? s.transcript + '\n\nBATCH FULL TEXT' : 'BATCH FULL TEXT';
      s.transcript_version++;
      batchQueue = batchQueue.filter((q) => q.sessionId !== sid);
      tPending = false;
    }
    // note drain → فقط session_notes، هرگز transcript
    notePolls++;
    let nPending = noteQueue.some((q) => q.sessionId === sid);
    if (nPending && !neverDrain && notePolls >= 2) {
      s.notes.push({ id: 'n' + (s.notes.length + 1), type: 'voice', text: 'NOTE BATCH TEXT', wall_clock: '', created_at: new Date().toISOString() });
      noteQueue = noteQueue.filter((q) => q.sessionId !== sid);
      nPending = false;
    }
    const anyDone = !tPending && !nPending;
    return json(200, {
      batch_status: anyDone ? 'done' : (tPending ? 'processing' : null),
      audio_pending: tPending, note_audio_pending: nPending,
    });
  }
  m = url.match(/^\/api\/sessions\/([^/?]+)\/batch-retry/);
  if (m && method === 'POST') {
    const purpose = url.includes('purpose=note') ? 'note' : 'transcript';
    const pend = purpose === 'note' ? noteQueue.some((q) => q.sessionId === m[1]) : batchQueue.some((q) => q.sessionId === m[1]);
    if (!pend) return json(400, { error: 'صوتی در صف نیست' });
    batchPolls = 0; notePolls = 0; // retry: شمارنده drain ریست می‌شود
    return json(200, { status: 'retrying', purpose });
  }
  return json(404, {});
};
function eWithStatus(status, data) { const e = new Error(data.error); e.status = status; e.code = data.code; e.data = data; return e; }
// fetch در feelia-rt برای PUT از res.json روی then استفاده می‌کند؛ خطای 409 باید از json بیاید، نه throw.
// پس fetch بالا برای PUT با نسخه اشتباه باید {ok:false,status:409} برگرداند:
const rawFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const method = opts.method || 'GET';
  let m = url.match(/^\/api\/sessions\/([^/]+)$/);
  if (m && method === 'PUT' && opts.body) {
    const s = sessions[m[1]]; const body = JSON.parse(opts.body);
    if (body.transcript !== undefined && typeof body.transcript_version === 'number' && body.transcript_version !== s.transcript_version) {
      return { ok: false, status: 409, json: async () => ({ error: 'version-conflict', code: 'version-conflict', current_version: s.transcript_version }) };
    }
  }
  return rawFetch(url, opts);
};
globalThis.FormData = class { constructor() { this.f = []; } append(k, v, n) { this.f.push(v); } };
globalThis.window = globalThis;
// mock حداقلیِ IndexedDB برای harness (فقط عملیاتِ AudioQueueDB)
(function () {
  const data = new Map();
  const req = (fn) => { const r = { result: undefined, onsuccess: null, onerror: null }; setTimeout(() => { try { r.result = fn(); } catch (e) { r.error = e; if (r.onerror) r.onerror(); return; } if (r.onsuccess) r.onsuccess(); }, 0); return r; };
  const store = {
    put: (rec) => req(() => { data.set(rec.id, rec); return rec.id; }),
    getAll: () => req(() => [...data.values()]),
    delete: (id) => req(() => { data.delete(id); }),
    index: () => ({ getAll: (range) => req(() => [...data.values()].filter((r) => r.sessionId === range.v)) }),
  };
  const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => store, transaction: () => ({ objectStore: () => store }) };
  globalThis.indexedDB = { open: () => { const r = { result: db }; setTimeout(() => r.onsuccess && r.onsuccess(), 0); return r; } };
  globalThis.IDBKeyRange = { only: (v) => ({ v }) };
})();

globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {};

const src = fs.readFileSync(path.join('public', 'feelia-rt.js'), 'utf8');
eval(src);
const RT = globalThis.FeeliaRT;

const results = [];
function ok(name, cond, extra) { results.push([(cond ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' — ' + extra : '')]); if (!cond) process.exitCode = 1; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // Test 1: normal session
  newSession('s1');
  const ev1 = [];
  const s1 = RT.createSession('s1', { mode: 'live', onState: (st) => ev1.push(st), onResult: () => {}, onError: () => {} });
  const p1 = s1.start();
  await sleep(5);
  serverOpen(FakeWS.last);
  const started = await p1;
  ok('T1 start ACTIVE', started && s1.state === 'ACTIVE', s1.state);
  serverTokens(FakeWS.last, [{ text: 'سلام', is_final: true }, { text: 'دنیا', is_final: false }]);
  await sleep(5);
  ok('T1 final appended + interim separate', s1.confirmed.includes('سلام') && s1.interim === 'دنیا');
  const out1 = await s1.finish();
  ok('T1 finish reliable realtime', out1.reliable && out1.mode === 'realtime' && out1.text.includes('سلام'));
  ok('T1 persisted with version bump', sessions.s1.transcript.includes('سلام') && sessions.s1.transcript_version >= 1, 'v=' + sessions.s1.transcript_version);
  ok('T1 temp key used, master never sent', mintCount >= 1 && FakeWS.last.sent[0].includes('TEMP-') && !FakeWS.last.sent[0].includes(MASTER));
  // تفکیکِ گوینده (2026-09-26): constraintهایِ میکروفون ثابت + contextِ سرور در کانفیگِ Soniox
  const a39 = (globalThis.lastGumConstraints || {}).audio || {};
  ok('T39 mic constraints unchanged (EC/NS/AGC on — field-proven baseline)', a39.noiseSuppression === true && a39.autoGainControl === true && a39.echoCancellation === true, JSON.stringify(a39));
  const cfg39 = JSON.parse(FakeWS.last.sent[0]);
  // T41 — هشدارِ کیفیتِ ضبط: گفتارِ عادی ok؛ ضعیف/بی‌صدا/نویز فقط بعد از ۲ پنجره‌ی پیاپی؛ خش در یک پنجره؛ برگشت به ok
  {
    const QM = RT.createAudioQualityMonitor;
    const frame = (amp, noise) => { const f = new Float32Array(512); for (let i = 0; i < 512; i++) f[i] = amp * Math.sin(i / 7) + (noise ? (Math.random() * 2 - 1) * noise : 0); return f; };
    // هر پنجره ۳۰ث؛ ۶۰fps. «گفتار»: ۴۰٪ فریم‌ها بلند، بقیه سکوتِ کم‌نویز
    const run = (m, secs, gen, t0 = 0) => { const out = []; for (let t = t0; t <= t0 + secs * 1000 + 50; t += 1000 / 60) { const r = m.push(gen(t), t); if (r) out.push(r.issue || 'ok'); } return out; };
    const speech = (amp) => (t) => (Math.floor(t / 1000) % 5 < 2 ? frame(amp, 0.001) : frame(0, 0.0005));
    const m1 = QM(); const a = run(m1, 90, speech(0.2));
    ok('T41 normal speech → ok', a.length === 3 && a.every((x) => x === 'ok'), a.join(','));
    const m2 = QM(); const b = run(m2, 90, speech(0.002));
    ok('T41 quiet → too_quiet only after 2 windows', b.join(',') === 'ok,too_quiet,too_quiet', b.join(','));
    const m3 = QM(); const c = run(m3, 90, () => new Float32Array(512));
    ok('T41 muted → no_signal after 2 windows', c.join(',') === 'ok,no_signal,no_signal', c.join(','));
    const m4 = QM(); const d = run(m4, 30, speech(1.5));
    ok('T41 clipping → immediate', d.join(',') === 'clipping', d.join(','));
    const m5 = QM(); const e = run(m5, 90, (t) => frame(Math.floor(t / 1000) % 5 < 2 ? 0.05 : 0, 0.08));
    ok('T41 loud noise floor → noisy', e.join(',') === 'ok,noisy,noisy', e.join(','));
    const f = run(m2, 30, speech(0.2), 90100);
    ok('T41 recovers to ok after quiet', f.join(',') === 'ok', f.join(','));
  }
  // شماره‌گذاریِ گوینده از ۱ و بدونِ سقف (۳ گوینده‌ی متمایزِ Soniox ⇒ ۳ برچسبِ متمایز)
  newSession('s40');
  const s40 = RT.createSession('s40', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p40 = s40.start(); await sleep(5); serverOpen(FakeWS.last); await p40;
  serverTokens(FakeWS.last, [{ text: 'الف', is_final: true, speaker: '1' }, { text: 'ب', is_final: true, speaker: '2' }, { text: 'پ', is_final: true, speaker: '3' }, { text: 'ت', is_final: true, speaker: '1' }]);
  await sleep(5);
  ok('T40 speaker labels 1-based, 3 distinct', /گوینده ۱: الف/.test(s40.confirmed) && /گوینده ۲: ب/.test(s40.confirmed) && /گوینده ۳: پ/.test(s40.confirmed) && !/گوینده ۰/.test(s40.confirmed), JSON.stringify(s40.confirmed));
  await s40.finish();
  ok('T39 server context forwarded to Soniox config', cfg39.enable_speaker_diarization === true && JSON.stringify(cfg39.context || {}).includes('FAKE-CTX'));

  // Test 3+2: disconnect during interim -> reconnect preserves confirmed, discards interim, unreliable
  newSession('s2');
  const s2 = RT.createSession('s2', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p2 = s2.start(); await sleep(5); serverOpen(FakeWS.last); await p2;
  serverTokens(FakeWS.last, [{ text: 'متن تاییدشده', is_final: true }, { text: 'نیمه‌تمام', is_final: false }]);
  await sleep(5);
  const mintsBefore = mintCount;
  serverClose(FakeWS.last); // قطع غافلگیرانه
  ok('T2 reconnecting + interim discarded + confirmed kept', s2.state === 'RECONNECTING' && s2.interim === '' && s2.confirmed.includes('متن تاییدشده'), s2.state);
  await sleep(1200); // backoff 1s
  ok('T2 reconnect minted fresh key', mintCount === mintsBefore + 1, 'mints=' + mintCount);
  serverOpen(FakeWS.last);
  await sleep(5);
  ok('T2 recovered ACTIVE + unreliable one-way', s2.state === 'ACTIVE' && s2.unreliable === true, s2.state);
  serverTokens(FakeWS.last, [{ text: ' ادامه', is_final: true }]);
  const out2 = await s2.finish({ awaitBatch: true }); // حالت صریحِ منتظر drain (پیش‌فرض جدید non-blocking است)
  ok('T2 unreliable -> batch fallback', out2.mode === 'batch' && out2.reliable === false && out2.text.includes('BATCH FULL TEXT'), out2.mode);
  ok('T2 no duplicate of confirmed', (sessions.s2.transcript.match(/متن تاییدشده/g) || []).length === 1);

  // Test 18 (بخشِ ۱۸ audit): بعدِ یک قطعیِ کوتاه که reconnect می‌شود، جلسه باید در ACTIVEِ
  // سالم ادامه پیدا کند — سگمنت‌هایِ durableِ *بعدِ* بازگشت نباید دوباره purpose=transcript
  // بگیرند (باگِ قدیمی: self.unreliableِ یک‌طرفه باعث می‌شد همه‌ی سگمنت‌هایِ بعدی هم برای
  // همیشه دوباره رونویسی/append شوند — دوپلیکیتِ متنِ از قبل درستِ realtime).
  newSession('s18');
  const s18 = RT.createSession('s18', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p18 = s18.start(); await sleep(5); serverOpen(FakeWS.last); await p18;
  serverTokens(FakeWS.last, [{ text: 'قبل از قطعی', is_final: true }]);
  await sleep(5);
  serverClose(FakeWS.last); // قطعِ غافلگیرانه — مرزِ سگمنت باید همین‌جا خودکار بسته شود (فیکسِ scheduleReconnect)
  await sleep(1200);
  serverOpen(FakeWS.last); // reconnect موفق — مرزِ سگمنتِ برگشت هم باید خودکار بسته شود (فیکسِ connectWithFreshMint)
  await sleep(5);
  ok('T18 recovered to ACTIVE after reconnect', s18.state === 'ACTIVE' && s18.unreliable === true, s18.state);
  serverTokens(FakeWS.last, [{ text: 'بعد از بازگشت — سالم', is_final: true }]);
  await sleep(5);
  // شبیه‌سازیِ چرخشِ عادیِ ۱۵ثانیه‌ایِ durable در وسطِ یک دورانِ کاملاً ACTIVE (بدونِ صدا زدنِ
  // تایمرِ واقعی) — این سگمنت باید intent=archive بگیرد چون در لحظه‌ی بسته‌شدن ACTIVE هستیم.
  await s18.stopDurableSegment(); s18.startDurable();
  serverTokens(FakeWS.last, [{ text: ' — ادامه‌ی سالم', is_final: true }]);
  await sleep(5);
  const out18 = await s18.finish({ awaitBatch: true });
  const s18Uploads = fetchUrls.filter((u) => u.includes('/sessions/s18/batch-audio'));
  const s18Transcript = s18Uploads.filter((u) => u.includes('purpose=transcript'));
  const s18Archive = s18Uploads.filter((u) => u.includes('purpose=archive'));
  ok('T18 exactly one segment uploaded as purpose=transcript (the outage segment)', s18Transcript.length === 1, s18Uploads.join(','));
  ok('T18 post-recovery segments uploaded as purpose=archive, not re-transcribed', s18Archive.length >= 1, s18Uploads.join(','));
  ok('T18 finish still honestly reports unreliable/batch', out18.reliable === false && out18.mode === 'batch');
  ok('T18 confirmed realtime text kept both parts, no drop', s18.confirmed.includes('قبل از قطعی') && s18.confirmed.includes('بعد از بازگشت'));

  // Test 21 (گزارشِ مالک ۲۰۲۶-۰۹-۲۳: «بعدِ وصل‌شدنِ دوباره‌ی نت دیگه رونویسی نشد» + «Audio decode error»):
  // liveRecِ اتصالِ قبلی تا reconnect روشن می‌ماند و stop()ش ناهمگام است — دُمِ بی‌هدرِ آن نباید
  // رویِ WSِ *تازه* برود. اولین بایت‌هایِ صوتیِ WSِ تازه باید هدرِ container باشند، وگرنه Soniox
  // (audio_format:auto) «Audio decode error» می‌دهد و رونویسی بعد از هر reconnect دوباره می‌میرد.
  newSession('s21');
  const s21 = RT.createSession('s21', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p21 = s21.start(); await sleep(5); serverOpen(FakeWS.last); await p21;
  await sleep(5);
  serverClose(FakeWS.last);
  await sleep(1200);
  const ws21 = FakeWS.last;
  serverOpen(ws21);
  await sleep(20);
  const bin21 = ws21.sent.filter((d) => typeof d !== 'string');
  const bin21Txt = await Promise.all(bin21.map((b) => b.text()));
  ok('T21 first audio on the fresh WS after reconnect is a container header (no stale tail from old liveRec)',
    bin21Txt.length >= 1 && bin21Txt[0].startsWith('HDR') && !bin21Txt.includes('TAIL'), bin21Txt.map((t) => t.slice(0, 4)).join(','));
  s21.abort();

  // Test 22 (گزارشِ مالک ۲۰۲۶-۰۹-۲۳: «نوشت متنش بعداً اضافه می‌شه، ولی متنی ذخیره نشد»): متنِ batchِ
  // دوره‌ی قطعی که حینِ جلسه سمتِ سرور append شده، نباید با ذخیره‌ی بعدیِ مرورگر (409 → rebase)
  // بازنویسی شود — حتی وقتی متنِ زنده‌ی مرورگر از آخرین ذخیره بیشتر از متنِ batch رشد کرده.
  newSession('s22');
  const s22 = RT.createSession('s22', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p22 = s22.start(); await sleep(5); serverOpen(FakeWS.last); await p22;
  serverTokens(FakeWS.last, [{ text: 'پیش از قطعی', is_final: true }]);
  await s22.persistConfirmed();
  sessions.s22.transcript += '\n\nOUTAGE BATCH'; sessions.s22.transcript_version++; // mergeBatchTranscript سمتِ سرور
  serverTokens(FakeWS.last, [{ text: ' ' + 'بعد از بازگشت '.repeat(10), is_final: true }]);
  await s22.persistConfirmed();
  ok('T22 409 rebase keeps server-appended batch text AND new realtime text (no overwrite)',
    sessions.s22.transcript.includes('OUTAGE BATCH') && sessions.s22.transcript.includes('پیش از قطعی') && sessions.s22.transcript.includes('بعد از بازگشت') &&
    sessions.s22.transcript.indexOf('OUTAGE BATCH') < sessions.s22.transcript.indexOf('بعد از بازگشت'), JSON.stringify(sessions.s22.transcript.slice(0, 60)));
  serverTokens(FakeWS.last, [{ text: ' ادامه', is_final: true }]);
  await s22.persistConfirmed();
  ok('T22b later saves keep the batch text', sessions.s22.transcript.includes('OUTAGE BATCH') && sessions.s22.transcript.endsWith('ادامه'));
  s22.abort();

  // Test 20 (race چرخشِ durable، ۲۰۲۶-۰۹-۲۳): stop و *بلافاصله* start (بدونِ await — دقیقاً
  // مثلِ تایمرِ چرخش و مرزهای قطعی). با FakeRecorderِ ناهمگام، قبلاً (الف) onstopِ recorderِ
  // قبلی فقط دُمِ بی‌هدر را ذخیره می‌کرد و (ب/ج) intentِ سگمنت‌های مرزی برعکس بود.
  newSession('s20');
  const durableStartsBefore20 = FakeRecorder.durableStarts;
  const s20 = RT.createSession('s20', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p20 = s20.start(); await sleep(5); serverOpen(FakeWS.last); await p20;
  await sleep(5);
  s20.stopDurableSegment(); s20.startDurable(); // seq0: چرخشِ عادی در ACTIVE
  await sleep(5);
  serverClose(FakeWS.last); // seq1: سگمنتِ سالمِ پیش از قطعی (مرز در scheduleReconnect)
  await sleep(1200);
  serverOpen(FakeWS.last); // seq2: سگمنتِ خودِ قطعی (مرز در connectWithFreshMint)
  await sleep(5);
  await s20.finish({ awaitBatch: true }); // seq3: سگمنتِ پایانی
  const durableStarts20 = FakeRecorder.durableStarts - durableStartsBefore20;
  await sleep(20);
  const up20 = sentBlobs.filter((b) => b.sessionId === 's20').sort((a, b) => a.seq - b.seq);
  const txt20 = await Promise.all(up20.map((b) => (b.blob ? b.blob.text() : Promise.resolve(''))));
  const desc20 = up20.map((b, i) => b.seq + ':' + b.purpose + ':' + txt20[i].slice(0, 3) + ':' + txt20[i].length).join(',');
  // ⚠️ تعدادِ دقیقِ سگمنت‌ها ثابت نیست: FakeWS.close() onclose را همگام صدا می‌زند و
  // scheduleReconnect چند بار (هنوز در ACTIVE) بازگشتی اجرا می‌شود — artifactِ harness، نه
  // مرورگر. پس به‌جای شمارش، شکل را چک می‌کنیم: همه archive جز *یک* transcript که سگمنتِ
  // خودِ قطعی است (یکی مانده به آخر)، و سگمنتِ پایانی archive.
  const n20 = up20.length;
  ok('T20a every durable segment starts with container header and keeps body+tail (no headless tail)',
    n20 >= 4 && txt20.every((t) => t.startsWith('HDR') && t.endsWith('TAIL') && t.length > 500), desc20);
  // هر durable recorder دقیقاً یک سگمنتِ ذخیره‌شده — هیچ بدنه‌ای گم نشده (قبلاً بدنه‌ی سگمنت‌هایِ
  // چرخشی در RAM رها می‌شد و فقط دُمش، یا هیچ‌چیز، به صف می‌رسید).
  ok('T20a2 one stored segment per durable recorder (no body lost)', n20 === durableStarts20, 'segments=' + n20 + ' durableRecorders=' + durableStarts20);
  ok('T20b segments closed while ACTIVE (rotation + entering outage) → archive',
    n20 >= 4 && up20.slice(0, n20 - 2).every((b) => b.purpose === 'archive'), desc20);
  ok('T20c outage segment closed on recovery (RECONNECTING at stop) → transcript, exactly one',
    up20[n20 - 2] && up20[n20 - 2].purpose === 'transcript' && up20.filter((b) => b.purpose === 'transcript').length === 1, desc20);
  ok('T20d final segment → archive, seqs contiguous from 0', up20[n20 - 1] && up20[n20 - 1].purpose === 'archive' && up20.every((b, i) => b.seq === i), desc20);

  // Test 19: قطعیِ «بی‌صدا» — WSای که readyState اش دیگه OPEN نیست ولی onclose/onerror
  // هیچ‌وقت فایر نمی‌شه (شبیه‌سازیِ یک شبکه‌ی محو‌شده بدونِ FIN/RST؛ برخلافِ serverClose
  // که همیشه onclose را صدا می‌زند). watchdogِ readyState (فیکسِ این نوبت) باید این را
  // خودش تشخیص بدهد و reconnect را شروع کند، حتی بدونِ هیچ رویدادی از خودِ WS.
  newSession('s19');
  const s19 = RT.createSession('s19', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p19 = s19.start(); await sleep(5); serverOpen(FakeWS.last); await p19;
  ok('T19 starts ACTIVE', s19.state === 'ACTIVE', s19.state);
  const mintsBefore19 = mintCount;
  // ⚠️ readyState را مستقیم روی مقدارِ CLOSED می‌گذاریم، بدونِ صدا زدنِ onclose —
  // دقیقاً همون چیزی که serverClose/handleWSClose اصلاً نمی‌بینه.
  FakeWS.last.readyState = FakeWS.CLOSED;
  // WS_WATCHDOG_MS (۳۰۰۰ms، بدترین حالت تا لبه‌ی تیک بعدی) + اولین backoffِ reconnect
  // (۱۰۰۰ms) پیش از اینکه mintِ واقعی زده بشه.
  await sleep(4300);
  ok('T19 watchdog detected silently-dead WS without onclose', s19.state === 'RECONNECTING' && mintCount > mintsBefore19, 'state=' + s19.state + ' mints=' + mintCount + '/' + mintsBefore19);
  serverOpen(FakeWS.last);
  await sleep(5);
  ok('T19 recovers ACTIVE after watchdog-triggered reconnect', s19.state === 'ACTIVE');
  await s19.abort();

  // Test 19b (کنترلِ منفی): سکوتِ طبیعیِ گفتگو (بدونِ پیام از Soniox، ws هنوز OPEN) برایِ
  // بیشتر از WS_WATCHDOG_MS نباید هیچ reconnectِ کاذبی بسازد.
  newSession('s19b');
  const s19b = RT.createSession('s19b', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p19b = s19b.start(); await sleep(5); serverOpen(FakeWS.last); await p19b;
  const mintsBefore19b = mintCount;
  await sleep(3300); // ws.readyState همچنان OPEN، هیچ پیامی نمی‌رسه
  ok('T19b no false-positive reconnect during natural silence', s19b.state === 'ACTIVE' && mintCount === mintsBefore19b, 'state=' + s19b.state + ' mints=' + mintCount + '/' + mintsBefore19b);
  await s19b.abort();

  // Test 7: abort from STARTING (mint pending) — no hang
  newSession('s3');
  const s3 = RT.createSession('s3', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p3 = s3.start();
  s3.abort();
  const r3 = await Promise.race([p3, sleep(3000).then(() => 'HANG')]);
  ok('T7 abort during STARTING, no hang', r3 !== 'HANG' && s3.state === 'CANCELED', String(r3) + '/' + s3.state);

  // Test 7b: abort during RECONNECTING
  newSession('s4');
  const s4 = RT.createSession('s4', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p4 = s4.start(); await sleep(5); serverOpen(FakeWS.last); await p4;
  serverClose(FakeWS.last); await sleep(5);
  s4.abort();
  ok('T7b abort during RECONNECTING safe', s4.state === 'CANCELED' && s4.ws === null);

  // Test 10: stale concurrent write -> 409 -> rebase keeps longer
  newSession('s5');
  const s5 = RT.createSession('s5', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p5 = s5.start(); await sleep(5); serverOpen(FakeWS.last); await p5;
  serverTokens(FakeWS.last, [{ text: 'AAA', is_final: true }]); await sleep(5);
  sessions.s5.transcript = 'AAA plus much longer server text from elsewhere';
  sessions.s5.transcript_version++;
  const saved = await s5.persistConfirmed();
  ok('T10 stale write rebased, longer kept', saved.includes('much longer') && sessions.s5.transcript.includes('much longer'));
  await s5.abort();

  // Test 8: finalize timeout (no finished event) -> still resolves
  newSession('s6');
  const s6 = RT.createSession('s6', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p6 = s6.start(); await sleep(5); serverOpen(FakeWS.last); await p6;
  serverTokens(FakeWS.last, [{ text: 'پایان', is_final: true }]); await sleep(5);
  s6.FINALIZE_TIMEOUT_TEST = true;
  const t0 = Date.now();
  const pf6 = s6.finish();
  await sleep(50);
  serverTokens(FakeWS.last, [], true); // finished بعد از finalize می‌رسد (مسیر event-based سریع)
  const out6 = await pf6;
  ok('T8 finish resolves on finished event (fast, no 8s wait)', out6.reliable && out6.text.includes('پایان') && (Date.now() - t0) < 4000, Date.now() - t0 + 'ms');

  // Test 6: pause / resume — بدون duplicate یا missing
  newSession('s7');
  const s7 = RT.createSession('s7', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p7 = s7.start(); await sleep(5); serverOpen(FakeWS.last); await p7;
  serverTokens(FakeWS.last, [{ text: 'AAA', is_final: true }]); await sleep(5);
  await s7.pause();
  ok('T6 paused, mic released', s7.state === 'MANUAL_PAUSED' && s7.stream === null, s7.state);
  const prResume = s7.resume(); await sleep(20);
  serverOpen(FakeWS.last);
  const okResume = await prResume; await sleep(5);
  ok('T6 resumed ACTIVE, prefix kept', okResume && s7.state === 'ACTIVE' && s7.confirmed.includes('AAA'), s7.state);
  serverTokens(FakeWS.last, [{ text: 'BBB', is_final: true }]); await sleep(5);
  const out7 = await s7.finish();
  const cA = (out7.text.match(/AAA/g) || []).length, cB = (out7.text.match(/BBB/g) || []).length;
  ok('T6 no duplicate/missing across pause', out7.reliable && cA === 1 && cB === 1, out7.text.slice(0, 60));

  // Test 9: شروع مجدد بعد از reload — ادامه از transcript موجود DB
  sessions.s8 = { transcript: 'OLD TEXT ', transcript_version: 3, notes: [] };
  const s8 = RT.createSession('s8', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p8 = s8.start(); await sleep(5); serverOpen(FakeWS.last); await p8;
  ok('T9 resumes from persisted prefix', s8.confirmed.startsWith('OLD TEXT'), JSON.stringify(s8.confirmed));
  await s8.abort();

  // T13a: mint معلق + finish وسط راه → بعد از resolve شدن mint، هیچ WS باز نشود و COMPLETED بماند
  newSession('s13a');
  const realFetch = globalThis.fetch;
  let releaseMint13a = null;
  globalThis.fetch = async (url, opts = {}) => {
    if (url === '/api/stt/realtime-session') {
      await new Promise((res) => { releaseMint13a = res; });
      return realFetch(url, opts);
    }
    return realFetch(url, opts);
  };
  const wsCountBefore13a = wsCreatedCount;
  const s13a = RT.createSession('s13a', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p13a = s13a.start(); // منتظر mint می‌ماند
  await sleep(20);
  const out13a = await s13a.finish(); // حین pending mint
  releaseMint13a(); // mint دیررسیده — باید نادیده گرفته شود
  const r13a = await p13a;
  await sleep(30);
  ok('T13a late mint ignored, stays COMPLETED, no WS', out13a && s13a.state === 'COMPLETED' && wsCreatedCount === wsCountBefore13a && s13a.timers.length === 0, s13a.state + '/ws+' + (wsCreatedCount - wsCountBefore13a));
  globalThis.fetch = realFetch;

  // T13b: WS ساخته‌شده ولی هنوز open نشده + finish → بعد از open، بسته شود و COMPLETED بماند
  newSession('s13b');
  const s13b = RT.createSession('s13b', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p13b = s13b.start(); await sleep(20); // WS ساخته شد، open نشده
  const ws13b = FakeWS.last;
  const out13bP = s13b.finish();
  await p13b; // start با WS بسته‌شده false می‌دهد ولی finish قبلاً COMPLETED را ست کرده
  serverOpen(ws13b); // open دیررسیده
  await sleep(20);
  const out13b = await out13bP;
  ok('T13b late WS-open closed, stays COMPLETED', s13b.state === 'COMPLETED' && ws13b.readyState === 3, s13b.state + '/rs=' + ws13b.readyState);

  // T14: batch تخلیه نمی‌شود → finish سریع برمی‌گردد (نه ۱۵ دقیقه)؛ بعداً drain و merge امن
  newSession('s14');
  neverDrain = true; batchPolls = 0;
  const s14 = RT.createSession('s14', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p14 = s14.start(); await sleep(5); serverOpen(FakeWS.last); await p14;
  serverTokens(FakeWS.last, [{ text: 'متن ناقص', is_final: true }]); await sleep(5);
  serverClose(FakeWS.last); await sleep(5); // unreliable
  const t14 = Date.now();
  const out14 = await s14.finish(); // پیش‌فرض non-blocking
  const dt14 = Date.now() - t14;
  ok('T14 finish fast despite pending batch', out14.mode === 'batch-pending' && dt14 < 3000, out14.mode + '/' + dt14 + 'ms');
  neverDrain = false;
  const drain14 = await s14.awaitBatchDrain({ timeoutMs: 15000 });
  ok('T14 later drain merges safely, no dup', drain14.drained && drain14.ok && (sessions.s14.transcript.match(/متن ناقص/g) || []).length === 1, JSON.stringify(sessions.s14.transcript).slice(0, 80));

  // T15: voice-note fallback → یادداشت می‌شود، نه transcript؛ + retry
  newSession('s15');
  batchPolls = 0; notePolls = 0;
  const s15 = RT.createSession('s15', { mode: 'note', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p15 = s15.start(); await sleep(5); serverOpen(FakeWS.last); await p15;
  s15.reconnectAttempts = RT.MAX_RECONNECT_ATTEMPTS; // شکست فوری بعدی
  serverClose(FakeWS.last); await sleep(5);
  ok('T15 note FAILED after exhaust', s15.state === 'FAILED', s15.state);
  const t15 = Date.now();
  const out15 = await s15.finish();
  ok('T15 note finish fast, pending-note', out15.mode === 'batch-pending-note' && (Date.now() - t15) < 3000, out15.mode);
  ok('T15 note uploaded with purpose=note', fetchUrls.some((u) => u.includes('batch-audio?purpose=note')), fetchUrls.filter((u) => u.includes('batch-audio')).join(','));
  ok('T15 transcript untouched by note queue', sessions.s15.transcript === '', JSON.stringify(sessions.s15.transcript));
  const retry15 = await realFetch('/api/sessions/s15/batch-retry?purpose=note', { method: 'POST' });
  const retry15j = await retry15.json();
  ok('T15 retry endpoint works', retry15.ok && retry15j.status === 'retrying', JSON.stringify(retry15j));
  const drain15 = await s15.awaitBatchDrain({ forNote: true, timeoutMs: 15000 });
  ok('T15 note drain becomes session note, transcript still clean',
    drain15.drained && drain15.ok && drain15.result.text === 'NOTE BATCH TEXT' &&
    sessions.s15.notes.length === 1 && sessions.s15.transcript === '',
    JSON.stringify(sessions.s15.notes));

  // T16: mint همیشه fail → durable-only، بدون هیچ WS (نه realtime، نه legacy در harness)
  newSession('s16');
  mintFailMode = true;
  const wsCountBefore16 = wsCreatedCount;
  const s16 = RT.createSession('s16', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const started16 = await s16.start();
  ok('T16 mint-fail start usable, no WS, FAILED-durable',
    started16 === true && s16.state === 'FAILED' && s16.realtimeUp === false && wsCreatedCount === wsCountBefore16 && !!s16.durableRec,
    'started=' + started16 + ' state=' + s16.state);
  mintFailMode = false;
  const out16 = await s16.finish();
  // T16x/T16y (2026-09-23): آخرین سگمنتِ جلسه‌ای که در FAILED/RECONNECTING تمام می‌شود باید رونویسی شود —
  // finish() پیش از stopDurableSegment به FINALIZING می‌رود، پس بدونِ override این سگمنت archive می‌گرفت.
  { const u = sentBlobs.filter((b) => b.sessionId === 's16'); ok('T16x durable-only final segment uploaded as transcript (not archive)', u.length >= 1 && u.every((b) => b.purpose === 'transcript'), u.map((b) => b.seq + ':' + b.purpose).join(',')); }
  ok('T16 durable-only finish → batch-pending, queued', out16.mode === 'batch-pending' && batchQueue.some((q) => q.sessionId === 's16'), out16.mode);
  batchPolls = 0;
  const drain16 = await s16.awaitBatchDrain({ timeoutMs: 15000 });
  ok('T16 later batch merges', drain16.drained && drain16.ok && sessions.s16.transcript.includes('BATCH FULL TEXT'));

  newSession('s16r');
  const s16r = RT.createSession('s16r', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p16r = s16r.start(); await sleep(5); serverOpen(FakeWS.last); await p16r; await sleep(5);
  serverClose(FakeWS.last); await sleep(5);
  const st16r = s16r.state;
  await s16r.finish(); await sleep(20);
  { const u = sentBlobs.filter((b) => b.sessionId === 's16r').sort((a, b) => a.seq - b.seq); ok('T16y finish during ' + st16r + ': last (outage) segment → transcript', st16r === 'RECONNECTING' && u.length >= 1 && u[u.length - 1].purpose === 'transcript', u.map((b) => b.seq + ':' + b.purpose).join(',')); }
  // کنترلِ منفی: finish از ACTIVEِ سالم همچنان archive (بدونِ رونویسیِ تکراری)
  newSession('s16a');
  const s16a = RT.createSession('s16a', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p16a = s16a.start(); await sleep(5); serverOpen(FakeWS.last); await p16a; await sleep(5);
  await s16a.finish(); await sleep(20);
  { const u = sentBlobs.filter((b) => b.sessionId === 's16a'); ok('T16z finish from ACTIVE: final segment stays archive', u.length >= 1 && u.every((b) => b.purpose === 'archive'), u.map((b) => b.seq + ':' + b.purpose).join(',')); }

  // T17: قرارداد pause — فقط ACTIVE/RECOVERED قبول می‌کند
  newSession('s17');
  const s17 = RT.createSession('s17', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p17 = s17.start(); await sleep(5); serverOpen(FakeWS.last); await p17;
  ok('T17 pause from ACTIVE succeeds', (await s17.pause()) === true && s17.state === 'MANUAL_PAUSED', s17.state);
  await s17.abort();
  newSession('s17b');
  const s17b = RT.createSession('s17b', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p17b = s17b.start(); await sleep(5); serverOpen(FakeWS.last); await p17b;
  serverClose(FakeWS.last); await sleep(5);
  ok('T17 pause from RECONNECTING rejected', (await s17b.pause()) === false && s17b.state === 'RECONNECTING', s17b.state);
  await s17b.abort();
  newSession('s17c');
  let releaseMint17 = null;
  globalThis.fetch = async (url, opts = {}) => {
    if (url === '/api/stt/realtime-session') { await new Promise((res) => { releaseMint17 = res; }); }
    return realFetch(url, opts);
  };
  const s17c = RT.createSession('s17c', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p17c = s17c.start(); await sleep(20);
  ok('T17 pause from STARTING rejected', (await s17c.pause()) === false && s17c.state === 'STARTING', s17c.state);
  releaseMint17(); globalThis.fetch = realFetch; await sleep(20);
  try { serverOpen(FakeWS.last); } catch (e) {}
  await p17c; await s17c.abort();
  newSession('s17d');
  const s17d = RT.createSession('s17d', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
  const p17d = s17d.start(); await sleep(5); serverOpen(FakeWS.last); await p17d;
  const pf17d = s17d.finish(); await sleep(10);
  ok('T17 pause from FINALIZING rejected', (await s17d.pause()) === false && s17d.state === 'FINALIZING', s17d.state);
  await pf17d;

  // ——— جلسه‌ی ۱ساعته (2026-09-26) ———
  // T30: شمارنده‌ی bytesِ صف — addهایِ پیاپی دیگر هر بار getAll() نمی‌زنند، و جمع با محتوایِ واقعیِ صف یکی است.
  {
    await sleep(300); // آپلود/حذفِ پس‌زمینه‌ی تست‌هایِ قبلی تمام شود
    const idbStore = indexedDB.open().result.transaction().objectStore();
    const origGetAll = idbStore.getAll;
    const truth = () => new Promise((res) => { const r = origGetAll(); r.onsuccess = () => res(r.result.reduce((a, x) => a + (x.bytes || 0), 0)); });
    const q = RT.audioQueue;
    await q.totalBytes(); // مقداردهیِ اولیه (حداکثر یک getAll)
    let getAllCalls = 0;
    idbStore.getAll = function () { getAllCalls++; return origGetAll.apply(this, arguments); };
    for (let i = 0; i < 5; i++) await q.add('s30', 'r30', i, new Blob(['y'.repeat(1000)]), 'audio/webm', 'archive');
    const mid = await q.totalBytes(); const midTruth = await truth();
    const rows = await q.listForSession('s30');
    for (const r of rows) await q.remove(r.id, r.bytes);
    const after = await q.totalBytes(); const afterTruth = await truth();
    idbStore.getAll = origGetAll;
    ok('T30 queue byte counter: no getAll per add, totals match queue',
      getAllCalls === 0 && mid === midTruth && after === afterTruth && rows.length === 5 && mid - after === 5000,
      'getAll=' + getAllCalls + ' mid=' + mid + '/' + midTruth + ' after=' + after + '/' + afterTruth);
  }

  // T31: PUTی که سمتِ مرورگر timeout خورده ولی سرور اعمالش کرده → 409 بعدی نباید متن را تکرار کند.
  {
    newSession('s23');
    const s23 = RT.createSession('s23', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
    const p23 = s23.start(); await sleep(5); serverOpen(FakeWS.last); await p23;
    serverTokens(FakeWS.last, [{ text: 'جمله‌یک', is_final: true }]);
    await s23.persistConfirmed();
    serverTokens(FakeWS.last, [{ text: ' جمله‌دو', is_final: true }]);
    // سرور این نسخه را گرفته، ولی مرورگر پاسخ را ندیده (baseVersion/persistedText قدیمی مانده‌اند)
    sessions.s23.transcript = RT.cleanText(s23.confirmed); sessions.s23.transcript_version++;
    serverTokens(FakeWS.last, [{ text: ' جمله‌سه', is_final: true }]);
    await s23.persistConfirmed();
    const t = sessions.s23.transcript;
    ok('T31 409 after applied-but-timed-out PUT: no duplicated text',
      (t.match(/جمله‌دو/g) || []).length === 1 && (t.match(/جمله‌یک/g) || []).length === 1 && t.includes('جمله‌سه'), JSON.stringify(t));
    await s23.finish();
  }

  // T32: از FAILED (reconnectِ تمام‌شده) retryِ دوره‌ای زمان‌بندی می‌شود، پیامِ خطا یک بار؛ 401 نه.
  {
    newSession('s24');
    let errs24 = 0;
    const s24 = RT.createSession('s24', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => { errs24++; } });
    const p24 = s24.start(); await sleep(5); serverOpen(FakeWS.last); await p24;
    s24.reconnectAttempts = RT.MAX_RECONNECT_ATTEMPTS;
    serverClose(FakeWS.last); await sleep(5);
    ok('T32 FAILED schedules periodic realtime retry', s24.state === 'FAILED' && !!s24._failedRetryTimer && errs24 === 1, 'state=' + s24.state + ' errs=' + errs24);
    await s24.finish();
    ok('T32 finish clears retry timer', !s24._failedRetryTimer && s24.state === 'COMPLETED', s24.state);
  }

  // T33: autosave هیچ‌وقت دو PUTِ متن را هم‌زمان نمی‌فرستد (PUTِ کند رویِ اینترنتِ ضعیف).
  {
    newSession('s25');
    let putCount25 = 0; let release25 = null;
    const hold = new Promise((r) => { release25 = r; });
    const baseFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts = {}) => {
      if (url === '/api/sessions/s25' && opts.method === 'PUT' && opts.body && JSON.parse(opts.body).transcript !== undefined) {
        putCount25++; await hold;
      }
      return baseFetch(url, opts);
    };
    const s25 = RT.createSession('s25', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
    const p25 = s25.start(); await sleep(5); serverOpen(FakeWS.last); await p25;
    serverTokens(FakeWS.last, [{ text: 'یک', is_final: true }]);
    await sleep(5300);
    serverTokens(FakeWS.last, [{ text: ' دو', is_final: true }]);
    await sleep(5300);
    ok('T33 autosave: single in-flight PUT while previous hangs', putCount25 === 1, 'puts=' + putCount25);
    release25(); globalThis.fetch = baseFetch;
    await sleep(20);
    await s25.finish();
    ok('T33 final text persisted after slow PUT', sessions.s25.transcript.includes('دو'), JSON.stringify(sessions.s25.transcript));
  }

  // T34: Screen Wake Lock در طولِ جلسه گرفته و با پایان آزاد می‌شود؛ بدونِ پشتیبانی بی‌اثر است (بقیه‌ی تست‌ها).
  {
    let acq = 0; let rel = 0;
    navigator.wakeLock = { request: async () => { acq++; return { release: async () => { rel++; }, addEventListener() {} }; } };
    newSession('s26');
    const s26 = RT.createSession('s26', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
    const p26 = s26.start(); await sleep(5); serverOpen(FakeWS.last); await p26; await sleep(5);
    const acqDuring = acq;
    await s26.pause(); await sleep(5);
    const relDuringPause = rel;
    await s26.finish(); await sleep(5);
    RT.forget(s26);
    delete navigator.wakeLock;
    ok('T34 wake lock held through pause, released on finish', acqDuring === 1 && relDuringPause === 0 && rel === 1 && acq === 1, 'acq=' + acq + ' rel=' + rel);
  }

  // ——— audit تستِ واقعی (2026-09-26) ———
  // T35: WSِ جلسه‌ی قبلی که دیر (وسطِ جلسه‌ی بعدی) با 1006 بسته می‌شود، به نامِ جلسه‌ی *خودش* ثبت می‌شود
  // و جلسه‌ی جاری را دست نمی‌زند (قبلاً FeeliaObs session_id/run_id سراسری داشت).
  {
    const obsLog = [];
    window.FeeliaObs = { event: (name, detail, ctx) => obsLog.push({ name, detail, ctx }), setSession() {} };
    newSession('s35a'); newSession('s35b');
    const a = RT.createSession('s35a', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
    const pa = a.start(); await sleep(5); serverOpen(FakeWS.last); await pa;
    const wsA = FakeWS.last;
    wsA.close = function () { this.readyState = 2; }; // closing handshake بی‌پاسخ — onclose بعداً می‌رسد
    await a.finish(); RT.forget(a);
    const b = RT.createSession('s35b', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
    const pb = b.start(); await sleep(5); serverOpen(FakeWS.last); await pb;
    obsLog.length = 0;
    wsA.readyState = 3; wsA.onclose({ code: 1006, wasClean: false });
    const closeEv = obsLog.find((e) => e.name === 'rt.ws_close');
    ok('T35 late close of previous session WS attributed to that session, current untouched',
      closeEv && closeEv.ctx && closeEv.ctx.session_id === 's35a' && closeEv.ctx.run_id === a.runId && b.state === 'ACTIVE' &&
      !obsLog.some((e) => e.name === 'rt.reconnect_scheduled'),
      JSON.stringify(closeEv && closeEv.ctx) + ' b=' + b.state);
    await b.pause(); await sleep(5);
    const bPause = obsLog.find((e) => e.name === 'rt.state_change' && e.detail.state === 'MANUAL_PAUSED');
    ok('T35 current session events carry its own ids', !!(bPause && bPause.ctx && bPause.ctx.session_id === 's35b' && bPause.ctx.run_id === b.runId));
    await b.finish(); RT.forget(b);
    delete window.FeeliaObs;
  }

  // T36: یادداشتِ صوتیِ موفق (realtime) → صدایش فقط آرشیو (purpose=note-archive)، هرگز purpose=note
  // (رونویسیِ دوباره = یادداشتِ صوتیِ تکراری کنارِ همانی که UI از متنِ زنده ثبت کرده). صف هم خالی می‌شود.
  {
    newSession('s36');
    const n = RT.createSession('s36', { mode: 'note', onState: () => {}, onResult: () => {}, onError: () => {} });
    const pn = n.start(); await sleep(5); serverOpen(FakeWS.last); await pn;
    ok('T36/T37 isSessionActive while voice note records', RT.isSessionActive('s36') === true);
    serverTokens(FakeWS.last, [{ text: 'یادداشت', is_final: true }]);
    await n.stopDurableSegment(); n.startDurable(); // یک چرخشِ ۱۵ثانیه‌ای
    const fin = n.finish(); await sleep(5);
    serverTokens(FakeWS.last, [], true);
    const outN = await fin;
    await sleep(80);
    const up = fetchUrls.filter((u) => u.includes('/sessions/s36/batch-audio'));
    const left = await RT.audioQueue.listForSession('s36');
    ok('T36 reliable voice note audio archived as note-archive, never re-transcribed',
      outN.reliable && up.length >= 2 && up.every((u) => u.includes('purpose=note-archive')) && left.length === 0 &&
      !noteQueue.some((q) => q.sessionId === 's36'),
      up.join(',') + ' left=' + left.length);
    ok('T37 isSessionActive false after finish', RT.isSessionActive('s36') === false);
    RT.forget(n);
  }

  // T38: حینِ ACTIVE، صفِ durable هر ARCHIVE_DRAIN_MS آپلود می‌شود (نه فقط در finish)؛ finish تایمر را پاک می‌کند.
  {
    const realSetInterval = globalThis.setInterval;
    const captured = [];
    globalThis.setInterval = function (fn, ms) { const id = realSetInterval(fn, ms); if (ms === 60000) captured.push(fn); return id; };
    newSession('s38');
    const s38 = RT.createSession('s38', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
    const p38 = s38.start(); await sleep(5); serverOpen(FakeWS.last); await p38;
    globalThis.setInterval = realSetInterval;
    await s38.stopDurableSegment(); s38.startDurable();
    await s38.stopDurableSegment(); s38.startDurable();
    const before = fetchUrls.filter((u) => u.includes('/sessions/s38/batch-audio')).length;
    captured.forEach((fn) => fn());
    await sleep(80);
    const mid = fetchUrls.filter((u) => u.includes('/sessions/s38/batch-audio'));
    const leftMid = await RT.audioQueue.listForSession('s38');
    ok('T38 archive segments uploaded during ACTIVE session', before === 0 && mid.length === 2 && mid.every((u) => u.includes('purpose=archive')) && leftMid.length === 0,
      'before=' + before + ' mid=' + mid.length + ' left=' + leftMid.length);
    await s38.finish(); await sleep(50);
    ok('T38 finish clears archive drain timer', !s38.archiveDrainTimer && s38.state === 'COMPLETED');
    RT.forget(s38);
  }

  // T41 (audit ذخیره‌سازی 2026-09-26): بدونِ «پایان»، پنهان‌شدن/بستنِ صفحه متنِ ذخیره‌نشده را فوراً PUT می‌کند
  // (hidden → PUTِ عادی؛ pagehide → PUTِ keepalive) — بدونِ انتظار برایِ تیکِ autosave.
  {
    newSession('s39');
    const s39 = RT.createSession('s39', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
    const p39 = s39.start(); await sleep(5); serverOpen(FakeWS.last); await p39;
    serverTokens(FakeWS.last, [{ text: 'اول', is_final: true }]);
    s39.flushTranscriptNow(false); await sleep(30);
    const afterHidden = sessions.s39.transcript;
    serverTokens(FakeWS.last, [{ text: ' دوم', is_final: true }]);
    const realFetch39 = globalThis.fetch; let keepaliveSeen = false;
    globalThis.fetch = async (url, opts = {}) => { if (opts.keepalive && url === '/api/sessions/s39') keepaliveSeen = true; return realFetch39(url, opts); };
    s39.flushTranscriptNow(true); await sleep(30);
    globalThis.fetch = realFetch39;
    ok('T41 hidden flush persists confirmed text immediately', afterHidden.includes('اول'), JSON.stringify(afterHidden));
    ok('T41 pagehide flush sends keepalive PUT with latest text', keepaliveSeen && sessions.s39.transcript.includes('دوم'), JSON.stringify(sessions.s39.transcript));
    const putsBefore = fetchUrls.filter((u) => u === 'PUT /api/sessions/s39').length;
    await s39.finish(); await sleep(50);
    const putsAfterFinish = fetchUrls.filter((u) => u === 'PUT /api/sessions/s39').length;
    s39.flushTranscriptNow(true); await sleep(10);
    ok('T41 no flush after COMPLETED', fetchUrls.filter((u) => u === 'PUT /api/sessions/s39').length === putsAfterFinish && putsAfterFinish >= putsBefore);
    RT.forget(s39);
  }

  // ——— A1 رفعِ ذخیره‌سازی (2026-09-26) ———
  // T42 (A1.1): لغوِ یادداشتِ صوتی فقط سگمنت‌هایِ run خودش را پاک می‌کند، نه صدایِ آپلودنشده‌ی دیگرِ همان جلسه.
  {
    newSession('s42');
    await RT.audioQueue.add('s42', 'otherrun', 0, new Blob(['x'.repeat(600)]), 'audio/webm', 'transcript');
    const n = RT.createSession('s42', { mode: 'note', onState: () => {}, onResult: () => {}, onError: () => {} });
    const pn = n.start(); await sleep(5); serverOpen(FakeWS.last); await pn;
    await n.stopDurableSegment(); n.startDurable();
    const mid = await RT.audioQueue.listForSession('s42');
    n.abort(); await sleep(40);
    const left = await RT.audioQueue.listForSession('s42');
    ok('T42 voice-note abort clears only its own run', mid.some((r) => r.runId === n.runId) && left.length === 1 && left[0].runId === 'otherrun',
      'mid=' + mid.map((r) => r.runId).join(',') + ' left=' + left.map((r) => r.runId).join(','));
    RT.forget(n);
    await RT.audioQueue.clearForSession('s42');
  }

  // T43 (A1.2): آپلودِ سگمنتِ معلق timeout می‌خورد، رکورد در صف می‌ماند و قفلِ صف آزاد می‌شود.
  {
    RT._setTestTimeouts({ segmentUploadMs: 60 });
    const realFetch43 = globalThis.fetch;
    globalThis.fetch = (url, opts = {}) => {
      if (String(url).includes('/sessions/s43/batch-audio')) {
        return new Promise((res, rej) => { if (opts.signal) opts.signal.addEventListener('abort', () => rej(new Error('aborted'))); });
      }
      return realFetch43(url, opts);
    };
    newSession('s43');
    const t0 = Date.now();
    const done = await RT.withAudioLock('s43', () => RT.uploadQueuedSegment('s43', { runId: 'r', seq: 0, blob: new Blob(['y'.repeat(600)]), intent: 'archive' }));
    const took = Date.now() - t0;
    let lockFree = false;
    await Promise.race([RT.withAudioLock('s43', async () => { lockFree = true; }), sleep(500)]);
    globalThis.fetch = realFetch43;
    RT._setTestTimeouts({ segmentUploadMs: 60000 });
    ok('T43 hung segment upload times out → kept in queue, lock released', done === false && took < 1000 && lockFree, 'done=' + done + ' took=' + took + ' lockFree=' + lockFree);
  }

  // T44 (A1.6): نسخه از پاسخِ PUT خوانده می‌شود؛ rebaseِ واگرا متنِ هیچ طرف را حذف نمی‌کند.
  {
    newSession('s44');
    const s44 = RT.createSession('s44', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
    const p44 = s44.start(); await sleep(5); serverOpen(FakeWS.last); await p44;
    serverTokens(FakeWS.last, [{ text: 'محلی اول', is_final: true }]); await sleep(5);
    // سرور نسخه را جلوتر از +1 می‌برد (مثلاً نویسنده‌ی دیگری هم‌زمان) و در پاسخ برمی‌گرداند
    const realFetch44 = globalThis.fetch;
    let bumped = false;
    globalThis.fetch = async (url, opts = {}) => {
      const r = await realFetch44(url, opts);
      if (!bumped && url === '/api/sessions/s44' && opts.method === 'PUT' && r.ok) {
        bumped = true; sessions.s44.transcript_version += 4;
        const v = sessions.s44.transcript_version;
        return { ok: true, status: 200, json: async () => ({ session: { transcript: sessions.s44.transcript, transcript_version: v } }) };
      }
      return r;
    };
    await s44.persistConfirmed();
    globalThis.fetch = realFetch44;
    ok('T44 baseVersion taken from PUT response', s44.baseVersion === sessions.s44.transcript_version, s44.baseVersion + ' vs ' + sessions.s44.transcript_version);
    // نویسنده‌ی دیگر متنِ سرور را به متنی بلندتر و ناسازگار تغییر می‌دهد؛ ما دُمِ ذخیره‌نشده داریم
    sessions.s44.transcript = 'متنِ دیگری که از جای دیگری نوشته شده و از متنِ محلی بلندتر است و آن را ندارد';
    sessions.s44.transcript_version++;
    serverTokens(FakeWS.last, [{ text: ' دُمِ محلی', is_final: true }]); await sleep(5);
    await s44.persistConfirmed();
    const t44 = sessions.s44.transcript;
    ok('T44 divergent rebase keeps server text and appends local unsaved tail (labeled)',
      t44.includes('از جای دیگری') && t44.includes('دُمِ محلی') && t44.includes('ذخیره نشده بود'), JSON.stringify(t44));
    // سرورِ کوتاه‌ترِ ناسازگار دیگر کورکورانه overwrite نمی‌شود
    sessions.s44.transcript = 'کوتاهِ سرور'; sessions.s44.transcript_version++;
    serverTokens(FakeWS.last, [{ text: ' باز هم', is_final: true }]); await sleep(5);
    await s44.persistConfirmed();
    ok('T44 shorter divergent server text is not overwritten', sessions.s44.transcript.includes('کوتاهِ سرور') && sessions.s44.transcript.includes('باز هم'), JSON.stringify(sessions.s44.transcript));
    await s44.finish(); RT.forget(s44);
  }

  // T45 (A1.4): اگر ذخیره‌ی نهاییِ متن در finish بعد از چند تلاش شکست بخورد، سگمنت‌هایِ archiveِ بعد از آخرین
  // ذخیره‌ی موفق با purpose=transcript می‌روند و نتیجه صادقانه reliable:false/batch-pending است.
  {
    RT._setTestTimeouts({ finalPersistDelaysMs: [0, 5, 5] });
    newSession('s45');
    const s45 = RT.createSession('s45', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
    const p45 = s45.start(); await sleep(5); serverOpen(FakeWS.last); await p45;
    serverTokens(FakeWS.last, [{ text: 'ذخیره‌شده', is_final: true }]); await sleep(5);
    await s45.stopDurableSegment(); s45.startDurable(); // سگمنتِ قدیمی — قبل از ذخیره‌ی موفق
    (await RT.audioQueue.listForSession('s45')).forEach((r) => { r.createdAt -= 60000; });
    await s45.persistConfirmed();
    await s45.stopDurableSegment(); s45.startDurable(); // سگمنتِ بعد از ذخیره
    serverTokens(FakeWS.last, [{ text: ' دُمِ ذخیره‌نشده', is_final: true }]); await sleep(5);
    const realFetch45 = globalThis.fetch; let putTries = 0;
    globalThis.fetch = async (url, opts = {}) => {
      if (url === '/api/sessions/s45' && opts.method === 'PUT' && opts.body && JSON.parse(opts.body).transcript !== undefined) {
        putTries++; return { ok: false, status: 503, json: async () => ({ error: 'down' }) };
      }
      return realFetch45(url, opts);
    };
    const fin = s45.finish(); await sleep(5); serverTokens(FakeWS.last, [], true);
    const out45 = await fin; await sleep(80);
    globalThis.fetch = realFetch45;
    RT._setTestTimeouts({ finalPersistDelaysMs: [0, 1500, 4000] });
    const up45 = sentBlobs.filter((b) => b.sessionId === 's45');
    const tr = up45.filter((b) => b.purpose === 'transcript').length;
    const ar = up45.filter((b) => b.purpose === 'archive').length;
    ok('T45 failed final persist retried then unsaved segments re-transcribed; honest result',
      putTries === 3 && out45.reliable === false && out45.mode === 'batch-pending' && tr === 2 && ar === 1,
      'tries=' + putTries + ' out=' + JSON.stringify(out45) + ' transcript=' + tr + ' archive=' + ar);
    RT.forget(s45);
  }

  // ——— A2 (2026-09-26): متنِ بازیابی‌شده در جایِ زمانیِ درست ———
  // T46: سگمنتِ بسته‌شده در قطعی ⇒ placeholder با کلیدِ run:seq، قبل از نشانگرِ «اتصال دوباره برقرار شد»، و قبل از متنِ بعدی.
  {
    newSession('s46');
    const s46 = RT.createSession('s46', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
    const p46 = s46.start(); await sleep(5); serverOpen(FakeWS.last); await p46;
    serverTokens(FakeWS.last, [{ text: 'قبل', is_final: true }]); await sleep(5);
    serverClose(FakeWS.last); await sleep(1200);
    serverOpen(FakeWS.last); await sleep(30);
    serverTokens(FakeWS.last, [{ text: 'بعد', is_final: true }]); await sleep(5);
    const rows = (await RT.audioQueue.listForSession('s46')).filter((r) => r.intent === 'transcript');
    const key = rows.length ? s46.runId + ':' + rows[0].seq : '?';
    const c = s46.confirmed;
    const iPh = c.indexOf('· #' + key + ']'), iMark = c.indexOf('[اتصال دوباره برقرار شد'), iBefore = c.indexOf('قبل'), iAfter = c.indexOf('بعد');
    ok('T46 outage segment leaves placeholder in chronological place (before reconnect mark and later text)',
      rows.length === 1 && iBefore >= 0 && iPh > iBefore && iMark > iPh && iAfter > iMark, JSON.stringify(c));
    // T47: سرور placeholder را درجا پر کرده؛ ما دُمِ تازه داریم ⇒ 409 → متنِ سرور + دُم، بدونِ برچسبِ واگرایی
    await s46.persistConfirmed();
    const base = sessions.s46.transcript;
    sessions.s46.transcript = base.replace(/\[⏳ [^\]]*\]/, '[بازیابی‌شده از صدایِ بازه‌ی قطعی · #' + key + ']\nمتنِ بازیابی‌شده');
    sessions.s46.transcript_version++;
    serverTokens(FakeWS.last, [{ text: ' ادامه‌ی تازه', is_final: true }]); await sleep(5);
    await s46.persistConfirmed();
    const t47 = sessions.s46.transcript;
    ok('T47 rebase after in-place fill keeps recovered text + new tail, no divergence label, no placeholder',
      t47.includes('متنِ بازیابی‌شده') && t47.includes('ادامه‌ی تازه') && !t47.includes('ذخیره نشده بود') && !t47.includes('⏳') &&
      t47.indexOf('متنِ بازیابی‌شده') < t47.indexOf('بعد'), JSON.stringify(t47));
    await s46.finish(); RT.forget(s46);
  }
  // T48: placeholder هنوز ذخیره نشده بود و سرور متن را با همان کلید append کرد ⇒ placeholderِ محلی حذف می‌شود
  {
    newSession('s48');
    const s48 = RT.createSession('s48', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
    const p48 = s48.start(); await sleep(5); serverOpen(FakeWS.last); await p48;
    serverTokens(FakeWS.last, [{ text: 'اول', is_final: true }]); await sleep(5);
    await s48.persistConfirmed();
    s48.insertRecoveryPlaceholder(s48.runId, 7);
    serverTokens(FakeWS.last, [{ text: 'دوم', is_final: true }]); await sleep(5);
    sessions.s48.transcript += '\n\n[بازیابی‌شده از صدایِ بازه‌ی قطعی · #' + s48.runId + ':7]\nمتنِ صف';
    sessions.s48.transcript_version++;
    await s48.persistConfirmed();
    const t48 = sessions.s48.transcript;
    ok('T48 unsaved placeholder resolved by server append is dropped from local tail', t48.includes('متنِ صف') && t48.includes('دوم') && !t48.includes('⏳'), JSON.stringify(t48));
    await s48.finish(); RT.forget(s48);
  }

  // T49 (A5): متنِ > ۶۰KB ⇒ pagehide فقط دُمِ ذخیره‌نشده را با CAS رویِ نسخه (transcript-tail، keepalive) می‌فرستد.
  {
    newSession('s49');
    const s49 = RT.createSession('s49', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
    const p49 = s49.start(); await sleep(5); serverOpen(FakeWS.last); await p49;
    serverTokens(FakeWS.last, [{ text: 'ب'.repeat(40000), is_final: true }]); await sleep(5);
    await s49.persistConfirmed();
    serverTokens(FakeWS.last, [{ text: ' دُمِ آخر', is_final: true }]); await sleep(5);
    const realFetch49 = globalThis.fetch; let tailReq = null;
    globalThis.fetch = async (url, opts = {}) => {
      if (url === '/api/sessions/s49/transcript-tail') {
        tailReq = { keepalive: !!opts.keepalive, body: JSON.parse(opts.body) };
        const s = sessions.s49;
        if (tailReq.body.base_version !== s.transcript_version) return { ok: false, status: 409, json: async () => ({}) };
        s.transcript += tailReq.body.tail; s.transcript_version++;
        return { ok: true, status: 200, json: async () => ({ ok: true, transcript_version: s.transcript_version }) };
      }
      return realFetch49(url, opts);
    };
    s49.flushTranscriptNow(true); await sleep(20);
    globalThis.fetch = realFetch49;
    ok('T49 long transcript: pagehide sends only unsaved tail with version CAS (keepalive)',
      !!tailReq && tailReq.keepalive && tailReq.body.tail.indexOf('دُمِ آخر') >= 0 && tailReq.body.tail.length < 100 &&
      sessions.s49.transcript.endsWith('دُمِ آخر') && sessions.s49.transcript.length > 40000,
      JSON.stringify(tailReq && { k: tailReq.keepalive, len: tailReq.body.tail.length, v: tailReq.body.base_version }));
    await s49.finish(); RT.forget(s49);
  }

  // T50–T53 (2026-09-27): علامتِ بدنی در جایِ زمانیِ خودش داخلِ متنِ ذخیره‌شده؛ حذفش نشانگر را برمی‌دارد.
  {
    newSession('s50');
    const s50 = RT.createSession('s50', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
    const p50 = s50.start(); await sleep(5); serverOpen(FakeWS.last); await p50;
    serverTokens(FakeWS.last, [{ text: 'قبل از گریه', is_final: true, speaker: 1 }]); await sleep(5);
    const m50 = s50.insertSignMarker('۰۳:۱۲', 'گریان');
    serverTokens(FakeWS.last, [{ text: 'بعد از گریه', is_final: true, speaker: 1 }]); await sleep(5);
    await s50.persistConfirmed();
    const t50 = sessions.s50.transcript;
    ok('T50 sign marker saved inside transcript between the utterances around it (speaker relabelled after it)',
      m50 === '[علامت · ۰۳:۱۲ — گریان]' && t50.indexOf('قبل از گریه') < t50.indexOf(m50) && t50.indexOf(m50) < t50.indexOf('بعد از گریه') &&
      /\]\n\nگوینده ۱: بعد از گریه$/.test(t50), JSON.stringify(t50));
    // T51: حذفِ علامتِ ذخیره‌شده ⇒ PUTِ بعدی نشانگر را از سرور برمی‌دارد؛ متنِ دیگری عوض نمی‌شود
    ok('T51a removeSignMarker returns true for a present marker', s50.removeSignMarker(m50) === true, '');
    await s50.persistConfirmed();
    const t51 = sessions.s50.transcript;
    ok('T51 removed sign marker disappears from saved transcript, rest intact, same-speaker halves re-joined (no duplicate label)',
      t51 === 'گوینده ۱: قبل از گریه بعد از گریه', JSON.stringify(t51));
    // T52: حذفِ نشانگرِ ذخیره‌شده + batch هم‌زمان نسخه را بالا برده (409) ⇒ هیچ متنی تکرار یا گم نمی‌شود
    const m52 = s50.insertSignMarker('۰۵:۰۰', 'سکوت طولانی');
    serverTokens(FakeWS.last, [{ text: ' ادامه', is_final: true, speaker: 1 }]); await sleep(5);
    await s50.persistConfirmed();
    s50.removeSignMarker(m52);
    sessions.s50.transcript += '\n\nBATCH X'; sessions.s50.transcript_version++;
    serverTokens(FakeWS.last, [{ text: ' تازه', is_final: true, speaker: 1 }]); await sleep(5);
    await s50.persistConfirmed();
    const t52 = sessions.s50.transcript;
    const count = (s, w) => s.split(w).length - 1;
    ok('T52 marker removal racing a batch append: no duplicated or lost text',
      count(t52, 'قبل از گریه') === 1 && count(t52, 'بعد از گریه') === 1 && count(t52, 'BATCH X') === 1 && count(t52, 'تازه') === 1 && count(t52, 'ادامه') === 1,
      JSON.stringify(t52));
    // T53: موتور بعد از پایان نشانگر نمی‌پذیرد (متنش دیگر ذخیره نمی‌شود) و حالتِ note هرگز
    await s50.finish();
    ok('T53a no sign marker after finish', s50.insertSignMarker('۰۹:۰۰', 'خشم') === null, '');
    RT.forget(s50);
    newSession('s53');
    const n53 = RT.createSession('s53', { mode: 'note', onState: () => {}, onResult: () => {}, onError: () => {} });
    ok('T53b note-mode session never takes sign markers', n53.insertSignMarker('۰۰:۰۱', 'خشم') === null, '');
    // T54: نشانگرِ وسطِ گفته، بلافاصله حذف (هنوز متنی بعدش نیامده) ⇒ ادامه‌ی همان گوینده بدونِ برچسبِ تکراری
    newSession('s54');
    const s54 = RT.createSession('s54', { mode: 'live', onState: () => {}, onResult: () => {}, onError: () => {} });
    const p54 = s54.start(); await sleep(5); serverOpen(FakeWS.last); await p54;
    serverTokens(FakeWS.last, [{ text: 'این جمله خیلی مهم', is_final: true, speaker: 1 }]); await sleep(5);
    const m54 = s54.insertSignMarker('۰۰:۴۵', 'لرزش');
    s54.removeSignMarker(m54);
    serverTokens(FakeWS.last, [{ text: ' بود.', is_final: true, speaker: 1 }, { text: 'سلام', is_final: true, speaker: 2 }]); await sleep(5);
    const c54 = RT.cleanText(s54.confirmed);
    ok('T54 immediate removal: same speaker continues in one paragraph; next speaker still labelled',
      c54 === 'گوینده ۱: این جمله خیلی مهم بود.\n\nگوینده ۲: سلام', JSON.stringify(c54));
    await s54.finish(); RT.forget(s54);
    // T55: تابعِ مشترکِ Wrapup — گوینده‌هایِ متفاوتِ دو طرف پاراگرافِ جدا می‌مانند؛ نشانگرِ ناموجود ⇒ null
    const r55 = RT.removeMarkerFromText('گوینده ۱: الف\n\n[علامت · ۰۱:۰۰ — خشم]\n\nگوینده ۲: ب', '[علامت · ۰۱:۰۰ — خشم]');
    ok('T55 removeMarkerFromText keeps different speakers apart; absent marker → null',
      r55 === 'گوینده ۱: الف\n\nگوینده ۲: ب' && RT.removeMarkerFromText('متن', '[علامت · ۰۱:۰۰ — خشم]') === null &&
      RT.removeMarkerFromText('[علامت · ۰۰:۰۰ — خشم]\n\nگوینده ۱: الف', '[علامت · ۰۰:۰۰ — خشم]') === 'گوینده ۱: الف', JSON.stringify(r55));
    ok('T53c marker text is sanitised (no brackets/newlines from input)', RT.signMarker('۰۱:۰۰', 'a]\nb[') === '[علامت · ۰۱:۰۰ — a b]', RT.signMarker('۰۱:۰۰', 'a]\nb['));
  }

  console.log(results.map((r) => r[0]).join('\n'));
})().catch((e) => { console.error('HARNESS ERROR', e); process.exitCode = 1; });
