// صدور Temporary API Key رسمی Soniox — فقط سمت سرور.
// مستندات: https://soniox.com/docs/guides/temporary-api-keys
//   POST {SONIOX_API_BASE}/v1/auth/temporary-api-key
//   Auth: Bearer <SONIOX_API_KEY> (کلید اصلی — هرگز از این ماژول خارج نمی‌شود)
//   Body: { usage_type, expires_in_seconds, single_use?, max_session_duration_seconds?, client_reference_id? }
//
// چرا این ماژول لازم است؟ اتصال مستقیم Browser→Soniox بدون افشای کلید اصلی
// فقط با temp-key ممکن است. نکته صادقانه: خودِ mint یک HTTPS POST از VPS به
// api.soniox.com است؛ اگر egress قطع باشد mint هم fail می‌شود (503 شفاف) ولی
// media-plane (ساعت‌ها استریم) هرگز از VPS عبور نمی‌کند. mint از PROXY_URL
// (اگر ست باشد) عبور می‌کند تا control-plane هم قابل نجات باشد.
import https from 'node:https';
import { HttpsProxyAgent } from 'https-proxy-agent';

export const SONIOX_WS_URL =
  process.env.SONIOX_WS_URL || 'wss://stt-rt.soniox.com/transcribe-websocket';
export const SONIOX_API_BASE =
  process.env.SONIOX_API_BASE || 'https://api.soniox.com';

// سقف‌های امنیتی پیش‌فرض برای کلید موقت جلسه زنده
export const TEMP_KEY_EXPIRES_IN_SECONDS = 120; // فرصت باز کردن استریم
export const TEMP_KEY_MAX_SESSION_SECONDS = 7200; // سقف ۲ ساعت برای هر استریم
const MINT_TIMEOUT_MS = 10000; // explicit؛ راه‌حل «افزایش timeout» نیست

export interface TempKeyRequest {
  clientReferenceId: string; // مثل feelia:<therapistId>:<sessionId>:<gen>
  singleUse?: boolean; // پیش‌فرض true: هر connection یک کلید
  expiresInSeconds?: number;
  maxSessionDurationSeconds?: number;
}

export interface TempKeyResult {
  api_key: string; // کلید موقت — فقط تا expires
  expires_at?: string;
}

export class TempKeyError extends Error {
  code: 'no-key' | 'mint-transport' | 'mint-rejected' | 'mint-timeout';
  status: number;
  constructor(code: TempKeyError['code'], status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const proxyUrl = process.env.PROXY_URL;
    const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port ? Number(u.port) : 443,
        path: u.pathname + u.search,
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) },
        agent,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json: any = null;
          try { json = text ? JSON.parse(text) : null; } catch { json = { _raw: text.slice(0, 200) }; }
          resolve({ status: res.statusCode ?? 0, json });
        });
      }
    );
    req.on('timeout', () => {
      try { req.destroy(new Error('mint-timeout')); } catch {}
    });
    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

// صدور یک temp-key برای دقیقاً یک اتصال realtime (transcribe_websocket).
// ⚠️ خروجی شامل کلید موقت است؛ caller مسئول است فقط به owner همان session بدهد
// و هرگز لاگ نکند. کلید اصلی فقط در header به Soniox می‌رود.
export async function mintTemporaryKey(req: TempKeyRequest): Promise<TempKeyResult> {
  const masterKey = process.env.SONIOX_API_KEY;
  if (!masterKey) {
    throw new TempKeyError('no-key', 500, 'کلید Soniox روی سرور تنظیم نشده');
  }
  let status = 0;
  let json: any = null;
  try {
    const r = await postJson(
      `${SONIOX_API_BASE}/v1/auth/temporary-api-key`,
      { Authorization: `Bearer ${masterKey}`, 'Content-Type': 'application/json' },
      {
        usage_type: 'transcribe_websocket',
        expires_in_seconds: req.expiresInSeconds ?? TEMP_KEY_EXPIRES_IN_SECONDS,
        single_use: req.singleUse ?? true,
        max_session_duration_seconds: req.maxSessionDurationSeconds ?? TEMP_KEY_MAX_SESSION_SECONDS,
        client_reference_id: req.clientReferenceId,
      },
      MINT_TIMEOUT_MS
    );
    status = r.status;
    json = r.json;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('mint-timeout')) {
      throw new TempKeyError('mint-timeout', 503, 'پاسخ سرویس صدور credential دیر رسید');
    }
    // transport خالص (DNS/TCP/TLS/handshake) — ربطی به 401 احراز هویت Feelia ندارد
    throw new TempKeyError('mint-transport', 503, 'ارتباط با سرویس Soniox برای صدور credential برقرار نشد');
  }
  const tempKey: string | undefined = json?.api_key;
  if (status < 200 || status >= 300 || !tempKey) {
    // Soniox صریح رد کرد (کلید نامعتبر، سقف مصرف، ...) — نه مشکل شبکه
    const detail =
      (json && (json.error_message || json.message || json.error_type)) || `status ${status}`;
    console.log(
      `[stt-mint] rejected status=${status} detail=${String(detail).slice(0, 160)} proxy=${process.env.PROXY_URL ? 'set' : 'unset'}`
    );
    throw new TempKeyError('mint-rejected', 502, `سرویس رونویسی credential نداد (${String(detail).slice(0, 120)})`);
  }
  return { api_key: tempKey, expires_at: json?.expires_at };
}
