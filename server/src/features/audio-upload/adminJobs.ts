// نمایِ سراسریِ jobهایِ آپلود برایِ صفِ پردازشِ ادمین — فقط متادیتا: original_name هرگز برنمی‌گردد (LAW-001).
import { query } from '../../db/connection.js';
import { listJobRows } from './uploads.repository.js';
import { jobView } from './jobView.js';

const STAGES = ['queued', 'normalizing', 'transcribing', 'case_file', 'done', 'failed'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listAdminUploadJobs(f: { therapistId?: string | null; stage?: string | null }) {
  // فعال یا ۱۴ روزِ اخیر
  const where = [`(j.stage NOT IN ('done','failed') OR j.created_at > (NOW() - INTERVAL 14 DAY))`];
  const params: unknown[] = [];
  if (f.therapistId && UUID_RE.test(f.therapistId)) { where.push('j.therapist_id = ?'); params.push(f.therapistId); }
  if (f.stage && STAGES.includes(f.stage)) { where.push('j.stage = ?'); params.push(f.stage); }
  const rows = await listJobRows(where.join(' AND '), null, params, 100);
  return rows.map((r) => {
    const { original_name: _drop, ...v } = jobView(r) as any;
    return { ...v, therapist_id: r.therapist_id, therapist_name: r.therapist_name };
  });
}

// شمارشِ stageها برایِ کاشی‌ها (همان بازه‌ی فهرست)
export async function countAdminUploadJobsByStage(): Promise<Record<string, number>> {
  const r = await query(
    `SELECT stage, COUNT(*) AS n FROM audio_jobs
      WHERE stage NOT IN ('done','failed') OR created_at > (NOW() - INTERVAL 14 DAY) GROUP BY stage`);
  const out: Record<string, number> = {};
  for (const row of r.rows as Array<{ stage: string; n: number }>) out[row.stage] = Number(row.n);
  return out;
}
