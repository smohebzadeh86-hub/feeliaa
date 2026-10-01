// نمایِ کلیِ «کیفیت به عدد» برایِ ادمین (Session Data Engine، 2026-10-01): هر جلسه‌ی آپلودیِ دارایِ متریک + جمع‌بندی.
// فقط عدد و پرچم (audio_jobs.transcript_metrics) و برچسبِ جلسه — بدونِ متن، نامِ فایل یا speech_spans (LAW-001).
import { query } from '../../db/connection.js';
import { parseTranscriptMetrics, type TranscriptMetrics, type MetricsFlag } from './transcriptMetrics.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const QUALITY_DAYS_DEFAULT = 30;
export const QUALITY_DAYS_MAX = 180;

export interface QualityRow {
  job_id: string;
  session_id: string;
  session_num: number | null;
  client_code: string | null;
  therapist_id: string;
  therapist_name: string | null;
  created_at: string;
  duration_ms: number | null;
  metrics: TranscriptMetrics;
}

export interface QualitySummary {
  sessions: number;
  coverage_median: number | null;
  coverage_min: number | null;
  low_conf_median: number | null;
  flagged: number;
  flag_counts: Partial<Record<MetricsFlag, number>>;
}

// بدترین اول: تعدادِ پرچم، بعد پوششِ کمتر (پوششِ نامعلوم در انتها).
export function rankQualityRows(rows: QualityRow[]): QualityRow[] {
  return [...rows].sort((a, b) =>
    (b.metrics.flags.length - a.metrics.flags.length) ||
    ((a.metrics.coverage ?? 2) - (b.metrics.coverage ?? 2)) ||
    (Date.parse(b.created_at) - Date.parse(a.created_at)));
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 1000) / 1000;
};

export function summarizeQuality(rows: QualityRow[]): QualitySummary {
  const cov = rows.map((r) => r.metrics.coverage).filter((x): x is number => typeof x === 'number');
  const lc = rows.map((r) => r.metrics.low_conf_ratio).filter((x): x is number => typeof x === 'number');
  const flag_counts: Partial<Record<MetricsFlag, number>> = {};
  for (const r of rows) for (const f of r.metrics.flags) flag_counts[f] = (flag_counts[f] || 0) + 1;
  return {
    sessions: rows.length,
    coverage_median: median(cov),
    coverage_min: cov.length ? Math.min(...cov) : null,
    low_conf_median: median(lc),
    flagged: rows.filter((r) => r.metrics.flags.length > 0).length,
    flag_counts,
  };
}

export async function listAdminUploadQuality(f: { therapistId?: string | null; days?: number | null }): Promise<{ rows: QualityRow[]; summary: QualitySummary; days: number }> {
  const days = Math.min(QUALITY_DAYS_MAX, Math.max(1, Math.floor(Number(f.days) || QUALITY_DAYS_DEFAULT)));
  const where = ['j.transcript_metrics IS NOT NULL', 'j.created_at > (NOW() - INTERVAL ? DAY)'];
  const params: unknown[] = [days];
  if (f.therapistId && UUID_RE.test(f.therapistId)) { where.push('j.therapist_id = ?'); params.push(f.therapistId); }
  const r = await query(
    `SELECT j.id, j.session_id, j.created_at, j.duration_ms, j.transcript_metrics, j.therapist_id,
            s.session_num, c.code AS client_code, t.name AS therapist_name
       FROM audio_jobs j
       JOIN sessions s ON s.id = j.session_id
       JOIN clients c ON c.id = j.client_id
       JOIN therapists t ON t.id = j.therapist_id
      WHERE ${where.join(' AND ')}
      ORDER BY j.created_at DESC LIMIT 500`, params);
  const rows: QualityRow[] = [];
  for (const x of r.rows as any[]) {
    const metrics = parseTranscriptMetrics(x.transcript_metrics);
    if (!metrics) continue;
    rows.push({
      job_id: x.id, session_id: x.session_id, session_num: x.session_num ?? null, client_code: x.client_code ?? null,
      therapist_id: x.therapist_id, therapist_name: x.therapist_name ?? null, created_at: new Date(x.created_at).toISOString(),
      duration_ms: x.duration_ms ?? null, metrics,
    });
  }
  return { rows: rankQualityRows(rows), summary: summarizeQuality(rows), days };
}
