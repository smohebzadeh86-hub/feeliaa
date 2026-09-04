// موتور رونویسی Soniox — نسخه‌ی سروری با preview
import { WebSocket } from 'ws';
import { HttpsProxyAgent } from 'https-proxy-agent';

export interface SonioxToken {
  text: string;
  is_final: boolean;
  speaker?: number;
}

export interface SonioxCallbacks {
  onPreview: (fullText: string) => void;
  onStatus: (status: 'connecting' | 'connected' | 'reconnecting' | 'error', message?: string) => void;
  onFinished: (finalText: string) => void;
  onError: (error: string) => void;
}

const SONIOX_WS_URL = 'wss://stt-rt.soniox.com/transcribe-websocket';
const SONIOX_MODEL = 'stt-rt-v5';

const RECONNECT_BASE_DELAY = 1000;
const MAX_RECONNECT = 6;
const CONNECT_TIMEOUT = 8000;
const FINALIZE_TIMEOUT = 8000;
const MAX_BUFFER_CHUNKS = 200;

function createProxyAgent(): HttpsProxyAgent<string> | undefined {
  const proxyUrl = process.env.PROXY_URL;
  if (proxyUrl) {
    console.log('[stt] using proxy:', proxyUrl);
    return new HttpsProxyAgent(proxyUrl);
  }
  return undefined;
}

export class SonioxEngine {
  private ws: WebSocket | null = null;
  private callbacks: SonioxCallbacks;
  private apiKey: string;
  private proxyAgent: HttpsProxyAgent<string> | undefined;
  
  private finalTokens: SonioxToken[] = [];
  private lastSpeaker: number | null = null;
  private pendingChunks: Buffer[] = [];
  private stopRequested = false;
  private manuallyClosing = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private finalizeTimer: ReturnType<typeof setTimeout> | null = null;
  private settled = false;

  constructor(apiKey: string, callbacks: SonioxCallbacks) {
    this.apiKey = apiKey;
    this.callbacks = callbacks;
    this.proxyAgent = createProxyAgent();
  }

  private toFa(num: number): string {
    return String(num).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
  }

  private speakerLabel(n: number): string {
    return `گوینده ${this.toFa(n)}`;
  }

  // ⭐ ساخت متن کامل از final tokens + non-final فعلی
  private buildFullText(nonFinalTokens: SonioxToken[]): string {
    let out = '';
    let curSpeaker: number | null = null;
    
    // اول: همه‌ی final tokens (تجمعی)
    for (const t of this.finalTokens) {
      if (t.speaker != null && t.speaker !== curSpeaker) {
        curSpeaker = t.speaker;
        out += (out ? '\n\n' : '') + this.speakerLabel(t.speaker) + ': ';
      }
      out += t.text;
    }
    
    // بعد: non-final فعلی (در حال گفتن)
    for (const t of nonFinalTokens) {
      if (t.speaker != null && t.speaker !== curSpeaker) {
        curSpeaker = t.speaker;
        out += (out && !out.endsWith('\n\n') ? '\n\n' : '') + (out ? this.speakerLabel(t.speaker) + ': ' : '');
      }
      out += t.text;
    }
    
    return out;
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
      } catch {
        break;
      }
    }
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socketOptions: any = { handshakeTimeout: CONNECT_TIMEOUT };
      if (this.proxyAgent) socketOptions.agent = this.proxyAgent;
      
      const socket = new WebSocket(SONIOX_WS_URL, socketOptions);
      this.ws = socket;

      const timeout = setTimeout(() => {
        try { socket.close(); } catch {}
        reject(new Error('connection-timeout'));
      }, CONNECT_TIMEOUT);

      socket.onopen = () => {
        clearTimeout(timeout);
        try {
          socket.send(JSON.stringify({
            api_key: this.apiKey,
            model: SONIOX_MODEL,
            audio_format: 'auto',
            language_hints: ['fa', 'en'],
            enable_language_identification: true,
            enable_speaker_diarization: true,
            enable_endpoint_detection: true,
          }));
          this.flushPending();
        } catch (e) { reject(e); return; }
        this.callbacks.onStatus('connected', 'در حال رونویسی…');
        resolve();
      };

      socket.onmessage = (ev) => {
        let msg: any;
        try { msg = JSON.parse(ev.data as string); } catch { return; }

        if (msg.error_code) {
          this.callbacks.onError(`خطای سرویس: ${msg.error_message || msg.error_code}`);
          return;
        }

        // ⭐ پردازش ALL tokens
        const nonFinal: SonioxToken[] = [];
        for (const t of (msg.tokens || [])) {
          if (!t.text) continue;
          if (t.is_final) {
            this.finalTokens.push({ text: t.text, is_final: true, speaker: t.speaker });
          } else {
            nonFinal.push({ text: t.text, is_final: false, speaker: t.speaker });
          }
        }

        // ⭐ ارسال متن کامل (final + non-final) برای preview
        if (msg.tokens && msg.tokens.length > 0) {
          const fullText = this.buildFullText(nonFinal);
          this.callbacks.onPreview(fullText);
        }

        if (msg.finished) { this.settle(); }
      };

      socket.onclose = () => {
        clearTimeout(timeout);
        if (this.manuallyClosing || this.stopRequested) { this.settle(); return; }
        this.attemptReconnect();
      };

      socket.onerror = () => { clearTimeout(timeout); };
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
    this.callbacks.onStatus('reconnecting', `اتصال قطع شد؛ تلاش ${this.toFa(this.reconnectAttempts)} از ${this.toFa(MAX_RECONNECT)}…`);
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
    if (this.finalizeTimer) clearTimeout(this.finalizeTimer);
    this.clearReconnectTimer();
    this.callbacks.onFinished(this.getFinalText());
  }

  async start(): Promise<void> {
    this.callbacks.onStatus('connecting', 'در حال اتصال…');
    await this.openSocket();
  }

  sendAudioChunk(buf: ArrayBuffer) {
    this.bufferOrSend(Buffer.from(buf));
  }

  async stop(): Promise<string> {
    return new Promise((resolve) => {
      this.stopRequested = true;
      this.manuallyClosing = true;
      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.flushPending();
          this.ws.send(JSON.stringify({ type: 'finalize' }));
          this.ws.send('');
        } else { this.settle(); }
      } catch { this.settle(); }
      this.finalizeTimer = setTimeout(() => { this.settle(); }, FINALIZE_TIMEOUT);
    });
  }

  getFinalText(): string {
    return this.buildFullText([]);
  }
}