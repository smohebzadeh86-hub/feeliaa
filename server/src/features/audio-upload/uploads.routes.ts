// API ِ آپلودِ فایلِ صوتیِ جلسه + وضعیتِ jobها (migration 023). اعلان‌ها: features/notifications.
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
//
// مالکیت (LAW-004): همه با therapist_id؛ منبعِ غیرمالک ⇒ 404.
import { randomUUID, createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../auth/guard.js';
import { getOwnedClient, getOwnedSession } from '../../db/ownership.js';
import { normalizeSessionDate, nowInTehran, INVALID_DATE_ERROR } from '../sessions/sessionDate.js';
import { logEvent } from '../../obs/eventLog.js';
import {
  CHUNK_SIZE, MAX_UPLOAD_BYTES, MAX_ACTIVE_UPLOADS_PER_THERAPIST, MAX_PARTS_PER_SESSION,
  expectedChunkBytes, writeChunk, receivedChunks, assembleUpload, removeUploadDir, ensureUploadDir, freeBytes,
} from './uploadStore.js';
import { ACCEPTED_EXTENSIONS, MAX_DURATION_MS, extensionOf, probeMedia, sniffObviouslyNotAudio } from './media.js';
import { wakeAudioJobWorker } from './worker.js';
import { parseSourceParts } from './jobStore.sql.js';
import { parseAudioQuality } from './quality.js';
import { uploadCaseFileEnabled, uploadCaseFileAllowed } from './jobMachine.js';
import { existsSync } from 'node:fs';
import { hasStoredConsent, recordClientConsent } from '../clients/consent.js';
import { withUploadLock as withLock } from './uploadLocks.js';
import { finalizeGroup } from './groupFinalize.js';
import { createSessionAndJobForUpload } from './uploadSession.js';
import {
  getOwnedUploadRow, getUploadRow, latestJobRowForSession, jobRowForUpload, jobRowById, ownedJobRow, listJobRows, getJobByUpload,
  getOwnedJob, requeueFailedJobRow, markSessionBatchQueued, deleteProcessingFailedNotification, listIdleUploadIds,
  expireUploadingUpload, countUploadingUploads, countDeadGroupParts, findGroupPart, findSingleUploadByFingerprint, insertUpload,
  touchUpload, failUpload, markGroupPartComplete, cancelUploadByUser, listCancelableGroupPartIds, cancelGroupPart,
} from './uploads.repository.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FP_RE = /^[a-f0-9]{32,128}$/;

function sanitizeName(name: string): string {
  // فقط برایِ نمایش به خودِ تراپیست؛ هرگز در مسیرِ فایل استفاده نمی‌شود.
  return String(name || '').replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_').slice(0, 200) || 'audio';
}

async function getOwnedUpload(id: string, therapistId: string) {
  if (!UUID_RE.test(id)) return null;
  return getOwnedUploadRow(id, therapistId);
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
    // پلنِ B: فقط نامِ flagها (علتِ احتمالی) و هشدارِ کم‌اطمینان — سنجه‌هایِ عددی به UI نمی‌روند.
    quality_flags: parseAudioQuality(j.audio_quality)?.flags ?? [],
    quality_warning: j.quality_warning ?? null,
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
  if ((await requeueFailedJobRow(job.id, stage)) !== 1) return false;
  await markSessionBatchQueued(job.session_id);
  // اعلانِ شکستِ قبلی دیگر معتبر نیست؛ حذفش لازم است چون UNIQUE(job_id,kind) وگرنه اعلانِ شکستِ
  // احتمالیِ بعدی را (INSERT IGNORE) بی‌صدا نادیده می‌گرفت.
  await deleteProcessingFailedNotification(job.id);
  logEvent({ event: 'audio_job.retry', sessionId: job.session_id, therapistId, detail: { stage } });
  wakeAudioJobWorker();
  return true;
}

// آپلودِ نیمه‌کاره‌ای که این مدت هیچ تکه‌ای نگرفته رها شده حساب می‌شود — فقط وقتی سقفِ آپلودهایِ هم‌زمان پر
// است آزاد می‌شود (وگرنه تا ۷ روز برایِ ادامه می‌ماند). بدونِ این، کارتِ خطایی که بسته شد یا فایلی که رویِ
// گوشی دوباره انتخاب شد (اثرِ انگشتِ تازه) تراپیست را تا ۷ روز با 429 قفل می‌کرد و UIای برایِ لغو نبود.
const IDLE_UPLOAD_RELEASE_SECONDS = 24 * 60 * 60;

async function releaseIdleUploads(therapistId: string): Promise<void> {
  for (const id of await listIdleUploadIds(therapistId, IDLE_UPLOAD_RELEASE_SECONDS)) {
    if ((await expireUploadingUpload(id)) === 1) removeUploadDir(id);
  }
}

// تکه‌ها بایتِ خام‌اند — parser فقط در scopeِ encapsulatedِ آپلود ثبت می‌شود (app.ts: همان scope که اعلان‌ها هم
// پیش از جداشدن در آن بودند).
export function registerUploadChunkParser(app: FastifyInstance): void {
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: CHUNK_SIZE + 1024 }, (_req, body, done) => {
    done(null, body);
  });
}

export async function audioUploadRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

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
      if ((await countDeadGroupParts(therapistId, groupId, b.client_id, partsTotal)) > 0) {
        reply.code(409);
        return { error: 'این مجموعه‌ی فایل لغو یا رد شده است — دوباره انتخاب کنید', code: 'group-closed' };
      }
    }
    // ⭐ (A1.8، 2026-09-26) ثبتِ رضایت فقط بعد از گذشتنِ همه‌ی validationها — قبلاً درخواستی که بعداً رد می‌شد
    // (تاریخِ نامعتبر، گروهِ بسته) هم رضایت را ثبت می‌کرد.
    if (b.consent === true) await recordClientConsent(b.client_id, therapistId);

    if (grouped) {
      // ادامه‌ی همان بخش (بعد از رفرش/قطعی) — کلید: گروه + شماره‌ی بخش، نه fingerprint (یک فایل ممکن است دو بار انتخاب شود).
      const u = await findGroupPart(therapistId, groupId, partIndex);
      if (u) {
        if (u.fingerprint !== fingerprint) {
          reply.code(409);
          return { error: 'این بخش با فایلِ دیگری شروع شده بود', code: 'part-mismatch' };
        }
        if (u.status === 'uploading') return { upload: uploadView(u, receivedChunks(u.id, Number(u.size_bytes), u.chunk_size)), resumed: true };
        if (!u.session_id) {
          // ⭐ (A1.3، 2026-09-26) بخشِ رسیده بدونِ جلسه: اگر finalizeِ قبلی (مثلاً خطایِ DB بعد از complete) شکست
          // خورده بود، گروه برایِ همیشه «منتظرِ بخش‌هایِ دیگر» می‌ماند و بعد از ۷ روز حذف می‌شد. finalize idempotent
          // است (زیرِ قفلِ گروه + FOR UPDATE)؛ اینجا دوباره امتحان می‌شود.
          const g = await withLock('group:' + groupId, () => finalizeGroup(groupId!, therapistId));
          if (g.kind === 'rejected') { reply.code(g.status); return { error: g.error, code: g.code }; }
          if (g.kind === 'waiting') return { upload: uploadView(u), part_done: true, parts_received: g.received, parts_total: g.total };
          const gj = await latestJobRowForSession(g.sessionId);
          return { upload: { ...uploadView(u), session_id: g.sessionId }, duplicate: true, requeued: false, job: gj ? jobView(gj) : null };
        }
        const j = await latestJobRowForSession(u.session_id);
        return { upload: uploadView(u), duplicate: true, requeued: false, job: j ? jobView(j) : null };
      }
    }

    // ادامه/تکراری: همان فایل (fingerprint) برایِ همان مراجع (فقط آپلودهایِ تک‌فایلی)
    const prev = grouped ? undefined : await findSingleUploadByFingerprint(therapistId, b.client_id, fingerprint);
    if (prev) {
      const u = prev;
      if (u.status === 'uploading') {
        return { upload: uploadView(u, receivedChunks(u.id, Number(u.size_bytes), u.chunk_size)), resumed: true };
      }
      const pj = await getJobByUpload(u.id);
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
        const j = await jobRowForUpload(u.id);
        return { upload: uploadView(u), duplicate: true, requeued, job: j ? jobView(j) : null };
      }
    }

    const countActive = () => countUploadingUploads(therapistId);
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
    await insertUpload({
      id, therapistId, clientId: b.client_id, fingerprint, originalName: sanitizeName(b.file_name || ''),
      mime: String(b.mime || '').slice(0, 100) || null, size, chunkSize: CHUNK_SIZE, chunksTotal, sessionDate, groupId, partIndex, partsTotal,
    });
    ensureUploadDir(id);
    logEvent({ event: 'upload.created', therapistId, clientId: b.client_id, detail: { bytes: size, chunks: chunksTotal, ext, ...(grouped ? { seq: partIndex, count: partsTotal } : {}) } });
    const created = await getUploadRow(id);
    reply.code(201);
    return { upload: uploadView(created, []) };
  });

  app.get('/api/uploads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const u = await getOwnedUpload(id, request.therapistId!);
    if (!u) { reply.code(404); return { error: 'آپلود یافت نشد' }; }
    const received = u.status === 'uploading' ? receivedChunks(u.id, Number(u.size_bytes), u.chunk_size) : [];
    const j = u.status === 'complete' ? await jobRowForUpload(u.id) : undefined;
    return { upload: uploadView(u, received), job: j ? jobView(j) : null };
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
    await touchUpload(u.id);
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
        const j = await latestJobRowForSession(g.sessionId);
        if (g.kind === 'created') reply.code(201);
        return { upload: { ...up, session_id: g.sessionId }, job: j ? jobView(j) : null };
      });
      if (u.status === 'complete' && u.group_id) return groupReply(u);
      if (u.status === 'complete') {
        const j = await jobRowForUpload(u.id);
        return { upload: uploadView(u), job: j ? jobView(j) : null };
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
        await failUpload(u.id, code);
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
        if ((await markGroupPartComplete(u.id, probe.durationMs)) !== 1) {
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
      if ((await createSessionAndJobForUpload(u, therapistId, sessionId, jobId, now, probe, sourcePath)) === 'closed') {
        reply.code(409);
        return { error: 'این آپلود دیگر باز نیست', code: 'upload-closed' };
      }
      logEvent({ event: 'upload.completed', therapistId, clientId: u.client_id, sessionId, detail: { bytes: size, duration_ms: probe.durationMs } });
      logEvent({ event: 'session.created', sessionId, clientId: u.client_id, therapistId, detail: { mode: 'upload' } });
      wakeAudioJobWorker();
      const j = await jobRowById(jobId);
      reply.code(201);
      return { upload: { ...uploadView(u), status: 'complete', session_id: sessionId }, job: jobView(j) };
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
    await cancelUploadByUser(u.id);
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
      let n = 0;
      for (const partId of await listCancelableGroupPartIds(therapistId, groupId)) {
        if ((await cancelGroupPart(partId)) === 1) { removeUploadDir(partId); n++; }
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
    return { jobs: (await listJobRows(where, request.therapistId)).map(jobView) };
  });

  app.get('/api/audio-jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!UUID_RE.test(id)) { reply.code(404); return { error: 'یافت نشد' }; }
    const row = await ownedJobRow(id, request.therapistId);
    if (!row) { reply.code(404); return { error: 'یافت نشد' }; }
    return { job: jobView(row) };
  });

  app.post('/api/audio-jobs/:id/retry', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!UUID_RE.test(id)) { reply.code(404); return { error: 'یافت نشد' }; }
    const job = await getOwnedJob(id, request.therapistId);
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
    const v = await jobRowById(id);
    return { job: jobView(v) };
  });

  app.get('/api/sessions/:id/audio-job', async (request, reply) => {
    const { id } = request.params as { id: string };
    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) { reply.code(404); return { error: 'جلسه یافت نشد' }; }
    const r = await latestJobRowForSession(id);
    return { job: r ? jobView(r) : null };
  });
}
