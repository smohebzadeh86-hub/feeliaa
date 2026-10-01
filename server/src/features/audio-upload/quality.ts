// سنجشِ کیفیتِ فایلِ صوتیِ آپلودی (پلنِ B، بخشِ ۱) — portِ createAudioQualityMonitor (public/feelia-rt.js) برایِ فایل.
//
// چرا فقط «علتِ احتمالی» و نه هشدار: فاز ۰B (verification/2026-09-28-upload-audio-quality-phase0b.md) نشان داد
// Soniox در برابرِ صدایِ آرام تا −50dB، وزوز و نویزِ ایستا تا SNR 0 و clipping +20 مقاوم است و سنجه‌هایِ سطح
// نمی‌توانند نویزِ بی‌خطر را از همهمه‌یِ خطرناک جدا کنند. هشدار از confidenceِ Soniox می‌آید (lowConfidenceRatio در
// stt/asyncTranscribe.ts)؛ این flagها فقط علت را برایِ پیام و «نکته برایِ ضبطِ بعدی» می‌گویند.
//
// دو بخش: (۱) منطقِ خالص (FileQualityMeter) که harness بدونِ ffmpeg تستش می‌کند، (۲) adapterِ ffmpeg که فایلِ
// نرمال‌شده را به PCMِ float32 ِ ۱۶kHz تبدیل و stream می‌کند (کلِ فایل هرگز در حافظه نمی‌آید).
// fail-open: هر خطایی ⇒ null و jobِ آپلود بی‌تغییر ادامه می‌دهد.
import { spawn } from 'node:child_process';
import { FORMAT_WHITELIST } from './media.js';
import { FFMPEG_BIN } from '../../shared/ffmpeg.js';

export type QualityFlag = 'no_signal' | 'too_quiet' | 'clipping' | 'noisy';

export interface AudioQuality {
  p10_db: number;
  p95_db: number;
  clip_frac: number;
  windows: number;
  flagged_windows: Partial<Record<QualityFlag, number>>;
  flags: QualityFlag[];
  // بازه‌هایِ «صدادار» [شروع، پایان] به ms (VADِ انرژی، speechSpans) — ورودیِ پوششِ متن در transcriptMetrics.ts.
  // null/نبود ⇒ نامعلوم (فایلِ قدیمی، یا گفتار از نویز قابلِ تفکیک نبود). فقط زمان، بدونِ هیچ صدا/متن. به UI نمی‌رود.
  speech_spans?: Array<[number, number]> | null;
}

// آستانه‌ها: همان ضبطِ زنده، به‌جز too_quiet که فاز ۰B نشان داد −45 مثبتِ کاذب دارد (فایلِ −30dB و −40dB بی‌آسیب
// بودند و اولین آسیب در p95 ≈ −65 دیده شد).
export const QUALITY = {
  SAMPLE_RATE: 16000,
  FRAME_MS: 50,
  WINDOW_S: 30,
  NO_SIGNAL_DB: -85,
  QUIET_DB: -60,
  NOISY_FLOOR_DB: -40,
  NOISY_SNR_DB: 12,
  CLIP_PEAK: 0.99,
  CLIP_FRAC: 0.02,
  // flag وقتی دستِ‌کم این سهم از پنجره‌ها همان مشکل را دارند — سکوتِ عادیِ جلسه در چند پنجره flag نمی‌سازد.
  MIN_WINDOW_SHARE: 0.3,
  // پنجره‌ی آخرِ کوتاه‌تر از این سهم از یک پنجره قضاوت نمی‌شود.
  MIN_WINDOW_FILL: 1 / 3,
  // VADِ انرژی برایِ «پوششِ متن» (Session Data Engine، 2026-10-01): قابِ صدادار = بلندتر از کفِ نویز (p10) + این مقدار
  // و دست‌کم VAD_MIN_DB. اگر p95 − p10 کمتر از VAD_MIN_RANGE_DB باشد گفتار از نویز جدا نمی‌شود ⇒ بازه‌ها نامعلوم (null).
  VAD_ABOVE_FLOOR_DB: 10,
  VAD_MIN_DB: -70,
  VAD_MIN_RANGE_DB: 12,
  // مکث‌هایِ کوتاه‌تر از این بخشی از همان بازه‌اند؛ بازه‌هایِ کوتاه‌تر از VAD_MIN_SPAN_MS (تق/کلیک) دور ریخته می‌شوند.
  VAD_BRIDGE_MS: 1000,
  VAD_MIN_SPAN_MS: 250,
} as const;

// بازه‌هایِ صدادار از dBِ هر قاب (خالص؛ harness مستقیم تستش می‌کند).
export function speechSpans(frameDb: ArrayLike<number>, frameMs: number, p10: number, p95: number): Array<[number, number]> | null {
  if (!frameDb.length || p95 - p10 < QUALITY.VAD_MIN_RANGE_DB) return null;
  const thr = Math.max(p10 + QUALITY.VAD_ABOVE_FLOOR_DB, QUALITY.VAD_MIN_DB);
  const raw: Array<[number, number]> = [];
  let start = -1;
  for (let i = 0; i <= frameDb.length; i++) {
    const on = i < frameDb.length && frameDb[i] >= thr;
    if (on && start < 0) start = i;
    else if (!on && start >= 0) { raw.push([start * frameMs, i * frameMs]); start = -1; }
  }
  const out: Array<[number, number]> = [];
  for (const s of raw) {
    const last = out[out.length - 1];
    if (last && s[0] - last[1] < QUALITY.VAD_BRIDGE_MS) last[1] = s[1];
    else out.push([s[0], s[1]]);
  }
  return out.filter((s) => s[1] - s[0] >= QUALITY.VAD_MIN_SPAN_MS);
}

const FRAME = Math.round((QUALITY.SAMPLE_RATE * QUALITY.FRAME_MS) / 1000);
const FRAMES_PER_WINDOW = Math.round((QUALITY.WINDOW_S * 1000) / QUALITY.FRAME_MS);

interface Hist { bins: Uint32Array; frames: number; clipped: number; }
const newHist = (): Hist => ({ bins: new Uint32Array(101), frames: 0, clipped: 0 });

// dBِ صدکِ p از هیستوگرامِ ۱dB (−100..0) — همان روشِ ضبطِ زنده.
function pct(h: Hist, p: number): number {
  const target = h.frames * p;
  let acc = 0;
  for (let i = 0; i <= 100; i++) { acc += h.bins[i]; if (acc >= target) return i - 100; }
  return 0;
}

export function classifyWindow(p10: number, p95: number, clipFrac: number): QualityFlag | null {
  if (clipFrac > QUALITY.CLIP_FRAC) return 'clipping';
  if (p95 < QUALITY.NO_SIGNAL_DB) return 'no_signal';
  if (p95 < QUALITY.QUIET_DB) return 'too_quiet';
  if (p10 > QUALITY.NOISY_FLOOR_DB && p95 - p10 < QUALITY.NOISY_SNR_DB) return 'noisy';
  return null;
}

export class FileQualityMeter {
  private whole = newHist();
  private win = newHist();
  private frameBuf = new Float32Array(FRAME);
  private frameFill = 0;
  private windowIssues: Array<QualityFlag | null> = [];
  // dBِ گردشده‌ی هر قاب برایِ speechSpans (۱ بایت در هر ۵۰ms ⇒ ۷۲KB برایِ ۱ ساعت).
  private frameDb = new Int8Array(4096);
  private nFrames = 0;

  push(samples: Float32Array): void {
    let i = 0;
    while (i < samples.length) {
      const n = Math.min(FRAME - this.frameFill, samples.length - i);
      this.frameBuf.set(samples.subarray(i, i + n), this.frameFill);
      this.frameFill += n;
      i += n;
      if (this.frameFill === FRAME) { this.frame(this.frameBuf); this.frameFill = 0; }
    }
  }

  private frame(f: Float32Array): void {
    let sum = 0;
    let peak = 0;
    for (let j = 0; j < f.length; j++) { const v = f[j]; sum += v * v; const a = v < 0 ? -v : v; if (a > peak) peak = a; }
    const db = 10 * Math.log10(sum / f.length + 1e-12);
    const bin = Math.max(0, Math.min(100, Math.round(db) + 100));
    if (this.nFrames === this.frameDb.length) {
      const grown = new Int8Array(this.frameDb.length * 2);
      grown.set(this.frameDb);
      this.frameDb = grown;
    }
    this.frameDb[this.nFrames++] = bin - 100;
    for (const h of [this.whole, this.win]) {
      h.bins[bin]++;
      h.frames++;
      if (peak >= QUALITY.CLIP_PEAK) h.clipped++;
    }
    if (this.win.frames >= FRAMES_PER_WINDOW) this.closeWindow();
  }

  private closeWindow(): void {
    const w = this.win;
    if (w.frames >= FRAMES_PER_WINDOW * QUALITY.MIN_WINDOW_FILL) {
      this.windowIssues.push(classifyWindow(pct(w, 0.10), pct(w, 0.95), w.clipped / w.frames));
    }
    this.win = newHist();
  }

  // null ⇒ صدایِ کافی برایِ قضاوت نبود (کمتر از یک قاب).
  finish(): AudioQuality | null {
    if (this.win.frames) this.closeWindow();
    const h = this.whole;
    if (!h.frames) return null;
    const p10 = pct(h, 0.10);
    const p95 = pct(h, 0.95);
    const clipFrac = h.clipped / h.frames;
    const counts: Partial<Record<QualityFlag, number>> = {};
    for (const x of this.windowIssues) if (x) counts[x] = (counts[x] || 0) + 1;
    const flags: QualityFlag[] = [];
    const nWin = this.windowIssues.length;
    if (nWin >= 3) {
      for (const f of ['no_signal', 'too_quiet', 'clipping', 'noisy'] as QualityFlag[]) {
        if ((counts[f] || 0) / nWin >= QUALITY.MIN_WINDOW_SHARE) flags.push(f);
      }
    } else {
      // فایلِ کوتاه (کمتر از ۹۰ث): پنجره‌ها برایِ سهم کافی نیستند ⇒ قضاوت رویِ کلِ فایل.
      const f = classifyWindow(p10, p95, clipFrac);
      if (f) flags.push(f);
    }
    const speech_spans = speechSpans(this.frameDb.subarray(0, this.nFrames), QUALITY.FRAME_MS, p10, p95);
    return { p10_db: p10, p95_db: p95, clip_frac: Math.round(clipFrac * 1000) / 1000, windows: nWin, flagged_windows: counts, flags, speech_spans };
  }
}

// پاک‌سازیِ JSONِ ذخیره‌شده (ستونِ audio_jobs.audio_quality) پیش از برگرداندن به UI: فقط flagهایِ شناخته‌شده.
const KNOWN: QualityFlag[] = ['no_signal', 'too_quiet', 'clipping', 'noisy'];
export function parseAudioQuality(raw: unknown): AudioQuality | null {
  if (!raw) return null;
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!v || typeof v !== 'object' || !Array.isArray((v as any).flags)) return null;
    return { ...(v as AudioQuality), flags: (v as any).flags.filter((f: unknown) => KNOWN.includes(f as QualityFlag)) };
  } catch {
    return null;
  }
}

// ——————————————— adapterِ ffmpeg ———————————————

export function measureAudioQuality(filePath: string, durationMs: number | null = null): Promise<AudioQuality | null> {
  // decodeِ opusِ ۱۶kHz بسیار سریع‌تر از real-time است؛ سقف مثلِ normalizeAudio متناسب با طول.
  const timeoutMs = Math.max(2 * 60_000, Math.ceil((durationMs || 0) / 5));
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: AudioQuality | null) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn(FFMPEG_BIN, [
        '-hide_banner', '-nostdin', '-v', 'error', '-protocol_whitelist', 'file', '-format_whitelist', FORMAT_WHITELIST,
        '-i', filePath, '-map', '0:a:0', '-vn', '-ac', '1', '-ar', String(QUALITY.SAMPLE_RATE), '-f', 'f32le', 'pipe:1',
      ], { stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} finish(null); }, timeoutMs);
    const meter = new FileQualityMeter();
    let rest: Buffer | null = null;
    proc.stdout!.on('data', (chunk: Buffer) => {
      const buf = rest ? Buffer.concat([rest, chunk]) : chunk;
      const usable = buf.length - (buf.length % 4);
      rest = usable < buf.length ? Buffer.from(buf.subarray(usable)) : null;
      if (!usable) return;
      // کپی به ArrayBufferِ هم‌تراز (offsetِ Buffer ممکن است مضربِ ۴ نباشد)
      const f = new Float32Array(usable / 4);
      Buffer.from(f.buffer).set(buf.subarray(0, usable));
      meter.push(f);
    });
    proc.on('error', () => finish(null));
    proc.on('close', (code: number | null) => finish(code === 0 ? meter.finish() : null));
  });
}
