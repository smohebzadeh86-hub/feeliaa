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
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { query } from '../db/connection.js';
import { getFullSessionAudio } from './sessionAudioArchive.js';
import { transcribeFileAsync } from './asyncTranscribe.js';
import { treatmentUnits } from '../features/treatment-unit/index.js';
import type { SignMark } from './signMarkers.js';

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

// ⭐ (A1.7، 2026-09-26) قبلاً همه‌ی ردیف‌هایِ session_audio — شاملِ یادداشت‌هایِ صوتی (kind='note') — با concat
// demuxer چسبانده می‌شدند؛ سگمنتِ خراب concat را بی‌صدا وسطِ کار قطع می‌کرد و seqِ گمشده دیده نمی‌شد. نتیجه
// (صدایِ قاطی یا بریده) جایگزینِ کلِ متن پیشنهاد می‌شد. حالا همان فایلِ کاملِ ادمین (getFullSessionAudio: فقط
// kind='session'، decode-تستِ هر سگمنت، گزارشِ seqِ گمشده/خراب) استفاده می‌شود و صدایِ ناقص رد می‌شود.
async function fullSessionAudio(sessionId: string): Promise<{ audio: Buffer; ext: string }> {
  const full = await getFullSessionAudio(sessionId);
  if (!full.ok) throw new Error(full.message);
  if (!full.complete) {
    const parts: string[] = [];
    if (full.missingSegments.length) parts.push(`${full.missingSegments.length} بخشِ گمشده`);
    if (full.unreadableSegments.length) parts.push(`${full.unreadableSegments.length} بخشِ خراب`);
    throw new Error(`صدایِ آرشیوشده‌ی این جلسه کامل نیست (${parts.join('، ')}) — بازسازی انجام نمی‌شود تا بخشی از متن از دست نرود`);
  }
  return { audio: readFileSync(full.path), ext: path.extname(full.path) || '.webm' };
}

// متنِ بازسازی‌شده که خیلی کوتاه‌تر از متنِ فعلی است (صدایِ ناقص، رونویسیِ ناموفقِ بخشی) پیشنهاد نمی‌شود.
export const MIN_RESOLVED_RATIO = 0.6;

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
      const { audio, ext } = await fullSessionAudio(sessionId);
      // (2026-09-27) علائمِ ثبت‌شده‌ی جلسه در جایِ زمانیِ خودشان دوباره در متنِ بازسازی‌شده می‌آیند — وگرنه
      // «جایگزینیِ متن» نشانگرهایِ علامت را که حینِ جلسه داخلِ متن نوشته شده بودند پاک می‌کرد.
      const signs = await query("SELECT sign_type, offset_ms FROM session_notes WHERE session_id = ? AND type = 'sign'", [sessionId]);
      const context = await treatmentUnits.sessionSttContext(sessionId);
      const text = await transcribeFileAsync(audio, `${sessionId}-resolve${ext}`, `feelia:${sessionId}:resolve-speakers`,
        { signs: signs.rows as SignMark[], context });
      if (!text || !text.trim()) throw new Error('رونویسیِ دوباره متنی برنگردوند');
      const cur = await query('SELECT transcript FROM sessions WHERE id = ?', [sessionId]);
      const curLen = String(cur.rows[0]?.transcript || '').trim().length;
      if (curLen > 0 && text.trim().length < curLen * MIN_RESOLVED_RATIO) {
        const pct = Math.round((text.trim().length / curLen) * 100);
        throw new Error(`متنِ بازسازی‌شده فقط ${pct}٪ متنِ فعلی است — جایگزینی پیشنهاد نمی‌شود تا متنی از دست نرود`);
      }
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
