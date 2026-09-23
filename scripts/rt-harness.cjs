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
    const q = new URLSearchParams(url.split('?')[1] || '');
    sentBlobs.push({ sessionId: m[1], purpose: q.get('purpose'), seq: Number(q.get('seq')), blob: opts.body && opts.body.f ? opts.body.f[0] : null });
    const purpose = q.get('purpose') || 'transcript';
    // ⭐ archive فقط آرشیو می‌شود، هرگز رونویسی — قبلاً mock آن را هم در batchQueue می‌گذاشت و
    // سگمنتی که اشتباهاً archive گرفته بود (مثلاً آخرین سگمنتِ finish در FAILED) تست را سبز نگه می‌داشت.
    if (purpose !== 'archive') (purpose === 'note' ? noteQueue : batchQueue).push({ sessionId: m[1] });
    return json(202, { status: purpose === 'archive' ? 'archived' : 'queued', purpose });
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

  console.log(results.map((r) => r[0]).join('\n'));
})().catch((e) => { console.error('HARNESS ERROR', e); process.exitCode = 1; });
