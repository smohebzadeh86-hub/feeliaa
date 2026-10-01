// همه‌ی sweep/workerهایِ پس‌زمینه — همان ترتیب، همان interval و همان رفتارِ startup که قبلاً داخلِ
// start()ِ index.ts بود. بعد از runMigrations و قبل از listen صدا زده می‌شود؛ خطایِ startAudioJobWorker
// (تنها awaitِ بدونِ try) مثلِ قبل به caller می‌رسد و سرور بالا نمی‌آید.
import { scheduleBeating } from '../obs/heartbeat.js';
import { startObsDrainLoop, logEvent } from '../obs/eventLog.js';
import { sweepOldObsEvents } from '../obs/sweep.js';
import {
  sweepOldBatchFiles, BATCH_SWEEP_INTERVAL_MS, retryQueuedBatches, sweepOldSessionAudio, sweepOldResolveJobs,
} from '../features/transcription/index.js';
import { tryFinalizeGroup, startAudioJobWorker, sweepSonioxOrphans, sweepStaleUploads } from '../features/audio-upload/index.js';
import { autoCloseAbandonedSessions, AUTO_CLOSE_INTERVAL_MS } from '../features/sessions/index.js';
import { sweepOldNotifications, notifyAdmins } from '../features/notifications/index.js';
import { startFinalTranscriptWorker } from '../features/final-transcript/index.js';
import { describeLlmConfig } from '../llm/config.js';
import { onLlmHealth, onLlmCall } from '../llm/jsonCall.js';
import { createLlmAlertTracker, THROTTLE_MS } from '../llm/healthAlert.js';

export async function startBackgroundJobs(): Promise<void> {
  // پاک‌سازی فایل‌های صوت batch قدیمی (حریم خصوصی/دیسک) — قبل از حذف، تلاش می‌کنه آرشیو کنه
  try { await sweepOldBatchFiles(); } catch {}
  scheduleBeating('sweep-batch-files', BATCH_SWEEP_INTERVAL_MS, () => sweepOldBatchFiles());
  // آرشیوِ صدایِ ادمین: هم سرِ startup هم هر ۲۴ ساعت — سروری که هفته‌ها ری‌استارت
  // نمی‌شه هم نباید صدایِ بیشتر از سقفِ نگه‌داری رو نگه داره.
  try { await sweepOldSessionAudio(); } catch {}
  scheduleBeating('sweep-session-audio', 24 * 60 * 60 * 1000, () => sweepOldSessionAudio());
  scheduleBeating('sweep-resolve-jobs', 60 * 60 * 1000, () => sweepOldResolveJobs());
  // لایه‌ی رصد/حسابرسی (فازِ ۱): صفِ drain به DB + جاروبِ روزانه‌ی retention.
  startObsDrainLoop();
  try { await sweepOldObsEvents(); } catch {}
  scheduleBeating('sweep-obs-events', 24 * 60 * 60 * 1000, () => sweepOldObsEvents());
  // ⭐ workerِ دوره‌ایِ retry برایِ صفِ batch (فایندینگِ audit صدا): شکستِ Soniox/کلید
  // وقتِ enqueue قبلاً بدونِ رفرشِ صفحه یا ری‌استارتِ سرور هیچ‌وقت دوباره امتحان نمی‌شد.
  try { await retryQueuedBatches(); } catch {}
  scheduleBeating('retry-queued-batches', 5 * 60 * 1000, () => retryQueuedBatches());
  // آپلودِ فایلِ صوتیِ جلسه (migration 023): workerِ DB-محور (بعد از ری‌استارت فوراً ادامه می‌دهد)،
  // جاروبِ آپلودهایِ رهاشده/یتیم، اعلان‌هایِ قدیمی، و فایل/transcriptionِ یتیمِ رویِ Soniox (F3).
  await startAudioJobWorker();
  // «متنِ نهایی» (migration 031): رونویسیِ دوباره + مرتب‌سازی با LLM بعد از پایانِ جلسه — فقط درمانگرِ فعال‌شده.
  await startFinalTranscriptWorker();
  try { await sweepStaleUploads(tryFinalizeGroup); } catch {}
  scheduleBeating('sweep-stale-uploads', 60 * 60 * 1000, () => sweepStaleUploads(tryFinalizeGroup));
  // (A6) در startup هم — سروری که کمتر از ۲۴ ساعت بالا می‌ماند هرگز اعلان‌هایِ قدیمی را پاک نمی‌کرد.
  try { await sweepOldNotifications(); } catch {}
  scheduleBeating('sweep-notifications', 24 * 60 * 60 * 1000, () => sweepOldNotifications());
  // A3: بستنِ خودکارِ جلسه‌ی زنده‌ی رهاشده (بی‌فعالیت > SESSION_AUTO_CLOSE_IDLE_SECONDS، پیش‌فرض ۲ ساعت)
  void autoCloseAbandonedSessions();
  scheduleBeating('auto-close-sessions', AUTO_CLOSE_INTERVAL_MS, () => autoCloseAbandonedSessions());
  void sweepSonioxOrphans();
  scheduleBeating('sweep-soniox-orphans', 6 * 60 * 60 * 1000, () => sweepSonioxOrphans());
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
  // ثبتِ هر فراخوانیِ LLM (موفق/ناموفق) در obs_events: رویدادِ `llm.call` — فقط متادیتا و عدد (LAW-001). گزارش: pnpm llm:usage
  onLlmCall((e) => logEvent({
    event: 'llm.call', source: 'job', severity: e.ok ? 'info' : 'warn', sessionId: e.ref?.sessionId, clientId: e.ref?.clientId,
    therapistId: e.ref?.therapistId, code: e.ok ? undefined : String(e.status ?? 'network'), durationMs: e.durationMs,
    detail: {
      purpose: e.purpose, provider: e.provider, model: e.model, ok: e.ok, status: e.status, attempt: e.attempt, finish: e.finish,
      llm_calls: 1, prompt_tokens: e.usage?.prompt_tokens, completion_tokens: e.usage?.completion_tokens,
      reasoning_tokens: e.usage?.reasoning_tokens, cost_usd: e.usage?.cost_usd ?? undefined,
    },
  }));
}
