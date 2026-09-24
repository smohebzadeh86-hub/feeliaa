// رونویسیِ async (فایل کامل) — جایگزینِ «وانمودِ زنده‌بودن» برایِ مسیرِ batch fallback.
// طبقِ docsِ رسمیِ Soniox: مدلِ async (stt-async-v5) چون کلِ فایل رو یک‌جا می‌بینه،
// دقتِ تشخیصِ گوینده‌ش «به‌طورِ قابلِ‌توجهی» بالاتر از مدلِ realtime‌ه — و این دقیقاً
// همون بخشیه که (چون یه‌بار realtime شکست خورده) بیشتر از هر جای دیگه بهش نیاز داریم.
// مستندات: https://soniox.com/docs/stt/async/async-transcription
//           https://soniox.com/docs/api-reference/stt/files/upload_file
//           https://soniox.com/docs/api-reference/stt/transcriptions/create_transcription
import https from 'node:https';
import { randomBytes } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import { HttpsProxyAgent } from 'https-proxy-agent';

const API_BASE = process.env.SONIOX_API_BASE || 'https://api.soniox.com';
const POLL_INTERVAL_MS = 2000;
// ⭐ رفعِ F2 (audit آپلود، 2026-09-23): سقفِ ثابتِ ۱۰ دقیقه برایِ فایلِ بزرگ همیشه timeout می‌شد،
// transcription پاک و هر ۵ دقیقه از نو ساخته می‌شد (حلقه‌ی بی‌پایانِ هزینه). حالا سقف با حجم بزرگ
// می‌شود: ۱۰ دقیقه + ۱ دقیقه به ازایِ هر مگابایت (سگمنت‌هایِ عادیِ ۱۵ثانیه‌ای رفتارِ قبلی را دارند).
const POLL_TIMEOUT_BASE_MS = 10 * 60 * 1000;
export function pollTimeoutForBytes(bytes: number): number {
  return POLL_TIMEOUT_BASE_MS + Math.ceil(Math.max(0, bytes) / (1024 * 1024)) * 60 * 1000;
}

function proxyAgent(): HttpsProxyAgent<string> | undefined {
  const proxyUrl = process.env.PROXY_URL;
  return proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
}

function authHeader(): string {
  const key = process.env.SONIOX_API_KEY;
  if (!key) throw new Error('کلید Soniox روی سرور تنظیم نشده');
  return `Bearer ${key}`;
}

// ⭐ مسیرِ شبکه‌ی سرور به Soniox (به‌خصوص از پشتِ PROXY_URL) گاهی اتصال را قبل از TLS قطع می‌کند — در تستِ
// 2026-09-24 از هر ۳ درخواست ~۱ بار «socket disconnected before secure TLS connection». قبلاً هر قطعیِ لحظه‌ای یک
// تلاشِ کاملِ job را می‌سوزاند (backoff تا ده‌ها دقیقه) با اینکه transcription رویِ Soniox آماده بود. درخواست‌هایِ
// فقط‌خواندنی/idempotent (GET، DELETE) حالا در خطایِ سطحِ شبکه تا ۳ بار با فاصله‌ی کوتاه تکرار می‌شوند. POSTها
// (ساختِ فایل/transcription) عمداً تکرار نمی‌شوند — تکرارشان ممکن است منبعِ تکراری رویِ Soniox بسازد.
const NETWORK_RETRY_DELAYS_MS = [1000, 2000, 4000];
function isNetworkLevelError(e: unknown): boolean {
  const msg = String((e as any)?.message || e);
  const code = String((e as any)?.code || '');
  return /request-timeout|socket|TLS|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|EAI_AGAIN|ENOTFOUND|network|proxy/i.test(msg + ' ' + code);
}

async function request(
  method: string,
  urlPath: string,
  opts: { headers: Record<string, string>; body?: Buffer }
): Promise<{ status: number; json: any }> {
  const retryable = method === 'GET' || method === 'DELETE';
  for (let attempt = 0; ; attempt++) {
    try {
      return await requestOnce(method, urlPath, opts);
    } catch (e) {
      if (!retryable || attempt >= NETWORK_RETRY_DELAYS_MS.length || !isNetworkLevelError(e)) throw e;
      await new Promise((r) => setTimeout(r, NETWORK_RETRY_DELAYS_MS[attempt]));
    }
  }
}

function requestOnce(
  method: string,
  urlPath: string,
  opts: { headers: Record<string, string>; body?: Buffer }
): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const u = new URL(API_BASE + urlPath);
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port ? Number(u.port) : 443,
        path: u.pathname + u.search,
        method,
        headers: opts.headers,
        agent: proxyAgent(),
        timeout: 20000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json: any = null;
          try { json = text ? JSON.parse(text) : null; } catch { json = { _raw: text.slice(0, 300) }; }
          resolve({ status: res.statusCode ?? 0, json });
        });
      }
    );
    req.on('timeout', () => { try { req.destroy(new Error('request-timeout')); } catch {} });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

export async function uploadFile(buffer: Buffer, filename: string, clientReferenceId?: string): Promise<string> {
  const boundary = '----feelia' + randomBytes(16).toString('hex');
  const parts: Buffer[] = [];
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`
  ));
  parts.push(buffer);
  parts.push(Buffer.from('\r\n'));
  if (clientReferenceId) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="client_reference_id"\r\n\r\n${clientReferenceId}\r\n`
    ));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(parts);

  const res = await request('POST', '/v1/files', {
    headers: {
      Authorization: authHeader(),
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': String(body.length),
    },
    body,
  });
  if (res.status !== 201 || !res.json?.id) {
    throw new Error(`آپلودِ فایل به Soniox ناموفق (status=${res.status}): ${res.json?.error_message || res.json?._raw || 'پاسخِ نامعتبر'}`);
  }
  return res.json.id as string;
}

// ⭐ رفعِ F4: آپلودِ stream از رویِ دیسک — فایلِ جلسه‌ی چندساعته هرگز کامل در RAM نمی‌آید
// (نسخه‌ی buffer-محورِ بالا برایِ سگمنت‌هایِ کوچکِ صفِ batch دست‌نخورده می‌ماند).
export function uploadFileFromPath(filePath: string, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const size = statSync(filePath).size;
    const boundary = '----feelia' + randomBytes(16).toString('hex');
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeName}"\r\nContent-Type: application/octet-stream\r\n\r\n`
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const u = new URL(API_BASE + '/v1/files');
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port ? Number(u.port) : 443,
        path: u.pathname,
        method: 'POST',
        headers: {
          Authorization: authHeader(),
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': String(head.length + size + tail.length),
        },
        agent: proxyAgent(),
        timeout: 60000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          let json: any = null;
          try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {}
          if (res.statusCode !== 201 || !json?.id) {
            reject(new Error(`آپلودِ فایل به Soniox ناموفق (status=${res.statusCode}): ${json?.error_message || 'پاسخِ نامعتبر'}`));
          } else resolve(json.id as string);
        });
      }
    );
    req.on('timeout', () => { try { req.destroy(new Error('request-timeout')); } catch {} });
    req.on('error', reject);
    req.write(head);
    const rs = createReadStream(filePath);
    rs.on('error', (e) => { try { req.destroy(e); } catch {} reject(e); });
    rs.on('end', () => { req.end(tail); });
    rs.pipe(req, { end: false });
  });
}

export async function createTranscription(
  fileId: string,
  opts: { languageHints?: string[]; clientReferenceId?: string } = {}
): Promise<string> {
  const payload = JSON.stringify({
    model: 'stt-async-v5',
    file_id: fileId,
    language_hints: opts.languageHints || ['fa'],
    enable_speaker_diarization: true,
    enable_language_identification: true,
    client_reference_id: opts.clientReferenceId,
  });
  const res = await request('POST', '/v1/transcriptions', {
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(payload)),
    },
    body: Buffer.from(payload),
  });
  if (res.status !== 201 || !res.json?.id) {
    throw new Error(`ساختِ transcription ناموفق (status=${res.status}): ${res.json?.error_message || res.json?._raw || 'پاسخِ نامعتبر'}`);
  }
  return res.json.id as string;
}

export async function pollTranscriptionStatus(id: string): Promise<{ status: string; error_message?: string; notFound?: boolean; httpStatus?: number }> {
  const res = await request('GET', `/v1/transcriptions/${id}`, { headers: { Authorization: authHeader() } });
  // ⭐ status غیرِ ۲۰۰ (مثلاً ۵۰۳ی گذرا) قبلاً مستقیم به 'error' تبدیل می‌شد — یعنی یک خطایِ شبکه‌یِ
  // لحظه‌ای کلِ رونویسی را شکست‌خورده اعلام می‌کرد. حالا فقط ۴۰۴ «نیست» است و بقیه گذرا (throw).
  if (res.status === 404) return { status: 'error', notFound: true, httpStatus: 404, error_message: 'transcription-not-found' };
  if (res.status < 200 || res.status >= 300) throw new Error(`poll-http-${res.status}`);
  return { status: res.json?.status || 'error', error_message: res.json?.error_message, httpStatus: res.status };
}

// ————— فهرستِ منابعِ رویِ Soniox (رفعِ F3: پاک‌سازیِ فایل/transcriptionِ یتیمِ بعد از کرش) —————
export interface SonioxFileInfo { id: string; filename: string; created_at: string; }
export interface SonioxTranscriptionInfo { id: string; status: string; created_at: string; file_id: string | null; client_reference_id?: string | null; }

async function listPaged<T>(pathName: string, key: string, maxPages = 20): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < maxPages; i++) {
    const q: string = cursor ? `?limit=1000&cursor=${encodeURIComponent(cursor)}` : '?limit=1000';
    const res = await request('GET', pathName + q, { headers: { Authorization: authHeader() } });
    if (res.status !== 200) throw new Error(`list ${pathName} failed status=${res.status}`);
    out.push(...((res.json?.[key] || []) as T[]));
    cursor = res.json?.next_page_cursor || null;
    if (!cursor) break;
  }
  return out;
}
export function listSonioxFiles(): Promise<SonioxFileInfo[]> {
  return listPaged<SonioxFileInfo>('/v1/files', 'files');
}
export function listSonioxTranscriptions(): Promise<SonioxTranscriptionInfo[]> {
  return listPaged<SonioxTranscriptionInfo>('/v1/transcriptions', 'transcriptions');
}

export interface AsyncToken { text: string; speaker?: number | string; }

export async function getTranscriptTokens(id: string): Promise<AsyncToken[]> {
  const res = await request('GET', `/v1/transcriptions/${id}/transcript`, { headers: { Authorization: authHeader() } });
  // ⭐ باگِ واقعی (کشف‌شده در auditِ آپلود، 2026-09-23): قبلاً پاسخِ خطا (۵xx/۴۰۴) به آرایه‌ی خالی
  // تبدیل می‌شد و batchqueue آن را «سکوت = موفق» تلقی می‌کرد و فایل را از صف پاک می‌کرد — متنِ
  // واقعی بی‌صدا گم می‌شد. حالا خطا throw می‌شود تا retry عادی انجام شود.
  if (res.status !== 200 || !Array.isArray(res.json?.tokens)) {
    throw new Error(`دریافتِ متن از Soniox ناموفق (status=${res.status})`);
  }
  return res.json.tokens as AsyncToken[];
}

export async function deleteTranscription(id: string): Promise<void> {
  await request('DELETE', `/v1/transcriptions/${id}`, { headers: { Authorization: authHeader() } }).catch(() => {});
}

export async function deleteFile(fileId: string): Promise<void> {
  await request('DELETE', `/v1/files/${fileId}`, { headers: { Authorization: authHeader() } }).catch(() => {});
}

// همون قراردادِ «گوینده N:» که مسیرِ realtime (soniox.ts) هم استفاده می‌کنه — یکدست
// بمونه، فرقی نکنه متن از کدوم مسیر اومده.
export function buildTextFromAsyncTokens(tokens: AsyncToken[]): string {
  let out = '';
  let curSpeaker: number | string | null = null;
  for (const t of tokens) {
    if (!t.text) continue;
    if (t.speaker != null && t.speaker !== curSpeaker) {
      curSpeaker = t.speaker;
      const faSp = String(t.speaker).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
      out += (out ? '\n\n' : '') + `گوینده ${faSp}: `;
    }
    out += t.text;
  }
  return out;
}

// orchestration کامل: آپلود → ساختِ transcription → poll تا completed/error → دریافتِ
// توکن‌ها → پاک‌سازیِ فایل/transcription از سمتِ Soniox (حریمِ خصوصی — چیزی اونجا نمونه).
export async function transcribeFileAsync(
  buffer: Buffer,
  filenameHint: string,
  clientReferenceId?: string
): Promise<string> {
  // نامِ فایل با پیشوندِ feelia- تا sweepِ یتیم‌ها (sweepSonioxOrphans) فقط فایل‌هایِ خودِ ما را بشناسد.
  const fileId = await uploadFile(buffer, 'feelia-' + filenameHint, clientReferenceId);
  let transcriptionId: string | null = null;
  try {
    transcriptionId = await createTranscription(fileId, { clientReferenceId });
    const startedAt = Date.now();
    const timeoutMs = pollTimeoutForBytes(buffer.length);
    let status = 'queued';
    let transientErrors = 0;
    while (status === 'queued' || status === 'processing') {
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error('رونویسیِ async زمانِ زیادی طول کشید (timeout)');
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      let s;
      try {
        s = await pollTranscriptionStatus(transcriptionId);
      } catch (e) {
        // خطایِ گذرایِ شبکه وسطِ poll — چند بار تحمل می‌شود، نه شکستِ فوری.
        if (++transientErrors > 10) throw e;
        continue;
      }
      status = s.status;
      if (status === 'error') throw new Error(s.error_message || 'رونویسیِ async ناموفق شد');
    }
    const tokens = await getTranscriptTokens(transcriptionId);
    return buildTextFromAsyncTokens(tokens);
  } finally {
    if (transcriptionId) await deleteTranscription(transcriptionId);
    await deleteFile(fileId).catch(() => {});
  }
}
