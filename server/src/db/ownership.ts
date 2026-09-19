// چک مالکیت: هر مراجع/جلسه فقط برای تراپیستی که آن را ساخته قابل دسترسی است
import { query } from './connection.js';

export async function getOwnedClient(clientId: string, therapistId: string) {
  const result = await query(
    'SELECT * FROM clients WHERE id = ? AND therapist_id = ?',
    [clientId, therapistId]
  );
  return result.rows[0] ?? null;
}

export async function getOwnedSession(sessionId: string, therapistId: string) {
  const result = await query(
    `SELECT s.* FROM sessions s
     JOIN clients c ON c.id = s.client_id
     WHERE s.id = ? AND c.therapist_id = ?`,
    [sessionId, therapistId]
  );
  return result.rows[0] ?? null;
}
