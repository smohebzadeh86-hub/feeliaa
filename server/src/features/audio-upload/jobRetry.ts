// «تلاشِ دوباره» برایِ jobِ شکست‌خورده‌ی آپلودِ صدا — منطقِ مشترکِ routeِ تراپیست، تشخیصِ «تکراری» (uploads.routes) و
// routeِ ادمین. رفتار از uploads.routes.ts (قبلاً private) بدونِ تغییر منتقل شد.
import { existsSync } from 'node:fs';
import { logEvent } from '../../obs/eventLog.js';
import { wakeAudioJobWorker } from './worker.js';
import { parseSourceParts } from './jobStore.sql.js';
import { uploadCaseFileEnabled } from './jobMachine.js';
import {
  getOwnedJob, getJobById, jobRowById, requeueFailedJobRow, markSessionBatchQueued, deleteProcessingFailedNotification,
} from './uploads.repository.js';

// خطاهایی که تلاشِ دوباره رویِ همان صدا درستشان نمی‌کند (فایلِ مشکل‌دار یا صدایِ ازدست‌رفته).
const DEAD_JOB_CODES = ['unreadable', 'no-audio', 'too-long', 'audio-missing', 'audio-expired'];

export type Retryability = { ok: true; stage: string } | { ok: false; status: number; code: string; error: string };

// آیا jobِ شکست‌خورده بدونِ آپلودِ دوباره قابلِ ادامه است؟ (مشترک بینِ retry و تشخیصِ «تکراری»)
export function failedJobRetryability(job: any): Retryability {
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
export async function requeueFailedJob(job: any, stage: string, therapistId: string): Promise<boolean> {
  if ((await requeueFailedJobRow(job.id, stage)) !== 1) return false;
  await markSessionBatchQueued(job.session_id);
  // اعلانِ شکستِ قبلی دیگر معتبر نیست؛ حذفش لازم است چون UNIQUE(job_id,kind) وگرنه اعلانِ شکستِ
  // احتمالیِ بعدی را (INSERT IGNORE) بی‌صدا نادیده می‌گرفت.
  await deleteProcessingFailedNotification(job.id);
  logEvent({ event: 'audio_job.retry', sessionId: job.session_id, therapistId, detail: { stage } });
  wakeAudioJobWorker();
  return true;
}

export type RetryResult =
  | { ok: true; row: any; therapistId: string; sessionId: string }
  | { ok: false; status: number; code: string; error: string };

// scope.therapistId ⇒ فقط jobِ همان تراپیست (مالکیت، LAW-004)؛ بدونِ آن (ادمین) هر job. جدا از actorِ ادمین نیست؛
// ممیزی را caller (routeِ ادمین) ثبت می‌کند.
export async function retryFailedAudioJob(jobId: string, scope: { therapistId?: string } = {}): Promise<RetryResult> {
  const job = scope.therapistId ? await getOwnedJob(jobId, scope.therapistId) : await getJobById(jobId);
  if (!job) return { ok: false, status: 404, code: 'not-found', error: 'یافت نشد' };
  if (job.stage !== 'failed') {
    return { ok: false, status: 409, code: 'not-failed', error: 'این پردازش در حالِ انجام است یا تمام شده' };
  }
  // تلاشِ دوباره هرگز آپلودِ دوباره نمی‌خواهد تا وقتی صدا رویِ سرور هست (نسخه‌ی نرمال‌شده ۱۴ روز می‌ماند).
  const rt = failedJobRetryability(job);
  if (!rt.ok) return rt;
  await requeueFailedJob(job, rt.stage, scope.therapistId ?? job.therapist_id);
  return { ok: true, row: await jobRowById(jobId), therapistId: job.therapist_id, sessionId: job.session_id };
}
