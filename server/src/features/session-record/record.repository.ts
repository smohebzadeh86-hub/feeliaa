// SQLِ رکوردِ canonicalِ جلسه: توکن‌ها (session_transcript_tokens، 038/041)، نوبت‌ها (session_segments، 041)، نقش‌ها
// (session_speaker_roles، 041). متنِ بالینی هرگز لاگ نمی‌شود (LAW-001).
import { createHash } from 'node:crypto';
import { pool, query } from '../../db/connection.js';
import { logEvent } from '../../obs/eventLog.js';
import { packTokens, unpackTokens, TOKEN_ENGINE, TOKEN_MODEL, type RecordToken } from './tokens.js';
import { assembleRtChunks, type RtChunkInput, type StoredRtChunk } from './rtChunks.js';
import { buildSegments, renderCanonicalText, rolesComplete, cleanLabel, SPEAKER_ROLES, type RoleEntry, type SpeakerRole } from './segments.js';

export interface TxConn { query(sql: string, params?: unknown[]): Promise<unknown>; }

export interface CanonicalRecordInput {
  sessionId: string;
  jobKey: string;               // شناسه‌ی یکتایِ گذر (job آپلود، یا شناسه‌ی transcriptionِ Soniox) ⇒ exactly-once
  source: 'upload' | 'async' | 'realtime';
  tokens: RecordToken[] | null | undefined;
  coversFull: boolean;          // آیا این گذر کلِ صدایِ جلسه را پوشش می‌دهد (برایِ مصرف‌کننده‌ها)
  sourceVersion: number | null; // sessions.transcript_version در لحظه‌ی ثبت
  engine?: string;              // پیش‌فرض TOKEN_ENGINE (soniox-async)
  model?: string;
  meta?: Record<string, unknown> | null; // فقط عدد/پرچم (migration 045)
}

// جلوی تکرارِ گذر: کلیدِ دلخواه ⇒ UUID-شکلِ قطعی (job_id یک CHAR(36) است).
export function deterministicJobId(key: string): string {
  const h = createHash('sha1').update(key).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

// شنونده‌ی «گذرِ تازه ذخیره شد» (core-data-plan قدمِ ۴: سنجه‌ها) — از app.ts تزریق می‌شود. با تأخیر صدا زده می‌شود تا تراکنشِ
// فراخوان (مسیرِ آپلود) commit شده باشد؛ شنونده خودش آخرین گذرِ جلسه را می‌خواند. هر خطا بلعیده می‌شود.
let recordSavedListener: ((sessionId: string) => void) | null = null;
export function setRecordSavedListener(fn: ((sessionId: string) => void) | null): void { recordSavedListener = fn; }
function notifyRecordSaved(sessionId: string): void {
  if (!recordSavedListener) return;
  const fn = recordSavedListener;
  const t = setTimeout(() => { try { fn(sessionId); } catch {} }, 5000);
  t.unref?.();
}

// داخلِ تراکنشِ فراخوان (مثلاً ثبتِ متنِ آپلود). fail-open: خطایِ این بخش فقط لاگ می‌شود (در MySQL خطایِ یک statement
// تراکنش را نمی‌شکند) و ثبتِ متن را نمی‌اندازد (LAW-008).
export async function saveCanonicalRecord(conn: TxConn, rec: CanonicalRecordInput): Promise<'saved' | 'exists' | 'skipped'> {
  const packed = packTokens(rec.tokens);
  if (!packed) return 'skipped';
  try {
    const jobId = rec.jobKey.length === 36 ? rec.jobKey : deterministicJobId(rec.jobKey);
    const [res] = (await conn.query(
      `INSERT IGNORE INTO session_transcript_tokens (session_id, job_id, source, engine, model, token_count, tokens_gz, covers_full, source_version, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rec.sessionId, jobId, rec.source, rec.engine ?? TOKEN_ENGINE, rec.model ?? TOKEN_MODEL, packed.count, packed.gz, rec.coversFull ? 1 : 0, rec.sourceVersion,
        rec.meta ? JSON.stringify(rec.meta) : null]
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
    notifyRecordSaved(rec.sessionId);
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
  engine: string | null; model: string | null; meta: unknown; metrics: unknown;
  segments: Array<{ seq: number; speaker_key: string; role: string | null; label: string | null; start_ms: number | null; end_ms: number | null; text: string; confidence_pct: number | null }>;
}> {
  const rec = await getCurrentRecord(sessionId);
  if (!rec) return null;
  const roles = await getRoles(sessionId);
  const segs = await listSegments(rec.recordId);
  // (export v4، 2026-10-04) منشأ و کیفیتِ گذر: موتور/مدل، meta (کامل‌بودنِ realtime) و سنجه‌ها — فقط عدد/پرچم
  const x = (await query('SELECT engine, model, meta, metrics FROM session_transcript_tokens WHERE id = ?', [rec.recordId])).rows[0] ?? {};
  const pj = (v: unknown) => { if (typeof v !== 'string') return v ?? null; try { return JSON.parse(v); } catch { return null; } };
  return {
    record_id: rec.recordId, source: rec.source, covers_full: rec.coversFull, source_version: rec.sourceVersion, created_at: rec.createdAt,
    engine: x.engine ?? null, model: x.model ?? null, meta: pj(x.meta), metrics: pj(x.metrics),
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

// ————— رکوردِ realtime (core-data-plan قدمِ ۲، migration 045) —————
export const RT_ENGINE = 'soniox-rt';
export const RT_MODEL = 'stt-rt-v5';

// تکه‌ی تازه ⇒ 'inserted'؛ تکراری (retryِ همان محتوا) ⇒ 'exists' (اگر این بار پرچمِ پایان دارد، پرچم ثبت می‌شود).
export async function insertRtChunk(sessionId: string, c: RtChunkInput): Promise<'inserted' | 'exists'> {
  const packed = packTokens(c.tokens) ?? { gz: Buffer.alloc(0), count: 0 };
  const r = await query(
    `INSERT IGNORE INTO session_rt_token_chunks (session_id, run_id, chunk_seq, token_count, tokens_gz, is_final, reliable, dropped)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, c.runId, c.chunkSeq, packed.count, packed.gz, c.final ? 1 : 0, c.reliable === null ? null : (c.reliable ? 1 : 0), c.dropped]);
  if (r.rowCount === 1) return 'inserted';
  if (c.final) {
    await query(
      `UPDATE session_rt_token_chunks SET is_final = 1, reliable = ?, dropped = ? WHERE session_id = ? AND run_id = ? AND chunk_seq = ?`,
      [c.reliable === null ? null : (c.reliable ? 1 : 0), c.dropped, sessionId, c.runId, c.chunkSeq]);
  }
  return 'exists';
}

async function listRtChunks(sessionId: string): Promise<StoredRtChunk[]> {
  const r = await query(
    'SELECT id, run_id, chunk_seq, tokens_gz, is_final, reliable, dropped FROM session_rt_token_chunks WHERE session_id = ? ORDER BY id', [sessionId]);
  return r.rows.map((x: any) => ({
    id: Number(x.id), runId: x.run_id, chunkSeq: Number(x.chunk_seq),
    tokens: x.tokens_gz && x.tokens_gz.length ? (unpackTokens(x.tokens_gz) ?? []) : [],
    isFinal: !!x.is_final, reliable: x.reliable === null ? null : !!x.reliable, dropped: x.dropped === null ? null : Number(x.dropped),
  }));
}

// گذرِ realtime از تکه‌ها. فقط جلسه‌ی زنده‌ی پایان‌یافته؛ اگر گذرِ async/upload هست (کامل‌تر و با گوینده‌ی یکدست) کاری نمی‌کند.
// covers_full همیشه false: متنِ جلسه نشانگرِ علائم، placeholder و متنِ بازیابی‌شده از صدا را دارد که توکن‌هایِ زنده ندارند ⇒
// پرونده‌ی AI همچنان sessions.transcript را می‌خواند (canonicalTextForSession). این گذر مبنایِ نقشِ گوینده، سنجه و export است.
// هرگز پرتاب نمی‌کند.
export async function buildRealtimeRecord(sessionId: string): Promise<'saved' | 'exists' | 'skipped'> {
  try {
    const s = await query('SELECT status, source, transcript_version, deleted_at FROM sessions WHERE id = ?', [sessionId]);
    const row = s.rows[0];
    if (!row || row.deleted_at || !['completed', 'recovered'].includes(row.status) || (row.source && row.source !== 'live')) return 'skipped';
    const other = await query(`SELECT 1 FROM session_transcript_tokens WHERE session_id = ? AND source <> 'realtime' LIMIT 1`, [sessionId]);
    if (other.rows.length) return 'skipped';
    const asm = assembleRtChunks(sessionId, await listRtChunks(sessionId));
    if (!asm || !asm.tokens.length) return 'skipped';
    const res = await saveCanonicalRecordStandalone({
      sessionId, jobKey: asm.key, source: 'realtime', tokens: asm.tokens, coversFull: false,
      sourceVersion: Number(row.transcript_version) || 0, engine: RT_ENGINE, model: RT_MODEL, meta: asm.meta,
    });
    if (res === 'saved') {
      logEvent({ event: 'session_record.realtime_saved', sessionId, source: 'server', detail: { count: asm.tokens.length, chunks: asm.meta.chunks, ok: asm.meta.complete } });
    }
    return res;
  } catch (e) {
    console.log('[session-record] realtime build failed (ignored):', String((e as Error)?.message || e).slice(0, 120));
    return 'skipped';
  }
}

// ————— سنجه‌ها (core-data-plan قدمِ ۴، migration 046) —————
export interface RecordForMetrics { recordId: number; source: string; meta: Record<string, unknown> | null; tokens: RecordToken[] }

export async function loadCurrentRecordForMetrics(sessionId: string): Promise<RecordForMetrics | null> {
  const r = await query('SELECT id, source, meta, tokens_gz FROM session_transcript_tokens WHERE session_id = ? ORDER BY id DESC LIMIT 1', [sessionId]);
  const x = r.rows[0];
  if (!x) return null;
  const meta = typeof x.meta === 'string' ? JSON.parse(x.meta) : (x.meta ?? null);
  return { recordId: Number(x.id), source: x.source, meta, tokens: unpackTokens(x.tokens_gz) ?? [] };
}

export async function saveRecordMetrics(recordId: number, metrics: unknown): Promise<void> {
  await query('UPDATE session_transcript_tokens SET metrics = ?, metrics_at = NOW() WHERE id = ?', [JSON.stringify(metrics), recordId]);
}

// آخرین گذرِ جلسه: سنجه‌ها (فقط عدد/پرچم) + منبع. null ⇒ هنوز سنجیده نشده یا رکورد ندارد.
export async function getCurrentRecordMetrics(sessionId: string): Promise<{ source: string; metrics: any; meta: any } | null> {
  const r = await query('SELECT source, meta, metrics FROM session_transcript_tokens WHERE session_id = ? ORDER BY id DESC LIMIT 1', [sessionId]);
  const x = r.rows[0];
  if (!x || x.metrics === null || x.metrics === undefined) return null;
  const parse = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v ?? null);
  return { source: x.source, metrics: parse(x.metrics), meta: parse(x.meta) };
}

// پنلِ ادمین (نمایِ «کیفیت به عدد»): آخرین گذرِ هر جلسه‌ی غیرآپلودی که سنجه دارد. فقط عدد/پرچم و برچسبِ جلسه (LAW-001).
// گذرهایِ upload از audio_jobs.transcript_metrics می‌آیند (همان‌جا) و اینجا تکرار نمی‌شوند.
export async function listRecordMetricsForAdmin(f: { therapistId: string | null; days: number }): Promise<Array<{
  record_id: number; session_id: string; source: string; created_at: string; metrics: unknown;
  session_num: number | null; client_code: string | null; therapist_id: string; therapist_name: string | null;
}>> {
  const where = ['k.metrics IS NOT NULL', `k.source <> 'upload'`, 'k.created_at > (NOW() - INTERVAL ? DAY)',
    'k.id = (SELECT MAX(k2.id) FROM session_transcript_tokens k2 WHERE k2.session_id = k.session_id)'];
  const params: unknown[] = [f.days];
  if (f.therapistId) { where.push('c.therapist_id = ?'); params.push(f.therapistId); }
  const r = await query(
    `SELECT k.id, k.session_id, k.source, k.created_at, k.metrics, s.session_num, c.code AS client_code, c.therapist_id, t.name AS therapist_name
       FROM session_transcript_tokens k
       JOIN sessions s ON s.id = k.session_id
       JOIN clients c ON c.id = s.client_id
       JOIN therapists t ON t.id = c.therapist_id
      WHERE ${where.join(' AND ')}
      ORDER BY k.created_at DESC LIMIT 500`, params);
  return r.rows.map((x: any) => ({
    record_id: Number(x.id), session_id: x.session_id, source: x.source, created_at: new Date(x.created_at).toISOString(),
    metrics: typeof x.metrics === 'string' ? JSON.parse(x.metrics) : x.metrics,
    session_num: x.session_num ?? null, client_code: x.client_code ?? null, therapist_id: x.therapist_id, therapist_name: x.therapist_name ?? null,
  }));
}
