// ماشینِ حالتِ jobِ «متنِ نهایی» — مستقل از DB/شبکه (فقط از طریقِ portها)، الگوبرداری از features/audio-upload/jobMachine.ts.
//
//   waiting_audio ──(صدا کامل)──→ transcribing ──→ polishing ──→ done (اعلانِ final_transcript_ready)
//        │                              │               │
//        └─(صدا ناقص/نبود/timeout)──────┴──(async کوتاه)─┘   (source=realtime: polish رویِ متنِ realtime)
//   هر مرحله ──→ failed (خطایِ دائمی یا تمام‌شدنِ تلاش‌ها)      متنِ خالی ⇒ skipped
//
// اصول (همان jobِ آپلود):
//  - هر شناسه‌ی خارجی (فایل/transcriptionِ Soniox) پیش از قدمِ بعد ذخیره می‌شود ⇒ ری‌استارت همان را دنبال می‌کند.
//  - خطایِ گذرا ⇒ backoff؛ وقتی transcription از قبل ساخته شده، تلاشِ ارزانِ کوتاه‌مدت.
//  - sessions.transcript هرگز نوشته نمی‌شود (LAW-008) — خروجی فقط در final_transcripts است.

import { UPLOAD_LABEL } from './transcriptText.js';

export type FtStage = 'waiting_audio' | 'transcribing' | 'polishing' | 'done' | 'failed' | 'skipped';
export type FtSource = 'async' | 'realtime';

export interface FtJob {
  sessionId: string;
  therapistId: string;
  clientId: string;
  stage: FtStage;
  attempts: number;
  source: FtSource | null;
  sourceVersion: number | null;
  sonioxFileId: string | null;
  sonioxTranscriptionId: string | null;
  transcriptionStartedAt: Date | null;
  asyncText: string | null;
  errorCode: string | null;
  // زمانِ ورود به صف (یا آخرین reset) — مبنایِ انتظار برایِ رسیدنِ صدا
  queuedAt: Date;
}

export type FtPatch = Partial<Omit<FtJob, 'sessionId' | 'therapistId' | 'clientId' | 'queuedAt'>> & { nextAttemptInMs?: number };

export interface FtStore {
  update(job: FtJob, patch: FtPatch): Promise<void>;
  // تراکنش: متنِ نهایی + stage=done + اعلان. اگر نسخه‌ی متنِ جلسه در این فاصله عوض شده باشد، باز هم ذخیره می‌شود
  // (UI آن را stale نشان می‌دهد) — کارِ انجام‌شده دور ریخته نمی‌شود.
  // turns: نوبت‌هایِ ساختاریافته (migration 034) برایِ اصلاحِ نقش و نمایشِ ویرایش‌ها — اختیاری
  finish(job: FtJob, cleanText: string, report: unknown, turns?: unknown[]): Promise<void>;
  skip(job: FtJob, code: string): Promise<void>;
  fail(job: FtJob, code: string): Promise<void>;
}

export interface FtSessionView { transcript: string; transcriptVersion: number; }

export type AudioState = 'none' | 'syncing' | 'incomplete' | 'complete';
export type FullAudio = { ok: true; path: string; complete: boolean } | { ok: false; reason: string };

export interface FtSonioxPort {
  uploadFile(filePath: string, filename: string): Promise<string>;
  createTranscription(fileId: string, clientReferenceId: string, sessionId: string): Promise<string>;
  poll(transcriptionId: string): Promise<{ status: string; error_message?: string; notFound?: boolean }>;
  // متنِ «گوینده N: …» همراهِ نشانگرِ علائمِ جلسه در جایِ زمانیِ خودشان
  getText(transcriptionId: string, sessionId: string): Promise<string>;
  deleteTranscription(id: string): Promise<boolean | void>;
  deleteFile(id: string): Promise<boolean | void>;
}

export type PolishOutcome =
  | { ok: true; text: string; report: unknown; turns?: unknown[] }
  | { ok: false; transient: boolean; code: string };

export interface FtDeps {
  store: FtStore;
  session(sessionId: string): Promise<FtSessionView | null>;
  audioState(sessionId: string): Promise<AudioState>;
  fullAudio(sessionId: string): Promise<FullAudio>;
  soniox: FtSonioxPort;
  // trustDiarization: متن از یک گذرِ asyncِ کامل است (نه realtime، نه الحاقی) ⇒ نگهبانِ برگشتِ نقش فعال
  polish(sessionId: string, text: string, opts?: { trustDiarization: boolean }): Promise<PolishOutcome>;
  config: FtConfig;
  now(): number;
  log(msg: string): void;
}

export interface FtConfig {
  // سقفِ انتظار برایِ کامل‌شدنِ آرشیوِ صدا (تکه‌ها تا ۶۰ث بعد از پایان هم می‌رسند؛ آفلاین بیشتر)
  audioWaitMs: number;
  // حداقلِ مکث بعد از پایانِ جلسه پیش از هر تصمیم — تکه‌هایِ دُمِ مرورگر هنوز در راه‌اند و سرور از آن‌ها خبر ندارد
  settleMs: number;
}

export const DEFAULT_FT_CONFIG: FtConfig = { audioWaitMs: 30 * 60_000, settleMs: 90_000 };
export const AUDIO_RECHECK_MS = 30_000;
export const BACKOFF_MS = [30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000, 60 * 60_000];
export const MAX_ATTEMPTS = BACKOFF_MS.length;
export const CHEAP_RETRY_MS = 20_000;
export const CHEAP_MAX_ATTEMPTS = 90;
// همان نگهبانِ speakerResolve: خروجیِ async خیلی کوتاه‌تر از متنِ realtime ⇒ صدا ناقص بوده، realtime مبنا می‌شود.
export const MIN_ASYNC_RATIO = 0.6;

export function transcriptionDeadlineMs(): number {
  return 60 * 60_000;
}

export interface StepResult { continueNow: boolean; }
const CONTINUE: StepResult = { continueNow: true };
const WAIT: StepResult = { continueNow: false };

async function transient(job: FtJob, deps: FtDeps, code: string, cause?: unknown, cheap = false): Promise<StepResult> {
  const attempts = job.attempts + 1;
  const max = cheap ? CHEAP_MAX_ATTEMPTS : MAX_ATTEMPTS;
  const why = cause ? ` (${String((cause as any)?.message || cause).slice(0, 160)})` : '';
  if (attempts > max) {
    await cleanupRemote(job, deps);
    await deps.store.fail(job, code);
    deps.log(`[final-transcript] ${job.sessionId} giving up after ${attempts - 1} attempts: ${code}${why}`);
    return WAIT;
  }
  const delay = cheap ? CHEAP_RETRY_MS : BACKOFF_MS[attempts - 1];
  await deps.store.update(job, { attempts, errorCode: code, nextAttemptInMs: delay });
  deps.log(`[final-transcript] ${job.sessionId} transient ${code}, attempt ${attempts}/${max}, next in ${Math.round(delay / 1000)}s${why}`);
  return WAIT;
}

export async function cleanupRemote(job: FtJob, deps: FtDeps): Promise<void> {
  const tid = job.sonioxTranscriptionId;
  const fid = job.sonioxFileId;
  const tOk = tid ? (await deps.soniox.deleteTranscription(tid).catch(() => false)) !== false : true;
  const fOk = fid ? (await deps.soniox.deleteFile(fid).catch(() => false)) !== false : true;
  if (tid || fid) {
    const patch: FtPatch = { transcriptionStartedAt: null };
    if (tid && tOk) patch.sonioxTranscriptionId = null;
    if (fid && fOk) patch.sonioxFileId = null;
    await deps.store.update(job, patch);
  }
}

export async function giveUp(job: FtJob, deps: FtDeps, code: string): Promise<void> {
  await cleanupRemote(job, deps);
  await deps.store.fail(job, code);
}

export async function stepFinalTranscript(job: FtJob, deps: FtDeps): Promise<StepResult> {
  switch (job.stage) {
    case 'waiting_audio': return stepWaitAudio(job, deps);
    case 'transcribing': return stepTranscribe(job, deps);
    case 'polishing': return stepPolish(job, deps);
    default: return WAIT;
  }
}

async function toRealtime(job: FtJob, deps: FtDeps, reason: string): Promise<StepResult> {
  deps.log(`[final-transcript] ${job.sessionId} source=realtime (${reason})`);
  await deps.store.update(job, { stage: 'polishing', source: 'realtime', asyncText: null, attempts: 0, errorCode: null, nextAttemptInMs: 0 });
  return CONTINUE;
}

async function stepWaitAudio(job: FtJob, deps: FtDeps): Promise<StepResult> {
  const waited = deps.now() - job.queuedAt.getTime();
  if (waited < deps.config.settleMs) {
    await deps.store.update(job, { nextAttemptInMs: deps.config.settleMs - waited });
    return WAIT;
  }
  const state = await deps.audioState(job.sessionId);
  if (state === 'complete') {
    await deps.store.update(job, { stage: 'transcribing', attempts: 0, errorCode: null, nextAttemptInMs: 0 });
    return CONTINUE;
  }
  if (state === 'syncing' && waited < deps.config.audioWaitMs) {
    await deps.store.update(job, { errorCode: 'audio-syncing', nextAttemptInMs: AUDIO_RECHECK_MS });
    return WAIT;
  }
  return toRealtime(job, deps, state === 'syncing' ? 'audio-wait-timeout' : `audio-${state}`);
}

async function stepTranscribe(job: FtJob, deps: FtDeps): Promise<StepResult> {
  if (!job.sonioxTranscriptionId) {
    try {
      if (!job.sonioxFileId) {
        const full = await deps.fullAudio(job.sessionId);
        // صدایِ ناقص (سگمنتِ گمشده/خراب) هرگز جایِ متنِ realtime را نمی‌گیرد — بخشی از متن گم می‌شد.
        if (!full.ok) return full.reason === 'no-ffmpeg' ? transient(job, deps, 'no-ffmpeg') : toRealtime(job, deps, full.reason);
        if (!full.complete) return toRealtime(job, deps, 'audio-incomplete');
        const ext = full.path.slice(full.path.lastIndexOf('.')) || '.webm';
        const fid = await deps.soniox.uploadFile(full.path, `feelia-final-${job.sessionId}${ext}`);
        job.sonioxFileId = fid;
        await deps.store.update(job, { sonioxFileId: fid });
      }
      const tid = await deps.soniox.createTranscription(job.sonioxFileId!, `feelia:${job.sessionId}:final-transcript`, job.sessionId);
      job.sonioxTranscriptionId = tid;
      await deps.store.update(job, { sonioxTranscriptionId: tid, transcriptionStartedAt: new Date(deps.now()), errorCode: null, nextAttemptInMs: 5_000 });
      return WAIT;
    } catch (e) {
      return transient(job, deps, 'soniox-unavailable', e);
    }
  }

  let s: { status: string; error_message?: string; notFound?: boolean };
  try {
    s = await deps.soniox.poll(job.sonioxTranscriptionId);
  } catch (e) {
    return transient(job, deps, 'soniox-unavailable', e, true);
  }
  if (s.status === 'queued' || s.status === 'processing') {
    const started = job.transcriptionStartedAt ? new Date(job.transcriptionStartedAt).getTime() : deps.now();
    if (deps.now() - started > transcriptionDeadlineMs()) {
      await cleanupRemote(job, deps);
      return transient(job, deps, 'soniox-timeout');
    }
    await deps.store.update(job, { nextAttemptInMs: 10_000, ...(job.errorCode ? { errorCode: null } : {}) });
    return WAIT;
  }
  if (s.status === 'error') {
    if (s.notFound) {
      await deps.store.update(job, { sonioxTranscriptionId: null, transcriptionStartedAt: null });
      job.sonioxTranscriptionId = null;
      return transient(job, deps, 'soniox-lost');
    }
    await cleanupRemote(job, deps);
    // فایلِ غیرقابلِ رونویسی ⇒ متنِ realtime مبنا می‌شود (نه شکست)
    if (/invalid audio/i.test(s.error_message || '')) return toRealtime(job, deps, 'unreadable');
    return transient(job, deps, 'soniox-error');
  }
  if (s.status !== 'completed') return transient(job, deps, 'soniox-unknown-status');

  let text: string;
  try {
    text = (await deps.soniox.getText(job.sonioxTranscriptionId, job.sessionId)).trim();
  } catch (e) {
    return transient(job, deps, 'soniox-unavailable', e, true);
  }
  await cleanupRemote(job, deps);
  const sess = await deps.session(job.sessionId);
  const rtLen = (sess?.transcript || '').trim().length;
  // علامت‌هایِ ⟦…؟⟧ (واژه‌یِ کم‌اطمینان) در مقایسه‌ی طول شمرده نمی‌شوند
  const asyncLen = text.replace(/[⟦⟧]|؟⟧/g, '').length;
  if (!text || (rtLen > 0 && asyncLen < rtLen * MIN_ASYNC_RATIO)) return toRealtime(job, deps, 'async-too-short');
  await deps.store.update(job, { stage: 'polishing', source: 'async', asyncText: text, attempts: 0, errorCode: null, nextAttemptInMs: 0 });
  return CONTINUE;
}

async function stepPolish(job: FtJob, deps: FtDeps): Promise<StepResult> {
  const sess = await deps.session(job.sessionId);
  if (!sess) return WAIT; // جلسه حذف شده (ردیف با cascade می‌رود)
  const text = (job.source === 'async' ? job.asyncText : sess.transcript)?.trim() || '';
  if (!text) {
    await deps.store.skip(job, 'no-text');
    return WAIT;
  }
  // نسخه‌ی مبنا: نسخه‌ی فعلیِ متنِ جلسه در لحظه‌ی مرتب‌سازی — تغییرِ بعدی (دُمِ دیررس/ویرایش) ⇒ stale در UI
  if (job.sourceVersion !== sess.transcriptVersion) await deps.store.update(job, { sourceVersion: sess.transcriptVersion });
  // برچسبِ بخشِ آپلودی ⇒ دو diarizationِ جدا (یا متنِ realtimeِ قبلی) در یک متن ⇒ نگاشتِ سراسری قابلِ‌اتکا نیست
  const trustDiarization = job.source === 'async' && !text.includes(UPLOAD_LABEL);
  const res = await deps.polish(job.sessionId, text, { trustDiarization });
  if (!res.ok) {
    if (res.transient) return transient(job, deps, res.code);
    await deps.store.fail(job, res.code);
    deps.log(`[final-transcript] ${job.sessionId} polish failed permanently: ${res.code}`);
    return WAIT;
  }
  await deps.store.finish(job, res.text, res.report, res.turns);
  deps.log(`[final-transcript] ${job.sessionId} done source=${job.source}`);
  return WAIT;
}
