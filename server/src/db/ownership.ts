// چک مالکیت: هر مراجع/جلسه فقط برای تراپیستی که آن را ساخته قابل دسترسی است
import { query } from './connection.js';

// مراجعِ حذف‌شده (deleted_at، migration 043) برایِ تراپیست «وجود ندارد»؛ فقط restore با getOwnedClientAny آن را می‌بیند.
export async function getOwnedClient(clientId: string, therapistId: string) {
  const result = await query(
    'SELECT * FROM clients WHERE id = ? AND therapist_id = ? AND deleted_at IS NULL',
    [clientId, therapistId]
  );
  return result.rows[0] ?? null;
}

export async function getOwnedClientAny(clientId: string, therapistId: string) {
  const result = await query('SELECT * FROM clients WHERE id = ? AND therapist_id = ?', [clientId, therapistId]);
  return result.rows[0] ?? null;
}

// جلسه‌یِ حذف‌شده (deleted_at، migration 042) برایِ تراپیست «وجود ندارد» (404)؛ فقط restore با getOwnedSessionAny آن را می‌بیند.
export async function getOwnedSession(sessionId: string, therapistId: string) {
  const result = await query(
    `SELECT s.* FROM sessions s
     JOIN clients c ON c.id = s.client_id
     WHERE s.id = ? AND c.therapist_id = ? AND s.deleted_at IS NULL AND c.deleted_at IS NULL`,
    [sessionId, therapistId]
  );
  return result.rows[0] ?? null;
}

export async function getOwnedSessionAny(sessionId: string, therapistId: string) {
  const result = await query(
    `SELECT s.* FROM sessions s
     JOIN clients c ON c.id = s.client_id
     WHERE s.id = ? AND c.therapist_id = ?`,
    [sessionId, therapistId]
  );
  return result.rows[0] ?? null;
}
