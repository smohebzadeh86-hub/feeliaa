// SQLِ مراجعین — رشته‌هایِ SQLِ قبلیِ clients.routes/consent، بدونِ تغییر؛ مالکیت (therapist_id) همان‌جا که بود.
import { query } from '../../db/connection.js';

export async function listClientsWithStats(therapistId: string | null): Promise<any[]> {
  const result = await query(`
      SELECT
        c.id, c.code, c.alias, c.created_at,
        c.status, c.status_reason, c.category, c.gender, c.pinned_at, c.recording_consent_at, c.unit_type,
        (SELECT COUNT(*) FROM client_members m WHERE m.client_id = c.id AND m.deleted_at IS NULL) as member_count,
        COUNT(s.id) as session_count,
        MAX(s.date) as last_session_date
      FROM clients c
      LEFT JOIN sessions s ON s.client_id = c.id AND s.deleted_at IS NULL
      WHERE c.therapist_id = ? AND c.deleted_at IS NULL
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `, [therapistId]);
  return result.rows;
}

// rowCount
export async function clearRecordingConsent(id: string, therapistId: string | null): Promise<number> {
  const r = await query(
    'UPDATE clients SET recording_consent_at = NULL WHERE id = ? AND therapist_id = ?',
    [id, therapistId]
  );
  return r.rowCount;
}

// rowCount — فقط اولین رضایت ثبت می‌شود
export async function setRecordingConsentIfAbsent(clientId: string, therapistId: string): Promise<number> {
  const r = await query(
    'UPDATE clients SET recording_consent_at = NOW() WHERE id = ? AND therapist_id = ? AND recording_consent_at IS NULL',
    [clientId, therapistId]
  );
  return r.rowCount;
}

export async function listRecoveredSessions(therapistId: string | null): Promise<any[]> {
  const result = await query(`
      SELECT
        s.id, s.client_id, s.session_num, s.date, s.start_time,
        s.duration_ms, s.status, s.transcript,
        CHAR_LENGTH(COALESCE(s.transcript, '')) as transcript_chars,
        c.code as client_code, c.alias as client_alias
      FROM sessions s
      JOIN clients c ON c.id = s.client_id
      WHERE s.status = 'recovered' AND c.therapist_id = ? AND s.deleted_at IS NULL
      ORDER BY s.session_num DESC
    `, [therapistId]);
  return result.rows;
}

export async function clientCodeExists(code: string): Promise<boolean> {
  const exists = await query('SELECT id FROM clients WHERE code = ?', [code]);
  return exists.rows.length > 0;
}

export async function insertClient(c: {
  id: string; code: string; alias: string | null; therapistId: string | null; category: string | null;
  gender: string | null; status: string; statusReason: string | null;
}): Promise<void> {
  await query(
    'INSERT INTO clients (id, code, alias, therapist_id, category, gender, status, status_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [c.id, c.code, c.alias, c.therapistId, c.category, c.gender, c.status, c.statusReason]
  );
}

export async function getClientRow(id: string): Promise<any> {
  const result = await query('SELECT * FROM clients WHERE id = ?', [id]);
  return result.rows[0];
}

export async function listClientSessions(clientId: string): Promise<any[]> {
  const sessionsResult = await query(`
      SELECT id, session_num, date, start_time, duration_ms, status, source, batch_status, auto_closed_at, created_at
      FROM sessions
      WHERE client_id = ? AND status <> 'canceled' AND deleted_at IS NULL
      ORDER BY session_num DESC
    `, [clientId]);
  // ⭐ (2026-10-02، تصمیمِ مالک) «لغو جلسه» دیگر حذف نیست: جلسه status='canceled' می‌گیرد و فقط از فهرستِ تراپیست پنهان می‌شود؛
  // متن، صدا و یادداشت‌ها برایِ ادمین می‌مانند.
  return sessionsResult.rows;
}

// rowCount
export async function updateClientAlias(id: string, therapistId: string | null, alias: string): Promise<number> {
  const update = await query(
    'UPDATE clients SET alias = ? WHERE id = ? AND therapist_id = ?',
    [alias, id, therapistId]
  );
  return update.rowCount;
}

// rowCount — غیرفعال‌شدن سنجاق را هم برمی‌دارد
export async function updateClientStatus(id: string, therapistId: string | null, status: string, statusReason: string | null): Promise<number> {
  const update = await query(
    status === 'inactive'
      ? 'UPDATE clients SET status = ?, status_reason = ?, pinned_at = NULL WHERE id = ? AND therapist_id = ?'
      : 'UPDATE clients SET status = ?, status_reason = ? WHERE id = ? AND therapist_id = ?',
    [status, statusReason, id, therapistId]
  );
  return update.rowCount;
}

// rowCount
export async function setClientPinned(id: string, therapistId: string | null, pinned: boolean): Promise<number> {
  const update = await query(
    'UPDATE clients SET pinned_at = ? WHERE id = ? AND therapist_id = ?',
    [pinned ? new Date() : null, id, therapistId]
  );
  return update.rowCount;
}

export async function updateClientCategory(id: string, therapistId: string | null, category: string | null, gender: string | null): Promise<void> {
  await query(
    'UPDATE clients SET category = ?, gender = ? WHERE id = ? AND therapist_id = ?',
    [category, gender, id, therapistId]
  );
}

export async function countClientCascade(id: string): Promise<any> {
  const countResult = await query(`
      SELECT
        (SELECT COUNT(*) FROM sessions WHERE client_id = ?) as session_count,
        (SELECT COUNT(*) FROM session_notes WHERE deleted_at IS NULL AND session_id IN
          (SELECT id FROM sessions WHERE client_id = ?)) as note_count
    `, [id, id]);
  return countResult.rows[0];
}

export async function listSessionIdsOfClient(clientId: string): Promise<string[]> {
  const sessionIdsResult = await query('SELECT id FROM sessions WHERE client_id = ?', [clientId]);
  return sessionIdsResult.rows.map((r: { id: string }) => r.id);
}

// rowCount
// ⭐ (2026-10-02، تصمیمِ مالک «هیچ چیزی هارد دیلیت نشود») حذفِ مراجع = حذفِ نرم (deleted_at)؛ جلسه‌ها، متن، یادداشت و صدا می‌مانند.
export async function deleteOwnedClient(id: string, therapistId: string | null): Promise<number> {
  const del = await query(
    'UPDATE clients SET deleted_at = NOW(), deleted_by = ? WHERE id = ? AND therapist_id = ? AND deleted_at IS NULL',
    [therapistId, id, therapistId]
  );
  return del.rowCount;
}

export async function restoreOwnedClient(id: string, therapistId: string | null): Promise<number> {
  const r = await query(
    'UPDATE clients SET deleted_at = NULL, deleted_by = NULL WHERE id = ? AND therapist_id = ? AND deleted_at IS NOT NULL',
    [id, therapistId]
  );
  return r.rowCount;
}

export async function listDeletedClients(therapistId: string | null): Promise<any[]> {
  return (await query(
    `SELECT c.id, c.code, c.alias, c.deleted_at, (SELECT COUNT(*) FROM sessions s WHERE s.client_id = c.id) AS session_count
       FROM clients c WHERE c.therapist_id = ? AND c.deleted_at IS NOT NULL ORDER BY c.deleted_at DESC LIMIT 200`, [therapistId])).rows;
}
