// صف batch fallback — فقط برای failure مسیر realtime.
// حریم خصوصی: صوت خام فقط در این مسیرِ شکست به سرور Feelia می‌آید (نه در حالت عادی)،
// روی دیسکِ موقتِ سرور می‌ماند تا رونویسی شود، بلافاصله بعد از موفقیت حذف می‌شود،
// و فایل‌های قدیمی‌تر از ۲۴ ساعت در startup پاک می‌شوند. هیچ صوتی در DB ذخیره نمی‌شود.
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { query } from '../db/connection.js';

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

// سه هدفِ جدا:
//   'transcript' → صوتِ fallback جلسه (realtime واقعاً شکست خورده)، رونویسی و وارد
//                  sessions.transcript می‌شود (merge نسخه‌ای)، بعد آرشیو می‌شود.
//   'note' → صوتِ یادداشت صوتیِ ناموفق، فقط به‌صورت session_notes(type='voice') ثبت می‌شود.
//   'archive' → صدایِ جلسه‌ای که realtime توش کاملاً موفق بود — نیازی به رونویسیِ
//               دوباره نیست (متن از قبل درسته)، فقط برایِ بازبینیِ ادمین آرشیو می‌شه.
export type BatchPurpose = 'transcript' | 'note' | 'archive';

// باگِ قبلی: فایل فقط با Date.now() نام‌گذاری می‌شد و آپلودها موازی می‌رفتن — یعنی
// (۱) دو سگمنت در یک میلی‌ثانیه = یک اسمِ فایل = یکی رویِ دیگری می‌نوشت (صدا گم می‌شد)،
// (۲) ترتیبِ رسیدنِ آپلود، نه ترتیبِ واقعیِ ضبط، تعیین‌کننده‌ی ترتیبِ merge بود.
// الان seq (شماره‌ی سگمنت، از خودِ کلاینت) صریح توی اسمِ فایل zero-padded میاد —
// هم تصادم را از بین می‌بره، هم مرتب‌سازیِ الفباییِ filesFor() رو با ترتیبِ واقعی یکی می‌کنه.
function markerFor(purpose: BatchPurpose): string {
  if (purpose === 'note') return '.note.';
  if (purpose === 'archive') return '.archive.';
  return '.';
}
export function audioPathFor(sessionId: string, purpose: BatchPurpose = 'transcript', seq = 0): string {
  ensureDir();
  const safe = String(sessionId).replace(/[^a-zA-Z0-9-]/g, '');
  const seqPadded = String(Math.max(0, Math.floor(seq))).padStart(6, '0');
  return path.join(QUEUE_DIR, `${safe}-${seqPadded}-${Date.now()}${markerFor(purpose)}webm`);
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
  seq = 0
): Promise<{ baseVersion: number }> {
  const cur = await query('SELECT transcript_version FROM sessions WHERE id = $1', [sessionId]);
  const baseVersion: number = cur.rows[0]?.transcript_version ?? 0;
  const p = audioPathFor(sessionId, purpose, seq);
  writeFileSync(p, buf);
  if (purpose === 'transcript') {
    await query(
      `UPDATE sessions SET batch_status = 'queued', stt_mode = 'batch', updated_at = now() WHERE id = $1`,
      [sessionId]
    );
  }
  console.log(`[batch] queued session=${sessionId} purpose=${purpose} seq=${seq} bytes=${buf.length} baseVersion=${baseVersion}`);
  return { baseVersion };
}

function isNoteFile(f: string): boolean {
  return f.includes('.note.');
}
function isArchiveFile(f: string): boolean {
  return f.includes('.archive.');
}

// seq از اسمِ فایل استخراج می‌شه (فرمت: <sessionId>-<seqِ ۶رقمی>-<timestamp>[.note|.archive].webm)
// تا موقعِ آرشیوکردن برایِ ادمین، ترتیبِ واقعیِ سگمنت حفظ بمونه.
function seqFromFilename(filePath: string): number {
  const base = path.basename(filePath);
  const m = base.match(/-(\d{6})-\d+\.(?:note\.|archive\.)?webm$/);
  return m ? parseInt(m[1], 10) : 0;
}

function filesFor(sessionId: string, purpose: BatchPurpose): string[] {
  ensureDir();
  const safe = String(sessionId).replace(/[^a-zA-Z0-9-]/g, '');
  return readdirSync(QUEUE_DIR)
    .filter((f) => {
      if (!f.startsWith(safe + '-')) return false;
      if (purpose === 'note') return isNoteFile(f);
      if (purpose === 'archive') return isArchiveFile(f);
      return !isNoteFile(f) && !isArchiveFile(f);
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
export async function mergeBatchTranscript(sessionId: string, baseVersion: number, batchText: string): Promise<void> {
  const text = batchText.trim();
  if (!text) return;
  const cur = await query('SELECT transcript, transcript_version FROM sessions WHERE id = $1', [sessionId]);
  if (!cur.rows.length) return;
  const currentText: string = cur.rows[0]?.transcript ?? '';
  const currentVersion: number = cur.rows[0]?.transcript_version ?? 0;
  const merged = currentText ? currentText + '\n\n' + text : text;
  await query(
    `UPDATE sessions SET transcript = $1, transcript_version = transcript_version + 1,
      realtime_reliable = false, batch_status = 'done', updated_at = now() WHERE id = $2`,
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
export async function processBatchQueue(sessionId: string, purpose: BatchPurpose = 'transcript'): Promise<void> {
  const files = pendingAudiosFor(sessionId, purpose);
  if (!files.length) return;

  if (purpose === 'archive') {
    const { readFileSync } = await import('node:fs');
    const { archiveAudioForAdmin } = await import('./sessionAudioArchive.js');
    for (const file of files) {
      let buffer: Buffer;
      try { buffer = readFileSync(file); } catch { continue; }
      try {
        await archiveAudioForAdmin(sessionId, seqFromFilename(file), buffer, 'audio/webm', 'durable');
        removeAudioFile(file);
        console.log(`[batch] archived (no transcribe) session=${sessionId} seq=${seqFromFilename(file)}`);
      } catch (e) {
        console.log('[batch] archive-only failed:', String(e).slice(0, 160));
      }
    }
    return;
  }

  const sonioxKey = process.env.SONIOX_API_KEY;
  if (!sonioxKey) {
    if (purpose === 'transcript') {
      await query(`UPDATE sessions SET batch_status = 'failed', updated_at = now() WHERE id = $1`, [sessionId]);
    }
    return;
  }
  if (purpose === 'transcript') {
    await query(`UPDATE sessions SET batch_status = 'processing', updated_at = now() WHERE id = $1`, [sessionId]);
  }
  try {
    const { readFileSync } = await import('node:fs');
    const { transcribeFileAsync } = await import('./asyncTranscribe.js');
    const { archiveAudioForAdmin } = await import('./sessionAudioArchive.js');
    for (const file of files) {
      let buffer: Buffer;
      try { buffer = readFileSync(file); } catch { continue; }
      const baseRow = await query('SELECT transcript_version FROM sessions WHERE id = $1', [sessionId]);
      const baseVersion: number = baseRow.rows[0]?.transcript_version ?? 0;
      console.log(`[batch] processing session=${sessionId} purpose=${purpose} bytes=${buffer.length} (async API)`);
      let text = '';
      try {
        text = await transcribeFileAsync(buffer, `${sessionId}.webm`, `feelia:${sessionId}:${purpose}`);
      } catch (e) {
        console.log('[batch] async transcribe error:', String(e).slice(0, 160));
        continue; // این فایل توی صف می‌مونه، همون‌جوری که قبلاً روی خطایِ شبکه رفتار می‌کرد
      }
      if (text && text.trim()) {
        if (purpose === 'note') {
          await query(
            `INSERT INTO session_notes (session_id, type, text, wall_clock)
             VALUES ($1, 'voice', $2, $3)`,
            [sessionId, text.trim(), new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })]
          );
        } else {
          await mergeBatchTranscript(sessionId, baseVersion, text);
        }
        // ⭐ به‌جایِ پاک‌کردنِ کامل، یه نسخه برایِ بازبینیِ ادمین آرشیو می‌شه (فقط پشتِ
        // requireAdmin قابلِ‌شنیدنه) — فایلِ صفِ موقت همچنان حذف می‌شه.
        try { await archiveAudioForAdmin(sessionId, seqFromFilename(file), buffer, 'audio/webm', 'durable'); } catch (e) {
          console.log('[batch] archive-for-admin failed:', String(e).slice(0, 160));
        }
        removeAudioFile(file);
        console.log(`[batch] segment done session=${sessionId} purpose=${purpose}`);
      } else {
        console.log(`[batch] empty result, kept queued session=${sessionId} purpose=${purpose}`);
      }
    }
    if (purpose === 'transcript') {
      const left = pendingAudiosFor(sessionId, 'transcript');
      await query(
        `UPDATE sessions SET batch_status = $1, updated_at = now() WHERE id = $2`,
        [left.length ? 'queued' : 'done', sessionId]
      );
      console.log(`[batch] finished session=${sessionId} remaining=${left.length}`);
    }
  } catch (err) {
    console.log('[batch] processing failed:', String(err).slice(0, 160));
    if (purpose === 'transcript') {
      await query(`UPDATE sessions SET batch_status = 'queued', updated_at = now() WHERE id = $1`, [sessionId]).catch(() => {});
    }
  }
}

// پاک‌سازی startup: فایل‌های قدیمی‌تر از RETENTION_MS (نشت دیسک/حریم خصوصی).
export function sweepOldBatchFiles() {
  try {
    ensureDir();
    const now = Date.now();
    for (const f of readdirSync(QUEUE_DIR)) {
      const p = path.join(QUEUE_DIR, f);
      try {
        const age = now - statSync(p).mtimeMs;
        if (age > RETENTION_MS) {
          rmSync(p, { force: true });
          console.log(`[batch] swept old file ${f}`);
        }
      } catch {}
    }
  } catch {}
}
