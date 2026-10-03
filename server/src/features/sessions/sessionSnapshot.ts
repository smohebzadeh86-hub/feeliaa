// snapshotِ نوعِ واحدِ درمان و مدالیته‌هایِ تراپیست روی خودِ جلسه (migration 040) — در همان تراکنشِ ساختِ جلسه.
// fail-open: خطا ⇒ ستون‌ها NULL می‌مانند (جلسه ساخته شده است و نباید به‌خاطرِ snapshot شکست بخورد).
import { query } from '../../db/connection.js';

const SNAPSHOT_SQL = `UPDATE sessions s JOIN clients c ON c.id = s.client_id JOIN therapists t ON t.id = c.therapist_id
  SET s.unit_type = c.unit_type, s.modalities = t.modalities WHERE s.id = ?`;

// conn اختیاری: داخلِ تراکنشِ ساخت از connectionِ همان تراکنش استفاده شود.
export async function snapshotSessionUnit(sessionId: string, conn?: { query: (sql: string, params?: unknown[]) => Promise<unknown> }): Promise<void> {
  try {
    if (conn) await conn.query(SNAPSHOT_SQL, [sessionId]);
    else await query(SNAPSHOT_SQL, [sessionId]);
  } catch (e) {
    console.log('[session] unit snapshot failed (ignored):', String((e as Error)?.message || e).slice(0, 120));
  }
}
