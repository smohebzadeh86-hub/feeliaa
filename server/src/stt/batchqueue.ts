// صف batch fallback — فقط برای failure مسیر realtime.
// حریم خصوصی: صوت خام فقط در این مسیرِ شکست به سرور Feelia می‌آید (نه در حالت عادی)،
// روی دیسکِ موقتِ سرور می‌ماند تا رونویسی شود، بلافاصله بعد از موفقیت حذف می‌شود،
// و فایل‌های قدیمی‌تر از ۲۴ ساعت در startup پاک می‌شوند. هیچ صوتی در DB ذخیره نمی‌شود.
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { query } from '../db/connection.js';
import { logEvent } from '../obs/eventLog.js';

export type BatchStatus = 'queued' | 'processing' | 'done' | 'failed';

const QUEUE_DIR = path.join(process.cwd(), 'data', 'batch-queue');
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const RETENTION_MS = 24 * 60 * 60 * 1000;

function ensureDir() {
  if (!existsSync(QUEUE_DIR)) mkdirSync(QUEUE_DIR, { recursive: true });
}

export function queueDir(): string {
  ensureDir();
  return QUEUE_DIR;
}

// چهار هدفِ جدا:
//   'transcript' → صوتِ fallback جلسه (realtime واقعاً شکست خورده)، رونویسی و وارد
//                  sessions.transcript می‌شود (merge نسخه‌ای)، بعد آرشیو می‌شود. فقط
//                  رویِ جلسه‌ی هنوز-تمام‌نشده مجاز است (چکِ سطحِ route).
//   'late-transcript' → همون رونویسی/mergeِ 'transcript'، ولی برایِ صدایِ آفلاینی که
//                  *بعدِ* پایانِ جلسه به صف رسیده (audit صدا/۲۰۲۶-۰۹-۱۶، تصمیمِ مالک) —
//                  رویِ جلسه‌ی completed هم مجاز است؛ متن با یک برچسبِ صریح append می‌شود.
//   'note' → صوتِ یادداشت صوتیِ ناموفق، فقط به‌صورت session_notes(type='voice') ثبت می‌شود.
//   'archive' → صدایِ جلسه‌ای که realtime توش کاملاً موفق بود — نیازی به رونویسیِ
//               دوباره نیست (متن از قبل درسته)، فقط برایِ بازبینیِ ادمین آرشیو می‌شه.
export type BatchPurpose = 'transcript' | 'late-transcript' | 'note' | 'archive';

export const LATE_TRANSCRIPT_LABEL = '[بخشِ ضبط‌شده در زمانِ قطعیِ اینترنت — بعداً رونویسی شد]';

// باگِ قبلی: فایل فقط با Date.now() نام‌گذاری می‌شد و آپلودها موازی می‌رفتن — یعنی
// (۱) دو سگمنت در یک میلی‌ثانیه = یک اسمِ فایل = یکی رویِ دیگری می‌نوشت (صدا گم می‌شد)،
// (۲) ترتیبِ رسیدنِ آپلود، نه ترتیبِ واقعیِ ضبط، تعیین‌کننده‌ی ترتیبِ merge بود.
// الان seq (شماره‌ی سگمنت، از خودِ کلاینت) صریح توی اسمِ فایل zero-padded میاد —
// هم تصادم را از بین می‌بره، هم مرتب‌سازیِ الفباییِ filesFor() رو با ترتیبِ واقعی یکی می‌کنه.
// 'late-transcript' مارکِ فایلِ جداگانه دارد (`.late.`) — وگرنه workerِ retry
// (`retryQueuedBatches`) که purpose را فقط از رویِ نامِ فایل حدس می‌زند، فایلِ late-transcript
// را با 'transcript'ِ ساده اشتباه می‌گرفت و برچسبِ صریح روی متنِ merge‌شده گم می‌شد.
function markerFor(purpose: BatchPurpose): string {
  if (purpose === 'note') return '.note.';
  if (purpose === 'archive') return '.archive.';
  if (purpose === 'late-transcript') return '.late.';
  return '.';
}

// mimeِ واقعیِ کلاینت (audit صدا/۲۰۲۶-۰۹-۱۶، بخشِ E) — قبلاً همیشه 'audio/webm' هاردکد
// می‌شد؛ فایرفاکس/سافاری می‌توانند ogg/mp4 بفرستند. چون فایلِ صفِ موقت فقط بایت‌های خام
// است (بدونِ مکان‌داریِ metadata)، پسوندِ خودِ فایل تنها جایی است که این اطلاعات بینِ
// enqueue (که mime را از درخواست دارد) و processBatchQueue (که فقط بایت‌ها را می‌خواند)
// منتقل می‌شود.
export const KNOWN_EXTS = ['webm', 'ogg', 'm4a'] as const;
export function extForMime(mime: string): string {
  const m = (mime || '').toLowerCase();
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'm4a';
  return 'webm'; // پیش‌فرضِ امن — رفتارِ قبلی
}
export function mimeForExt(ext: string): string {
  if (ext === 'ogg') return 'audio/ogg';
  if (ext === 'm4a') return 'audio/mp4';
  return 'audio/webm';
}
export function audioPathFor(sessionId: string, purpose: BatchPurpose = 'transcript', seq = 0, runId = 'legacy', mime = 'audio/webm'): string {
  ensureDir();
  const safe = String(sessionId).replace(/[^a-zA-Z0-9-]/g, '');
  const seqPadded = String(Math.max(0, Math.floor(seq))).padStart(6, '0');
  const runSafe = String(runId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32) || 'legacy';
  const ext = extForMime(mime);
  return path.join(QUEUE_DIR, `${safe}-${seqPadded}-${runSafe}-${Date.now()}${markerFor(purpose)}${ext}`);
}

export function validateAudioBuffer(buf: Buffer): string | null {
  if (!buf || buf.length < 100) return 'فایل صوتی خیلی کوتاه است';
  if (buf.length > MAX_AUDIO_BYTES) return 'فایل صوتی بیش از حد بزرگ است';
  return null;
}

// نسخه‌ی پایه‌ی transcript در لحظه‌ی صف‌شدن — برای merge امن بعدی (جلوگیری از overwrite).
// برای purpose=note هیچ ستونی از sessions دست نمی‌خورد (فقط فایل + پردازش بعدی).
export async function enqueueBatch(
  sessionId: string,
  buf: Buffer,
  purpose: BatchPurpose = 'transcript',
  seq = 0,
  runId = 'legacy',
  mime = 'audio/webm'
): Promise<{ baseVersion: number }> {
  const cur = await query('SELECT transcript_version FROM sessions WHERE id = ?', [sessionId]);
  const baseVersion: number = cur.rows[0]?.transcript_version ?? 0;
  const p = audioPathFor(sessionId, purpose, seq, runId, mime);
  writeFileSync(p, buf);
  if (purpose === 'transcript' || purpose === 'late-transcript') {
    await query(
      `UPDATE sessions SET batch_status = 'queued', stt_mode = 'batch', updated_at = NOW() WHERE id = ?`,
      [sessionId]
    );
  }
  console.log(`[batch] queued session=${sessionId} purpose=${purpose} seq=${seq} bytes=${buf.length} baseVersion=${baseVersion}`);
  logEvent({ event: 'batch.enqueued', sessionId, source: 'job', detail: { purpose, seq, bytes: buf.length } });
  return { baseVersion };
}

function isNoteFile(f: string): boolean {
  return f.includes('.note.');
}
function isArchiveFile(f: string): boolean {
  return f.includes('.archive.');
}
function isLateFile(f: string): boolean {
  return f.includes('.late.');
}

// seq/run/mime از اسمِ فایل استخراج می‌شه (فرمت:
// <sessionId>-<seqِ ۶رقمی>-<runId>-<timestamp>[.note|.archive|.late].<webm|ogg|m4a>)
// تا موقعِ آرشیوکردن برایِ ادمین، ترتیبِ واقعیِ سگمنت، runِ صاحبش، و mimeِ واقعی حفظ بمونه.
const EXT_ALTERNATION = KNOWN_EXTS.join('|');
// فایل‌هایِ خیلی قدیمی (پیش از migration 017، بخشِ runId هنوز نبود): <sessionId>-<seq>-<timestamp>.ext
const LEGACY_NO_RUN_RE = new RegExp(`^(.+)-(\\d{6})-(\\d+)\\.(?:note\\.|archive\\.|late\\.)?(?:${EXT_ALTERNATION})$`);
const WITH_RUN_RE = new RegExp(`^(.+)-(\\d{6})-([a-zA-Z0-9]+)-(\\d+)\\.(?:note\\.|archive\\.|late\\.)?(?:${EXT_ALTERNATION})$`);

// ⭐ فیکسِ باگِ واقعی (کشف‌شده در لاگِ deployِ ۲۰۲۶-۰۹-۲۳): برایِ فایلِ خیلی قدیمیِ بدونِ
// runId، regexِ قبلی (که همیشه runId را الزامی می‌دانست) اصلاً match نمی‌شد؛
// sessionIdFromFilename در آن حالت کلِ نامِ فایل (شاملِ seq/timestamp/پسوند) را به‌عنوانِ
// sessionId برمی‌گرداند — که از CHAR(36)ِ ستونِ session_id بلندتر است و INSERT با خطایِ
// «Data too long for column 'session_id'» شکست می‌خورد (صدایِ همان فایل، چون sweep بدونِ
// شرط حذف می‌کند، برایِ همیشه از دست می‌رفت). حالا هر دو فرمت (با/بدونِ runId) پارس
// می‌شوند؛ اگر هیچ‌کدام match نشد، null برمی‌گردد و caller آرشیو را رد می‌کند (فایل هنوز
// طبقِ سیاستِ ۲۴ساعته حذف می‌شود، فقط دیگر INSERTِ نامعتبر نمی‌زند).
function parseQueueFilename(filePath: string): { sessionId: string; seq: number; runId: string } | null {
  const base = path.basename(filePath);
  const withRun = base.match(WITH_RUN_RE);
  if (withRun) return { sessionId: withRun[1], seq: parseInt(withRun[2], 10), runId: withRun[3] };
  const legacy = base.match(LEGACY_NO_RUN_RE);
  if (legacy) return { sessionId: legacy[1], seq: parseInt(legacy[2], 10), runId: 'legacy' };
  return null;
}
function seqFromFilename(filePath: string): number {
  return parseQueueFilename(filePath)?.seq ?? 0;
}
function runIdFromFilename(filePath: string): string {
  return parseQueueFilename(filePath)?.runId ?? 'legacy';
}
function mimeFromFilename(filePath: string): string {
  const base = path.basename(filePath);
  const m = base.match(new RegExp(`\\.(${EXT_ALTERNATION})$`));
  return mimeForExt(m ? m[1] : 'webm');
}

function filesFor(sessionId: string, purpose: BatchPurpose): string[] {
  ensureDir();
  const safe = String(sessionId).replace(/[^a-zA-Z0-9-]/g, '');
  return readdirSync(QUEUE_DIR)
    .filter((f) => {
      if (!f.startsWith(safe + '-')) return false;
      if (purpose === 'note') return isNoteFile(f);
      if (purpose === 'archive') return isArchiveFile(f);
      if (purpose === 'late-transcript') return isLateFile(f);
      return !isNoteFile(f) && !isArchiveFile(f) && !isLateFile(f);
    })
    .sort()
    .map((f) => path.join(QUEUE_DIR, f));
}

export function pendingAudioFor(sessionId: string, purpose: BatchPurpose = 'transcript'): string | null {
  const all = pendingAudiosFor(sessionId, purpose);
  return all.length ? all[all.length - 1] : null;
}

// همه‌ی فایل‌های در صفِ همین purpose، قدیمی‌ترین اول (سگمنت‌های pause/resume به ترتیب
// پردازش می‌شوند و merge امنِ نسخه‌ای، ترتیب متن را حفظ می‌کند).
export function pendingAudiosFor(sessionId: string, purpose: BatchPurpose = 'transcript'): string[] {
  return filesFor(sessionId, purpose);
}

export function removeAudioFile(p: string) {
  try { rmSync(p, { force: true }); } catch {}
}

// merge امن: batchText همیشه به currentText اضافه می‌شود، هرگز جایگزینِ آن نمی‌شود.
// باگِ قبلی: شاخه‌ی «بدونِ تعارض» (currentVersion === baseVersion) کلِ transcript را
// با فقط متنِ تازه‌ی این سگمنت REPLACE می‌کرد — یعنی دقیقاً در رایج‌ترین حالت (هیچ‌کس
// دیگه‌ای بینِ enqueue و merge چیزی ننوشته)، هر متنِ تاییدشده‌ی قبلی (از realtime یا
// سگمنت‌هایِ قبلیِ همین batch) پاک می‌شد. هر دو شاخه الان دقیقاً یک کار می‌کنن: append.
// label: برایِ purpose='late-transcript' — سگمنتِ append‌شده را صریح به‌عنوانِ صدایِ
// آفلاینِ بعدِ پایانِ جلسه علامت می‌زند (تصمیمِ مالک، audit صدا/۲۰۲۶-۰۹-۱۶) — بدونِ این،
// تراپیست فرقِ متنِ زنده و متنِ بازیابی‌شده‌ی دیرهنگام را در پرونده نمی‌دید.
export async function mergeBatchTranscript(sessionId: string, baseVersion: number, batchText: string, label?: string): Promise<void> {
  const text = batchText.trim();
  if (!text) return;
  const cur = await query('SELECT transcript, transcript_version FROM sessions WHERE id = ?', [sessionId]);
  if (!cur.rows.length) return;
  const currentText: string = cur.rows[0]?.transcript ?? '';
  const currentVersion: number = cur.rows[0]?.transcript_version ?? 0;
  const segment = label ? `${label}\n${text}` : text;
  const merged = currentText ? currentText + '\n\n' + segment : segment;
  await query(
    `UPDATE sessions SET transcript = ?, transcript_version = transcript_version + 1,
      realtime_reliable = false, batch_status = 'done', updated_at = NOW() WHERE id = ?`,
    [merged, sessionId]
  );
  console.log(`[batch] merged session=${sessionId} base=${baseVersion} now=${currentVersion}+1 conflict=${currentVersion !== baseVersion}`);
}

// پردازش پس‌زمینه: هر فایل با API واقعیِ async (stt-async-v5) رونویسی می‌شه — نه با
// وانمودِ زنده‌بودن رویِ موتورِ realtime. طبقِ docsِ Soniox، مدلِ async چون کلِ فایل رو
// یک‌جا می‌بینه، دقتِ تشخیصِ گوینده‌ش «به‌طورِ قابلِ‌توجهی» بالاتره — دقیقاً همون بخشی
// که چون یه‌بار realtime شکست خورده، بیشتر از هر جایِ دیگه بهش نیاز داریم.
// اگر egress قطع باشد، وضعیت queued می‌ماند تا retry بعدی — session از بین نمی‌رود.
// purpose=note → نتیجه فقط session_notes(type='voice') می‌شود، نه transcript.
// purpose=archive → realtime قبلاً موفق و متن قبلاً کامل/درست بوده — نیازی به رونویسیِ
// دوباره (و ریسکِ duplicate) نیست؛ فقط صدا برایِ ادمین آرشیو می‌شه، بدونِ صدازدنِ Soniox.
// قفلِ per-session:queue تا دو فراخوانیِ هم‌زمانِ processBatchQueue (مثلاً یه
// retryِ دستی درست وسطِ workerِ دوره‌ای) رویِ یک sessionId، متنِ یکسان رو دوبار
// merge نکنن یا هر دو یه فایل رو هم‌زمان بخونن/حذف کنن.
const queueLocks = new Map<string, Promise<unknown>>();
function withQueueLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = queueLocks.get(key) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  queueLocks.set(key, run.catch(() => {}));
  return run;
}

export async function processBatchQueue(sessionId: string, purpose: BatchPurpose = 'transcript'): Promise<void> {
  return withQueueLock(`${sessionId}:${purpose}`, () => processBatchQueueInner(sessionId, purpose));
}

async function processBatchQueueInner(sessionId: string, purpose: BatchPurpose): Promise<void> {
  const files = pendingAudiosFor(sessionId, purpose);
  if (!files.length) return;

  if (purpose === 'archive') {
    const { readFileSync } = await import('node:fs');
    const { archiveAudioForAdmin } = await import('./sessionAudioArchive.js');
    for (const file of files) {
      let buffer: Buffer;
      try { buffer = readFileSync(file); } catch { continue; }
      try {
        await archiveAudioForAdmin(sessionId, seqFromFilename(file), buffer, mimeFromFilename(file), 'durable', runIdFromFilename(file), 'session');
        removeAudioFile(file);
        console.log(`[batch] archived (no transcribe) session=${sessionId} seq=${seqFromFilename(file)}`);
      } catch (e) {
        console.log('[batch] archive-only failed:', String(e).slice(0, 160));
      }
    }
    return;
  }

  const isTranscriptLike = purpose === 'transcript' || purpose === 'late-transcript';
  const sonioxKey = process.env.SONIOX_API_KEY;
  if (!sonioxKey) {
    if (isTranscriptLike) {
      await query(`UPDATE sessions SET batch_status = 'failed', updated_at = NOW() WHERE id = ?`, [sessionId]);
    }
    return;
  }
  if (isTranscriptLike) {
    await query(`UPDATE sessions SET batch_status = 'processing', updated_at = NOW() WHERE id = ?`, [sessionId]);
  }
  try {
    const { readFileSync } = await import('node:fs');
    const { transcribeFileAsync } = await import('./asyncTranscribe.js');
    const { archiveAudioForAdmin } = await import('./sessionAudioArchive.js');
    for (const file of files) {
      let buffer: Buffer;
      try { buffer = readFileSync(file); } catch { continue; }
      // ⭐ آرشیو قبل از رونویسی: حتی اگه transcribeFileAsync بعداً شکست بخوره (egress
      // قطع، سهمیه‌ی Soniox، …) صدا از قبل امن ذخیره شده. idempotent (sha256) —
      // retryِ همین فایل روی این خط فقط no-op می‌کنه، ردیفِ تکراری نمی‌سازه.
      try {
        await archiveAudioForAdmin(sessionId, seqFromFilename(file), buffer, mimeFromFilename(file), 'durable', runIdFromFilename(file), purpose === 'note' ? 'note' : 'session');
      } catch (e) {
        console.log('[batch] archive-for-admin failed, kept queued:', String(e).slice(0, 160));
        logEvent({ event: 'audio.archive_failed', sessionId, source: 'job', severity: 'error', detail: { purpose } });
        continue;
      }
      const baseRow = await query('SELECT transcript_version FROM sessions WHERE id = ?', [sessionId]);
      const baseVersion: number = baseRow.rows[0]?.transcript_version ?? 0;
      console.log(`[batch] processing session=${sessionId} purpose=${purpose} bytes=${buffer.length} (async API)`);
      let text = '';
      try {
        text = await transcribeFileAsync(buffer, `${sessionId}.webm`, `feelia:${sessionId}:${purpose}`);
      } catch (e) {
        console.log('[batch] async transcribe error, kept queued (already archived):', String(e).slice(0, 160));
        continue; // این فایل توی صف می‌مونه؛ صدا از قبل آرشیو شده، فقط رونویسی عقب افتاده
      }
      if (text && text.trim()) {
        if (purpose === 'note') {
          await query(
            `INSERT INTO session_notes (id, session_id, type, text, wall_clock)
             VALUES (?, ?, 'voice', ?, ?)`,
            [randomUUID(), sessionId, text.trim(), new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })]
          );
        } else {
          await mergeBatchTranscript(sessionId, baseVersion, text, purpose === 'late-transcript' ? LATE_TRANSCRIPT_LABEL : undefined);
        }
      } else {
        // ⭐ سکوت هم نتیجه‌ی موفقِ رونویسیه، نه شکست — قبلاً این حالت برایِ همیشه توی
        // صف می‌موند (و بعدِ ۲۴ ساعت بدونِ آرشیو پاک می‌شد، پایینِ همین فایل).
        console.log(`[batch] empty result (silence, treated as success) session=${sessionId} purpose=${purpose}`);
      }
      removeAudioFile(file);
      console.log(`[batch] segment done session=${sessionId} purpose=${purpose}`);
    }
    if (isTranscriptLike) {
      const left = pendingAudiosFor(sessionId, purpose);
      await query(
        `UPDATE sessions SET batch_status = ?, updated_at = NOW() WHERE id = ?`,
        [left.length ? 'queued' : 'done', sessionId]
      );
      console.log(`[batch] finished session=${sessionId} remaining=${left.length}`);
      if (!left.length) logEvent({ event: 'batch.completed', sessionId, source: 'job', detail: { purpose } });
    }
  } catch (err) {
    console.log('[batch] processing failed:', String(err).slice(0, 160));
    logEvent({ event: 'batch.failed', sessionId, source: 'job', severity: 'error', detail: { purpose } });
    if (isTranscriptLike) {
      await query(`UPDATE sessions SET batch_status = 'queued', updated_at = NOW() WHERE id = ?`, [sessionId]).catch(() => {});
    }
  }
}

// null یعنی فرمتِ فایل قابلِ‌شناسایی نیست (خرابی/دستکاریِ دستی) — caller نباید تلاش
// کند این را به‌عنوانِ sessionId در DB بنویسد (طولش می‌تواند بیشتر از CHAR(36) باشد).
function sessionIdFromFilename(filePath: string): string | null {
  return parseQueueFilename(filePath)?.sessionId ?? null;
}

// پاک‌سازی startup: فایل‌های قدیمی‌تر از RETENTION_MS (نشت دیسک/حریم خصوصی).
// ⭐ باگِ قبلی: فایل مستقیم پاک می‌شد، حتی اگه Soniox/سرور هیچ‌وقت نتونسته بود
// آرشیوش کنه (کلیدِ نامعتبر، ری‌استارتِ مکرر) — یعنی بعدِ ۲۴ ساعت صدا برایِ همیشه
// از بین می‌رفت. الان قبل از حذف، یه‌بار تلاش می‌کنه آرشیوش کنه (fail-open — اگه
// این هم شکست بخوره، همچنان طبقِ سیاستِ نگهداریِ ۲۴ساعته پاک می‌شه، وگرنه فایل‌هایِ
// خراب/یتیم برایِ همیشه می‌موندن).
export async function sweepOldBatchFiles(): Promise<void> {
  try {
    ensureDir();
    const now = Date.now();
    const { readFileSync } = await import('node:fs');
    const { archiveAudioForAdmin } = await import('./sessionAudioArchive.js');
    for (const f of readdirSync(QUEUE_DIR)) {
      const p = path.join(QUEUE_DIR, f);
      try {
        const age = now - statSync(p).mtimeMs;
        if (age > RETENTION_MS) {
          const sessionId = sessionIdFromFilename(p);
          if (sessionId === null) {
            console.log(`[batch] unparsable filename, dropping without archive: ${f}`);
          } else {
            try {
              const buffer = readFileSync(p);
              await archiveAudioForAdmin(sessionId, seqFromFilename(p), buffer, mimeFromFilename(p), 'durable', runIdFromFilename(p), isNoteFile(f) ? 'note' : 'session');
            } catch (e) {
              console.log('[batch] pre-sweep archive failed (still sweeping):', String(e).slice(0, 160));
            }
          }
          rmSync(p, { force: true });
          console.log(`[batch] swept old file ${f}`);
        }
      } catch {}
    }
  } catch {}
}

// workerِ دوره‌ای: فایل‌هایِ صفی که موقعِ enqueue شکستِ egress/کلید داشتن (مثلاً
// SONIOX_API_KEY وقتِ آپلود نامعتبر بود) بدونِ اون دوباره retry نمی‌شدن، فقط با
// لودِ مجددِ صفحه یا ری‌استارتِ سرور. الان هر چند دقیقه صفِ هر sessionId/purpose
// دوباره امتحان می‌شه.
export async function retryQueuedBatches(): Promise<void> {
  try {
    ensureDir();
    const seen = new Set<string>();
    for (const f of readdirSync(QUEUE_DIR)) {
      const purpose: BatchPurpose = isNoteFile(f) ? 'note' : isArchiveFile(f) ? 'archive' : isLateFile(f) ? 'late-transcript' : 'transcript';
      const sessionId = sessionIdFromFilename(path.join(QUEUE_DIR, f));
      if (sessionId === null) continue; // فرمتِ ناشناخته — sweepِ ۲۴ساعته خودش رسیدگی می‌کند
      const key = `${sessionId}:${purpose}`;
      if (seen.has(key)) continue;
      seen.add(key);
      try { await processBatchQueue(sessionId, purpose); } catch (e) {
        console.log('[batch] retry worker failed for', key, String(e).slice(0, 160));
      }
    }
  } catch {}
}
