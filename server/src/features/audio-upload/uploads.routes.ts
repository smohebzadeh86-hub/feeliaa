// API ِ آپلودِ فایلِ صوتیِ جلسه + وضعیتِ jobها + اعلان‌ها (migration 023).
//
// POST   /api/uploads                     شروع/ادامه (dedupe با fingerprint)
// GET    /api/uploads/:id                 تکه‌هایِ دریافت‌شده (برایِ ادامه بعد از قطعی/رفرش)
// PUT    /api/uploads/:id/chunks/:n       یک تکه (application/octet-stream، حداکثر ۴MB)
// POST   /api/uploads/:id/complete        الحاق + بررسیِ واقعیِ فایل + ساختِ جلسه و job (اتمیک)
// DELETE /api/uploads/:id                 لغوِ آپلودِ نیمه‌کاره
// DELETE /api/upload-groups/:groupId      لغوِ همه‌ی بخش‌هایِ هنوز‌ثبت‌نشده‌ی یک آپلودِ چندبخشی
//
// چندبخشی (migration 025): چند فایلِ یک جلسه ⇒ هر فایل یک آپلود با group_id/part_index/parts_total مشترک.
// completeِ هر بخش فایل را بررسی و نگه می‌دارد (part_done)؛ completeِ آخرین بخش یک جلسه + یک job می‌سازد که
// بخش‌ها را به ترتیبِ part_index به هم وصل و یک‌جا رونویسی می‌کند.
// GET    /api/audio-jobs                  jobهایِ فعال/اخیرِ تراپیست (سینیِ پردازش)
// GET    /api/audio-jobs/:id
// POST   /api/audio-jobs/:id/retry        تلاشِ دوباره بدونِ آپلودِ دوباره
// GET    /api/sessions/:id/audio-job      آخرین jobِ یک جلسه
// GET    /api/notifications               + POST /api/notifications/read
//
// مالکیت (LAW-004): همه با therapist_id؛ منبعِ غیرمالک ⇒ 404.
import { randomUUID, createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { query, pool } from '../../db/connection.js';
import { requireAuth } from '../../auth/guard.js';
import { getOwnedClient, getOwnedSession } from '../../db/ownership.js';
import { normalizeSessionDate, nowInTehran, INVALID_DATE_ERROR } from '../../http/sessionDate.js';
import { logEvent } from '../../obs/eventLog.js';
import {
  CHUNK_SIZE, MAX_UPLOAD_BYTES, MAX_ACTIVE_UPLOADS_PER_THERAPIST, MAX_PARTS_PER_SESSION,
  expectedChunkBytes, writeChunk, receivedChunks, assembleUpload, assembledPath, removeUploadDir, ensureUploadDir, freeBytes,
} from './uploadStore.js';
import { ACCEPTED_EXTENSIONS, MAX_DURATION_MS, extensionOf, probeMedia, sniffObviouslyNotAudio } from './media.js';
import { wakeAudioJobWorker, parseSourceParts } from './jobRunner.js';
import { uploadCaseFileEnabled, uploadCaseFileAllowed } from './jobMachine.js';
import { existsSync } from 'node:fs';
import { hasStoredConsent, recordClientConsent } from '../../http/clientConsent.js';
import { isSessionNumConflict, SESSION_NUM_MAX_RETRIES, sessionNumRetryPause } from '../../http/sessions.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FP_RE = /^[a-f0-9]{32,128}$/;

// قفلِ per-upload برایِ complete (تک‌پروسه — LAW-013): دو کلیک/دو تبِ هم‌زمان دو بار الحاق نمی‌کنند.
const completeLocks = new Map<string, Promise<unknown>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = completeLocks.get(key) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  completeLocks.set(key, run.catch(() => {}));
  return run;
}

function sanitizeName(name: string): string {
  // فقط برایِ نمایش به خودِ تراپیست؛ هرگز در مسیرِ فایل استفاده نمی‌شود.
  return String(name || '').replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_').slice(0, 200) || 'audio';
}

async function getOwnedUpload(id: string, therapistId: string) {
  if (!UUID_RE.test(id)) return null;
  const r = await query('SELECT * FROM audio_uploads WHERE id = ? AND therapist_id = ?', [id, therapistId]);
  return r.rows[0] ?? null;
}

function uploadView(u: any, received?: number[]) {
  return {
    id: u.id,
    status: u.status,
    client_id: u.client_id,
    session_id: u.session_id,
    original_name: u.original_name,
    size_bytes: Number(u.size_bytes),
    chunk_size: u.chunk_size,
    chunks_total: u.chunks_total,
    received: received ?? [],
    error_code: u.error_code,
    group_id: u.group_id ?? null,
    part_index: u.part_index ?? null,
    parts_total: u.parts_total ?? null,
  };
}

const JOB_SELECT = `SELECT j.id, j.stage, j.attempts, j.error_code, j.duration_ms, j.case_file_status,
    j.transcript_applied_at, j.transcript_chars, j.created_at, j.updated_at, j.finished_at, j.next_attempt_at,
    j.session_id, j.client_id, j.upload_id, s.session_num, c.code AS client_code, c.alias AS client_alias, c.status AS client_status,
    u.original_name, u.parts_total, t.case_file_enabled AS t_case_file_enabled, t.case_file_auto_generate AS t_case_file_auto_generate
  FROM audio_jobs j
  JOIN sessions s ON s.id = j.session_id
  JOIN clients c ON c.id = j.client_id
  JOIN therapists t ON t.id = j.therapist_id
  JOIN audio_uploads u ON u.id = j.upload_id`;

function jobView(j: any) {
  return {
    id: j.id,
    stage: j.stage,
    attempts: j.attempts,
    error_code: j.error_code,
    duration_ms: j.duration_ms,
    case_file_status: j.case_file_status,
    transcript_ready: !!j.transcript_applied_at,
    transcript_chars: j.transcript_chars,
    created_at: j.created_at,
    updated_at: j.updated_at,
    finished_at: j.finished_at,
    next_attempt_at: j.next_attempt_at,
    session_id: j.session_id,
    session_num: j.session_num,
    client_id: j.client_id,
    client_code: j.client_code,
    client_alias: j.client_alias,
    client_status: j.client_status ?? null,
    // پیش از ثبتِ متن: آیا این job (با وضعیتِ فعلی) به مرحله‌ی پرونده می‌رود؟ تنها منبعِ UI برایِ stepper (همان uploadCaseFileAllowed).
    case_file_planned: uploadCaseFileAllowed({
      clientStatus: j.client_status ?? null,
      caseFileEnabled: !!j.t_case_file_enabled,
      autoGenerate: j.t_case_file_auto_generate === null || j.t_case_file_auto_generate === undefined ? null : !!j.t_case_file_auto_generate,
    }),
    original_name: j.original_name,
    parts_total: j.parts_total ?? null,
  };
}

// خطاهایی که تلاشِ دوباره رویِ همان صدا درستشان نمی‌کند (فایلِ مشکل‌دار یا صدایِ ازدست‌رفته).
const DEAD_JOB_CODES = ['unreadable', 'no-audio', 'too-long', 'audio-missing', 'audio-expired'];

// آیا jobِ شکست‌خورده بدونِ آپلودِ دوباره قابلِ ادامه است؟ (مشترک بینِ retry و تشخیصِ «تکراری»)
function failedJobRetryability(job: any): { ok: true; stage: string } | { ok: false; status: number; code: string; error: string } {
  const hasNormalized = !!job.normalized_path && existsSync(job.normalized_path);
  const parts = parseSourceParts(job.source_parts);
  const hasSource = parts
    ? parts.every((p) => existsSync(p.path))
    : !!job.source_path && existsSync(job.source_path);
  if (!hasNormalized && !hasSource) {
    return { ok: false, status: 410, code: 'audio-expired', error: 'فایلِ صوتیِ این جلسه دیگر رویِ سرور نیست — لطفاً دوباره آپلود کنید' };
  }
  if (DEAD_JOB_CODES.includes(job.error_code)) {
    return { ok: false, status: 422, code: job.error_code, error: 'این فایل قابلِ پردازش نیست — تلاشِ دوباره کمکی نمی‌کند' };
  }
  // متن ثبت شده ⇒ تنها کارِ باقی مرحله‌ی پرونده است؛ فقط jobی که واقعاً در آن مرحله شکست خورد (running/waiting —
  // مراجعِ غیرفعال، تصمیمِ مالک 2026-09-25) دوباره به صف می‌رود.
  if (job.transcript_applied_at && !uploadCaseFileEnabled() && !['running', 'waiting'].includes(job.case_file_status)) {
    return { ok: false, status: 409, code: 'not-failed', error: 'متنِ این جلسه قبلاً ذخیره شده است' };
  }
  return { ok: true, stage: job.transcript_applied_at ? 'case_file' : hasNormalized ? 'transcribing' : 'normalizing' };
}

// jobِ failed ⇒ دوباره در صف (بدونِ آپلودِ دوباره). false یعنی هم‌زمان کسِ دیگری زودتر این کار را کرده.
async function requeueFailedJob(job: any, stage: string, therapistId: string): Promise<boolean> {
  const r = await query(
    `UPDATE audio_jobs SET stage = ?, attempts = 0, error_code = NULL, finished_at = NULL, next_attempt_at = NOW(),
       locked_until = NULL WHERE id = ? AND stage = 'failed'`,
    [stage, job.id]
  );
  if (r.rowCount !== 1) return false;
  await query(`UPDATE sessions SET batch_status = 'queued' WHERE id = ?`, [job.session_id]);
  // اعلانِ شکستِ قبلی دیگر معتبر نیست؛ حذفش لازم است چون UNIQUE(job_id,kind) وگرنه اعلانِ شکستِ
  // احتمالیِ بعدی را (INSERT IGNORE) بی‌صدا نادیده می‌گرفت.
  await query(`DELETE FROM notifications WHERE job_id = ? AND kind = 'processing_failed'`, [job.id]);
  logEvent({ event: 'audio_job.retry', sessionId: job.session_id, therapistId, detail: { stage } });
  wakeAudioJobWorker();
  return true;
}

// آپلودِ نیمه‌کاره‌ای که این مدت هیچ تکه‌ای نگرفته رها شده حساب می‌شود — فقط وقتی سقفِ آپلودهایِ هم‌زمان پر
// است آزاد می‌شود (وگرنه تا ۷ روز برایِ ادامه می‌ماند). بدونِ این، کارتِ خطایی که بسته شد یا فایلی که رویِ
// گوشی دوباره انتخاب شد (اثرِ انگشتِ تازه) تراپیست را تا ۷ روز با 429 قفل می‌کرد و UIای برایِ لغو نبود.
const IDLE_UPLOAD_RELEASE_SECONDS = 24 * 60 * 60;

async function releaseIdleUploads(therapistId: string): Promise<void> {
  const idle = await query(
    `SELECT id FROM audio_uploads WHERE therapist_id = ? AND status = 'uploading' AND updated_at < (NOW() - INTERVAL ? SECOND)`,
    [therapistId, IDLE_UPLOAD_RELEASE_SECONDS]
  );
  for (const row of idle.rows) {
    const r = await query(
      `UPDATE audio_uploads SET status = 'canceled', error_code = 'expired' WHERE id = ? AND status = 'uploading'`, [row.id]);
    if (r.rowCount === 1) removeUploadDir(row.id);
  }
}

// ————— چندبخشی (migration 025) —————
// وقتی همه‌ی بخش‌هایِ یک گروه رسیده و بررسی شده‌اند ⇒ یک جلسه + یک job (اتمیک). تا آن موقع ⇒ part_done.
// همیشه زیرِ قفلِ درون‌پروسه‌ایِ گروه صدا زده می‌شود (LAW-013) + FOR UPDATE رویِ ردیف‌ها در تراکنش.
type GroupResult =
  | { kind: 'waiting'; received: number; total: number }
  | { kind: 'created'; jobId: string; sessionId: string }
  | { kind: 'already'; sessionId: string }
  | { kind: 'rejected'; status: number; code: string; error: string };

async function finalizeGroup(groupId: string, therapistId: string): Promise<GroupResult> {
  const r = await query(
    `SELECT * FROM audio_uploads WHERE therapist_id = ? AND group_id = ? AND status = 'complete' ORDER BY part_index ASC, completed_at ASC`,
    [therapistId, groupId]
  );
  const rows = r.rows as any[];
  if (!rows.length) return { kind: 'waiting', received: 0, total: 0 };
  const done = rows.find((x) => x.session_id);
  if (done) return { kind: 'already', sessionId: done.session_id };
  const total = Number(rows[0].parts_total);
  const byIndex = new Map<number, any>();
  for (const x of rows) if (!byIndex.has(x.part_index)) byIndex.set(x.part_index, x);
  if (byIndex.size < total) return { kind: 'waiting', received: byIndex.size, total };
  const parts = Array.from({ length: total }, (_, i) => byIndex.get(i)).filter(Boolean);
  if (parts.length !== total) return { kind: 'waiting', received: parts.length, total };

  const known = parts.every((p) => p.duration_ms !== null && p.duration_ms !== undefined);
  const totalMs = known ? parts.reduce((s, p) => s + Number(p.duration_ms), 0) : null;
  if (totalMs !== null && totalMs > MAX_DURATION_MS) {
    for (const p of parts) {
      await query(`UPDATE audio_uploads SET status = 'failed', error_code = 'too-long' WHERE id = ? AND session_id IS NULL`, [p.id]);
      removeUploadDir(p.id);
    }
    logEvent({ event: 'upload.rejected', therapistId, clientId: parts[0].client_id, code: 'too-long', severity: 'warn' });
    return { kind: 'rejected', status: 422, code: 'too-long', error: 'مجموعِ بخش‌ها بیش از ۵ ساعت است' };
  }

  const first = parts[0];
  const sourceParts = parts.map((p) => ({ uploadId: p.id, path: assembledPath(p.id, extensionOf(p.original_name)) }));
  const sessionId = randomUUID();
  const jobId = randomUUID();
  const now = nowInTehran();
  for (let attempt = 0; ; attempt++) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [lockRows] = await conn.query(
        `SELECT id, status, session_id FROM audio_uploads WHERE id IN (${parts.map(() => '?').join(',')}) FOR UPDATE`, parts.map((p) => p.id));
      const locked = lockRows as any[];
      if (locked.length !== parts.length || locked.some((x) => x.status !== 'complete' || x.session_id)) {
        await conn.rollback();
        const s = locked.find((x) => x.session_id);
        return s ? { kind: 'already', sessionId: s.session_id } : { kind: 'rejected', status: 409, code: 'group-closed', error: 'این مجموعه‌ی فایل دیگر باز نیست' };
      }
      const [numRows] = await conn.query(
        'SELECT COALESCE(MAX(session_num), 0) + 1 AS next FROM sessions WHERE client_id = ? FOR UPDATE', [first.client_id]);
      const sessionNum = (numRows as any[])[0].next;
      // consent=true: تراپیست پیش از آپلود صریحاً تأیید کرد که مراجع به ضبط رضایت داده است (LAW-009).
      await conn.query(
        `INSERT INTO sessions (id, client_id, session_num, date, start_time, consent, status, source, stt_mode, batch_status, duration_ms)
         VALUES (?, ?, ?, ?, ?, true, 'completed', 'upload', 'upload', 'queued', ?)`,
        [sessionId, first.client_id, sessionNum, first.session_date || null, now.time, totalMs]
      );
      await conn.query(
        `INSERT INTO audio_jobs (id, upload_id, therapist_id, client_id, session_id, stage, source_path, source_parts, duration_ms)
         VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?)`,
        [jobId, first.id, therapistId, first.client_id, sessionId, sourceParts[0].path, JSON.stringify(sourceParts), totalMs]
      );
      await conn.query(
        `UPDATE audio_uploads SET session_id = ? WHERE id IN (${parts.map(() => '?').join(',')})`, [sessionId, ...parts.map((p) => p.id)]);
      await conn.commit();
      break;
    } catch (e) {
      try { await conn.rollback(); } catch {}
      if (isSessionNumConflict(e) && attempt < SESSION_NUM_MAX_RETRIES) { await sessionNumRetryPause(attempt); continue; }
      throw e;
    } finally {
      conn.release();
    }
  }
  logEvent({ event: 'upload.completed', therapistId, clientId: first.client_id, sessionId, detail: { count: total, duration_ms: totalMs } });
  logEvent({ event: 'session.created', sessionId, clientId: first.client_id, therapistId, detail: { mode: 'upload' } });
  wakeAudioJobWorker();
  return { kind: 'created', jobId, sessionId };
}

export async function audioUploadRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // تکه‌ها بایتِ خام‌اند — parser فقط داخلِ همین plugin (encapsulated) ثبت می‌شود.
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: CHUNK_SIZE + 1024 }, (_req, body, done) => {
    done(null, body);
  });

  app.post('/api/uploads', async (request, reply) => {
    const b = (request.body || {}) as {
      client_id?: string; file_name?: string; size?: number; mime?: string;
      fingerprint?: string; session_date?: string; consent?: boolean;
      group_id?: string; part_index?: number; parts_total?: number;
    };
    const therapistId = request.therapistId!;
    const size = Number(b.size);
    if (!Number.isInteger(size) || size < 1024) {
      reply.code(400);
      return { error: 'فایل خالی یا خیلی کوچک است', code: 'file-too-small' };
    }
    if (size > MAX_UPLOAD_BYTES) {
      reply.code(413);
      return { error: 'حجمِ فایل بیش از ۱ گیگابایت است', code: 'file-too-large' };
    }
    const ext = extensionOf(b.file_name || '');
    // پسوند فقط ردِ زود است (تصمیمِ نهایی با probeِ ffmpeg). فایلِ بدونِ پسوندِ آشنا ولی با MIMEِ صوتی/ویدیویی
    // (بعضی ضبط‌کننده‌هایِ اندروید، .mpga، …) پذیرفته می‌شود — هم‌راستا با چکِ کلاینت در index.html.
    if (!ACCEPTED_EXTENSIONS.includes(ext) && !/^(audio|video)\//i.test(String(b.mime || ''))) {
      reply.code(415);
      return { error: 'این فرمت پشتیبانی نمی‌شود', code: 'unsupported-format' };
    }
    const fingerprint = String(b.fingerprint || '').toLowerCase();
    if (!FP_RE.test(fingerprint)) {
      reply.code(400);
      return { error: 'شناسه‌ی فایل نامعتبر است', code: 'bad-fingerprint' };
    }
    // چندبخشی: هر سه با هم، یا هیچ‌کدام (آپلودِ تک‌فایلیِ قبلی).
    const grouped = b.group_id !== undefined || b.part_index !== undefined || b.parts_total !== undefined;
    const groupId = grouped ? String(b.group_id || '').toLowerCase() : null;
    const partIndex = grouped ? Number(b.part_index) : null;
    const partsTotal = grouped ? Number(b.parts_total) : null;
    if (grouped && (!UUID_RE.test(groupId!) || !Number.isInteger(partsTotal) || partsTotal! < 2 || partsTotal! > MAX_PARTS_PER_SESSION
      || !Number.isInteger(partIndex) || partIndex! < 0 || partIndex! >= partsTotal!)) {
      reply.code(400);
      return { error: 'مشخصاتِ بخش‌هایِ جلسه نامعتبر است', code: 'bad-part' };
    }
    if (!b.client_id || !UUID_RE.test(b.client_id)) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }
    const client = await getOwnedClient(b.client_id, therapistId);
    if (!client) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }
    // LAW-009: رضایتِ صریح — یا همین حالا (تیکِ مودال) یا رضایتِ یک‌باره‌ی ثبت‌شده‌ی همین مراجع (migration 024).
    if (b.consent !== true && !hasStoredConsent(client)) {
      reply.code(400);
      return { error: 'تأییدِ رضایتِ مراجع برایِ ضبط الزامی است', code: 'consent-required' };
    }
    if (b.consent === true) await recordClientConsent(b.client_id, therapistId);
    let sessionDate: string | null = null;
    if (typeof b.session_date === 'string' && b.session_date.trim()) {
      sessionDate = normalizeSessionDate(b.session_date);
      if (!sessionDate) {
        reply.code(400);
        return { error: INVALID_DATE_ERROR };
      }
    }

    if (grouped) {
      // گروهی که بخشی از آن رد/لغو شده دیگر جلسه نمی‌سازد (بخشِ expired با آپلودِ تازه جایگزین‌پذیر است).
      const dead = await query(
        `SELECT COUNT(*) AS n FROM audio_uploads WHERE therapist_id = ? AND group_id = ?
           AND (client_id <> ? OR parts_total <> ? OR status = 'failed'
                OR (status = 'canceled' AND error_code IN ('user-canceled','group-canceled')))`,
        [therapistId, groupId, b.client_id, partsTotal]
      );
      if (Number(dead.rows[0]?.n || 0) > 0) {
        reply.code(409);
        return { error: 'این مجموعه‌ی فایل لغو یا رد شده است — دوباره انتخاب کنید', code: 'group-closed' };
      }
      // ادامه‌ی همان بخش (بعد از رفرش/قطعی) — کلید: گروه + شماره‌ی بخش، نه fingerprint (یک فایل ممکن است دو بار انتخاب شود).
      const pp = await query(
        `SELECT * FROM audio_uploads WHERE therapist_id = ? AND group_id = ? AND part_index = ?
           AND status IN ('uploading','complete') ORDER BY created_at DESC LIMIT 1`,
        [therapistId, groupId, partIndex]
      );
      const u = pp.rows[0];
      if (u) {
        if (u.fingerprint !== fingerprint) {
          reply.code(409);
          return { error: 'این بخش با فایلِ دیگری شروع شده بود', code: 'part-mismatch' };
        }
        if (u.status === 'uploading') return { upload: uploadView(u, receivedChunks(u.id, Number(u.size_bytes), u.chunk_size)), resumed: true };
        if (!u.session_id) return { upload: uploadView(u), part_done: true };
        const j = await query(`${JOB_SELECT} WHERE j.session_id = ? ORDER BY j.created_at DESC LIMIT 1`, [u.session_id]);
        return { upload: uploadView(u), duplicate: true, requeued: false, job: j.rows[0] ? jobView(j.rows[0]) : null };
      }
    }

    // ادامه/تکراری: همان فایل (fingerprint) برایِ همان مراجع (فقط آپلودهایِ تک‌فایلی)
    const prev = grouped ? { rows: [] as any[] } : await query(
      `SELECT * FROM audio_uploads WHERE therapist_id = ? AND client_id = ? AND fingerprint = ? AND group_id IS NULL
         AND status IN ('uploading','complete') ORDER BY created_at DESC LIMIT 1`,
      [therapistId, b.client_id, fingerprint]
    );
    if (prev.rows[0]) {
      const u = prev.rows[0];
      if (u.status === 'uploading') {
        return { upload: uploadView(u, receivedChunks(u.id, Number(u.size_bytes), u.chunk_size)), resumed: true };
      }
      const pj = (await query('SELECT * FROM audio_jobs WHERE upload_id = ?', [u.id])).rows[0];
      // ⭐ رفعِ B2 (audit 2026-09-24): آپلودِ complete هرگز از حالتِ complete خارج نمی‌شد، حتی وقتی jobش
      // دائماً شکست خورده بود ⇒ UI می‌گفت «دوباره آپلود کنید» و همان فایل «تکراری» رد می‌شد (بن‌بست).
      //  - jobِ شکست‌خورده‌ی قابلِ ادامه ⇒ همان job دوباره در صف (آپلودِ دوباره لازم نیست، جلسه‌ی تکراری ساخته نمی‌شود).
      //  - jobِ شکست‌خورده‌ی غیرقابلِ ادامه (صدا دیگر نیست / فایلِ مشکل‌دار) ⇒ آپلودِ تازه مجاز است.
      let requeued = false;
      let dead = false;
      if (pj && pj.stage === 'failed') {
        const rt = failedJobRetryability(pj);
        if (rt.ok) requeued = await requeueFailedJob(pj, rt.stage, therapistId);
        else if (rt.code !== 'not-failed') dead = true;
      }
      if (!dead) {
        const j = await query(`${JOB_SELECT} WHERE j.upload_id = ?`, [u.id]);
        return { upload: uploadView(u), duplicate: true, requeued, job: j.rows[0] ? jobView(j.rows[0]) : null };
      }
    }

    const countActive = async () => Number(
      (await query(`SELECT COUNT(*) AS n FROM audio_uploads WHERE therapist_id = ? AND status = 'uploading'`, [therapistId])).rows[0]?.n || 0);
    let activeCount = await countActive();
    if (activeCount >= MAX_ACTIVE_UPLOADS_PER_THERAPIST) {
      await releaseIdleUploads(therapistId);
      activeCount = await countActive();
    }
    if (activeCount >= MAX_ACTIVE_UPLOADS_PER_THERAPIST) {
      reply.code(429);
      return { error: 'چند آپلودِ نیمه‌کاره دارید — اول آن‌ها را تمام یا لغو کنید', code: 'too-many-uploads' };
    }
    const free = freeBytes();
    if (free !== null && free < size * 2 + 512 * 1024 * 1024) {
      reply.code(507);
      return { error: 'فضایِ ذخیره‌سازیِ سرور موقتاً کافی نیست — بعداً دوباره تلاش کنید', code: 'server-storage-full' };
    }

    const id = randomUUID();
    const chunksTotal = Math.ceil(size / CHUNK_SIZE);
    await query(
      `INSERT INTO audio_uploads (id, therapist_id, client_id, fingerprint, original_name, mime, size_bytes, chunk_size, chunks_total, session_date,
         group_id, part_index, parts_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, therapistId, b.client_id, fingerprint, sanitizeName(b.file_name || ''), String(b.mime || '').slice(0, 100) || null,
        size, CHUNK_SIZE, chunksTotal, sessionDate, groupId, partIndex, partsTotal]
    );
    ensureUploadDir(id);
    logEvent({ event: 'upload.created', therapistId, clientId: b.client_id, detail: { bytes: size, chunks: chunksTotal, ext, ...(grouped ? { seq: partIndex, count: partsTotal } : {}) } });
    const r = await query('SELECT * FROM audio_uploads WHERE id = ?', [id]);
    reply.code(201);
    return { upload: uploadView(r.rows[0], []) };
  });

  app.get('/api/uploads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const u = await getOwnedUpload(id, request.therapistId!);
    if (!u) { reply.code(404); return { error: 'آپلود یافت نشد' }; }
    const received = u.status === 'uploading' ? receivedChunks(u.id, Number(u.size_bytes), u.chunk_size) : [];
    const j = u.status === 'complete' ? await query(`${JOB_SELECT} WHERE j.upload_id = ?`, [u.id]) : { rows: [] as any[] };
    return { upload: uploadView(u, received), job: j.rows[0] ? jobView(j.rows[0]) : null };
  });

  app.put('/api/uploads/:id/chunks/:n', { bodyLimit: CHUNK_SIZE + 1024 }, async (request, reply) => {
    const { id, n: nRaw } = request.params as { id: string; n: string };
    const u = await getOwnedUpload(id, request.therapistId!);
    if (!u) { reply.code(404); return { error: 'آپلود یافت نشد' }; }
    if (u.status !== 'uploading') {
      reply.code(409);
      return { error: 'این آپلود دیگر باز نیست', code: 'upload-closed', status: u.status };
    }
    const n = Number(nRaw);
    const expected = Number.isInteger(n) ? expectedChunkBytes(Number(u.size_bytes), u.chunk_size, n) : -1;
    if (expected < 0) { reply.code(400); return { error: 'شماره‌ی تکه نامعتبر است', code: 'bad-chunk-index' }; }
    const body = request.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length !== expected) {
      reply.code(400);
      return { error: 'حجمِ تکه نادرست است', code: 'bad-chunk-size', expected };
    }
    // صحتِ بایت‌ها در مسیرِ شبکه (اختیاری ولی کلاینتِ ما همیشه می‌فرستد)
    const claimed = String(request.headers['x-chunk-sha256'] || '').toLowerCase();
    if (claimed) {
      const actual = createHash('sha256').update(body).digest('hex');
      if (actual !== claimed) { reply.code(422); return { error: 'تکه در مسیر خراب شد — دوباره ارسال می‌شود', code: 'chunk-corrupt' }; }
    }
    writeChunk(u.id, n, body);
    await query('UPDATE audio_uploads SET updated_at = NOW() WHERE id = ?', [u.id]);
    return { ok: true, n };
  });

  app.post('/api/uploads/:id/complete', async (request, reply) => {
    const { id } = request.params as { id: string };
    const therapistId = request.therapistId!;
    return withLock(id, async () => {
      const u = await getOwnedUpload(id, therapistId);
      if (!u) { reply.code(404); return { error: 'آپلود یافت نشد' }; }
      // پاسخِ یک بخش از آپلودِ چندبخشی بعد از رسیدنش: منتظرِ بقیه، یا جلسه‌ی تازه‌ساخته/از‌قبل‌ساخته.
      const groupReply = (row: any) => withLock('group:' + row.group_id, async () => {
        const g = await finalizeGroup(row.group_id, therapistId);
        const up = { ...uploadView(row), status: 'complete' };
        if (g.kind === 'waiting') return { upload: up, part_done: true, parts_received: g.received, parts_total: g.total };
        if (g.kind === 'rejected') { reply.code(g.status); return { error: g.error, code: g.code }; }
        const j = await query(`${JOB_SELECT} WHERE j.session_id = ? ORDER BY j.created_at DESC LIMIT 1`, [g.sessionId]);
        if (g.kind === 'created') reply.code(201);
        return { upload: { ...up, session_id: g.sessionId }, job: j.rows[0] ? jobView(j.rows[0]) : null };
      });
      if (u.status === 'complete' && u.group_id) return groupReply(u);
      if (u.status === 'complete') {
        const j = await query(`${JOB_SELECT} WHERE j.upload_id = ?`, [u.id]);
        return { upload: uploadView(u), job: j.rows[0] ? jobView(j.rows[0]) : null };
      }
      if (u.status !== 'uploading') {
        reply.code(409);
        return { error: 'این آپلود دیگر باز نیست', code: 'upload-closed', status: u.status };
      }
      const size = Number(u.size_bytes);
      const got = receivedChunks(u.id, size, u.chunk_size);
      if (got.length !== u.chunks_total) {
        const have = new Set(got);
        const missing: number[] = [];
        // فهرستِ کامل (حداکثر ۲۵۶ تکه برایِ ۱GB) — قبلاً سقفِ ۵۰ داشت و کلاینت بعد از ۳ دور به خطا می‌خورد.
        for (let i = 0; i < u.chunks_total; i++) if (!have.has(i)) missing.push(i);
        reply.code(409);
        return { error: 'بخشی از فایل هنوز نرسیده است', code: 'chunks-missing', missing };
      }

      const reject = async (code: string, message: string, status = 422) => {
        await query(`UPDATE audio_uploads SET status = 'failed', error_code = ? WHERE id = ?`, [code, u.id]);
        removeUploadDir(u.id);
        logEvent({ event: 'upload.rejected', therapistId, clientId: u.client_id, code, severity: 'warn' });
        reply.code(status);
        return { error: message, code };
      };

      let sourcePath: string;
      try {
        sourcePath = await assembleUpload(u.id, u.chunks_total, size, extensionOf(u.original_name));
      } catch {
        reply.code(500);
        return { error: 'ذخیره‌ی فایل ناموفق بود — دوباره تلاش کنید', code: 'assemble-failed' };
      }
      if (sniffObviouslyNotAudio(sourcePath)) return reject('not-audio', 'این فایل صوتی نیست');
      const probe = await probeMedia(sourcePath);
      if (!probe.ok && probe.reason === 'no-ffmpeg') {
        // سرور ابزارِ بررسی ندارد — آپلود رد نمی‌شود؛ jobِ پس‌زمینه بعداً بررسی می‌کند (fail-open).
      } else if (!probe.ok) {
        return probe.reason === 'no-audio'
          ? reject('no-audio', 'این فایل هیچ صدایی ندارد')
          : reject('unreadable', 'فایل خراب است یا قابلِ خواندن نیست');
      } else if (probe.durationMs !== null && probe.durationMs > MAX_DURATION_MS) {
        return reject('too-long', 'فایل بیش از ۵ ساعت است — لطفاً آن را در دو بخش آپلود کنید');
      }

      if (u.group_id) {
        // بخشی از آپلودِ چندبخشی: فایل بررسی و نگه داشته می‌شود؛ جلسه فقط با رسیدنِ همه‌ی بخش‌ها ساخته می‌شود.
        const mark = await query(
          `UPDATE audio_uploads SET status = 'complete', completed_at = NOW(), duration_ms = ? WHERE id = ? AND status = 'uploading'`,
          [probe.durationMs, u.id]
        );
        if (mark.rowCount !== 1) {
          reply.code(409);
          return { error: 'این آپلود دیگر باز نیست', code: 'upload-closed' };
        }
        logEvent({ event: 'upload.part_received', therapistId, clientId: u.client_id, detail: { seq: u.part_index, count: u.parts_total, bytes: size } });
        return groupReply({ ...u, status: 'complete', duration_ms: probe.durationMs });
      }

      // اتمیک: جلسه + job + بستنِ آپلود با هم؛ یا همه یا هیچ.
      const client = await getOwnedClient(u.client_id, therapistId);
      if (!client) { reply.code(404); return { error: 'مراجع یافت نشد' }; }
      const sessionId = randomUUID();
      const jobId = randomUUID();
      const now = nowInTehran();
      // رفعِ M7: تداخلِ شماره‌ی جلسه/deadlock با ساختِ هم‌زمانِ جلسه‌ی دیگرِ همان مراجع ⇒ کلِ تراکنش دوباره (اتمیک است).
      for (let attempt = 0; ; attempt++) {
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          const [lockRows] = await conn.query('SELECT status FROM audio_uploads WHERE id = ? FOR UPDATE', [u.id]);
          if ((lockRows as any[])[0]?.status !== 'uploading') {
            await conn.rollback();
            reply.code(409);
            return { error: 'این آپلود دیگر باز نیست', code: 'upload-closed' };
          }
          const [numRows] = await conn.query(
            'SELECT COALESCE(MAX(session_num), 0) + 1 AS next FROM sessions WHERE client_id = ? FOR UPDATE', [u.client_id]);
          const sessionNum = (numRows as any[])[0].next;
          // consent=true: تراپیست پیش از آپلود صریحاً تأیید کرد که مراجع به ضبط رضایت داده است (LAW-009).
          await conn.query(
            `INSERT INTO sessions (id, client_id, session_num, date, start_time, consent, status, source, stt_mode, batch_status, duration_ms)
             VALUES (?, ?, ?, ?, ?, true, 'completed', 'upload', 'upload', 'queued', ?)`,
            [sessionId, u.client_id, sessionNum, u.session_date || null, now.time, probe.durationMs]
          );
          await conn.query(
            `INSERT INTO audio_jobs (id, upload_id, therapist_id, client_id, session_id, stage, source_path, duration_ms)
             VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)`,
            [jobId, u.id, therapistId, u.client_id, sessionId, sourcePath, probe.durationMs]
          );
          await conn.query(
            `UPDATE audio_uploads SET status = 'complete', session_id = ?, completed_at = NOW() WHERE id = ?`, [sessionId, u.id]);
          await conn.commit();
          break;
        } catch (e) {
          try { await conn.rollback(); } catch {}
          if (isSessionNumConflict(e) && attempt < SESSION_NUM_MAX_RETRIES) { await sessionNumRetryPause(attempt); continue; }
          throw e;
        } finally {
          conn.release();
        }
      }
      logEvent({ event: 'upload.completed', therapistId, clientId: u.client_id, sessionId, detail: { bytes: size, duration_ms: probe.durationMs } });
      logEvent({ event: 'session.created', sessionId, clientId: u.client_id, therapistId, detail: { mode: 'upload' } });
      wakeAudioJobWorker();
      const j = await query(`${JOB_SELECT} WHERE j.id = ?`, [jobId]);
      reply.code(201);
      return { upload: { ...uploadView(u), status: 'complete', session_id: sessionId }, job: jobView(j.rows[0]) };
    });
  });

  app.delete('/api/uploads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const u = await getOwnedUpload(id, request.therapistId!);
    if (!u) { reply.code(404); return { error: 'آپلود یافت نشد' }; }
    if (u.status !== 'uploading') {
      reply.code(409);
      return { error: 'فقط آپلودِ نیمه‌کاره قابلِ لغو است', code: 'upload-closed' };
    }
    await query(`UPDATE audio_uploads SET status = 'canceled', error_code = 'user-canceled' WHERE id = ? AND status = 'uploading'`, [u.id]);
    removeUploadDir(u.id);
    return { canceled: u.id };
  });

  // لغوِ کلِ آپلودِ چندبخشی: بخش‌هایِ در حالِ آپلود و بخش‌هایِ رسیده‌ای که هنوز جلسه نشده‌اند. گروهی که جلسه‌اش
  // ساخته شده دست نمی‌خورد (canceled: 0).
  app.delete('/api/upload-groups/:groupId', async (request) => {
    const { groupId } = request.params as { groupId: string };
    const therapistId = request.therapistId!;
    if (!UUID_RE.test(groupId)) return { canceled: 0 };
    return withLock('group:' + groupId, async () => {
      const r = await query(
        `SELECT id FROM audio_uploads WHERE therapist_id = ? AND group_id = ?
           AND (status = 'uploading' OR (status = 'complete' AND session_id IS NULL))`,
        [therapistId, groupId]
      );
      let n = 0;
      for (const row of r.rows) {
        const x = await query(
          `UPDATE audio_uploads SET status = 'canceled', error_code = 'group-canceled'
           WHERE id = ? AND (status = 'uploading' OR (status = 'complete' AND session_id IS NULL))`, [row.id]);
        if (x.rowCount === 1) { removeUploadDir(row.id); n++; }
      }
      return { canceled: n };
    });
  });

  // ————— jobها —————
  app.get('/api/audio-jobs', async (request) => {
    const scope = (request.query as any)?.scope === 'active' ? 'active' : 'recent';
    const where = scope === 'active'
      ? `j.therapist_id = ? AND (j.stage NOT IN ('done','failed') OR j.finished_at > (NOW() - INTERVAL 10 MINUTE))`
      : `j.therapist_id = ? AND j.created_at > (NOW() - INTERVAL 14 DAY)`;
    const r = await query(`${JOB_SELECT} WHERE ${where} ORDER BY j.created_at DESC LIMIT 30`, [request.therapistId]);
    return { jobs: r.rows.map(jobView) };
  });

  app.get('/api/audio-jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!UUID_RE.test(id)) { reply.code(404); return { error: 'یافت نشد' }; }
    const r = await query(`${JOB_SELECT} WHERE j.id = ? AND j.therapist_id = ?`, [id, request.therapistId]);
    if (!r.rows[0]) { reply.code(404); return { error: 'یافت نشد' }; }
    return { job: jobView(r.rows[0]) };
  });

  app.post('/api/audio-jobs/:id/retry', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!UUID_RE.test(id)) { reply.code(404); return { error: 'یافت نشد' }; }
    const r = await query('SELECT * FROM audio_jobs WHERE id = ? AND therapist_id = ?', [id, request.therapistId]);
    const job = r.rows[0];
    if (!job) { reply.code(404); return { error: 'یافت نشد' }; }
    if (job.stage !== 'failed') {
      reply.code(409);
      return { error: 'این پردازش در حالِ انجام است یا تمام شده', code: 'not-failed' };
    }
    // تلاشِ دوباره هرگز آپلودِ دوباره نمی‌خواهد تا وقتی صدا رویِ سرور هست (نسخه‌ی نرمال‌شده ۱۴ روز می‌ماند).
    const rt = failedJobRetryability(job);
    if (!rt.ok) {
      reply.code(rt.status);
      return { error: rt.error, code: rt.code };
    }
    await requeueFailedJob(job, rt.stage, request.therapistId!);
    const v = await query(`${JOB_SELECT} WHERE j.id = ?`, [id]);
    return { job: jobView(v.rows[0]) };
  });

  app.get('/api/sessions/:id/audio-job', async (request, reply) => {
    const { id } = request.params as { id: string };
    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) { reply.code(404); return { error: 'جلسه یافت نشد' }; }
    const r = await query(`${JOB_SELECT} WHERE j.session_id = ? ORDER BY j.created_at DESC LIMIT 1`, [id]);
    return { job: r.rows[0] ? jobView(r.rows[0]) : null };
  });

  // ————— اعلان‌ها —————
  app.get('/api/notifications', async (request) => {
    const r = await query(
      `SELECT n.id, n.kind, n.client_id, n.session_id, n.job_id, n.error_code, n.created_at, n.read_at,
              c.code AS client_code, c.alias AS client_alias, s.session_num
       FROM notifications n
       LEFT JOIN clients c ON c.id = n.client_id
       LEFT JOIN sessions s ON s.id = n.session_id
       WHERE n.therapist_id = ? ORDER BY n.created_at DESC LIMIT 30`,
      [request.therapistId]
    );
    const unread = await query('SELECT COUNT(*) AS n FROM notifications WHERE therapist_id = ? AND read_at IS NULL', [request.therapistId]);
    return { notifications: r.rows, unread: Number(unread.rows[0]?.n || 0) };
  });

  app.post('/api/notifications/read', async (request) => {
    const b = (request.body || {}) as { ids?: string[]; all?: boolean };
    if (b.all) {
      await query('UPDATE notifications SET read_at = NOW() WHERE therapist_id = ? AND read_at IS NULL', [request.therapistId]);
    } else if (Array.isArray(b.ids) && b.ids.length) {
      const ids = b.ids.filter((x) => UUID_RE.test(String(x))).slice(0, 100);
      if (ids.length) {
        await query(
          `UPDATE notifications SET read_at = NOW() WHERE therapist_id = ? AND read_at IS NULL AND id IN (${ids.map(() => '?').join(',')})`,
          [request.therapistId, ...ids]
        );
      }
    }
    return { ok: true };
  });
}
