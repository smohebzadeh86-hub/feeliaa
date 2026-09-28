// پیاده‌سازیِ SQLِ JobStore (jobMachine) رویِ audio_jobs/sessions/notifications + تبدیلِ ردیف ⇄ AudioJob.
// ثبتِ متن و شکستِ job هر کدام یک تراکنش‌اند (اعلان داخلِ همان تراکنش — فقط وقتی رویداد واقعاً commit شد).
import { query, pool } from '../../db/connection.js';
import { logEvent } from '../../obs/eventLog.js';
import { createNotification } from '../notifications/index.js';
import { enqueueFinalTranscript, appendUploadForPolish } from '../final-transcript/index.js';
import { parseAudioQuality } from './quality.js';
import type { AudioJob, JobPatch, JobStore, CaseFileJobStatus, SourcePart } from './jobMachine.js';

export const UPLOAD_TRANSCRIPT_LABEL_PREFIX = '[متنِ فایلِ صوتیِ آپلودشده]';

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

export function rowToJob(r: any): AudioJob {
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
