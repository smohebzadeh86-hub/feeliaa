// اعلان‌هایِ پایدارِ تراپیست (migration 023). فقط از رویدادِ واقعیِ backend ساخته می‌شوند —
// هرگز از کلاینت. متنِ نمایشی اینجا ذخیره نمی‌شود (فقط kind + شناسه‌ها)؛ UI متنِ فارسی را از kind
// می‌سازد، پس هیچ داده‌ی بالینی (LAW-001) در این جدول نیست.
import { randomUUID } from 'node:crypto';
import type { PoolConnection } from 'mysql2/promise';
import { query } from '../../db/connection.js';

export type NotificationKind =
  | 'transcript_ready'
  | 'transcript_empty'
  | 'processing_failed'
  | 'case_file_updated'
  | 'case_file_failed';

export interface NewNotification {
  therapistId: string;
  kind: NotificationKind;
  clientId?: string | null;
  sessionId?: string | null;
  jobId?: string | null;
  errorCode?: string | null;
}

// idempotent: UNIQUE(job_id, kind) ⇒ retryِ همان job اعلانِ تکراری نمی‌سازد (INSERT IGNORE).
// conn داده شود ⇒ داخلِ همان تراکنشِ تغییرِ وضعیت نوشته می‌شود (اعلان فقط وقتی هست که رویداد واقعاً commit شد).
export async function createNotification(n: NewNotification, conn?: PoolConnection): Promise<void> {
  const sql = `INSERT IGNORE INTO notifications (id, therapist_id, kind, client_id, session_id, job_id, error_code)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const params = [randomUUID(), n.therapistId, n.kind, n.clientId ?? null, n.sessionId ?? null, n.jobId ?? null, n.errorCode ?? null];
  if (conn) await conn.query(sql, params);
  else await query(sql, params);
}

const RETENTION_DAYS = 30;
export async function sweepOldNotifications(): Promise<void> {
  try {
    await query('DELETE FROM notifications WHERE created_at < (NOW() - INTERVAL ? DAY)', [RETENTION_DAYS]);
  } catch (e) {
    console.log('[notifications] sweep failed:', String(e).slice(0, 160));
  }
}
