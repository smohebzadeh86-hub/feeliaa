// آرشیوِ صدایِ جلسات — فقط برایِ بازبینیِ ادمین (پیداکردنِ ریشه‌ی باگ‌هایِ STT).
// جدا از data/batch-queue (که یه صفِ گذرا برایِ رونویسیه و بعدِ موفقیت پاک می‌شه):
// این یه آرشیوِ عمدیه، با نگه‌داریِ محدود (پیش‌فرض ۱۴ روز)، فقط پشتِ requireAdmin
// قابلِ‌شنیدنه — نه تراپیست، نه هیچ کاربرِ عادی.
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { query } from '../db/connection.js';
import { extForMime, mimeForExt } from './batchqueue.js';

const ARCHIVE_DIR = path.join(process.cwd(), 'data', 'session-audio');
const RETENTION_MS = 14 * 24 * 60 * 60 * 1000; // ۱۴ روز — طبقِ تصمیمِ تیم
const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';

function ensureArchiveDir() {
  if (!existsSync(ARCHIVE_DIR)) mkdirSync(ARCHIVE_DIR, { recursive: true });
}

function runFfmpeg(args: string[]): Promise<string> {
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
function probeDurationMs(filePath: string): Promise<number | null> {
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
async function remuxAndGetDuration(filePath: string): Promise<number | null> {
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

function sessionDir(sessionId: string): string {
  const safe = String(sessionId).replace(/[^a-zA-Z0-9-]/g, '');
  return path.join(ARCHIVE_DIR, safe);
}

export type AudioSource = 'durable' | 'offline' | 'upload';
export type AudioKind = 'session' | 'note';

// قفلِ per-session: بدونِ این، دو archiveAudioForAdmin هم‌زمان رویِ یک جلسه ممکنه
// هر دو همون MAX(seq) قدیمی رو ببینن و با seqِ یکسان تصادم/بازنویسی کنن (LAW-013:
// runtime تک‌پروسه‌ایه، پس این قفلِ in-memory برایِ همین سرور کافیه).
const sessionLocks = new Map<string, Promise<unknown>>();
function withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  const prev = sessionLocks.get(sessionId) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  sessionLocks.set(sessionId, run.catch(() => {}));
  return run;
}

// بعدِ رونویسیِ موفقِ یک سگمنت، به‌جایِ پاک‌کردنِ صدا، یه نسخه این‌جا نگه داشته می‌شه.
// باگِ بحرانیِ قبلی: seq از کلاینت می‌اومد و ON DUPLICATE KEY UPDATE می‌کرد — دو
// runِ مختلف (یادداشتِ صوتی، یا ادامه‌ی جلسه بعدِ رفرش) هر دو از seq=0 شروع می‌کردن
// و صدایِ همدیگه رو بی‌صدا بازنویسی می‌کردن. الان seqِ نهایی رو خودِ سرور، زیرِ قفل،
// به‌صورتِ MAX(seq)+1 تعیین می‌کنه — هیچ archiveِ موفقی هرگز بازنویسی نمی‌شه؛ و
// sha256 باعث می‌شه retryِ آپلودِ همون بایت‌ها (بعدِ ۴۰۰/۵۰۰ی گذرا) ردیفِ تکراری نسازه.
export async function archiveAudioForAdmin(
  sessionId: string,
  clientSeq: number,
  buffer: Buffer,
  mime: string | null,
  source: AudioSource = 'durable',
  runId = 'legacy',
  kind: AudioKind = 'session'
): Promise<void> {
  return withSessionLock(sessionId, async () => {
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const existing = await query(
      'SELECT id FROM session_audio WHERE session_id = ? AND sha256 = ?',
      [sessionId, sha256]
    );
    if (existing.rows.length) {
      // idempotent: همین بایت‌ها قبلاً آرشیو شده (retry بعدِ خطایِ گذرا) — کارِ اضافه نکن
      return;
    }
    ensureArchiveDir();
    const dir = sessionDir(sessionId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    // seq فقط در همان kind باید پیوسته باشد — kind='note' و kind='session' دو جریانِ
    // مستقل‌اند؛ قبلاً یک شمارنده‌ی seq مشترک بین هر دو باعثِ gapِ کاذب در
    // checkSeqContiguous می‌شد (که فقط rows.kind==='session' را چک می‌کند).
    const maxRow = await query('SELECT MAX(seq) AS m FROM session_audio WHERE session_id = ? AND kind = ?', [sessionId, kind]);
    const nextSeq: number = (maxRow.rows[0]?.m ?? -1) + 1;
    // mimeِ واقعیِ کلاینت (audit صدا/۲۰۲۶-۰۹-۱۶، بخشِ E) — فایرفاکس ogg، سافاری mp4/aac می‌فرستد.
    const ext = extForMime(mime || '');
    const filePath = path.join(dir, `${String(nextSeq).padStart(6, '0')}.${ext}`);
    writeFileSync(filePath, buffer);
    const durationMs = await remuxAndGetDuration(filePath);
    let bytes = buffer.length;
    try { bytes = statSync(filePath).size; } catch {}
    await query(
      `INSERT INTO session_audio (id, session_id, seq, path, bytes, mime, source, run_id, kind, sha256, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), sessionId, nextSeq, filePath, bytes, mime, source, String(runId).slice(0, 64), kind, sha256, durationMs]
    );
    void clientSeq; // فقط برایِ لاگ/دیباگ نگه داشته می‌شه، دیگه seqِ نهایی نیست
  });
}

// نسخه‌ی مسیر-محورِ archiveAudioForAdmin برایِ فایلِ آپلودشده‌ی نرمال‌شده (migration 023) — فایلِ
// چندساعته هرگز کامل در RAM نمی‌آید: sha256 به‌صورتِ stream، و خودِ فایل با rename جابه‌جا می‌شود.
// idempotent مثلِ نسخه‌ی buffer: همان بایت‌ها ⇒ همان ردیف (نسخه‌ی تازه پاک می‌شود).
export async function archiveAudioFileForAdmin(
  sessionId: string,
  srcPath: string,
  mime: string,
  runId: string
): Promise<{ path: string; sha256: string; durationMs: number | null }> {
  const sha256 = await sha256OfFile(srcPath);
  return withSessionLock(sessionId, async () => {
    const existing = await query(
      'SELECT path, duration_ms FROM session_audio WHERE session_id = ? AND sha256 = ?',
      [sessionId, sha256]
    );
    if (existing.rows.length && existsSync(existing.rows[0].path)) {
      try { rmSync(srcPath, { force: true }); } catch {}
      return { path: existing.rows[0].path, sha256, durationMs: existing.rows[0].duration_ms ?? null };
    }
    ensureArchiveDir();
    const dir = sessionDir(sessionId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const maxRow = await query("SELECT MAX(seq) AS m FROM session_audio WHERE session_id = ? AND kind = 'session'", [sessionId]);
    const nextSeq: number = (maxRow.rows[0]?.m ?? -1) + 1;
    const ext = extForMime(mime);
    const filePath = path.join(dir, `${String(nextSeq).padStart(6, '0')}.${ext}`);
    renameSync(srcPath, filePath);
    try {
      const durationMs = await probeDurationMs(filePath);
      const bytes = statSync(filePath).size;
      if (existing.rows.length) {
        // ردیفِ قدیمی بود ولی فایلش نه (پاک‌شده) — همان ردیف را به فایلِ تازه وصل کن.
        await query('UPDATE session_audio SET path = ?, bytes = ?, duration_ms = ? WHERE session_id = ? AND sha256 = ?',
          [filePath, bytes, durationMs, sessionId, sha256]);
      } else {
        await query(
          `INSERT INTO session_audio (id, session_id, seq, path, bytes, mime, source, run_id, kind, sha256, duration_ms)
           VALUES (?, ?, ?, ?, ?, ?, 'upload', ?, 'session', ?, ?)`,
          [randomUUID(), sessionId, nextSeq, filePath, bytes, mime, String(runId).slice(0, 64), sha256, durationMs]
        );
      }
      return { path: filePath, sha256, durationMs };
    } catch (e) {
      // ⭐ رفعِ M4 (audit 2026-09-24): جلسه وسطِ نرمال‌سازی حذف شد (INSERT با FK شکست می‌خورد) یا ثبت ناموفق بود ⇒
      // فایلِ جابه‌جاشده بدونِ ردیف می‌ماند و sweepOldSessionAudio (که فقط ردیف‌ها را می‌بیند) هرگز پاکش نمی‌کرد (LAW-010).
      try { rmSync(filePath, { force: true }); } catch {}
      try { if (readdirSync(dir).length === 0) rmSync(dir, { recursive: true, force: true }); } catch {}
      throw e;
    }
  });
}

function sha256OfFile(p: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    const rs = createReadStream(p);
    rs.on('data', (c) => h.update(c));
    rs.on('error', reject);
    rs.on('end', () => resolve(h.digest('hex')));
  });
}

export interface SessionAudioRow {
  id: string;
  session_id: string;
  seq: number;
  path: string;
  bytes: number;
  mime: string | null;
  source: string;
  run_id: string;
  kind: string;
  sha256: string | null;
  duration_ms: number | null;
  created_at: string;
}

export async function listSessionAudio(sessionId: string): Promise<SessionAudioRow[]> {
  const r = await query(
    'SELECT * FROM session_audio WHERE session_id = ? ORDER BY seq',
    [sessionId]
  );
  return r.rows;
}

export async function getSessionAudioRow(id: string): Promise<SessionAudioRow | null> {
  const r = await query('SELECT * FROM session_audio WHERE id = ?', [id]);
  return r.rows[0] || null;
}

// ————————————————— بخشِ رصد/حسابرسی (فازِ ۱، 2026-09-22) —————————————————
// منطقِ audio_status/transcript_status/pendingCount قبلاً inline در
// GET /api/admin/sessions/:id/audio بود؛ endpointِ جدیدِ GET
// /api/admin/sessions/recent به همان منطق نیاز داشت — به‌جایِ دوباره‌نویسی، این‌جا
// export می‌شود و از هر دو مسیر صدا زده می‌شود.
export interface DerivedSessionStatus {
  audioStatus: 'none' | 'syncing' | 'incomplete' | 'complete';
  audioMissingSegments: number[];
  transcriptStatus: 'complete' | 'pending' | 'failed' | 'none';
  pendingCount: number;
}

export function deriveSessionStatus(
  sessionAudioRows: SessionAudioRow[],
  pendingCount: number,
  session: { batch_status: string | null; realtime_reliable: boolean | null; stt_mode: string | null }
): DerivedSessionStatus {
  const onlySession = sessionAudioRows.filter((r) => r.kind === 'session');
  const { complete: seqComplete, missing: missingSeq } = checkSeqContiguous(onlySession);
  const audioStatus: DerivedSessionStatus['audioStatus'] =
    onlySession.length === 0 ? 'none'
      : pendingCount > 0 ? 'syncing'
        : !seqComplete ? 'incomplete'
          : 'complete';
  const transcriptStatus: DerivedSessionStatus['transcriptStatus'] =
    session.batch_status === 'failed' ? 'failed'
      : session.batch_status === 'queued' || session.batch_status === 'processing' ? 'pending'
        : session.stt_mode === 'realtime' && session.realtime_reliable ? 'complete'
          : session.batch_status === 'done' ? 'complete'
            : session.stt_mode ? 'pending' : 'none';
  return { audioStatus, audioMissingSegments: missingSeq, transcriptStatus, pendingCount };
}

// بخشِ ۱۱ی audit «zero-loss recording» (2026-09-22): قبل از این، فایلِ نهایی/دانلود صرفاً
// concatِ ffmpeg بود — هیچ‌جا چک نمی‌شد که seqِ سگمنت‌هایِ kind='session' واقعاً پیوسته‌اند.
// اگر سگمنتی هیچ‌وقت آپلود نشود (کاربر تبِ مرورگر را قبل از sync کاملاً بست)، فایلِ نهایی
// بدونِ خطا ولی با gap ساخته می‌شد و هیچ‌جا علامت‌گذاری نمی‌شد. این تابع فقط چک می‌کند،
// چیزی نمی‌سازد/حذف نمی‌کند — fail-open برایِ خودِ آرشیو دست‌نخورده می‌ماند.
export function checkSeqContiguous(rows: SessionAudioRow[]): { complete: boolean; missing: number[] } {
  if (!rows.length) return { complete: true, missing: [] };
  const seqs = rows.map((r) => r.seq).sort((a, b) => a - b);
  const missing: number[] = [];
  for (let i = 0; i <= seqs[seqs.length - 1]; i++) {
    if (!seqs.includes(i)) missing.push(i);
  }
  return { complete: missing.length === 0, missing };
}

// LAW-010 («حذفِ مراجع/جلسه باید صدای مربوط را هم پاک کند») — قبلاً فقط `ON DELETE CASCADE`
// ردیفِ DBِ `session_audio` را پاک می‌کرد؛ خودِ فایل‌هایِ رویِ دیسک (`data/session-audio/<id>/`)
// می‌ماندند و sweepِ ۱۴روزه هم آن‌ها را نمی‌دید (چون ردیفِ متناظرِ DB دیگر وجود نداشت که
// `created_at`ش چک شود) — صدای یک مراجعِ حذف‌شده برایِ همیشه رویِ دیسک باقی می‌ماند.
// caller باید این را *بعدِ* موفقیتِ DELETEِ DB صدا بزند (تا صدایی که هنوز به‌درستی حذف
// نشده — مثلاً owner-check رد شده — پاک نشود). fail-open: خطایِ حذفِ فایل کلِ عملیاتِ
// حذف را fail نمی‌کند؛ فقط لاگ می‌شود.
export function deleteSessionAudioDirs(sessionIds: string[]): void {
  for (const id of sessionIds) {
    try {
      rmSync(sessionDir(id), { recursive: true, force: true });
    } catch (e) {
      console.log('[session-audio] failed to delete dir for', id, String((e as Error).message || e).slice(-200));
    }
  }
  // فایل‌هایِ آپلودِ صدا (data/uploads/<uploadId>، migration 023) — ردیف‌هایِ audio_uploads با
  // cascade حذف شده‌اند؛ هر پوشه‌ای که دیگر ردیفِ متناظر ندارد همین‌جا پاک می‌شود (هر ۴ مسیرِ حذف).
  void import('../features/audio-upload/uploadStore.js')
    .then((m) => m.sweepOrphanUploadDirs())
    .catch(() => {});
}

// ————————————————— فایلِ کاملِ جلسه (بخشِ F، audit صدا/۲۰۲۶-۰۹-۱۶) —————————————————
// تصمیمِ صریحِ مالک: پنلِ ادمین باید یک فایلِ کاملِ قابلِ‌دانلود نشان بدهد، نه لیستِ
// سگمنت‌به‌سگمنت. ذخیره‌سازیِ داخلی (تکه‌تکه، برایِ مقاومت در برابرِ کرش) دست‌نخورده
// می‌ماند؛ این تابع فقط برایِ *نمایش* سگمنت‌هایِ kind='session' را با ffmpeg به یک
// فایل می‌چسباند و کش می‌کند — اگر سگمنتِ جدیدی اضافه نشده (جلسه تمام شده، late-transcript
// هم چیزی اضافه نکرده)، دوباره ساخته نمی‌شود.
export type FullAudioResult =
  | { ok: true; path: string; mime: string; complete: boolean; missingSegments: number[] }
  | { ok: false; reason: 'no-ffmpeg' | 'no-audio' | 'build-failed'; message: string };

function fullAudioMetaPath(dir: string): string {
  return path.join(dir, 'full.meta.json');
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
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as { segCount: number; path: string; mime: string };
      if (meta.segCount === rows.length && existsSync(meta.path)) {
        return { ok: true, path: meta.path, mime: meta.mime, complete, missingSegments };
      }
    } catch {
      // فایلِ meta نیست یا خراب است — دوباره می‌سازیم
    }

    if (!(await checkFfmpegAvailable())) {
      return { ok: false, reason: 'no-ffmpeg', message: 'این قابلیت بدونِ ffmpeg در دسترس نیست' };
    }

    const exts = new Set(rows.map((r) => path.extname(r.path).slice(1) || 'webm'));
    const uniform = exts.size === 1;
    const outExt = uniform ? [...exts][0] : 'webm';
    const outPath = path.join(dir, `full.${outExt}`);
    const outMime = mimeForExt(outExt);

    try {
      if (uniform) {
        // مسیرِ سریع: همه‌ی سگمنت‌ها یک container/codec دارن → concat demuxer بدونِ ری‌اینکود.
        const listPath = path.join(dir, 'full.concat-list.txt');
        const listContent = rows
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
        rows.forEach((r) => { args.push('-i', r.path); });
        const filter = rows.map((_, i) => `[${i}:a]`).join('') + `concat=n=${rows.length}:v=0:a=1[out]`;
        args.push('-filter_complex', filter, '-map', '[out]', '-c:a', 'libopus', outPath);
        await runFfmpeg(args);
      }
    } catch (e) {
      return { ok: false, reason: 'build-failed', message: String((e as Error).message || e).slice(0, 300) };
    }

    try {
      writeFileSync(metaPath, JSON.stringify({ segCount: rows.length, path: outPath, mime: outMime }));
    } catch {}
    return { ok: true, path: outPath, mime: outMime, complete, missingSegments };
  });
}

// اجرا در startup + هر ۲۴ ساعت — نه فقط سرِ راه‌اندازی، چون سروری که هفته‌ها ری‌استارت
// نمی‌شه نباید صدایِ بیشتر از ۱۴ روز رو نگه داره.
export async function sweepOldSessionAudio(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - RETENTION_MS);
    const old = await query('SELECT id, path FROM session_audio WHERE created_at < ?', [cutoff]);
    for (const row of old.rows) {
      try { rmSync(row.path, { force: true }); } catch {}
    }
    if (old.rows.length) {
      await query('DELETE FROM session_audio WHERE created_at < ?', [cutoff]);
      console.log(`[session-audio] swept ${old.rows.length} expired file(s)`);
    }
    // پوشه‌هایِ خالیِ session (همه‌ی فایل‌هاشون پاک شده) رو هم جارو کن
    ensureArchiveDir();
    for (const name of readdirSync(ARCHIVE_DIR)) {
      const dir = path.join(ARCHIVE_DIR, name);
      try {
        if (readdirSync(dir).length === 0) rmSync(dir, { recursive: true, force: true });
      } catch {}
    }
  } catch (e) {
    console.log('[session-audio] sweep failed:', String(e).slice(0, 160));
  }
}
