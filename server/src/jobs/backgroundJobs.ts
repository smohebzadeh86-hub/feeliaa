// همه‌ی sweep/workerهایِ پس‌زمینه — همان ترتیب، همان interval و همان رفتارِ startup که قبلاً داخلِ
// start()ِ index.ts بود. بعد از runMigrations و قبل از listen صدا زده می‌شود؛ خطایِ startAudioJobWorker
// (تنها awaitِ بدونِ try) مثلِ قبل به caller می‌رسد و سرور بالا نمی‌آید.
import { startObsDrainLoop, logEvent } from '../obs/eventLog.js';
import { sweepOldObsEvents } from '../obs/sweep.js';
import { sweepOldBatchFiles, retryQueuedBatches, BATCH_SWEEP_INTERVAL_MS } from '../features/transcription/batch/batchQueue.js';
import { sweepOldSessionAudio } from '../features/transcription/archive/sessionAudioArchive.js';
import { sweepOldResolveJobs } from '../features/transcription/speakerResolve.js';
import { tryFinalizeGroup } from '../features/audio-upload/uploads.routes.js';
import { autoCloseAbandonedSessions, AUTO_CLOSE_INTERVAL_MS } from '../features/sessions/autoClose.js';
import { startAudioJobWorker, sweepSonioxOrphans } from '../features/audio-upload/jobRunner.js';
import { sweepStaleUploads } from '../features/audio-upload/uploadStore.js';
import { sweepOldNotifications, notifyAdmins } from '../features/notifications/notify.js';
import { startFinalTranscriptWorker } from '../features/final-transcript/index.js';
import { describeLlmConfig } from '../llm/config.js';
import { onLlmHealth } from '../llm/jsonCall.js';
import { createLlmAlertTracker, THROTTLE_MS } from '../llm/healthAlert.js';

export async function startBackgroundJobs(): Promise<void> {
  // پاک‌سازی فایل‌های صوت batch قدیمی (حریم خصوصی/دیسک) — قبل از حذف، تلاش می‌کنه آرشیو کنه
  try { await sweepOldBatchFiles(); } catch {}
  setInterval(() => { sweepOldBatchFiles().catch(() => {}); }, BATCH_SWEEP_INTERVAL_MS);
  // آرشیوِ صدایِ ادمین: هم سرِ startup هم هر ۲۴ ساعت — سروری که هفته‌ها ری‌استارت
  // نمی‌شه هم نباید صدایِ بیشتر از سقفِ نگه‌داری رو نگه داره.
  try { await sweepOldSessionAudio(); } catch {}
  setInterval(() => { sweepOldSessionAudio().catch(() => {}); }, 24 * 60 * 60 * 1000);
  setInterval(() => { try { sweepOldResolveJobs(); } catch {} }, 60 * 60 * 1000);
  // لایه‌ی رصد/حسابرسی (فازِ ۱): صفِ drain به DB + جاروبِ روزانه‌ی retention.
  startObsDrainLoop();
  try { await sweepOldObsEvents(); } catch {}
  setInterval(() => { sweepOldObsEvents().catch(() => {}); }, 24 * 60 * 60 * 1000);
  // ⭐ workerِ دوره‌ایِ retry برایِ صفِ batch (فایندینگِ audit صدا): شکستِ Soniox/کلید
  // وقتِ enqueue قبلاً بدونِ رفرشِ صفحه یا ری‌استارتِ سرور هیچ‌وقت دوباره امتحان نمی‌شد.
  try { await retryQueuedBatches(); } catch {}
  setInterval(() => { retryQueuedBatches().catch(() => {}); }, 5 * 60 * 1000);
  // آپلودِ فایلِ صوتیِ جلسه (migration 023): workerِ DB-محور (بعد از ری‌استارت فوراً ادامه می‌دهد)،
  // جاروبِ آپلودهایِ رهاشده/یتیم، اعلان‌هایِ قدیمی، و فایل/transcriptionِ یتیمِ رویِ Soniox (F3).
  await startAudioJobWorker();
  // «متنِ نهایی» (migration 031): رونویسیِ دوباره + مرتب‌سازی با LLM بعد از پایانِ جلسه — فقط درمانگرِ فعال‌شده.
  await startFinalTranscriptWorker();
  try { await sweepStaleUploads(tryFinalizeGroup); } catch {}
  setInterval(() => { sweepStaleUploads(tryFinalizeGroup).catch(() => {}); }, 60 * 60 * 1000);
  // (A6) در startup هم — سروری که کمتر از ۲۴ ساعت بالا می‌ماند هرگز اعلان‌هایِ قدیمی را پاک نمی‌کرد.
  try { await sweepOldNotifications(); } catch {}
  setInterval(() => { sweepOldNotifications().catch(() => {}); }, 24 * 60 * 60 * 1000);
  // A3: بستنِ خودکارِ جلسه‌ی زنده‌ی رهاشده (بی‌فعالیت > SESSION_AUTO_CLOSE_IDLE_SECONDS، پیش‌فرض ۲ ساعت)
  void autoCloseAbandonedSessions();
  setInterval(() => { autoCloseAbandonedSessions().catch(() => {}); }, AUTO_CLOSE_INTERVAL_MS);
  void sweepSonioxOrphans();
  setInterval(() => { sweepSonioxOrphans().catch(() => {}); }, 6 * 60 * 60 * 1000);
  // پیکربندیِ LLM (provider/مدل/حالتِ JSON/استدلال — بدونِ کلید) تا سوییچ/خطایِ env همان اول دیده شود
  console.log(describeLlmConfig('case-file'));
  console.log(describeLlmConfig('final-transcript'));
  // هشدارِ ادمین برایِ قطعیِ سرویسِ LLM (اعتبار/کلید/قطعیِ پیاپی) — حداکثر یک بار در هر ۶ ساعت برایِ هر علت
  const llmAlerts = createLlmAlertTracker({
    now: () => Date.now(),
    alert: (reason, provider) => {
      const bucket = Math.floor(Date.now() / THROTTLE_MS);
      logEvent({ event: 'llm.alert', severity: 'error', code: reason, detail: { source: provider } });
      console.log(`[llm] هشدارِ ادمین: ${provider} ${reason}`);
      notifyAdmins('llm_unavailable', reason, `llm-${reason}-${bucket}`).catch(() => {});
    },
  });
  onLlmHealth((e) => llmAlerts.handle(e));
}
