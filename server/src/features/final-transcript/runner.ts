// workerِ پس‌زمینه‌ی «متنِ نهایی» + ذخیره‌سازیِ SQL + enqueue. همان الگویِ features/audio-upload/jobRunner.ts:
// تمامِ وضعیت در DB، lease + heartbeat، آزادسازیِ leaseها در startup (LAW-013: تک‌پروسه).
import { query, pool } from '../../db/connection.js';
import { logEvent } from '../../obs/eventLog.js';
import { beat } from '../../obs/heartbeat.js';
import { createNotification } from '../notifications/index.js';
import { treatmentUnits } from '../treatment-unit/index.js';
import {
  getFullSessionAudio, listSessionAudio, deriveSessionStatus, pendingAudiosFor, uploadFileFromPath, createTranscription, pollTranscriptionStatus, getTranscriptTokens, markedTextFromTokens, deleteTranscription, deleteFile, type SignMark,
} from '../transcription/index.js';
import {
  stepFinalTranscript, giveUp, DEFAULT_FT_CONFIG,
  type FtDeps, type FtJob, type FtPatch, type FtStore, type AudioState,
} from './domain/jobMachine.js';
import { polishTranscript } from './application/polishTranscript.js';
import { DEFAULT_GUARD_LIMITS } from './domain/polishGuards.js';
import { createTranscriptLlm } from './adapters/llmJson.js';

const LEASE_SECONDS = 20 * 60;
const HEARTBEAT_MS = 60_000;
const TICK_MS = 5_000;
const CONCURRENCY = 1; // هزینه‌ی LLM/Soniox — یکی‌یکی
const ACTIVE = `('waiting_audio','transcribing','polishing')`;

function envInt(name: string, def: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}
function envFloat(name: string, def: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : def;
}

const SELECT_JOB = 'SELECT *, TIMESTAMPDIFF(SECOND, queued_at, NOW()) AS queued_age_s FROM final_transcripts WHERE session_id = ?';

function rowToJob(r: any): FtJob {
  return {
    sessionId: r.session_id, therapistId: r.therapist_id, clientId: r.client_id, stage: r.stage,
    attempts: Number(r.attempts || 0), source: r.source ?? null, sourceVersion: r.source_version ?? null,
    sonioxFileId: r.soniox_file_id, sonioxTranscriptionId: r.soniox_transcription_id,
    transcriptionStartedAt: r.transcription_started_at ? new Date(r.transcription_started_at) : null,
    asyncText: r.async_text ?? null, errorCode: r.error_code ?? null,
    // عمر از خودِ MySQL (TIMESTAMPDIFF با NOW()) — queued_at با NOW()ِ سرورِ DB (وقتِ محلی) نوشته می‌شود ولی درایور با
    // timezone:'Z' آن را UTC می‌خواند. مقایسه‌ی مستقیم با Date.now() جلسه را ۳٫۵ ساعت در «مکثِ اولیه» نگه می‌داشت (E2E 2026-09-28).
    queuedAt: new Date(Date.now() - Math.max(0, Number(r.queued_age_s || 0)) * 1000),
  };
}

const COLS: Record<string, string> = {
  stage: 'stage', attempts: 'attempts', source: 'source', sourceVersion: 'source_version',
  sonioxFileId: 'soniox_file_id', sonioxTranscriptionId: 'soniox_transcription_id',
  transcriptionStartedAt: 'transcription_started_at', asyncText: 'async_text', errorCode: 'error_code',
};

export const sqlFtStore: FtStore = {
  async update(job: FtJob, patch: FtPatch) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, col] of Object.entries(COLS)) {
      if ((patch as any)[k] !== undefined) {
        sets.push(`${col} = ?`);
        vals.push((patch as any)[k]);
        (job as any)[k] = (patch as any)[k];
      }
    }
    if (patch.nextAttemptInMs !== undefined) {
      sets.push('next_attempt_at = (NOW() + INTERVAL ? SECOND)');
      vals.push(Math.ceil(patch.nextAttemptInMs / 1000));
    }
    if (!sets.length) return;
    vals.push(job.sessionId);
    await query(`UPDATE final_transcripts SET ${sets.join(', ')} WHERE session_id = ?`, vals);
    if (patch.stage) logEvent({ event: 'final_transcript.stage', sessionId: job.sessionId, therapistId: job.therapistId, source: 'job', detail: { state: patch.stage } });
  },

  async finish(job: FtJob, cleanText: string, report: unknown, turns?: unknown[]) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query(
        `UPDATE final_transcripts SET stage = 'done', clean_text = ?, clean_turns = ?, polish_report = ?, error_code = NULL, attempts = 0,
           finished_at = NOW(), locked_until = NULL WHERE session_id = ?`,
        [cleanText, turns ? JSON.stringify(turns) : null, JSON.stringify(report ?? {}), job.sessionId]);
      if ((r as any).affectedRows) {
        // job_id = session_id: یک اعلان به ازایِ هر جلسه (UNIQUE(job_id, kind)) — retry اعلانِ تکراری نمی‌سازد.
        await createNotification({ therapistId: job.therapistId, kind: 'final_transcript_ready', clientId: job.clientId, sessionId: job.sessionId, jobId: job.sessionId }, conn);
      }
      await conn.commit();
    } catch (e) {
      try { await conn.rollback(); } catch {}
      throw e;
    } finally {
      conn.release();
    }
    job.stage = 'done';
    const rep = (report || {}) as { usage?: { total?: { calls: number; prompt_tokens: number; completion_tokens: number; reasoning_tokens: number; cost_usd: number | null } }; chunks?: number; fallback_chunks?: number; turns?: number; fallback_turns?: number; retries?: number; uncertain?: number; role_fixes?: number; role_reverts?: number };
    logEvent({ event: 'final_transcript.done', sessionId: job.sessionId, therapistId: job.therapistId, source: 'job',
      detail: { source: job.source, chunks: rep.chunks, fallback_chunks: rep.fallback_chunks, turns: rep.turns, fallback_turns: rep.fallback_turns, retries: rep.retries, uncertain: rep.uncertain, role_fixes: rep.role_fixes, role_reverts: rep.role_reverts,
        llm_calls: rep.usage?.total?.calls, prompt_tokens: rep.usage?.total?.prompt_tokens, completion_tokens: rep.usage?.total?.completion_tokens,
        reasoning_tokens: rep.usage?.total?.reasoning_tokens, cost_usd: rep.usage?.total?.cost_usd ?? undefined } });
  },

  async skip(job: FtJob, code: string) {
    await query(`UPDATE final_transcripts SET stage = 'skipped', error_code = ?, finished_at = NOW(), locked_until = NULL WHERE session_id = ?`, [code, job.sessionId]);
    job.stage = 'skipped';
  },

  async fail(job: FtJob, code: string) {
    await query(`UPDATE final_transcripts SET stage = 'failed', error_code = ?, finished_at = NOW(), locked_until = NULL WHERE session_id = ?`, [code, job.sessionId]);
    job.stage = 'failed';
    job.errorCode = code;
    logEvent({ event: 'final_transcript.failed', sessionId: job.sessionId, therapistId: job.therapistId, source: 'job', severity: 'warn', code });
  },
};

async function audioStateFor(sessionId: string): Promise<AudioState> {
  const s = await query('SELECT batch_status, realtime_reliable, stt_mode FROM sessions WHERE id = ?', [sessionId]);
  if (!s.rows[0]) return 'none';
  const rows = await listSessionAudio(sessionId);
  const pending = pendingAudiosFor(sessionId, 'transcript').length + pendingAudiosFor(sessionId, 'late-transcript').length
    + pendingAudiosFor(sessionId, 'archive').length;
  const d = deriveSessionStatus(rows, pending, s.rows[0]);
  // رونویسیِ batchِ جلسه هنوز در جریان است ⇒ متنِ realtime هم هنوز نهایی نیست. فقط batch_statusِ واقعی ملاک است:
  // transcriptStatus='pending' برایِ جلسه‌ی زنده‌ی realtime_reliable=false همیشه pending می‌ماند و ۳۰ دقیقه بیهوده منتظر می‌ماند.
  const bs = s.rows[0].batch_status;
  if ((bs === 'queued' || bs === 'processing') && d.audioStatus !== 'none') return 'syncing';
  return d.audioStatus;
}

// یادداشت‌هایِ پیش از جلسه (note_before/voice_before + ستونِ قدیمیِ sessions.pre_note). fail-open: خطا ⇒ ''.
// ⚠️ LAW-001: متن لاگ نمی‌شود. در مسیرِ آپلود، یادداشت بعد از ساختِ جلسه از مرورگر ثبت می‌شود؛ هرچه تا لحظه‌ی polish
// ثبت شده باشد خوانده می‌شود (بعدی‌ها فقط با «ساختِ دوباره» اثر می‌گذارند).
async function preSessionBriefing(sessionId: string): Promise<string> {
  try {
    const notes = await query(
      "SELECT text FROM session_notes WHERE session_id = ? AND type IN ('note_before','voice_before') ORDER BY created_at", [sessionId]);
    const legacy = await query('SELECT pre_note FROM sessions WHERE id = ?', [sessionId]);
    const parts = [String(legacy.rows[0]?.pre_note || ''), ...notes.rows.map((r: any) => String(r.text || ''))]
      .map((x) => x.trim()).filter(Boolean);
    return parts.join('\n---\n');
  } catch {
    return '';
  }
}

// سقفِ روزانه‌ی «متنِ نهایی» (روزِ UTC) با دو سقفِ مستقل: دلار (FINAL_TRANSCRIPT_DAILY_BUDGET_USD) و توکن
// (FINAL_TRANSCRIPT_DAILY_BUDGET_TOKENS، ورودی+خروجی). هر کدام ۰ ⇒ خاموش. هر کدام پر شود ⇒ ویرایشِ تازه شروع نمی‌شود
// (llm-budget). فقط ویرایش‌هایِ تمام‌شده شمرده می‌شوند (هزینه‌ی فراخوانی‌هایِ شکست‌خورده/نیمه‌کاره ثبت نمی‌شود). providerهایی که
// هزینه نمی‌دهند (متیس/DeepSeek) فقط با سقفِ توکن محافظت می‌شوند مگر <P>_PRICE_IN_PER_M/OUT تنظیم شده باشد.
export async function spentToday(): Promise<{ usd: number; tokens: number; edits: number }> {
  const r = await query("SELECT polish_report FROM final_transcripts WHERE stage = 'done' AND finished_at >= UTC_DATE()");
  let sum = 0;
  let tokens = 0;
  let edits = 0;
  for (const row of r.rows as any[]) {
    const rep = typeof row.polish_report === 'string' ? JSON.parse(row.polish_report) : row.polish_report;
    const t = rep?.usage?.total;
    if (!t) continue;
    edits++;
    tokens += (Number(t.prompt_tokens) || 0) + (Number(t.completion_tokens) || 0);
    if (typeof t.cost_usd === 'number' && Number.isFinite(t.cost_usd)) sum += t.cost_usd;
  }
  return { usd: sum, tokens, edits };
}
const DEFAULT_DAILY_BUDGET_USD = 3;
const DEFAULT_DAILY_BUDGET_TOKENS = 5_000_000;

async function polishFor(sessionId: string, text: string, opts?: { trustDiarization: boolean }) {
  try {
    const capUsd = Number(process.env.FINAL_TRANSCRIPT_DAILY_BUDGET_USD ?? DEFAULT_DAILY_BUDGET_USD);
    const capTok = Number(process.env.FINAL_TRANSCRIPT_DAILY_BUDGET_TOKENS ?? DEFAULT_DAILY_BUDGET_TOKENS);
    if ((Number.isFinite(capUsd) && capUsd > 0) || (Number.isFinite(capTok) && capTok > 0)) {
      const s = await spentToday();
      if ((capUsd > 0 && s.usd >= capUsd) || (capTok > 0 && s.tokens >= capTok)) {
        console.log(`[final-transcript] daily budget reached: usd=${s.usd.toFixed(4)}/${capUsd} tokens=${s.tokens}/${capTok} edits=${s.edits} ⇒ session=${sessionId} not polished`);
        return { ok: false as const, transient: false, code: 'llm-budget' };
      }
    }
    const llm = createTranscriptLlm(process.env, undefined, { sessionId });
    const roster = await treatmentUnits.sessionSpeakerRoster(sessionId);
    const briefing = await preSessionBriefing(sessionId);
    const res = await polishTranscript(text, roster, llm, {
      briefing,
      trustDiarization: !!opts?.trustDiarization,
      chunkChars: envInt('FINAL_TRANSCRIPT_CHUNK_CHARS', 4000),
      overviewChars: envInt('FINAL_TRANSCRIPT_OVERVIEW_CHARS', 60000),
      guards: {
        minLengthRatio: envFloat('FINAL_TRANSCRIPT_MIN_LENGTH_RATIO', DEFAULT_GUARD_LIMITS.minLengthRatio),
        maxLengthRatio: envFloat('FINAL_TRANSCRIPT_MAX_LENGTH_RATIO', DEFAULT_GUARD_LIMITS.maxLengthRatio),
        minOverlap: envFloat('FINAL_TRANSCRIPT_MIN_OVERLAP', DEFAULT_GUARD_LIMITS.minOverlap),
      },
    });
    return { ok: true as const, text: res.text, report: res.report, turns: res.turns };
  } catch (e) {
    const transient = !!(e as { transient?: boolean })?.transient;
    const code = e && (e as Error).name === 'FinalTranscriptConfigError' ? 'llm-not-configured' : transient ? 'llm-unavailable' : 'llm-failed';
    return { ok: false as const, transient, code };
  }
}

export function productionFtDeps(): FtDeps {
  return {
    store: sqlFtStore,
    session: async (id) => {
      const r = await query('SELECT transcript, transcript_version FROM sessions WHERE id = ?', [id]);
      const row = r.rows[0];
      return row ? { transcript: String(row.transcript || ''), transcriptVersion: Number(row.transcript_version || 0) } : null;
    },
    audioState: audioStateFor,
    fullAudio: async (id) => {
      const f = await getFullSessionAudio(id);
      return f.ok ? { ok: true, path: f.path, complete: f.complete } : { ok: false, reason: f.reason };
    },
    soniox: {
      uploadFile: uploadFileFromPath,
      createTranscription: async (fileId, ref, sessionId) =>
        createTranscription(fileId, { clientReferenceId: ref, context: await treatmentUnits.sessionSttContext(sessionId) }),
      poll: pollTranscriptionStatus,
      // ورودیِ polish: واژه‌هایِ کم‌اطمینانِ Soniox از پیش ⟦…؟⟧ می‌خورند (پلنِ B بخشِ ۴) و نگهبانِ 'uncertain' حفظشان
      // را اجباری می‌کند. این متن فقط در final_transcripts.async_text است — sessions.transcript دست نمی‌خورد.
      getText: async (tid, sessionId) => {
        const signs = await query("SELECT sign_type, offset_ms FROM session_notes WHERE session_id = ? AND type = 'sign'", [sessionId]);
        return markedTextFromTokens(await getTranscriptTokens(tid), signs.rows as SignMark[]);
      },
      deleteTranscription,
      deleteFile,
    },
    polish: polishFor,
    config: {
      audioWaitMs: envInt('FINAL_TRANSCRIPT_AUDIO_WAIT_MS', DEFAULT_FT_CONFIG.audioWaitMs),
      settleMs: envInt('FINAL_TRANSCRIPT_SETTLE_MS', DEFAULT_FT_CONFIG.settleMs),
    },
    now: () => Date.now(),
    log: (m) => console.log(m),
  };
}

// ————————————————————————— enqueue —————————————————————————
// idempotent. فقط اگر درمانگر قابلیت را روشن کرده باشد. ردیفِ پایان‌یافته (done/failed/skipped) فقط وقتی دوباره
// در صف می‌رود که متنِ جلسه از آن زمان تغییر کرده باشد (مثلاً جلسه ادامه داده و دوباره پایان یافت).
// opts.asyncText: متنِ asyncِ آماده (مسیرِ آپلود) ⇒ بدونِ رونویسیِ دوباره مستقیم به polishing.
// هرگز پرتاب نمی‌کند (fire-and-forget از مسیرهایِ پایانِ جلسه).
export async function enqueueFinalTranscript(sessionId: string, opts: { asyncText?: string } = {}): Promise<boolean> {
  try {
    const r = await query(
      `SELECT s.transcript_version, c.id AS client_id, t.id AS therapist_id, t.final_transcript_enabled
         FROM sessions s JOIN clients c ON c.id = s.client_id JOIN therapists t ON t.id = c.therapist_id
        WHERE s.id = ?`, [sessionId]);
    const row = r.rows[0];
    if (!row || !row.final_transcript_enabled) return false;
    const version = Number(row.transcript_version || 0);
    const pre = opts.asyncText && opts.asyncText.trim()
      ? { stage: 'polishing', source: 'async', text: opts.asyncText.trim() }
      : { stage: 'waiting_audio', source: null, text: null };
    const ins = await query(
      `INSERT IGNORE INTO final_transcripts (session_id, therapist_id, client_id, stage, source, source_version, async_text)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, row.therapist_id, row.client_id, pre.stage, pre.source, version, pre.text]);
    let queued = ins.rowCount === 1;
    if (!queued) {
      const up = await query(
        `UPDATE final_transcripts SET stage = ?, source = ?, source_version = ?, async_text = ?, attempts = 0, error_code = NULL,
           next_attempt_at = NOW(), queued_at = NOW(), finished_at = NULL
         WHERE session_id = ? AND stage IN ('done','failed','skipped') AND (source_version IS NULL OR source_version < ?)`,
        [pre.stage, pre.source, version, pre.text, sessionId, version]);
      queued = up.rowCount === 1;
    }
    if (queued) {
      logEvent({ event: 'final_transcript.queued', sessionId, therapistId: row.therapist_id, source: 'server', detail: { state: pre.stage } });
      wakeFinalTranscriptWorker();
    }
    return queued;
  } catch (e) {
    console.log('[final-transcript] enqueue failed:', String(e).slice(0, 160));
    return false;
  }
}

// «تلاشِ دوباره» از UI: failed/skipped یا done ِ stale. متنِ asyncِ موجود و هنوز معتبر دوباره رونویسی نمی‌شود.
export async function retryFinalTranscript(sessionId: string): Promise<'queued' | 'not-found' | 'busy' | 'fresh'> {
  const r = await query(
    `SELECT f.stage, f.source, f.source_version, f.async_text IS NOT NULL AS has_async, s.transcript_version
       FROM final_transcripts f JOIN sessions s ON s.id = f.session_id WHERE f.session_id = ?`, [sessionId]);
  const row = r.rows[0];
  if (!row) return 'not-found';
  if (['waiting_audio', 'transcribing', 'polishing'].includes(row.stage)) return 'busy';
  const stale = Number(row.transcript_version || 0) > Number(row.source_version ?? -1);
  if (row.stage === 'done' && !stale) return 'fresh';
  const reuseAsync = !stale && row.source === 'async' && !!row.has_async;
  await query(
    `UPDATE final_transcripts SET stage = ?, attempts = 0, error_code = NULL, next_attempt_at = NOW(), queued_at = NOW(),
       finished_at = NULL${reuseAsync ? '' : ', source = NULL, async_text = NULL'}
     WHERE session_id = ? AND stage IN ('done','failed','skipped')`,
    [reuseAsync ? 'polishing' : 'waiting_audio', sessionId]);
  wakeFinalTranscriptWorker();
  return 'queued';
}

// ————————————————————————— worker —————————————————————————
const running = new Set<string>();
let ticking = false;
let timer: ReturnType<typeof setInterval> | null = null;
let deps: FtDeps | null = null;
const UNEXPECTED_MAX = 5;
const unexpectedErrors = new Map<string, number>();

async function claim(id: string): Promise<boolean> {
  const r = await query(
    `UPDATE final_transcripts SET locked_until = (NOW() + INTERVAL ? SECOND)
     WHERE session_id = ? AND stage IN ${ACTIVE} AND (locked_until IS NULL OR locked_until < NOW())`,
    [LEASE_SECONDS, id]);
  return r.rowCount === 1;
}

async function runJob(id: string): Promise<void> {
  running.add(id);
  const hb = setInterval(() => {
    query('UPDATE final_transcripts SET locked_until = (NOW() + INTERVAL ? SECOND) WHERE session_id = ?', [LEASE_SECONDS, id]).catch(() => {});
  }, HEARTBEAT_MS);
  let lastJob: FtJob | null = null;
  try {
    for (let i = 0; i < 8; i++) {
      const r = await query(SELECT_JOB, [id]);
      if (!r.rows[0]) break;
      const job = rowToJob(r.rows[0]);
      lastJob = job;
      const res = await stepFinalTranscript(job, deps!);
      if (!res.continueNow) break;
    }
    unexpectedErrors.delete(id);
  } catch (e) {
    const n = (unexpectedErrors.get(id) || 0) + 1;
    console.log(`[final-transcript] unexpected error ${id} (${n}/${UNEXPECTED_MAX})`, String(e).slice(0, 200));
    if (n >= UNEXPECTED_MAX) {
      unexpectedErrors.delete(id);
      try {
        const r = await query(SELECT_JOB, [id]);
        if (r.rows[0]) await giveUp(rowToJob(r.rows[0]), deps!, 'internal-error');
      } catch {
        await query('UPDATE final_transcripts SET next_attempt_at = (NOW() + INTERVAL 10 MINUTE) WHERE session_id = ?', [id]).catch(() => {});
      }
    } else {
      unexpectedErrors.set(id, n);
      await query('UPDATE final_transcripts SET next_attempt_at = (NOW() + INTERVAL ? SECOND) WHERE session_id = ?', [60 * n, id]).catch(() => {});
    }
  } finally {
    // جلسه وسطِ کار حذف شد ⇒ منابعِ Soniox همین اجرا یتیم نماند (صدایِ بالینی)
    if (lastJob && (lastJob.sonioxFileId || lastJob.sonioxTranscriptionId)) {
      try {
        const still = await query('SELECT 1 AS x FROM final_transcripts WHERE session_id = ?', [id]);
        if (!still.rows[0]) {
          if (lastJob.sonioxTranscriptionId) await deleteTranscription(lastJob.sonioxTranscriptionId).catch(() => {});
          if (lastJob.sonioxFileId) await deleteFile(lastJob.sonioxFileId).catch(() => {});
        }
      } catch {}
    }
    clearInterval(hb);
    await query('UPDATE final_transcripts SET locked_until = NULL WHERE session_id = ?', [id]).catch(() => {});
    running.delete(id);
  }
}

async function tick(): Promise<void> {
  if (ticking || !deps) return;
  ticking = true;
  try {
    beat('final-transcript-worker', TICK_MS);
    if (running.size >= CONCURRENCY) return;
    const due = await query(
      `SELECT session_id FROM final_transcripts
       WHERE stage IN ${ACTIVE} AND next_attempt_at <= NOW() AND (locked_until IS NULL OR locked_until < NOW())
       ORDER BY next_attempt_at ASC LIMIT ?`, [CONCURRENCY + running.size]);
    for (const row of due.rows) {
      if (running.size >= CONCURRENCY) break;
      if (running.has(row.session_id)) continue;
      if (await claim(row.session_id)) void runJob(row.session_id);
    }
  } catch (e) {
    console.log('[final-transcript] tick failed:', String(e).slice(0, 160));
  } finally {
    ticking = false;
  }
}

export async function startFinalTranscriptWorker(customDeps?: FtDeps): Promise<void> {
  deps = customDeps || productionFtDeps();
  await query('UPDATE final_transcripts SET locked_until = NULL WHERE locked_until IS NOT NULL').catch(() => {});
  await query(
    `UPDATE final_transcripts SET next_attempt_at = LEAST(next_attempt_at, NOW() + INTERVAL 20 SECOND)
     WHERE stage = 'transcribing' AND soniox_transcription_id IS NOT NULL`).catch(() => {});
  if (timer) clearInterval(timer);
  timer = setInterval(() => { void tick(); }, TICK_MS);
  void tick();
}

export function wakeFinalTranscriptWorker(): void {
  setImmediate(() => { void tick(); });
}
