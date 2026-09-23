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
  'session.transcript_conflict',
  'session.deleted',
  'audio.segment_received',
  'audio.archive_failed',
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
  // فازِ ۱: افتِ رویدادِ سمتِ کلاینت به‌خاطرِ سرریزِ ring buffer (feelia-obs.js)
  'obs.client_dropped',
] as const;
export type ObsClientEvent = (typeof OBS_CLIENT_EVENTS)[number];
