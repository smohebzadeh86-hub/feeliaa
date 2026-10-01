// workerِ پس‌زمینه‌ی jobهایِ صدایِ آپلودی — داخلِ همان پروسه (LAW-013: runtime تک‌پروسه‌ای)، ولی
// تمامِ وضعیت در DB است:
//  - lease (locked_until) + heartbeat: jobی که پروسه‌اش وسطِ کار مرد، بعد از انقضایِ lease دوباره برداشته می‌شود.
//  - در startup همه‌ی leaseها آزاد می‌شوند (تنها پروسه‌ی زنده خودِ ماییم) ⇒ ادامه‌ی فوری بعد از ری‌استارت/deploy.
//  - هیچ مرحله‌ای به مرورگر وابسته نیست.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { query } from '../../db/connection.js';
import { beat } from '../../obs/heartbeat.js';
import {
  archiveAudioFileForAdmin, uploadFileFromPath, createTranscription, pollTranscriptionStatus, getTranscriptTokens, buildTextFromAsyncTokens, deleteTranscription, deleteFile, lowConfidenceRatio, markedTextFromTokens, lowConfidenceWarnRatio,
} from '../transcription/index.js';
import { treatmentUnits } from '../treatment-unit/index.js';
import { probeMedia, normalizeAudio } from './media.js';
import { measureAudioQuality } from './quality.js';
import { uploadDir, removeUploadDir } from './uploadStore.js';
import { stepJob, giveUpJob, uploadCaseFileEnabled, uploadCaseFileAllowed, type AudioJob, type JobDeps } from './jobMachine.js';
import { maybeAutoGenerateCaseFile } from '../case-file/index.js';
import { deleteSonioxRefs } from './sonioxRefs.js';
import { sqlJobStore, rowToJob } from './jobStore.sql.js';
import { quotaWaitMsForJob } from './quota.js';

const LEASE_SECONDS = 20 * 60;
const HEARTBEAT_MS = 60_000;
const TICK_MS = 3_000;
const CONCURRENCY = 2;

// وضعیتِ لحظه‌ی ثبتِ متن خوانده می‌شود (مراجعی که وسطِ پردازش فعال/غیرفعال شد، وضعیتِ فعلی‌اش ملاک است).
export async function uploadCaseFileAllowedForJob(job: AudioJob): Promise<boolean> {
  const r = await query(
    `SELECT c.status, t.case_file_enabled, t.case_file_auto_generate
       FROM clients c JOIN therapists t ON t.id = c.therapist_id
      WHERE c.id = ? AND c.therapist_id = ?`,
    [job.clientId, job.therapistId]
  );
  const row = r.rows[0];
  if (!row) return uploadCaseFileEnabled();
  return uploadCaseFileAllowed({
    clientStatus: row.status ?? null,
    caseFileEnabled: !!row.case_file_enabled,
    autoGenerate: row.case_file_auto_generate === null || row.case_file_auto_generate === undefined ? null : !!row.case_file_auto_generate,
  });
}

export function productionDeps(): JobDeps {
  return {
    store: sqlJobStore,
    soniox: {
      uploadFile: uploadFileFromPath,
      // (2026-09-27) contextِ مخصوصِ جلسه از واحدِ درمان. ref = feelia:<sessionId>:upload:<jobId> (jobMachine) —
      // پورتِ jobMachine دست نخورد. fail-open داخلِ sessionSttContext.
      createTranscription: async (fileId, ref) => {
        const sessionId = String(ref).split(':')[1] || '';
        const context = sessionId ? await treatmentUnits.sessionSttContext(sessionId) : undefined;
        return createTranscription(fileId, { clientReferenceId: ref, context });
      },
      poll: pollTranscriptionStatus,
      // متنِ خام + سهمِ کم‌اطمینان + نسخه‌ی علامت‌خورده برایِ «متنِ نهایی». signها عمداً داده نمی‌شوند: offset_msِ
      // علامت نسبت به صدایِ جلسه‌ی زنده است، نه فایلِ آپلودی، و علائمِ جلسه‌ی زنده از قبل در بخشِ زنده‌ی متن هستند.
      getText: async (id) => {
        const tokens = await getTranscriptTokens(id);
        return { text: buildTextFromAsyncTokens(tokens), lowConfRatio: lowConfidenceRatio(tokens), markedText: markedTextFromTokens(tokens) };
      },
      deleteTranscription,
      deleteFile,
    },
    media: { probe: probeMedia, normalize: normalizeAudio, quality: measureAudioQuality },
    lowConfWarnRatio: lowConfidenceWarnRatio(),
    archive: (sessionId, filePath, mime, runId) => archiveAudioFileForAdmin(sessionId, filePath, mime, runId),
    caseFile: (clientId, therapistId, ctx) => maybeAutoGenerateCaseFile(clientId, therapistId, {
      notify: { jobId: ctx.jobId, sessionId: ctx.sessionId }, retryTransient: !ctx.lastAttempt,
    }),
    caseFileAfterUpload: uploadCaseFileAllowedForJob,
    fileExists: (p) => existsSync(p),
    quotaWaitMs: quotaWaitMsForJob,
    normalizedOutBase: (job) => path.join(uploadDir(job.uploadId), 'normalized'),
    removeUploadDir,
    now: () => Date.now(),
    log: (m) => console.log(m),
  };
}

// ————————————————————————— worker —————————————————————————
const running = new Set<string>();
let ticking = false;
let timer: ReturnType<typeof setInterval> | null = null;
let deps: JobDeps | null = null;

async function claim(jobId: string): Promise<boolean> {
  const r = await query(
    `UPDATE audio_jobs SET locked_until = (NOW() + INTERVAL ? SECOND)
     WHERE id = ? AND stage IN ('queued','normalizing','transcribing','case_file')
       AND (locked_until IS NULL OR locked_until < NOW())`,
    [LEASE_SECONDS, jobId]
  );
  return r.rowCount === 1;
}

// ⭐ رفعِ M2 (audit 2026-09-24): خطایِ غیرمنتظره (exception بیرون از مسیرهایِ گذرا/دائمیِ jobMachine — مثلاً
// rename/ENOSPC در آرشیو، خطایِ DB) قبلاً فقط ۶۰ثانیه عقب می‌افتاد و attempts نمی‌شمرد ⇒ تکرارِ ابدی، بدونِ failed و
// بدونِ اعلان. حالا شمارشِ پشتِ‌سرِ‌هم (درون‌حافظه‌ای؛ ری‌استارت صفرش می‌کند — عمداً، شاید خطا از خودِ پروسه بوده)
// با فاصله‌ی فزاینده، و بعد از سقف ⇒ failed با 'internal-error' (قابلِ «تلاشِ دوباره» از UI).
const UNEXPECTED_MAX = 5;
const unexpectedErrors = new Map<string, number>();

async function runJob(jobId: string): Promise<void> {
  running.add(jobId);
  const hb = setInterval(() => {
    query('UPDATE audio_jobs SET locked_until = (NOW() + INTERVAL ? SECOND) WHERE id = ?', [LEASE_SECONDS, jobId]).catch(() => {});
  }, HEARTBEAT_MS);
  let lastJob: AudioJob | null = null;
  try {
    for (let i = 0; i < 12; i++) {
      const r = await query('SELECT * FROM audio_jobs WHERE id = ?', [jobId]);
      if (!r.rows[0]) break; // حذف‌شده (cascade) — پاک‌سازیِ Soniox پایین‌تر
      const job = rowToJob(r.rows[0]);
      lastJob = job;
      const res = await stepJob(job, deps!);
      if (!res.continueNow) break;
    }
    unexpectedErrors.delete(jobId);
  } catch (e) {
    const n = (unexpectedErrors.get(jobId) || 0) + 1;
    console.log(`[audio-job] unexpected error ${jobId} (${n}/${UNEXPECTED_MAX})`, String(e).slice(0, 200));
    if (n >= UNEXPECTED_MAX) {
      unexpectedErrors.delete(jobId);
      try {
        const r = await query('SELECT * FROM audio_jobs WHERE id = ?', [jobId]);
        if (r.rows[0]) await giveUpJob(rowToJob(r.rows[0]), deps!, 'internal-error');
      } catch (e2) {
        console.log('[audio-job] give-up failed', jobId, String(e2).slice(0, 160));
        await query('UPDATE audio_jobs SET next_attempt_at = (NOW() + INTERVAL 10 MINUTE) WHERE id = ?', [jobId]).catch(() => {});
      }
    } else {
      unexpectedErrors.set(jobId, n);
      await query('UPDATE audio_jobs SET next_attempt_at = (NOW() + INTERVAL ? SECOND) WHERE id = ?', [60 * n, jobId]).catch(() => {});
    }
  } finally {
    // ⭐ رفعِ M3: جلسه/مراجع وسطِ کارِ همین job حذف شد (ردیفِ job با cascade رفت) ⇒ فایل/transcriptionی که همین اجرا
    // رویِ Soniox ساخته بود یتیم نماند (صدایِ بالینی). jobهایِ منتظر (بدونِ اجرا) را releaseUploadSonioxForSessions
    // پیش از DELETE پاک می‌کند.
    if (lastJob && (lastJob.sonioxFileId || lastJob.sonioxTranscriptionId)) {
      try {
        const still = await query('SELECT 1 AS x FROM audio_jobs WHERE id = ?', [jobId]);
        if (!still.rows[0]) await deleteSonioxRefs([{ fileId: lastJob.sonioxFileId, transcriptionId: lastJob.sonioxTranscriptionId }]);
      } catch {}
    }
    clearInterval(hb);
    await query('UPDATE audio_jobs SET locked_until = NULL WHERE id = ?', [jobId]).catch(() => {});
    running.delete(jobId);
  }
}

async function tick(): Promise<void> {
  if (ticking || !deps) return;
  ticking = true;
  try {
    beat('audio-upload-worker', TICK_MS);
    const free = CONCURRENCY - running.size;
    if (free <= 0) return;
    const due = await query(
      `SELECT id FROM audio_jobs
       WHERE stage IN ('queued','normalizing','transcribing','case_file') AND next_attempt_at <= NOW()
         AND (locked_until IS NULL OR locked_until < NOW())
       ORDER BY next_attempt_at ASC LIMIT ?`,
      [free + running.size]
    );
    for (const row of due.rows) {
      if (running.size >= CONCURRENCY) break;
      if (running.has(row.id)) continue;
      if (await claim(row.id)) void runJob(row.id);
    }
  } catch (e) {
    console.log('[audio-job] tick failed:', String(e).slice(0, 160));
  } finally {
    ticking = false;
  }
}

export async function startAudioJobWorker(customDeps?: JobDeps): Promise<void> {
  deps = customDeps || productionDeps();
  // تنها پروسه‌ی زنده خودِ ماییم (LAW-013) ⇒ leaseهایِ باقی‌مانده از پروسه‌ی قبلی بی‌صاحب‌اند.
  await query('UPDATE audio_jobs SET locked_until = NULL WHERE locked_until IS NOT NULL').catch(() => {});
  // سیاستِ «تلاشِ ارزان» (jobMachine.CHEAP_RETRY_MS): jobی که transcriptionش رویِ Soniox ساخته شده فقط منتظرِ
  // poll/دریافتِ متن است — انتظارِ طولانی‌تر از backoffِ قدیم برایش معنا ندارد؛ بعد از ری‌استارت فوراً ادامه یابد.
  await query(
    `UPDATE audio_jobs SET next_attempt_at = LEAST(next_attempt_at, NOW() + INTERVAL 20 SECOND)
     WHERE stage = 'transcribing' AND soniox_transcription_id IS NOT NULL`
  ).catch(() => {});
  if (timer) clearInterval(timer);
  timer = setInterval(() => { void tick(); }, TICK_MS);
  void tick();
}

export function wakeAudioJobWorker(): void {
  setImmediate(() => { void tick(); });
}
