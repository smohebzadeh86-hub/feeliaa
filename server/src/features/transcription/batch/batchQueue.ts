// صف batch fallback — فقط برای failure مسیر realtime.
// حریم خصوصی: صوت خام فقط در این مسیرِ شکست به سرور Feelia می‌آید (نه در حالت عادی)،
// روی دیسکِ موقتِ سرور می‌ماند تا رونویسی شود، بلافاصله بعد از موفقیت حذف می‌شود،
// و فایل‌های قدیمی‌تر از ۲۴ ساعت در startup و هر ساعت پاک می‌شوند. هیچ صوتی در DB ذخیره نمی‌شود.
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { query, pool } from '../../../db/connection.js';
import { logEvent } from '../../../obs/eventLog.js';
import { createKeyedLock } from '../../../shared/keyedLock.js';

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
//   'note-archive' → صدایِ یادداشتِ صوتی‌ای که realtime‌اش موفق بود و UI متنش را خودش ثبت کرده
//               (2026-09-26): فقط آرشیو با kind='note'. قبلاً با purpose=note دوباره رونویسی و یک
//               یادداشتِ صوتیِ تکراری ساخته می‌شد.
export type BatchPurpose = 'transcript' | 'late-transcript' | 'note' | 'archive' | 'note-archive';

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
  if (purpose === 'note-archive') return '.notearchive.';
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

// بررسیِ magic bytesِ container (۲۰۲۶-۰۹-۲۳، race چرخشِ durable در کلاینت): سگمنتی که با
// هدرِ واقعیِ container شروع نمی‌شود (مثلاً دُمِ بی‌هدرِ یک MediaRecorder) هرگز قابلِ رونویسی
// نیست — Soniox و ffmpeg هر دو ردش می‌کنند. عمداً فقط در صف (پیش از Soniox) استفاده می‌شود،
// نه در مسیرِ دریافت: فایل پذیرفته و آرشیو می‌شود تا برایِ بررسی بماند.
export function looksLikeValidContainer(buf: Buffer, ext: string): boolean {
  if (!buf || buf.length < 12) return false;
  if (ext === 'ogg') return buf.subarray(0, 4).toString('latin1') === 'OggS';
  if (ext === 'm4a') return buf.subarray(4, 8).toString('latin1') === 'ftyp';
  // webm/Matroska: EBML header
  return buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
}

// خطایِ Soniox که با retry هیچ‌وقت درست نمی‌شود (خودِ فایل نامعتبر است) — نه خطایِ موقتِ
// شبکه/سهمیه. متنِ پیام از error_messageِ خودِ Soniox می‌آید (asyncTranscribe.ts).
export function isPermanentTranscribeError(e: unknown): boolean {
  return /invalid audio file/i.test(String(e));
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
function isNoteArchiveFile(f: string): boolean {
  return f.includes('.notearchive.');
}

// seq/run/mime از اسمِ فایل استخراج می‌شه (فرمت:
// <sessionId>-<seqِ ۶رقمی>-<runId>-<timestamp>[.note|.archive|.late].<webm|ogg|m4a>)
// تا موقعِ آرشیوکردن برایِ ادمین، ترتیبِ واقعیِ سگمنت، runِ صاحبش، و mimeِ واقعی حفظ بمونه.
const EXT_ALTERNATION = KNOWN_EXTS.join('|');
// فایل‌هایِ خیلی قدیمی (پیش از migration 017، بخشِ runId هنوز نبود): <sessionId>-<seq>-<timestamp>.ext
const LEGACY_NO_RUN_RE = new RegExp(`^(.+)-(\\d{6})-(\\d+)\\.(?:note\\.|archive\\.|late\\.|notearchive\\.)?(?:${EXT_ALTERNATION})$`);
const WITH_RUN_RE = new RegExp(`^(.+)-(\\d{6})-([a-zA-Z0-9]+)-(\\d+)\\.(?:note\\.|archive\\.|late\\.|notearchive\\.)?(?:${EXT_ALTERNATION})$`);

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
function extFromFilename(filePath: string): string {
  const base = path.basename(filePath);
  const m = base.match(new RegExp(`\\.(${EXT_ALTERNATION})$`));
  return m ? m[1] : 'webm';
}
function mimeFromFilename(filePath: string): string {
  return mimeForExt(extFromFilename(filePath));
}

// سگمنتِ غیرقابلِ‌رونویسی را از صف خارج کن (نسخه‌ی آرشیوِ ادمین از قبل نوشته شده و می‌ماند).
function dropUnrecoverable(sessionId: string, file: string, purpose: BatchPurpose, bytes: number, reason: string) {
  removeAudioFile(file);
  console.log(`[batch] unrecoverable segment dropped from queue (archive kept) session=${sessionId} purpose=${purpose} seq=${seqFromFilename(file)} bytes=${bytes} reason=${reason}`);
  logEvent({ event: 'batch.segment_unrecoverable', sessionId, source: 'job', severity: 'warn', detail: { purpose, seq: seqFromFilename(file), bytes, reason } });
}

// ⭐ (A2، 2026-09-26) زمانِ شروعِ run از خودِ runId (genRunId در feelia-rt.js: Date.now() به base36 + ۶ نویسه‌ی
// تصادفی). runِ legacy/ناشناخته ⇒ 0. برایِ ترتیبِ واقعیِ ضبط بینِ runها (ادامه بعد از رفرش هر run را از seq=0 شروع می‌کند).
export function runStartMs(runId: string | null | undefined): number {
  const r = String(runId || '');
  if (!/^[a-z0-9]{9,}$/i.test(r)) return 0;
  const t = parseInt(r.slice(0, r.length - 6), 36);
  return Number.isFinite(t) && t > 1_500_000_000_000 && t < 4_000_000_000_000 ? t : 0;
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
      if (purpose === 'note-archive') return isNoteArchiveFile(f);
      return !isNoteFile(f) && !isArchiveFile(f) && !isLateFile(f) && !isNoteArchiveFile(f);
    })
    .map((f) => path.join(QUEUE_DIR, f))
    // (A2) ترتیبِ ضبط: (زمانِ شروعِ run، seq) — قبلاً sortِ متنی بر اساسِ seq بود و seq=0ِ runِ بعدی جلوتر از seq=5ِ runِ قبلی می‌رفت.
    .sort((a, b) => {
      const pa = parseQueueFilename(a), pb = parseQueueFilename(b);
      return (runStartMs(pa?.runId) - runStartMs(pb?.runId)) || ((pa?.seq ?? 0) - (pb?.seq ?? 0)) || (a < b ? -1 : a > b ? 1 : 0);
    });
}

// ⭐ (A2) placeholderِ بازه‌ی قطعی که کلاینت در جایِ زمانیِ درست گذاشته (insertRecoveryPlaceholder در feelia-rt.js):
// «[⏳ … · #<run>:<seq>]». applyBatchSegmentOnce همان را درجا با متنِ بازیابی‌شده جایگزین می‌کند.
export const RECOVERED_LABEL = 'بازیابی‌شده از صدایِ بازه‌ی قطعی';
export const RECOVERED_EMPTY_LABEL = 'بازه‌ی قطعی — گفتاری تشخیص داده نشد';
export function recoveryKey(runId: string, seq: number): string {
  return `${String(runId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}:${seq}`;
}
function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
export function recoveryPlaceholderRe(key: string): RegExp {
  return new RegExp(`\\[⏳ [^\\]\\n]*· #${escapeRe(key)}\\]`);
}
// متنِ فعلی + متنِ بازیابی‌شده‌ی یک سگمنت ⇒ متنِ جدید (یا null اگر تغییری لازم نیست).
export function mergeRecoveredSegment(currentText: string, text: string, key: string | undefined, label?: string): string | null {
  const re = key ? recoveryPlaceholderRe(key) : null;
  if (re && re.test(currentText)) {
    const repl = text ? `[${RECOVERED_LABEL} · #${key}]\n${text}` : `[${RECOVERED_EMPTY_LABEL} · #${key}]`;
    return currentText.replace(re, () => repl);
  }
  if (!text) return null;
  // placeholder نیست (کلاینتِ قدیمی، یا placeholder هنوز ذخیره نشده بود) ⇒ رفتارِ قبلی: append، حالا با برچسب/کلید
  // تا کلاینت placeholderِ ذخیره‌نشده‌ی همان بازه را بعداً حذف کند (dropResolvedPlaceholders).
  const head = label ? label + (key ? ` [#${key}]` : '') : key ? `[${RECOVERED_LABEL} · #${key}]` : '';
  const segment = head ? `${head}\n${text}` : text;
  return currentText ? currentText + '\n\n' + segment : segment;
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

// (A4، 2026-09-26) همه‌ی فایل‌هایِ صفِ یک جلسه، با هر purpose — برایِ حذفِ جلسه/مراجع (LAW-010).
export function allQueueFilesFor(sessionId: string): string[] {
  ensureDir();
  const safe = String(sessionId).replace(/[^a-zA-Z0-9-]/g, '');
  if (!safe) return [];
  return readdirSync(QUEUE_DIR).filter((f) => f.startsWith(safe + '-')).map((f) => path.join(QUEUE_DIR, f));
}

// (A4) فایل‌هایِ صف همراهِ sessionIdِ نامشان — برایِ پاک‌کردنِ فایلِ جلسه‌ای که دیگر در DB نیست.
export function queueFilesWithSession(): { path: string; sessionId: string }[] {
  ensureDir();
  const out: { path: string; sessionId: string }[] = [];
  for (const f of readdirSync(QUEUE_DIR)) {
    const p = path.join(QUEUE_DIR, f);
    const sid = parseQueueFilename(p)?.sessionId;
    if (sid) out.push({ path: p, sessionId: sid });
  }
  return out;
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
//
// ⭐ رفعِ F1 (audit آپلود، 2026-09-23): merge قبلاً idempotent نبود — اگر سرور بعد از UPDATEِ
// متن و قبل از removeAudioFile کرش می‌کرد، retry همان متن را دوباره append می‌کرد. همچنین
// read→write بدونِ قفل بود (نوشتنِ هم‌زمانِ دیگر بینِ آن دو گم می‌شد). حالا همه در یک تراکنش:
// ردیفِ آرشیوِ همین بایت‌ها (session_id+sha256) با FOR UPDATE قفل می‌شود و transcribed_atِ آن
// «یک‌بار» بودن را تضمین می‌کند؛ ردیفِ sessions هم FOR UPDATE خوانده می‌شود (append رویِ آخرین متن).
// خروجی: true اگر همین فراخوانی اعمال کرد، false اگر قبلاً اعمال شده بود.
export async function applyBatchSegmentOnce(
  sessionId: string,
  sha256: string,
  batchText: string,
  purpose: BatchPurpose,
  label?: string,
  key?: string // (A2) run:seqِ همین سگمنت — برایِ جایگزینیِ درجایِ placeholder
): Promise<boolean> {
  const text = batchText.trim();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [auditRows] = await conn.query(
      'SELECT transcribed_at FROM session_audio WHERE session_id = ? AND sha256 = ? FOR UPDATE',
      [sessionId, sha256]
    );
    const audioRow = (auditRows as any[])[0];
    if (audioRow && audioRow.transcribed_at) {
      await conn.commit();
      return false;
    }
    if (purpose === 'note') {
      if (text) {
        await conn.query(
          `INSERT INTO session_notes (id, session_id, type, text, wall_clock) VALUES (?, ?, 'voice', ?, ?)`,
          [randomUUID(), sessionId, text, new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })]
        );
      }
    } else {
      // (A2) حتی با متنِ خالی (سکوت) placeholderِ همین بازه باید بسته شود، وگرنه «⏳» برایِ همیشه می‌ماند.
      const [curRows] = await conn.query('SELECT transcript FROM sessions WHERE id = ? FOR UPDATE', [sessionId]);
      const cur = (curRows as any[])[0];
      if (cur) {
        const currentText: string = cur.transcript ?? '';
        const merged = mergeRecoveredSegment(currentText, text, key, label);
        if (merged !== null) {
          await conn.query(
            `UPDATE sessions SET transcript = ?, transcript_version = transcript_version + 1,
              realtime_reliable = false, batch_status = 'done', updated_at = NOW() WHERE id = ?`,
            [merged, sessionId]
          );
        }
      }
    }
    if (audioRow) {
      await conn.query('UPDATE session_audio SET transcribed_at = NOW() WHERE session_id = ? AND sha256 = ?', [sessionId, sha256]);
    }
    await conn.commit();
    console.log(`[batch] applied session=${sessionId} purpose=${purpose} chars=${text.length}`);
    return true;
  } catch (e) {
    try { await conn.rollback(); } catch {}
    throw e;
  } finally {
    conn.release();
  }
}

// آیا متنِ همین بایت‌ها قبلاً اعمال شده؟ (پیش‌بررسیِ ارزان قبل از صدا زدنِ Soniox — نگهبانِ
// واقعی همان قفلِ داخلِ applyBatchSegmentOnce است.)
async function segmentAlreadyApplied(sessionId: string, sha256: string): Promise<boolean> {
  const r = await query('SELECT transcribed_at FROM session_audio WHERE session_id = ? AND sha256 = ?', [sessionId, sha256]);
  return !!r.rows[0]?.transcribed_at;
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
const withQueueLock = createKeyedLock();

export async function processBatchQueue(sessionId: string, purpose: BatchPurpose = 'transcript'): Promise<void> {
  return withQueueLock(`${sessionId}:${purpose}`, () => processBatchQueueInner(sessionId, purpose));
}

async function processBatchQueueInner(sessionId: string, purpose: BatchPurpose): Promise<void> {
  const files = pendingAudiosFor(sessionId, purpose);
  if (!files.length) return;

  if (purpose === 'archive' || purpose === 'note-archive') {
    const { readFileSync } = await import('node:fs');
    const { archiveAudioForAdmin } = await import('../archive/sessionAudioArchive.js');
    for (const file of files) {
      let buffer: Buffer;
      try { buffer = readFileSync(file); } catch { continue; }
      try {
        await archiveAudioForAdmin(sessionId, seqFromFilename(file), buffer, mimeFromFilename(file), 'durable', runIdFromFilename(file), purpose === 'note-archive' ? 'note' : 'session');
        removeAudioFile(file);
        console.log(`[batch] archived (no transcribe) session=${sessionId} seq=${seqFromFilename(file)}`);
      } catch (e) {
        // (A4) جلسه حذف شده ⇒ صدایش هم نباید بماند (LAW-010)
        if ((e as { code?: string })?.code === 'session-gone') { removeAudioFile(file); continue; }
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
    const { transcribeFileAsync } = await import('../soniox/restClient.js');
    const { archiveAudioForAdmin } = await import('../archive/sessionAudioArchive.js');
    let appliedLate = false;
    // ⭐ (2026-09-26، جلسه‌ی cee2e5d2 در تستِ واقعی): اگر همه‌ی سگمنت‌ها غیرقابلِ‌رونویسی بودند،
    // وضعیت قبلاً 'done' می‌شد — انگار رونویسی موفق بوده. حالا فقط وقتی هیچ سگمنتی اعمال نشده، 'failed'.
    let droppedCount = 0;
    let appliedCount = 0;
    for (const file of files) {
      let buffer: Buffer;
      try { buffer = readFileSync(file); } catch { continue; }
      // ⭐ آرشیو قبل از رونویسی: حتی اگه transcribeFileAsync بعداً شکست بخوره (egress
      // قطع، سهمیه‌ی Soniox، …) صدا از قبل امن ذخیره شده. idempotent (sha256) —
      // retryِ همین فایل روی این خط فقط no-op می‌کنه، ردیفِ تکراری نمی‌سازه.
      try {
        await archiveAudioForAdmin(sessionId, seqFromFilename(file), buffer, mimeFromFilename(file), 'durable', runIdFromFilename(file), purpose === 'note' ? 'note' : 'session');
      } catch (e) {
        if ((e as { code?: string })?.code === 'session-gone') { removeAudioFile(file); continue; } // (A4) LAW-010
        console.log('[batch] archive-for-admin failed, kept queued:', String(e).slice(0, 160));
        logEvent({ event: 'audio.archive_failed', sessionId, source: 'job', severity: 'error', detail: { purpose } });
        continue;
      }
      // ⭐ فایلِ بدونِ هدرِ container هرگز رونویسی نمی‌شود — قبلاً هر ۵ دقیقه (retryQueuedBatches)
      // دوباره به Soniox آپلود و رد می‌شد و batch_status برایِ همیشه 'queued' می‌ماند.
      if (!looksLikeValidContainer(buffer, extFromFilename(file))) {
        dropUnrecoverable(sessionId, file, purpose, buffer.length, 'bad-container');
        droppedCount++;
        continue;
      }
      const sha256 = createHash('sha256').update(buffer).digest('hex');
      if (await segmentAlreadyApplied(sessionId, sha256)) {
        // کرشِ قبلی بعد از اعمالِ متن و قبل از حذفِ فایل — فقط تمیزکاری، بدونِ رونویسی/appendِ دوباره.
        appliedCount++;
        removeAudioFile(file);
        console.log(`[batch] segment already applied, dropped duplicate session=${sessionId} purpose=${purpose}`);
        continue;
      }
      console.log(`[batch] processing session=${sessionId} purpose=${purpose} bytes=${buffer.length} (async API)`);
      let text = '';
      try {
        const { treatmentUnits } = await import('../../treatment-unit/index.js');
        const context = purpose === 'note' ? undefined : await treatmentUnits.sessionSttContext(sessionId);
        text = await transcribeFileAsync(buffer, `${sessionId}.webm`, `feelia:${sessionId}:${purpose}`, { sessionContext: purpose !== 'note', context });
      } catch (e) {
        if (isPermanentTranscribeError(e)) {
          dropUnrecoverable(sessionId, file, purpose, buffer.length, 'soniox-invalid-audio');
          droppedCount++;
          continue;
        }
        console.log('[batch] async transcribe error, kept queued (already archived):', String(e).slice(0, 160));
        continue; // این فایل توی صف می‌مونه؛ صدا از قبل آرشیو شده، فقط رونویسی عقب افتاده
      }
      // ⭐ سکوت (متنِ خالی) هم نتیجه‌ی موفقِ رونویسی است، نه شکست — applyBatchSegmentOnce در آن
      // حالت فقط سگمنت را «اعمال‌شده» علامت می‌زند.
      const applied = await applyBatchSegmentOnce(
        sessionId, sha256, text || '', purpose,
        purpose === 'late-transcript' ? LATE_TRANSCRIPT_LABEL : undefined,
        purpose === 'note' ? undefined : recoveryKey(runIdFromFilename(file), seqFromFilename(file))
      );
      // (A5، 2026-09-26) هر متنِ تازه‌ای که به جلسه‌ی از‌قبل‌completed رسید (نه فقط late-transcript) پرونده را به‌روز کند.
      if (applied && text && text.trim() && purpose !== 'note') appliedLate = true;
      appliedCount++;
      removeAudioFile(file);
      console.log(`[batch] segment done session=${sessionId} purpose=${purpose}`);
    }
    if (isTranscriptLike) {
      const left = pendingAudiosFor(sessionId, purpose);
      const allUnrecoverable = !left.length && droppedCount > 0 && appliedCount === 0;
      const next: BatchStatus = left.length ? 'queued' : allUnrecoverable ? 'failed' : 'done';
      await query(`UPDATE sessions SET batch_status = ?, updated_at = NOW() WHERE id = ?`, [next, sessionId]);
      console.log(`[batch] finished session=${sessionId} status=${next} remaining=${left.length} dropped=${droppedCount}`);
      if (next === 'done') logEvent({ event: 'batch.completed', sessionId, source: 'job', detail: { purpose } });
      if (next === 'failed') logEvent({ event: 'batch.failed', sessionId, source: 'job', severity: 'warn', detail: { purpose, reason: 'all-unrecoverable', dropped: droppedCount } });
    }
    // ⭐ رفعِ F8: متنِ late-transcript رویِ جلسه‌ی از‌قبل‌completedشده اضافه می‌شد ولی هیچ‌وقت به
    // پرونده نمی‌رسید (هیچ triggerی نبود). همان سیاستِ مرکزیِ auto-generate صدا زده می‌شود.
    if (appliedLate) {
      // triggerCaseFileForSession خودش فقط جلسه‌ی completed را trigger می‌کند.
      const { triggerCaseFileForSession } = await import('../../case-file/application/autoTrigger.js');
      void triggerCaseFileForSession(sessionId, purpose === 'late-transcript' ? 'late-transcript' : 'batch-after-complete');
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

// پاک‌سازی: فایل‌های قدیمی‌تر از RETENTION_MS (نشت دیسک/حریم خصوصی). در startup و هر
// BATCH_SWEEP_INTERVAL_MS (index.ts) — قبلاً فقط startup، یعنی سروری که ری‌استارت نمی‌شد
// سیاستِ ۲۴ساعته را هرگز اعمال نمی‌کرد.
export const BATCH_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
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
    const { archiveAudioForAdmin } = await import('../archive/sessionAudioArchive.js');
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
              await archiveAudioForAdmin(sessionId, seqFromFilename(p), buffer, mimeFromFilename(p), 'durable', runIdFromFilename(p), isNoteFile(f) || isNoteArchiveFile(f) ? 'note' : 'session');
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
  await reconcileStaleBatchStatuses();
}

// ⭐ باگِ واقعی (تستِ واقعی 2026-09-21، جلسه‌ی cee2e5d2): sweepِ بالا فایلِ صف را بعد از ۲۴ ساعت پاک
// می‌کرد ولی sessions.batch_status را دست نمی‌زد — جلسه برای همیشه 'queued' می‌ماند (پنلِ ادمین «در انتظار»
// نشان می‌داد) درحالی‌که دیگر هیچ صدایی برایِ رونویسی وجود نداشت. هر جلسه‌ی live/manual که 'queued'/'processing'
// است، هیچ فایلِ transcript/late در صف ندارد و بیش از STALE_BATCH_MS دست نخورده، صادقانه 'failed' می‌شود.
// جلسه‌های آپلودی (source='upload') مالکِ جدا دارند (audio_jobs/jobRunner) و این‌جا لمس نمی‌شوند.
// صدایِ همان سگمنت‌ها پیش از sweep در آرشیوِ ادمین (session_audio) نوشته شده و می‌ماند.
const STALE_BATCH_MS = 60 * 60 * 1000;
export async function reconcileStaleBatchStatuses(): Promise<number> {
  let fixed = 0;
  try {
    const r = await query(
      `SELECT id FROM sessions
        WHERE batch_status IN ('queued', 'processing')
          AND (source IS NULL OR source <> 'upload')
          AND updated_at < NOW() - INTERVAL ? SECOND`,
      [Math.floor(STALE_BATCH_MS / 1000)]
    );
    for (const row of r.rows as { id: string }[]) {
      if (pendingAudiosFor(row.id, 'transcript').length || pendingAudiosFor(row.id, 'late-transcript').length) continue;
      const u = await query(
        `UPDATE sessions SET batch_status = 'failed', updated_at = NOW()
          WHERE id = ? AND batch_status IN ('queued', 'processing')`,
        [row.id]
      );
      if (u.rowCount) {
        fixed++;
        console.log(`[batch] stale batch_status reconciled to failed session=${row.id}`);
        logEvent({ event: 'batch.failed', sessionId: row.id, source: 'job', severity: 'warn', detail: { reason: 'stale-no-audio' } });
      }
    }
  } catch (e) {
    console.log('[batch] reconcile failed:', String(e).slice(0, 160));
  }
  return fixed;
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
      const purpose: BatchPurpose = isNoteFile(f) ? 'note' : isArchiveFile(f) ? 'archive' : isLateFile(f) ? 'late-transcript'
        : isNoteArchiveFile(f) ? 'note-archive' : 'transcript';
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
