// موتور رونویسی Soniox — با پشتیبانی پروکسی
// منطق بر اساس مستندات رسمی Soniox:
// - Non-final tokens: provisional (فوری نمایش، قابل تغییر)
// - Final tokens: confirmed (یکبار فرستاده می‌شن، تغییر نمی‌کنن)
// - ws.send("") = سیگنال پایان صدا (ضروری!)
import { WebSocket } from 'ws';
import { HttpsProxyAgent } from 'https-proxy-agent';

export interface SonioxToken {
  text: string;
  is_final: boolean;
  speaker?: number;
}

export interface SonioxCallbacks {
  onPreview: (finalText: string, nonFinalText: string) => void;
  onStatus: (status: 'connecting' | 'connected' | 'reconnecting' | 'error', message?: string) => void;
  onFinished: (finalText: string) => void;
  onError: (error: string) => void;
}

const SONIOX_WS_URL = 'wss://stt-rt.soniox.com/transcribe-websocket';
const RECONNECT_BASE_DELAY = 1000;
const MAX_RECONNECT = 6;
const CONNECT_TIMEOUT = 8000;
const FINALIZE_TIMEOUT = 8000;
const MAX_BUFFER_CHUNKS = 200;

function createProxyAgent(): HttpsProxyAgent<string> | undefined {
  const proxyUrl = process.env.PROXY_URL;
  if (proxyUrl) return new HttpsProxyAgent(proxyUrl);
  return undefined;
}

// ⭐ ساخت متن از tokens (طبق pattern رسمی)
function buildTextFromTokens(tokens: SonioxToken[]): string {
  let out = '';
  let curSpeaker: number | null = null;
  for (const t of tokens) {
    if (t.speaker != null && t.speaker !== curSpeaker) {
      curSpeaker = t.speaker;
      out += (out ? '\n\n' : '') + `گوینده ${String(t.speaker).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])}: `;
    }
    out += t.text;
  }
  return out;
}

export class SonioxEngine {
  private ws: WebSocket | null = null;
  private callbacks: SonioxCallbacks;
  private apiKey: string;
  private proxyAgent: HttpsProxyAgent<string> | undefined;

  private finalTokens: SonioxToken[] = [];
  private pendingChunks: Buffer[] = [];
  private stopRequested = false;
  private manuallyClosing = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private finalizeTimer: ReturnType<typeof setTimeout> | null = null;
  private settled = false;
  private startPromise: Promise<void> | null = null;
  // P1: resolverهای stop() — باگ قبلی: stop() هیچ‌وقت resolve نمی‌شد
  private stopResolvers: Array<(t: string) => void> = [];

  // ⭐ اولویت ۱ (Replace-not-Append): متن final ذخیره‌شده‌ی قبلیِ جلسه.
  // موتور جدید finalTokens را از صفر شروع می‌کند، ولی هر چه بیرون می‌دهد
  // (preview/finished) باید ادامه‌ی همین prefix باشد، نه جایگزین آن.
  private prefix = '';

  constructor(apiKey: string, callbacks: SonioxCallbacks, opts?: { initialTranscript?: string }) {
    this.apiKey = apiKey;
    this.callbacks = callbacks;
    this.proxyAgent = createProxyAgent();
    this.prefix = (opts?.initialTranscript ?? '').trim();
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private bufferOrSend(buf: Buffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(buf);
      } catch {
        this.pendingChunks.push(buf);
      }
    } else {
      this.pendingChunks.push(buf);
      if (this.pendingChunks.length > MAX_BUFFER_CHUNKS) {
        this.pendingChunks.shift();
      }
    }
  }

  private flushPending() {
    while (this.pendingChunks.length && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(this.pendingChunks.shift()!);
      } catch { break; }
    }
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const opts: any = { handshakeTimeout: CONNECT_TIMEOUT };
      if (this.proxyAgent) opts.agent = this.proxyAgent;

      const socket = new WebSocket(SONIOX_WS_URL, opts);
      this.ws = socket;

      // ⭐ رفع باگ: اگر اولین تلاش اتصال شکست بخورد (error/close قبل از open)،
      // این Promise باید reject بشه — وگرنه start() تا ابد معلق می‌مونه و
      // هیچ خطایی به کاربر نشون داده نمی‌شه (نه در پیش‌بررسی، نه در جلسه‌ی زنده).
      let connectSettled = false;
      const settleConnect = (err?: Error) => {
        if (connectSettled) return;
        connectSettled = true;
        clearTimeout(timeout);
        if (err) reject(err); else resolve();
      };

      const timeout = setTimeout(() => {
        try { socket.close(); } catch {}
        settleConnect(new Error('connection-timeout'));
      }, CONNECT_TIMEOUT);

      socket.onopen = () => {
        try {
          // ⭐ پیام اول: پیکربندی (طبق مستندات)
          socket.send(JSON.stringify({
            api_key: this.apiKey,
            model: 'stt-rt-v5',
            audio_format: 'auto',
            language_hints: ['fa', 'en'],
            enable_language_identification: true,
            enable_speaker_diarization: true,
            enable_endpoint_detection: true,
          }));
          this.flushPending();
        } catch (e) { settleConnect(e as Error); return; }

        this.callbacks.onStatus('connected', 'در حال رونویسی…');
        settleConnect();
      };

      socket.onmessage = (ev) => {
        let msg: any;
        try { msg = JSON.parse(ev.data as string); } catch { return; }

        if (msg.error_code) {
          this.callbacks.onError(`خطای سرویس: ${msg.error_message || msg.error_code}`);
          return;
        }

        // ⭐ Pattern رسمی: final tokens → append، non-final → reset هر بار
        const nonFinal: SonioxToken[] = [];
        for (const t of (msg.tokens || [])) {
          if (!t.text) continue;
          if (t.is_final) {
            this.finalTokens.push({ text: t.text, is_final: true, speaker: t.speaker });
          } else {
            nonFinal.push({ text: t.text, is_final: false, speaker: t.speaker });
          }
        }

        // ⭐ Preview: متن final کامل (prefix + تا الان) + متن non-final (در حال گفتن)
        if (msg.tokens && msg.tokens.length > 0) {
          const finalText = this.composedFinalText();
          const nonFinalText = buildTextFromTokens(nonFinal);
          this.callbacks.onPreview(finalText, nonFinalText);
        }

        if (msg.finished) { this.settle(); }
      };

      socket.onclose = () => {
        if (!connectSettled) {
          // هرگز به‌طور موفق وصل نشد — reconnect اینجا معنی نداره، caller باید خطا رو ببینه
          settleConnect(new Error('connection-failed'));
          return;
        }
        if (this.manuallyClosing || this.stopRequested) { this.settle(); return; }
        this.attemptReconnect();
      };

      socket.onerror = () => {};
    });
  }

  private attemptReconnect() {
    if (this.stopRequested || this.settled) return;
    if (this.reconnectAttempts >= MAX_RECONNECT) {
      this.callbacks.onStatus('error', 'اتصال قطع شد؛ منتظر برگشت سرویس…');
      return;
    }
    this.reconnectAttempts++;
    const delay = RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts - 1);
    this.callbacks.onStatus('reconnecting', `اتصال قطع شد؛ تلاش ${this.reconnectAttempts} از ${MAX_RECONNECT}…`);
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.stopRequested || this.settled) return;
      this.openSocket().catch(() => this.attemptReconnect());
    }, delay);
  }

  private settle() {
    if (this.settled) return;
    this.settled = true;
    if (this.finalizeTimer) { clearTimeout(this.finalizeTimer); this.finalizeTimer = null; }
    this.clearReconnectTimer();
    const text = this.getFinalText();
    try { this.callbacks.onFinished(text); } catch {}
    // P1: باز کردن قفل همه‌ی await engine.stop() ها (از جمله voice-note background)
    const resolvers = this.stopResolvers.splice(0);
    for (const r of resolvers) { try { r(text); } catch {} }
  }

  // P1: قطع سخت بدون finalize — برای interruption / manual-pause / cancel.
  // برخلاف stop()، هیچ onFinished صدا زده نمی‌شود؛ confirmed قبلی در DB امن است.
  abort() {
    if (this.settled) { try { this.ws?.close(); } catch {} return; }
    this.settled = true; // جلوی settle/onFinished بعدی را می‌گیرد
    this.stopRequested = true;
    this.manuallyClosing = true;
    if (this.finalizeTimer) { clearTimeout(this.finalizeTimer); this.finalizeTimer = null; }
    this.clearReconnectTimer();
    try { this.ws?.close(); } catch {}
    const resolvers = this.stopResolvers.splice(0);
    for (const r of resolvers) { try { r(this.getFinalText()); } catch {} }
  }

  async start(): Promise<void> {
    this.callbacks.onStatus('connecting', 'در حال اتصال…');
    this.startPromise = this.openSocket();
    await this.startPromise;
  }

  sendAudioChunk(buf: ArrayBufferLike) {
    this.bufferOrSend(Buffer.from(buf));
  }

  // P1: ارسال فقط اگر سوکت Soniox باز است؛ بدون صف داخلی، بدون throw.
  // true = به transport تحویل شد (مبنای ACK) — نه processed، نه durable.
  // false = هنوز forward نشده؛ لایه‌ی ordering باید نگه دارد و ACK ندهد.
  trySendAudioChunk(buf: ArrayBufferLike): boolean {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(Buffer.from(buf));
        return true;
      }
    } catch {}
    return false;
  }

  isSonioxOpen(): boolean {
    try { return !!this.ws && this.ws.readyState === WebSocket.OPEN; } catch { return false; }
  }

  async stop(): Promise<string> {
    return new Promise((resolve) => {
      this.stopRequested = true;
      this.manuallyClosing = true;
      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.flushPending();
          // ⭐ طبق مستندات: finalize + رشته‌ی خالی = سیگنال پایان
          this.ws.send(JSON.stringify({ type: 'finalize' }));
          this.ws.send('');
        } else {
          this.settle();
        }
      } catch { this.settle(); }
      this.finalizeTimer = setTimeout(() => { this.settle(); }, FINALIZE_TIMEOUT);
    });
  }

  // ⭐ اولویت ۱: متن final کامل جلسه = prefix (قبل از قطعی) + finals جدید این موتور
  private composedFinalText(): string {
    const current = buildTextFromTokens(this.finalTokens);
    if (!this.prefix) return current;
    if (!current) return this.prefix;
    return this.prefix + '\n\n' + current;
  }

  getFinalText(): string {
    return this.composedFinalText();
  }
}