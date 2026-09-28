// حذف و جاروبِ صدایِ آرشیو: حذفِ همراهِ جلسه/مراجع (LAW-010)، صدایِ جلسه‌ی ناموجود، سقفِ نگهداریِ ۱۴روزه.
import { readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { query } from '../../../db/connection.js';
import { logEvent } from '../../../obs/eventLog.js';
import { allQueueFilesFor, queueFilesWithSession, removeAudioFile } from '../batch/queueFiles.js';
import { ARCHIVE_DIR, RETENTION_MS, ensureArchiveDir, sessionDir } from './store.js';

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
  // ⭐ (A4، 2026-09-26) صدایِ همان جلسه‌ها که هنوز در صفِ batch است (data/batch-queue) — قبلاً می‌ماند و
  // sweepِ ۲۴ساعته حتی سعی می‌کرد آرشیوش کند.
  for (const id of sessionIds) {
    try { for (const f of allQueueFilesFor(id)) removeAudioFile(f); } catch {}
  }
  // جلسه‌ای که هم‌زمان با حذفِ مراجع ساخته شد (id در فهرستِ caller نبود) — هر پوشه/فایلی که جلسه‌اش دیگر نیست.
  void sweepAudioWithoutSession().catch(() => {});
  // فایل‌هایِ آپلودِ صدا (data/uploads/<uploadId>، migration 023) — ردیف‌هایِ audio_uploads با
  // cascade حذف شده‌اند؛ هر پوشه‌ای که دیگر ردیفِ متناظر ندارد همین‌جا پاک می‌شود (هر ۴ مسیرِ حذف).
  void import('../../audio-upload/uploadStore.js')
    .then((m) => m.sweepOrphanUploadDirs())
    .catch(() => {});
}

// (A4، 2026-09-26) پوشه‌ی آرشیو یا فایلِ صفی که جلسه‌اش دیگر در DB نیست ⇒ حذف (LAW-010). معیار «نبودِ ردیفِ
// sessions» است نه سن: نوشتنِ تازه فقط برایِ جلسه‌ی موجود انجام می‌شود (assertSessionExists)، پس پوشه‌ی جلسه‌ی
// زنده هرگز پاک نمی‌شود.
const SESSION_DIR_RE = /^[0-9a-f-]{36}$/i;
export async function sweepAudioWithoutSession(): Promise<number> {
  ensureArchiveDir();
  const dirs = readdirSync(ARCHIVE_DIR).filter((n) => SESSION_DIR_RE.test(n));
  const queued = queueFilesWithSession();
  const ids = [...new Set([...dirs, ...queued.map((q) => q.sessionId)])];
  const alive = new Set<string>();
  for (let i = 0; i < ids.length; i += 500) {
    const part = ids.slice(i, i + 500);
    const r = await query(`SELECT id FROM sessions WHERE id IN (${part.map(() => '?').join(',')})`, part);
    for (const row of r.rows) alive.add(String(row.id));
  }
  // ترمزِ ایمنی: اگر DB اشتباه/خالی وصل شده باشد، «جلسه‌ای پیدا نشد» نباید کلِ آرشیو را پاک کند.
  // حذفِ عادی (یک مراجع/جلسه) چند پوشه است؛ بیش از ۲۰٪ (و بیش از ۵) ⇒ هیچ حذفی، فقط لاگ.
  const doomed = ids.filter((id) => !alive.has(id)).length;
  if (doomed > 5 && doomed > ids.length * 0.2) {
    console.log(`[session-audio] orphan sweep aborted: ${doomed}/${ids.length} sessions not found — DB mismatch?`);
    logEvent({ event: 'audio.archive_failed', source: 'server', severity: 'error', detail: { reason: 'orphan-sweep-aborted', count: doomed } });
    return 0;
  }
  let removed = 0;
  for (const d of dirs) {
    if (alive.has(d)) continue;
    try { rmSync(path.join(ARCHIVE_DIR, d), { recursive: true, force: true }); removed++; } catch {}
  }
  for (const q of queued) {
    if (alive.has(q.sessionId)) continue;
    removeAudioFile(q.path);
    removed++;
  }
  if (removed) console.log(`[session-audio] removed ${removed} dir(s)/queue file(s) of deleted sessions`);
  return removed;
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
    // پوشه‌هایِ session که دیگر هیچ ردیفِ session_audio ندارند (همه منقضی شده‌اند) ⇒ کلِ پوشه، شاملِ فایلِ
    // کاملِ کش‌شده (full.*). ⭐ (A4) قبلاً فقط پوشه‌ی کاملاً خالی پاک می‌شد، پس full.webmِ ساخته‌شده برایِ ادمین
    // بعد از ۱۴ روز برایِ همیشه می‌ماند. پوشه‌ی تازه (<۱ ساعت) دست نمی‌خورد (نوشتنِ در جریان).
    ensureArchiveDir();
    const withRows = new Set((await query('SELECT DISTINCT session_id FROM session_audio')).rows.map((r: { session_id: string }) => String(r.session_id)));
    for (const name of readdirSync(ARCHIVE_DIR)) {
      const dir = path.join(ARCHIVE_DIR, name);
      try {
        if (withRows.has(name)) continue;
        if (readdirSync(dir).length === 0 || Date.now() - statSync(dir).mtimeMs > 60 * 60 * 1000) {
          rmSync(dir, { recursive: true, force: true });
        }
      } catch {}
    }
    await sweepAudioWithoutSession();
  } catch (e) {
    console.log('[session-audio] sweep failed:', String(e).slice(0, 160));
  }
}
