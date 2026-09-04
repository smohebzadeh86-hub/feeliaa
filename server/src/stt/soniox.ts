// موتور رونویسی Soniox — نسخه‌ی سروری
// منطق از v1.9.3 — backoff نمایی + بافر قطعی + watchdog

export interface SonioxToken {
  text: string;
  is_final: boolean;
  speaker?: number;
}

export interface SonioxCallbacks {
  onTokens: (tokens: SonioxToken[]) => void;
  onStatus: (status: 'connecting' | 'connected' | 'reconnecting' | 'error', message?: string) => void;
  onFinished: (finalText: string) => void;
  onError: (error: string) => void;
}

const SONIOX_WS_URL = 'wss://stt-rt.soniox.com/transcribe-websocket';
const SONIOX_MODEL = 'stt-rt-v5';

// تنظیمات
const RECONNECT_BASE_DELAY = 1000;
const MAX_RECONNECT = 6;
const CONNECT_TIMEOUT = 8000;
const FINALIZE_TIMEOUT = 8000;
const MAX_BUFFER_CHUNKS = 200;

export class SonioxEngine {
  private ws: WebSocket | null = null;
  private callbacks: SonioxCallbacks;
  private apiKey: string;
  
  private finalText = '';
  private lastSpeaker: number | null = null;
  private pendingChunks: ArrayBuffer[] = [];
  private stopRequested = false;
  private manuallyClosing = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private finalizeTimer: ReturnType<typeof setTimeout> | null = null;
  private settleResolve: ((text: string) => void) | null = null;

  constructor(apiKey: string, callbacks: SonioxCallbacks) {
    this.apiKey = apiKey;
    this.callbacks = callbacks;
  }

  private toFa(num: number): string {
    return String(num).replace(/[0-9]/g, d => '