// رونویسیِ فایل‌هایِ صف (Soniox async) و اعمالِ یک‌باره‌ی متن در جلسه/یادداشت؛ صف‌کردنِ سگمنتِ تازه؛ workerِ retry.
// آرشیو و Soniox و پرونده عمداً با import پویا (lazy، همان رفتارِ قبلی) بارگذاری می‌شوند.
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, openSync, readdirSync, writeSync } from 'node:fs';
import path from 'node:path';
import { query, pool } from '../../../db/connection.js';
import { logEvent } from '../../../obs/eventLog.js';
import { createKeyedLock } from '../../../shared/keyedLock.js';
import {
  QUEUE_DIR, ensureDir, audioPathFor, looksLikeValidContainer, isNoteFile, isArchiveFile, isLateFile, isNoteArchiveFile, isPreNoteFile,
  seqFromFilename, runIdFromFilename, extFromFilename, mimeFromFilename, sessionIdFromFilename, pendingAudiosFor, removeAudioFile,
  type BatchPurpose,
} from './queueFiles.js';
import { mergeRecoveredSegment, recoveryKey, mergeRecoveryLost } from './recoveryMerge.js';
import { hardDeleteAllowed } from '../../../shared/retention.js';

export type BatchStatus = 'queued' | 'processing' | 'done' | 'failed';

export const LATE_TRANSCRIPT_LABEL = '[بخشِ ضبط‌شده در زمانِ قطعیِ اینترنت — بعداً رونویسی شد]';

// خطایِ Soniox که با retry هیچ‌وقت درست نمی‌شود (خودِ فایل نامعتبر است) — نه خطایِ موقتِ
// شبکه/سهمیه. متنِ پیام از error_messageِ خودِ Soniox می‌آید (asyncTranscribe.ts).
export function isPermanentTranscribeError(e: unknown): boolean {
  return /invalid audio file/i.test(String(e));
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
  // fsync پیش از پاسخِ 202: مرورگر بعد از 202 نسخه‌ی IndexedDB را پاک می‌کند؛ بدونِ fsync قطعِ برقِ سرور همان تنها نسخه را می‌برد.
  const fd = openSync(p, 'w');
  try {
    let off = 0;
    while (off < buf.length) off += writeSync(fd, buf, off, buf.length - off);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
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

// سگمنتِ غیرقابلِ‌رونویسی را از صف خارج کن (نسخه‌ی آرشیوِ ادمین از قبل نوشته شده و می‌ماند).
export async function closePlaceholderAsLost(sessionId: string, runId: string, seq: number): Promise<boolean> {
  const key = recoveryKey(runId, seq);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT transcript FROM sessions WHERE id = ? FOR UPDATE', [sessionId]);
    const cur = (rows as any[])[0];
    const merged = cur ? mergeRecoveryLost(cur.transcript ?? '', key) : null;
    if (merged !== null) {
      await conn.query('UPDATE sessions SET transcript = ?, transcript_version = transcript_version + 1, updated_at = NOW() WHERE id = ?', [merged, sessionId]);
    }
    await conn.commit();
    return merged !== null;
  } catch (e) {
    try { await conn.rollback(); } catch {}
    return false; // fail-open: ثبتِ نشانگر مانعِ پاک‌سازیِ صف نمی‌شود
  } finally {
    conn.release();
  }
}

function dropUnrecoverable(sessionId: string, file: string, purpose: BatchPurpose, bytes: number, reason: string) {
  removeAudioFile(file);
  if (purpose === 'transcript' || purpose === 'late-transcript') {
    void closePlaceholderAsLost(sessionId, runIdFromFilename(file), seqFromFilename(file));
  }
  console.log(`[batch] unrecoverable segment dropped from queue (archive kept) session=${sessionId} purpose=${purpose} seq=${seqFromFilename(file)} bytes=${bytes} reason=${reason}`);
  logEvent({ event: 'batch.segment_unrecoverable', sessionId, source: 'job', severity: 'warn', detail: { purpose, seq: seqFromFilename(file), bytes, reason } });
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
    if (purpose === 'note' || purpose === 'pre-note') {
      if (text) {
        // pre-note (2026-09-29): یادداشتِ صوتیِ پیش از جلسه ⇒ type='voice_before'؛ مثلِ note هرگز transcript نه (LAW-008).
        await conn.query(
          `INSERT INTO session_notes (id, session_id, type, text, wall_clock) VALUES (?, ?, ?, ?, ?)`,
          [randomUUID(), sessionId, purpose === 'pre-note' ? 'voice_before' : 'voice', text, new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })]
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
    const { archiveAudioForAdmin } = await import('../archive/archiveWrite.js');
    for (const file of files) {
      let buffer: Buffer;
      try { buffer = readFileSync(file); } catch { continue; }
      try {
        await archiveAudioForAdmin(sessionId, seqFromFilename(file), buffer, mimeFromFilename(file), 'durable', runIdFromFilename(file), purpose === 'note-archive' ? 'note' : 'session');
        removeAudioFile(file);
        console.log(`[batch] archived (no transcribe) session=${sessionId} seq=${seqFromFilename(file)}`);
      } catch (e) {
        // (A4) جلسه حذف شده ⇒ صدایش هم نباید بماند (LAW-010)
        if ((e as { code?: string })?.code === 'session-gone') { if (hardDeleteAllowed()) removeAudioFile(file); continue; }
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
    const { archiveAudioForAdmin } = await import('../archive/archiveWrite.js');
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
        await archiveAudioForAdmin(sessionId, seqFromFilename(file), buffer, mimeFromFilename(file), 'durable', runIdFromFilename(file), purpose === 'note' ? 'note' : purpose === 'pre-note' ? 'prenote' : 'session');
      } catch (e) {
        if ((e as { code?: string })?.code === 'session-gone') { if (hardDeleteAllowed()) removeAudioFile(file); continue; } // (A4) LAW-010
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
        const isNoteLike = purpose === 'note' || purpose === 'pre-note';
        const context = isNoteLike ? undefined : await treatmentUnits.sessionSttContext(sessionId);
        text = await transcribeFileAsync(buffer, `${sessionId}.webm`, `feelia:${sessionId}:${purpose}`, { sessionContext: !isNoteLike, context, diarize: purpose !== 'pre-note' });
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
        purpose === 'note' || purpose === 'pre-note' ? undefined : recoveryKey(runIdFromFilename(file), seqFromFilename(file))
      );
      // (A5، 2026-09-26) هر متنِ تازه‌ای که به جلسه‌ی از‌قبل‌completed رسید (نه فقط late-transcript) پرونده را به‌روز کند.
      // pre-note هم (2026-09-29، تصمیمِ مالک: واردِ پرونده شود) — مثلاً جلسه‌ی آپلودی که پیش از رسیدنِ این متن completed شده.
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
      const { triggerCaseFileForSession } = await import('../../case-file/index.js');
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
        : isNoteArchiveFile(f) ? 'note-archive' : isPreNoteFile(f) ? 'pre-note' : 'transcript';
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
