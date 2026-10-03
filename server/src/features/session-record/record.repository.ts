// SQLِ رکوردِ canonicalِ جلسه: توکن‌ها (session_transcript_tokens، 038/041)، نوبت‌ها (session_segments، 041)، نقش‌ها
// (session_speaker_roles، 041). متنِ بالینی هرگز لاگ نمی‌شود (LAW-001).
import { createHash } from 'node:crypto';
import { pool, query } from '../../db/connection.js';
import { packTokens, TOKEN_ENGINE, TOKEN_MODEL, type RecordToken } from './tokens.js';
import { buildSegments, renderCanonicalText, rolesComplete, cleanLabel, SPEAKER_ROLES, type RoleEntry, type SpeakerRole } from './segments.js';

export interface TxConn { query(sql: string, params?: unknown[]): Promise<unknown>; }

export interface CanonicalRecordInput {
  sessionId: string;
  jobKey: string;               // شناسه‌ی یکتایِ گذر (job آپلود، یا شناسه‌ی transcriptionِ Soniox) ⇒ exactly-once
  source: 'upload' | 'async';
  tokens: RecordToken[] | null | undefined;
  coversFull: boolean;          // آیا این گذر کلِ صدایِ جلسه را پوشش می‌دهد (برایِ مصرف‌کننده‌ها)
  sourceVersion: number | null; // sessions.transcript_version در لحظه‌ی ثبت
}

// جلوی تکرارِ گذر: کلیدِ دلخواه ⇒ UUID-شکلِ قطعی (job_id یک CHAR(36) است).
export function deterministicJobId(key: string): string {
  const h = createHash('sha1').update(key).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

// داخلِ تراکنشِ فراخوان (مثلاً ثبتِ متنِ آپلود). fail-open: خطایِ این بخش فقط لاگ می‌شود (در MySQL خطایِ یک statement
// تراکنش را نمی‌شکند) و ثبتِ متن را نمی‌اندازد (LAW-008).
export async function saveCanonicalRecord(conn: TxConn, rec: CanonicalRecordInput): Promise<'saved' | 'exists' | 'skipped'> {
  const packed = packTokens(rec.tokens);
  if (!packed) return 'skipped';
  try {
    const jobId = rec.jobKey.length === 36 ? rec.jobKey : deterministicJobId(rec.jobKey);
    const [res] = (await conn.query(
      `INSERT IGNORE INTO session_transcript_tokens (session_id, job_id, source, engine, model, token_count, tokens_gz, covers_full, source_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rec.sessionId, jobId, rec.source, TOKEN_ENGINE, TOKEN_MODEL, packed.count, packed.gz, rec.coversFull ? 1 : 0, rec.sourceVersion]
    )) as [{ insertId: number; affectedRows: number }, unknown];
    if (!res.affectedRows) return 'exists';
    const recordId = res.insertId;
    const segs = buildSegments(rec.tokens);
    const BATCH = 200;
    for (let i = 0; i < segs.length; i += BATCH) {
      const part = segs.slice(i, i + BATCH);
      await conn.query(
        `INSERT INTO session_segments (record_id, session_id, seq, speaker_key, start_ms, end_ms, text, confidence_pct) VALUES ${part.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        part.flatMap((s) => [recordId, rec.sessionId, s.seq, s.speaker_key, s.start_ms, s.end_ms, s.text, s.confidence_pct])
      );
    }
    return 'saved';
  } catch (e) {
    console.log('[session-record] save failed (ignored):', String((e as Error)?.message || e).slice(0, 120));
    return 'skipped';
  }
}

// برایِ فراخوان‌هایی که تراکنشِ خودشان را ندارند (گذرِ async ِ «متنِ نهایی»). هرگز پرتاب نمی‌کند.
export async function saveCanonicalRecordStandalone(rec: CanonicalRecordInput): Promise<'saved' | 'exists' | 'skipped'> {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const r = await saveCanonicalRecord(conn as unknown as TxConn, rec);
    await conn.commit();
    return r;
  } catch (e) {
    try { await conn?.rollback(); } catch {}
    console.log('[session-record] standalone save failed (ignored):', String((e as Error)?.message || e).slice(0, 120));
    return 'skipped';
  } finally {
    conn?.release();
  }
}

// ————— خواندن —————
export interface CurrentRecord { recordId: number; source: string; coversFull: boolean; sourceVersion: number | null; createdAt: string }

export async function getCurrentRecord(sessionId: string, onlyFull = false): Promise<CurrentRecord | null> {
  const r = await query(
    `SELECT id, source, covers_full, source_version, created_at FROM session_transcript_tokens
      WHERE session_id = ?${onlyFull ? ' AND covers_full = 1' : ''} ORDER BY id DESC LIMIT 1`, [sessionId]);
  const x = r.rows[0];
  return x ? { recordId: Number(x.id), source: x.source, coversFull: !!x.covers_full, sourceVersion: x.source_version ?? null, createdAt: x.created_at } : null;
}

export async function listSegments(recordId: number): Promise<Array<{ seq: number; speaker_key: string; start_ms: number | null; end_ms: number | null; text: string; confidence_pct: number | null }>> {
  return (await query('SELECT seq, speaker_key, start_ms, end_ms, text, confidence_pct FROM session_segments WHERE record_id = ? ORDER BY seq', [recordId])).rows;
}

export async function getRoles(sessionId: string): Promise<Record<string, RoleEntry>> {
  const r = await query('SELECT speaker_key, role, label FROM session_speaker_roles WHERE session_id = ?', [sessionId]);
  const out: Record<string, RoleEntry> = {};
  for (const x of r.rows) out[x.speaker_key] = { role: x.role as SpeakerRole, label: x.label ?? null };
  return out;
}

export async function setRoles(sessionId: string, actor: string | null, entries: Record<string, { role: unknown; label?: unknown }>): Promise<number> {
  let n = 0;
  for (const [key, v] of Object.entries(entries)) {
    if (!SPEAKER_ROLES.includes(v.role as SpeakerRole)) continue;
    await query(
      `INSERT INTO session_speaker_roles (session_id, speaker_key, role, label, confirmed_by) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE role = VALUES(role), label = VALUES(label), confirmed_by = VALUES(confirmed_by), confirmed_at = NOW()`,
      [sessionId, key, v.role, cleanLabel(v.label), actor]
    );
    n++;
  }
  return n;
}

// خروجیِ ادمین (export): آخرین گذر + نوبت‌ها + نقش‌هایِ تأییدشده. null ⇒ جلسه رکورد ندارد.
export async function exportCanonicalRecord(sessionId: string): Promise<null | {
  record_id: number; source: string; covers_full: boolean; source_version: number | null; created_at: string;
  segments: Array<{ seq: number; speaker_key: string; role: string | null; label: string | null; start_ms: number | null; end_ms: number | null; text: string; confidence_pct: number | null }>;
}> {
  const rec = await getCurrentRecord(sessionId);
  if (!rec) return null;
  const roles = await getRoles(sessionId);
  const segs = await listSegments(rec.recordId);
  return {
    record_id: rec.recordId, source: rec.source, covers_full: rec.coversFull, source_version: rec.sourceVersion, created_at: rec.createdAt,
    segments: segs.map((s) => ({ ...s, role: roles[s.speaker_key]?.role ?? null, label: roles[s.speaker_key]?.label ?? null })),
  };
}

// متنِ canonicalِ جلسه برایِ مصرف‌کننده‌ها (پرونده‌ی AI، export). null ⇒ مصرف‌کننده به sessions.transcript برمی‌گردد.
// فقط وقتی: گذرِ کاملِ جلسه هست، و پس از آن کسی متن را ویرایش نکرده (source_version === sessions.transcript_version)
// ⇒ اصلاحِ دستیِ تراپیست هرگز با متنِ ماشینی رویِ هم نمی‌افتد.
export async function canonicalTextForSession(sessionId: string): Promise<{ text: string; rolesComplete: boolean; recordId: number } | null> {
  try {
    const rec = await getCurrentRecord(sessionId, true);
    if (!rec || rec.sourceVersion === null) return null;
    const cur = await query('SELECT transcript_version FROM sessions WHERE id = ?', [sessionId]);
    if (!cur.rows[0] || Number(cur.rows[0].transcript_version) !== rec.sourceVersion) return null;
    const segs = await listSegments(rec.recordId);
    if (!segs.length) return null;
    const roles = await getRoles(sessionId);
    const keys = [...new Set(segs.map((s) => s.speaker_key))];
    return { text: renderCanonicalText(segs, roles), rolesComplete: rolesComplete(keys, roles), recordId: rec.recordId };
  } catch {
    return null;
  }
}
