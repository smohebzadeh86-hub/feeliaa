// انواعِ لایه‌ی رصد و حسابرسی — فاز ۱. رجوع به پلنِ تأییدشده (PROJECT_STATUS.md، 2026-09-22).
export type ObsSource = 'server' | 'client' | 'job';
export type ObsSeverity = 'debug' | 'info' | 'warn' | 'error';
export type ObsUiKind = 'click' | 'nav' | 'visibility' | 'net' | 'lifecycle' | 'error';

// detail باید همیشه از sanitizeDetail() عبور کند — این تایپ فقط شکلِ ورودیِ خام است،
// نه تضمینِ امنیت (LAW-001 اینجا اجرا نمی‌شود، در redact.ts اجرا می‌شود).
export type ObsDetail = Record<string, unknown>;

export interface ObsEventInput {
  event: string;
  source?: ObsSource; // پیش‌فرض 'server'
  severity?: ObsSeverity; // پیش‌فرض 'info'
  code?: string | null;
  therapistId?: string | null;
  clientId?: string | null;
  sessionId?: string | null;
  runId?: string | null;
  requestId?: string | null;
  navId?: string | null;
  route?: string | null;
  method?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  clientTs?: Date | null;
  detail?: ObsDetail;
}

export interface ObsUiEventInput {
  therapistId?: string | null;
  sessionId?: string | null;
  navId: string;
  seq: number;
  kind: ObsUiKind;
  screen?: string | null;
  targetId?: string | null;
  targetRole?: string | null;
  targetTag?: string | null;
  valueNum?: number | null;
  clientTs?: Date | null;
}

// نام‌هایِ رویدادِ سرور — فاز ۱ (۱۵ نقطه‌ی instrumentation طبقِ پلن).
export const OBS_SERVER_EVENTS = [
  'auth.login_ok',
  'auth.login_failed',
  'auth.logout',
  'session.created',
  'session.transcript_put',
  'session.transcript_put_no_cas',
  'session.transcript_conflict',
  'session.deleted',
  // A3 (2026-09-26): جلسه‌ی زنده‌ی رهاشده توسطِ worker بسته شد (sessionAutoClose.ts) / دوباره باز شد
  'session.auto_closed',
  'session.reopened',
  'audio.segment_received',
  'audio.archive_failed',
  'audio.archive_lost',
  // سگمنتِ آرشیوشده که decode نمی‌شود و از فایلِ کاملِ ادمین کنار گذاشته شد (audit ذخیره‌سازی 2026-09-26)
  'audio.segment_unreadable',
  'batch.enqueued',
  'batch.completed',
  'batch.failed',
  // سگمنتِ صفِ batch که هرگز قابلِ رونویسی نیست (container خراب / Soniox «Invalid audio file») —
  // از صف خارج می‌شود (نسخه‌ی آرشیو برایِ بررسی می‌ماند) تا worker تا ابد retry نکند.
  'batch.segment_unrecoverable',
  'stt.mint_ok',
  'stt.mint_failed',
  'casefile.generated',
  'casefile.failed',
  'admin.export',
  'admin.delete',
  // آپلودِ فایلِ صوتیِ جلسه + jobِ پس‌زمینه (migration 023)
  'upload.created',
  'upload.completed',
  'upload.rejected',
  'upload.part_received', // آپلودِ چندبخشی (migration 025): یک بخش رسید، جلسه منتظرِ بقیه
  'audio_job.stage',
  'audio_job.retry',
  'audio_job.done',
  'audio_job.failed',
  'soniox.orphan_swept',
  // رضایتِ ضبط/رونویسی یک‌بار برایِ هر مراجع (migration 024) — ردِ حسابرسیِ ثبت و لغو
  'client.consent_recorded',
  'client.consent_revoked',
  // اجزایِ داخلیِ خودِ لایه‌ی obs
  'obs.queue_overflow',
] as const;
export type ObsServerEvent = (typeof OBS_SERVER_EVENTS)[number];

// نام‌هایِ رویدادِ کلاینت — فقط به‌عنوانِ constant برایِ فازِ ۲ (rt.* هنوز جایی صدا زده
// نمی‌شود؛ feelia-rt.js در همین فاز دست‌نخورده می‌ماند). این‌جا فقط قلاب است.
export const OBS_CLIENT_EVENTS = [
  'rt.ws_open',
  'rt.ws_close',
  'rt.ws_error',
  'rt.reconnect_scheduled',
  'rt.reconnect_ok',
  'rt.reconnect_exhausted',
  'rt.mint_failed',
  'rt.unreliable_set',
  'rt.watchdog_fired',
  'rt.state_change',
  'rt.gap_marked',
  // هشدارِ کیفیتِ ضبط (2026-09-26) — detail فقط {reason: no_signal|too_quiet|noisy|clipping}، یک بار برایِ هر reason در هر جلسه
  'rt.audio_quality_warn',
  // قطع/وصلِ دوباره‌ی میکروفون (track.onended) — audit ذخیره‌سازی 2026-09-26
  'rt.mic_lost',
  'rt.mic_recovered',
  // A1 رفعِ ذخیره‌سازی (2026-09-26): واگراییِ متنِ محلی/سرور در rebaseِ 409 (detail: len محلی، chars سرور)
  // و شکستِ نهاییِ ذخیره‌ی متن در finish (detail: attempts، count = سگمنت‌هایِ برگشته به رونویسی)
  'rt.transcript_diverged',
  'rt.final_persist_failed',
  // A3: صدایِ آپلودنشده‌ی بیش از ۷ روز در IndexedDB پاک شد (detail: count)
  'rt.local_audio_expired',
  'rt.storage_persist_denied',
  'rt.local_audio_expiring',
  // (2026-10-02، فاز ۱–۳ ممیزیِ Core) — تا 2026-10-03 در این allowlist نبودند ⇒ سرور بی‌صدا drop می‌کرد و کاشی‌هایِ
  // core-metrics (watchdog_silent/health_problem/live_lock_denied) همیشه صفر بودند. detail فقط کلیدهایِ مجاز (code/attempt/elapsed_ms).
  'rt.health_problem',
  'rt.mic_muted',
  'rt.mic_unmuted',
  'rt.durable_start_failed',
  'rt.live_lock_denied',
  'rt.watchdog_silent',
  // رکوردِ realtime (core-data-plan قدمِ ۲): تکه‌ی توکنی که سرور برایِ همیشه رد کرد (detail: status، count)
  'rt.tokens_rejected',
  // A/B صدایِ خامِ آرشیو (core-data-plan قدمِ ۷، localStorage feelia_durable_raw): detail {ok} — استریمِ خام گرفته شد یا نه
  'rt.durable_raw',
  // فازِ ۱: افتِ رویدادِ سمتِ کلاینت به‌خاطرِ سرریزِ ring buffer (feelia-obs.js)
  'obs.client_dropped',
] as const;
export type ObsClientEvent = (typeof OBS_CLIENT_EVENTS)[number];
