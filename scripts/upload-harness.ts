// هارنسِ pipelineِ آپلودِ صدا (migration 023) — بدونِ DB/شبکه/Sonioxِ واقعی؛ دادهٔ ساختگی.
// ماشینِ حالت (jobMachine.ts) با portهایِ جعلی تست می‌شود: idempotency، ری‌استارت، retry/backoff،
// خطایِ دائمی، تکرار، سکوت، پرونده‌ی busy. بخشِ media با ffmpegِ واقعی رویِ فایل‌هایِ ساختگیِ
// تولیدشده در پوشه‌ی موقت اجرا می‌شود (اگر ffmpeg نباشد SKIP).
// اجرا: pnpm test:up
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, rmSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  stepJob, giveUpJob, BACKOFF_MS, MAX_ATTEMPTS, CASE_FILE_BUSY_MAX, transcriptionDeadlineMs, qualityWarningFor,
  type AudioJob, type JobDeps, type JobPatch, type JobStore, type CaseFileJobStatus, type TranscriptMeta,
} from '../server/src/features/audio-upload/jobMachine.js';
import {
  pollTimeoutForBytes, lowConfidenceRatio, markUncertainTokens, markedTextFromTokens, buildTextFromAsyncTokens, type AsyncToken,
} from '../server/src/features/transcription/soniox/restClient.js';
import { FileQualityMeter, classifyWindow, measureAudioQuality, parseAudioQuality, speechSpans, QUALITY, type AudioQuality } from '../server/src/features/audio-upload/quality.js';
import { computeTranscriptMetrics, parseTranscriptMetrics, METRICS, type TimedToken } from '../server/src/features/audio-upload/transcriptMetrics.js';
import { metricsFindings } from '../server/src/features/admin/diagnosis.js';
import { rankQualityRows, summarizeQuality } from '../server/src/features/audio-upload/adminQuality.js';
import { parseProbe, probeMedia, normalizeAudio, sniffObviouslyNotAudio, extensionOf, ACCEPTED_EXTENSIONS, MAX_DURATION_MS } from '../server/src/features/audio-upload/media.js';
import { expectedChunkBytes, writeChunk, receivedChunks, removeUploadDir } from '../server/src/features/audio-upload/uploadStore.js';
import { packTokens, unpackTokens } from '../server/src/features/session-record/index.js';
import { checkSeqContiguous } from '../server/src/features/transcription/archive/listing.js';
import { parseEmptySeqs } from '../server/src/features/transcription/archive/skips.js';
import { shouldRecordRevision, revisionCause, casRequired } from '../server/src/features/sessions/transcriptRevision.js';
import { buildSegments, renderCanonicalText, rolesComplete, cleanLabel } from '../server/src/features/session-record/segments.js';
import { deterministicJobId } from '../server/src/features/session-record/record.repository.js';
import { parseRtChunk, assembleRtChunks, type StoredRtChunk } from '../server/src/features/session-record/rtChunks.js';
import { suggestRoles, speakerDisplays } from '../server/src/features/session-record/suggest.js';
import { measureRecord, alignmentFor } from '../server/src/features/audio-upload/recordMetrics.js';
import { jobView } from '../server/src/features/audio-upload/jobView.js';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { archiveKindForFile, isPreNoteFile, isNoteFile, isArchiveFile, isNoteArchiveFile, isLateFile, seqFromFilename, runIdFromFilename, mimeFromFilename, sessionIdFromFilename } from '../server/src/features/transcription/batch/queueFiles.js';

let pass = 0;
let fail = 0;
async function t(name: string, fn: () => Promise<void> | void) {
  try { await fn(); pass++; console.log('PASS ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + '\n   ' + (e instanceof Error ? e.stack?.split('\n').slice(0, 3).join('\n   ') : String(e))); }
}

// ————————————————— fakes —————————————————
interface World {
  jobs: Map<string, AudioJob & { nextAttemptInMs?: number; finished?: boolean }>;
  transcripts: Map<string, string>;
  notifications: Array<{ jobId: string; kind: string; errorCode?: string | null }>;
  sessionDuration: Map<string, number>;
  files: Set<string>;
  sonioxCalls: string[];
  caseFileCalls: number;
  removedUploadDirs: string[];
  // پلنِ B: metaِ ثبت‌شده همراهِ متن (هشدارِ کم‌اطمینان، متنِ علامت‌خورده برایِ «متنِ نهایی»)
  metas: Map<string, TranscriptMeta | undefined>;
}

function newWorld(): World {
  return { jobs: new Map(), transcripts: new Map(), notifications: [], sessionDuration: new Map(), files: new Set(), sonioxCalls: [], caseFileCalls: 0, removedUploadDirs: [], metas: new Map() };
}

function fakeStore(w: World): JobStore {
  const notify = (jobId: string, kind: string, errorCode?: string | null) => {
    if (!w.notifications.some((n) => n.jobId === jobId && n.kind === kind)) w.notifications.push({ jobId, kind, errorCode });
  };
  return {
    async update(job, patch: JobPatch) {
      const stored = w.jobs.get(job.id)!;
      for (const [k, v] of Object.entries(patch)) if (v !== undefined) { (stored as any)[k] = v; if (k !== 'nextAttemptInMs') (job as any)[k] = v; }
    },
    async applyTranscriptOnce(job, raw, nextStage, meta) {
      const stored = w.jobs.get(job.id);
      if (!stored) return 'gone';
      if (stored.transcriptAppliedAt) return 'already';
      const text = raw.trim();
      w.metas.set(job.id, meta);
      if (text) {
        const cur = w.transcripts.get(job.sessionId) || '';
        w.transcripts.set(job.sessionId, cur ? cur + '\n\n' + text : text);
        stored.attempts = 0;
        if (nextStage === 'case_file') stored.stage = 'case_file';
        else { stored.stage = 'done'; stored.caseFileStatus = 'disabled'; stored.finished = true; }
        // همان قاعده‌ی sqlJobStore: هشدارِ کم‌اطمینان ⇒ transcript_low_quality به‌جایِ transcript_ready
        notify(job.id, meta?.qualityWarning ? 'transcript_low_quality' : 'transcript_ready');
      } else {
        stored.stage = 'done'; stored.finished = true;
        notify(job.id, 'transcript_empty');
      }
      stored.transcriptAppliedAt = new Date();
      Object.assign(job, { stage: stored.stage, attempts: stored.attempts, transcriptAppliedAt: stored.transcriptAppliedAt });
      return 'applied';
    },
    async fail(job, code) {
      const stored = w.jobs.get(job.id)!;
      if (stored.stage === 'failed') return;
      stored.stage = 'failed'; stored.errorCode = code; stored.finished = true;
      job.stage = 'failed'; job.errorCode = code;
      notify(job.id, 'processing_failed', code);
    },
    async finish(job, cf: CaseFileJobStatus) {
      const stored = w.jobs.get(job.id)!;
      stored.stage = 'done'; stored.caseFileStatus = cf; stored.finished = true;
      job.stage = 'done';
    },
    async setSessionDuration(sessionId, ms) { w.sessionDuration.set(sessionId, ms); },
  };
}

interface SonioxScript {
  uploadFails?: number;          // چند بار اولِ آپلود خطا بده
  pollSequence?: Array<'processing' | 'completed' | 'error' | 'notfound' | 'throw' | 'invalid'>;
  text?: string;
  textFails?: number;
  // پلنِ B: اگر داده شود getText شیِ TranscriptResult برمی‌گرداند (مثلِ productionDeps)
  lowConfRatio?: number | null;
  markedText?: string;
  // Session Data Engine: توکن‌هایِ زمان‌دار ⇒ getText شیِ کامل با tokens برمی‌گرداند (مثلِ productionDeps)
  tokens?: TimedToken[];
}

function makeDeps(w: World, script: SonioxScript = {}, extra: Partial<JobDeps> = {}): JobDeps & { clock: { t: number } } {
  const clock = { t: 1_000_000 };
  let uploads = 0; let creates = 0; let polls = 0; let texts = 0;
  const seq = script.pollSequence || ['completed'];
  const deps: JobDeps & { clock: { t: number } } = {
    clock,
    store: fakeStore(w),
    soniox: {
      async uploadFile(p) { w.sonioxCalls.push('upload'); if (uploads++ < (script.uploadFails || 0)) throw new Error('net'); return 'file-' + uploads; },
      async createTranscription(fid) { w.sonioxCalls.push('create:' + fid); creates++; return 'tr-' + creates; },
      async poll() {
        w.sonioxCalls.push('poll');
        const s = seq[Math.min(polls++, seq.length - 1)];
        if (s === 'throw') throw new Error('poll-http-503');
        if (s === 'notfound') return { status: 'error', notFound: true };
        if (s === 'invalid') return { status: 'error', error_message: 'Invalid audio file' };
        return { status: s };
      },
      async getText() {
        w.sonioxCalls.push('text'); if (texts++ < (script.textFails || 0)) throw new Error('503');
        const text = script.text ?? 'گوینده ۱: سلام';
        if (script.tokens) return { text, lowConfRatio: script.lowConfRatio ?? null, tokens: script.tokens };
        return script.lowConfRatio !== undefined ? { text, lowConfRatio: script.lowConfRatio, markedText: script.markedText } : text;
      },
      async deleteTranscription(id) { w.sonioxCalls.push('delT:' + id); },
      async deleteFile(id) { w.sonioxCalls.push('delF:' + id); },
    },
    media: {
      async probe() { return { ok: true, hasAudio: true, durationMs: 60_000 }; },
      async normalize(_src, outBase) { const p = outBase + '.ogg'; w.files.add(p); return { ok: true, outPath: p, mime: 'audio/ogg', durationMs: 60_000 }; },
    },
    async archive(_s, filePath) { const p = '/archive/' + path.basename(filePath); w.files.delete(filePath); w.files.add(p); return { path: p, durationMs: 60_000 }; },
    async caseFile() { w.caseFileCalls++; return 'generated'; },
    // تست‌هایِ قدیمی مسیرِ پرونده را پوشش می‌دهند (کد هنوز هست، پشتِ UPLOAD_CASE_FILE)؛ H25–H26 پیش‌فرضِ خاموش را.
    caseFileAfterUpload: () => true,
    fileExists: (p) => w.files.has(p),
    normalizedOutBase: (job) => '/uploads/' + job.uploadId + '/normalized',
    removeUploadDir: (id) => { w.removedUploadDirs.push(id); },
    now: () => clock.t,
    log: () => {},
    ...extra,
  };
  return deps;
}

function newJob(w: World, over: Partial<AudioJob> = {}): AudioJob {
  const job: AudioJob = {
    id: 'job-' + (w.jobs.size + 1), uploadId: 'up-1', therapistId: 'th-1', clientId: 'cl-1', sessionId: 'se-1',
    stage: 'queued', attempts: 0, sourcePath: '/uploads/up-1/source.m4a', sourceParts: null, normalizedPath: null, durationMs: null,
    sonioxFileId: null, sonioxTranscriptionId: null, transcriptionStartedAt: null, transcriptAppliedAt: null,
    caseFileStatus: null, errorCode: null, ...over,
  };
  w.files.add('/uploads/up-1/source.m4a');
  w.jobs.set(job.id, { ...job });
  return job;
}

// یک «worker» ساده: مثلِ runJobِ واقعی، هر بار jobِ ذخیره‌شده را از store می‌خواند (نه شیِ درون‌حافظه‌ای).
async function drive(w: World, deps: JobDeps, jobId: string, maxSteps = 60): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    const stored = w.jobs.get(jobId);
    if (!stored || stored.stage === 'done' || stored.stage === 'failed') return;
    const snapshot: AudioJob = { ...stored };
    await stepJob(snapshot, deps);
  }
}

async function main() {
  // ————— ماشینِ حالت —————
  await t('H1 happy path: queued→normalizing→transcribing→case_file→done، متن یک‌بار، اعلانِ transcript_ready، پاک‌سازیِ Soniox', async () => {
    const w = newWorld(); const deps = makeDeps(w); const job = newJob(w);
    await drive(w, deps, job.id);
    const s = w.jobs.get(job.id)!;
    assert.equal(s.stage, 'done');
    assert.equal(s.caseFileStatus, 'done');
    assert.equal(w.transcripts.get('se-1'), 'گوینده ۱: سلام');
    assert.deepEqual(w.notifications.map((n) => n.kind), ['transcript_ready']);
    assert.ok(w.sonioxCalls.includes('delT:tr-1') && w.sonioxCalls.includes('delF:file-1'), 'صدا/متن رویِ Soniox پاک شد');
    assert.equal(s.sonioxFileId, null);
    assert.deepEqual(w.removedUploadDirs, ['up-1'], 'فایلِ خامِ آپلود بعد از نرمال‌سازی حذف شد');
    assert.equal(w.sessionDuration.get('se-1'), 60_000);
    assert.equal(w.caseFileCalls, 1);
  });

  await t('H2 retry/تکرار: اجرایِ دوباره‌ی مرحله‌ی transcribing بعد از اعمالِ متن ⇒ متنِ تکراری ساخته نمی‌شود', async () => {
    const w = newWorld(); const deps = makeDeps(w, { pollSequence: ['completed'] });
    const job = newJob(w, { stage: 'transcribing', normalizedPath: '/archive/n.ogg', sonioxFileId: 'f', sonioxTranscriptionId: 't' });
    w.files.add('/archive/n.ogg');
    const stale: AudioJob = { ...w.jobs.get(job.id)! };
    await stepJob({ ...stale }, deps);          // اعمال
    await stepJob({ ...stale }, deps);          // همان snapshotِ کهنه دوباره (کرش/lease) ⇒ 'already'
    await stepJob({ ...stale }, deps);          // و سوم
    assert.equal(w.transcripts.get('se-1'), 'گوینده ۱: سلام', 'دقیقاً یک نسخه');
    assert.equal(w.notifications.filter((n) => n.kind === 'transcript_ready').length, 1);
  });

  await t('H3 ری‌استارت وسطِ رونویسی: شناسه‌ی transcription در DB ⇒ بدونِ آپلود/ساختِ دوباره ادامه می‌یابد', async () => {
    const w = newWorld(); const deps = makeDeps(w, { pollSequence: ['processing', 'completed'] });
    const job = newJob(w, { stage: 'transcribing', normalizedPath: '/archive/n.ogg', sonioxFileId: 'file-x', sonioxTranscriptionId: 'tr-x', transcriptionStartedAt: new Date(deps.clock.t) });
    w.files.add('/archive/n.ogg');
    await drive(w, deps, job.id);
    assert.ok(!w.sonioxCalls.some((c) => c === 'upload' || c.startsWith('create')), 'هیچ آپلود/ساختِ تازه‌ای');
    assert.equal(w.jobs.get(job.id)!.stage, 'done');
  });

  await t('H4 خطایِ گذرایِ آپلود ⇒ backoff با شمارشِ تلاش، سپس موفق', async () => {
    const w = newWorld(); const deps = makeDeps(w, { uploadFails: 2 });
    const job = newJob(w);
    await stepJob({ ...w.jobs.get(job.id)! }, deps); // queued→normalizing→(continue)
    await stepJob({ ...w.jobs.get(job.id)! }, deps); // normalize
    await stepJob({ ...w.jobs.get(job.id)! }, deps); // upload fail 1
    assert.equal(w.jobs.get(job.id)!.attempts, 1);
    assert.equal(w.jobs.get(job.id)!.nextAttemptInMs, BACKOFF_MS[0]);
    assert.equal(w.jobs.get(job.id)!.errorCode, 'soniox-unavailable');
    await drive(w, deps, job.id);
    assert.equal(w.jobs.get(job.id)!.stage, 'done');
  });

  await t('H4b (2026-09-24) شکستِ poll/دریافتِ متن وقتی transcription رویِ Soniox هست ⇒ تلاشِ ارزان: فاصله‌ی کوتاهِ ثابت، نه backoffِ فزاینده', async () => {
    const w = newWorld(); const deps = makeDeps(w, { pollSequence: ['throw', 'throw', 'throw', 'throw', 'throw', 'throw', 'throw', 'completed'] });
    const job = newJob(w, { stage: 'transcribing', normalizedPath: '/archive/n.ogg', sonioxFileId: 'f1', sonioxTranscriptionId: 't1', transcriptionStartedAt: new Date(1_000_000) });
    w.files.add('/archive/n.ogg');
    for (let i = 0; i < 7; i++) {
      await stepJob({ ...w.jobs.get(job.id)! }, deps);
      assert.equal(w.jobs.get(job.id)!.nextAttemptInMs, 20_000, 'فاصله‌ی تلاش ' + i);
    }
    assert.equal(w.jobs.get(job.id)!.attempts, 7, 'بیش از MAX_ATTEMPTSِ عادی (۶) هنوز failed نشده');
    assert.equal(w.jobs.get(job.id)!.stage, 'transcribing');
    await drive(w, deps, job.id);
    assert.equal(w.jobs.get(job.id)!.stage, 'done');
    assert.equal(w.sonioxCalls.filter((c) => c === 'upload' || c.startsWith('create')).length, 0, 'هیچ آپلود/ساختِ تازه‌ای');
  });

  await t('H5 خطایِ گذرایِ مداوم ⇒ بعد از MAX_ATTEMPTS: failed + اعلانِ processing_failed (یک بار)', async () => {
    const w = newWorld(); const deps = makeDeps(w, { uploadFails: 99 });
    const job = newJob(w, { stage: 'transcribing', normalizedPath: '/archive/n.ogg' });
    w.files.add('/archive/n.ogg');
    await drive(w, deps, job.id);
    const s = w.jobs.get(job.id)!;
    assert.equal(s.stage, 'failed');
    assert.equal(s.errorCode, 'soniox-unavailable');
    assert.equal(w.sonioxCalls.filter((c) => c === 'upload').length, MAX_ATTEMPTS + 1);
    assert.equal(w.notifications.filter((n) => n.kind === 'processing_failed').length, 1);
  });

  await t('H6 فایلِ بی‌صدا ⇒ failed دائمی بدونِ هیچ تماسِ Soniox', async () => {
    const w = newWorld();
    const deps = makeDeps(w, {}, { media: { probe: async () => ({ ok: false, hasAudio: false, durationMs: 5000, reason: 'no-audio' }), normalize: async () => ({ ok: false }) } });
    const job = newJob(w);
    await drive(w, deps, job.id);
    assert.equal(w.jobs.get(job.id)!.stage, 'failed');
    assert.equal(w.jobs.get(job.id)!.errorCode, 'no-audio');
    assert.equal(w.sonioxCalls.length, 0);
  });

  await t('H7 فایلِ بیش از ۳۰۰ دقیقه ⇒ too-long', async () => {
    const w = newWorld();
    const deps = makeDeps(w, {}, { media: { probe: async () => ({ ok: true, hasAudio: true, durationMs: MAX_DURATION_MS + 1 }), normalize: async () => ({ ok: false }) } });
    const job = newJob(w);
    await drive(w, deps, job.id);
    assert.equal(w.jobs.get(job.id)!.errorCode, 'too-long');
  });

  await t('H27 (رفعِ M1، 2026-09-24) نرمال‌سازیِ فایلِ probeشده سه بار شکست ⇒ failed با normalize-failed (قابلِ retry)، نه unreadable؛ فایلِ منبع حفظ می‌شود', async () => {
    const w = newWorld(); let normalizes = 0;
    const deps = makeDeps(w, {}, { media: { probe: async () => ({ ok: true, hasAudio: true, durationMs: 60_000 }), normalize: async () => { normalizes++; return { ok: false, error: 'No space left on device' }; } } });
    const job = newJob(w);
    await drive(w, deps, job.id);
    const s = w.jobs.get(job.id)!;
    assert.equal(s.stage, 'failed');
    assert.equal(s.errorCode, 'normalize-failed');
    assert.equal(normalizes, 3);
    assert.equal(w.removedUploadDirs.length, 0, 'فایلِ منبع برایِ «تلاشِ دوباره» باید بماند');
    assert.equal(w.notifications.filter((n) => n.kind === 'processing_failed' && n.errorCode === 'normalize-failed').length, 1);
  });

  await t('H28 (رفعِ M2، 2026-09-24) giveUpJob ⇒ failed با internal-error، یک اعلان، و پاک‌سازیِ منابعِ Soniox', async () => {
    const w = newWorld(); const deps = makeDeps(w);
    const job = newJob(w, { stage: 'transcribing', normalizedPath: '/archive/n.ogg', sonioxFileId: 'f9', sonioxTranscriptionId: 't9' });
    await giveUpJob({ ...w.jobs.get(job.id)! }, deps, 'internal-error');
    await giveUpJob({ ...w.jobs.get(job.id)! }, deps, 'internal-error');
    const s = w.jobs.get(job.id)!;
    assert.equal(s.stage, 'failed');
    assert.equal(s.errorCode, 'internal-error');
    assert.ok(w.sonioxCalls.includes('delT:t9') && w.sonioxCalls.includes('delF:f9'));
    assert.equal(s.sonioxFileId, null);
    assert.equal(w.notifications.filter((n) => n.kind === 'processing_failed').length, 1);
  });

  await t('H29 (رفعِ L6، 2026-09-24) سقفِ روزانه پر ⇒ صف (quota-wait)، نه failed؛ هیچ تماسِ Soniox؛ attempts دست‌نخورده؛ صدا حفظ', async () => {
    const w = newWorld(); let asked = 0;
    const deps = makeDeps(w, {}, { quotaWaitMs: async () => { asked++; return 30 * 60_000; } });
    const job = newJob(w, { stage: 'transcribing', normalizedPath: '/archive/n.ogg' });
    w.files.add('/archive/n.ogg');
    const r = await stepJob({ ...w.jobs.get(job.id)! }, deps);
    const s = w.jobs.get(job.id)!;
    assert.equal(r.continueNow, false);
    assert.equal(s.stage, 'transcribing');
    assert.equal(s.errorCode, 'quota-wait');
    assert.equal(s.nextAttemptInMs, 30 * 60_000);
    assert.equal(s.attempts, 0);
    assert.equal(w.sonioxCalls.length, 0);
    assert.ok(w.files.has('/archive/n.ogg'));
    assert.equal(w.notifications.length, 0);
    assert.equal(asked, 1);
  });

  await t('H30 (رفعِ L6) بعد از آزادشدنِ سقف ⇒ همان job ادامه و متن ثبت می‌شود؛ quota-wait پاک می‌شود؛ transcriptionِ در جریان هرگز دوباره چک نمی‌شود', async () => {
    const w = newWorld(); let blocked = true; let asked = 0;
    const deps = makeDeps(w, { pollSequence: ['processing', 'completed'] }, { quotaWaitMs: async () => { asked++; return blocked ? 60_000 : 0; } });
    const job = newJob(w, { stage: 'transcribing', normalizedPath: '/archive/n.ogg' });
    w.files.add('/archive/n.ogg');
    await stepJob({ ...w.jobs.get(job.id)! }, deps);
    assert.equal(w.jobs.get(job.id)!.errorCode, 'quota-wait');
    blocked = false;
    await stepJob({ ...w.jobs.get(job.id)! }, deps); // upload + create
    assert.equal(w.jobs.get(job.id)!.errorCode, null);
    const askedAfterStart = asked;
    await drive(w, deps, job.id);
    assert.equal(asked, askedAfterStart, 'پس از شروعِ رونویسی سقف دوباره چک نشود');
    assert.ok((w.transcripts.get('se-1') || '').includes('سلام'));
  });

  await t('H8 گیرکردنِ transcription بیش از مهلت ⇒ پاک‌سازیِ رویِ Soniox و ساختِ دوباره', async () => {
    const w = newWorld(); const deps = makeDeps(w, { pollSequence: ['processing', 'processing', 'completed'] });
    const job = newJob(w, { stage: 'transcribing', normalizedPath: '/archive/n.ogg', durationMs: 60_000 });
    w.files.add('/archive/n.ogg');
    await stepJob({ ...w.jobs.get(job.id)! }, deps); // upload+create
    await stepJob({ ...w.jobs.get(job.id)! }, deps); // processing
    deps.clock.t += transcriptionDeadlineMs(60_000) + 1;
    await stepJob({ ...w.jobs.get(job.id)! }, deps); // processing + deadline ⇒ cleanup + transient
    assert.ok(w.sonioxCalls.includes('delT:tr-1') && w.sonioxCalls.includes('delF:file-1'));
    assert.equal(w.jobs.get(job.id)!.errorCode, 'soniox-timeout');
    assert.equal(w.jobs.get(job.id)!.sonioxTranscriptionId, null);
    await drive(w, deps, job.id);
    assert.equal(w.jobs.get(job.id)!.stage, 'done');
    assert.ok(w.sonioxCalls.includes('create:file-2'), 'transcriptionِ تازه ساخته شد');
  });

  await t('H9 transcription رویِ Soniox گم شد (404) ⇒ فقط transcription دوباره ساخته می‌شود، فایل دوباره آپلود نمی‌شود', async () => {
    const w = newWorld(); const deps = makeDeps(w, { pollSequence: ['notfound', 'completed'] });
    const job = newJob(w, { stage: 'transcribing', normalizedPath: '/archive/n.ogg', sonioxFileId: 'file-keep', sonioxTranscriptionId: 'tr-old', transcriptionStartedAt: new Date(1_000_000) });
    w.files.add('/archive/n.ogg');
    await drive(w, deps, job.id);
    assert.equal(w.sonioxCalls.filter((c) => c === 'upload').length, 0);
    assert.ok(w.sonioxCalls.includes('create:file-keep'));
    assert.equal(w.jobs.get(job.id)!.stage, 'done');
  });

  await t('H10 Soniox «Invalid audio file» ⇒ failed دائمی (unreadable)، بدونِ retryِ پرهزینه', async () => {
    const w = newWorld(); const deps = makeDeps(w, { pollSequence: ['invalid'] });
    const job = newJob(w, { stage: 'transcribing', normalizedPath: '/archive/n.ogg' });
    w.files.add('/archive/n.ogg');
    await drive(w, deps, job.id);
    assert.equal(w.jobs.get(job.id)!.errorCode, 'unreadable');
    assert.equal(w.sonioxCalls.filter((c) => c.startsWith('create')).length, 1);
  });

  await t('H11 خطایِ گذرایِ دریافتِ متن ⇒ retry؛ متن هرگز «سکوت» تلقی نمی‌شود', async () => {
    const w = newWorld(); const deps = makeDeps(w, { textFails: 1 });
    const job = newJob(w, { stage: 'transcribing', normalizedPath: '/archive/n.ogg' });
    w.files.add('/archive/n.ogg');
    await drive(w, deps, job.id);
    assert.equal(w.transcripts.get('se-1'), 'گوینده ۱: سلام');
    assert.equal(w.notifications.some((n) => n.kind === 'transcript_empty'), false);
  });

  await t('H12 نتیجه‌ی واقعاً خالی (سکوت) ⇒ done + اعلانِ transcript_empty، بدونِ پرونده', async () => {
    const w = newWorld(); const deps = makeDeps(w, { text: '   ' });
    const job = newJob(w);
    await drive(w, deps, job.id);
    assert.equal(w.jobs.get(job.id)!.stage, 'done');
    assert.equal(w.transcripts.has('se-1'), false);
    assert.deepEqual(w.notifications.map((n) => n.kind), ['transcript_empty']);
    assert.equal(w.caseFileCalls, 0);
  });

  await t('H13 پرونده busy ⇒ صبر و تلاشِ دوباره؛ بعد از سقف، job تمام می‌شود (متن سالم می‌ماند)', async () => {
    const w = newWorld();
    let calls = 0;
    const deps = makeDeps(w, {}, { caseFile: async () => (++calls < 3 ? 'busy' : 'generated') });
    const job = newJob(w, { stage: 'case_file', transcriptAppliedAt: new Date() });
    await drive(w, deps, job.id);
    assert.equal(calls, 3);
    assert.equal(w.jobs.get(job.id)!.caseFileStatus, 'done');
    const w2 = newWorld();
    const deps2 = makeDeps(w2, {}, { caseFile: async () => 'busy' });
    const j2 = newJob(w2, { stage: 'case_file', transcriptAppliedAt: new Date() });
    await drive(w2, deps2, j2.id, 100);
    assert.equal(w2.jobs.get(j2.id)!.caseFileStatus, 'busy_gave_up');
    assert.equal(w2.jobs.get(j2.id)!.stage, 'done');
    assert.ok(CASE_FILE_BUSY_MAX >= 10);
  });

  await t('H14 ری‌استارت بعد از نرمال‌سازی (فایلِ نرمال‌شده موجود) ⇒ ffmpeg دوباره اجرا نمی‌شود', async () => {
    const w = newWorld(); let normalizes = 0;
    const deps = makeDeps(w, {}, { media: { probe: async () => ({ ok: true, hasAudio: true, durationMs: 1000 }), normalize: async () => { normalizes++; return { ok: false }; } } });
    const job = newJob(w, { stage: 'normalizing', normalizedPath: '/archive/n.ogg' });
    w.files.add('/archive/n.ogg');
    await drive(w, deps, job.id);
    assert.equal(normalizes, 0);
    assert.equal(w.jobs.get(job.id)!.stage, 'done');
  });

  await t('H15 صدایِ نرمال‌شده منقضی (بعد از ۳۰ روز) ⇒ audio-expired، نه حلقه‌ی بی‌پایان', async () => {
    const w = newWorld(); const deps = makeDeps(w);
    const job = newJob(w, { stage: 'transcribing', normalizedPath: '/archive/gone.ogg' });
    await drive(w, deps, job.id);
    assert.equal(w.jobs.get(job.id)!.errorCode, 'audio-expired');
  });

  await t('H16 jobِ حذف‌شده (جلسه با cascade پاک شد) وسطِ کار ⇒ متن جایی نوشته نمی‌شود', async () => {
    const w = newWorld(); const deps = makeDeps(w);
    const job = newJob(w, { stage: 'transcribing', normalizedPath: '/archive/n.ogg', sonioxFileId: 'f', sonioxTranscriptionId: 't' });
    w.files.add('/archive/n.ogg');
    const snap = { ...w.jobs.get(job.id)! };
    w.jobs.delete(job.id);
    const origUpdate = deps.store.update;
    deps.store.update = async (j, p) => { if (w.jobs.has(j.id)) await origUpdate(j, p); };
    await stepJob(snap, deps);
    assert.equal(w.transcripts.size, 0);
    assert.ok(w.sonioxCalls.includes('delT:t'), 'منابعِ Soniox باز هم پاک شدند');
  });

  await t('H25 (پیش‌فرضِ مالک 2026-09-24) پرونده خاموش ⇒ مسیر با «ذخیره‌ی متن» تمام می‌شود: done/disabled، بدونِ فراخوانیِ پرونده، فقط اعلانِ متن', async () => {
    const w = newWorld(); const deps = makeDeps(w, {}, { caseFileAfterUpload: () => false });
    const job = newJob(w);
    await drive(w, deps, job.id);
    const s = w.jobs.get(job.id)!;
    assert.equal(s.stage, 'done');
    assert.equal(s.caseFileStatus, 'disabled');
    assert.equal(w.caseFileCalls, 0);
    assert.equal(w.transcripts.get('se-1'), 'گوینده ۱: سلام');
    assert.deepEqual(w.notifications.map((n) => n.kind), ['transcript_ready']);
    assert.ok(w.sonioxCalls.includes('delT:tr-1'), 'پاک‌سازیِ Soniox همچنان انجام می‌شود');
  });

  await t('H26 پیش‌فرضِ env: بدونِ UPLOAD_CASE_FILE ⇒ خاموش؛ فقط با «1» روشن', async () => {
    const { uploadCaseFileEnabled } = await import('../server/src/features/audio-upload/jobMachine.js');
    const prev = process.env.UPLOAD_CASE_FILE;
    delete process.env.UPLOAD_CASE_FILE;
    assert.equal(uploadCaseFileEnabled(), false);
    process.env.UPLOAD_CASE_FILE = 'true';
    assert.equal(uploadCaseFileEnabled(), false);
    process.env.UPLOAD_CASE_FILE = '1';
    assert.equal(uploadCaseFileEnabled(), true);
    if (prev === undefined) delete process.env.UPLOAD_CASE_FILE; else process.env.UPLOAD_CASE_FILE = prev;
  });

  await t('H35 (تصمیمِ مالک 2026-09-25) سیاست: پیش‌فرض همه فقط متن؛ با UPLOAD_CASE_FILE_INACTIVE=1 فقط غیرفعال + فیچرِ پرونده + خودکارِ روشن ⇒ پرونده', async () => {
    const { uploadCaseFileAllowed } = await import('../server/src/features/audio-upload/jobMachine.js');
    const prev = process.env.UPLOAD_CASE_FILE;
    const prevI = process.env.UPLOAD_CASE_FILE_INACTIVE;
    delete process.env.UPLOAD_CASE_FILE;
    delete process.env.UPLOAD_CASE_FILE_INACTIVE;
    const base = { clientStatus: 'inactive', caseFileEnabled: true, autoGenerate: true as boolean | null };
    assert.equal(uploadCaseFileAllowed(base), false, 'پیش‌فرض: غیرفعال هم فقط متن');
    process.env.UPLOAD_CASE_FILE_INACTIVE = 'true';
    assert.equal(uploadCaseFileAllowed(base), false, 'فقط «1» روشن می‌کند');
    process.env.UPLOAD_CASE_FILE_INACTIVE = '1';
    assert.equal(uploadCaseFileAllowed(base), true);
    assert.equal(uploadCaseFileAllowed({ ...base, clientStatus: 'active' }), false, 'مراجعِ فعال همچنان فقط متن');
    assert.equal(uploadCaseFileAllowed({ ...base, caseFileEnabled: false }), false, 'حسابِ بدونِ فیچرِ پرونده');
    assert.equal(uploadCaseFileAllowed({ ...base, autoGenerate: false }), false, 'پرونده‌ی خودکار خاموش');
    assert.equal(uploadCaseFileAllowed({ ...base, autoGenerate: null }), false, 'هنوز پاسخ نداده (NULL)');
    process.env.UPLOAD_CASE_FILE = '1';
    assert.equal(uploadCaseFileAllowed({ ...base, clientStatus: 'active' }), true, 'سوئیچِ سراسری همچنان کار می‌کند');
    if (prev === undefined) delete process.env.UPLOAD_CASE_FILE; else process.env.UPLOAD_CASE_FILE = prev;
    if (prevI === undefined) delete process.env.UPLOAD_CASE_FILE_INACTIVE; else process.env.UPLOAD_CASE_FILE_INACTIVE = prevI;
  });

  await t('H36 تصمیمِ پرونده per-job (async) است: jobِ مراجعِ غیرفعال ⇒ case_file ⇒ پرونده یک بار؛ jobِ مراجعِ فعال ⇒ done/disabled', async () => {
    const w = newWorld();
    const seen: string[] = [];
    const deps = makeDeps(w, {}, { caseFileAfterUpload: async (job) => { seen.push(job.clientId); return job.clientId === 'cl-inactive'; } });
    const a = newJob(w, { clientId: 'cl-inactive', sessionId: 'se-a' });
    await drive(w, deps, a.id);
    const b = newJob(w, { clientId: 'cl-active', sessionId: 'se-b', uploadId: 'up-2' });
    await drive(w, deps, b.id);
    const sa = w.jobs.get(a.id)!; const sb = w.jobs.get(b.id)!;
    assert.equal(sa.stage, 'done'); assert.equal(sa.caseFileStatus, 'done');
    assert.equal(sb.stage, 'done'); assert.equal(sb.caseFileStatus, 'disabled');
    assert.equal(w.caseFileCalls, 1, 'پرونده فقط برایِ غیرفعال');
    assert.deepEqual(seen, ['cl-inactive', 'cl-active'], 'تصمیم یک بار، هنگامِ ثبتِ متن');
  });

  // ————— توابعِ خالص —————
  await t('H17 سقفِ poll متناسب با حجم (رفعِ F2): ۱۵ثانیه مثلِ قبل ۱۰ دقیقه، ۵۰MB ⇒ ۶۰ دقیقه', () => {
    assert.equal(pollTimeoutForBytes(45_000), 11 * 60_000);
    assert.equal(pollTimeoutForBytes(50 * 1024 * 1024), 60 * 60_000);
  });

  await t('H18 اندازه‌ی تکه‌ها: تکه‌ی آخر باقی‌مانده است؛ شماره‌ی خارج از بازه -1', () => {
    const C = 4 * 1024 * 1024;
    assert.equal(expectedChunkBytes(10 * 1024 * 1024, C, 0), C);
    assert.equal(expectedChunkBytes(10 * 1024 * 1024, C, 2), 2 * 1024 * 1024);
    assert.equal(expectedChunkBytes(10 * 1024 * 1024, C, 3), -1);
    assert.equal(expectedChunkBytes(C, C, 0), C);
    assert.equal(expectedChunkBytes(C, C, 1), -1);
    assert.equal(expectedChunkBytes(10, C, -1), -1);
  });

  await t('H19 پسوند و parseProbe', () => {
    assert.equal(extensionOf('جلسه ۳.M4A'), 'm4a');
    assert.equal(extensionOf('noext'), '');
    assert.ok(ACCEPTED_EXTENSIONS.includes('amr') && !ACCEPTED_EXTENSIONS.includes('pdf') && !ACCEPTED_EXTENSIONS.includes('m3u'));
    const p = parseProbe('Input #0, mov,mp4, from x:\n  Duration: 01:02:03.50, start\n  Stream #0:1[0x2](und): Audio: aac (LC)');
    assert.equal(p.hasAudio, true);
    assert.equal(p.durationMs, (3600 + 120 + 3.5) * 1000);
    assert.equal(parseProbe('Input #0\n  Stream #0:0: Video: h264').hasAudio, false);
  });

  // ————— آپلودِ چندبخشی (migration 025، 2026-09-25) —————
  const threeParts = [
    { uploadId: 'up-1', path: '/uploads/up-1/source.m4a' },
    { uploadId: 'up-2', path: '/uploads/up-2/source.wav' },
    { uploadId: 'up-3', path: '/uploads/up-3/source.mp4' },
  ];
  await t('H30 چندبخشی: هر بخش probe، normalize با آرایه‌ی مسیرها به همان ترتیب، مدتِ جمع، حذفِ پوشه‌یِ همه‌ی بخش‌ها، یک متن', async () => {
    const w = newWorld(); const probed: string[] = []; let normArg: unknown = null;
    const deps = makeDeps(w, {}, {
      media: {
        async probe(p: string) { probed.push(p); return { ok: true, hasAudio: true, durationMs: 60_000 }; },
        async normalize(src: string | string[], outBase: string, dur: number | null) {
          normArg = { src, dur }; const p = outBase + '.ogg'; w.files.add(p); return { ok: true, outPath: p, mime: 'audio/ogg', durationMs: 180_000 };
        },
      },
      async archive(_s: string, filePath: string) { const p = '/archive/' + path.basename(filePath); w.files.add(p); return { path: p, durationMs: 180_000 }; },
    });
    threeParts.forEach((p) => w.files.add(p.path));
    const job = newJob(w, { sourceParts: threeParts });
    await drive(w, deps, job.id);
    const s = w.jobs.get(job.id)!;
    assert.equal(s.stage, 'done');
    assert.deepEqual(probed, threeParts.map((p) => p.path));
    assert.deepEqual(normArg, { src: threeParts.map((p) => p.path), dur: 180_000 });
    assert.deepEqual([...w.removedUploadDirs].sort(), ['up-1', 'up-2', 'up-3']);
    assert.equal(s.sourceParts, null);
    assert.equal(w.transcripts.get('se-1'), 'گوینده ۱: سلام');
    assert.equal(w.notifications.filter((n) => n.kind === 'transcript_ready').length, 1);
  });
  await t('H31 چندبخشی: مجموعِ بخش‌ها > ۳۰۰ دقیقه ⇒ too-long بدونِ normalize؛ بخشِ گم‌شده ⇒ audio-missing', async () => {
    const w = newWorld(); let norms = 0;
    const deps = makeDeps(w, {}, { media: { probe: async () => ({ ok: true, hasAudio: true, durationMs: 120 * 60_000 }), normalize: async () => { norms++; return { ok: false }; } } });
    threeParts.forEach((p) => w.files.add(p.path));
    const job = newJob(w, { sourceParts: threeParts });
    await drive(w, deps, job.id);
    assert.equal(w.jobs.get(job.id)!.errorCode, 'too-long');
    assert.equal(norms, 0);
    const w2 = newWorld(); const deps2 = makeDeps(w2);
    w2.files.add(threeParts[0].path); w2.files.add(threeParts[2].path);
    const j2 = newJob(w2, { sourceParts: threeParts });
    await drive(w2, deps2, j2.id);
    assert.equal(w2.jobs.get(j2.id)!.errorCode, 'audio-missing');
  });

  // ————— پلنِ B: کیفیتِ فایلِ آپلودی (2026-09-28) —————
  const Q_NOISY: AudioQuality = { p10_db: -25, p95_db: -15, clip_frac: 0, windows: 4, flagged_windows: { noisy: 4 }, flags: ['noisy'] };

  await t('H41 سنجشِ کیفیت در normalizing پیش از آرشیو: flagها رویِ job، فایلِ آرشیو همان خروجیِ نرمال‌سازی (بدونِ فیلتر) و همان به Soniox می‌رود', async () => {
    const w = newWorld();
    const measured: string[] = [];
    const archived: string[] = [];
    const base = makeDeps(w);
    const deps = makeDeps(w, {}, {
      media: { ...base.media, quality: async (p) => { measured.push(p); return Q_NOISY; } },
      archive: async (s, p, m, r) => { archived.push(p); return base.archive(s, p, m, r); },
    });
    const job = newJob(w);
    await drive(w, deps, job.id);
    const s = w.jobs.get(job.id)!;
    assert.equal(s.stage, 'done');
    assert.deepEqual(s.audioQuality?.flags, ['noisy']);
    assert.deepEqual(measured, ['/uploads/up-1/normalized.ogg'], 'رویِ فایلِ نرمال‌شده، پیش از آرشیو');
    assert.deepEqual(archived, ['/uploads/up-1/normalized.ogg'], 'همان فایل (اصلاح‌نشده) آرشیو شد');
    assert.equal(s.normalizedPath, '/archive/normalized.ogg');
    assert.deepEqual(w.notifications.map((n) => n.kind), ['transcript_ready'], 'flagِ تنها هشدار/اعلانِ متفاوت نمی‌سازد');
  });

  await t('H42 سنجشِ شکست‌خورده (throw) ⇒ fail-open: job بی‌تغییر تا done، audioQuality ثبت نمی‌شود', async () => {
    const w = newWorld(); const base = makeDeps(w);
    const deps = makeDeps(w, {}, { media: { ...base.media, quality: async () => { throw new Error('ffmpeg crashed'); } } });
    const job = newJob(w);
    await drive(w, deps, job.id);
    const s = w.jobs.get(job.id)!;
    assert.equal(s.stage, 'done');
    assert.ok(!s.audioQuality);
    assert.equal(w.transcripts.get('se-1'), 'گوینده ۱: سلام');
  });

  await t('H43 ری‌استارت بعد از نرمال‌سازی: سنجه‌ی ثبت‌نشده از فایلِ آرشیو گرفته می‌شود؛ سنجه‌ی موجود دوباره گرفته نمی‌شود', async () => {
    for (const had of [false, true]) {
      const w = newWorld(); const base = makeDeps(w); let calls = 0;
      const deps = makeDeps(w, {}, { media: { ...base.media, quality: async () => { calls++; return Q_NOISY; } } });
      const job = newJob(w, { stage: 'normalizing', normalizedPath: '/archive/n.ogg', ...(had ? { audioQuality: Q_NOISY } : {}) });
      w.files.add('/archive/n.ogg');
      await stepJob({ ...w.jobs.get(job.id)! }, deps);
      assert.equal(calls, had ? 0 : 1, 'had=' + had);
      assert.deepEqual(w.jobs.get(job.id)!.audioQuality?.flags, ['noisy']);
      assert.equal(w.jobs.get(job.id)!.stage, 'transcribing');
    }
  });

  await t('H44 کم‌اطمینانی: سهمِ بالا ⇒ transcript_low_quality + متن ذخیره؛ پایین/نامعلوم ⇒ transcript_ready؛ متنِ علامت‌خورده فقط در meta', async () => {
    const cases: Array<[number | null, string]> = [[0.122, 'transcript_low_quality'], [0.038, 'transcript_ready'], [null, 'transcript_ready']];
    for (const [ratio, kind] of cases) {
      const w = newWorld();
      const deps = makeDeps(w, { lowConfRatio: ratio, markedText: 'گوینده ۱: ⟦سلام؟⟧' }, { caseFileAfterUpload: () => false });
      const job = newJob(w);
      await drive(w, deps, job.id);
      assert.deepEqual(w.notifications.map((n) => n.kind), [kind], 'ratio=' + ratio);
      assert.equal(w.transcripts.get('se-1'), 'گوینده ۱: سلام', 'متنِ خامِ ذخیره‌شده بدونِ علامت');
      assert.equal(w.metas.get(job.id)?.markedText, 'گوینده ۱: ⟦سلام؟⟧');
      assert.equal(w.metas.get(job.id)?.lowConfRatio, ratio);
    }
    // متنِ خالی با سهمِ بالا ⇒ همان transcript_empty (نه هشدارِ کیفیت)
    const w = newWorld(); const deps = makeDeps(w, { text: '', lowConfRatio: 0.9 });
    const job = newJob(w); await drive(w, deps, job.id);
    assert.deepEqual(w.notifications.map((n) => n.kind), ['transcript_empty']);
    assert.equal(w.metas.get(job.id)?.qualityWarning, null);
    // آستانه از deps
    assert.equal(qualityWarningFor(0.05, 0.04), 'low_confidence');
    assert.equal(qualityWarningFor(0.08, 0.08), null, 'مرز: بزرگ‌تر، نه مساوی');
  });

  await t('H45 FileQualityMeter (خالص): سکوت ⇒ no_signal؛ −70dB ⇒ too_quiet؛ سیگنالِ بریده ⇒ clipping؛ نویزِ غالب ⇒ noisy؛ گفتار + نویزِ اتاق ⇒ بدونِ flag', () => {
    const SR = QUALITY.SAMPLE_RATE;
    const gen = (seconds: number, f: (t: number, i: number) => number) => { const a = new Float32Array(seconds * SR); for (let i = 0; i < a.length; i++) a[i] = f(i / SR, i); return a; };
    let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
    const burst = (t: number) => (Math.sin(2 * Math.PI * 0.5 * t) > 0 ? 1 : 0) * (Math.sin(2 * Math.PI * 220 * t) + 0.5 * Math.sin(2 * Math.PI * 440 * t));
    const run = (a: Float32Array, step = 1234) => { const m = new FileQualityMeter(); for (let i = 0; i < a.length; i += step) m.push(a.subarray(i, i + step)); return m.finish()!; };
    const speech = gen(100, (t) => 0.25 * burst(t) + 0.0015 * rnd());
    const r0 = run(speech);
    assert.deepEqual(r0.flags, [], JSON.stringify(r0));
    assert.equal(r0.windows, 4, '۱۰۰ث ⇒ ۳ پنجره‌ی کامل + ۱۰ث (≥ یک‌سوم)');
    assert.deepEqual(run(gen(100, () => 0)).flags, ['no_signal']);
    assert.deepEqual(run(gen(100, (t) => 0.25 * burst(t) * 0.001)).flags, ['too_quiet']);
    assert.deepEqual(run(gen(100, (t) => Math.max(-1, Math.min(1, 30 * burst(t))))).flags, ['clipping']);
    assert.deepEqual(run(gen(100, (t) => 0.25 * burst(t) + 0.33 * rnd())).flags, ['noisy']);
    // تکه‌بندیِ ورودی نتیجه را عوض نمی‌کند (مرزِ قابِ ۵۰ms وسطِ chunk)
    assert.deepEqual(run(speech, 7), run(speech, 16000 * 7));
    // فایلِ کوتاه (کمتر از ۳ پنجره) ⇒ قضاوت رویِ کلِ فایل
    const short = run(gen(20, (t) => 0.25 * burst(t) * 0.001));
    assert.equal(short.windows, 1); assert.deepEqual(short.flags, ['too_quiet']);
    // سکوتِ عادیِ جلسه در یک پنجره از چهار ⇒ بدونِ flag (سهم < ۳۰٪)
    const pause = gen(120, (t) => (t >= 30 && t < 60 ? 0.0015 * rnd() : 0.25 * burst(t) + 0.0015 * rnd()));
    const rp = run(pause);
    assert.equal(rp.flagged_windows.too_quiet, 1); assert.deepEqual(rp.flags, []);
    assert.equal(new FileQualityMeter().finish(), null, 'بدونِ صدا ⇒ null');
    assert.equal(classifyWindow(-54, -55.4, 0), null, 'quiet40ِ فاز ۰B (p95 −55.4) flag نمی‌خورد');
    assert.equal(classifyWindow(-97, -65.5, 0), 'too_quiet', 'quiet50ِ فاز ۰B');
  });

  await t('H46 parseAudioQuality: JSONِ رشته/شی، flagِ ناشناخته حذف، نامعتبر ⇒ null', () => {
    assert.deepEqual(parseAudioQuality(JSON.stringify({ ...Q_NOISY, flags: ['noisy', 'evil<script>'] }))?.flags, ['noisy']);
    assert.deepEqual(parseAudioQuality(Q_NOISY)?.flags, ['noisy']);
    assert.equal(parseAudioQuality('{bad'), null);
    assert.equal(parseAudioQuality(null), null);
    assert.equal(parseAudioQuality({ p10_db: 1 }), null);
  });

  await t('H47 lowConfidenceRatio: فقط توکن‌هایِ محتوادار با confidence؛ بدونِ confidence ⇒ null', () => {
    const toks: AsyncToken[] = [
      { text: 'سل', confidence: 0.99, speaker: 1 }, { text: 'ام', confidence: 0.4, speaker: 1 }, { text: '،', confidence: 0.1, speaker: 1 },
      { text: ' خوب', confidence: 0.95, speaker: 1 }, { text: ' هستی', confidence: 0.6, speaker: 1 },
    ];
    assert.equal(lowConfidenceRatio(toks), 2 / 4);
    assert.equal(lowConfidenceRatio(toks, 0.5), 1 / 4);
    assert.equal(lowConfidenceRatio([{ text: 'سلام' }]), null);
    assert.equal(lowConfidenceRatio([]), null);
  });

  await t('H48 علامت‌گذاریِ ⟦…؟⟧: کلِ واژه (نه تکه‌توکن)، نقطه‌گذاری بیرون، واژه‌هایِ پیاپی یکی، تغییرِ گوینده جدا، متنِ خام بی‌تغییر، نشانگرِ علامت سرِ جا', () => {
    const toks: AsyncToken[] = [
      { text: 'سل', confidence: 0.99, speaker: 1, start_ms: 0 }, { text: 'ام', confidence: 0.3, speaker: 1, start_ms: 100 }, { text: '،', confidence: 0.2, speaker: 1, start_ms: 200 },
      { text: ' خیلی', confidence: 0.4, speaker: 1, start_ms: 300 }, { text: ' خوش', confidence: 0.9, speaker: 1, start_ms: 400 }, { text: ' اومدی', confidence: 0.2, speaker: 1, start_ms: 500 },
      { text: ' ممنون', confidence: 0.1, speaker: 2, start_ms: 2000 }, { text: ' نه', confidence: 0.2, speaker: 2, start_ms: 2100 },
    ];
    const plain = buildTextFromAsyncTokens(toks);
    assert.equal(plain, 'گوینده ۱: سلام، خیلی خوش اومدی\n\nگوینده ۲:  ممنون نه');
    const marked = markedTextFromTokens(toks, [], 0.5);
    assert.equal(marked, 'گوینده ۱: ⟦سلام؟⟧، ⟦خیلی؟⟧ خوش ⟦اومدی؟⟧\n\nگوینده ۲:  ⟦ممنون نه؟⟧');
    assert.equal(markedTextFromTokens(toks, [], 0.05), plain, 'هیچ واژه‌ای زیرِ آستانه ⇒ همان متنِ خام');
    assert.equal(toks[1].text, 'ام', 'توکن‌هایِ ورودی mutate نمی‌شوند');
    assert.equal(markUncertainTokens([{ text: 'سلام' }], 0.5)[0].text, 'سلام', 'بدونِ confidence ⇒ بدونِ علامت');
    const withSign = markedTextFromTokens(toks, [{ sign_type: 'crying', offset_ms: 1000 } as any], 0.5);
    assert.ok(/اومدی؟⟧\n\n\[علامت · [^\]]+\]\n\nگوینده ۲/.test(withSign), withSign);
  });

  await t('H49 isTransientLlmError: 402 (اعتبارِ OpenRouter تمام شده، فاز ۰B) گذراست؛ 400/401/403/404 نه', async () => {
    const { isTransientLlmError } = await import('../server/src/llm/jsonCall.js');
    const withStatus = (status: number) => Object.assign(new Error('x'), { status });
    assert.equal(isTransientLlmError(withStatus(402)), true);
    for (const s of [400, 401, 403, 404, 422]) assert.equal(isTransientLlmError(withStatus(s)), false, String(s));
  });

  // ————— ffmpegِ واقعی —————
  let ffmpegOk = true;
  try { execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { ffmpegOk = false; }
  const dir = mkdtempSync(path.join(tmpdir(), 'feelia-up-'));
  const ff = (args: string[]) => execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'ignore' });
  try {
    if (!ffmpegOk) {
      console.log('SKIP H20–H24 (ffmpeg نصب نیست)');
    } else {
      ff(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=4', '-ar', '44100', path.join(dir, 'a.wav')]);
      const formats: Array<[string, string[]]> = [
        ['a.m4a', ['-c:a', 'aac']], ['a.mp3', []], ['a.ogg', ['-c:a', 'libopus']], ['a.flac', []],
        ['a.wma', ['-c:a', 'wmav2']], ['a.webm', ['-c:a', 'libopus']],
      ];
      for (const [name, codec] of formats) ff(['-i', path.join(dir, 'a.wav'), ...codec, path.join(dir, name)]);
      ff(['-f', 'lavfi', '-i', 'testsrc=duration=4:size=160x120', '-i', path.join(dir, 'a.wav'), '-shortest', '-c:v', 'libx264', '-c:a', 'aac', path.join(dir, 'video.mp4')]);
      ff(['-f', 'lavfi', '-i', 'testsrc=duration=2:size=160x120', '-c:v', 'libx264', path.join(dir, 'silent-video.mp4')]);
      writeFileSync(path.join(dir, 'fake.mp3'), '%PDF-1.4 not audio at all');
      writeFileSync(path.join(dir, 'corrupt.m4a'), Buffer.from(Array.from({ length: 20000 }, (_, i) => (i * 7919) % 256)));
      writeFileSync(path.join(dir, 'list.mp3'), '#EXTM3U\nhttp://example.invalid/a.mp3\n');

      await t('H20 probe: wav/m4a/mp3/ogg/flac/wma/webm/ویدیوی mp4 همه صدا دارند با مدتِ درست', async () => {
        for (const name of ['a.wav', 'a.m4a', 'a.mp3', 'a.ogg', 'a.flac', 'a.wma', 'a.webm', 'video.mp4']) {
          const r = await probeMedia(path.join(dir, name));
          assert.equal(r.ok, true, name + ' ' + r.reason);
          assert.ok(r.durationMs !== null && Math.abs(r.durationMs - 4000) < 300, name + ' duration=' + r.durationMs);
        }
      });
      await t('H21 probe: ویدیوی بی‌صدا ⇒ no-audio؛ فایلِ خراب ⇒ unreadable؛ playlist ⇒ unreadable (whitelist)', async () => {
        assert.equal((await probeMedia(path.join(dir, 'silent-video.mp4'))).reason, 'no-audio');
        assert.equal((await probeMedia(path.join(dir, 'corrupt.m4a'))).reason, 'unreadable');
        assert.equal((await probeMedia(path.join(dir, 'list.mp3'))).reason, 'unreadable');
      });
      await t('H22 sniff: PDF با پسوندِ mp3 رد می‌شود؛ صدایِ واقعی نه', () => {
        assert.equal(sniffObviouslyNotAudio(path.join(dir, 'fake.mp3')), 'pdf');
        assert.equal(sniffObviouslyNotAudio(path.join(dir, 'a.m4a')), null);
        assert.equal(sniffObviouslyNotAudio(path.join(dir, 'list.mp3')), 'playlist');
      });
      await t('H23 normalize: ویدیوی mp4 ⇒ Opus/Ogg mono 16kHz، مدت حفظ می‌شود', async () => {
        const r = await normalizeAudio(path.join(dir, 'video.mp4'), path.join(dir, 'norm'), 4000);
        assert.equal(r.ok, true, r.error);
        assert.equal(r.mime, 'audio/ogg');
        assert.ok(r.durationMs !== null && Math.abs((r.durationMs || 0) - 4000) < 300);
        const info = await probeMedia(r.outPath!);
        assert.equal(info.ok, true);
        assert.equal(readFileSync(r.outPath!).subarray(0, 4).toString('latin1'), 'OggS');
      });
      await t('H24 normalize: فایلِ WAVِ بزرگ ⇒ خروجیِ بسیار کوچک‌تر (۳۰ ثانیه)', async () => {
        ff(['-f', 'lavfi', '-i', 'anoisesrc=d=30:c=pink:a=0.1', '-ar', '48000', '-ac', '2', path.join(dir, 'big.wav')]);
        const src = statSync(path.join(dir, 'big.wav')).size;
        const r = await normalizeAudio(path.join(dir, 'big.wav'), path.join(dir, 'big-norm'), 30000);
        assert.equal(r.ok, true, r.error);
        const out = statSync(r.outPath!).size;
        assert.ok(out * 20 < src, `src=${src} out=${out}`);
      });
      await t('H33 normalize چندبخشی (ffmpegِ واقعی): m4aِ استریو ۴۴k + wavِ mono 8k سکوت + ویدیوی mp4 ⇒ یک Ogg، مدتِ جمع، ترتیب حفظ', async () => {
        ff(['-f', 'lavfi', '-i', 'anullsrc=r=8000:cl=mono', '-t', '3', path.join(dir, 'silence.wav')]);
        const vol = (file: string, ss: number) => {
          const r = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-ss', String(ss), '-t', '1', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
          const m = /mean_volume:\s*(-?[\d.]+|-inf)/.exec(r.stderr || '');
          return m ? (m[1] === '-inf' ? -200 : Number(m[1])) : -200;
        };
        const r = await normalizeAudio([path.join(dir, 'a.m4a'), path.join(dir, 'silence.wav'), path.join(dir, 'video.mp4')], path.join(dir, 'multi'), 11000);
        assert.equal(r.ok, true, r.error);
        assert.equal(readFileSync(r.outPath!).subarray(0, 4).toString('latin1'), 'OggS');
        assert.ok(r.durationMs !== null && Math.abs((r.durationMs || 0) - 11000) < 400, 'duration=' + r.durationMs);
        // ترتیب: ۰–۴ث تُن، ۴–۷ث سکوت، ۷–۱۱ث تُن.
        assert.ok(vol(r.outPath!, 1) > -40, 'first part audible');
        assert.ok(vol(r.outPath!, 5) < -60, 'second part silent');
        assert.ok(vol(r.outPath!, 8.5) > -40, 'third part audible');
        const r2 = await normalizeAudio([path.join(dir, 'silence.wav'), path.join(dir, 'a.m4a')], path.join(dir, 'multi2'), 7000);
        assert.ok(vol(r2.outPath!, 1) < -60 && vol(r2.outPath!, 4.5) > -40, 'order follows the array');
      });
      await t('H34 normalize چندبخشی: بخشِ playlist (whitelist برایِ هر ورودی) ⇒ شکست، بدونِ خواندنِ URL', async () => {
        const r = await normalizeAudio([path.join(dir, 'a.m4a'), path.join(dir, 'list.mp3')], path.join(dir, 'multi-bad'), 8000);
        assert.equal(r.ok, false);
      });
      await t('H50 کیفیت با ffmpegِ واقعی (مسیرِ واقعی: normalizeAudio ⇒ measureAudioQuality): تمیز/اتاق/−40dB/mp3/۸kHz بدونِ flag؛ −50dB ⇒ too_quiet؛ +30dB ⇒ clipping؛ SNR −5 ⇒ noisy', async () => {
        // «گفتارِ» ساختگی: تُنِ ۲۲۰Hz با هارمونیک، ۱ث روشن/۱ث خاموش، + نویزِ اتاق (≈ −61dB)؛ ۱۰۰ث تا ۴ پنجره
        // ویرگولِ داخلِ عبارت در filtergraph جداکننده‌ی فیلتر است ⇒ «\,»
        const SIG = '0.25*(gt(sin(2*PI*0.5*t)\\,0))*(sin(2*PI*220*t)+0.5*sin(2*PI*440*t))';
        ff(['-f', 'lavfi', '-i', `aevalsrc=${SIG}+0.0015*(random(0)*2-1):s=48000:d=100`, '-c:a', 'pcm_s16le', path.join(dir, 'q-clean.wav')]);
        ff(['-f', 'lavfi', '-i', `aevalsrc=${SIG}+0.33*(random(0)*2-1):s=48000:d=100`, '-c:a', 'pcm_s16le', path.join(dir, 'q-noisy.wav')]);
        ff(['-i', path.join(dir, 'q-clean.wav'), '-af', 'volume=-40dB', '-c:a', 'pcm_s16le', path.join(dir, 'q-quiet40.wav')]);
        ff(['-i', path.join(dir, 'q-clean.wav'), '-af', 'volume=-50dB', '-c:a', 'pcm_s16le', path.join(dir, 'q-quiet50.wav')]);
        ff(['-i', path.join(dir, 'q-clean.wav'), '-af', 'volume=30dB', '-c:a', 'pcm_s16le', path.join(dir, 'q-clip.wav')]);
        ff(['-i', path.join(dir, 'q-clean.wav'), '-c:a', 'libmp3lame', '-b:a', '32k', path.join(dir, 'q-mp3.mp3')]);
        ff(['-i', path.join(dir, 'q-clean.wav'), '-af', 'highpass=f=300,lowpass=f=3400', '-ar', '8000', '-c:a', 'pcm_mulaw', path.join(dir, 'q-phone.wav')]);
        const expect: Array<[string, string[]]> = [
          ['q-clean.wav', []], ['q-quiet40.wav', []], ['q-mp3.mp3', []], ['q-phone.wav', []],
          ['q-quiet50.wav', ['too_quiet']], ['q-clip.wav', ['clipping']], ['q-noisy.wav', ['noisy']],
        ];
        for (const [name, flags] of expect) {
          const n = await normalizeAudio(path.join(dir, name), path.join(dir, 'qn-' + name.replace(/\W/g, '')), 100_000);
          assert.equal(n.ok, true, name + ' ' + n.error);
          const q = await measureAudioQuality(n.outPath!, 100_000);
          assert.ok(q, name + ' ⇒ null');
          assert.deepEqual(q!.flags, flags, name + ' ' + JSON.stringify(q));
          assert.ok(q!.windows >= 3, name + ' windows=' + q!.windows);
        }
      });
      await t('H51 measureAudioQuality: فایلِ خراب/ناموجود ⇒ null (fail-open، بدونِ throw)', async () => {
        assert.equal(await measureAudioQuality(path.join(dir, 'corrupt.m4a')), null);
        assert.equal(await measureAudioQuality(path.join(dir, 'does-not-exist.ogg')), null);
        assert.equal(await measureAudioQuality(path.join(dir, 'list.mp3')), null, 'whitelist: playlist خوانده نمی‌شود');
      });
    }
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }

  await t('H38 خطایِ گذرایِ LLM در مرحله‌ی پرونده ⇒ waiting/case-file-retry با فاصله‌ی ۶۰ث، بدونِ اعلانِ شکست؛ تلاشِ بعد موفق ⇒ done/done', async () => {
    const w = newWorld();
    const calls: boolean[] = [];
    let n = 0;
    const deps = makeDeps(w, {}, { caseFile: async (_c, _t, ctx) => { calls.push(ctx.lastAttempt); w.caseFileCalls++; return n++ === 0 ? 'transient' : 'generated'; } });
    const job = newJob(w);
    // قدم‌به‌قدم تا اولین فراخوانیِ پرونده (drive بعد از WAIT فوراً ادامه می‌دهد و تلاشِ دوم را هم اجرا می‌کرد).
    for (let i = 0; i < 20 && w.caseFileCalls === 0; i++) await stepJob({ ...w.jobs.get(job.id)! }, deps);
    let s = w.jobs.get(job.id)!;
    assert.equal(s.stage, 'case_file');
    assert.equal(s.caseFileStatus, 'waiting');
    assert.equal(s.errorCode, 'case-file-retry');
    assert.equal(s.nextAttemptInMs, 60_000);
    assert.ok(!w.notifications.some((x) => x.kind === 'processing_failed'));
    await drive(w, deps, job.id);
    s = w.jobs.get(job.id)!;
    assert.equal(s.stage, 'done'); assert.equal(s.caseFileStatus, 'done');
    assert.deepEqual(calls, [false, false]);
  });

  await t('H39 خطایِ گذرایِ مداومِ LLM ⇒ ۳ تلاشِ دوباره (۱، ۵، ۱۵ دقیقه) و تلاشِ چهارم با lastAttempt=true ⇒ done/failed؛ متن دست‌نخورده', async () => {
    const w = newWorld();
    const calls: boolean[] = [];
    const delays: number[] = [];
    const deps = makeDeps(w, {}, { caseFile: async (_c, _t, ctx) => { calls.push(ctx.lastAttempt); return ctx.lastAttempt ? 'failed' : 'transient'; } });
    const origUpdate = deps.store.update;
    deps.store.update = async (j, p) => { if (p.errorCode === 'case-file-retry' && p.nextAttemptInMs) delays.push(p.nextAttemptInMs); await origUpdate(j, p); };
    const job = newJob(w);
    await drive(w, deps, job.id);
    const s = w.jobs.get(job.id)!;
    assert.equal(s.stage, 'done'); assert.equal(s.caseFileStatus, 'failed');
    assert.deepEqual(calls, [false, false, false, true]);
    assert.deepEqual(delays, [60_000, 5 * 60_000, 15 * 60_000]);
    assert.equal(w.transcripts.get('se-1'), 'گوینده ۱: سلام');
  });

  await t('H40 isTransientLlmError: شبکه/timeout/429/5xx گذرا؛ 400/401/404 و خطایِ کلید نه', async () => {
    const { isTransientLlmError } = await import('../server/src/llm/jsonCall.js');
    const withStatus = (status: number) => Object.assign(new Error('x'), { status });
    assert.equal(isTransientLlmError(new Error('Invalid response body while trying to fetch https://openrouter.ai/api/v1/chat/completions: read ECONNRESET')), true);
    assert.equal(isTransientLlmError(Object.assign(new Error('Connection error.'), { name: 'APIConnectionError' })), true);
    assert.equal(isTransientLlmError(Object.assign(new Error('Request timed out.'), { name: 'APIConnectionTimeoutError' })), true);
    assert.equal(isTransientLlmError(withStatus(429)), true);
    assert.equal(isTransientLlmError(withStatus(502)), true);
    assert.equal(isTransientLlmError(withStatus(400)), false);
    assert.equal(isTransientLlmError(withStatus(401)), false);
    assert.equal(isTransientLlmError(withStatus(404)), false);
    assert.equal(isTransientLlmError(new Error('کلید OpenRouter روی سرور تنظیم نشده')), false);
  });

  await t('H37 assembleUpload با ۳۰ تکه: فایلِ نهایی بایت‌به‌بایت درست، بدونِ MaxListenersExceededWarning (FINDINGِ لاگِ production 2026-09-25)', async () => {
    const { writeChunk, assembleUpload, removeUploadDir, UPLOAD_ROOT } = await import('../server/src/features/audio-upload/uploadStore.js');
    const dataDir = path.dirname(UPLOAD_ROOT);
    const hadData = existsSync(dataDir);
    const warnings: string[] = [];
    const onWarn = (w: Error) => { if (w.name === 'MaxListenersExceededWarning') warnings.push(w.message); };
    process.on('warning', onWarn);
    const id = '00000000-0000-4000-8000-' + String(Date.now()).slice(-12).padStart(12, '0');
    try {
      const CH = 1024; const N = 30; const parts: Buffer[] = [];
      for (let n = 0; n < N; n++) { const b = Buffer.alloc(CH, n); parts.push(b); writeChunk(id, n, b); }
      const out = await assembleUpload(id, N, CH * N, 'm4a');
      await new Promise((r) => setImmediate(r));
      assert.ok(readFileSync(out).equals(Buffer.concat(parts)), 'ترتیب و محتوایِ تکه‌ها حفظ شد');
      assert.deepEqual(warnings, []);
    } finally {
      process.off('warning', onWarn);
      removeUploadDir(id);
      if (!hadData) rmSync(dataDir, { recursive: true, force: true });
    }
  });

  // ——— یادداشتِ صوتیِ پیش از جلسه (2026-09-29، REQ-066) ———
  await t('H52 نامِ فایلِ صفِ pre-note: مارکرِ `.prenote.` فقط خودش را می‌شناسد و seq/run/mime/sessionId درست پارس می‌شود', () => {
    const sid = '11111111-2222-3333-4444-555555555555';
    const f = `${sid}-000000-pnabc123-1790703025765.prenote.webm`;
    assert.ok(isPreNoteFile(f));
    assert.ok(!isNoteFile(f) && !isArchiveFile(f) && !isNoteArchiveFile(f) && !isLateFile(f), 'با purposeهایِ دیگر اشتباه نمی‌شود');
    for (const other of ['.note.', '.archive.', '.notearchive.', '.late.', '.']) {
      assert.ok(!isPreNoteFile(`${sid}-000000-r1-1790703025765${other}webm`), other);
    }
    assert.equal(sessionIdFromFilename(f), sid);
    assert.equal(seqFromFilename(f), 0);
    assert.equal(runIdFromFilename(f), 'pnabc123');
    assert.equal(mimeFromFilename(f), 'audio/webm');
    assert.equal(mimeFromFilename(`${sid}-000002-pnx-1790703025765.prenote.ogg`), 'audio/ogg');
    // (2026-10-01) جاروبِ ۲۴ساعته همان kindِ processQueue را می‌گیرد — یادداشتِ پیش از جلسه هرگز 'session' نیست.
    assert.equal(archiveKindForFile(f), 'prenote');
    assert.equal(archiveKindForFile(`${sid}-000000-r1-1790703025765.note.webm`), 'note');
    assert.equal(archiveKindForFile(`${sid}-000000-r1-1790703025765.notearchive.webm`), 'note');
    for (const s of ['.archive.', '.late.', '.']) assert.equal(archiveKindForFile(`${sid}-000000-r1-1790703025765${s}webm`), 'session', s);
  });
  await t('H53 متنِ رونویسیِ بدونِ گوینده (diarize خاموش): بدونِ «گوینده N:»؛ با گوینده همان قراردادِ قبلی', () => {
    const noSpeaker = [{ text: 'سلام' }, { text: ' امروز' }, { text: ' دیرتر' }, { text: ' می‌آید.' }] as AsyncToken[];
    assert.equal(buildTextFromAsyncTokens(noSpeaker), 'سلام امروز دیرتر می‌آید.');
    const withSpeaker = [{ text: 'سلام', speaker: 1 }, { text: ' خوبید؟', speaker: 1 }, { text: 'بله', speaker: 2 }] as AsyncToken[];
    assert.equal(buildTextFromAsyncTokens(withSpeaker), 'گوینده ۱: سلام خوبید؟\n\nگوینده ۲: بله');
  });

  // ——— Session Data Engine، فاز Q-U: «کیفیت به عدد» (2026-10-01) ———
  // توکنِ ساختگی هر stepms یک «واژه»؛ گوینده هر turnWords واژه عوض می‌شود.
  const toks = (from: number, to: number, o: { speakers?: number[]; every?: number; turnWords?: number; conf?: number } = {}) => {
    const out: TimedToken[] = []; const sp = o.speakers || [1, 2]; const step = o.every || 400; const tw = o.turnWords || 8;
    let i = 0;
    for (let at = from; at < to; at += step, i++) out.push({ text: ' واژه', speaker: sp[Math.floor(i / tw) % sp.length], start_ms: at, end_ms: at + 300, confidence: o.conf ?? 0.95 });
    return out;
  };
  const FULL: Array<[number, number]> = [[0, 120_000]];

  await t('H54 metrics: پوششِ کامل ⇒ ۱، بدونِ پرچم، ۲ گوینده = حاضرین', () => {
    const m = computeTranscriptMetrics({ tokens: toks(0, 120_000), speechSpans: FULL, durationMs: 120_000, lowConfRatio: 0.01, expectedSpeakers: 2 });
    assert.equal(m.coverage, 1, JSON.stringify(m));
    assert.deepEqual(m.flags, []);
    assert.equal(m.speakers_found, 2); assert.equal(m.speakers_expected, 2);
    assert.equal(m.words, 300); assert.equal(m.words_per_min, 150);
    assert.equal(m.short_turn_ratio, 0);
    assert.equal(m.head_gap_ms, 0); assert.equal(m.tail_gap_ms, 0); assert.equal(m.uncovered_gaps, 0);
  });

  await t('H55 metrics: حفره‌ی ۳۰ثانیه‌ایِ وسط ⇒ uncovered_gap + low_coverage؛ سر و ته سالم', () => {
    const m = computeTranscriptMetrics({ tokens: [...toks(0, 40_000), ...toks(70_000, 120_000)], speechSpans: FULL, durationMs: 120_000, lowConfRatio: null });
    assert.deepEqual(m.flags.sort(), ['low_coverage', 'uncovered_gap'], JSON.stringify(m));
    assert.equal(m.uncovered_gaps, 1);
    assert.ok(m.longest_uncovered_ms! > 28_000 && m.longest_uncovered_ms! < 30_000, String(m.longest_uncovered_ms));
    assert.ok(m.coverage! > 0.74 && m.coverage! < 0.77, String(m.coverage));
    assert.equal(m.head_gap_ms, 0); assert.equal(m.tail_gap_ms, 0);
    // حفره‌ی کوتاه (۸ث) ⇒ نه پرچمِ حفره، نه low_coverage
    const s = computeTranscriptMetrics({ tokens: [...toks(0, 60_000), ...toks(68_000, 120_000)], speechSpans: FULL, durationMs: 120_000, lowConfRatio: null });
    assert.deepEqual(s.flags, [], JSON.stringify(s));
    // سکوتِ واقعی (بدونِ صدا) بینِ دو بخش حفره نیست
    const q = computeTranscriptMetrics({ tokens: [...toks(0, 40_000), ...toks(70_000, 120_000)], speechSpans: [[0, 40_000], [70_000, 120_000]], durationMs: 120_000, lowConfRatio: null });
    assert.deepEqual(q.flags, [], JSON.stringify(q)); assert.equal(q.coverage, 1);
  });

  await t('H56 metrics: ابتدا/انتهایِ بدونِ متن ⇒ head_gap/tail_gap (نه uncovered_gap)', () => {
    const m = computeTranscriptMetrics({ tokens: toks(20_000, 100_000), speechSpans: FULL, durationMs: 120_000, lowConfRatio: null });
    assert.ok(m.flags.includes('head_gap') && m.flags.includes('tail_gap'), JSON.stringify(m));
    assert.ok(!m.flags.includes('uncovered_gap'));
    assert.ok(m.head_gap_ms! > 19_000 && m.tail_gap_ms! > 19_000);
  });

  await t('H57 metrics: گوینده‌ی ادغام‌شده/اضافه در برابرِ حاضرین؛ برچسبِ تصادفیِ کم‌سهم شمرده نمی‌شود؛ نوبت‌هایِ تکه‌تکه', () => {
    const stray: TimedToken[] = [{ text: ' واژه', speaker: 3, start_ms: 50_000, end_ms: 50_300 }, { text: ' واژه', speaker: 3, start_ms: 50_400, end_ms: 50_700 }];
    const merged = computeTranscriptMetrics({ tokens: [...toks(0, 120_000), ...stray].sort((a, b) => a.start_ms! - b.start_ms!), speechSpans: FULL, durationMs: 120_000, lowConfRatio: null, expectedSpeakers: 3 });
    assert.equal(merged.speakers_found, 2); assert.equal(merged.speakers_raw, 3);
    assert.ok(merged.flags.includes('speakers_merged'), JSON.stringify(merged.flags));
    const extra = computeTranscriptMetrics({ tokens: toks(0, 120_000, { speakers: [1, 2, 3] }), speechSpans: FULL, durationMs: 120_000, lowConfRatio: null, expectedSpeakers: 2 });
    assert.ok(extra.flags.includes('speakers_extra'));
    const unknown = computeTranscriptMetrics({ tokens: toks(0, 120_000, { speakers: [1] }), speechSpans: FULL, durationMs: 120_000, lowConfRatio: null });
    assert.ok(!unknown.flags.some((f) => f.startsWith('speakers_')), 'حاضرینِ نامعلوم ⇒ قضاوت نمی‌شود');
    const frag = computeTranscriptMetrics({ tokens: toks(0, 120_000, { turnWords: 1 }), speechSpans: FULL, durationMs: 120_000, lowConfRatio: null });
    assert.ok(frag.flags.includes('fragmented_turns')); assert.equal(frag.short_turn_ratio, 1);
  });

  await t('H58 metrics: بازه‌هایِ نامعلوم/توکنِ بی‌زمان ⇒ پوشش null؛ صدا بدونِ هیچ متن ⇒ پوشش ۰؛ واژه‌هایِ نامطمئن شمرده می‌شوند', () => {
    const a = computeTranscriptMetrics({ tokens: toks(0, 60_000), speechSpans: null, durationMs: 60_000, lowConfRatio: null });
    assert.equal(a.coverage, null); assert.equal(a.speech_ms, null); assert.deepEqual(a.flags, []);
    const b = computeTranscriptMetrics({ tokens: toks(0, 60_000).map((x) => ({ text: x.text, speaker: x.speaker })), speechSpans: FULL, durationMs: 120_000, lowConfRatio: null });
    assert.equal(b.coverage, null);
    const c = computeTranscriptMetrics({ tokens: [], speechSpans: FULL, durationMs: 120_000, lowConfRatio: null });
    assert.equal(c.coverage, 0); assert.ok(c.flags.includes('low_coverage'));
    const d = computeTranscriptMetrics({ tokens: toks(0, 4_000, { conf: 0.4 }), speechSpans: null, durationMs: 4_000, lowConfRatio: 1 });
    assert.equal(d.uncertain_words, 10); assert.equal(d.low_conf_ratio, 1);
    assert.ok(METRICS.LOW_COVERAGE > 0 && METRICS.LOW_COVERAGE < 1);
  });

  await t('H59 speechSpans (VAD) خالص: مکثِ کوتاه پل می‌شود، تقِ ۱۰۰ms حذف، نویزِ غالب ⇒ null', () => {
    const frames = new Array(400).fill(-60);
    for (let i = 0; i < 40; i++) frames[i] = -30;        // 0–2s
    for (let i = 50; i < 80; i++) frames[i] = -30;       // 2.5–4s (مکثِ ۵۰۰ms)
    frames[200] = frames[201] = -30;                     // تقِ ۱۰۰ms
    assert.deepEqual(speechSpans(frames, 50, -60, -30), [[0, 4000]]);
    assert.equal(speechSpans(frames, 50, -40, -35), null, 'p95 − p10 < 12dB');
    assert.equal(speechSpans([], 50, -60, -30), null);
  });

  await t('H60 FileQualityMeter ⇒ speech_spans: سکوتِ ۳۰ث در میانه بدونِ بازه‌ی صدادار؛ تکه‌بندیِ ورودی بی‌اثر', () => {
    const SR = QUALITY.SAMPLE_RATE;
    let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
    const a = new Float32Array(120 * SR);
    for (let i = 0; i < a.length; i++) { const tt = i / SR; a[i] = (tt >= 30 && tt < 60 ? 0 : 0.25 * Math.sin(2 * Math.PI * 220 * tt)) + 0.0015 * rnd(); }
    const run = (step: number) => { const m = new FileQualityMeter(); for (let i = 0; i < a.length; i += step) m.push(a.subarray(i, i + step)); return m.finish()!; };
    const q = run(4321);
    const spans = q.speech_spans!;
    assert.ok(spans && spans.length >= 2, JSON.stringify(spans));
    assert.ok(!spans.some(([s, e]) => s < 59_000 && e > 31_000), 'میانه‌یِ ساکت صدادار نیست: ' + JSON.stringify(spans));
    const tot = spans.reduce((x, [s, e]) => x + e - s, 0);
    assert.ok(tot > 85_000 && tot <= 90_100, String(tot));
    assert.deepEqual(run(997).speech_spans, spans);
  });

  await t('H61 ماشینِ حالت: متریک از توکن + بازه‌هایِ صدادار + حاضرین ⇒ meta.metrics؛ خطایِ حاضرین fail-open؛ بدونِ توکن ⇒ null', async () => {
    const q: AudioQuality = { p10_db: -60, p95_db: -20, clip_frac: 0, windows: 2, flagged_windows: {}, flags: [], speech_spans: [[0, 60_000]] };
    const w = newWorld(); const base = makeDeps(w);
    const deps = makeDeps(w, { tokens: toks(0, 30_000) }, { media: { ...base.media, quality: async () => q }, expectedSpeakers: async () => 3, caseFileAfterUpload: () => false });
    const job = newJob(w); await drive(w, deps, job.id);
    const m = w.metas.get(job.id)?.metrics!;
    assert.ok(m, 'metrics ثبت شد');
    assert.equal(m.speakers_expected, 3);
    assert.ok(m.flags.includes('speakers_merged') && m.flags.includes('tail_gap') && m.flags.includes('low_coverage'), JSON.stringify(m.flags));
    assert.equal(w.jobs.get(job.id)!.stage, 'done');
    assert.equal(w.transcripts.get('se-1'), 'گوینده ۱: سلام', 'متن بی‌تغییر');
    // حاضرین throw ⇒ متریک با حاضرینِ نامعلوم
    const w2 = newWorld(); const b2 = makeDeps(w2);
    const d2 = makeDeps(w2, { tokens: toks(0, 30_000) }, { media: { ...b2.media, quality: async () => q }, expectedSpeakers: async () => { throw new Error('db'); } });
    const j2 = newJob(w2); await drive(w2, d2, j2.id);
    assert.equal(w2.metas.get(j2.id)?.metrics?.speakers_expected, null);
    assert.equal(w2.jobs.get(j2.id)!.stage, 'done');
    // getText رشته (بدونِ توکن) ⇒ metrics null
    const w3 = newWorld(); const d3 = makeDeps(w3); const j3 = newJob(w3); await drive(w3, d3, j3.id);
    assert.equal(w3.metas.get(j3.id)?.metrics, null);
  });

  await t('H62 کارتِ تشخیصِ ادمین: یافته‌ها از متریک؛ null ⇒ هیچ؛ JSONِ ذخیره‌شده roundtrip، نامعتبر ⇒ null', () => {
    assert.deepEqual(metricsFindings(null), []);
    const m = computeTranscriptMetrics({ tokens: [...toks(0, 40_000), ...toks(70_000, 120_000)], speechSpans: FULL, durationMs: 120_000, lowConfRatio: 0.02, expectedSpeakers: 3 });
    const f = metricsFindings(parseTranscriptMetrics(JSON.stringify(m)));
    assert.ok(f.some((x) => x.level === 'error' && x.text.startsWith('پوششِ متن')), JSON.stringify(f));
    assert.ok(f.some((x) => x.level === 'warn' && x.text.includes('وسطِ جلسه')));
    assert.ok(f.some((x) => x.level === 'warn' && x.text.includes('کمتر از حاضرین')));
    assert.equal(parseTranscriptMetrics('{bad'), null);
    assert.equal(parseTranscriptMetrics({ v: 2, flags: [] }), null);
    const unknownCov = metricsFindings(computeTranscriptMetrics({ tokens: toks(0, 10_000), speechSpans: null, durationMs: 10_000, lowConfRatio: null }));
    assert.ok(unknownCov[0].text.includes('سنجیده نشد'));
  });

  await t('H63 نمایِ کلیِ کیفیتِ ادمین: بدترین اول (پرچمِ بیشتر، بعد پوششِ کمتر، نامعلوم آخر) + جمع‌بندی (میانه/کمینه/شمارِ پرچم)', () => {
    const mk = (id: string, coverage: number | null, flags: string[], lc: number | null = 0.02) => ({
      job_id: id, session_id: 's-' + id, session_num: 1, client_code: 'C', therapist_id: 't', therapist_name: 'T',
      created_at: '2026-10-01T10:00:00.000Z', duration_ms: 60_000,
      metrics: { ...computeTranscriptMetrics({ tokens: [], speechSpans: null, durationMs: 60_000, lowConfRatio: lc }), coverage, flags: flags as any },
    });
    const rows = [mk('a', 0.99, []), mk('b', 0.6, ['low_coverage', 'uncovered_gap']), mk('c', null, []), mk('d', 0.9, ['speakers_merged']), mk('e', 0.8, ['speakers_merged'], null)];
    assert.deepEqual(rankQualityRows(rows).map((r) => r.job_id), ['b', 'e', 'd', 'a', 'c']);
    const s = summarizeQuality(rows);
    assert.equal(s.sessions, 5); assert.equal(s.flagged, 3);
    assert.equal(s.coverage_median, 0.85); assert.equal(s.coverage_min, 0.6);
    assert.equal(s.low_conf_median, 0.02);
    assert.deepEqual(s.flag_counts, { low_coverage: 1, uncovered_gap: 1, speakers_merged: 2 });
    assert.deepEqual(summarizeQuality([]), { sessions: 0, coverage_median: null, coverage_min: null, low_conf_median: null, flagged: 0, flag_counts: {} });
  });

  await t('H64 jobView.transcript_notes: فقط پرچم‌هایِ کامل‌بودن برایِ تراپیست؛ null/نامعتبر ⇒ []؛ عدد نشت نمی‌کند', () => {
    const m = computeTranscriptMetrics({ tokens: [], speechSpans: null, durationMs: 120_000, lowConfRatio: null });
    const v = jobView({ id: 'j', transcript_metrics: JSON.stringify({ ...m, flags: ['low_coverage', 'fragmented_turns', 'tail_gap', 'speakers_extra'] }) });
    assert.deepEqual(v.transcript_notes, ['low_coverage', 'tail_gap']);
    assert.equal(JSON.stringify(v).includes('"coverage"'), false);
    assert.deepEqual(jobView({ id: 'j', transcript_metrics: null }).transcript_notes, []);
    assert.deepEqual(jobView({ id: 'j', transcript_metrics: '{bad' }).transcript_notes, []);
  });

  await t('H65 writeChunk (با fsync): محتوا کامل، idempotent در بازنویسی، tmp باقی نمی‌ماند', () => {
    const id = randomUUID();
    try {
      const body = Buffer.alloc(1024 * 1024 + 7, 3);
      writeChunk(id, 0, body); writeChunk(id, 0, body); writeChunk(id, 1, Buffer.from('xy'));
      assert.deepEqual(receivedChunks(id, body.length + 2, body.length), [0, 1]);
      const dir = path.join(process.cwd(), 'data', 'uploads', id);
      assert.equal(readFileSync(path.join(dir, 'chunk-000000.part')).equals(body), true);
      assert.equal(readdirSync(dir).some((f) => f.includes('.tmp-')), false);
    } finally { removeUploadDir(id); }
  });

  await t('H66 tokenStore: pack/unpack roundtrip (فارسی، گوینده، اطمینان)، فیلدِ نامعلوم حفظ، خالی ⇒ null، gzip کوچک‌تر', () => {
    const toks: TimedToken[] = [];
    for (let i = 0; i < 2000; i++) toks.push({ text: i % 2 ? ' سلام' : 'خوبی؟', start_ms: i * 400, end_ms: i * 400 + 350, speaker: (i % 3) + 1, confidence: 0.5 + (i % 50) / 100 });
    toks.push({ text: 'x' });
    const p = packTokens(toks)!;
    assert.equal(p.count, 2001);
    const back = unpackTokens(p.gz)!;
    assert.equal(back.length, 2001);
    assert.deepEqual(back[0], { text: 'خوبی؟', start_ms: 0, end_ms: 350, speaker: 1, confidence: 0.5 });
    assert.deepEqual(back[2000], { text: 'x' });
    assert.ok(p.gz.length < JSON.stringify(toks).length / 4, 'gz=' + p.gz.length);
    assert.equal(packTokens([]), null); assert.equal(packTokens(undefined), null);
    assert.equal(unpackTokens(Buffer.from('bad')), null);
  });

  await t('H67 ماشینِ حالت: توکن‌هایِ getText در meta.tokens به store می‌رسند؛ بدونِ توکن ⇒ null و متن ثبت می‌شود', async () => {
    const w = newWorld(); const deps = makeDeps(w, { tokens: toks(0, 30_000) }, { caseFileAfterUpload: () => false });
    const job = newJob(w); await drive(w, deps, job.id);
    const got = w.metas.get(job.id)?.tokens;
    assert.ok(got && got.length > 0, 'tokens در meta');
    assert.equal(w.jobs.get(job.id)!.stage, 'done');
    const w2 = newWorld(); const d2 = makeDeps(w2, {}, { caseFileAfterUpload: () => false });
    const j2 = newJob(w2); await drive(w2, d2, j2.id);
    assert.equal(w2.metas.get(j2.id)?.tokens ?? null, null);
    assert.equal(w2.transcripts.get('se-1'), 'گوینده ۱: سلام');
  });



  await t('H68 gap-check واقعی (client_seq): سگمنتِ گم‌شده، سگمنتِ خالیِ گزارش‌شده، چند run، ردیفِ قدیمی', () => {
    const row = (run: string, cs: number | null, seq: number) => ({ run_id: run, client_seq: cs, seq, kind: 'session' }) as any;
    // سرور seq را MAX+1 می‌دهد ⇒ seq همیشه پیوسته؛ ولی client_seq 2 هرگز نرسیده ⇒ گم‌شده (باگِ قبلی: همیشه «کامل»)
    const lost = [row('r1', 0, 0), row('r1', 1, 1), row('r1', 3, 2)];
    assert.deepEqual(checkSeqContiguous(lost), { complete: false, missing: [2] });
    // همان با گزارشِ «سگمنت ۲ خالی بود» ⇒ کامل
    assert.deepEqual(checkSeqContiguous(lost, [{ session_id: 's', run_id: 'r1', client_seq: 2 }]), { complete: true, missing: [] });
    // دو run مستقل؛ skipِ runِ دیگر اثر ندارد
    const two = [row('r1', 0, 0), row('r1', 1, 1), row('r2', 0, 2), row('r2', 2, 3)];
    assert.deepEqual(checkSeqContiguous(two, [{ session_id: 's', run_id: 'r1', client_seq: 1 }]), { complete: false, missing: [1] });
    // سگمنتِ خالیِ انتهایی (بعد از آخرین سگمنتِ رسیده) گم‌شده حساب نمی‌شود
    assert.deepEqual(checkSeqContiguous([row('r1', 0, 0), row('r1', 1, 1)]), { complete: true, missing: [] });
    // ردیفِ قدیمی/آپلودی (client_seq=null) بررسی نمی‌شود؛ خالی ⇒ کامل
    assert.deepEqual(checkSeqContiguous([row('legacy', null, 0), row('legacy', null, 5)]), { complete: true, missing: [] });
    assert.deepEqual(checkSeqContiguous([]), { complete: true, missing: [] });
    // parseEmptySeqs: ورودیِ نامعتبر نادیده، تکراری یکی، مرتب، سقف
    assert.deepEqual(parseEmptySeqs('7,3,3,x,-1,2.5,'), [3, 7]);
    assert.deepEqual(parseEmptySeqs(undefined), []);
    assert.equal(parseEmptySeqs(Array.from({ length: 500 }, (_, i) => i).join(',')).length, 100);
  });

  await t('H69 تاریخچه‌ی متنِ خام: فقط جایگزینیِ غیر-الحاقی؛ خودذخیره‌یِ حینِ جلسه فقط با علتِ صریح/کوتاه‌شدنِ >۱۰٪؛ CAS اجباری', () => {
    const old = 'گوینده ۱: سلام خوبی؟\n\nگوینده ۲: ممنون';
    // الحاق و تکرار ⇒ ثبت نمی‌شود
    assert.equal(shouldRecordRevision(old, old + '\n\nادامه', 'completed', 'put'), false);
    assert.equal(shouldRecordRevision(old, old, 'completed', 'put'), false);
    // متنِ قبلی خالی ⇒ چیزی برایِ نگه‌داری نیست
    assert.equal(shouldRecordRevision('', 'x', 'completed', 'put'), false);
    assert.equal(shouldRecordRevision(null, 'x', 'completed', 'put'), false);
    // بعد از پایان: هر جایگزینیِ غیر-الحاقی (resolve-speakers) ثبت می‌شود
    assert.equal(shouldRecordRevision(old, 'گوینده ۲: سلام خوبی؟\n\nگوینده ۱: ممنون', 'completed', 'resolve-speakers'), true);
    assert.equal(shouldRecordRevision(old, 'گوینده ۲: سلام خوبی؟\n\nگوینده ۱: ممنون', 'completed', 'put'), true);
    // حینِ جلسه: تغییرِ کوچکِ آخرین واژه (autosave) ثبت نمی‌شود؛ کوتاه‌شدنِ زیاد یا علتِ صریح ثبت می‌شود
    const live = 'الف '.repeat(100);
    assert.equal(shouldRecordRevision(live, live.slice(0, -3) + 'ب', 'in_progress', 'put'), false);
    assert.equal(shouldRecordRevision(live, live.slice(0, 200), 'in_progress', 'put'), true);
    assert.equal(shouldRecordRevision(live, live.slice(0, -3) + 'ب', 'in_progress', 'marker-remove'), true);
    // علتِ ناشناخته ⇒ put
    assert.equal(revisionCause('resolve-speakers'), 'resolve-speakers');
    assert.equal(revisionCause('hack'), 'put'); assert.equal(revisionCause(undefined), 'put');
    // CAS: پیش‌فرض اجباری؛ =0 فقط بازگشتِ اضطراری
    const prev = process.env.TRANSCRIPT_CAS_REQUIRED;
    delete process.env.TRANSCRIPT_CAS_REQUIRED; assert.equal(casRequired(), true);
    process.env.TRANSCRIPT_CAS_REQUIRED = '0'; assert.equal(casRequired(), false);
    if (prev === undefined) delete process.env.TRANSCRIPT_CAS_REQUIRED; else process.env.TRANSCRIPT_CAS_REQUIRED = prev;
  });

  await t('H70 رکوردِ canonical: نوبت‌ها از توکن (ادغامِ هم‌گوینده، زمان، اطمینان)، متنِ canonical با نقش، نقش‌هایِ کامل، برچسبِ امن', () => {
    const tk = (text: string, speaker: any, s?: number, e?: number, c?: number) => ({ text, speaker, start_ms: s, end_ms: e, confidence: c });
    const segs = buildSegments([tk('سلام', 1, 0, 400, 0.9), tk(' خوبی', 1, 400, 800, 0.7), tk(' ممنون', 2, 1000, 1500, 0.8), tk(' ', undefined), tk('تو', undefined, 1500, 1700), tk(' چطوری', 1, 2000, 2600)]);
    assert.deepEqual(segs.map((s) => [s.seq, s.speaker_key, s.text, s.start_ms, s.end_ms, s.confidence_pct]),
      [[0, '1', 'سلام خوبی', 0, 800, 80], [1, '2', 'ممنون تو', 1000, 1700, 80], [2, '1', 'چطوری', 2000, 2600, null]]);
    // بدونِ گوینده در ابتدا ⇒ '0'؛ تهی ⇒ []
    assert.equal(buildSegments([tk('الف', undefined)])[0].speaker_key, '0');
    assert.deepEqual(buildSegments([]), []); assert.deepEqual(buildSegments(null), []);
    // نوبتِ فقط-فاصله حذف می‌شود
    assert.equal(buildSegments([tk('   ', 1)]).length, 0);
    // متنِ canonical: بدونِ نقش «گوینده N» به ترتیبِ ظهور؛ با نقش/برچسب
    const plain = renderCanonicalText(segs);
    assert.equal(plain, 'گوینده ۱: سلام خوبی\n\nگوینده ۲: ممنون تو\n\nگوینده ۱: چطوری');
    const roles = { '1': { role: 'therapist' as const, label: null }, '2': { role: 'client' as const, label: 'همسر' } };
    assert.equal(renderCanonicalText(segs, roles), 'درمانگر: سلام خوبی\n\nهمسر: ممنون تو\n\nدرمانگر: چطوری');
    assert.equal(rolesComplete(['1', '2'], roles), true);
    assert.equal(rolesComplete(['1', '2', '3'], roles), false);
    assert.equal(rolesComplete([], roles), false);
    // برچسب: خط‌جدید/دونقطه حذف (قالبِ «برچسب: متن» را نمی‌شکند) و سقف ۴۰
    assert.equal(cleanLabel('مراجع: الف\nب'), 'مراجع الف ب');
    assert.equal(cleanLabel('x'.repeat(100))!.length, 40); assert.equal(cleanLabel('  '), null); assert.equal(cleanLabel(5), null);
    // کلیدِ قطعیِ گذر: یکسان برایِ ورودیِ یکسان، شکلِ UUID
    assert.equal(deterministicJobId('ft:abc'), deterministicJobId('ft:abc'));
    assert.match(deterministicJobId('ft:abc'), /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  await t('H71 رکوردِ realtime: اعتبارسنجیِ تکه (توکنِ نامعتبر دور، کلید/اطمینانِ نامعتبر ⇒ null، تهیِ غیرپایانی رد، سقف)', () => {
    const ok = parseRtChunk({ run_id: 'mg1abc12345', chunk_seq: 0, tokens: [['سلام', 0, 400, 'ab12c-1', 0.9], ['<end>', 0, 0, 'ab12c-1', 1], ['<fin>', 0, 0, null, 1], ['', 1, 2, null, 1], [' خوب', 400, 900, 'bad key!', 7], 5, ['x'.repeat(300), 0, 1, null, 1]] });
    assert.ok(!('error' in ok));
    if ('error' in ok) return;
    assert.equal(ok.tokens.length, 2);
    assert.deepEqual(ok.tokens[0], { text: 'سلام', start_ms: 0, end_ms: 400, speaker: 'ab12c-1', confidence: 0.9 });
    assert.equal(ok.tokens[1].speaker, null); assert.equal(ok.tokens[1].confidence, undefined);
    assert.equal(ok.final, false); assert.equal(ok.reliable, null);
    const fin = parseRtChunk({ run_id: 'r1', chunk_seq: 3, tokens: [], final: true, reliable: true, dropped: 2 });
    assert.ok(!('error' in fin) && fin.final && fin.reliable === true && fin.dropped === 2);
    assert.deepEqual(parseRtChunk({ run_id: 'r1', chunk_seq: 0, tokens: [] }), { error: 'empty' });
    assert.deepEqual(parseRtChunk({ run_id: 'a b', chunk_seq: 0, tokens: [['x']] }), { error: 'run-invalid' });
    assert.deepEqual(parseRtChunk({ run_id: 'r', chunk_seq: -1, tokens: [['x']] }), { error: 'seq-invalid' });
    assert.deepEqual(parseRtChunk({ run_id: 'r', chunk_seq: 0, tokens: new Array(2001).fill(['x']) }), { error: 'too-many-tokens' });
  });

  await t('H72 رکوردِ realtime: مونتاژ به ترتیبِ run/تکه، جابه‌جاییِ زمانِ run بعدی، شکاف، پایان، complete، کلیدِ تغییرپذیر', () => {
    const tk = (text: string, s: number, e: number, sp: string) => ({ text, start_ms: s, end_ms: e, speaker: sp, confidence: 0.9 });
    const c = (id: number, runId: string, chunkSeq: number, tokens: any[], fin = false, reliable: boolean | null = null): StoredRtChunk =>
      ({ id, runId, chunkSeq, tokens, isFinal: fin, reliable, dropped: fin ? 0 : null });
    // یک run، تکه‌ها نامرتب رسیده‌اند ⇒ ترتیبِ chunk_seq؛ پایانِ قابل‌اعتماد ⇒ complete
    const one = assembleRtChunks('s1', [c(2, 'A', 1, [tk(' دوم', 500, 900, 'A-2')], true, true), c(1, 'A', 0, [tk('اول', 0, 400, 'A-1')])])!;
    assert.deepEqual(one.tokens.map((x) => x.text), ['اول', ' دوم']);
    assert.equal(one.meta.complete, true); assert.equal(one.meta.missing_chunks, 0);
    // شکاف در chunk_seq ⇒ ناقص
    const gap = assembleRtChunks('s1', [c(1, 'A', 0, [tk('اول', 0, 400, 'A-1')]), c(2, 'A', 2, [tk('سوم', 900, 1200, 'A-1')], true, true)])!;
    assert.equal(gap.meta.missing_chunks, 1); assert.equal(gap.meta.complete, false);
    // دو run (رفرش): زمانِ run دوم بعد از پایانِ run اول؛ دو run ⇒ ناقص
    const two = assembleRtChunks('s1', [c(1, 'A', 0, [tk('a', 0, 1000, 'A-1')]), c(2, 'B', 0, [tk('b', 0, 500, 'B-1')], true, true)])!;
    assert.deepEqual(two.tokens.map((x) => [x.start_ms, x.end_ms]), [[0, 1000], [1000, 1500]]);
    assert.equal(two.meta.runs, 2); assert.equal(two.meta.complete, false);
    // بدونِ پایان یا unreliable ⇒ ناقص؛ تهی ⇒ null
    assert.equal(assembleRtChunks('s1', [c(1, 'A', 0, [tk('a', 0, 1, 'A-1')])])!.meta.final_seen, false);
    assert.equal(assembleRtChunks('s1', [c(1, 'A', 0, [tk('a', 0, 1, 'A-1')], true, false)])!.meta.complete, false);
    assert.equal(assembleRtChunks('s1', []), null);
    // کلید با تکه‌ی تازه یا پرچمِ پایان عوض می‌شود (گذرِ تازه)، برایِ ورودیِ یکسان ثابت است
    const k1 = assembleRtChunks('s1', [c(1, 'A', 0, [tk('a', 0, 1, 'A-1')])])!.key;
    assert.equal(k1, assembleRtChunks('s1', [c(1, 'A', 0, [tk('a', 0, 1, 'A-1')])])!.key);
    assert.notEqual(k1, assembleRtChunks('s1', [c(1, 'A', 0, [tk('a', 0, 1, 'A-1')], true, true)])!.key);
    // نوبت‌ها با کلیدِ run-برچسب ساخته می‌شوند (همان «گوینده N»ِ متن)
    assert.deepEqual(buildSegments(one.tokens).map((x) => x.speaker_key), ['A-1', 'A-2']);
  });

  await t('H73 پیشنهادِ نقشِ گوینده: متنِ نهایی (فقط async، اکثریت/فارسی⇒لاتین)، حدسِ دونفره‌ی فردی، بدونِ حدس برایِ چندعضوی، برچسبِ نمایش', () => {
    const sp = (key: string, firstStartMs: number | null, firstSeq: number) => ({ key, firstStartMs, firstSeq });
    // ۱) متنِ نهایی: کلیدِ فارسی ⇒ لاتین؛ «مراجع»/«درمانگر»/عضوِ نام‌دار
    const ft = suggestRoles({ speakers: [sp('1', 0, 0), sp('2', 500, 1), sp('3', 900, 2)], recordSource: 'async',
      finalRoles: { '۱': 'درمانگر', '2': 'مراجع', '۳': 'همسر' }, rosterMembers: null });
    assert.deepEqual(ft, { '1': { role: 'therapist', label: null, source: 'final_transcript' }, '2': { role: 'client', label: null, source: 'final_transcript' },
      '3': { role: 'member', label: 'همسر', source: 'final_transcript' } });
    // نقش‌هایِ متنِ نهایی برایِ گذرِ realtime به کار نمی‌روند (شماره‌ها یکی نیستند) ⇒ حدس
    const rt = suggestRoles({ speakers: [sp('ab12c-1', 3000, 0), sp('ab12c-2', 100, 1)], recordSource: 'realtime', finalRoles: { '1': 'مراجع' }, rosterMembers: ['مراجع'] });
    assert.equal(rt['ab12c-2'].role, 'therapist'); assert.equal(rt['ab12c-2'].source, 'guess'); assert.equal(rt['ab12c-1'].role, 'client');
    // عضوِ نام‌دار (alias) ⇒ client با برچسب
    const al = suggestRoles({ speakers: [sp('1', 0, 0), sp('2', 10, 1)], recordSource: 'upload', finalRoles: null, rosterMembers: ['سارا'] });
    assert.deepEqual(al['2'], { role: 'client', label: 'سارا', source: 'guess' });
    // زوج (دو عضو) یا سه گوینده ⇒ بدونِ حدس
    assert.deepEqual(suggestRoles({ speakers: [sp('1', 0, 0), sp('2', 10, 1)], recordSource: 'async', finalRoles: null, rosterMembers: ['همسر ۱', 'همسر ۲'] }), {});
    assert.deepEqual(suggestRoles({ speakers: [sp('1', 0, 0), sp('2', 1, 1), sp('3', 2, 2)], recordSource: 'async', finalRoles: null, rosterMembers: null }), {});
    // برچسبِ نمایش: realtime همان «گوینده N»ِ متن، با «بخش» وقتی چند run؛ async ترتیبِ ظهور
    assert.deepEqual(speakerDisplays(['ab12c-1', 'ab12c-3']), { 'ab12c-1': 'گوینده ۱', 'ab12c-3': 'گوینده ۳' });
    assert.deepEqual(speakerDisplays(['ab12c-1', 'zz9yx-1']), { 'ab12c-1': 'گوینده ۱ (بخشِ ۱)', 'zz9yx-1': 'گوینده ۱ (بخشِ ۲)' });
    assert.deepEqual(speakerDisplays(['2', '1']), { '2': 'گوینده ۱', '1': 'گوینده ۲' });
  });

  await t('H74 سنجه‌یِ هر گذر: realtimeِ تک-run ⇒ پوشش؛ چند-run ⇒ پوششِ null بدونِ پرچمِ غلط؛ ناقص ⇒ بدونِ مقایسه‌ی گوینده؛ ذخیره رویِ همان گذر', async () => {
    const tok = (text: string, s: number, e: number, sp: string, c = 0.9) => ({ text, start_ms: s, end_ms: e, speaker: sp, confidence: c });
    const tokens = [tok('سلام', 0, 500, 'a-1'), tok(' خوبی', 600, 1200, 'a-1'), tok(' ممنون', 2000, 2600, 'a-2', 0.4)];
    const saved: any[] = [];
    const deps = (rec: any, spans: Array<[number, number]> | null, expected: number | null) => ({
      load: async () => rec, speechSpans: async () => spans, expectedSpeakers: async () => expected,
      save: async (id: number, m: any) => { saved.push([id, m]); },
    });
    // تک-run و کامل: پوشش و مقایسه‌ی گوینده؛ صدادارِ بی‌متن (۵ تا ۲۵ث، ≥ سقفِ ۱۵ث) ⇒ حفره‌ی انتها
    const m1 = (await measureRecord('s', deps({ recordId: 7, source: 'realtime', meta: { runs: 1, complete: true }, tokens }, [[0, 2600], [5000, 25000]], 3)))!;
    assert.ok(m1.coverage !== null && m1.coverage < 1);
    assert.ok(m1.flags.includes('uncovered_gap') || m1.flags.includes('tail_gap'));
    assert.equal(m1.speakers_expected, 3); assert.ok(m1.flags.includes('speakers_merged'));
    assert.equal(saved[0][0], 7);
    // چند run ⇒ speechSpans حتی فراخوانی نمی‌شود، پوشش null، بدونِ پرچمِ پوشش
    let spansCalled = false;
    const d2 = deps({ recordId: 8, source: 'realtime', meta: { runs: 2, complete: false }, tokens }, [[0, 99999]], 2);
    d2.speechSpans = async () => { spansCalled = true; return [[0, 99999]]; };
    const m2 = (await measureRecord('s', d2))!;
    assert.equal(spansCalled, false); assert.equal(m2.coverage, null);
    assert.ok(!m2.flags.some((x) => ['low_coverage', 'uncovered_gap', 'head_gap', 'tail_gap', 'speakers_merged', 'speakers_extra'].includes(x)));
    assert.equal(m2.speakers_expected, null);
    // async همیشه هم‌تراز؛ بدونِ رکورد ⇒ null و چیزی ذخیره نمی‌شود
    assert.deepEqual(alignmentFor({ source: 'async', meta: null }), { coverage: true, speakers: true });
    const n = saved.length;
    assert.equal(await measureRecord('s', deps(null, null, null)), null); assert.equal(saved.length, n);
    // کم‌اطمینان: یک از سه واژه زیرِ ۰٫۷
    assert.ok(Math.abs((m1.low_conf_ratio as number) - 1 / 3) < 0.01);
  });

  await t('H75 metrics: speakers_minor (۰٫۵–۳٪) و speaker_imbalance (دونفره، ≥۸۵٪، ≥۱۰۰۰ واژه)؛ حاضرین نامعلوم/واژه‌یِ کم ⇒ بدونِ پرچم؛ نویزِ <۰٫۵٪ نادیده', () => {
    // ۱۰۰۰ واژه‌یِ گوینده‌یِ ۱ + ۱۰۰ واژه‌یِ گوینده‌یِ ۲ ⇒ ≈۹۱٪؛ ۱۵ واژه‌یِ گوینده‌یِ ۳ ⇒ ≈۱٫۳٪
    const mk = (n1: number, n2: number, n3: number): TimedToken[] => {
      const out: TimedToken[] = []; let at = 0;
      for (const [sp, n] of [[1, n1], [2, n2], [3, n3]] as Array<[number, number]>) for (let i = 0; i < n; i++, at += 400) out.push({ text: ' واژه', speaker: sp, start_ms: at, end_ms: at + 300, confidence: 0.95 });
      return out;
    };
    const run = (n1: number, n2: number, n3: number, expectedSpeakers?: number) =>
      computeTranscriptMetrics({ tokens: mk(n1, n2, n3), speechSpans: null, durationMs: 600_000, lowConfRatio: null, expectedSpeakers });
    const a = run(1000, 100, 15, 2);
    assert.ok(a.flags.includes('speaker_imbalance') && a.flags.includes('speakers_minor'), JSON.stringify(a.flags));
    assert.ok(!a.flags.includes('speakers_extra') && !a.flags.includes('speakers_merged'));
    const bal = run(600, 500, 0, 2);
    assert.ok(!bal.flags.includes('speaker_imbalance') && !bal.flags.includes('speakers_minor'));
    const shortSess = run(80, 8, 0, 2);
    assert.ok(!shortSess.flags.includes('speaker_imbalance'), 'جلسه‌یِ کوتاه همیشه نامتعادل است');
    const noise = run(1000, 900, 3, 2); // ۳ واژه ≈ ۰٫۱٪
    assert.ok(!noise.flags.includes('speakers_minor'), JSON.stringify(noise.flags));
    const extra = run(1000, 900, 100, 2); // سهمِ ≥۳٪ ⇒ speakers_extra، نه minor
    assert.ok(extra.flags.includes('speakers_extra') && !extra.flags.includes('speakers_minor'));
    const unknown = run(1000, 100, 15);
    assert.ok(!unknown.flags.some((f) => f.startsWith('speaker')), 'حاضرین نامعلوم ⇒ قضاوت نمی‌شود');
    const three = run(1000, 100, 0, 3);
    assert.ok(!three.flags.includes('speaker_imbalance'), 'فقط دونفره');
    const f = metricsFindings(a);
    assert.ok(f.some((x) => x.level === 'warn' && x.text.includes('سهمِ یک گوینده')) && f.some((x) => x.text.includes('گوینده‌یِ کوچکِ اضافه')));
  });

  console.log(`\n${pass} PASS / ${fail} FAIL`);
  if (fail) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
