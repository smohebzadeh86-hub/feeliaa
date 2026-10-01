import { query } from '../../db/connection.js';
import type { AudioJob } from './jobMachine.js';

// ————— رفعِ L6: سقفِ روزانه‌ی رونویسی برایِ هر تراپیست (هزینه‌ی Soniox) —————
// مجموعِ مدتِ صدایِ jobهایی از همان تراپیست که در ۲۴ ساعتِ گذشته متنشان ثبت شده یا الان رویِ Soniox در حالِ رونویسی‌اند.
// اگر این job سقف را رد کند ⇒ ۳۰ دقیقه بعد دوباره چک می‌شود (صف، نه رد — هیچ داده‌ای از دست نمی‌رود؛ صدا ۳۰ روز می‌ماند).
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
