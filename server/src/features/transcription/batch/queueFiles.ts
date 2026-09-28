// صف batch fallback — فقط برای failure مسیر realtime.
// حریم خصوصی: صوت خام فقط در این مسیرِ شکست به سرور Feelia می‌آید (نه در حالت عادی)،
// روی دیسکِ موقتِ سرور می‌ماند تا رونویسی شود، بلافاصله بعد از موفقیت حذف می‌شود،
// و فایل‌های قدیمی‌تر از ۲۴ ساعت در startup و هر ساعت پاک می‌شوند. هیچ صوتی در DB ذخیره نمی‌شود.
//
// فایل‌هایِ صف رویِ دیسک (data/batch-queue): نام‌گذاری (seq/run/purpose/mime در نامِ فایل)، فهرست به ترتیبِ ضبط، حذف.
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

export const QUEUE_DIR = path.join(process.cwd(), 'data', 'batch-queue');
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
export function ensureDir() {
  if (!existsSync(QUEUE_DIR)) mkdirSync(QUEUE_DIR, { recursive: true });
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

export function validateAudioBuffer(buf: Buffer): string | null {
  if (!buf || buf.length < 100) return 'فایل صوتی خیلی کوتاه است';
  if (buf.length > MAX_AUDIO_BYTES) return 'فایل صوتی بیش از حد بزرگ است';
  return null;
}

export function isNoteFile(f: string): boolean {
  return f.includes('.note.');
}
export function isArchiveFile(f: string): boolean {
  return f.includes('.archive.');
}
export function isLateFile(f: string): boolean {
  return f.includes('.late.');
}
export function isNoteArchiveFile(f: string): boolean {
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
export function seqFromFilename(filePath: string): number {
  return parseQueueFilename(filePath)?.seq ?? 0;
}
export function runIdFromFilename(filePath: string): string {
  return parseQueueFilename(filePath)?.runId ?? 'legacy';
}
export function extFromFilename(filePath: string): string {
  const base = path.basename(filePath);
  const m = base.match(new RegExp(`\\.(${EXT_ALTERNATION})$`));
  return m ? m[1] : 'webm';
}
export function mimeFromFilename(filePath: string): string {
  return mimeForExt(extFromFilename(filePath));
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

// null یعنی فرمتِ فایل قابلِ‌شناسایی نیست (خرابی/دستکاریِ دستی) — caller نباید تلاش
// کند این را به‌عنوانِ sessionId در DB بنویسد (طولش می‌تواند بیشتر از CHAR(36) باشد).
export function sessionIdFromFilename(filePath: string): string | null {
  return parseQueueFilename(filePath)?.sessionId ?? null;
}
