// workerِ پس‌زمینه‌ی jobهایِ صدایِ آپلودی — داخلِ همان پروسه (LAW-013: runtime تک‌پروسه‌ای)، ولی
// تمامِ وضعیت در DB است:
//  - lease (locked_until) + heartbeat: jobی که پروسه‌اش وسطِ کار مرد، بعد از انقضایِ lease دوباره برداشته می‌شود.
//  - در startup همه‌ی leaseها آزاد می‌شوند (تنها پروسه‌ی زنده خودِ ماییم) ⇒ ادامه‌ی فوری بعد از ری‌استارت/deploy.
//  - هیچ مرحله‌ای به مرورگر وابسته نیست.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { query, pool } from '../../db/connection.js';
import { logEvent } from '../../obs/eventLog.js';
import { createNotification } from '../notifications/notify.js';
import { archiveAudioFileForAdmin } from '../../stt/sessionAudioArchive.js';
import { treatmentUnits } from '../treatment-unit/index.js';
import {
  uploadFileFromPath, createTranscription, pollTranscriptionStatus, getTranscriptTokens,
  buildTextFromAsyncTokens, deleteTranscription, deleteFile, listSonioxFiles, listSonioxTranscriptions,
  lowConfidenceRatio, markedTextFromTokens, lowConfidenceWarnRatio,
} from '../../stt/asyncTranscribe.js';
import { probeMedia, normalizeAudio } from './media.js';
import { measureAudioQuality, parseAudioQuality } from './quality.js';
import { uploadDir, removeUploadDir } from './uploadStore.js';
import { stepJob, giveUpJob, uploadCaseFileEnabled, uploadCaseFileAllowed, type AudioJob, type JobDeps, type JobPatch, type JobStore, type CaseFileJobStatus, type SourcePart } from './jobMachine.js';
import { maybeAutoGenerateCaseFile } from '../case-file/application/autoTrigger.js';
import { enqueueFinalTranscript, appendUploadForPolish } from '../final-transcript/index.js';

export const UPLOAD_TRANSCRIPT_LABEL_PREFIX = '[متنِ فایلِ صوتیِ آپلودشده]';
const LEASE_SECONDS = 20 * 60;
const HEARTBEAT_MS = 60_000;
const TICK_MS = 3_000;
const CONCURRENCY = 2;

// audio_jobs.source_parts (migration 025): JSONِ [{uploadId, path}] به ترتیبِ بخش‌ها؛ نامعتبر/خالی ⇒ null (تک‌فایلی).
export function parseSourceParts(raw: unknown): SourcePart[] | null {
  if (!raw) return null;
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(v) || !v.length) return null;
    return v.filter((p) => p && typeof p.uploadId === 'string' && typeof p.path === 'string')
      .map((p) => ({ uploadId: p.uploadId, path: p.path }));
  } catch {
    return null;
  }
}

function rowToJob(r: any): AudioJob {
  return {
    id: r.id, uploadId: r.upload_id, therapistId: r.therapist_id, clientId: r.client_id, sessionId: r.session_id,
    stage: r.stage, attempts: Number(r.attempts || 0), sourcePath: r.source_path, sourceParts: parseSourceParts(r.source_parts),
    normalizedPath: r.normalized_path,
    durationMs: r.duration_ms ?? null, sonioxFileId: r.soniox_file_id, sonioxTranscriptionId: r.soniox_transcription_id,
    transcriptionStartedAt: r.transcription_started_at ? new Date(r.transcription_started_at) : null,
    transcriptAppliedAt: r.transcript_applied_at ? new Date(r.transcript_applied_at) : null,
    caseFileStatus: r.case_file_status, errorCode: r.error_code,
    audioQuality: parseAudioQuality(r.audio_quality),
  };
}

const COLS: Record<string, string> = {
  stage: 'stage', attempts: 'attempts', sourcePath: 'source_path', normalizedPath: 'normalized_path',
  durationMs: 'duration_ms', sonioxFileId: 'soniox_file_id', sonioxTranscriptionId: 'soniox_transcription_id',
  transcriptionStartedAt: 'transcription_started_at', caseFileStatus: 'case_file_status', errorCode: 'error_code',
  sourceParts: 'source_parts', audioQuality: 'audio_quality',
};
const JSON_COLS = new Set(['sourceParts', 'audioQuality']);

export const sqlJobStore: JobStore = {
  async update(job: AudioJob, patch: JobPatch) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, col] of Object.entries(COLS)) {
      if ((patch as any)[k] !== undefined) {
        sets.push(`${col} = ?`);
        const v = (patch as any)[k];
        vals.push(JSON_COLS.has(k) && v !== null ? JSON.stringify(v) : v);
        (job as any)[k] = (patch as any)[k];
      }
    }
    if (patch.nextAttemptInMs !== undefined) {
      sets.push('next_attempt_at = (NOW() + INTERVAL ? SECOND)');
      vals.push(Math.ceil(patch.nextAttemptInMs / 1000));
    }
    if (!sets.length) return;
    vals.push(job.id);
    await query(`UPDATE audio_jobs SET ${sets.join(', ')} WHERE id = ?`, vals);
    if (patch.stage) logEvent({ event: 'audio_job.stage', sessionId: job.sessionId, therapistId: job.therapistId, source: 'job', detail: { stage: patch.stage } });
    // فقط نامِ flagها (بدونِ صدا/متن) برایِ رصدِ آستانه‌ها با دادهٔ واقعی
    if (patch.audioQuality && patch.audioQuality.flags.length) {
      logEvent({ event: 'audio_job.quality_flags', sessionId: job.sessionId, therapistId: job.therapistId, source: 'job', detail: { reason: patch.audioQuality.flags.join(',') } });
    }
  },

  async applyTranscriptOnce(job: AudioJob, rawText: string, nextStage: 'case_file' | 'done', meta) {
    const text = (rawText || '').trim();
    const warning = text ? meta?.qualityWarning ?? null : null;
    const lowConf = meta?.lowConfRatio ?? null;
    let polishInput: string | null = null;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [jr] = await conn.query('SELECT transcript_applied_at FROM audio_jobs WHERE id = ? FOR UPDATE', [job.id]);
      const jrow = (jr as any[])[0];
      if (!jrow) { await conn.commit(); return 'gone'; }
      if (jrow.transcript_applied_at) { await conn.commit(); return 'already'; }
      const [sr] = await conn.query('SELECT transcript FROM sessions WHERE id = ? FOR UPDATE', [job.sessionId]);
      const srow = (sr as any[])[0];
      if (!srow) { await conn.commit(); return 'gone'; }
      if (text) {
        // LAW-008: متنِ موجود هرگز جایگزین نمی‌شود — فقط append (جلسه‌ی upload معمولاً خالی است).
        const cur: string = srow.transcript ?? '';
        const merged = cur.trim() ? cur + '\n\n' + UPLOAD_TRANSCRIPT_LABEL_PREFIX + '\n' + text : text;
        // ورودیِ «متنِ نهایی»: متنِ علامت‌خورده (⟦…؟⟧ فقط اینجا، نه در sessions.transcript). اگر جلسه از قبل متن داشت،
        // کلِ متن مرتب می‌شود (قبلاً فقط بخشِ آپلودی می‌رفت و متنِ نهایی بخشِ قبلی را پنهان می‌کرد) با شماره‌ی
        // گوینده‌هایِ جدا برایِ بخشِ آپلودی (دو diarizationِ مستقل‌اند — «گوینده ۱» یِ این دو یک نفر نیست).
        const forPolish = (meta?.markedText || '').trim() || text;
        polishInput = cur.trim() ? appendUploadForPolish(cur, UPLOAD_TRANSCRIPT_LABEL_PREFIX, forPolish) : forPolish;
        await conn.query(
          `UPDATE sessions SET transcript = ?, transcript_version = transcript_version + 1, stt_mode = 'upload',
             batch_status = 'done', realtime_reliable = false, updated_at = NOW() WHERE id = ?`,
          [merged, job.sessionId]
        );
        if (nextStage === 'case_file') {
          await conn.query(
            `UPDATE audio_jobs SET transcript_applied_at = NOW(), transcript_chars = ?, stage = 'case_file', attempts = 0,
               error_code = NULL, next_attempt_at = NOW(), quality_warning = ?, low_conf_ratio = ? WHERE id = ?`,
            [text.length, warning, lowConf, job.id]
          );
        } else {
          // پایانِ مسیر با ذخیره‌ی متن (تصمیمِ مالک 2026-09-24) — پرونده عمداً ساخته نمی‌شود.
          await conn.query(
            `UPDATE audio_jobs SET transcript_applied_at = NOW(), transcript_chars = ?, stage = 'done', finished_at = NOW(),
               case_file_status = 'disabled', attempts = 0, error_code = NULL, quality_warning = ?, low_conf_ratio = ? WHERE id = ?`,
            [text.length, warning, lowConf, job.id]
          );
        }
        // پلنِ B بخشِ ۳: متن در هر حال ذخیره شد؛ فقط نوعِ اعلان صادقانه‌تر است.
        await createNotification({ therapistId: job.therapistId, kind: warning ? 'transcript_low_quality' : 'transcript_ready', clientId: job.clientId, sessionId: job.sessionId, jobId: job.id }, conn);
      } else {
        // سکوت/بدونِ گفتار: متنی ثبت نمی‌شود؛ job تمام می‌شود و تراپیست صادقانه مطلع می‌شود.
        await conn.query(
          `UPDATE sessions SET stt_mode = 'upload', batch_status = 'done', updated_at = NOW() WHERE id = ?`, [job.sessionId]);
        await conn.query(
          `UPDATE audio_jobs SET transcript_applied_at = NOW(), transcript_chars = 0, stage = 'done', finished_at = NOW(),
             case_file_status = 'not_applicable', error_code = NULL WHERE id = ?`, [job.id]);
        await createNotification({ therapistId: job.therapistId, kind: 'transcript_empty', clientId: job.clientId, sessionId: job.sessionId, jobId: job.id }, conn);
      }
      await conn.commit();
      if (warning) logEvent({ event: 'audio_job.low_confidence', sessionId: job.sessionId, therapistId: job.therapistId, source: 'job', severity: 'warn', detail: { reason: warning } });
      // «متنِ نهایی»: همین متنِ async (کلِ فایل) مبناست ⇒ بدونِ رونویسیِ دوباره مستقیم به مرتب‌سازی (اگر روشن باشد).
      if (polishInput) void enqueueFinalTranscript(job.sessionId, { asyncText: polishInput });
      job.transcriptAppliedAt = new Date();
      job.stage = text && nextStage === 'case_file' ? 'case_file' : 'done';
      job.attempts = 0;
      return 'applied';
    } catch (e) {
      try { await conn.rollback(); } catch {}
      throw e;
    } finally {
      conn.release();
    }
  },

  async fail(job: AudioJob, errorCode: string) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query(
        `UPDATE audio_jobs SET stage = 'failed', error_code = ?, finished_at = NOW(), locked_until = NULL WHERE id = ?`, [errorCode, job.id]);
      if ((r as any).affectedRows) {
        await createNotification({ therapistId: job.therapistId, kind: 'processing_failed', clientId: job.clientId, sessionId: job.sessionId, jobId: job.id, errorCode }, conn);
        // ⭐ (A5، 2026-09-26) شکست بعد از اعمالِ متن (مرحله‌ی پرونده) رونویسی را «ناموفق» نمی‌کند — متن ذخیره شده است.
        await conn.query(
          `UPDATE sessions SET batch_status = 'failed', updated_at = NOW()
            WHERE id = ? AND NOT EXISTS (SELECT 1 FROM audio_jobs j WHERE j.id = ? AND j.transcript_applied_at IS NOT NULL)`,
          [job.sessionId, job.id]);
      }
      await conn.commit();
    } catch (e) {
      try { await conn.rollback(); } catch {}
      throw e;
    } finally {
      conn.release();
    }
    job.stage = 'failed';
    job.errorCode = errorCode;
    logEvent({ event: 'audio_job.failed', sessionId: job.sessionId, therapistId: job.therapistId, source: 'job', severity: 'warn', code: errorCode });
  },

  async finish(job: AudioJob, caseFileStatus: CaseFileJobStatus) {
    await query(
      `UPDATE audio_jobs SET stage = 'done', case_file_status = ?, finished_at = NOW(), error_code = NULL WHERE id = ?`,
      [caseFileStatus, job.id]
    );
    // ⭐ (A5، 2026-09-26) retryِ jobِ شکست‌خورده batch_status را 'queued' می‌کند (requeueFailedJob)؛ قبلاً finish آن را
    // برنمی‌گرداند و جلسه با متنِ کامل برایِ همیشه «در صف» دیده می‌شد.
    await query(
      `UPDATE sessions SET batch_status = 'done', updated_at = NOW() WHERE id = ? AND batch_status IN ('queued','processing','failed')`,
      [job.sessionId]
    );
    job.stage = 'done';
    job.caseFileStatus = caseFileStatus;
    logEvent({ event: 'audio_job.done', sessionId: job.sessionId, therapistId: job.therapistId, source: 'job', detail: { case_file: caseFileStatus } });
  },

  async setSessionDuration(sessionId: string, durationMs: number) {
    await query('UPDATE sessions SET duration_ms = ? WHERE id = ?', [Math.round(durationMs), sessionId]);
  },
};

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

// ————— رفعِ L6: سقفِ روزانه‌ی رونویسی برایِ هر تراپیست (هزینه‌ی Soniox) —————
// مجموعِ مدتِ صدایِ jobهایی از همان تراپیست که در ۲۴ ساعتِ گذشته متنشان ثبت شده یا الان رویِ Soniox در حالِ رونویسی‌اند.
// اگر این job سقف را رد کند ⇒ ۳۰ دقیقه بعد دوباره چک می‌شود (صف، نه رد — هیچ داده‌ای از دست نمی‌رود؛ صدا ۱۴ روز می‌ماند).
// اولین job همیشه اجرا می‌شود (فایلِ بلندتر از سقف هرگز برایِ همیشه گیر نمی‌کند). UPLOAD_DAILY_AUDIO_MINUTES=0 ⇒ بدونِ سقف.
export const QUOTA_RECHECK_MS = 30 * 60_000;
export function uploadDailyAudioMinutes(): number {
  const raw = process.env.UPLOAD_DAILY_AUDIO_MINUTES;
  const n = raw === undefined || raw === '' ? 600 : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function quotaWaitMsForJob(job: AudioJob): Promise<number> {
  const capMin = uploadDailyAudioMinutes();
  if (!capMin) return 0;
  const r = await query(
    `SELECT COALESCE(SUM(duration_ms), 0) AS used FROM audio_jobs
     WHERE therapist_id = ? AND id <> ?
       AND (transcript_applied_at > (NOW() - INTERVAL 1 DAY)
            OR (stage = 'transcribing' AND (soniox_file_id IS NOT NULL OR soniox_transcription_id IS NOT NULL)))`,
    [job.therapistId, job.id]
  );
  const usedMs = Number(r.rows[0]?.used || 0);
  if (usedMs <= 0) return 0;
  return usedMs + (job.durationMs || 0) > capMin * 60_000 ? QUOTA_RECHECK_MS : 0;
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

// ————— رفعِ M3: حذفِ جلسه/مراجع/تراپیست وسطِ پردازش ⇒ پاک‌سازیِ منابعِ Soniox —————
// cascadeِ DB ردیفِ job (و شناسه‌هایِ Soniox) را پاک می‌کند؛ بدونِ این، صدا/متنِ بالینی رویِ Soniox می‌ماند و
// فقط sweepSonioxOrphans (وابسته به SONIOX_ORPHAN_SWEEP=1) آن را برمی‌داشت. استفاده در هر ۴ مسیرِ حذف:
//   const refs = await collectUploadSonioxRefs(sessionIds);  ← پیش از DELETE
//   releaseSonioxRefs(refs);                                  ← بعد از DELETEِ موفق
export interface SonioxRef { fileId: string | null; transcriptionId: string | null; }

export async function collectUploadSonioxRefs(sessionIds: string[]): Promise<SonioxRef[]> {
  if (!sessionIds.length) return [];
  try {
    const out: SonioxRef[] = [];
    for (let i = 0; i < sessionIds.length; i += 500) {
      const part = sessionIds.slice(i, i + 500);
      const r = await query(
        `SELECT soniox_file_id, soniox_transcription_id FROM audio_jobs
         WHERE session_id IN (${part.map(() => '?').join(',')})
           AND (soniox_file_id IS NOT NULL OR soniox_transcription_id IS NOT NULL)`,
        part
      );
      for (const row of r.rows) out.push({ fileId: row.soniox_file_id, transcriptionId: row.soniox_transcription_id });
      // «متنِ نهایی» (migration 031) هم فایل/transcriptionِ کلِ صدایِ جلسه رویِ Soniox دارد
      const f = await query(
        `SELECT soniox_file_id, soniox_transcription_id FROM final_transcripts
         WHERE session_id IN (${part.map(() => '?').join(',')})
           AND (soniox_file_id IS NOT NULL OR soniox_transcription_id IS NOT NULL)`,
        part
      );
      for (const row of f.rows) out.push({ fileId: row.soniox_file_id, transcriptionId: row.soniox_transcription_id });
    }
    return out;
  } catch (e) {
    console.log('[audio-job] collect soniox refs failed:', String(e).slice(0, 160));
    return [];
  }
}

async function deleteSonioxRefs(refs: SonioxRef[]): Promise<void> {
  for (const ref of refs) {
    if (ref.transcriptionId) await deleteTranscription(ref.transcriptionId).catch(() => {});
    if (ref.fileId) await deleteFile(ref.fileId).catch(() => {});
  }
}

export function releaseSonioxRefs(refs: SonioxRef[]): void {
  if (refs.length) void deleteSonioxRefs(refs);
}

// ————— رفعِ F3: پاک‌سازیِ فایل/transcriptionِ یتیمِ Feelia رویِ Soniox —————
// فقط منابعی که قطعاً مالِ Feelia‌اند (نامِ فایلِ feelia-* یا نامِ UUIDِ قدیمیِ صفِ batch؛
// client_reference_idِ feelia:*) و قدیمی‌تر از ۲۴ ساعت‌اند و هیچ jobِ زنده‌ای به آن‌ها ارجاع نمی‌دهد.
// ۲۴ ساعت > بیشترین عمرِ ممکنِ یک jobِ زنده (مجموعِ backoffها ~۵ ساعت + مهلتِ هر transcription).
//
// ⚠ فقط با SONIOX_ORPHAN_SWEEP=1 فعال است: کلیدِ Soniox بینِ dev و production مشترک است و DBِ
// dev از jobهایِ زنده‌ی production خبر ندارد — سرورِ dev نباید هرگز منابعِ production را پاک کند.
// رویِ production این متغیر باید ست شود (configuration-catalog).
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;
const LEGACY_NAME_RE = /^[0-9a-f-]{36}(-note|-resolve)?\.webm$/i;

export async function sweepSonioxOrphans(): Promise<void> {
  if (!process.env.SONIOX_API_KEY || process.env.SONIOX_ORPHAN_SWEEP !== '1') return;
  try {
    // ⭐ (A4، 2026-09-26) فقط jobهایِ هنوز در جریان منابعشان را «زنده» نگه می‌دارند؛ قبلاً jobِ done/failed که
    // حذفِ منبعش شکست خورده بود شناسه را نگه می‌داشت و همان شناسه منبع را برایِ همیشه از sweep مصون می‌کرد.
    const refs = await query(`SELECT soniox_file_id, soniox_transcription_id FROM audio_jobs
      WHERE stage NOT IN ('done','failed') AND (soniox_file_id IS NOT NULL OR soniox_transcription_id IS NOT NULL)
      UNION ALL
      SELECT soniox_file_id, soniox_transcription_id FROM final_transcripts
      WHERE stage IN ('waiting_audio','transcribing','polishing') AND (soniox_file_id IS NOT NULL OR soniox_transcription_id IS NOT NULL)`);
    const liveFiles = new Set(refs.rows.map((r: any) => r.soniox_file_id).filter(Boolean));
    const liveTr = new Set(refs.rows.map((r: any) => r.soniox_transcription_id).filter(Boolean));
    const cutoff = Date.now() - ORPHAN_AGE_MS;
    let removedT = 0;
    let removedF = 0;
    for (const t of await listSonioxTranscriptions()) {
      if (liveTr.has(t.id)) continue;
      if (!String(t.client_reference_id || '').startsWith('feelia:')) continue;
      if (new Date(t.created_at).getTime() > cutoff) continue;
      if (t.status === 'queued' || t.status === 'processing') continue;
      await deleteTranscription(t.id);
      removedT++;
    }
    for (const f of await listSonioxFiles()) {
      if (liveFiles.has(f.id)) continue;
      const name = String(f.filename || '');
      if (!name.startsWith('feelia-') && !LEGACY_NAME_RE.test(name)) continue;
      if (new Date(f.created_at).getTime() > cutoff) continue;
      await deleteFile(f.id);
      removedF++;
    }
    if (removedT || removedF) {
      console.log(`[soniox] swept orphans transcriptions=${removedT} files=${removedF}`);
      logEvent({ event: 'soniox.orphan_swept', source: 'job', detail: { transcriptions: removedT, files: removedF } });
    }
  } catch (e) {
    console.log('[soniox] orphan sweep failed:', String(e).slice(0, 160));
  }
}
