// جاروبِ صفِ batch (سیاستِ ۲۴ساعته، پیش از حذف یک بار آرشیو) + اصلاحِ batch_statusِ گیرکرده.
import { readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { query } from '../../../db/connection.js';
import { logEvent } from '../../../obs/eventLog.js';
import { hardDeleteAllowed } from '../../../shared/retention.js';
import {
  QUEUE_DIR, ensureDir, archiveKindForFile, seqFromFilename, runIdFromFilename, mimeFromFilename,
  sessionIdFromFilename, pendingAudiosFor, isNoteFile, isArchiveFile, isNoteArchiveFile, isPreNoteFile,
} from './queueFiles.js';

const RETENTION_MS = 24 * 60 * 60 * 1000;
// (2026-10-01، ممیزیِ Core) فایلی که آرشیوش *ناموفق* بود پس از ۲۴ساعت دیگر بی‌صدا پاک نمی‌شود (تنها نسخه‌ی صدا بود)؛ هر ساعت
// دوباره آرشیو می‌شود و فقط پس از این سقفِ سخت — با رویدادِ obsِ error — حذف می‌شود تا دیسک برایِ همیشه پر نشود.
const ARCHIVE_FAIL_HARD_MAX_MS = 7 * 24 * 60 * 60 * 1000;

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
    const { archiveAudioForAdmin } = await import('../archive/archiveWrite.js');
    for (const f of readdirSync(QUEUE_DIR)) {
      const p = path.join(QUEUE_DIR, f);
      try {
        const age = now - statSync(p).mtimeMs;
        if (age > RETENTION_MS) {
          const sessionId = sessionIdFromFilename(p);
          if (sessionId === null) {
            if (!hardDeleteAllowed()) { console.log(`[batch] unparsable filename KEPT (no hard delete): ${f}`); continue; }
            console.log(`[batch] unparsable filename, dropping without archive: ${f}`);
          } else {
            try {
              const buffer = readFileSync(p);
              await archiveAudioForAdmin(sessionId, seqFromFilename(p), buffer, mimeFromFilename(p), 'durable', runIdFromFilename(p), archiveKindForFile(f));
            } catch (e) {
              // جلسه حذف شده ⇒ صدا هم باید برود (LAW-010)؛ هر خطایِ دیگر ⇒ فایل می‌ماند تا آرشیو موفق شود.
              if ((e as { code?: string })?.code !== 'session-gone') {
                if (age < ARCHIVE_FAIL_HARD_MAX_MS || !hardDeleteAllowed()) {
                  console.log('[batch] pre-sweep archive failed, KEEPING file for retry:', f, String(e).slice(0, 160));
                  continue;
                }
                console.log('[batch] pre-sweep archive failed past hard max, dropping (ALLOW_HARD_DELETE=1):', f);
                logEvent({ event: 'audio.archive_lost', sessionId, source: 'job', severity: 'error', detail: { reason: 'archive-failed-7d' } });
              }
            }
          }
          // placeholderِ «⏳» بازه‌ای که دیگر هرگز رونویسی نمی‌شود با نشانگرِ «بازیابی نشد» بسته می‌شود (فاز ۶ ممیزیِ Core)
          if (sessionId !== null && !isNoteFile(f) && !isArchiveFile(f) && !isNoteArchiveFile(f) && !isPreNoteFile(f)) {
            const { closePlaceholderAsLost } = await import('./processQueue.js');
            await closePlaceholderAsLost(sessionId, runIdFromFilename(p), seqFromFilename(p));
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
