// کیفیتِ داده‌یِ ورودیِ پرونده‌ی درمان (F3، 2026-10-02) — دو چیزِ قطعی و بدونِ LLM:
//  ۱) quoteVerifierFor: آیا «نقلِ عینی» واقعاً در متن/یادداشتِ همان جلسه هست؟ (مدل می‌توانست نقل را بازنویسی کند؛ قبلاً فقط با
//     digestِ خودِ مدل مقایسه می‌شد، نه با داده‌یِ ثبت‌شده)
//  ۲) corpusQualityIssues + qualityHold: جلساتی که کیفیتِ متنشان پایین است (پوششِ صدا کم، دو گوینده ادغام) — تولیدِ *خودکار* تا
//     رسیدگیِ تراپیست متوقف می‌شود (تولیدِ دستی همیشه آزاد است). LAW-001: فقط شماره‌جلسه و نامِ پرچم؛ هیچ متنی.
import { query } from '../../../db/connection.js';
import { cmpNorm, type QuoteVerifier } from '../domain/findings.js';
import type { ClientCorpus } from './aggregateClientCorpus.js';

export function quoteVerifierFor(corpus: ClientCorpus): QuoteVerifier {
  const hay = new Map<number, string>();
  for (const s of corpus.sessions) {
    hay.set(s.sessionNum, cmpNorm([s.transcript ?? '', ...s.notes.map((n) => n.text ?? '')].join(' ')));
  }
  return (sessionNum, text) => {
    const h = hay.get(sessionNum);
    const q = cmpNorm(String(text || ''));
    return !!h && q.length > 0 && h.includes(q);
  };
}

// پرچم‌هایِ کیفیتی که تولیدِ خودکار را نگه می‌دارند (آستانه‌ها: transcriptMetrics.ts، با دادهٔ واقعی بازبینی می‌شوند)
export const HOLD_FLAGS = ['low_coverage', 'speakers_merged'] as const;

export interface QualityIssue { sessionNum: number; sessionId: string; flags: string[] }

function parseFlags(raw: unknown): string[] {
  let m: any = raw;
  if (typeof raw === 'string') { try { m = JSON.parse(raw); } catch { return []; } }
  const f = m && Array.isArray(m.flags) ? m.flags : [];
  return f.filter((x: unknown): x is string => typeof x === 'string' && (HOLD_FLAGS as readonly string[]).includes(x));
}

// آخرین jobِ تمام‌شده‌یِ آپلودِ هر جلسه‌یِ پایان‌یافته‌یِ این مراجع که پرچمِ نگه‌دارنده دارد. فقط فایل‌هایِ آپلودی metrics دارند.
export async function corpusQualityIssues(clientId: string): Promise<QualityIssue[]> {
  const r = await query(
    `SELECT s.id AS session_id, s.session_num, j.transcript_metrics
       FROM sessions s
       JOIN audio_jobs j ON j.session_id = s.id AND j.transcript_metrics IS NOT NULL
      WHERE s.client_id = ? AND s.status IN ('completed', 'recovered') AND s.deleted_at IS NULL
        AND j.created_at = (SELECT MAX(j2.created_at) FROM audio_jobs j2 WHERE j2.session_id = s.id AND j2.transcript_metrics IS NOT NULL)
      ORDER BY s.session_num ASC`,
    [clientId]);
  const out: QualityIssue[] = [];
  for (const row of r.rows as any[]) {
    const flags = parseFlags(row.transcript_metrics);
    if (flags.length) out.push({ sessionNum: Number(row.session_num), sessionId: row.session_id, flags });
  }
  return out;
}
