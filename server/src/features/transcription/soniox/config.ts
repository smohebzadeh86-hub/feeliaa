// پیکربندیِ مشترکِ HTTPِ Soniox (REST async + صدورِ کلیدِ موقت). مسیرِ legacyِ WebSocket (legacy-ws، LAW-015) کپیِ
// خودش را نگه می‌دارد.
import { HttpsProxyAgent } from 'https-proxy-agent';

// هنگامِ import خوانده می‌شود (بعد از dotenv) — همان رفتارِ قبلی.
export const SONIOX_API_BASE = process.env.SONIOX_API_BASE || 'https://api.soniox.com';

// agentِ تازه برایِ هر درخواست؛ PROXY_URL در لحظه‌ی فراخوانی خوانده می‌شود.
export function createProxyAgent(): HttpsProxyAgent<string> | undefined {
  const proxyUrl = process.env.PROXY_URL;
  return proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
}
