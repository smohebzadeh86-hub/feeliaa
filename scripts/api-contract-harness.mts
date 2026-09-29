// API contract harness (characterization) — پاسخِ واقعیِ endpointهایِ غیرِ legacy را رویِ MySQLِ dev با fixtureِ
// ساختگی ضبط می‌کند تا refactorِ backend ثابت کند رفتار عوض نشده: status + headerهایِ مهم + bodyِ نرمال‌شده +
// snapshotِ ردیف‌هایِ DBِ fixture + دنباله‌ی فراخوانی‌هایِ Soniox (mock) + رویدادهایِ obs (JSONL).
//
//   FEELIA_E2E_OK=1 pnpm test:api                      ⇒ اجرا + مقایسه با golden (اگر FEELIA_API_GOLDEN ست باشد)
//   FEELIA_E2E_OK=1 pnpm test:api -- --update          ⇒ نوشتنِ golden
//
// env:
//   FEELIA_E2E_OK=1                 الزامی — تست رویِ DBِ مشترکِ dev می‌نویسد (فقط fixture، در پایان پاک می‌شود).
//   FEELIA_E2E_ENV_FILE             مسیرِ .env برایِ خواندنِ فقط DATABASE_URL (پیش‌فرض server/.env).
//   FEELIA_E2E_WORKDIR              پوشه‌ی کار (data/ اپ این‌جا ساخته می‌شود؛ پیش‌فرض tmp).
//   FEELIA_E2E_FIXTURES             پوشه‌ی فایل‌هایِ صوتیِ ساختگی (یک بار ساخته و بینِ اجراها ثابت می‌ماند).
//   FEELIA_API_GOLDEN / FEELIA_API_OUT   مسیرِ golden و خروجی.
//
// ایمنی: Soniox فقط mockِ محلیِ https (کلیدِ جعلی، PROXY_URL پاک)؛ هیچ کلیدِ LLM بارگذاری نمی‌شود (regenerate ⇒ 502
// پیش از هر فراخوانیِ شبکه)؛ jobهایِ آپلودِ fixture بلافاصله با locked_untilِ آینده قفل می‌شوند تا workerِ سرورِ
// devِ دیگر آن‌ها را برندارد (اگر برداشته شد، اجرا با خطا متوقف می‌شود). خروجی فقط دادهٔ fixture دارد.
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

if (process.env.FEELIA_E2E_OK !== '1') {
  console.error('api-contract-harness: FEELIA_E2E_OK=1 لازم است (رویِ DBِ dev fixture می‌سازد و پاک می‌کند).');
  process.exit(2);
}
const UPDATE = process.argv.includes('--update');

// ————————————————— env (قبل از هر import از server/src) —————————————————
function readDatabaseUrl(): string {
  if (process.env.FEELIA_E2E_DATABASE_URL) return process.env.FEELIA_E2E_DATABASE_URL;
  const envFile = process.env.FEELIA_E2E_ENV_FILE || path.join(REPO, 'server', '.env');
  const m = /^DATABASE_URL=(.*)$/m.exec(readFileSync(envFile, 'utf8'));
  if (!m) throw new Error('DATABASE_URL not found in ' + envFile);
  return m[1].trim().replace(/^["']|["']$/g, '');
}
const DATABASE_URL = readDatabaseUrl();
const WORKDIR = path.resolve(process.env.FEELIA_E2E_WORKDIR || path.join(os.tmpdir(), `feelia-api-harness-${process.pid}`));
const FIXTURES = path.resolve(process.env.FEELIA_E2E_FIXTURES || path.join(WORKDIR, '..', 'feelia-api-fixtures'));
rmSync(WORKDIR, { recursive: true, force: true });
mkdirSync(WORKDIR, { recursive: true });
mkdirSync(FIXTURES, { recursive: true });

const PHONE_T1 = '09990001001';
const PHONE_T2 = '09990001002';
const PHONE_ADMIN = '09990001009';
const PHONE_PREFIX = '0999000100';
const EMAIL_DOMAIN = '@feelia-api-harness.invalid';
const T2_PASSWORD = randomBytes(18).toString('hex'); // فقط در حافظه‌ی همین پروسه

for (const k of Object.keys(process.env)) {
  if (/^(SONIOX_|PROXY_URL|OPENAI_|OPENROUTER_|LLM_PROVIDER|UPLOAD_|CASE_FILE_|SESSION_AUTO_CLOSE|OBS_|CLARITY_|ADMIN_PHONE|FFMPEG_PATH|AUTH_PASSWORD)/.test(k)) delete process.env[k];
}
process.env.DATABASE_URL = DATABASE_URL;
process.env.LOG_LEVEL = 'silent';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.SONIOX_API_KEY = 'harness-fake-key-not-real';
process.env.ADMIN_PHONE = PHONE_T2; // ensureAdminFlag رویِ ثبت‌نام/ورودِ T2 ⇒ مسیرِ admin.flag_granted هم پوشش داده می‌شود
process.env.CLARITY_PROJECT_ID = 'harnessclar01';

// ————————————————— fixtureهایِ صوتی (ثابت بینِ اجراها) —————————————————
function ffmpeg(args: string[]) { execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]); }
function fixture(name: string, make: (p: string) => void): Buffer {
  const p = path.join(FIXTURES, name);
  if (!existsSync(p)) make(p);
  return readFileSync(p);
}
const SEG0 = fixture('seg0.webm', (p) => ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:a', 'libopus', '-b:a', '24k', p]));
const SEG1 = fixture('seg1.webm', (p) => ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=660:duration=2', '-c:a', 'libopus', '-b:a', '24k', p]));
const SEG2 = fixture('seg2.webm', (p) => ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=550:duration=2', '-c:a', 'libopus', '-b:a', '24k', p]));
const NOTE = fixture('note.webm', (p) => ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=300:duration=2', '-c:a', 'libopus', '-b:a', '24k', p]));
const UP1 = fixture('upload1.ogg', (p) => ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=400:duration=6', '-c:a', 'libvorbis', p]));
const UP2A = fixture('upload2a.mp3', (p) => ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=500:duration=3', '-c:a', 'libmp3lame', p]));
const UP2B = fixture('upload2b.mp3', (p) => ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=520:duration=3', '-c:a', 'libmp3lame', p]));
const NOT_AUDIO = fixture('notaudio.mp3', (p) => writeFileSync(p, Buffer.concat([Buffer.from('%PDF-1.4\n'), randomBytes(3000)])));
const BAD_CONTAINER = fixture('bad-container.webm', (p) => writeFileSync(p, randomBytes(4000)));
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

// ————————————————— Soniox mock (https محلی) —————————————————
const mockLog: string[] = [];
let mockSeq = 0;
function makeCert(): { key: Buffer; cert: Buffer } {
  const key = path.join(FIXTURES, 'mock-key.pem');
  const cert = path.join(FIXTURES, 'mock-cert.pem');
  if (!existsSync(key) || !existsSync(cert)) {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '3650', '-subj', '/CN=127.0.0.1'], { stdio: 'ignore' });
  }
  return { key: readFileSync(key), cert: readFileSync(cert) };
}
const TOKENS = [{ text: 'سلام ', speaker: 1 }, { text: 'متنِ آزمایشیِ mock', speaker: 1 }, { text: 'پاسخِ گوینده‌ی دوم', speaker: 2 }];
const mock = https.createServer(makeCert(), (req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const url = new URL(req.url || '/', 'https://x');
    const p = url.pathname;
    const send = (status: number, json?: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(json === undefined ? '' : JSON.stringify(json));
    };
    let note = '';
    if (req.method === 'POST' && p === '/v1/auth/temporary-api-key') {
      const j = JSON.parse(body.toString('utf8'));
      note = JSON.stringify({ ...j, auth: req.headers.authorization === 'Bearer harness-fake-key-not-real' });
      mockLog.push(`${req.method} ${p} ${note}`);
      return send(200, { api_key: 'tmp-harness-key', expires_at: '2030-01-01T00:00:00Z' });
    }
    if (req.method === 'POST' && p === '/v1/files') {
      const s = body.toString('latin1');
      const fn = /filename="([^"]*)"/.exec(s)?.[1];
      const ref = /name="client_reference_id"\r\n\r\n([^\r]*)/.exec(s)?.[1];
      mockLog.push(`${req.method} ${p} filename=${fn} ref=${ref ?? '-'} bytes=${body.length > 0}`);
      return send(201, { id: `mockfile-${++mockSeq}` });
    }
    if (req.method === 'POST' && p === '/v1/transcriptions') {
      const j = JSON.parse(body.toString('utf8'));
      mockLog.push(`${req.method} ${p} ${JSON.stringify({ ...j, file_id: j.file_id ? 'file' : j.file_id })}`);
      return send(201, { id: `mocktr-${++mockSeq}` });
    }
    const tr = /^\/v1\/transcriptions\/([^/]+)(\/transcript)?$/.exec(p);
    if (req.method === 'GET' && tr) {
      mockLog.push(`${req.method} /v1/transcriptions/:id${tr[2] || ''}`);
      return tr[2] ? send(200, { tokens: TOKENS }) : send(200, { status: 'completed' });
    }
    if (req.method === 'DELETE' && /^\/v1\/(files|transcriptions)\/[^/]+$/.test(p)) {
      mockLog.push(`${req.method} ${p.replace(/\/[^/]+$/, '/:id')}`);
      res.writeHead(204); return res.end();
    }
    if (req.method === 'GET' && (p === '/v1/files' || p === '/v1/transcriptions')) {
      mockLog.push(`${req.method} ${p}`);
      return send(200, p === '/v1/files' ? { files: [] } : { transcriptions: [] });
    }
    mockLog.push(`UNHANDLED ${req.method} ${p}`);
    send(404, { error_message: 'not found' });
  });
});
await new Promise<void>((r) => mock.listen(0, '127.0.0.1', () => r()));
process.env.SONIOX_API_BASE = `https://127.0.0.1:${(mock.address() as any).port}`;

// ————————————————— اپ (بعد از env و chdir) —————————————————
process.chdir(WORKDIR);
const { buildApp } = await import('../server/src/app.js');
const { query, pool } = await import('../server/src/db/connection.js');
const { createSession } = await import('../server/src/auth/session.js');
const { flushObsQueue } = await import('../server/src/obs/eventLog.js');
const app = await buildApp();
await app.ready();

// ————————————————— نرمال‌سازی —————————————————
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const idMap = new Map<string, string>();
const codeMap = new Map<string, string>();
const EXPLICIT_TIMES = new Set(['10:30', '09:05', '18:45']);
let todayJalali = '';
let canonicalMode = false;
function mapId(id: string): string {
  const k = id.toLowerCase();
  if (!idMap.has(k)) {
    if (canonicalMode) return '<id:unseen>';
    idMap.set(k, `<id:${idMap.size + 1}>`);
  }
  return idMap.get(k)!;
}
function normStr(s: string, key?: string): string {
  if (ISO_RE.test(s)) return '<ts>';
  if (key === 'start_time' && /^\d{2}:\d{2}$/.test(s) && !EXPLICIT_TIMES.has(s)) return '<hh:mm>';
  if ((key === 'date' || key === 'session_date' || key === 'startDate') && s === todayJalali) return '<today>';
  if (key === 'wall_clock' && /[۰-۹]/.test(s)) return '<wall_clock>';
  let out = s.split(WORKDIR).join('<workdir>').split(WORKDIR.replace(/\\/g, '/')).join('<workdir>').replace(/\\/g, '/');
  out = out.replace(/\bCL-[A-Z0-9]{4}\b/g, (c) => {
    if (!codeMap.has(c)) codeMap.set(c, `<code:${codeMap.size + 1}>`);
    return codeMap.get(c)!;
  });
  out = out.replace(UUID_RE, (m) => mapId(m));
  out = out.replace(/[۰-۹]{2}:[۰-۹]{2}:[۰-۹]{2}/g, '<fa-hh:mm:ss>'); // ساعتِ fa-IR در متنِ diagnosis
  return out;
}
const OBS_VOLATILE = new Set(['duration_ms', 'request_id', 'durationMs']);
function norm(v: unknown, key?: string, obs = false): unknown {
  if (v === null || v === undefined) return v ?? null;
  if (v instanceof Date) return '<ts>';
  if (typeof v === 'string') return normStr(v, key);
  if (typeof v === 'number') {
    if (obs && key && OBS_VOLATILE.has(key)) return '<ms>';
    return v;
  }
  if (Array.isArray(v)) return v.map((x) => norm(x, key, obs));
  if (typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as object)) {
      const x = (v as any)[k];
      if (obs && OBS_VOLATILE.has(k)) { o[k] = x === null || x === undefined ? null : '<volatile>'; continue; }
      o[k] = norm(x, k, obs);
    }
    return o;
  }
  return v;
}
// شمارِ کلِ تراپیست‌هایِ DBِ dev (خروجیِ کاملِ سیستم) به داده‌یِ بیرون از fixture وابسته است ⇒ '<n>'.
function maskExternalCounts(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(maskExternalCounts);
  if (v && typeof v === 'object') {
    const o: any = v;
    const isFullExport = (o.action === 'admin.export' || o.event === 'admin.export') && o.detail && o.detail.kind === 'full';
    const out: any = {};
    for (const k of Object.keys(o)) out[k] = maskExternalCounts(o[k]);
    if (isFullExport && 'count' in out.detail) out.detail = { ...out.detail, count: '<n>' };
    return out;
  }
  return v;
}
function canonical<T>(arr: T[]): T[] {
  return [...arr].sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0);
}

// ————————————————— ضبطِ خروجی —————————————————
const out: string[] = [];
function emit(obj: unknown) { out.push(JSON.stringify(obj)); }
const KEEP_HEADERS = ['content-type', 'content-disposition', 'content-range', 'accept-ranges', 'cache-control', 'x-audio-complete', 'x-audio-missing-segments'];

type Req = { method: string; url: string; cookie?: string | null; json?: unknown; body?: Buffer | string; headers?: Record<string, string>; multipart?: { field: string; filename: string; mime: string; data: Buffer } };
type Opts = { canonicalLists?: string[]; shapeOnly?: boolean; obs?: boolean; filter?: (body: any) => any; binary?: boolean };

function multipartBody(m: NonNullable<Req['multipart']>) {
  const boundary = '----harness' + 'b0undary';
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${m.field}"; filename="${m.filename}"\r\nContent-Type: ${m.mime}\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { payload: Buffer.concat([head, m.data, tail]), contentType: `multipart/form-data; boundary=${boundary}` };
}

function shape(v: unknown): unknown {
  if (v === null) return null;
  if (Array.isArray(v)) return v.length ? [shape(v[0])] : [];
  if (typeof v === 'object') { const o: any = {}; for (const k of Object.keys(v as object).sort()) o[k] = shape((v as any)[k]); return o; }
  return typeof v;
}

async function call(name: string, r: Req, opts: Opts = {}): Promise<any> {
  const headers: Record<string, string> = { ...(r.headers || {}) };
  if (r.cookie) headers.cookie = `feelia_session=${r.cookie}`;
  let payload: any = undefined;
  if (r.json !== undefined) { payload = JSON.stringify(r.json); headers['content-type'] = 'application/json'; }
  if (r.body !== undefined) payload = r.body;
  if (r.multipart) { const m = multipartBody(r.multipart); payload = m.payload; headers['content-type'] = m.contentType; }
  const res = await app.inject({ method: r.method as any, url: r.url, headers, payload });
  const h: Record<string, unknown> = {};
  for (const k of KEEP_HEADERS) if (res.headers[k] !== undefined) h[k] = res.headers[k];
  const setCookie = res.headers['set-cookie'];
  if (setCookie) h['set-cookie'] = String(setCookie).replace(/feelia_session=[^;]*/, (m) => m.endsWith('=') ? m : 'feelia_session=<token>');
  let body: any = null;
  const ct = String(res.headers['content-type'] || '');
  if (opts.binary || (!ct.includes('json') && !ct.startsWith('text/') && res.rawPayload.length)) {
    body = { binary_bytes: res.rawPayload.length };
    if (opts.binary && res.headers['content-length'] !== undefined) h['content-length'] = res.headers['content-length'];
  } else if (ct.includes('json')) {
    body = res.rawPayload.length ? JSON.parse(res.payload) : null;
  } else if (res.rawPayload.length) {
    body = { text_sha256: sha(res.rawPayload), text_bytes: res.rawPayload.length };
  }
  const raw = body;
  let recorded = opts.filter ? opts.filter(body) : body;
  if (opts.shapeOnly) recorded = shape(recorded);
  else {
    // فهرستِ canonical (ترتیبِ ردیف‌هایِ هم‌زمان در DB قطعی نیست): شناسه‌یِ تازه برچسبِ ترتیب‌وابسته نمی‌گیرد.
    const prev = canonicalMode;
    if (opts.canonicalLists) canonicalMode = true;
    recorded = norm(recorded, undefined, !!opts.obs);
    canonicalMode = prev;
    if (opts.canonicalLists && recorded && typeof recorded === 'object') {
      for (const k of opts.canonicalLists) {
        if (Array.isArray((recorded as any)[k])) (recorded as any)[k] = canonical((recorded as any)[k]);
      }
    }
  }
  emit({ step: name, status: res.statusCode, headers: norm(h), body: recorded });
  return { status: res.statusCode, body: raw, headers: res.headers };
}

// ————————————————— کمکی‌ها —————————————————
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(label: string, fn: () => Promise<boolean> | boolean, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return;
    await sleep(200);
  }
  throw new Error('timeout waiting for ' + label);
}
const mockCount = (re: RegExp) => mockLog.filter((l) => re.test(l)).length;
const queueDir = path.join(WORKDIR, 'data', 'batch-queue');
const queueFilesFor = (sid: string) => existsSync(queueDir) ? readdirSync(queueDir).filter((f) => f.startsWith(sid + '-')) : [];
async function dbSnapshot(label: string, ids: { therapists: string[] }) {
  const t = ids.therapists;
  const ph = t.map(() => '?').join(',');
  const clients = (await query(`SELECT id FROM clients WHERE therapist_id IN (${ph})`, t)).rows.map((r: any) => r.id);
  const cph = clients.length ? clients.map(() => '?').join(',') : 'NULL';
  const sessions = clients.length ? (await query(`SELECT id FROM sessions WHERE client_id IN (${cph})`, clients)).rows.map((r: any) => r.id) : [];
  const sph = sessions.length ? sessions.map(() => '?').join(',') : 'NULL';
  const all = [...t, ...clients, ...sessions];
  const aph = all.map(() => '?').join(',');
  const snap: Record<string, unknown> = {
    therapists: (await query(`SELECT id, phone, email, name, specialty, is_admin, active, created_at, case_file_auto_generate, case_file_enabled, final_transcript_enabled, modalities FROM therapists WHERE id IN (${ph})`, t)).rows,
    client_members: clients.length ? (await query(`SELECT * FROM client_members WHERE client_id IN (${cph})`, clients)).rows : [],
    final_transcripts: sessions.length ? (await query(`SELECT * FROM final_transcripts WHERE session_id IN (${sph})`, sessions)).rows : [],
    auth_sessions: (await query(`SELECT therapist_id, COUNT(*) AS n FROM auth_sessions WHERE therapist_id IN (${ph}) GROUP BY therapist_id`, t)).rows,
    clients: clients.length ? (await query(`SELECT * FROM clients WHERE id IN (${cph})`, clients)).rows : [],
    sessions: sessions.length ? (await query(`SELECT * FROM sessions WHERE id IN (${sph})`, sessions)).rows : [],
    session_notes: sessions.length ? (await query(`SELECT * FROM session_notes WHERE session_id IN (${sph})`, sessions)).rows : [],
    session_audio: sessions.length ? (await query(`SELECT * FROM session_audio WHERE session_id IN (${sph})`, sessions)).rows : [],
    client_case_file: clients.length ? (await query(`SELECT * FROM client_case_file WHERE client_id IN (${cph})`, clients)).rows : [],
    audio_uploads: (await query(`SELECT * FROM audio_uploads WHERE therapist_id IN (${ph})`, t)).rows,
    audio_jobs: (await query(`SELECT * FROM audio_jobs WHERE therapist_id IN (${ph})`, t)).rows,
    notifications: (await query(`SELECT * FROM notifications WHERE therapist_id IN (${ph})`, t)).rows,
    audit_log: (await query(`SELECT actor_id, actor_is_admin, action, target_type, target_id, detail FROM audit_log WHERE actor_id IN (${aph}) OR target_id IN (${aph}) ORDER BY id`, [...all, ...all])).rows,
  };
  const prev = canonicalMode;
  canonicalMode = true;
  const n: Record<string, unknown> = {};
  for (const [k, rows] of Object.entries(snap)) {
    const nr = maskExternalCounts(norm(rows)) as unknown[];
    n[k] = k === 'audit_log' ? nr : canonical(nr);
  }
  canonicalMode = prev;
  emit({ snapshot: label, db: n });
}

// ————————————————— پاک‌سازیِ fixtureِ اجرایِ ناتمامِ قبلی —————————————————
async function cleanupFixtures(): Promise<number> {
  const r = await query(`SELECT id FROM therapists WHERE phone LIKE ? AND email LIKE ?`, [PHONE_PREFIX + '%', '%' + EMAIL_DOMAIN]);
  const ids = r.rows.map((x: any) => x.id);
  const ph = ids.length ? ids.map(() => '?').join(',') : 'NULL';
  const clients = ids.length ? (await query(`SELECT id FROM clients WHERE therapist_id IN (${ph})`, ids)).rows.map((x: any) => x.id) : [];
  const sessions = clients.length ? (await query(`SELECT id FROM sessions WHERE client_id IN (${clients.map(() => '?').join(',')})`, clients)).rows.map((x: any) => x.id) : [];
  // + هر شناسه‌ای که در همین اجرا دیده شد (تراپیست/مراجع/جلسه‌ای که وسطِ تست حذف شد هم ردِ obs/audit دارد)
  const all = [...new Set([...ids, ...clients, ...sessions, ...idMap.keys()])];
  if (!all.length) return 0;
  const aph = all.map(() => '?').join(',');
  if (ids.length) await query(`DELETE FROM therapists WHERE id IN (${ph})`, ids);
  await query(`DELETE FROM obs_events WHERE therapist_id IN (${aph}) OR client_id IN (${aph}) OR session_id IN (${aph})`, [...all, ...all, ...all]);
  await query(`DELETE FROM obs_ui_events WHERE therapist_id IN (${aph}) OR session_id IN (${aph})`, [...all, ...all]);
  await query(`DELETE FROM audit_log WHERE actor_id IN (${aph}) OR target_id IN (${aph})`, [...all, ...all]);
  return ids.length;
}

let exitCode = 0;
try {
  const stale = await cleanupFixtures();
  if (stale) console.log(`(cleaned ${stale} stale fixture therapist(s) from an earlier run)`);
  const clash = await query(`SELECT COUNT(*) AS n FROM therapists WHERE phone IN (?, ?, ?)`, [PHONE_T1, PHONE_T2, PHONE_ADMIN]);
  if (Number(clash.rows[0].n) > 0) throw new Error('fixture phone already used by a non-fixture therapist — abort');
  const jp = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  todayJalali = `${jp.find((x) => x.type === 'year')!.value}/${jp.find((x) => x.type === 'month')!.value}/${jp.find((x) => x.type === 'day')!.value}`;

  // ——— fixtureها: T1 (تراپیستِ عادی، پرونده فعال) و ADMIN — hashِ غیرقابلِ‌استفاده ———
  const T1 = '11111111-aaaa-4aaa-8aaa-000000000001';
  const ADMIN = '11111111-aaaa-4aaa-8aaa-000000000009';
  mapId(T1); mapId(ADMIN);
  await query(`INSERT INTO therapists (id, phone, email, password_hash, name, specialty, is_admin, active, case_file_enabled, created_at)
               VALUES (?, ?, ?, 'x:unusable', 'تراپیستِ آزمایشی', 'آزمون', 0, 1, 1, NOW() - INTERVAL 20 SECOND)`, [T1, PHONE_T1, 't1' + EMAIL_DOMAIN]);
  await query(`INSERT INTO therapists (id, phone, email, password_hash, name, specialty, is_admin, active, created_at)
               VALUES (?, ?, ?, 'x:unusable', 'ادمینِ آزمایشی', 'آزمون', 1, 1, NOW() - INTERVAL 30 SECOND)`, [ADMIN, PHONE_ADMIN, 'admin' + EMAIL_DOMAIN]);
  const t1 = await createSession(T1);
  const ad = await createSession(ADMIN);
  const fixtureTherapists = [T1, ADMIN];

  // ——— A. health / static ———
  await call('health', { method: 'GET', url: '/api/health' });
  await call('static index', { method: 'GET', url: '/' });
  await call('static missing', { method: 'GET', url: '/no-such-file.txt' });

  // ——— B. auth ———
  await call('register no phone', { method: 'POST', url: '/api/auth/register', json: { password: 'x' } });
  await call('register bad phone', { method: 'POST', url: '/api/auth/register', json: { phone: '123', password: 'xxxxxxxxx' } });
  await call('register bad email', { method: 'POST', url: '/api/auth/register', json: { phone: PHONE_T2, email: 'no', password: 'xxxxxxxxx' } });
  await call('register short pwd', { method: 'POST', url: '/api/auth/register', json: { phone: PHONE_T2, password: 'short' } });
  await call('register no name', { method: 'POST', url: '/api/auth/register', json: { phone: PHONE_T2, password: T2_PASSWORD } });
  await call('register no specialty', { method: 'POST', url: '/api/auth/register', json: { phone: PHONE_T2, password: T2_PASSWORD, name: 'دو' } });
  const reg = await call('register ok', { method: 'POST', url: '/api/auth/register', json: { phone: '+98 999 000 1002', email: 'T2' + EMAIL_DOMAIN.toUpperCase(), password: T2_PASSWORD, name: ' تراپیستِ دوم ', specialty: 'روان‌درمانی' } });
  const T2: string = reg.body.therapist.id;
  fixtureTherapists.push(T2);
  await call('register duplicate', { method: 'POST', url: '/api/auth/register', json: { phone: PHONE_T2, password: T2_PASSWORD, name: 'x', specialty: 'y' } });
  await call('login missing', { method: 'POST', url: '/api/auth/login', json: { phone: PHONE_T2 } });
  await call('login wrong', { method: 'POST', url: '/api/auth/login', json: { phone: PHONE_T2, password: 'wrong-password' } });
  await call('login unknown phone', { method: 'POST', url: '/api/auth/login', json: { phone: '09990001999', password: 'wrong-password' } });
  const login = await call('login ok (persian digits)', { method: 'POST', url: '/api/auth/login', json: { phone: '۰۹۹۹۰۰۰۱۰۰۲', password: T2_PASSWORD } });
  const t2 = /feelia_session=([^;]+)/.exec(String(login.headers['set-cookie']))![1];
  await call('me no cookie', { method: 'GET', url: '/api/auth/me' });
  await call('me t2', { method: 'GET', url: '/api/auth/me', cookie: t2 });
  await call('me t1', { method: 'GET', url: '/api/auth/me', cookie: t1 });
  await call('me bad cookie', { method: 'GET', url: '/api/auth/me', cookie: 'nope' });
  await call('auto-generate no auth', { method: 'PATCH', url: '/api/auth/case-file-auto-generate', json: { enabled: true } });
  await call('auto-generate not enabled (t2)', { method: 'PATCH', url: '/api/auth/case-file-auto-generate', cookie: t2, json: { enabled: true } });
  await call('auto-generate bad body', { method: 'PATCH', url: '/api/auth/case-file-auto-generate', cookie: t1, json: { enabled: 'yes' } });
  await call('auto-generate true', { method: 'PATCH', url: '/api/auth/case-file-auto-generate', cookie: t1, json: { enabled: true } });
  await call('auto-generate false', { method: 'PATCH', url: '/api/auth/case-file-auto-generate', cookie: t1, json: { enabled: false } });
  const t2b = await createSession(T2);
  await call('logout t2', { method: 'POST', url: '/api/auth/logout', cookie: t2b });
  await call('me after logout', { method: 'GET', url: '/api/auth/me', cookie: t2b });

  // ——— C. client-config ———
  await call('client-config no auth', { method: 'GET', url: '/api/client-config' });
  await call('client-config t1', { method: 'GET', url: '/api/client-config', cookie: t1 });
  await call('client-config admin', { method: 'GET', url: '/api/client-config', cookie: ad });

  // ——— D. clients ———
  await call('clients no auth', { method: 'GET', url: '/api/clients' });
  await call('clients empty', { method: 'GET', url: '/api/clients', cookie: t1 });
  await call('client bad category', { method: 'POST', url: '/api/clients', cookie: t1, json: { category: 'x' } });
  await call('client bad gender', { method: 'POST', url: '/api/clients', cookie: t1, json: { gender: 'x' } });
  await call('client bad status', { method: 'POST', url: '/api/clients', cookie: t1, json: { status: 'x' } });
  await call('client long reason', { method: 'POST', url: '/api/clients', cookie: t1, json: { status: 'inactive', reason: 'x'.repeat(201) } });
  const c1 = (await call('client C1', { method: 'POST', url: '/api/clients', cookie: t1, json: { alias: 'مراجعِ یک', category: 'adult', gender: 'f' } })).body.client.id;
  await sleep(1100);
  const c2 = (await call('client C2', { method: 'POST', url: '/api/clients', cookie: t1, json: { alias: 'مراجعِ دو', category: 'child', gender: 'm' } })).body.client.id;
  await sleep(1100);
  const c3 = (await call('client C3 inactive', { method: 'POST', url: '/api/clients', cookie: t1, json: { alias: 'بایگانی', status: 'inactive', reason: '  پایانِ درمان  ' } })).body.client.id;
  await sleep(1100);
  const c4 = (await call('client C4 bare', { method: 'POST', url: '/api/clients', cookie: t1, json: {} })).body.client.id;
  const c5 = (await call('client C5 (t2)', { method: 'POST', url: '/api/clients', cookie: t2, json: { alias: 'مراجعِ تراپیستِ دوم' } })).body.client.id;
  await call('clients list', { method: 'GET', url: '/api/clients', cookie: t1 });
  await call('client get', { method: 'GET', url: `/api/clients/${c1}`, cookie: t1 });
  await call('client get unknown', { method: 'GET', url: '/api/clients/00000000-0000-4000-8000-000000000000', cookie: t1 });
  await call('client get foreign (LAW-004)', { method: 'GET', url: `/api/clients/${c1}`, cookie: t2 });
  await call('client put alias', { method: 'PUT', url: `/api/clients/${c1}`, cookie: t1, json: { alias: 'مراجعِ یک (ویرایش)' } });
  await call('client put foreign', { method: 'PUT', url: `/api/clients/${c1}`, cookie: t2, json: { alias: 'x' } });
  await call('client pin bad', { method: 'PATCH', url: `/api/clients/${c2}/pin`, cookie: t1, json: { pinned: 'yes' } });
  await call('client pin', { method: 'PATCH', url: `/api/clients/${c2}/pin`, cookie: t1, json: { pinned: true } });
  await call('client status bad', { method: 'PATCH', url: `/api/clients/${c2}/status`, cookie: t1, json: { status: 'x' } });
  await call('client status long reason', { method: 'PATCH', url: `/api/clients/${c2}/status`, cookie: t1, json: { status: 'inactive', reason: 'y'.repeat(201) } });
  await call('client status inactive (clears pin)', { method: 'PATCH', url: `/api/clients/${c2}/status`, cookie: t1, json: { status: 'inactive', reason: 'مهاجرت' } });
  await call('client status active', { method: 'PATCH', url: `/api/clients/${c2}/status`, cookie: t1, json: { status: 'active', reason: 'ignored' } });
  await call('client pin false', { method: 'PATCH', url: `/api/clients/${c2}/pin`, cookie: t1, json: { pinned: false } });
  await call('client category bad', { method: 'PATCH', url: `/api/clients/${c2}/category`, cookie: t1, json: { category: 'x' } });
  await call('client gender bad', { method: 'PATCH', url: `/api/clients/${c2}/category`, cookie: t1, json: { category: 'teen', gender: 'x' } });
  await call('client category teen', { method: 'PATCH', url: `/api/clients/${c2}/category`, cookie: t1, json: { category: 'teen', gender: 'f' } });
  await call('client category null', { method: 'PATCH', url: `/api/clients/${c4}/category`, cookie: t1, json: { category: null } });
  await call('client category foreign', { method: 'PATCH', url: `/api/clients/${c2}/category`, cookie: t2, json: { category: 'adult' } });
  await call('consent revoke none', { method: 'DELETE', url: `/api/clients/${c1}/recording-consent`, cookie: t1 });
  await call('consent revoke unknown', { method: 'DELETE', url: '/api/clients/00000000-0000-4000-8000-000000000000/recording-consent', cookie: t1 });

  // ——— E. sessions ———
  await call('session no auth', { method: 'POST', url: '/api/sessions', json: { client_id: c1 } });
  await call('session bad mode', { method: 'POST', url: '/api/sessions', cookie: t1, json: { client_id: c1, mode: 'x' } });
  await call('session bad date', { method: 'POST', url: '/api/sessions', cookie: t1, json: { client_id: c1, consent: true, date: '1405/13/40' } });
  await call('session bad time', { method: 'POST', url: '/api/sessions', cookie: t1, json: { client_id: c1, consent: true, start_time: '25:00' } });
  await call('session unknown client', { method: 'POST', url: '/api/sessions', cookie: t1, json: { client_id: '00000000-0000-4000-8000-000000000000', consent: true } });
  await call('session foreign client', { method: 'POST', url: '/api/sessions', cookie: t2, json: { client_id: c1, consent: true } });
  await call('session no consent', { method: 'POST', url: '/api/sessions', cookie: t1, json: { client_id: c1 } });
  await call('session inactive client', { method: 'POST', url: '/api/sessions', cookie: t1, json: { client_id: c3, consent: true } });
  const s1 = (await call('session S1 live consent', { method: 'POST', url: '/api/sessions', cookie: t1, json: { client_id: c1, consent: true, date: '۱۴۰۵-۷-۵', start_time: '۱۰:۳۰' } })).body.session.id;
  const s2 = (await call('session S2 live stored consent + defaults', { method: 'POST', url: '/api/sessions', cookie: t1, json: { client_id: c1 } })).body.session.id;
  const s3 = (await call('session S3 manual + note', { method: 'POST', url: '/api/sessions', cookie: t1, json: { client_id: c3, mode: 'manual', date: '2026-09-20', start_time: '09:05', note: '  یادداشتِ پس از جلسه  ' } })).body.session.id;
  const s4 = (await call('session S4 manual no date', { method: 'POST', url: '/api/sessions', cookie: t1, json: { client_id: c3, mode: 'manual' } })).body.session.id;
  const s5 = (await call('session S5 live (for delete)', { method: 'POST', url: '/api/sessions', cookie: t1, json: { client_id: c2, consent: true, date: '1405/07/01', start_time: '18:45' } })).body.session.id;
  // یادداشتِ پیش از جلسه (2026-09-29): pre_note ⇒ session_notes(note_before) در همان تراکنش؛ ستونِ sessions.pre_note نوشته نمی‌شود
  await call('session pre_note too long', { method: 'POST', url: '/api/sessions', cookie: t1, json: { client_id: c2, consent: true, pre_note: 'ا'.repeat(2001) } });
  const s6 = (await call('session S6 live with pre_note', { method: 'POST', url: '/api/sessions', cookie: t1, json: { client_id: c2, consent: true, date: '1405/07/02', start_time: '19:00', pre_note: '  توضیحِ پیش از جلسه  ' } })).body.session.id;
  {
    const r = (await query(`SELECT type, text, wall_clock FROM session_notes WHERE session_id = ?`, [s6])).rows as Array<{ type: string; text: string; wall_clock: string }>;
    const col = (await query(`SELECT pre_note FROM sessions WHERE id = ?`, [s6])).rows[0].pre_note;
    if (r.length !== 1 || r[0].type !== 'note_before' || r[0].text !== 'توضیحِ پیش از جلسه' || r[0].wall_clock !== '19:00' || col !== null) {
      throw new Error('pre_note must become one trimmed note_before row and leave sessions.pre_note NULL: ' + JSON.stringify({ r, col }));
    }
  }
  await call('session S6 delete', { method: 'DELETE', url: `/api/sessions/${s6}`, cookie: t1 });
  await call('session get', { method: 'GET', url: `/api/sessions/${s1}`, cookie: t1 });
  await call('session get unknown', { method: 'GET', url: '/api/sessions/00000000-0000-4000-8000-000000000000', cookie: t1 });
  await call('session get foreign', { method: 'GET', url: `/api/sessions/${s1}`, cookie: t2 });
  await call('put nothing', { method: 'PUT', url: `/api/sessions/${s1}`, cookie: t1, json: {} });
  await call('put transcript v0', { method: 'PUT', url: `/api/sessions/${s1}`, cookie: t1, json: { transcript: 'گوینده ۱: شروع', transcript_version: 0, stt_mode: 'realtime', realtime_reliable: true, anchors: [{ chars: 5, off: 100 }], duration_ms: 60000 } });
  await call('put transcript stale', { method: 'PUT', url: `/api/sessions/${s1}`, cookie: t1, json: { transcript: 'x', transcript_version: 0 } });
  await call('put transcript legacy (no version)', { method: 'PUT', url: `/api/sessions/${s1}`, cookie: t1, json: { transcript: 'گوینده ۱: شروع\n\nادامه' } });
  await call('put invalid status', { method: 'PUT', url: `/api/sessions/${s1}`, cookie: t1, json: { status: 'weird' } });
  await call('put clear date on live', { method: 'PUT', url: `/api/sessions/${s1}`, cookie: t1, json: { date: '' } });
  await call('put bad date', { method: 'PUT', url: `/api/sessions/${s1}`, cookie: t1, json: { date: 'x' } });
  await call('put bad time', { method: 'PUT', url: `/api/sessions/${s1}`, cookie: t1, json: { start_time: '7' } });
  await call('put date+time', { method: 'PUT', url: `/api/sessions/${s1}`, cookie: t1, json: { date: '1405/07/06', start_time: '9:05' } });
  await call('put clear date manual', { method: 'PUT', url: `/api/sessions/${s3}`, cookie: t1, json: { date: null } });
  await call('put foreign', { method: 'PUT', url: `/api/sessions/${s1}`, cookie: t2, json: { duration_ms: 1 } });
  await call('put recovered', { method: 'PUT', url: `/api/sessions/${s2}`, cookie: t1, json: { status: 'recovered' } });
  await call('recovered list', { method: 'GET', url: '/api/recovered', cookie: t1 });
  await call('put back in_progress', { method: 'PUT', url: `/api/sessions/${s2}`, cookie: t1, json: { status: 'in_progress' } });
  await call('put completed on manual → no-op transition', { method: 'PUT', url: `/api/sessions/${s3}`, cookie: t1, json: { status: 'completed' } });
  await call('put reopen completed (not auto) 409', { method: 'PUT', url: `/api/sessions/${s3}`, cookie: t1, json: { status: 'in_progress' } });
  // tail
  const v = Number((await query('SELECT transcript_version FROM sessions WHERE id = ?', [s1])).rows[0].transcript_version);
  await call('tail bad', { method: 'POST', url: `/api/sessions/${s1}/transcript-tail`, cookie: t1, json: { tail: 'x' } });
  await call('tail ok', { method: 'POST', url: `/api/sessions/${s1}/transcript-tail`, cookie: t1, json: { base_version: v, tail: '\n\nدُمِ متن' } });
  await call('tail stale', { method: 'POST', url: `/api/sessions/${s1}/transcript-tail`, cookie: t1, json: { base_version: v, tail: 'z' } });
  await call('tail foreign', { method: 'POST', url: `/api/sessions/${s1}/transcript-tail`, cookie: t2, json: { base_version: v, tail: 'z' } });
  // notes
  await call('note no type', { method: 'POST', url: `/api/sessions/${s1}/notes`, cookie: t1, json: { text: 'x' } });
  await call('note foreign', { method: 'POST', url: `/api/sessions/${s1}/notes`, cookie: t2, json: { type: 'sign' } });
  const nSign = (await call('note sign', { method: 'POST', url: `/api/sessions/${s1}/notes`, cookie: t1, json: { type: 'sign', sign_type: 'اضطراب', offset_ms: 5000, wall_clock: '10:31' } })).body.note.id;
  const nDel = (await call('note during', { method: 'POST', url: `/api/sessions/${s1}/notes`, cookie: t1, json: { type: 'note_during', text: 'یادداشت حین جلسه', offset_ms: 2000 } })).body.note.id;
  await sleep(1100); // یادداشتِ بدونِ offset با یادداشتِ ساختِ S3 در یک ثانیه ⇒ ترتیبِ created_at قطعی نیست
  await call('note after (completed session)', { method: 'POST', url: `/api/sessions/${s3}/notes`, cookie: t1, json: { type: 'note_after', text: 'یادداشتِ بعد' } });
  await call('note delete', { method: 'DELETE', url: `/api/notes/${nDel}`, cookie: t1 });
  await call('note delete again', { method: 'DELETE', url: `/api/notes/${nDel}`, cookie: t1 });
  // PATCH فقط برایِ note_before/voice_before و فقط مالک (غیرمالک/ناموجود ⇒ 404)
  const nBefore = (await call('note before', { method: 'POST', url: `/api/sessions/${s1}/notes`, cookie: t1, json: { type: 'note_before', text: 'یادداشتِ پیش از جلسه', wall_clock: '10:00' } })).body.note.id;
  await call('note patch no auth', { method: 'PATCH', url: `/api/notes/${nBefore}`, json: { text: 'x' } });
  await call('note patch foreign', { method: 'PATCH', url: `/api/notes/${nBefore}`, cookie: t2, json: { text: 'x' } });
  await call('note patch unknown', { method: 'PATCH', url: '/api/notes/00000000-0000-4000-8000-000000000000', cookie: t1, json: { text: 'x' } });
  await call('note patch empty', { method: 'PATCH', url: `/api/notes/${nBefore}`, cookie: t1, json: { text: '   ' } });
  await call('note patch not a string', { method: 'PATCH', url: `/api/notes/${nBefore}`, cookie: t1, json: { text: 5 } });
  await call('note patch too long', { method: 'PATCH', url: `/api/notes/${nBefore}`, cookie: t1, json: { text: 'ا'.repeat(20001) } });
  await call('note patch not editable (sign)', { method: 'PATCH', url: `/api/notes/${nSign}`, cookie: t1, json: { text: 'x' } });
  await call('note patch ok (trimmed)', { method: 'PATCH', url: `/api/notes/${nBefore}`, cookie: t1, json: { text: '  متنِ ویرایش‌شده  ' } });
  {
    const t = (await query(`SELECT text FROM session_notes WHERE id = ?`, [nBefore])).rows[0].text;
    if (t !== 'متنِ ویرایش‌شده') throw new Error('PATCH must store the trimmed text, got ' + JSON.stringify(t));
  }

  // voice-note (legacy مسیر، Soniox mock)
  await call('voice-note no file', { method: 'POST', url: `/api/sessions/${s1}/voice-note`, cookie: t1, headers: { 'content-type': 'multipart/form-data; boundary=x' }, body: '--x--\r\n' });
  await call('voice-note tiny', { method: 'POST', url: `/api/sessions/${s1}/voice-note`, cookie: t1, multipart: { field: 'audio', filename: 'n.webm', mime: 'audio/webm', data: Buffer.alloc(50) } });
  const before = mockCount(/^DELETE \/v1\/files/);
  await call('voice-note ok', { method: 'POST', url: `/api/sessions/${s1}/voice-note`, cookie: t1, multipart: { field: 'audio', filename: 'n.webm', mime: 'audio/webm', data: NOTE } });
  await waitFor('voice-note transcribed', () => mockCount(/^DELETE \/v1\/files/) > before);
  await waitFor('voice-note saved', async () => Number((await query(`SELECT COUNT(*) AS n FROM session_notes WHERE session_id = ? AND type = 'voice'`, [s1])).rows[0].n) === 1);
  await sleep(1100);

  // batch-audio
  const RUN_A = 'mujlrwm8ib138e';
  const RUN_B = 'mujls3vwiodici';
  const batch = (sid: string, q: string, data: Buffer, mime = 'audio/webm') =>
    ({ method: 'POST', url: `/api/sessions/${sid}/batch-audio${q}`, cookie: t1, multipart: { field: 'audio', filename: 'seg.webm', mime, data } });
  await call('batch no file', { method: 'POST', url: `/api/sessions/${s1}/batch-audio`, cookie: t1, headers: { 'content-type': 'multipart/form-data; boundary=x' }, body: '--x--\r\n' });
  await call('batch tiny', batch(s1, '', Buffer.alloc(40)));
  await call('batch foreign', { ...batch(s1, '', SEG0), cookie: t2 });
  await call('batch transcript on completed', batch(s3, '?purpose=transcript', SEG0));
  // آرشیو (بدونِ Soniox): دو سگمنت با ترتیبِ رسیدنِ معکوس
  await call('batch archive seq1', batch(s1, `?purpose=archive&seq=1&run=${RUN_A}`, SEG1));
  await waitFor('archive seq1', () => queueFilesFor(s1).length === 0);
  await call('batch archive seq0', batch(s1, `?purpose=archive&seq=0&run=${RUN_A}`, SEG0));
  await waitFor('archive seq0', () => queueFilesFor(s1).length === 0);
  await call('batch archive duplicate bytes', batch(s1, `?purpose=archive&seq=0&run=${RUN_A}`, SEG0));
  await waitFor('archive dup', () => queueFilesFor(s1).length === 0);
  await call('batch note-archive', batch(s1, `?purpose=note-archive&seq=0&run=${RUN_B}`, NOTE));
  await waitFor('note-archive', () => queueFilesFor(s1).length === 0);
  // (بایت‌هایِ SEG2، نه NOTE: آرشیو برایِ بایت‌هایِ یکسانِ یک جلسه idempotent است و NOTE پیش‌تر با note-archive آرشیو شده)
  // pre-note: آرشیو kind='prenote' + رونویسیِ بدونِ تفکیکِ گوینده ⇒ session_notes(voice_before)؛ هرگز 'voice' و هرگز transcript
  {
    const dPre = mockCount(/^DELETE \/v1\/files/);
    const voiceBefore = Number((await query(`SELECT COUNT(*) AS n FROM session_notes WHERE session_id = ? AND type = 'voice'`, [s1])).rows[0].n);
    const trBefore = (await query(`SELECT transcript, transcript_version FROM sessions WHERE id = ?`, [s1])).rows[0];
    await call('batch pre-note', batch(s1, '?purpose=pre-note&seq=0&run=pnHARNESS1', SEG2));
    await waitFor('batch pre-note', async () => mockCount(/^DELETE \/v1\/files/) > dPre && queueFilesFor(s1).length === 0 &&
      Number((await query(`SELECT COUNT(*) AS n FROM session_notes WHERE session_id = ? AND type = 'voice_before'`, [s1])).rows[0].n) === 1);
    const preTr = mockLog.filter((l) => l.startsWith('POST /v1/transcriptions ')).pop() || '';
    if (!preTr.includes('"enable_speaker_diarization":false')) throw new Error('pre-note must be transcribed without diarization: ' + preTr.slice(0, 220));
    const kinds = (await query(`SELECT kind, seq FROM session_audio WHERE session_id = ? AND kind = 'prenote'`, [s1])).rows;
    if (kinds.length !== 1) throw new Error('pre-note audio must be archived once with kind=prenote: ' + JSON.stringify(kinds));
    const voiceAfter = Number((await query(`SELECT COUNT(*) AS n FROM session_notes WHERE session_id = ? AND type = 'voice'`, [s1])).rows[0].n);
    const trAfter = (await query(`SELECT transcript, transcript_version FROM sessions WHERE id = ?`, [s1])).rows[0];
    if (voiceAfter !== voiceBefore) throw new Error('pre-note must not create a type=voice note');
    if (trAfter.transcript !== trBefore.transcript || trAfter.transcript_version !== trBefore.transcript_version) throw new Error('pre-note must never touch sessions.transcript');
    // نامِ فایلِ آرشیو پیشوند دارد و با فایلِ kindهایِ دیگر برخورد نمی‌کند (رفعِ بازنویسیِ 000000.webm)
    const paths = (await query(`SELECT path, kind FROM session_audio WHERE session_id = ?`, [s1])).rows as Array<{ path: string; kind: string }>;
    if (new Set(paths.map((x) => x.path)).size !== paths.length) throw new Error('two audio rows share one file path: ' + JSON.stringify(paths.map((x) => path.basename(x.path) + ':' + x.kind)));
    if (!paths.filter((x) => x.kind === 'prenote').every((x) => path.basename(x.path).startsWith('prenote-'))) throw new Error('prenote file must carry the kind prefix');
  }
  // transcript با placeholderِ درجا (A2)
  await call('put placeholder S2', { method: 'PUT', url: `/api/sessions/${s2}`, cookie: t1, json: { transcript: `قبل\n\n[⏳ بازه‌ی قطعیِ اینترنت — متن در حالِ بازیابی · #${RUN_B}:3]\n\nبعد` } });
  let d0 = mockCount(/^DELETE \/v1\/files/);
  await call('batch transcript S2 (placeholder)', batch(s2, `?purpose=transcript&seq=3&run=${RUN_B}`, SEG2));
  await waitFor('batch transcript S2', async () => mockCount(/^DELETE \/v1\/files/) > d0 && queueFilesFor(s2).length === 0 &&
    ['done', 'failed'].includes(String((await query('SELECT batch_status FROM sessions WHERE id = ?', [s2])).rows[0].batch_status)));
  await sleep(300);
  // transcript بدونِ placeholder ⇒ append با برچسب
  d0 = mockCount(/^DELETE \/v1\/files/);
  await call('batch transcript S2 (append)', batch(s2, `?purpose=transcript&seq=4&run=${RUN_B}`, SEG1, 'audio/webm;codecs=opus'));
  await waitFor('batch transcript S2 append', async () => mockCount(/^DELETE \/v1\/files/) > d0 && queueFilesFor(s2).length === 0 &&
    ['done', 'failed'].includes(String((await query('SELECT batch_status FROM sessions WHERE id = ?', [s2])).rows[0].batch_status)));
  await sleep(300);
  // سگمنتِ بدونِ هدرِ container ⇒ unrecoverable ⇒ failed (S5)
  await call('batch transcript bad container', batch(s5, `?purpose=transcript&seq=0&run=${RUN_A}`, BAD_CONTAINER));
  await waitFor('bad container', async () => queueFilesFor(s5).length === 0 &&
    String((await query('SELECT batch_status FROM sessions WHERE id = ?', [s5])).rows[0].batch_status) === 'failed');
  await sleep(1100);
  // یادداشتِ صوتیِ ناموفق (purpose=note) رویِ جلسه‌ی completed
  d0 = mockCount(/^DELETE \/v1\/files/);
  // run جدا از late-transcript: UNIQUE(session_id, run_id, seq) با seqِ per-kind در یک run تداخل دارد (FINDING، رفع نمی‌شود)
  await call('batch note on completed', batch(s3, `?purpose=note&seq=0&run=${RUN_B}`, NOTE));
  await waitFor('batch note', async () => mockCount(/^DELETE \/v1\/files/) > d0 && queueFilesFor(s3).length === 0);
  await sleep(1100);
  // late-transcript رویِ completed
  d0 = mockCount(/^DELETE \/v1\/files/);
  await call('batch late on completed', batch(s3, `?purpose=late-transcript&seq=1&run=${RUN_A}`, SEG2));
  await waitFor('batch late', async () => mockCount(/^DELETE \/v1\/files/) > d0 && queueFilesFor(s3).length === 0);
  await sleep(300);
  await call('batch-status S2', { method: 'GET', url: `/api/sessions/${s2}/batch-status`, cookie: t1 });
  await call('batch-status foreign', { method: 'GET', url: `/api/sessions/${s2}/batch-status`, cookie: t2 });
  await call('batch-retry nothing', { method: 'POST', url: `/api/sessions/${s2}/batch-retry`, cookie: t1 });
  await call('batch-retry note nothing', { method: 'POST', url: `/api/sessions/${s2}/batch-retry?purpose=note`, cookie: t1 });
  // retry با فایلِ در صف (نوشته‌شده توسطِ harness، مثلِ باقی‌مانده‌ی کرش)
  mkdirSync(queueDir, { recursive: true });
  writeFileSync(path.join(queueDir, `${s2}-000005-${RUN_B}-1700000000000.webm`), SEG0);
  await call('batch-status pending', { method: 'GET', url: `/api/sessions/${s2}/batch-status`, cookie: t1 });
  d0 = mockCount(/^DELETE \/v1\/files/);
  await call('batch-retry pending', { method: 'POST', url: `/api/sessions/${s2}/batch-retry`, cookie: t1 });
  await waitFor('batch-retry', async () => mockCount(/^DELETE \/v1\/files/) > d0 && queueFilesFor(s2).length === 0);
  await sleep(300);
  await call('session S2 after batch', { method: 'GET', url: `/api/sessions/${s2}`, cookie: t1 });
  await call('session S3 after note/late', { method: 'GET', url: `/api/sessions/${s3}`, cookie: t1 });

  // resolve-speakers
  await call('resolve on in_progress', { method: 'POST', url: `/api/sessions/${s2}/resolve-speakers`, cookie: t1 });
  await call('resolve get none', { method: 'GET', url: `/api/sessions/${s1}/resolve-speakers`, cookie: t1 });
  await call('resolve no audio', { method: 'POST', url: `/api/sessions/${s4}/resolve-speakers`, cookie: t1 });
  await call('complete S1', { method: 'PUT', url: `/api/sessions/${s1}`, cookie: t1, json: { status: 'completed', duration_ms: 5000 } });
  d0 = mockCount(/^DELETE \/v1\/files/);
  await call('resolve start', { method: 'POST', url: `/api/sessions/${s1}/resolve-speakers`, cookie: t1 });
  await waitFor('resolve job', () => mockCount(/^DELETE \/v1\/files/) > d0);
  await sleep(500);
  await call('resolve get done', { method: 'GET', url: `/api/sessions/${s1}/resolve-speakers`, cookie: t1 });
  await call('resolve get foreign', { method: 'GET', url: `/api/sessions/${s1}/resolve-speakers`, cookie: t2 });
  await call('session S1 full', { method: 'GET', url: `/api/sessions/${s1}`, cookie: t1 });
  await call('client C1 sessions', { method: 'GET', url: `/api/clients/${c1}`, cookie: t1 });

  // ——— F. stt ———
  await call('stt check no auth', { method: 'GET', url: '/api/stt/check' });
  await call('stt check', { method: 'GET', url: '/api/stt/check', cookie: t1 });
  await call('mint no session_id', { method: 'POST', url: '/api/stt/realtime-session', cookie: t1, json: {} });
  await call('mint unknown session', { method: 'POST', url: '/api/stt/realtime-session', cookie: t1, json: { session_id: '00000000-0000-4000-8000-000000000000' } });
  await call('mint completed transcript', { method: 'POST', url: '/api/stt/realtime-session', cookie: t1, json: { session_id: s1 } });
  await call('mint completed note', { method: 'POST', url: '/api/stt/realtime-session', cookie: t1, json: { session_id: s1, purpose: 'note' } });
  await call('mint in_progress', { method: 'POST', url: '/api/stt/realtime-session', cookie: t1, json: { session_id: s2 } });
  await query(`UPDATE sessions SET status = 'completed', auto_closed_at = NOW() WHERE id = ?`, [s5]);
  await call('mint reopens auto-closed', { method: 'POST', url: '/api/stt/realtime-session', cookie: t1, json: { session_id: s5 } });
  await query(`UPDATE sessions SET status = 'completed', auto_closed_at = NOW() WHERE id = ?`, [s5]);
  await call('put reopens auto-closed', { method: 'PUT', url: `/api/sessions/${s5}`, cookie: t1, json: { status: 'in_progress' } });
  for (let i = 0; i < 28; i++) {
    const r = await app.inject({ method: 'POST', url: '/api/stt/realtime-session', headers: { cookie: `feelia_session=${t1}`, 'content-type': 'application/json' }, payload: JSON.stringify({ session_id: s2 }) });
    if (r.statusCode !== 200) { emit({ step: 'mint loop', i, status: r.statusCode }); break; }
  }
  await call('mint rate-limited', { method: 'POST', url: '/api/stt/realtime-session', cookie: t1, json: { session_id: s2 } });

  // ——— G. obs events ———
  const NAV = '22222222-bbbb-4bbb-8bbb-000000000001';
  mapId(NAV);
  await call('obs no auth', { method: 'POST', url: '/api/obs/events', json: { events: [] } });
  await call('obs empty', { method: 'POST', url: '/api/obs/events', cookie: t1, json: { events: [] } });
  await call('obs too many', { method: 'POST', url: '/api/obs/events', cookie: t1, json: { events: Array.from({ length: 201 }, () => ({})) } });
  await call('obs batch', { method: 'POST', url: '/api/obs/events', cookie: t1, json: { events: [
    { nav_id: NAV, seq: 1, kind: 'click', screen: 'session', session_id: s2, target_id: 'btnEndSession', target_role: 'button', target_tag: 'BUTTON', ts: Date.now() },
    { nav_id: NAV, seq: 2, kind: 'visibility', screen: 'session', session_id: s2, target_id: 'hidden', ts: Date.now() + 99 * 86400000 },
    { nav_id: NAV, seq: 3, kind: 'nav', screen: 'متنِ فارسی', target_id: 'متن', session_id: s5 },
    { nav_id: NAV, seq: 4, kind: 'bogus' },
    { nav_id: 'not-a-uuid', seq: 5, kind: 'click' },
    { nav_id: NAV, kind: 'client_event', event: 'rt.ws_open', session_id: s2, run_id: RUN_B, detail: { attempt: 1, text: 'secret' } },
    { nav_id: NAV, kind: 'client_event', event: 'not.allowed', session_id: s2 },
    { nav_id: NAV, seq: 6, kind: 'click', session_id: c5 },
  ] } });
  await sleep(300);
  for (let i = 0; i < 17; i++) {
    await app.inject({ method: 'POST', url: '/api/obs/events', headers: { cookie: `feelia_session=${t1}`, 'content-type': 'application/json' }, payload: JSON.stringify({ events: [{ nav_id: NAV, seq: 100 + i, kind: 'net' }] }) });
  }
  await call('obs rate-limited', { method: 'POST', url: '/api/obs/events', cookie: t1, json: { events: [{ nav_id: NAV, seq: 999, kind: 'net' }] } });
  await sleep(300);

  // ——— H. case-file ———
  await call('case-file no access (t2)', { method: 'GET', url: `/api/clients/${c5}/case-file`, cookie: t2 });
  await call('case-file get none', { method: 'GET', url: `/api/clients/${c1}/case-file`, cookie: t1 });
  await call('case-file get unknown client', { method: 'GET', url: '/api/clients/00000000-0000-4000-8000-000000000000/case-file', cookie: t1 });
  await call('regenerate force no phrase', { method: 'POST', url: `/api/clients/${c1}/case-file/regenerate`, cookie: t1, json: { force: true } });
  await call('regenerate unknown client', { method: 'POST', url: '/api/clients/00000000-0000-4000-8000-000000000000/case-file/regenerate', cookie: t1, json: {} });
  await call('regenerate no llm key', { method: 'POST', url: `/api/clients/${c1}/case-file/regenerate`, cookie: t1, json: {} });
  await call('case-file patch missing', { method: 'PATCH', url: `/api/clients/${c1}/case-file`, cookie: t1, json: {} });
  await call('case-file patch no record', { method: 'PATCH', url: `/api/clients/${c1}/case-file`, cookie: t1, json: { fieldId: 'identity', action: 'edit', value: 'x' } });
  await call('case-file upgrade no record', { method: 'POST', url: `/api/clients/${c1}/case-file/upgrade`, cookie: t1 });
  const F = (value = '', pending = !value) => ({ value, source: 'ai', reviewedByTherapist: false, suggestedUpdate: null, pending });
  const content = {
    identity: F('زنِ ۳۴ ساله'), mainIssue: F('اضطراب'), overallStatus: F(), safetyRisk: F(), sensitiveContext: F(),
    medication: [{ id: 'med-ghost', name: '  ', dose: F(), frequency: F(), lastChange: F(), prescriber: F() }],
    axes: [{ id: 'axis-1', title: 'خواب', statusTone: 'watch', sensitiveDoNotDiscussInFrontOfClient: false, ...F('بی‌خوابی') }],
    familyRelationship: { title: 'خانواده', fields: [] }, coupleRelationship: null,
    changeOverTime: { before: F(), after: F() }, sessionsSummary: [],
    roadmap: [{ id: 'rm-ai', priority: 'p2', question: 'گامِ AI', why: '', detail: F() }],
    pendingQuestions: [{ id: 'q-1', question: 'سؤالِ باز؟', relatedAxis: null, answer: 'پاسخِ قدیمی' }],
  };
  await query(`INSERT INTO client_case_file (client_id, content, status, model, content_version) VALUES (?, ?, 'ready', 'fixture-model', 1)`, [c2, JSON.stringify(content)]);
  await call('case-file get record', { method: 'GET', url: `/api/clients/${c2}/case-file`, cookie: t1 });
  await call('case-file patch edit identity', { method: 'PATCH', url: `/api/clients/${c2}/case-file`, cookie: t1, json: { fieldId: 'identity', action: 'edit', value: 'زنِ ۳۵ ساله' } });
  await call('case-file patch approve axis', { method: 'PATCH', url: `/api/clients/${c2}/case-file`, cookie: t1, json: { fieldId: 'axis.axis-1', action: 'approve' } });
  await call('case-file patch bad field', { method: 'PATCH', url: `/api/clients/${c2}/case-file`, cookie: t1, json: { fieldId: 'nope.x', action: 'edit', value: 'x' } });
  const added = await call('case-file add roadmap', { method: 'POST', url: `/api/clients/${c2}/case-file/items`, cookie: t1, json: { kind: 'roadmap', priority: 'p2', question: 'گامِ دستی', why: 'چرا' } });
  const rmId = (added.body?.case_file?.content?.roadmap || []).find((x: any) => x.addedByTherapist)?.id;
  if (rmId) mapId(rmId);
  await call('case-file add bad kind', { method: 'POST', url: `/api/clients/${c2}/case-file/items`, cookie: t1, json: { kind: 'x' } });
  await call('case-file delete ai item', { method: 'DELETE', url: `/api/clients/${c2}/case-file/items/roadmap/rm-ai`, cookie: t1 });
  await call('case-file delete manual item', { method: 'DELETE', url: `/api/clients/${c2}/case-file/items/roadmap/${rmId}`, cookie: t1 });
  await call('case-file upgrade', { method: 'POST', url: `/api/clients/${c2}/case-file/upgrade`, cookie: t1 });

  // ——— I. uploads ———
  const up = (json: any, cookie: string | null = t1) => ({ method: 'POST', url: '/api/uploads', cookie, json });
  const base = { client_id: c1, file_name: 'جلسه.ogg', size: UP1.length, mime: 'audio/ogg', fingerprint: sha(UP1), session_date: '1405/07/04' };
  await call('upload no auth', up(base, null));
  await call('upload too small', up({ ...base, size: 10 }));
  await call('upload too large', up({ ...base, size: 2 * 1024 * 1024 * 1024 }));
  await call('upload bad format', up({ ...base, file_name: 'x.pdf', mime: 'application/pdf' }));
  await call('upload mime ok no ext', up({ ...base, file_name: 'x', mime: 'audio/x-weird', fingerprint: 'zz' }));
  await call('upload bad fingerprint', up({ ...base, fingerprint: 'nothex' }));
  await call('upload bad part', up({ ...base, group_id: 'x', part_index: 0, parts_total: 2 }));
  await call('upload bad client', up({ ...base, client_id: 'x' }));
  await call('upload foreign client', up(base, t2));
  await call('upload no consent', up({ ...base, client_id: c4 }));
  await call('upload bad date', up({ ...base, session_date: '1405/99/99' }));
  const u1 = (await call('upload create', up(base))).body.upload;
  await call('upload resume', up(base));
  await call('upload get', { method: 'GET', url: `/api/uploads/${u1.id}`, cookie: t1 });
  await call('upload get foreign', { method: 'GET', url: `/api/uploads/${u1.id}`, cookie: t2 });
  await call('upload get bad id', { method: 'GET', url: '/api/uploads/xyz', cookie: t1 });
  const chunk = (id: string, n: number | string, data: Buffer, shaHdr?: string) =>
    ({ method: 'PUT', url: `/api/uploads/${id}/chunks/${n}`, cookie: t1, body: data, headers: { 'content-type': 'application/octet-stream', ...(shaHdr ? { 'x-chunk-sha256': shaHdr } : {}) } });
  await call('complete missing chunks', { method: 'POST', url: `/api/uploads/${u1.id}/complete`, cookie: t1 });
  await call('chunk bad index', chunk(u1.id, 5, UP1));
  await call('chunk bad size', chunk(u1.id, 0, UP1.subarray(1)));
  await call('chunk corrupt', chunk(u1.id, 0, UP1, 'a'.repeat(64)));
  await call('chunk ok', chunk(u1.id, 0, UP1, sha(UP1)));
  await call('chunk ok again (idempotent)', chunk(u1.id, 0, UP1));
  // jobِ fixture بلافاصله قفل می‌شود؛ jobی که workerِ دیگری claim کرده leaseِ ۲۰دقیقه‌ای دارد (نه ۱ روز) ⇒ abort.
  const lockJobs = async (label: string) => {
    const r = await query(`UPDATE audio_jobs SET locked_until = NOW() + INTERVAL 1 DAY WHERE therapist_id = ? AND locked_until IS NULL AND stage NOT IN ('done','failed')`, [T1]);
    const foreign = await query(`SELECT COUNT(*) AS n FROM audio_jobs WHERE therapist_id = ? AND stage NOT IN ('done','failed')
      AND (locked_until IS NULL OR locked_until < NOW() + INTERVAL 23 HOUR)`, [T1]);
    emit({ step: 'lock jobs: ' + label, locked: r.rowCount });
    if (Number(foreign.rows[0].n) > 0) throw new Error('a fixture audio job was picked up by another worker — abort');
  };
  const done1 = await call('complete ok', { method: 'POST', url: `/api/uploads/${u1.id}/complete`, cookie: t1 });
  await lockJobs('after single complete');
  const job1 = done1.body.job.id;
  const us1 = done1.body.upload.session_id;
  await call('complete again', { method: 'POST', url: `/api/uploads/${u1.id}/complete`, cookie: t1 });
  await call('chunk after complete', chunk(u1.id, 0, UP1));
  await call('upload duplicate', up(base));
  await call('jobs recent', { method: 'GET', url: '/api/audio-jobs', cookie: t1 });
  await call('jobs active', { method: 'GET', url: '/api/audio-jobs?scope=active', cookie: t1 });
  await call('job get', { method: 'GET', url: `/api/audio-jobs/${job1}`, cookie: t1 });
  await call('job get bad id', { method: 'GET', url: '/api/audio-jobs/x', cookie: t1 });
  await call('job get foreign', { method: 'GET', url: `/api/audio-jobs/${job1}`, cookie: t2 });
  await call('job retry not failed', { method: 'POST', url: `/api/audio-jobs/${job1}/retry`, cookie: t1 });
  await call('session audio-job', { method: 'GET', url: `/api/sessions/${us1}/audio-job`, cookie: t1 });
  await call('session audio-job foreign', { method: 'GET', url: `/api/sessions/${us1}/audio-job`, cookie: t2 });
  await query(`UPDATE audio_jobs SET stage = 'failed', error_code = 'unreadable', finished_at = NOW() WHERE id = ?`, [job1]);
  await call('job retry dead code', { method: 'POST', url: `/api/audio-jobs/${job1}/retry`, cookie: t1 });
  await query(`UPDATE audio_jobs SET error_code = 'soniox-failed' WHERE id = ?`, [job1]);
  await query(`INSERT INTO notifications (id, therapist_id, kind, client_id, session_id, job_id, error_code, created_at)
               VALUES ('33333333-cccc-4ccc-8ccc-000000000001', ?, 'processing_failed', ?, ?, ?, 'soniox-failed', NOW() - INTERVAL 50 SECOND)`, [T1, c1, us1, job1]);
  mapId('33333333-cccc-4ccc-8ccc-000000000001');
  await call('job retry requeue', { method: 'POST', url: `/api/audio-jobs/${job1}/retry`, cookie: t1 });
  await lockJobs('after retry');
  await query(`UPDATE audio_jobs SET stage = 'failed', error_code = 'soniox-failed', finished_at = NOW(), locked_until = NULL WHERE id = ?`, [job1]);
  await call('upload duplicate (failed ⇒ requeue)', up(base));
  await lockJobs('after duplicate requeue');
  await query(`UPDATE audio_jobs SET stage = 'failed', error_code = 'soniox-failed', finished_at = NOW() WHERE id = ?`, [job1]);
  rmSync(path.join(WORKDIR, 'data', 'uploads', u1.id), { recursive: true, force: true });
  await call('job retry audio expired', { method: 'POST', url: `/api/audio-jobs/${job1}/retry`, cookie: t1 });
  await sleep(1100);
  // not-audio
  const bad = (await call('upload not-audio create', up({ ...base, file_name: 'x.mp3', size: NOT_AUDIO.length, mime: 'audio/mpeg', fingerprint: sha(NOT_AUDIO) }))).body.upload;
  await call('upload not-audio chunk', chunk(bad.id, 0, NOT_AUDIO));
  await call('upload not-audio complete', { method: 'POST', url: `/api/uploads/${bad.id}/complete`, cookie: t1 });
  // لغو
  const cz = (await call('upload for cancel', up({ ...base, file_name: 'c.mp3', size: UP2A.length, mime: 'audio/mpeg', fingerprint: sha(UP2A) }))).body.upload;
  await call('upload cancel', { method: 'DELETE', url: `/api/uploads/${cz.id}`, cookie: t1 });
  await call('upload cancel again', { method: 'DELETE', url: `/api/uploads/${cz.id}`, cookie: t1 });
  await call('upload cancel foreign', { method: 'DELETE', url: `/api/uploads/${cz.id}`, cookie: t2 });
  // چندبخشی
  const G = '44444444-dddd-4ddd-8ddd-000000000001';
  const G2 = '44444444-dddd-4ddd-8ddd-000000000002';
  mapId(G); mapId(G2);
  const part = (i: number, data: Buffer, group = G) => up({ ...base, file_name: `part${i}.mp3`, size: data.length, mime: 'audio/mpeg', fingerprint: sha(data), group_id: group, part_index: i, parts_total: 2 });
  const p0 = (await call('group part0 create', part(0, UP2A))).body.upload;
  await call('group part0 resume', part(0, UP2A));
  await call('group part0 mismatch', part(0, UP2B));
  await call('group part0 chunk', chunk(p0.id, 0, UP2A));
  await call('group part0 complete', { method: 'POST', url: `/api/uploads/${p0.id}/complete`, cookie: t1 });
  await call('group part0 recheck (waiting)', part(0, UP2A));
  const p1 = (await call('group part1 create', part(1, UP2B))).body.upload;
  await call('group part1 chunk', chunk(p1.id, 0, UP2B));
  await call('group part1 complete (creates session)', { method: 'POST', url: `/api/uploads/${p1.id}/complete`, cookie: t1 });
  await lockJobs('after group complete');
  await call('group part0 after session', part(0, UP2A));
  await call('group cancel closed', { method: 'DELETE', url: `/api/upload-groups/${G}`, cookie: t1 });
  const q0 = (await call('group2 part0 create', part(0, UP2A, G2))).body.upload;
  await call('group2 cancel', { method: 'DELETE', url: `/api/upload-groups/${G2}`, cookie: t1 });
  await call('group2 part0 after cancel', part(0, UP2A, G2));
  await call('group cancel bad id', { method: 'DELETE', url: '/api/upload-groups/x', cookie: t1 });
  await call('upload get canceled', { method: 'GET', url: `/api/uploads/${q0.id}`, cookie: t1 });
  await call('jobs recent (after group)', { method: 'GET', url: '/api/audio-jobs', cookie: t1 });

  // ——— J. notifications ———
  await query(`INSERT INTO notifications (id, therapist_id, kind, client_id, session_id, job_id, created_at)
               VALUES ('33333333-cccc-4ccc-8ccc-000000000002', ?, 'transcript_ready', ?, ?, NULL, NOW() - INTERVAL 40 SECOND),
                      ('33333333-cccc-4ccc-8ccc-000000000003', ?, 'case_file_updated', ?, NULL, NULL, NOW() - INTERVAL 30 SECOND)`, [T1, c1, us1, T1, c2]);
  mapId('33333333-cccc-4ccc-8ccc-000000000002'); mapId('33333333-cccc-4ccc-8ccc-000000000003');
  await call('notifications no auth', { method: 'GET', url: '/api/notifications' });
  await call('notifications list', { method: 'GET', url: '/api/notifications', cookie: t1 });
  await call('notifications read ids', { method: 'POST', url: '/api/notifications/read', cookie: t1, json: { ids: ['33333333-cccc-4ccc-8ccc-000000000002', 'bad'] } });
  await call('notifications read nothing', { method: 'POST', url: '/api/notifications/read', cookie: t1, json: {} });
  await call('notifications read octet-stream body', { method: 'POST', url: '/api/notifications/read', cookie: t1, body: Buffer.from('{"all":true}'), headers: { 'content-type': 'application/octet-stream' } });
  await call('notifications after', { method: 'GET', url: '/api/notifications', cookie: t1 });
  await call('notifications read all', { method: 'POST', url: '/api/notifications/read', cookie: t1, json: { all: true } });
  await call('notifications final', { method: 'GET', url: '/api/notifications', cookie: t1 });
  await call('octet-stream on json route (clients)', { method: 'POST', url: '/api/clients', cookie: t1, body: Buffer.from('{}'), headers: { 'content-type': 'application/octet-stream' } });

  // ——— J2. واحدِ درمان (treatment-unit) ———
  await call('tu catalog no auth', { method: 'GET', url: '/api/catalog/treatment-units' });
  const cat = await call('tu catalog', { method: 'GET', url: '/api/catalog/treatment-units', cookie: t1 });
  await call('tu unit get', { method: 'GET', url: `/api/clients/${c1}/unit`, cookie: t1 });
  await call('tu unit get foreign', { method: 'GET', url: `/api/clients/${c1}/unit`, cookie: t2 });
  await call('tu unit put invalid type', { method: 'PUT', url: `/api/clients/${c4}/unit`, cookie: t1, json: { unit_type: 'nope', members: [] } });
  await call('tu unit put bad count', { method: 'PUT', url: `/api/clients/${c4}/unit`, cookie: t1, json: { unit_type: 'couple', members: [{ role: 'partner_f' }] } });
  await call('tu unit put bad role', { method: 'PUT', url: `/api/clients/${c4}/unit`, cookie: t1, json: { unit_type: 'couple', members: [{ role: 'son' }, { role: 'partner_m' }] } });
  await call('tu unit put couple', { method: 'PUT', url: `/api/clients/${c4}/unit`, cookie: t1, json: { unit_type: 'couple', members: [{ role: 'partner_f', alias: 'الف' }, { role: 'partner_m', alias: 'ب' }] } });
  await call('tu unit get couple', { method: 'GET', url: `/api/clients/${c4}/unit`, cookie: t1 }, { canonicalLists: [] });
  await call('tu unit put back individual', { method: 'PUT', url: `/api/clients/${c4}/unit`, cookie: t1, json: { unit_type: 'individual', members: [{ role: 'client' }] } });
  await call('tu modalities get', { method: 'GET', url: '/api/therapist/modalities', cookie: t1 });
  await call('tu modalities bad', { method: 'PUT', url: '/api/therapist/modalities', cookie: t1, json: { modalities: ['no-such-modality'] } });
  const firstModality = cat.body?.modalities?.[0]?.code;
  await call('tu modalities set', { method: 'PUT', url: '/api/therapist/modalities', cookie: t1, json: { modalities: firstModality ? [firstModality] : [] } });
  await call('tu modalities get after', { method: 'GET', url: '/api/therapist/modalities', cookie: t1 });

  // ——— J3. متنِ نهایی (final-transcript) — ردیفِ done مستقیم (هیچ ردیفِ صف‌شده‌ای ساخته نمی‌شود تا workerِ سرورِ dev آن را برندارد) ———
  await call('ft get disabled', { method: 'GET', url: `/api/sessions/${s1}/final-transcript`, cookie: t1 });
  await call('ft get foreign', { method: 'GET', url: `/api/sessions/${s1}/final-transcript`, cookie: t2 });
  await call('ft retry disabled (completed)', { method: 'POST', url: `/api/sessions/${s1}/final-transcript/retry`, cookie: t1 });
  await call('ft retry not completed', { method: 'POST', url: `/api/sessions/${s2}/final-transcript/retry`, cookie: t1 });
  await call('ft roles no row', { method: 'PATCH', url: `/api/sessions/${s1}/final-transcript/roles`, cookie: t1, json: { indices: [0], role: 'مراجع' } });
  await query(`UPDATE therapists SET final_transcript_enabled = 1 WHERE id = ?`, [T1]);
  const turns = [
    { role: 'درمانگر', text: 'سلام، امروز چطورید؟', raw: 'سلام امروز چطورید', sp: '1' },
    { role: 'مراجع', text: 'بهترم.', raw: 'بهترم', sp: '2' },
    { role: 'درمانگر', text: 'خوب است.', raw: 'خوب است', sp: '1' },
  ];
  const s1v = Number((await query('SELECT transcript_version FROM sessions WHERE id = ?', [s1])).rows[0].transcript_version);
  await query(`INSERT INTO final_transcripts (session_id, therapist_id, client_id, stage, source, source_version, clean_text, clean_turns, polish_report, finished_at)
               VALUES (?, ?, ?, 'done', 'async', ?, ?, ?, ?, NOW())`,
    [s1, T1, c1, s1v, 'درمانگر: سلام، امروز چطورید؟\n\nمراجع: بهترم.\n\nدرمانگر: خوب است.', JSON.stringify(turns), JSON.stringify({ chunks: 1, fallback_chunks: 0, turns: 3, fallback_turns: 0, uncertain: 0 })]);
  await call('ft get done', { method: 'GET', url: `/api/sessions/${s1}/final-transcript`, cookie: t1 });
  await call('ft roles bad role', { method: 'PATCH', url: `/api/sessions/${s1}/final-transcript/roles`, cookie: t1, json: { indices: [0], role: 'غریبه' } });
  await call('ft roles bad index', { method: 'PATCH', url: `/api/sessions/${s1}/final-transcript/roles`, cookie: t1, json: { indices: [9], role: 'مراجع' } });
  await call('ft roles turn', { method: 'PATCH', url: `/api/sessions/${s1}/final-transcript/roles`, cookie: t1, json: { indices: [1], role: 'درمانگر' } });
  await call('ft roles same speaker', { method: 'PATCH', url: `/api/sessions/${s1}/final-transcript/roles`, cookie: t1, json: { indices: [0], role: 'مراجع', same_speaker: true } });
  await call('ft roles no change', { method: 'PATCH', url: `/api/sessions/${s1}/final-transcript/roles`, cookie: t1, json: { indices: [0], role: 'مراجع' } });
  await call('ft retry fresh', { method: 'POST', url: `/api/sessions/${s1}/final-transcript/retry`, cookie: t1 });
  await call('me t1 (final transcript on)', { method: 'GET', url: '/api/auth/me', cookie: t1 });
  await query(`UPDATE therapists SET final_transcript_enabled = 0 WHERE id = ?`, [T1]);

  await dbSnapshot('after therapist flows', { therapists: fixtureTherapists });

  // ——— K. admin ———
  await call('admin no auth', { method: 'GET', url: '/api/admin/stats' });
  await call('admin non-admin', { method: 'GET', url: '/api/admin/stats', cookie: t1 });
  await call('admin stats', { method: 'GET', url: '/api/admin/stats', cookie: ad }, { shapeOnly: true });
  await call('admin therapists q', { method: 'GET', url: `/api/admin/therapists?q=${PHONE_PREFIX}`, cookie: ad });
  await call('admin therapist clients', { method: 'GET', url: `/api/admin/therapists/${T1}/clients`, cookie: ad });
  await call('admin therapist clients unknown', { method: 'GET', url: '/api/admin/therapists/00000000-0000-4000-8000-000000000000/clients', cookie: ad });
  await call('admin client sessions', { method: 'GET', url: `/api/admin/clients/${c1}/sessions`, cookie: ad });
  await call('admin client sessions unknown', { method: 'GET', url: '/api/admin/clients/00000000-0000-4000-8000-000000000000/sessions', cookie: ad });
  await call('admin session', { method: 'GET', url: `/api/admin/sessions/${s1}`, cookie: ad });
  await call('admin session unknown', { method: 'GET', url: '/api/admin/sessions/00000000-0000-4000-8000-000000000000', cookie: ad });
  await call('admin session audio', { method: 'GET', url: `/api/admin/sessions/${s1}/audio`, cookie: ad });
  await call('admin session audio unknown', { method: 'GET', url: '/api/admin/sessions/00000000-0000-4000-8000-000000000000/audio', cookie: ad });
  await call('admin audio full', { method: 'GET', url: `/api/admin/sessions/${s1}/audio/full`, cookie: ad }, { binary: true });
  await call('admin audio full range', { method: 'GET', url: `/api/admin/sessions/${s1}/audio/full`, cookie: ad, headers: { range: 'bytes=10-99' } }, { binary: true });
  await call('admin audio full suffix range', { method: 'GET', url: `/api/admin/sessions/${s1}/audio/full`, cookie: ad, headers: { range: 'bytes=-50' } }, { binary: true });
  await call('admin audio full 416', { method: 'GET', url: `/api/admin/sessions/${s1}/audio/full`, cookie: ad, headers: { range: 'bytes=99999999-' } }, { binary: true });
  await call('admin audio full download', { method: 'GET', url: `/api/admin/sessions/${s1}/audio/full?download=1`, cookie: ad }, { binary: true });
  await call('admin audio full no audio', { method: 'GET', url: `/api/admin/sessions/${s4}/audio/full`, cookie: ad });
  await call('admin audio full unknown', { method: 'GET', url: '/api/admin/sessions/00000000-0000-4000-8000-000000000000/audio/full', cookie: ad });
  const audioRows = (await query(`SELECT id, kind, seq FROM session_audio WHERE session_id = ? ORDER BY kind, seq`, [s1])).rows as any[];
  for (const a of audioRows) mapId(a.id);
  const seg = audioRows.find((a) => a.kind === 'session')!.id;
  await call('admin stream', { method: 'GET', url: `/api/admin/session-audio/${seg}/stream`, cookie: ad }, { binary: true });
  await call('admin stream range', { method: 'GET', url: `/api/admin/session-audio/${seg}/stream`, cookie: ad, headers: { range: 'bytes=0-9' } }, { binary: true });
  await call('admin stream scrub range', { method: 'GET', url: `/api/admin/session-audio/${seg}/stream`, cookie: ad, headers: { range: 'bytes=20-' } }, { binary: true });
  await call('admin stream 416', { method: 'GET', url: `/api/admin/session-audio/${seg}/stream`, cookie: ad, headers: { range: 'bytes=5-2' } }, { binary: true });
  await call('admin stream download', { method: 'GET', url: `/api/admin/session-audio/${seg}/stream?download=1`, cookie: ad }, { binary: true });
  await call('admin stream unknown', { method: 'GET', url: '/api/admin/session-audio/00000000-0000-4000-8000-000000000000/stream', cookie: ad });
  await call('admin export therapist', { method: 'GET', url: `/api/admin/therapists/${T1}/export`, cookie: ad });
  await call('admin export therapist unknown', { method: 'GET', url: '/api/admin/therapists/00000000-0000-4000-8000-000000000000/export', cookie: ad });
  await call('admin export full (fixtures only)', { method: 'GET', url: '/api/admin/export', cookie: ad }, {
    filter: (b) => ({ exported_at: b.exported_at, therapists_is_array: Array.isArray(b.therapists), fixtures: (b.therapists || []).filter((x: any) => fixtureTherapists.includes(x.therapist.id)).sort((x: any, y: any) => (x.therapist.phone < y.therapist.phone ? -1 : 1)) }),
  });
  await call('admin audio-archive', { method: 'GET', url: `/api/admin/audio-archive?therapist_id=${T1}`, cookie: ad }, { canonicalLists: ['items'] });
  await call('admin audio-archive client+dates', { method: 'GET', url: `/api/admin/audio-archive?therapist_id=${T1}&client_id=${c1}&from=2020-01-01&to=2099-01-01&limit=1`, cookie: ad });
  await call('admin audio-archive bad filters', { method: 'GET', url: `/api/admin/audio-archive?therapist_id=${T1}&client_id=nope&from=x&limit=500&offset=-4`, cookie: ad }, { canonicalLists: ['items'] });
  await call('admin voice-notes', { method: 'GET', url: `/api/admin/voice-notes?therapist_id=${T1}`, cookie: ad }, { canonicalLists: ['items'] });
  await call('admin voice-notes empty', { method: 'GET', url: `/api/admin/voice-notes?therapist_id=${T2}`, cookie: ad });
  const vn = (await query(`SELECT id FROM session_notes WHERE session_id = ? AND type = 'voice'`, [s1])).rows[0].id;
  mapId(vn);
  await call('admin voice-note text', { method: 'GET', url: `/api/admin/voice-notes/${vn}/text`, cookie: ad });
  await call('admin voice-note text unknown', { method: 'GET', url: '/api/admin/voice-notes/00000000-0000-4000-8000-000000000000/text', cookie: ad });
  await call('admin sessions recent', { method: 'GET', url: `/api/admin/sessions/recent?therapist_id=${T1}&status=all&since_hours=5`, cookie: ad }, { canonicalLists: ['sessions'] });
  await call('admin sessions recent in_progress', { method: 'GET', url: `/api/admin/sessions/recent?therapist_id=${T1}`, cookie: ad }, { canonicalLists: ['sessions'] });
  await call('admin sessions recent has_transcript', { method: 'GET', url: `/api/admin/sessions/recent?therapist_id=${T1}&status=all&has_transcript=true&limit=3&offset=0`, cookie: ad }, { canonicalLists: ['sessions'] });
  await flushObsQueue();
  await call('admin diagnosis S2', { method: 'GET', url: `/api/admin/sessions/${s2}/diagnosis`, cookie: ad }, { obs: true });
  await call('admin diagnosis S1', { method: 'GET', url: `/api/admin/sessions/${s1}/diagnosis`, cookie: ad }, { obs: true });
  await call('admin diagnosis unknown', { method: 'GET', url: '/api/admin/sessions/00000000-0000-4000-8000-000000000000/diagnosis', cookie: ad });
  await call('admin timeline S2', { method: 'GET', url: `/api/admin/sessions/${s2}/timeline`, cookie: ad }, { obs: true, canonicalLists: ['timeline'] });
  await call('admin timeline unknown', { method: 'GET', url: '/api/admin/sessions/00000000-0000-4000-8000-000000000000/timeline', cookie: ad });
  await call('admin obs events (session S2)', { method: 'GET', url: `/api/admin/obs/events?session_id=${s2}&limit=500`, cookie: ad }, { obs: true, canonicalLists: ['events'], filter: (b) => ({ events: b.events.map((e: any) => ({ ...e, id: '<n>' })) }) });
  await call('admin obs events filters', { method: 'GET', url: `/api/admin/obs/events?therapist_id=${T2}&event=auth.login_ok&severity=info&source=server&from=2020-01-01&to=2099-01-01&limit=5`, cookie: ad }, { obs: true, canonicalLists: ['events'], filter: (b) => ({ events: b.events.map((e: any) => ({ ...e, id: '<n>' })) }) });
  await call('admin obs ui-events', { method: 'GET', url: `/api/admin/obs/ui-events?therapist_id=${T1}&nav_id=${NAV}&limit=500`, cookie: ad }, { obs: true, canonicalLists: ['events'], filter: (b) => ({ events: b.events.map((e: any) => ({ ...e, id: '<n>' })) }) });
  await call('admin obs ui-events kind', { method: 'GET', url: `/api/admin/obs/ui-events?session_id=${s2}&kind=click`, cookie: ad }, { obs: true, canonicalLists: ['events'], filter: (b) => ({ events: b.events.map((e: any) => ({ ...e, id: '<n>' })) }) });
  await call('admin obs stats', { method: 'GET', url: '/api/admin/obs/stats', cookie: ad }, { shapeOnly: true });
  // حذفِ صدا: با فایلِ در صف ⇒ 409؛ بعد موفق
  writeFileSync(path.join(queueDir, `${s1}-000009-${RUN_A}-1700000000001.webm`), SEG0);
  await call('admin delete audio pending', { method: 'DELETE', url: `/api/admin/sessions/${s1}/audio`, cookie: ad });
  rmSync(path.join(queueDir, `${s1}-000009-${RUN_A}-1700000000001.webm`), { force: true });
  await call('admin delete audio', { method: 'DELETE', url: `/api/admin/sessions/${s1}/audio`, cookie: ad });
  await call('admin delete audio unknown', { method: 'DELETE', url: '/api/admin/sessions/00000000-0000-4000-8000-000000000000/audio', cookie: ad });
  await call('admin session audio after delete', { method: 'GET', url: `/api/admin/sessions/${s1}/audio`, cookie: ad });
  // تراپیست‌ها
  await call('admin patch self inactive', { method: 'PATCH', url: `/api/admin/therapists/${ADMIN}`, cookie: ad, json: { active: false } });
  await call('admin patch nothing', { method: 'PATCH', url: `/api/admin/therapists/${T2}`, cookie: ad, json: {} });
  await call('admin patch unknown', { method: 'PATCH', url: '/api/admin/therapists/00000000-0000-4000-8000-000000000000', cookie: ad, json: { active: false } });
  await call('admin patch t2 inactive', { method: 'PATCH', url: `/api/admin/therapists/${T2}`, cookie: ad, json: { active: false, is_admin: false } });
  await call('login inactive', { method: 'POST', url: '/api/auth/login', json: { phone: PHONE_T2, password: T2_PASSWORD } });
  await call('inactive session rejected', { method: 'GET', url: '/api/clients', cookie: t2 });
  await call('admin patch t2 active', { method: 'PATCH', url: `/api/admin/therapists/${T2}`, cookie: ad, json: { active: true } });
  await call('admin patch t2 final transcript on', { method: 'PATCH', url: `/api/admin/therapists/${T2}`, cookie: ad, json: { final_transcript_enabled: true } });

  // ——— L. حذف‌ها (تراپیست) ———
  await call('session delete foreign', { method: 'DELETE', url: `/api/sessions/${s4}`, cookie: t2 });
  await call('session delete', { method: 'DELETE', url: `/api/sessions/${s4}`, cookie: t1 });
  await call('session delete again', { method: 'DELETE', url: `/api/sessions/${s4}`, cookie: t1 });
  await call('client delete foreign', { method: 'DELETE', url: `/api/clients/${c3}`, cookie: t2 });
  await call('client delete (cascade)', { method: 'DELETE', url: `/api/clients/${c3}`, cookie: t1 });
  await call('admin delete client', { method: 'DELETE', url: `/api/admin/clients/${c4}`, cookie: ad });
  await call('admin delete client unknown', { method: 'DELETE', url: '/api/admin/clients/00000000-0000-4000-8000-000000000000', cookie: ad });
  await call('admin delete self', { method: 'DELETE', url: `/api/admin/therapists/${ADMIN}`, cookie: ad });
  await call('admin delete therapist unknown', { method: 'DELETE', url: '/api/admin/therapists/00000000-0000-4000-8000-000000000000', cookie: ad });
  await dbSnapshot('before therapist delete', { therapists: fixtureTherapists });
  await call('admin delete therapist t2', { method: 'DELETE', url: `/api/admin/therapists/${T2}`, cookie: ad });
  await sleep(500);
  await dbSnapshot('final', { therapists: fixtureTherapists });

  // ——— مسیرهایِ فایل ———
  const dirList = (d: string) => existsSync(d) ? readdirSync(d).map((x) => normStr(x)).sort() : null;
  const archive = path.join(WORKDIR, 'data', 'session-audio');
  emit({ files: {
    batch_queue: dirList(queueDir),
    session_audio_dirs: dirList(archive),
    session_audio_s2: dirList(path.join(archive, s2)),
    uploads: dirList(path.join(WORKDIR, 'data', 'uploads')),
  } });

  // ——— Soniox mock و رویدادهایِ obs ———
  emit({ soniox_calls: mockLog.map((l) => normStr(l)) });
  await flushObsQueue();
  await sleep(300);
  const jsonl = path.join(WORKDIR, 'data', 'logs', 'obs.jsonl');
  const obsLines = existsSync(jsonl) ? readFileSync(jsonl, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  // ترتیبِ خطوطِ JSONL بینِ onResponse و کارِ پس از پاسخ (مثلاً processEventsِ obs) قطعی نیست ⇒ مقایسه به‌صورتِ مجموعه.
  const prevC = canonicalMode;
  canonicalMode = true;
  emit({ obs_events: canonical(obsLines.map((e) => maskExternalCounts(norm({ ...e, ts: undefined, client_ts: e.client_ts ? '<ts>' : null }, undefined, true)))) });
  canonicalMode = prevC;
} catch (e) {
  exitCode = 1;
  console.error('HARNESS ERROR:', e);
} finally {
  try {
    const n = await cleanupFixtures();
    const left = await query(`SELECT COUNT(*) AS n FROM therapists WHERE phone LIKE ?`, [PHONE_PREFIX + '%']);
    console.log(`fixtures removed: ${n} therapist(s); remaining fixture-phone therapists: ${left.rows[0].n}`);
  } catch (e) {
    console.error('CLEANUP FAILED:', e);
    exitCode = 1;
  }
  mock.close();
  await pool.end().catch(() => {});
}

// ————————————————— خروجی / مقایسه —————————————————
const outFile = process.env.FEELIA_API_OUT || path.join(WORKDIR, 'api-contract.out.jsonl');
writeFileSync(outFile, out.join('\n') + '\n');
console.log(`recorded ${out.length} entries → ${outFile}`);
const golden = process.env.FEELIA_API_GOLDEN;
if (exitCode === 0 && golden) {
  if (UPDATE || !existsSync(golden)) {
    writeFileSync(golden, out.join('\n') + '\n');
    console.log('golden written: ' + golden);
  } else {
    const exp = readFileSync(golden, 'utf8').replace(/\r\n/g, '\n').split('\n').filter(Boolean);
    let diffs = 0;
    const max = Math.max(exp.length, out.length);
    for (let i = 0; i < max; i++) {
      if (exp[i] !== out[i]) {
        diffs++;
        if (diffs <= 20) console.log(`--- golden[${i}] ${String(exp[i]).slice(0, 600)}\n+++ actual[${i}] ${String(out[i]).slice(0, 600)}`);
      }
    }
    if (diffs) { console.log(`API CONTRACT DIFFERS: ${diffs} entr(y/ies)`); exitCode = 1; }
    else console.log(`API CONTRACT OK (${out.length} entries identical to golden)`);
  }
}
process.exit(exitCode);
