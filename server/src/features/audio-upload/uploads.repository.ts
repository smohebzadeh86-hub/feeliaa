// SQLِ آپلود و jobهایِ صدا برایِ APIِ آپلود — رشته‌هایِ SQLِ قبلیِ uploads.routes، بدونِ تغییر. مالکیت (therapist_id)
// همان‌جا که بود در خودِ SQL.
import { query } from '../../db/connection.js';

export async function getOwnedUploadRow(id: string, therapistId: string): Promise<any> {
  const r = await query('SELECT * FROM audio_uploads WHERE id = ? AND therapist_id = ?', [id, therapistId]);
  return r.rows[0] ?? null;
}

export async function getUploadRow(id: string): Promise<any> {
  return (await query('SELECT * FROM audio_uploads WHERE id = ?', [id])).rows[0];
}

// ————— نمایِ job (سینیِ پردازش) —————
const JOB_SELECT = `SELECT j.id, j.stage, j.attempts, j.error_code, j.duration_ms, j.case_file_status,
    j.transcript_applied_at, j.transcript_chars, j.created_at, j.updated_at, j.finished_at, j.next_attempt_at,
    j.audio_quality, j.quality_warning,
    j.session_id, j.client_id, j.upload_id, s.session_num, c.code AS client_code, c.alias AS client_alias, c.status AS client_status,
    u.original_name, u.parts_total, t.name AS therapist_name, t.id AS therapist_id, t.case_file_enabled AS t_case_file_enabled, t.case_file_auto_generate AS t_case_file_auto_generate
  FROM audio_jobs j
  JOIN sessions s ON s.id = j.session_id
  JOIN clients c ON c.id = j.client_id
  JOIN therapists t ON t.id = j.therapist_id
  JOIN audio_uploads u ON u.id = j.upload_id`;

export async function latestJobRowForSession(sessionId: string): Promise<any> {
  return (await query(`${JOB_SELECT} WHERE j.session_id = ? ORDER BY j.created_at DESC LIMIT 1`, [sessionId])).rows[0];
}

export async function jobRowForUpload(uploadId: string): Promise<any> {
  return (await query(`${JOB_SELECT} WHERE j.upload_id = ?`, [uploadId])).rows[0];
}

export async function jobRowById(id: string): Promise<any> {
  return (await query(`${JOB_SELECT} WHERE j.id = ?`, [id])).rows[0];
}

export async function ownedJobRow(id: string, therapistId: string | null): Promise<any> {
  return (await query(`${JOB_SELECT} WHERE j.id = ? AND j.therapist_id = ?`, [id, therapistId])).rows[0];
}

// where: یکی از دو شرطِ ثابتِ scope (active/recent) که route انتخاب می‌کند.
export async function listJobRows(where: string, therapistId: string | null, params: unknown[] = [therapistId], limit = 30): Promise<any[]> {
  return (await query(`${JOB_SELECT} WHERE ${where} ORDER BY j.created_at DESC LIMIT ${Math.max(1, Math.floor(limit))}`, params)).rows;
}

// ————— ردیفِ خامِ audio_jobs —————
export async function getJobByUpload(uploadId: string): Promise<any> {
  return (await query('SELECT * FROM audio_jobs WHERE upload_id = ?', [uploadId])).rows[0];
}

export async function getJobById(id: string): Promise<any> {
  return (await query('SELECT * FROM audio_jobs WHERE id = ?', [id])).rows[0];
}

export async function getOwnedJob(id: string, therapistId: string | null): Promise<any> {
  return (await query('SELECT * FROM audio_jobs WHERE id = ? AND therapist_id = ?', [id, therapistId])).rows[0];
}

// jobِ failed ⇒ دوباره در صف. rowCount (0 یعنی هم‌زمان کسِ دیگری زودتر این کار را کرده).
export async function requeueFailedJobRow(jobId: string, stage: string): Promise<number> {
  const r = await query(
    `UPDATE audio_jobs SET stage = ?, attempts = 0, error_code = NULL, finished_at = NULL, next_attempt_at = NOW(),
       locked_until = NULL WHERE id = ? AND stage = 'failed'`,
    [stage, jobId]
  );
  return r.rowCount;
}

export async function markSessionBatchQueued(sessionId: string): Promise<void> {
  await query(`UPDATE sessions SET batch_status = 'queued' WHERE id = ?`, [sessionId]);
}

export async function deleteProcessingFailedNotification(jobId: string): Promise<void> {
  await query(`DELETE FROM notifications WHERE job_id = ? AND kind = 'processing_failed'`, [jobId]);
}

// ————— آپلودِ رهاشده / سقفِ هم‌زمان —————
export async function listIdleUploadIds(therapistId: string, idleSeconds: number): Promise<string[]> {
  const idle = await query(
    `SELECT id FROM audio_uploads WHERE therapist_id = ? AND status = 'uploading' AND updated_at < (NOW() - INTERVAL ? SECOND)`,
    [therapistId, idleSeconds]
  );
  return idle.rows.map((row: { id: string }) => row.id);
}

// rowCount
export async function expireUploadingUpload(id: string): Promise<number> {
  const r = await query(
    `UPDATE audio_uploads SET status = 'canceled', error_code = 'expired' WHERE id = ? AND status = 'uploading'`, [id]);
  return r.rowCount;
}

export async function countUploadingUploads(therapistId: string): Promise<number> {
  return Number(
    (await query(`SELECT COUNT(*) AS n FROM audio_uploads WHERE therapist_id = ? AND status = 'uploading'`, [therapistId])).rows[0]?.n || 0);
}

// ————— چندبخشی —————
export async function listCompleteGroupParts(therapistId: string, groupId: string): Promise<any[]> {
  const r = await query(
    `SELECT * FROM audio_uploads WHERE therapist_id = ? AND group_id = ? AND status = 'complete' ORDER BY part_index ASC, completed_at ASC`,
    [therapistId, groupId]
  );
  return r.rows;
}

export async function rejectGroupPartTooLong(id: string): Promise<void> {
  await query(`UPDATE audio_uploads SET status = 'failed', error_code = 'too-long' WHERE id = ? AND session_id IS NULL`, [id]);
}

// گروهی که بخشی از آن رد/لغو شده (یا مشخصاتش با این درخواست نمی‌خواند)
export async function countDeadGroupParts(therapistId: string, groupId: string | null, clientId: string, partsTotal: number | null): Promise<number> {
  const dead = await query(
    `SELECT COUNT(*) AS n FROM audio_uploads WHERE therapist_id = ? AND group_id = ?
           AND (client_id <> ? OR parts_total <> ? OR status = 'failed'
                OR (status = 'canceled' AND error_code IN ('user-canceled','group-canceled')))`,
    [therapistId, groupId, clientId, partsTotal]
  );
  return Number(dead.rows[0]?.n || 0);
}

export async function findGroupPart(therapistId: string, groupId: string | null, partIndex: number | null): Promise<any> {
  const pp = await query(
    `SELECT * FROM audio_uploads WHERE therapist_id = ? AND group_id = ? AND part_index = ?
           AND status IN ('uploading','complete') ORDER BY created_at DESC LIMIT 1`,
    [therapistId, groupId, partIndex]
  );
  return pp.rows[0];
}

export async function findSingleUploadByFingerprint(therapistId: string, clientId: string, fingerprint: string): Promise<any> {
  const prev = await query(
    `SELECT * FROM audio_uploads WHERE therapist_id = ? AND client_id = ? AND fingerprint = ? AND group_id IS NULL
         AND status IN ('uploading','complete') ORDER BY created_at DESC LIMIT 1`,
    [therapistId, clientId, fingerprint]
  );
  return prev.rows[0];
}

export async function insertUpload(u: {
  id: string; therapistId: string; clientId: string; fingerprint: string; originalName: string; mime: string | null;
  size: number; chunkSize: number; chunksTotal: number; sessionDate: string | null; preNote: string | null;
  groupId: string | null; partIndex: number | null; partsTotal: number | null;
}): Promise<void> {
  await query(
    `INSERT INTO audio_uploads (id, therapist_id, client_id, fingerprint, original_name, mime, size_bytes, chunk_size, chunks_total, session_date, pre_note,
         group_id, part_index, parts_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [u.id, u.therapistId, u.clientId, u.fingerprint, u.originalName, u.mime,
      u.size, u.chunkSize, u.chunksTotal, u.sessionDate, u.preNote, u.groupId, u.partIndex, u.partsTotal]
  );
}

export async function touchUpload(id: string): Promise<void> {
  await query('UPDATE audio_uploads SET updated_at = NOW() WHERE id = ?', [id]);
}

export async function failUpload(id: string, code: string): Promise<void> {
  await query(`UPDATE audio_uploads SET status = 'failed', error_code = ? WHERE id = ?`, [code, id]);
}

// بخشِ چندبخشی بررسی و نگه داشته شد. rowCount
export async function markGroupPartComplete(id: string, durationMs: number | null): Promise<number> {
  const mark = await query(
    `UPDATE audio_uploads SET status = 'complete', completed_at = NOW(), duration_ms = ? WHERE id = ? AND status = 'uploading'`,
    [durationMs, id]
  );
  return mark.rowCount;
}

export async function cancelUploadByUser(id: string): Promise<void> {
  await query(`UPDATE audio_uploads SET status = 'canceled', error_code = 'user-canceled' WHERE id = ? AND status = 'uploading'`, [id]);
}

// بخش‌هایِ در حالِ آپلود و بخش‌هایِ رسیده‌ای که هنوز جلسه نشده‌اند
export async function listCancelableGroupPartIds(therapistId: string, groupId: string): Promise<string[]> {
  const r = await query(
    `SELECT id FROM audio_uploads WHERE therapist_id = ? AND group_id = ?
           AND (status = 'uploading' OR (status = 'complete' AND session_id IS NULL))`,
    [therapistId, groupId]
  );
  return r.rows.map((row: { id: string }) => row.id);
}

// rowCount
export async function cancelGroupPart(id: string): Promise<number> {
  const x = await query(
    `UPDATE audio_uploads SET status = 'canceled', error_code = 'group-canceled'
           WHERE id = ? AND (status = 'uploading' OR (status = 'complete' AND session_id IS NULL))`, [id]);
  return x.rowCount;
}
