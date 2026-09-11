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
class FakeRecorder {
  constructor(stream, opts) { this.stream = stream; this.state = 'inactive'; this.ondataavailable = null; this.onstop = null; }
  start(ts) { this.state = 'recording'; if (this.ondataavailable) this.ondataavailable({ data: new Blob(['x'.repeat(500)]) }); }
  stop() { if (this.state === 'inactive') return; this.state = 'inactive'; if (this.onstop) this.onstop(); }
}
globalThis.MediaRecorder = FakeRecorder;
FakeRecorder.isTypeSupported = () => true;
Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: { getUserMedia: async () => ({ active: true, getTracks: () => [{ stop() {} }] }) } }, configurable: true, writable: true });

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
    return json(200, { websocket_url: 'wss://fake-soniox', model: 'stt-rt-v5', api_key: 'TEMP-' + mintCount, expires_in_seconds: 120, single_use: true, stt_defaults: { model: 'stt-rt-v5' } });
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
    const purpose = url.includes('purpose=note') ? 'note' : 'transcript';
    (purpose === 'note' ? noteQueue : batchQueue).push({ sessionId: m[1] });
    return json(202, { status: 'queued', purpose });
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
  ok('T16 durable-only finish → batch-pending, queued', out16.mode === 'batch-pending' && batchQueue.some((q) => q.sessionId === 's16'), out16.mode);
  batchPolls = 0;
  const drain16 = await s16.awaitBatchDrain({ timeoutMs: 15000 });
  ok('T16 later batch merges', drain16.drained && drain16.ok && sessions.s16.transcript.includes('BATCH FULL TEXT'));

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

  console.log(results.map((r) => r[0]).join('\n'));
})().catch((e) => { console.error('HARNESS ERROR', e); process.exitCode = 1; });
