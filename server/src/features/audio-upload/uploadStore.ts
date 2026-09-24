// ذخیره‌ی durableِ آپلودِ تکه‌تکه رویِ دیسکِ سرور (migration 023 — محلِ جدیدِ ذخیره‌ی صدا، تأییدِ مالک
// 2026-09-23 با سقفِ نگهداریِ ۱۴ روز، LAW-010).
//
// data/uploads/<uploadId>/
//   chunk-000000.part …   ← هر تکه جدا، با نوشتنِ اتمیک (tmp + rename): تکه‌ای که رویِ دیسک هست کامل است
//   source.<ext>          ← بعد از complete: الحاقِ stream‌یِ تکه‌ها (هرگز کلِ فایل در RAM نیست)
//
// هیچ‌چیز از این پوشه static سرو نمی‌شود (فقط public/ سرو می‌شود — LAW-005).
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, statfsSync, writeFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { query } from '../../db/connection.js';

export const UPLOAD_ROOT = path.join(process.cwd(), 'data', 'uploads');
export const CHUNK_SIZE = 4 * 1024 * 1024; // زیرِ سقفِ ۱۲MBِ nginx؛ هر تکه در یک درخواستِ کوتاه — اینترنتِ ضعیف فقط همان تکه را تکرار می‌کند
export const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024; // ۱GB (تصمیمِ مالک)
export const INCOMPLETE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // آپلودِ نیمه‌کاره حداکثر ۷ روز منتظرِ ادامه می‌ماند
export const MAX_ACTIVE_UPLOADS_PER_THERAPIST = 5;

const ID_RE = /^[0-9a-f-]{36}$/;

export function uploadDir(uploadId: string): string {
  if (!ID_RE.test(uploadId)) throw new Error('invalid upload id');
  return path.join(UPLOAD_ROOT, uploadId);
}

function chunkName(n: number): string {
  return `chunk-${String(n).padStart(6, '0')}.part`;
}

export function expectedChunkBytes(sizeBytes: number, chunkSize: number, n: number): number {
  const total = Math.ceil(sizeBytes / chunkSize);
  if (n < 0 || n >= total) return -1;
  return n === total - 1 ? sizeBytes - chunkSize * (total - 1) : chunkSize;
}

export function ensureUploadDir(uploadId: string): string {
  const dir = uploadDir(uploadId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// نوشتنِ اتمیک: تکه‌ی نیمه‌نوشته (قطعِ برق/کرش وسطِ write) هرگز با نامِ نهایی دیده نمی‌شود.
// idempotent: دوباره فرستادنِ همان تکه (retryِ کلاینت بعد از timeout) فقط بازنویسی می‌کند.
export function writeChunk(uploadId: string, n: number, body: Buffer): void {
  const dir = ensureUploadDir(uploadId);
  const final = path.join(dir, chunkName(n));
  const tmp = final + '.tmp-' + process.pid + '-' + Date.now();
  writeFileSync(tmp, body);
  renameSync(tmp, final);
}

export function receivedChunks(uploadId: string, sizeBytes: number, chunkSize: number): number[] {
  const dir = uploadDir(uploadId);
  if (!existsSync(dir)) return [];
  const out: number[] = [];
  for (const f of readdirSync(dir)) {
    const m = /^chunk-(\d{6})\.part$/.exec(f);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    try {
      // تکه‌ی با حجمِ نادرست (نباید پیش بیاید چون route حجم را چک می‌کند) دریافت‌شده حساب نمی‌شود.
      if (statSync(path.join(dir, f)).size === expectedChunkBytes(sizeBytes, chunkSize, n)) out.push(n);
    } catch {}
  }
  return out.sort((a, b) => a - b);
}

// الحاقِ stream‌یِ تکه‌ها به source.<ext>؛ بعد از تأییدِ حجمِ نهایی، تکه‌ها پاک می‌شوند.
export async function assembleUpload(uploadId: string, chunksTotal: number, sizeBytes: number, ext: string): Promise<string> {
  const dir = uploadDir(uploadId);
  const safeExt = /^[a-z0-9]{1,6}$/.test(ext) ? ext : 'bin';
  const out = path.join(dir, `source.${safeExt}`);
  const tmp = out + '.assembling';
  const ws = createWriteStream(tmp);
  try {
    for (let n = 0; n < chunksTotal; n++) {
      await pipeline(createReadStream(path.join(dir, chunkName(n))), ws, { end: false });
    }
  } finally {
    await new Promise<void>((resolve) => ws.end(() => resolve()));
  }
  const size = statSync(tmp).size;
  if (size !== sizeBytes) {
    rmSync(tmp, { force: true });
    throw new Error(`assembled size mismatch: ${size} != ${sizeBytes}`);
  }
  renameSync(tmp, out);
  for (let n = 0; n < chunksTotal; n++) rmSync(path.join(dir, chunkName(n)), { force: true });
  return out;
}

export function removeUploadDir(uploadId: string): void {
  try { rmSync(uploadDir(uploadId), { recursive: true, force: true }); } catch {}
}

// فضایِ خالیِ دیسک — آپلودی که جا ندارد از همان اول با پیامِ روشن رد می‌شود، نه وسطِ کار.
export function freeBytes(): number | null {
  try {
    if (!existsSync(UPLOAD_ROOT)) mkdirSync(UPLOAD_ROOT, { recursive: true });
    const s = statfsSync(UPLOAD_ROOT);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return null;
  }
}

// پوشه‌ای که ردیفِ audio_uploads ندارد (حذفِ جلسه/مراجع/تراپیست با cascade) ⇒ صدایِ یتیم ⇒ حذف.
export async function sweepOrphanUploadDirs(): Promise<void> {
  try {
    if (!existsSync(UPLOAD_ROOT)) return;
    const names = readdirSync(UPLOAD_ROOT).filter((n) => ID_RE.test(n));
    if (!names.length) return;
    const r = await query(`SELECT id FROM audio_uploads WHERE id IN (${names.map(() => '?').join(',')})`, names);
    const alive = new Set(r.rows.map((x: any) => x.id));
    for (const n of names) {
      if (!alive.has(n)) {
        removeUploadDir(n);
        console.log(`[upload] removed orphan upload dir ${n}`);
      }
    }
  } catch (e) {
    console.log('[upload] orphan sweep failed:', String(e).slice(0, 160));
  }
}

// آپلودِ نیمه‌کاره‌ی رهاشده (> ۷ روز) ⇒ canceled + حذفِ تکه‌ها. آپلودِ complete شده‌ای که پوشه‌اش
// هنوز مانده و jobش تمام شده/شکست خورده و از ۱۴ روز گذشته ⇒ حذفِ فایلِ منبع (سقفِ LAW-010).
export async function sweepStaleUploads(): Promise<void> {
  try {
    const stale = await query(
      `SELECT id FROM audio_uploads WHERE status = 'uploading' AND updated_at < (NOW() - INTERVAL ? SECOND)`,
      [Math.floor(INCOMPLETE_RETENTION_MS / 1000)]
    );
    for (const row of stale.rows) {
      await query(`UPDATE audio_uploads SET status = 'canceled', error_code = 'expired' WHERE id = ? AND status = 'uploading'`, [row.id]);
      removeUploadDir(row.id);
    }
    const old = await query(
      `SELECT id FROM audio_uploads WHERE status IN ('complete','failed','canceled') AND updated_at < (NOW() - INTERVAL 14 DAY)`
    );
    for (const row of old.rows) removeUploadDir(row.id);
    await sweepOrphanUploadDirs();
  } catch (e) {
    console.log('[upload] stale sweep failed:', String(e).slice(0, 160));
  }
}
