// ماشینِ حالتِ jobِ پردازشِ صدایِ آپلودی — مستقل از DB/شبکه (فقط از طریقِ portها)، تا هارنس
// (scripts/upload-harness.ts) بتواند retry/ری‌استارت/تکرار/کهنگی را بدونِ MySQL و Soniox تست کند.
//
//   queued → normalizing → transcribing → case_file → done
//                 │              │             │
//                 └──────────────┴─────────────┴──→ failed (اعلانِ processing_failed)
//
// اصولِ طراحی:
//  - هر مرحله idempotent است: اجرای دوباره‌اش (بعد از کرش/ری‌استارت/lease منقضی) نتیجه‌ی تکراری نمی‌سازد.
//  - هر شناسه‌ی خارجی (فایل/transcriptionِ Soniox) *قبل* از قدمِ بعد در DB ذخیره می‌شود ⇒ بعد از
//    ری‌استارت همان transcription دنبال می‌شود، نه آپلودِ دوباره (و نه یتیم‌شدنِ صدا رویِ Soniox — F3).
//  - نوشتنِ متن یک تراکنش با علامتِ transcript_applied_at است ⇒ «سه retry ⇒ یک متن» (F1 برایِ این مسیر).
//  - خطایِ گذرا ⇒ backoff؛ خطایِ دائمی (فایلِ بی‌صدا/خراب/طولانی) ⇒ failed بلافاصله، بدونِ هدر دادنِ هزینه.
import type { ProbeResult, NormalizeResult } from './media.js';
import { MAX_DURATION_MS } from './media.js';

export type JobStage = 'queued' | 'normalizing' | 'transcribing' | 'case_file' | 'done' | 'failed';
export type CaseFileJobStatus = 'not_applicable' | 'skipped' | 'done' | 'failed' | 'busy_gave_up';
// 'disabled' در ستونِ case_file_status یعنی: مسیرِ آپلود عمداً به پرونده نمی‌رسد (uploadCaseFileAllowed=false).

// تصمیمِ مالک (2026-09-24): مسیرِ آپلود — برایِ مراجعِ فعال — با «ذخیره‌ی متن» تمام می‌شود؛
// UPLOAD_CASE_FILE=1 مرحله‌ی پرونده را برایِ همه روشن می‌کند.
export function uploadCaseFileEnabled(): boolean {
  return process.env.UPLOAD_CASE_FILE === '1';
}

// مراجعِ غیرفعال (پیاده‌سازی 2026-09-25): جلسه‌هایِ ضبط‌شده‌ی قبلی با آپلود به پرونده تبدیل می‌شوند — همان سیاستِ جلسه‌ی
// زنده/دستی (autoTrigger.ts): فیچرِ پرونده برایِ حساب (case_file_enabled) + «پرونده‌ی خودکار» روشن.
// ⭐ تصمیمِ مالک (همان روز، بعد از E2E): «فعلاً فقط متن ذخیره بشه» ⇒ پشتِ UPLOAD_CASE_FILE_INACTIVE=1، پیش‌فرض خاموش.
// خاموش ⇒ مسیر با ذخیره‌ی متن تمام می‌شود (disabled)؛ «به‌روزرسانی»ِ دستیِ پرونده متنِ آپلودی را هم می‌خواند.
export function uploadCaseFileInactiveEnabled(): boolean {
  return process.env.UPLOAD_CASE_FILE_INACTIVE === '1';
}
export interface UploadCaseFileContext {
  clientStatus: string | null;
  caseFileEnabled: boolean;
  autoGenerate: boolean | null;
}
export function uploadCaseFileAllowed(ctx: UploadCaseFileContext): boolean {
  if (uploadCaseFileEnabled()) return true;
  if (!uploadCaseFileInactiveEnabled()) return false;
  return ctx.clientStatus === 'inactive' && ctx.caseFileEnabled === true && ctx.autoGenerate === true;
}

export interface SourcePart { uploadId: string; path: string; }

export interface AudioJob {
  id: string;
  uploadId: string;
  therapistId: string;
  clientId: string;
  sessionId: string;
  stage: JobStage;
  attempts: number;
  sourcePath: string | null;
  // آپلودِ چندبخشی (migration 025): همه‌ی بخش‌ها به ترتیب؛ null برایِ آپلودِ تک‌فایلی.
  sourceParts: SourcePart[] | null;
  normalizedPath: string | null;
  durationMs: number | null;
  sonioxFileId: string | null;
  sonioxTranscriptionId: string | null;
  transcriptionStartedAt: Date | null;
  transcriptAppliedAt: Date | null;
  caseFileStatus: string | null;
  errorCode: string | null;
}

export type JobPatch = Partial<Omit<AudioJob, 'id'>> & { nextAttemptInMs?: number };

export interface JobStore {
  update(job: AudioJob, patch: JobPatch): Promise<void>;
  // تراکنش: قفلِ job ⇒ اگر قبلاً اعمال شده 'already' ⇒ append به متنِ جلسه ⇒ علامتِ اعمال + مرحله‌ی بعد + اعلان.
  // nextStage: 'case_file' (ادامه به پرونده) یا 'done' (پایانِ مسیر با ذخیره‌ی متن — پیش‌فرضِ فعلی).
  applyTranscriptOnce(job: AudioJob, text: string, nextStage: 'case_file' | 'done'): Promise<'applied' | 'already' | 'gone'>;
  fail(job: AudioJob, errorCode: string): Promise<void>;
  finish(job: AudioJob, caseFileStatus: CaseFileJobStatus): Promise<void>;
  setSessionDuration(sessionId: string, durationMs: number): Promise<void>;
}

export interface SonioxPort {
  uploadFile(filePath: string, filename: string): Promise<string>;
  createTranscription(fileId: string, clientReferenceId: string): Promise<string>;
  poll(transcriptionId: string): Promise<{ status: string; error_message?: string; notFound?: boolean }>;
  getText(transcriptionId: string): Promise<string>;
  deleteTranscription(id: string): Promise<void>;
  deleteFile(id: string): Promise<void>;
}

export interface MediaPort {
  probe(filePath: string): Promise<ProbeResult>;
  normalize(srcPath: string | string[], outBase: string, durationMs: number | null): Promise<NormalizeResult>;
}

export interface JobDeps {
  store: JobStore;
  soniox: SonioxPort;
  media: MediaPort;
  archive(sessionId: string, filePath: string, mime: string, runId: string): Promise<{ path: string; durationMs: number | null }>;
  // lastAttempt=false ⇒ خطایِ گذرایِ LLM به‌صورتِ 'transient' برمی‌گردد (بدونِ اعلانِ شکست) تا job دوباره تلاش کند.
  caseFile(clientId: string, therapistId: string, ctx: { jobId: string; sessionId: string; lastAttempt: boolean }): Promise<'not_applicable' | 'skipped' | 'generated' | 'busy' | 'failed' | 'transient'>;
  // آیا بعد از ثبتِ متن، مرحله‌ی پرونده اجرا شود؟ (uploadCaseFileAllowed — فعلاً پیش‌فرض خاموش؛ تصمیمِ مالک 2026-09-25)
  caseFileAfterUpload(job: AudioJob): boolean | Promise<boolean>;
  fileExists(p: string): boolean;
  // رفعِ L6 (audit 2026-09-24): سقفِ هزینه‌ی Soniox برایِ هر تراپیست. >0 یعنی «فعلاً صبر کن» (میلی‌ثانیه) — job هرگز
  // به‌خاطرِ سقف رد/failed نمی‌شود؛ صدا رویِ سرور می‌ماند و بعداً خودکار ادامه می‌یابد. نبودِ این port ⇒ بدونِ سقف.
  quotaWaitMs?(job: AudioJob): Promise<number>;
  normalizedOutBase(job: AudioJob): string;
  removeUploadDir(uploadId: string): void;
  now(): number;
  log(msg: string): void;
}

// خطایِ گذرا ⇒ تلاشِ دوباره با این فاصله‌ها؛ بعد از آخرین، failed.
export const BACKOFF_MS = [30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000, 60 * 60_000, 3 * 60 * 60_000];
export const MAX_ATTEMPTS = BACKOFF_MS.length;
export const CASE_FILE_BUSY_RETRY_MS = 2 * 60_000;
export const CASE_FILE_BUSY_MAX = 15; // ~۳۰ دقیقه منتظرِ تولیدِ هم‌زمانِ دیگر
// خطایِ گذرایِ LLM (قطعِ شبکه/timeout/429/5xx — مثلاً ECONNRESETِ OpenRouter در E2E 2026-09-25): تا ۳ تلاشِ دوباره با این فاصله‌ها،
// بعد شکستِ نهایی با اعلان. شمارنده همان attemptsِ مرحله‌ی پرونده است (مشترک با busy).
export const CASE_FILE_TRANSIENT_RETRY_MS = [60_000, 5 * 60_000, 15 * 60_000];

// مهلتِ یک transcription رویِ Soniox: ۳۰ دقیقه + طولِ خودِ صدا (Soniox معمولاً بسیار سریع‌تر است).
export function transcriptionDeadlineMs(durationMs: number | null): number {
  return 30 * 60_000 + Math.max(0, durationMs || 0);
}

export interface StepResult { continueNow: boolean; }
const CONTINUE: StepResult = { continueNow: true };
const WAIT: StepResult = { continueNow: false };

// ⭐ (2026-09-24) وقتی transcription رویِ Soniox ساخته شده و فقط poll/دریافتِ متن شکست خورده، تلاشِ دوباره
// تقریباً رایگان است (هیچ آپلود/رونویسیِ تازه‌ای نیست) — پس backoffِ فزاینده‌ی تا ۳ ساعت بی‌معناست و تراپیست را
// ده‌ها دقیقه منتظر می‌گذاشت در حالی که متن آماده بود (مشاهده‌شده در تستِ مالک پشتِ شبکه‌ی ناپایدار). برایِ این
// حالت: فاصله‌ی کوتاهِ ثابت و سقفِ تلاشِ بیشتر (~۳۰ دقیقه پوشش) قبل از failed.
export const CHEAP_RETRY_MS = 20_000;
export const CHEAP_MAX_ATTEMPTS = 90;

async function transient(job: AudioJob, deps: JobDeps, code: string, patch: JobPatch = {}, cause?: unknown, cheap = false): Promise<StepResult> {
  const attempts = job.attempts + 1;
  const max = cheap ? CHEAP_MAX_ATTEMPTS : MAX_ATTEMPTS;
  const why = cause ? ` (${String((cause as any)?.message || cause).slice(0, 160)})` : '';
  if (attempts > max) {
    await cleanupRemote(job, deps);
    await deps.store.fail(job, code);
    deps.log(`[audio-job] ${job.id} giving up after ${attempts - 1} attempts: ${code}${why}`);
    return WAIT;
  }
  const delay = cheap ? CHEAP_RETRY_MS : BACKOFF_MS[attempts - 1];
  await deps.store.update(job, { ...patch, attempts, errorCode: code, nextAttemptInMs: delay });
  deps.log(`[audio-job] ${job.id} transient ${code}, attempt ${attempts}/${max}, next in ${Math.round(delay / 1000)}s${why}`);
  return WAIT;
}

async function permanent(job: AudioJob, deps: JobDeps, code: string): Promise<StepResult> {
  await cleanupRemote(job, deps);
  await deps.store.fail(job, code);
  deps.log(`[audio-job] ${job.id} failed permanently: ${code}`);
  return WAIT;
}

// رفعِ M2: workerی که پشتِ‌سرِ‌هم به خطایِ غیرمنتظره (بیرون از مسیرهایِ گذرا/دائمیِ همین فایل) می‌خورد، job را
// با این تابع به failed می‌برد — تراپیست اعلان می‌گیرد و می‌تواند «تلاشِ دوباره» بزند، به‌جایِ «در حالِ تبدیل…»ِ ابدی.
export async function giveUpJob(job: AudioJob, deps: JobDeps, code: string): Promise<void> {
  await permanent(job, deps, code);
}

export async function cleanupRemote(job: AudioJob, deps: JobDeps): Promise<void> {
  const tid = job.sonioxTranscriptionId;
  const fid = job.sonioxFileId;
  if (tid) await deps.soniox.deleteTranscription(tid).catch(() => {});
  if (fid) await deps.soniox.deleteFile(fid).catch(() => {});
  if (tid || fid) {
    job.sonioxTranscriptionId = null;
    job.sonioxFileId = null;
    await deps.store.update(job, { sonioxTranscriptionId: null, sonioxFileId: null, transcriptionStartedAt: null });
  }
}

export async function stepJob(job: AudioJob, deps: JobDeps): Promise<StepResult> {
  switch (job.stage) {
    case 'queued':
      await deps.store.update(job, { stage: 'normalizing', nextAttemptInMs: 0 });
      return CONTINUE;
    case 'normalizing':
      return stepNormalize(job, deps);
    case 'transcribing':
      return stepTranscribe(job, deps);
    case 'case_file':
      return stepCaseFile(job, deps);
    default:
      return WAIT;
  }
}

async function stepNormalize(job: AudioJob, deps: JobDeps): Promise<StepResult> {
  // ری‌استارت بعد از نرمال‌سازیِ موفق ولی قبل از ثبتِ مرحله‌ی بعد: کارِ انجام‌شده را دوباره نکن.
  if (job.normalizedPath && deps.fileExists(job.normalizedPath)) {
    await deps.store.update(job, { stage: 'transcribing', attempts: 0, errorCode: null, nextAttemptInMs: 0 });
    return CONTINUE;
  }
  // چندبخشی: همه‌ی بخش‌ها به ترتیب؛ هر بخش جدا probe می‌شود و مدت‌ها جمع (سقفِ Soniox برایِ کلِ فایلِ نهایی است).
  const parts = job.sourceParts && job.sourceParts.length ? job.sourceParts : null;
  const sources = parts ? parts.map((p) => p.path) : job.sourcePath ? [job.sourcePath] : [];
  if (!sources.length || sources.some((p) => !deps.fileExists(p))) return permanent(job, deps, 'audio-missing');

  let totalMs: number | null = 0;
  for (const src of sources) {
    const probe = await deps.media.probe(src);
    if (!probe.ok) {
      if (probe.reason === 'no-ffmpeg') return transient(job, deps, 'no-ffmpeg');
      return permanent(job, deps, probe.reason === 'no-audio' ? 'no-audio' : 'unreadable');
    }
    totalMs = totalMs !== null && probe.durationMs !== null ? totalMs + probe.durationMs : null;
    if (probe.durationMs !== null && probe.durationMs > MAX_DURATION_MS) return permanent(job, deps, 'too-long');
  }
  if (totalMs !== null && totalMs > MAX_DURATION_MS) return permanent(job, deps, 'too-long');
  const probe = { durationMs: totalMs };

  const norm = await deps.media.normalize(parts ? sources : sources[0], deps.normalizedOutBase(job), probe.durationMs);
  if (!norm.ok || !norm.outPath || !norm.mime) {
    // فایلی که probe شد ولی تبدیل نمی‌شود: یکی‌دو بار دیگر و بعد شکست. ⭐ رفعِ M1 (audit 2026-09-24): کدِ نهایی
    // 'normalize-failed' است، نه 'unreadable' — علت ممکن است سمتِ سرور باشد (دیسکِ پر، timeout/killِ ffmpeg زیرِ بار)؛
    // فایل probe شده پس خواناست. 'unreadable' به تراپیست «فایل خراب است» می‌گفت و دکمه‌ی تلاشِ دوباره را پنهان می‌کرد.
    if (job.attempts + 1 >= 3) return permanent(job, deps, 'normalize-failed');
    return transient(job, deps, 'normalize-failed');
  }
  const archived = await deps.archive(job.sessionId, norm.outPath, norm.mime, 'upload-' + job.id.replace(/-/g, '').slice(0, 24));
  const durationMs = archived.durationMs ?? norm.durationMs ?? probe.durationMs;
  await deps.store.update(job, {
    stage: 'transcribing', normalizedPath: archived.path, durationMs, sourcePath: null, ...(parts ? { sourceParts: null } : {}),
    attempts: 0, errorCode: null, nextAttemptInMs: 0,
  });
  if (durationMs) await deps.store.setSessionDuration(job.sessionId, durationMs);
  // فایلِ خامِ اصلی دیگر لازم نیست — نسخه‌ی نرمال‌شده در آرشیوِ ۱۴روزه است (LAW-010).
  deps.removeUploadDir(job.uploadId);
  if (parts) for (const p of parts) if (p.uploadId !== job.uploadId) deps.removeUploadDir(p.uploadId);
  return CONTINUE;
}

async function stepTranscribe(job: AudioJob, deps: JobDeps): Promise<StepResult> {
  if (!job.normalizedPath || !deps.fileExists(job.normalizedPath)) return permanent(job, deps, 'audio-expired');

  // سقفِ روزانه فقط پیش از شروعِ هزینه (آپلود به Soniox) چک می‌شود؛ transcriptionِ در جریان هرگز متوقف نمی‌شود.
  if (!job.sonioxTranscriptionId && !job.sonioxFileId && deps.quotaWaitMs) {
    const wait = await deps.quotaWaitMs(job);
    if (wait > 0) {
      await deps.store.update(job, { errorCode: 'quota-wait', nextAttemptInMs: wait });
      deps.log(`[audio-job] ${job.id} quota-wait ${Math.round(wait / 60000)}min`);
      return WAIT;
    }
  }

  if (!job.sonioxTranscriptionId) {
    try {
      if (!job.sonioxFileId) {
        const fid = await deps.soniox.uploadFile(job.normalizedPath, `feelia-upload-${job.id}${job.normalizedPath.endsWith('.m4a') ? '.m4a' : '.ogg'}`);
        job.sonioxFileId = fid;
        await deps.store.update(job, { sonioxFileId: fid });
      }
      const tid = await deps.soniox.createTranscription(job.sonioxFileId!, `feelia:${job.sessionId}:upload:${job.id}`);
      job.sonioxTranscriptionId = tid;
      job.transcriptionStartedAt = new Date(deps.now());
      await deps.store.update(job, { sonioxTranscriptionId: tid, transcriptionStartedAt: job.transcriptionStartedAt, errorCode: null, nextAttemptInMs: 3_000 });
      return WAIT;
    } catch (e) {
      return transient(job, deps, 'soniox-unavailable', {}, e);
    }
  }

  let s: { status: string; error_message?: string; notFound?: boolean };
  try {
    s = await deps.soniox.poll(job.sonioxTranscriptionId);
  } catch (e) {
    // خطایِ گذرایِ poll — شناسه‌ها حفظ می‌شوند؛ بعداً همان transcription دنبال می‌شود (تلاشِ ارزان).
    return transient(job, deps, 'soniox-unavailable', {}, e, true);
  }

  if (s.status === 'queued' || s.status === 'processing') {
    const started = job.transcriptionStartedAt ? new Date(job.transcriptionStartedAt).getTime() : deps.now();
    if (deps.now() - started > transcriptionDeadlineMs(job.durationMs)) {
      await cleanupRemote(job, deps);
      return transient(job, deps, 'soniox-timeout');
    }
    const shortFile = (job.durationMs || 0) < 10 * 60_000;
    // خطایِ گذرایِ قبلی (مثلاً یک pollِ ناموفق) رفع شده ⇒ UI دیگر «در دسترس نیست» نشان ندهد.
    await deps.store.update(job, { nextAttemptInMs: shortFile ? 3_000 : 10_000, ...(job.errorCode ? { errorCode: null } : {}) });
    return WAIT;
  }

  if (s.status === 'error') {
    if (s.notFound) {
      // transcription رویِ Soniox نیست (پاک‌شده) — فقط شناسه را پاک کن و دوباره بساز.
      job.sonioxTranscriptionId = null;
      await deps.store.update(job, { sonioxTranscriptionId: null, transcriptionStartedAt: null });
      return transient(job, deps, 'soniox-lost');
    }
    if (/invalid audio/i.test(s.error_message || '')) return permanent(job, deps, 'unreadable');
    await cleanupRemote(job, deps);
    return transient(job, deps, 'soniox-error');
  }

  if (s.status !== 'completed') return transient(job, deps, 'soniox-unknown-status');

  let text: string;
  try {
    text = await deps.soniox.getText(job.sonioxTranscriptionId);
  } catch (e) {
    // متن رویِ Soniox آماده است؛ فقط دریافت شکست خورد ⇒ تلاشِ ارزانِ کوتاه‌مدت.
    return transient(job, deps, 'soniox-unavailable', {}, e, true);
  }
  const res = await deps.store.applyTranscriptOnce(job, text, (await deps.caseFileAfterUpload(job)) ? 'case_file' : 'done');
  deps.log(`[audio-job] ${job.id} transcript ${res} chars=${text.trim().length}`);
  // متن ذخیره شد (یا قبلاً شده بود) ⇒ صدا/متن رویِ Soniox دیگر لازم نیست (حریمِ خصوصی).
  await cleanupRemote(job, deps);
  if (res === 'gone') return WAIT; // جلسه/job حذف شده
  return CONTINUE;
}

async function stepCaseFile(job: AudioJob, deps: JobDeps): Promise<StepResult> {
  // UI از همین ستون «پرونده در حالِ به‌روزرسانی» را نشان می‌دهد (تولید چند دقیقه طول می‌کشد).
  await deps.store.update(job, { caseFileStatus: 'running' });
  const lastAttempt = job.attempts >= CASE_FILE_TRANSIENT_RETRY_MS.length;
  const outcome = await deps.caseFile(job.clientId, job.therapistId, { jobId: job.id, sessionId: job.sessionId, lastAttempt });
  if (outcome === 'transient' && !lastAttempt) {
    const delay = CASE_FILE_TRANSIENT_RETRY_MS[Math.min(job.attempts, CASE_FILE_TRANSIENT_RETRY_MS.length - 1)];
    await deps.store.update(job, { attempts: job.attempts + 1, nextAttemptInMs: delay, caseFileStatus: 'waiting', errorCode: 'case-file-retry' });
    deps.log(`[audio-job] ${job.id} case-file transient, retry in ${Math.round(delay / 1000)}s`);
    return WAIT;
  }
  if (outcome === 'busy') {
    const attempts = job.attempts + 1;
    if (attempts > CASE_FILE_BUSY_MAX) {
      await deps.store.finish(job, 'busy_gave_up');
      return WAIT;
    }
    await deps.store.update(job, { attempts, nextAttemptInMs: CASE_FILE_BUSY_RETRY_MS, caseFileStatus: 'waiting' });
    return WAIT;
  }
  const map: Record<string, CaseFileJobStatus> = {
    not_applicable: 'not_applicable', skipped: 'skipped', generated: 'done', failed: 'failed', transient: 'failed',
  };
  await deps.store.finish(job, map[outcome] || 'failed');
  return WAIT;
}
