// نوشتنِ صدا در آرشیوِ ادمین (idempotent با sha256، seqِ سرور زیرِ قفلِ جلسه).
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { query } from '../../../db/connection.js';
import { extForMime } from '../batch/queueFiles.js';
import { ensureArchiveDir, sessionDir, withSessionLock, type AudioSource, type AudioKind } from './store.js';
import { remuxAndGetDuration, probeDurationMs } from './ffmpegOps.js';

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
    // ⭐ (A4، 2026-09-26) جلسه‌ی حذف‌شده: قبلاً فایل نوشته می‌شد، INSERT با FK شکست می‌خورد و فایل بدونِ ردیف
    // رویِ دیسک می‌ماند (sweep فقط ردیف‌ها را می‌دید) — نقضِ LAW-010. حالا اصلاً نوشته نمی‌شود.
    await assertSessionExists(sessionId);
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
    // ⭐ (2026-09-29) seq برایِ هر kind از ۰ شروع می‌شود؛ قبلاً نامِ فایل فقط seq بود و سگمنتِ ۰ِ یادداشت
    // با سگمنتِ ۰ِ جلسه در همین پوشه یک نام داشتند ⇒ یکی رویِ دیگری نوشته می‌شد. kindِ غیرِ session پیشوند می‌گیرد
    // (فایل‌هایِ جلسه همان نامِ قبلی را دارند؛ ردیف‌هایِ قدیمی مسیرِ خودشان را در DB دارند).
    const prefix = kind === 'session' ? '' : `${kind}-`;
    const filePath = path.join(dir, `${prefix}${String(nextSeq).padStart(6, '0')}.${ext}`);
    writeFileSync(filePath, buffer);
    try {
      const durationMs = await remuxAndGetDuration(filePath);
      let bytes = buffer.length;
      try { bytes = statSync(filePath).size; } catch {}
      await query(
        `INSERT INTO session_audio (id, session_id, seq, path, bytes, mime, source, run_id, kind, sha256, duration_ms, client_seq)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), sessionId, nextSeq, filePath, bytes, mime, source, String(runId).slice(0, 64), kind, sha256, durationMs,
          Number.isInteger(clientSeq) && clientSeq >= 0 ? clientSeq : null]
      );
    } catch (e) {
      // (A4) همان الگویِ M4ِ نسخه‌ی فایل‌محور: فایلِ بدونِ ردیف نماند (جلسه وسطِ کار حذف شد / خطایِ DB).
      // ⭐ «هیچ چیزی هارد دیلیت نشود» (2026-10-02): فایلِ بدونِ ردیف پاک نمی‌شود؛ کنارش با پسوندِ .unrecorded نگه داشته می‌شود
      try { renameSync(filePath, filePath + '.unrecorded'); } catch {}
      throw e;
    }
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
      // ⭐ «هیچ چیزی هارد دیلیت نشود» (2026-10-02): فایلِ بدونِ ردیف پاک نمی‌شود؛ کنارش با پسوندِ .unrecorded نگه داشته می‌شود
      try { renameSync(filePath, filePath + '.unrecorded'); } catch {}
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

async function assertSessionExists(sessionId: string): Promise<void> {
  const r = await query('SELECT id FROM sessions WHERE id = ?', [sessionId]);
  if (!r.rows.length) {
    const err = new Error('session-gone') as Error & { code?: string };
    err.code = 'session-gone';
    throw err;
  }
}
