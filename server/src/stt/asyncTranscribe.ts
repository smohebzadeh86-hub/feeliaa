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
import { SESSION_TRANSCRIPTION_CONTEXT } from './sessionContext.js';
import { formatSignTime, signMarker, sortedSigns, type SignMark } from './signMarkers.js';
import { SONIOX_API_BASE as API_BASE, createProxyAgent as proxyAgent } from '../features/transcription/soniox/config.js';

const POLL_INTERVAL_MS = 2000;
// ⭐ رفعِ F2 (audit آپلود، 2026-09-23): سقفِ ثابتِ ۱۰ دقیقه برایِ فایلِ بزرگ همیشه timeout می‌شد،
// transcription پاک و هر ۵ دقیقه از نو ساخته می‌شد (حلقه‌ی بی‌پایانِ هزینه). حالا سقف با حجم بزرگ
// می‌شود: ۱۰ دقیقه + ۱ دقیقه به ازایِ هر مگابایت (سگمنت‌هایِ عادیِ ۱۵ثانیه‌ای رفتارِ قبلی را دارند).
const POLL_TIMEOUT_BASE_MS = 10 * 60 * 1000;
export function pollTimeoutForBytes(bytes: number): number {
  return POLL_TIMEOUT_BASE_MS + Math.ceil(Math.max(0, bytes) / (1024 * 1024)) * 60 * 1000;
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
  // sessionContext (پیش‌فرض true): contextِ «جلسه‌ی چندنفره» برایِ دقتِ تفکیکِ گوینده؛ یادداشتِ صوتیِ
  // تک‌گوینده‌ی تراپیست آن را false می‌دهد تا مدل به شکستنِ بی‌جایِ یک صدا سوق داده نشود.
  // context: contextِ مخصوصِ جلسه (واحدِ درمان، 2026-09-27) — اگر داده شود جایگزینِ contextِ ثابت می‌شود.
  opts: { languageHints?: string[]; clientReferenceId?: string; sessionContext?: boolean; context?: object } = {}
): Promise<string> {
  const payload = JSON.stringify({
    model: 'stt-async-v5',
    file_id: fileId,
    language_hints: opts.languageHints || ['fa'],
    enable_speaker_diarization: true,
    enable_language_identification: true,
    ...(opts.sessionContext === false ? {} : { context: opts.context ?? SESSION_TRANSCRIPTION_CONTEXT }),
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

// confidence: Soniox برایِ هر توکن برمی‌گرداند (۰..۱)؛ اختیاری چون پاسخ/fixtureِ قدیمی ممکن است نداشته باشد.
export interface AsyncToken { text: string; speaker?: number | string; start_ms?: number; confidence?: number; }

// ————— اطمینانِ رونویسی (پلنِ B، فاز ۰B: verification/2026-09-28-upload-audio-quality-phase0b.md) —————
// تنها سیگنالی که متنِ واقعاً خراب را پیش‌بینی کرد confidenceِ خودِ Soniox بود (سهمِ توکنِ زیرِ ۰٫۷: بی‌آسیب ≤ ۰٫۰۳۸،
// همهمه‌یِ هم‌سطح با WER ۲۲٫۵٪ ⇒ ۰٫۱۲۲). طولِ متن سیگنال نیست: Soniox زیرِ خرابی واژه را عوض می‌کند، نه کم.
const HAS_CONTENT = /[\p{L}\p{N}]/u;

// سهمِ توکن‌هایِ دارایِ محتوا که confidence < threshold دارند. null ⇒ هیچ توکنی confidence نداشت (fail-open).
export function lowConfidenceRatio(tokens: AsyncToken[], threshold = 0.7): number | null {
  let n = 0;
  let low = 0;
  for (const t of tokens) {
    if (!t.text || !HAS_CONTENT.test(t.text) || typeof t.confidence !== 'number') continue;
    n++;
    if (t.confidence < threshold) low++;
  }
  return n ? low / n : null;
}

// واژه‌هایِ کم‌اطمینان را به‌صورتِ قطعی (بدونِ LLM) با ⟦…؟⟧ علامت می‌زند — فقط برایِ ورودیِ «متنِ نهایی»؛ متنِ خامِ
// ذخیره‌شده در sessions.transcript هرگز علامت نمی‌گیرد. فاز ۰B نشان داد LLM خودش هیچ جایی را نامطمئن علامت نمی‌زند.
// واژه = توکن‌ها تا توکنِ بعدی که با فاصله شروع شود (یا تغییرِ گوینده)؛ اطمینانِ واژه = کمینه‌ی توکن‌هایِ محتوادار.
// علامت فقط دورِ بخشِ محتوادار است (نقطه‌گذاریِ انتهایی بیرون می‌ماند). واژه‌هایِ کم‌اطمینانِ پشتِ‌سرِ‌هم در
// markedTextFromTokens یک علامت می‌شوند.
export function markUncertainTokens(tokens: AsyncToken[], threshold: number): AsyncToken[] {
  const out = tokens.map((t) => ({ ...t }));
  let start = -1;
  let speaker: unknown = undefined;
  const close = (end: number) => {
    if (start < 0) return;
    let minConf = Infinity;
    let lastContent = -1;
    for (let i = start; i < end; i++) {
      const t = out[i];
      if (!t.text || !HAS_CONTENT.test(t.text)) continue;
      lastContent = i;
      if (typeof t.confidence === 'number' && t.confidence < minConf) minConf = t.confidence;
    }
    if (lastContent >= 0 && minConf < threshold) {
      let first = start;
      while (first <= lastContent && !(out[first].text && HAS_CONTENT.test(out[first].text))) first++;
      const lead = /^\s*/.exec(out[first].text)![0];
      out[first].text = lead + '⟦' + out[first].text.slice(lead.length);
      out[lastContent].text = out[lastContent].text + '؟⟧';
    }
    start = -1;
  };
  for (let i = 0; i < out.length; i++) {
    const t = out[i];
    if (!t.text) continue;
    const newSpeaker = t.speaker != null && t.speaker !== speaker;
    if (start < 0 || /^\s/.test(t.text) || newSpeaker) { close(i); start = i; }
    if (t.speaker != null) speaker = t.speaker;
  }
  close(out.length);
  return out;
}

export function markedTextFromTokens(tokens: AsyncToken[], signs: SignMark[] = [], threshold = uncertainConfidence()): string {
  return buildTextFromAsyncTokens(markUncertainTokens(tokens, threshold), signs).replace(/؟⟧( +)⟦/g, '$1');
}

// آستانه‌ها از env (با دادهٔ واقعی بازتنظیم می‌شوند — configuration-catalog).
function envRatio(name: string, def: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 && n < 1 ? n : def;
}
export function uncertainConfidence(): number { return envRatio('TRANSCRIPT_UNCERTAIN_CONFIDENCE', 0.5); }
export function lowConfidenceWarnRatio(): number { return envRatio('UPLOAD_LOW_CONF_RATIO', 0.08); }

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

// (A4، 2026-09-26) نتیجه برمی‌گردد (true = حذف شد یا از قبل نبود) تا caller شناسه‌ی منبعی را که حذفش
// شکست خورده دور نریزد — وگرنه منبعِ باقی‌مانده رویِ Soniox دیگر از هیچ‌جا قابلِ‌ردیابی نبود.
export async function deleteTranscription(id: string): Promise<boolean> {
  const r = await request('DELETE', `/v1/transcriptions/${id}`, { headers: { Authorization: authHeader() } }).catch(() => null);
  return !!r && ((r.status >= 200 && r.status < 300) || r.status === 404);
}

export async function deleteFile(fileId: string): Promise<boolean> {
  const r = await request('DELETE', `/v1/files/${fileId}`, { headers: { Authorization: authHeader() } }).catch(() => null);
  return !!r && ((r.status >= 200 && r.status < 300) || r.status === 404);
}

// همون قراردادِ «گوینده N:» که مسیرِ realtime (soniox.ts) هم استفاده می‌کنه — یکدست
// بمونه، فرقی نکنه متن از کدوم مسیر اومده.
// signs (اختیاری، فقط بازسازیِ گوینده‌ها): نشانگرِ هر علامت پیش از اولین توکنی می‌آید که start_msاش به offset_msِ
// علامت رسیده (هر دو از شروعِ صدایِ جلسه) — تا جایگزینیِ متن علائمِ درج‌شده در متن را پاک نکند. توکنِ بدونِ
// start_ms هیچ علامتی را جلو نمی‌اندازد؛ علائمِ باقی‌مانده به ترتیبِ زمانی در انتها می‌آیند (گم نمی‌شوند).
export function buildTextFromAsyncTokens(tokens: AsyncToken[], signs: SignMark[] = []): string {
  let out = '';
  let curSpeaker: number | string | null = null;
  const pending = sortedSigns(signs);
  let afterMarker = false;
  const flushSigns = (uptoMs: number) => {
    while (pending.length && (Number(pending[0].offset_ms) || 0) <= uptoMs) {
      const s = pending.shift()!;
      out += (out ? '\n\n' : '') + signMarker(formatSignTime(s.offset_ms), s.sign_type);
      curSpeaker = null;
      afterMarker = true;
    }
  };
  for (const t of tokens) {
    if (!t.text) continue;
    if (pending.length && typeof t.start_ms === 'number') flushSigns(t.start_ms);
    if (t.speaker != null && t.speaker !== curSpeaker) {
      curSpeaker = t.speaker;
      const faSp = String(t.speaker).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
      out += (out ? '\n\n' : '') + `گوینده ${faSp}: `;
      out += t.text;
    } else if (afterMarker) {
      out += '\n\n' + t.text.replace(/^\s+/, '');
    } else {
      out += t.text;
    }
    afterMarker = false;
  }
  flushSigns(Infinity);
  return out;
}

// orchestration کامل: آپلود → ساختِ transcription → poll تا completed/error → دریافتِ
// توکن‌ها → پاک‌سازیِ فایل/transcription از سمتِ Soniox (حریمِ خصوصی — چیزی اونجا نمونه).
export async function transcribeFileAsync(
  buffer: Buffer,
  filenameHint: string,
  clientReferenceId?: string,
  opts: { sessionContext?: boolean; context?: object; signs?: SignMark[] } = {}
): Promise<string> {
  // نامِ فایل با پیشوندِ feelia- تا sweepِ یتیم‌ها (sweepSonioxOrphans) فقط فایل‌هایِ خودِ ما را بشناسد.
  const fileId = await uploadFile(buffer, 'feelia-' + filenameHint, clientReferenceId);
  let transcriptionId: string | null = null;
  try {
    transcriptionId = await createTranscription(fileId, { clientReferenceId, sessionContext: opts.sessionContext, context: opts.context });
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
    return buildTextFromAsyncTokens(tokens, opts.signs);
  } finally {
    if (transcriptionId) await deleteTranscription(transcriptionId);
    await deleteFile(fileId).catch(() => {});
  }
}
