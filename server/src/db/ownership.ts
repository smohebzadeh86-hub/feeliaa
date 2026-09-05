// چک مالکیت: هر مراجع/جلسه فقط برای تراپیستی که آن را ساخته قابل دسترسی است
import { query } from './connection.js';

export async function getOwnedClient(clientId: string, therapistId: string) {
  const result = await query(
    'SELECT * FROM clients WHERE id = $1 AND therapist_id = $2',
    [clientId, therapistId]
  );
  return result.rows[0] ?? null;
}

export async function getOwnedSession(sessionId: string, therapistId: string) {
  const result = await query(
    `SELECT s.* FROM sessions s
     JOIN clients c ON c.id = s.client_id
     WHERE s.id = $1 AND c.therapist_id = $2`,
    [sessionId, therapistId]
  );
  return result.rows[0] ?? null;
}
