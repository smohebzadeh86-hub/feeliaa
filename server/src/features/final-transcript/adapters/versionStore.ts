// تاریخچه‌ی فقط‌افزودنیِ «متنِ نهایی» (migration 037، Session Data Engine 2026-10-01).
// قبلاً اجرایِ دوباره (runner.finish) و اصلاحِ نقش (PATCH .../roles) clean_text/clean_turns را درجا بازنویسی می‌کردند و نسخه‌ی
// قبلی برایِ همیشه گم می‌شد. حالا هر نوشتن، داخلِ همان تراکنش و پس از قفلِ ردیفِ final_transcripts، یک نسخه‌ی کامل می‌گذارد.
// متن هرگز لاگ نمی‌شود (LAW-001).
import { query } from '../../../db/connection.js';

export type VersionKind = 'baseline' | 'generated' | 'role_edit';

// اتصالِ تراکنشی (mysql2 PoolConnection) — فقط همین متد لازم است.
export interface TxConn { query(sql: string, params?: unknown[]): Promise<unknown>; }

// قفلِ ردیفِ جاری تا شماره‌ی نسخه‌ی بعدی بینِ دو نویسنده‌ی هم‌زمان (ساخت/اصلاحِ نقش) تکراری نشود.
export async function lockCurrent(conn: TxConn, sessionId: string): Promise<void> {
  await conn.query('SELECT session_id FROM final_transcripts WHERE session_id = ? FOR UPDATE', [sessionId]);
}

// متنِ ساخته‌شده پیش از migration 037 (تاریخچه‌ی خالی) پیش از اولین بازنویسی به‌عنوانِ نسخه‌ی ۱ کپی می‌شود.
export async function snapshotBaselineIfMissing(conn: TxConn, sessionId: string): Promise<void> {
  await conn.query(
    `INSERT INTO final_transcript_versions (session_id, version, kind, source, source_version, clean_text, clean_turns, polish_report, created_by)
     SELECT f.session_id, 1, 'baseline', f.source, f.source_version, f.clean_text, f.clean_turns, f.polish_report, NULL
       FROM final_transcripts f
      WHERE f.session_id = ? AND f.clean_text IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM final_transcript_versions v WHERE v.session_id = f.session_id)`,
    [sessionId]);
}

// نسخه‌ی جاریِ final_transcripts (پس از UPDATE، داخلِ همان تراکنش) به‌عنوانِ نسخه‌ی بعدی کپی می‌شود.
// polish_report فقط برایِ ساخت (generated) نگه داشته می‌شود؛ اصلاحِ نقش گزارشِ جدیدی ندارد.
export async function appendCurrentAsVersion(conn: TxConn, sessionId: string, kind: Exclude<VersionKind, 'baseline'>, createdBy: string | null): Promise<void> {
  await conn.query(
    `INSERT INTO final_transcript_versions (session_id, version, kind, source, source_version, clean_text, clean_turns, polish_report, created_by)
     SELECT f.session_id,
            (SELECT COALESCE(MAX(v.version), 0) + 1 FROM final_transcript_versions v WHERE v.session_id = f.session_id),
            ?, f.source, f.source_version, f.clean_text, f.clean_turns, ${kind === 'generated' ? 'f.polish_report' : 'NULL'}, ?
       FROM final_transcripts f
      WHERE f.session_id = ? AND f.clean_text IS NOT NULL`,
    [kind, createdBy, sessionId]);
}

// فهرستِ نسخه‌ها برایِ ادمین — فقط متادیتا (طول، تعدادِ نوبت)، بدونِ متن.
export async function listVersions(sessionId: string): Promise<Array<{
  version: number; kind: VersionKind; source: string | null; source_version: number | null; created_at: string;
  by_user: boolean; chars: number; turns: number | null;
}>> {
  const r = await query(
    `SELECT version, kind, source, source_version, created_at, created_by IS NOT NULL AS by_user,
            CHAR_LENGTH(clean_text) AS chars, JSON_LENGTH(clean_turns) AS turns
       FROM final_transcript_versions WHERE session_id = ? ORDER BY version DESC`, [sessionId]);
  return (r.rows as any[]).map((x) => ({
    version: Number(x.version), kind: x.kind, source: x.source ?? null, source_version: x.source_version ?? null,
    created_at: new Date(x.created_at).toISOString(), by_user: !!Number(x.by_user),
    chars: Number(x.chars || 0), turns: x.turns === null || x.turns === undefined ? null : Number(x.turns),
  }));
}

export async function getVersionText(sessionId: string, version: number): Promise<{ version: number; kind: VersionKind; clean_text: string; created_at: string } | null> {
  const r = await query(
    'SELECT version, kind, clean_text, created_at FROM final_transcript_versions WHERE session_id = ? AND version = ?', [sessionId, version]);
  const x = (r.rows as any[])[0];
  return x ? { version: Number(x.version), kind: x.kind, clean_text: x.clean_text, created_at: new Date(x.created_at).toISOString() } : null;
}
