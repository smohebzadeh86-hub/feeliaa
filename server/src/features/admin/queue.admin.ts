// ادمین: صفِ پردازشِ سراسری (آپلودِ صدا / متنِ نهایی / batch) — فقط متادیتا (LAW-001: بدونِ متن و نامِ فایلِ اصلی)
// + دو اقدامِ «تلاشِ دوباره» (با ممیزی). pluginِ فرزندِ adminRoutes (requireAdmin).
import { FastifyInstance } from 'fastify';
import { listAdminUploadJobs, countAdminUploadJobsByStage, retryFailedAudioJob } from '../audio-upload/index.js';
import { retryFinalTranscript } from '../final-transcript/index.js';
import { pendingAudiosFor } from '../transcription/index.js';
import { recordAudit } from '../../obs/audit.js';
import { listFinalTranscriptQueue, countFinalTranscriptsByStage, listBatchQueueSessions } from './admin.repository.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FT_STAGES = ['waiting_audio', 'transcribing', 'polishing', 'done', 'failed', 'skipped'];

export async function queueAdminRoutes(app: FastifyInstance) {
  // GET /api/admin/queue?therapist_id=&stage=
  app.get('/api/admin/queue', async (request) => {
    const q = request.query as { therapist_id?: string; stage?: string };
    const therapistId = q.therapist_id && UUID_RE.test(q.therapist_id) ? q.therapist_id : null;
    const stage = q.stage?.trim() || null;

    const [uploadJobs, uploadCounts, ftRows, ftCounts, batchRows] = await Promise.all([
      listAdminUploadJobs({ therapistId, stage }),
      countAdminUploadJobsByStage(),
      listFinalTranscriptQueue({ therapistId, stage: stage && FT_STAGES.includes(stage) ? stage : null }),
      countFinalTranscriptsByStage(),
      listBatchQueueSessions(therapistId),
    ]);

    const finalTranscripts = ftRows.map((r) => ({
      session_id: r.session_id, session_num: r.session_num, client_id: r.client_id, client_code: r.client_code,
      therapist_id: r.therapist_id, therapist_name: r.therapist_name,
      stage: r.stage, attempts: Number(r.attempts || 0), error_code: r.error_code ?? null,
      queued_at: r.queued_at, finished_at: r.finished_at, next_attempt_at: r.next_attempt_at,
    }));
    // شمارِ فایل‌هایِ منتظرِ صفِ batch از دیسک (همان الگویِ diagnosis)
    const batch = batchRows
      .filter((r) => !stage || r.batch_status === stage)
      .map((r) => ({
        session_id: r.id, session_num: r.session_num, client_id: r.client_id, client_code: r.client_code,
        therapist_id: r.therapist_id, therapist_name: r.therapist_name, batch_status: r.batch_status, updated_at: r.updated_at,
        pending_files: pendingAudiosFor(r.id, 'transcript').length + pendingAudiosFor(r.id, 'late-transcript').length + pendingAudiosFor(r.id, 'archive').length,
      }));
    const batchCounts: Record<string, number> = {};
    for (const r of batchRows) batchCounts[r.batch_status] = (batchCounts[r.batch_status] || 0) + 1;
    const ftCountMap: Record<string, number> = {};
    for (const r of ftCounts) ftCountMap[r.stage] = Number(r.n);

    return {
      upload_jobs: uploadJobs,
      final_transcripts: finalTranscripts,
      batch,
      counts: { upload: uploadCounts, final_transcript: ftCountMap, batch: batchCounts },
    };
  });

  // POST /api/admin/audio-jobs/:id/retry — همان منطقِ retryِ تراپیست (audio-upload/jobRetry.ts) بدونِ قیدِ مالکیت.
  app.post('/api/admin/audio-jobs/:id/retry', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!UUID_RE.test(id)) { reply.code(404); return { error: 'یافت نشد' }; }
    const res = await retryFailedAudioJob(id);
    if (!res.ok) {
      reply.code(res.status);
      return res.status === 404 ? { error: res.error } : { error: res.error, code: res.code };
    }
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.audio_job_retry', targetType: 'session', targetId: res.sessionId, detail: { job_id: id } });
    return { ok: true };
  });

  // POST /api/admin/sessions/:id/final-transcript/retry
  app.post('/api/admin/sessions/:id/final-transcript/retry', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!UUID_RE.test(id)) { reply.code(404); return { error: 'جلسه یافت نشد' }; }
    const res = await retryFinalTranscript(id);
    if (res === 'not-found') { reply.code(404); return { error: 'متنِ نهایی برایِ این جلسه یافت نشد', code: 'not-found' }; }
    if (res === 'busy') { reply.code(409); return { error: 'متنِ نهایی در حالِ آماده‌سازی است', code: 'busy' }; }
    if (res === 'fresh') { reply.code(409); return { error: 'متنِ نهایی به‌روز است', code: 'fresh' }; }
    await recordAudit({ actorId: request.therapistId, actorIsAdmin: true, action: 'admin.final_transcript_retry', targetType: 'session', targetId: id });
    return { ok: true };
  });
}
