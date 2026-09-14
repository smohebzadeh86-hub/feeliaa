// رونویسیِ async (فایل کامل) — جایگزینِ «وانمودِ زنده‌بودن» برایِ مسیرِ batch fallback.
// طبقِ docsِ رسمیِ Soniox: مدلِ async (stt-async-v5) چون کلِ فایل رو یک‌جا می‌بینه،
// دقتِ تشخیصِ گوینده‌ش «به‌طورِ قابلِ‌توجهی» بالاتر از مدلِ realtime‌ه — و این دقیقاً
// همون بخشیه که (چون یه‌بار realtime شکست خورده) بیشتر از هر جای دیگه بهش نیاز داریم.
// مستندات: https://soniox.com/docs/stt/async/async-transcription
//           https://soniox.com/docs/api-reference/stt/files/upload_file
//           https://soniox.com/docs/api-reference/stt/transcriptions/create_transcription
import https from 'node:https';
import { randomBytes } from 'node:crypto';
import { HttpsProxyAgent } from 'https-proxy-agent';

const API_BASE = process.env.SONIOX_API_BASE || 'https://api.soniox.com';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // سقفِ انتظار برایِ رونویسیِ یک فایل

function proxyAgent(): HttpsProxyAgent<string> | undefined {
  const proxyUrl = process.env.PROXY_URL;
  return proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
}

function authHeader(): string {
  const key = process.env.SONIOX_API_KEY;
  if (!key) throw new Error('کلید Soniox روی سرور تنظیم نشده');
  return `Bearer ${key}`;
}

function request(
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

export async function pollTranscriptionStatus(id: string): Promise<{ status: string; error_message?: string }> {
  const res = await request('GET', `/v1/transcriptions/${id}`, { headers: { Authorization: authHeader() } });
  return { status: res.json?.status || 'error', error_message: res.json?.error_message };
}

export interface AsyncToken { text: string; speaker?: number | string; }

export async function getTranscriptTokens(id: string): Promise<AsyncToken[]> {
  const res = await request('GET', `/v1/transcriptions/${id}/transcript`, { headers: { Authorization: authHeader() } });
  return (res.json?.tokens || []) as AsyncToken[];
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
  const fileId = await uploadFile(buffer, filenameHint, clientReferenceId);
  let transcriptionId: string | null = null;
  try {
    transcriptionId = await createTranscription(fileId, { clientReferenceId });
    const startedAt = Date.now();
    let status = 'queued';
    while (status === 'queued' || status === 'processing') {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        throw new Error('رونویسیِ async زمانِ زیادی طول کشید (timeout)');
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const s = await pollTranscriptionStatus(transcriptionId);
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
