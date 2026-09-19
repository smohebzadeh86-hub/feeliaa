// «ریتمِ درمان» (شروع/میانگینِ فاصله‌ی جلسات/طولِ دوره) — عمداً محاسبه‌ای، نه از LLM؛
// مستقیماً از sessions.date (که در `content` ذخیره نمی‌شود) گرفته می‌شود، پس همیشه
// زنده است، حتی بدونِ regenerate کردنِ پرونده.
import { query } from '../../../db/connection.js';
import { jalaliToTimestampMs } from '../../../http/sessionDate.js';

export interface TreatmentRhythm {
  sessionCount: number;
  startDate: string | null;
  avgGapDays: number | null;
  durationDays: number | null;
}

function parseJalali(dateStr: string): number | null {
  const m = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!m) return null;
  return jalaliToTimestampMs(Number(m[1]), Number(m[2]), Number(m[3]));
}

export async function computeTreatmentRhythm(clientId: string): Promise<TreatmentRhythm> {
  const result = await query(
    `SELECT date FROM sessions
     WHERE client_id = ? AND status IN ('completed', 'recovered')
     ORDER BY date ASC`,
    [clientId]
  );
  const sessionCount = result.rows.length;
  // فقط جلساتِ تاریخ‌دار برایِ محاسبه‌ی فاصله/طولِ دوره لازم‌اند (جلسه‌ی «بدونِ تاریخ» نادیده گرفته می‌شود)
  const timestamps = result.rows
    .map((r: any) => (r.date ? parseJalali(r.date) : null))
    .filter((t: number | null): t is number => t !== null)
    .sort((a: number, b: number) => a - b);

  if (timestamps.length === 0) {
    return { sessionCount, startDate: null, avgGapDays: null, durationDays: null };
  }

  const startDate = result.rows.find((r: any) => r.date)?.date ?? null;
  if (timestamps.length < 2) {
    return { sessionCount, startDate, avgGapDays: null, durationDays: null };
  }

  const DAY_MS = 86400000;
  const totalDays = Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / DAY_MS);
  const avgGapDays = Math.round(totalDays / (timestamps.length - 1));
  return { sessionCount, startDate, avgGapDays, durationDays: totalDays };
}
