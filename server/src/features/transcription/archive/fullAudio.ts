import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { logEvent } from '../../../obs/eventLog.js';
import { mimeForExt } from '../batch/queueFiles.js';
import { sessionDir, withSessionLock } from './store.js';
import { listSessionAudio, checkSeqContiguous } from './listing.js';
import { runFfmpeg } from './ffmpegOps.js';

// ————————————————— فایلِ کاملِ جلسه (بخشِ F، audit صدا/۲۰۲۶-۰۹-۱۶) —————————————————
// تصمیمِ صریحِ مالک: پنلِ ادمین باید یک فایلِ کاملِ قابلِ‌دانلود نشان بدهد، نه لیستِ
// سگمنت‌به‌سگمنت. ذخیره‌سازیِ داخلی (تکه‌تکه، برایِ مقاومت در برابرِ کرش) دست‌نخورده
// می‌ماند؛ این تابع فقط برایِ *نمایش* سگمنت‌هایِ kind='session' را با ffmpeg به یک
// فایل می‌چسباند و کش می‌کند — اگر سگمنتِ جدیدی اضافه نشده (جلسه تمام شده، late-transcript
// هم چیزی اضافه نکرده)، دوباره ساخته نمی‌شود.
export type FullAudioResult =
  | { ok: true; path: string; mime: string; complete: boolean; missingSegments: number[]; unreadableSegments: number[] }
  | { ok: false; reason: 'no-ffmpeg' | 'no-audio' | 'build-failed'; message: string };

function fullAudioMetaPath(dir: string): string {
  return path.join(dir, 'full.meta.json');
}

// ⭐ (audit ذخیره‌سازی 2026-09-26، production): concat demuxer با رسیدن به اولین سگمنتِ غیرقابلِ‌decode
// (قطعه‌یِ بدونِ هدرِ WebM از raceِ چرخشِ durable پیش از 3e732b1) بی‌صدا متوقف می‌شد و بقیه‌ی سگمنت‌هایِ سالم
// را کنار می‌گذاشت — جلسه‌ی e78df1a5: ۲۶.۶ث صدایِ سالم، فایلِ کاملِ ادمین فقط ۸.۵ث. حالا هر سگمنت قبل از
// concat یک بار decode-تست می‌شود؛ سگمنتِ خراب کنار گذاشته و در نتیجه گزارش می‌شود (فایلِ خام دست نمی‌خورد).
// v3 (A2): ترتیبِ concat = ترتیبِ ضبط (sortByRecordingOrder) — کشِ v2 با ترتیبِ رسیدن ساخته شده بود.
const FULL_AUDIO_META_VERSION = 3;
async function segmentDecodes(p: string): Promise<boolean> {
  try { await runFfmpeg(['-v', 'error', '-i', p, '-t', '1', '-f', 'null', '-']); return true; } catch { return false; }
}

async function checkFfmpegAvailable(): Promise<boolean> {
  try { await runFfmpeg(['-version']); return true; } catch { return false; }
}

export async function getFullSessionAudio(sessionId: string): Promise<FullAudioResult> {
  return withSessionLock(`full:${sessionId}`, async () => {
    const rows = (await listSessionAudio(sessionId)).filter((r) => r.kind === 'session');
    if (!rows.length) return { ok: false, reason: 'no-audio', message: 'صدایی برایِ این جلسه آرشیو نشده است' };
    // بخشِ ۵ی audit «zero-loss recording» (2026-09-22): قبلاً این تابع صرفاً هر چه رویِ
    // دیسک بود را concat می‌کرد — اگه سگمنتی هیچ‌وقت آپلود نشده بود (تبِ مرورگر قبل از
    // sync بسته شده)، فایلِ نهایی بدونِ خطا ولی با gapِ خاموش ساخته می‌شد. الان همون چکِ
    // seq (که در `/api/admin/sessions/:id/audio` هم استفاده می‌شود) مستقیماً همینجا هم
    // محاسبه و در نتیجه برگردانده می‌شود — fail-open: فایل هنوز ساخته/سرو می‌شود، فقط
    // caller دیگر نمی‌تواند ادعا کند که «کامل» بودنش تضمین‌شده است.
    const { complete, missing: missingSegments } = checkSeqContiguous(rows);

    const dir = sessionDir(sessionId);
    const metaPath = fullAudioMetaPath(dir);
    // کش: اگه شمارشِ سگمنت‌ها از آخرین ساختِ فایلِ کامل عوض نشده، همون فایلِ قبلی معتبره.
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as { v?: number; segCount: number; path: string; mime: string; unreadable?: number[] };
      if (meta.v === FULL_AUDIO_META_VERSION && meta.segCount === rows.length && existsSync(meta.path)) {
        const unreadableSegments = meta.unreadable || [];
        return { ok: true, path: meta.path, mime: meta.mime, complete: complete && !unreadableSegments.length, missingSegments, unreadableSegments };
      }
    } catch {
      // فایلِ meta نیست یا خراب است — دوباره می‌سازیم
    }

    if (!(await checkFfmpegAvailable())) {
      return { ok: false, reason: 'no-ffmpeg', message: 'این قابلیت بدونِ ffmpeg در دسترس نیست' };
    }

    const unreadableSegments: number[] = [];
    const allRows = rows;
    const readable: typeof rows = [];
    for (const r of allRows) {
      if (existsSync(r.path) && (await segmentDecodes(r.path))) readable.push(r);
      else unreadableSegments.push(r.seq);
    }
    if (!readable.length) return { ok: false, reason: 'build-failed', message: 'هیچ‌کدام از سگمنت‌هایِ صدایِ این جلسه قابلِ پخش نیست' };
    const segRows = readable;
    const exts = new Set(segRows.map((r) => path.extname(r.path).slice(1) || 'webm'));
    const uniform = exts.size === 1;
    const outExt = uniform ? [...exts][0] : 'webm';
    const outPath = path.join(dir, `full.${outExt}`);
    const outMime = mimeForExt(outExt);

    try {
      if (uniform) {
        // مسیرِ سریع: همه‌ی سگمنت‌ها یک container/codec دارن → concat demuxer بدونِ ری‌اینکود.
        const listPath = path.join(dir, 'full.concat-list.txt');
        const listContent = segRows
          .map((r) => `file '${r.path.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`)
          .join('\n');
        writeFileSync(listPath, listContent);
        try {
          await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outPath]);
        } finally {
          try { rmSync(listPath, { force: true }); } catch {}
        }
      } else {
        // سگمنت‌هایِ همین جلسه container/codecِ متفاوت دارن (نادر — مثلاً تغییرِ مرورگر
        // وسطِ جلسه)؛ concat demuxerِ بدونِ ری‌اینکود اینجا کار نمی‌کنه — با
        // filter_complex هر ورودی جدا decode و به یک استریمِ واحدِ opus می‌چسبد.
        const args = ['-y'];
        segRows.forEach((r) => { args.push('-i', r.path); });
        const filter = segRows.map((_, i) => `[${i}:a]`).join('') + `concat=n=${segRows.length}:v=0:a=1[out]`;
        args.push('-filter_complex', filter, '-map', '[out]', '-c:a', 'libopus', outPath);
        await runFfmpeg(args);
      }
    } catch (e) {
      return { ok: false, reason: 'build-failed', message: String((e as Error).message || e).slice(0, 300) };
    }

    try {
      writeFileSync(metaPath, JSON.stringify({ v: FULL_AUDIO_META_VERSION, segCount: allRows.length, path: outPath, mime: outMime, unreadable: unreadableSegments }));
    } catch {}
    if (unreadableSegments.length) {
      logEvent({ event: 'audio.segment_unreadable', sessionId, source: 'server', severity: 'warn', detail: { count: unreadableSegments.length } });
    }
    return { ok: true, path: outPath, mime: outMime, complete: complete && !unreadableSegments.length, missingSegments, unreadableSegments };
  });
}
