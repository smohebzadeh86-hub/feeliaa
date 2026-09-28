// ساختِ اتمیکِ «جلسه + job + بستنِ آپلود» — یک تراکنش با FOR UPDATE رویِ ردیف‌هایِ آپلود و شماره‌ی جلسه (رفعِ M7:
// تداخلِ شماره/deadlock ⇒ کلِ تراکنش دوباره). همان SQLِ قبلیِ uploads.routes (تک‌فایلی و چندبخشی)، بدونِ تغییر.
import { pool } from '../../db/connection.js';
import { isSessionNumConflict, SESSION_NUM_MAX_RETRIES, sessionNumRetryPause } from '../sessions/index.js';

// آپلودِ تک‌فایلی: 'closed' اگر آپلود دیگر در حالِ آپلود نیست (هم‌زمان بسته شد).
export async function createSessionAndJobForUpload(
  u: any, therapistId: string, sessionId: string, jobId: string, now: { time: string },
  probe: { durationMs: number | null }, sourcePath: string
): Promise<'created' | 'closed'> {
  for (let attempt = 0; ; attempt++) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [lockRows] = await conn.query('SELECT status FROM audio_uploads WHERE id = ? FOR UPDATE', [u.id]);
      if ((lockRows as any[])[0]?.status !== 'uploading') {
        await conn.rollback();
        return 'closed';
      }
      const [numRows] = await conn.query(
        'SELECT COALESCE(MAX(session_num), 0) + 1 AS next FROM sessions WHERE client_id = ? FOR UPDATE', [u.client_id]);
      const sessionNum = (numRows as any[])[0].next;
      // consent=true: تراپیست پیش از آپلود صریحاً تأیید کرد که مراجع به ضبط رضایت داده است (LAW-009).
      await conn.query(
        `INSERT INTO sessions (id, client_id, session_num, date, start_time, consent, status, source, stt_mode, batch_status, duration_ms)
         VALUES (?, ?, ?, ?, ?, true, 'completed', 'upload', 'upload', 'queued', ?)`,
        [sessionId, u.client_id, sessionNum, u.session_date || null, now.time, probe.durationMs]
      );
      await conn.query(
        `INSERT INTO audio_jobs (id, upload_id, therapist_id, client_id, session_id, stage, source_path, duration_ms)
         VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)`,
        [jobId, u.id, therapistId, u.client_id, sessionId, sourcePath, probe.durationMs]
      );
      await conn.query(
        `UPDATE audio_uploads SET status = 'complete', session_id = ?, completed_at = NOW() WHERE id = ?`, [sessionId, u.id]);
      await conn.commit();
      break;
    } catch (e) {
      try { await conn.rollback(); } catch {}
      if (isSessionNumConflict(e) && attempt < SESSION_NUM_MAX_RETRIES) { await sessionNumRetryPause(attempt); continue; }
      throw e;
    } finally {
      conn.release();
    }
  }
  return 'created';
}

// آپلودِ چندبخشی: همه‌ی بخش‌ها ⇒ یک جلسه + یک job. 'already' اگر هم‌زمان ساخته شد، 'closed' اگر گروه دیگر باز نیست.
export async function createSessionAndJobForGroup(
  parts: any[], first: any, therapistId: string, sessionId: string, jobId: string, now: { time: string },
  totalMs: number | null, sourceParts: { uploadId: string; path: string }[]
): Promise<{ kind: 'created' } | { kind: 'already'; sessionId: string } | { kind: 'closed' }> {
  for (let attempt = 0; ; attempt++) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [lockRows] = await conn.query(
        `SELECT id, status, session_id FROM audio_uploads WHERE id IN (${parts.map(() => '?').join(',')}) FOR UPDATE`, parts.map((p) => p.id));
      const locked = lockRows as any[];
      if (locked.length !== parts.length || locked.some((x) => x.status !== 'complete' || x.session_id)) {
        await conn.rollback();
        const s = locked.find((x) => x.session_id);
        return s ? { kind: 'already', sessionId: s.session_id } : { kind: 'closed' };
      }
      const [numRows] = await conn.query(
        'SELECT COALESCE(MAX(session_num), 0) + 1 AS next FROM sessions WHERE client_id = ? FOR UPDATE', [first.client_id]);
      const sessionNum = (numRows as any[])[0].next;
      // consent=true: تراپیست پیش از آپلود صریحاً تأیید کرد که مراجع به ضبط رضایت داده است (LAW-009).
      await conn.query(
        `INSERT INTO sessions (id, client_id, session_num, date, start_time, consent, status, source, stt_mode, batch_status, duration_ms)
         VALUES (?, ?, ?, ?, ?, true, 'completed', 'upload', 'upload', 'queued', ?)`,
        [sessionId, first.client_id, sessionNum, first.session_date || null, now.time, totalMs]
      );
      await conn.query(
        `INSERT INTO audio_jobs (id, upload_id, therapist_id, client_id, session_id, stage, source_path, source_parts, duration_ms)
         VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?)`,
        [jobId, first.id, therapistId, first.client_id, sessionId, sourceParts[0].path, JSON.stringify(sourceParts), totalMs]
      );
      await conn.query(
        `UPDATE audio_uploads SET session_id = ? WHERE id IN (${parts.map(() => '?').join(',')})`, [sessionId, ...parts.map((p) => p.id)]);
      await conn.commit();
      break;
    } catch (e) {
      try { await conn.rollback(); } catch {}
      if (isSessionNumConflict(e) && attempt < SESSION_NUM_MAX_RETRIES) { await sessionNumRetryPause(attempt); continue; }
      throw e;
    } finally {
      conn.release();
    }
  }
  return { kind: 'created' };
}
