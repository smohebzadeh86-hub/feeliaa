// بازسازیِ اختیاریِ شماره‌گذاریِ گوینده‌ها — به‌درخواستِ صریحِ تراپیست، نه خودکار.
// چرا لازمه: مدلِ realtime هیچ حافظه‌ای بینِ اتصال‌های WebSocket نداره (نه مستندِ Soniox،
// ولی بدونِ هیچ پارامتری برای ادامه‌ش) — هر توقف/ادامه یا reconnect یعنی شماره‌گذاریِ
// گوینده‌ها از نو شروع می‌شه. راهِ واقعیِ یکدست‌کردنش: کلِ صدایِ آرشیوشده‌ی جلسه
// (session_audio) یک‌جا، با همون مدلِ async (stt-async-v5) که برایِ batch fallback
// ساختیم، دوباره رونویسی بشه — چون اون مدل کلِ فایل رو یک‌پارچه می‌بینه، هیچ قطعِ
// اتصالی وسطش نیست، پس شماره‌گذاری از اول تا آخر یکدست می‌مونه.
// این فقط PREVIEW برمی‌گردونه — اعمالِ نهایی از همون PUT /api/sessions/:id (CAS)ی
// موجود انجام می‌شه، تا کاربر خودش تصمیم بگیره جایگزین کنه یا نه.
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { listSessionAudio } from './sessionAudioArchive.js';
import { transcribeFileAsync } from './asyncTranscribe.js';

const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 5 * 60 * 1000 }, (err, _stdout, stderr) => {
      if (err) reject(new Error(String(stderr || err.message).slice(0, 500)));
      else resolve();
    });
  });
}

export async function checkFfmpegAvailable(): Promise<boolean> {
  try { await run(FFMPEG_BIN, ['-version']); return true; } catch { return false; }
}

// تمامِ سگمنت‌هایِ آرشیوشده (به‌ترتیبِ seq — همون ترتیبِ واقعیِ ضبط) رو با ffmpeg concat
// demuxer (بدونِ ری‌اینکود — چون کدک/بیت‌ریتِ همه‌ی سگمنت‌هایِ یک جلسه یکسانه) به یک
// فایلِ صوتیِ واحد و پیوسته تبدیل می‌کنه.
async function concatSessionAudio(sessionId: string): Promise<Buffer> {
  const rows = await listSessionAudio(sessionId);
  if (!rows.length) throw new Error('صدایی برایِ این جلسه آرشیو نشده است');

  const tmp = mkdtempSync(path.join(tmpdir(), 'feelia-speaker-resolve-'));
  try {
    const listPath = path.join(tmp, 'segments.txt');
    const listContent = rows
      .map((r) => `file '${r.path.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`)
      .join('\n');
    writeFileSync(listPath, listContent);
    const outPath = path.join(tmp, 'concat.webm');
    await run(FFMPEG_BIN, ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outPath]);
    return readFileSync(outPath);
  } finally {
    try { rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
}

export type ResolveJob = {
  status: 'processing' | 'done' | 'error';
  text?: string;
  error?: string;
  startedAt: number;
};

const jobs = new Map<string, ResolveJob>();

export function getResolveJob(sessionId: string): ResolveJob | null {
  return jobs.get(sessionId) || null;
}

// اگه جابِ در-حالِ-اجرا برایِ همین session باشه، همون رو برمی‌گردونه (بدونِ اجرایِ
// دوباره) — کلیکِ تکراریِ دکمه یا دوتب باز نباید دو رونویسیِ موازیِ هزینه‌بر بسازه.
export function startResolveSpeakers(sessionId: string): ResolveJob {
  const existing = jobs.get(sessionId);
  if (existing && existing.status === 'processing') return existing;

  const job: ResolveJob = { status: 'processing', startedAt: Date.now() };
  jobs.set(sessionId, job);

  (async () => {
    try {
      if (!(await checkFfmpegAvailable())) {
        throw new Error('ffmpeg رویِ سرور نصب نیست — این قابلیت بدونِ ffmpeg در دسترس نیست');
      }
      const audio = await concatSessionAudio(sessionId);
      const text = await transcribeFileAsync(audio, `${sessionId}-resolve.webm`, `feelia:${sessionId}:resolve-speakers`);
      if (!text || !text.trim()) throw new Error('رونویسیِ دوباره متنی برنگردوند');
      jobs.set(sessionId, { status: 'done', text: text.trim(), startedAt: job.startedAt });
    } catch (e) {
      jobs.set(sessionId, { status: 'error', error: String((e as Error).message || e).slice(0, 300), startedAt: job.startedAt });
    }
  })();

  return job;
}

// جاب‌هایِ خیلی قدیمی (فراموش‌شده) رو از حافظه پاک کن — نشتِ حافظه نداشته باشیم
export function sweepOldResolveJobs() {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [sid, job] of jobs) {
    if (job.startedAt < cutoff) jobs.delete(sid);
  }
}
