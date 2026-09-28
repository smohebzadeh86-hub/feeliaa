import { query } from '../../db/connection.js';
import { logEvent } from '../../obs/eventLog.js';
import { deleteTranscription, deleteFile, listSonioxFiles, listSonioxTranscriptions } from '../transcription/index.js';

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
