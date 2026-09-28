// شناسه‌هایِ Soniox (فایل/transcription) که jobهایِ آپلود نگه می‌دارند — جمع‌آوری پیش از حذفِ جلسه‌ها و پاک‌کردن
// رویِ Soniox بعد از حذفِ موفقِ DB (session-media/purge)؛ و پاک‌سازیِ منابعِ jobی که وسطِ کار حذف شد (worker).
import { query } from '../../db/connection.js';
import { deleteTranscription, deleteFile } from '../transcription/soniox/restClient.js';

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

export async function deleteSonioxRefs(refs: SonioxRef[]): Promise<void> {
  for (const ref of refs) {
    if (ref.transcriptionId) await deleteTranscription(ref.transcriptionId).catch(() => {});
    if (ref.fileId) await deleteFile(ref.fileId).catch(() => {});
  }
}

export function releaseSonioxRefs(refs: SonioxRef[]): void {
  if (refs.length) void deleteSonioxRefs(refs);
}
