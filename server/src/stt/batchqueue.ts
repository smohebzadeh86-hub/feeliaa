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

// دو هدفِ جدا (ISSUE 3):
//   'transcript' → صوتِ fallback جلسه، وارد sessions.transcript می‌شود (merge نسخه‌ای).
//   'note' → صوتِ یادداشت صوتیِ ناموفق، فقط به‌صورت session_notes(type='voice') ثبت می‌شود
//             و هرگز به transcript جلسه دست نمی‌زند.
export type BatchPurpose = 'transcript' | 'note';

export function audioPathFor(sessionId: string, purpose: BatchPurpose = 'transcript'): string {
  ensureDir();
  const safe = String(sessionId).replace(/[^a-zA-Z0-9-]/g, '');
  const marker = purpose === 'note' ? '.note.' : '.';
  return path.join(QUEUE_DIR, `${safe}-${Date.now()}${marker}webm`);
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
  purpose: BatchPurpose = 'transcript'
): Promise<{ baseVersion: number }> {
  const cur = await query('SELECT transcript_version FROM sessions WHERE id = $1', [sessionId]);
  const baseVersion: number = cur.rows[0]?.transcript_version ?? 0;
  const p = audioPathFor(sessionId, purpose);
  writeFileSync(p, buf);
  if (purpose === 'transcript') {
    await query(
      `UPDATE sessions SET batch_status = 'queued', stt_mode = 'batch', updated_at = now() WHERE id = $1`,
      [sessionId]
    );
  }
  console.log(`[batch] queued session=${sessionId} purpose=${purpose} bytes=${buf.length} baseVersion=${baseVersion}`);
  return { baseVersion };
}

function isNoteFile(f: string): boolean {
  return f.includes('.note.');
}

function filesFor(sessionId: string, purpose: BatchPurpose): string[] {
  ensureDir();
  const safe = String(sessionId).replace(/[^a-zA-Z0-9-]/g, '');
  return readdirSync(QUEUE_DIR)
    .filter((f) => f.startsWith(safe + '-') && (purpose === 'note' ? isNoteFile(f) : !isNoteFile(f)))
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

// merge امن: فقط اگر نسخه همان baseVersion باشد جایگزین؛ وگرنه append (هرگز overwrite کور).
export async function mergeBatchTranscript(sessionId: string, baseVersion: number, batchText: string): Promise<void> {
  const text = batchText.trim();
  if (!text) return;
  const cur = await query('SELECT transcript, transcript_version FROM sessions WHERE id = $1', [sessionId]);
  if (!cur.rows.length) return;
  const currentText: string = cur.rows[0]?.transcript ?? '';
  const currentVersion: number = cur.rows[0]?.transcript_version ?? 0;
  if (currentVersion === baseVersion) {
    await query(
      `UPDATE sessions SET transcript = $1, transcript_version = transcript_version + 1,
        realtime_reliable = false, batch_status = 'done', updated_at = now() WHERE id = $2`,
      [text, sessionId]
    );
  } else {
    // در این فاصله realtime چیزی نوشته — batch را الحاق کن، نه جایگزین
    const merged = currentText ? currentText + '\n\n' + text : text;
    await query(
      `UPDATE sessions SET transcript = $1, transcript_version = transcript_version + 1,
        realtime_reliable = false, batch_status = 'done', updated_at = now() WHERE id = $2`,
      [merged, sessionId]
    );
  }
  console.log(`[batch] merged session=${sessionId} base=${baseVersion} now=${currentVersion}+1`);
}

// پردازش پس‌زمینه: replay آهسته‌ی صوت از روی SonioxEngine (مثل پخش واقعی).
// اگر egress قطع باشد، وضعیت queued می‌ماند تا retry بعدی — session از بین نمی‌رود.
// purpose=note → نتیجه فقط session_notes(type='voice') می‌شود، نه transcript.
export async function processBatchQueue(sessionId: string, purpose: BatchPurpose = 'transcript'): Promise<void> {
  const files = pendingAudiosFor(sessionId, purpose);
  if (!files.length) return;
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
    const { SonioxEngine } = await import('../stt/soniox.js');
    for (const file of files) {
      let buffer: Buffer;
      try { buffer = readFileSync(file); } catch { continue; }
      const baseRow = await query('SELECT transcript_version FROM sessions WHERE id = $1', [sessionId]);
      const baseVersion: number = baseRow.rows[0]?.transcript_version ?? 0;
      let finalText = '';
      const engine = new SonioxEngine(sonioxKey, {
        onPreview: () => {},
        onStatus: () => {},
        onFinished: (t) => { finalText = t; },
        onError: (e) => { console.log('[batch] Soniox error:', String(e).slice(0, 120)); },
      });
      console.log(`[batch] processing session=${sessionId} purpose=${purpose} bytes=${buffer.length}`);
      await engine.start();
      const CHUNK = 3840;
      for (let i = 0; i < buffer.length; i += CHUNK) {
        const c = buffer.subarray(i, Math.min(i + CHUNK, buffer.length));
        engine.sendAudioChunk(c.buffer.slice(c.byteOffset, c.byteOffset + c.byteLength));
        await new Promise((r) => setTimeout(r, 120));
      }
      const text = await engine.stop();
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
