// اجرایِ ffmpeg برایِ آرشیو: ری‌ماکس (هدرِ WebM) و خواندنِ مدت. timeout و مدیریتِ خطایِ همین ماژول (نه مشترک با آپلود).
import { execFile } from 'node:child_process';
import { renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { FFMPEG_BIN } from '../../../shared/ffmpeg.js';

export function runFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG_BIN, args, { timeout: 60 * 1000 }, (err, _stdout, stderr) => {
      if (err) reject(new Error(String(stderr || err.message).slice(-500)));
      else resolve(String(stderr || ''));
    });
  });
}

function parseDurationMs(ffmpegStderr: string): number | null {
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(ffmpegStderr);
  if (!m) return null;
  const ms = (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000;
  return Number.isFinite(ms) ? Math.round(ms) : null;
}

// ffmpeg با «-i file» بدونِ خروجی همیشه با کدِ غیرِصفر خارج می‌شود، ولی متادیتایِ
// فایل (شاملِ Duration) را قبل از آن در stderr می‌نویسد — همین‌جا آن را می‌خوانیم.
export function probeDurationMs(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    execFile(FFMPEG_BIN, ['-i', filePath], { timeout: 30 * 1000 }, (_err, _stdout, stderr) => {
      resolve(parseDurationMs(String(stderr || '')));
    });
  });
}

// خروجیِ خامِ MediaRecorderِ مرورگر معمولاً Segment Duration را در هدرِ WebM نمی‌نویسد
// (محدودیتِ شناخته‌شده‌ی Chromium) → audio.duration در مرورگر Infinity/NaN می‌شود و
// <audio controls> آن را 0:00 نشان می‌دهد. ری‌ماکسِ بدونِ ری‌اینکود (-c copy) این هدر را
// درست می‌نویسد. اگر ffmpeg نصب نباشد یا ری‌ماکس خطا بدهد، فایلِ خامِ اصلی دست‌نخورده
// می‌ماند — آرشیو هرگز نباید به همین دلیل شکست بخورد (fail-open).
export async function remuxAndGetDuration(filePath: string): Promise<number | null> {
  // پسوندِ فایلِ موقت باید همان پسوندِ واقعی (webm/ogg) بماند، وگرنه ffmpeg از رویِ
  // نامِ خروجی نمی‌تواند فرمتِ container را حدس بزند و با خطای «Unable to choose an
  // output format» شکست می‌خورد (در تست دیده شد: `.remux.tmp` باعثِ همین خطا می‌شود).
  const ext = path.extname(filePath);
  const tmpPath = filePath.slice(0, -ext.length) + '.remux' + ext;
  try {
    await runFfmpeg(['-y', '-i', filePath, '-c', 'copy', tmpPath]);
    renameSync(tmpPath, filePath);
  } catch (e) {
    try { rmSync(tmpPath, { force: true }); } catch {}
    console.log('[session-audio] remux failed, keeping raw file:', String((e as Error).message || e).slice(-300));
    return null;
  }
  // مدت‌زمان را از رویِ فایلِ نهاییِ ری‌ماکس‌شده probe می‌کنیم، نه ورودیِ خام —
  // ورودیِ خامِ headerless معمولاً «Duration: N/A» گزارش می‌دهد حتی وقتی ری‌ماکس
  // خودش موفق بوده و هدرِ فایلِ خروجی را درست نوشته است.
  return probeDurationMs(filePath);
}
