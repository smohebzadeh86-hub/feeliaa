// بررسی و نرمال‌سازیِ فایلِ صوتیِ آپلودی با ffmpeg (رویِ production نصب است — 8.0.1).
//
// چرا نرمال‌سازی: تراپیست با هر اپِ ضبطی کار می‌کند (m4a آیفون، amr/3gp اندرویدهایِ قدیمی، wav،
// opus/ogg پیام‌رسان‌ها، حتی ویدیوی mp4). همه به یک فرمتِ واحد تبدیل می‌شوند: Opus در Ogg، mono،
// 16kHz، 32kbps — (۱) Soniox مستقیماً می‌پذیرد، (۲) یک ساعت ≈ ۱۴MB (فایلِ WAVِ ۶۰۰MB هم همین
// می‌شود ⇒ آپلود به Soniox و آرشیوِ ۱۴روزه سبک است)، (۳) تراپیست هرگز لازم نیست فایل را دستی تبدیل کند.
//
// امنیت: ffmpeg رویِ فایلِ دلخواهِ کاربر اجرا می‌شود ⇒ فقط demuxerهایِ صوتی/ویدیوییِ رایج
// (-format_whitelist) و فقط پروتکلِ file (-protocol_whitelist) مجازند — فایلِ playlist/HLS/concat که
// ffmpeg را به خواندنِ مسیر/URLِ دیگر وادار کند رد می‌شود. همه‌ی آرگومان‌ها آرایه‌اند (execFile، بدونِ shell).
import { execFile } from 'node:child_process';
import { openSync, readSync, closeSync } from 'node:fs';

const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';

// نام‌هایِ demuxer در ffmpeg (mov یک demuxer با چند نام است: mov,mp4,m4a,3gp,3g2,mj2).
export const FORMAT_WHITELIST = [
  'mov', 'mp4', 'm4a', '3gp', '3g2', 'mj2',
  'matroska', 'webm', 'ogg', 'mp3', 'wav', 'w64', 'flac', 'aac', 'amr', 'amrnb', 'amrwb',
  'asf', 'aiff', 'caf', 'wv',
].join(',');

// پسوندهایی که در UI و سرور پذیرفته می‌شوند (فقط برایِ ردِ زودِ فایلِ آشکارا غیرِصوتی؛ تصمیمِ
// نهایی با probeِ واقعیِ ffmpeg است، نه پسوند — پسوندِ جعلی هیچ امتیازی نمی‌دهد).
export const ACCEPTED_EXTENSIONS = [
  'mp3', 'm4a', 'mp4', 'aac', 'wav', 'ogg', 'oga', 'opus', 'webm', 'weba', 'flac', 'amr',
  '3gp', '3gpp', '3ga', 'wma', 'asf', 'aif', 'aiff', 'caf', 'mkv', 'mka', 'mov', 'm4b', 'wv',
];

export const MAX_DURATION_MS = 300 * 60 * 1000; // سقفِ خودِ Soniox برایِ هر فایل (تصمیمِ مالک: ۳۰۰ دقیقه)

export function extensionOf(name: string): string {
  const m = /\.([a-zA-Z0-9]{1,6})$/.exec(String(name || '').trim());
  return m ? m[1].toLowerCase() : '';
}

// ردِ سریعِ فایل‌هایی که قطعاً صدا نیستند (PDF/ZIP/تصویر/اجرایی) با magic bytes — پیش از ffmpeg.
export function sniffObviouslyNotAudio(filePath: string): string | null {
  let fd: number | null = null;
  try {
    fd = openSync(filePath, 'r');
    const b = Buffer.alloc(16);
    const n = readSync(fd, b, 0, 16, 0);
    if (n < 4) return 'too-small';
    const s4 = b.subarray(0, 4).toString('latin1');
    if (s4 === '%PDF') return 'pdf';
    if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05)) return 'zip';
    if (b[0] === 0x89 && s4.slice(1) === 'PNG') return 'png';
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
    if (b[0] === 0x4d && b[1] === 0x5a) return 'exe';
    if (s4 === '\x7fELF') return 'elf';
    if (s4.startsWith('#EXT') || s4 === 'ffco') return 'playlist';
    return null;
  } catch {
    return 'unreadable';
  } finally {
    if (fd !== null) try { closeSync(fd); } catch {}
  }
}

function run(args: string[], timeoutMs: number): Promise<{ code: number; stderr: string; missing: boolean }> {
  return new Promise((resolve) => {
    execFile(FFMPEG_BIN, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (err: any, _stdout, stderr) => {
      const code = err ? (typeof err.code === 'number' ? err.code : -1) : 0;
      resolve({ code, stderr: String(stderr || (err && err.message) || ''), missing: !!err && err.code === 'ENOENT' });
    });
  });
}

function inputArgs(filePath: string): string[] {
  return ['-hide_banner', '-nostdin', '-protocol_whitelist', 'file', '-format_whitelist', FORMAT_WHITELIST, '-i', filePath];
}

export interface ProbeResult {
  ok: boolean;
  hasAudio: boolean;
  durationMs: number | null;
  reason?: 'no-ffmpeg' | 'unreadable' | 'no-audio';
}

export function parseProbe(stderr: string): { hasAudio: boolean; durationMs: number | null } {
  const hasAudio = /Stream #\d+:\d+[^\n]*: Audio:/.test(stderr);
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  const durationMs = m ? Math.round((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000) : null;
  return { hasAudio, durationMs: Number.isFinite(durationMs as number) ? durationMs : null };
}

// ffmpeg با «-i file» بدونِ خروجی همیشه کدِ غیرِصفر می‌دهد ولی متادیتا را در stderr می‌نویسد.
export async function probeMedia(filePath: string): Promise<ProbeResult> {
  const r = await run(inputArgs(filePath), 60 * 1000);
  if (r.missing) return { ok: false, hasAudio: false, durationMs: null, reason: 'no-ffmpeg' };
  if (!/Input #0/.test(r.stderr)) return { ok: false, hasAudio: false, durationMs: null, reason: 'unreadable' };
  const p = parseProbe(r.stderr);
  if (!p.hasAudio) return { ok: false, hasAudio: false, durationMs: p.durationMs, reason: 'no-audio' };
  return { ok: true, hasAudio: true, durationMs: p.durationMs };
}

export interface NormalizeResult {
  ok: boolean;
  outPath?: string;
  mime?: string;
  durationMs?: number | null;
  error?: string;
}

// خروجی: Opus/Ogg. اگر ffmpegِ نصب‌شده libopus نداشت، AAC/M4A (Soniox هر دو را می‌پذیرد).
export async function normalizeAudio(srcPath: string, outBase: string, sourceDurationMs: number | null): Promise<NormalizeResult> {
  // زمانِ مجاز متناسب با طولِ صدا (تبدیل معمولاً ۵۰–۲۰۰ برابر سریع‌تر از real-time است).
  const timeoutMs = Math.max(5 * 60 * 1000, Math.ceil((sourceDurationMs || 0) / 10));
  const common = [...inputArgs(srcPath), '-map', '0:a:0', '-vn', '-sn', '-dn', '-ac', '1', '-ar', '16000'];
  const opusOut = outBase + '.ogg';
  let r = await run(['-y', ...common, '-c:a', 'libopus', '-b:a', '32k', '-application', 'voip', opusOut], timeoutMs);
  if (r.code === 0) {
    const p = await probeMedia(opusOut);
    return { ok: true, outPath: opusOut, mime: 'audio/ogg', durationMs: p.durationMs };
  }
  if (/Unknown encoder|Encoder not found|libopus/i.test(r.stderr)) {
    const aacOut = outBase + '.m4a';
    r = await run(['-y', ...common, '-c:a', 'aac', '-b:a', '48k', aacOut], timeoutMs);
    if (r.code === 0) {
      const p = await probeMedia(aacOut);
      return { ok: true, outPath: aacOut, mime: 'audio/mp4', durationMs: p.durationMs };
    }
  }
  return { ok: false, error: r.stderr.slice(-300) };
}
