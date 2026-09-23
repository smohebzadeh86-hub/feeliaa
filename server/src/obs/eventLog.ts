// صفِ درون‌حافظه‌ای + drainِ دوره‌ای به DB، به‌علاوه‌ی نوشتنِ همیشگیِ JSONL.
// هیچ‌کدام از توابعِ این فایل هرگز throw نمی‌کنند — رصد نباید هیچ‌وقت مسیرِ اصلیِ
// کاربر را fail کند.
import { query } from '../db/connection.js';
import { sanitizeDetail } from './redact.js';
import { writeJsonl } from './fileSink.js';
import type { ObsEventInput, ObsUiEventInput } from './types.js';

const MAX_QUEUE = 2000;
const DRAIN_BATCH = 200;
const DRAIN_INTERVAL_OK_MS = 2000;
const DRAIN_INTERVAL_DOWN_MS = 30000;
const IMMEDIATE_DRAIN_THRESHOLD = 200;
const OVERFLOW_LOG_INTERVAL_MS = 60000;
const DB_FAIL_LOG_INTERVAL_MS = 60000;

interface QueuedEventRow {
  ts: Date;
  client_ts: Date | null;
  source: string;
  severity: string;
  event: string;
  code: string | null;
  therapist_id: string | null;
  client_id: string | null;
  session_id: string | null;
  run_id: string | null;
  request_id: string | null;
  nav_id: string | null;
  route: string | null;
  method: string | null;
  status_code: number | null;
  duration_ms: number | null;
  detail: string; // JSONِ از‌قبل‌stringifyشده
}

interface QueuedUiRow {
  ts: Date;
  client_ts: Date | null;
  therapist_id: string | null;
  session_id: string | null;
  nav_id: string;
  seq: number;
  kind: string;
  screen: string | null;
  target_id: string | null;
  target_role: string | null;
  target_tag: string | null;
  value_num: number | null;
}

const eventQueue: QueuedEventRow[] = [];
const uiQueue: QueuedUiRow[] = [];

let droppedSinceLastLog = 0;
let lastOverflowLogAt = 0;
let lastDbFailLogAt = 0;
let dbHealthy = true;
let drainTimer: ReturnType<typeof setInterval> | null = null;
let currentIntervalMs = DRAIN_INTERVAL_OK_MS;

let totalEnqueued = 0;
let totalInserted = 0;
let totalDbErrors = 0;

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  return v.slice(0, max);
}

function clampNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null;
}

function pushEventRow(row: QueuedEventRow) {
  totalEnqueued++;
  if (eventQueue.length >= MAX_QUEUE) {
    // سرریز: رویدادِ error همیشه نگه داشته می‌شود؛ رویدادِ کم‌اهمیتِ تازه دور ریخته می‌شود.
    if (row.severity !== 'error') {
      droppedSinceLastLog++;
      maybeLogOverflow();
      return;
    }
    // برایِ جا بازکردن، قدیمی‌ترینِ غیر-errorِ صف حذف می‌شود؛ اگر همه error بودند، صف کمی سرریز می‌کند.
    const idx = eventQueue.findIndex((r) => r.severity !== 'error');
    if (idx >= 0) eventQueue.splice(idx, 1);
    else droppedSinceLastLog++; // صف پر از error — چیزی برای جاخالی‌کردن نبود
  }
  eventQueue.push(row);
}

function maybeLogOverflow() {
  const now = Date.now();
  if (now - lastOverflowLogAt < OVERFLOW_LOG_INTERVAL_MS) return;
  lastOverflowLogAt = now;
  const dropped = droppedSinceLastLog;
  droppedSinceLastLog = 0;
  const row: QueuedEventRow = {
    ts: new Date(),
    client_ts: null,
    source: 'server',
    severity: 'warn',
    event: 'obs.queue_overflow',
    code: null,
    therapist_id: null,
    client_id: null,
    session_id: null,
    run_id: null,
    request_id: null,
    nav_id: null,
    route: null,
    method: null,
    status_code: null,
    duration_ms: null,
    detail: JSON.stringify({ dropped }),
  };
  writeJsonl({ ts: row.ts.toISOString(), event: row.event, severity: row.severity, detail: { dropped } });
  eventQueue.push(row);
}

// همگام؛ هرگز throw نمی‌کند.
export function logEvent(e: ObsEventInput): void {
  try {
    const now = new Date();
    const detail = sanitizeDetail(e.detail);
    const jsonlLine = {
      ts: now.toISOString(),
      client_ts: e.clientTs ? e.clientTs.toISOString() : null,
      source: e.source || 'server',
      severity: e.severity || 'info',
      event: clampStr(e.event, 64),
      code: clampStr(e.code ?? null, 64),
      therapist_id: e.therapistId ?? null,
      client_id: e.clientId ?? null,
      session_id: e.sessionId ?? null,
      run_id: clampStr(e.runId ?? null, 64),
      request_id: clampStr(e.requestId ?? null, 64),
      nav_id: e.navId ?? null,
      route: clampStr(e.route ?? null, 128),
      method: clampStr(e.method ?? null, 8),
      status_code: clampNum(e.statusCode ?? null),
      duration_ms: clampNum(e.durationMs ?? null),
      detail,
    };
    // فایل همیشه نوشته می‌شود (حتی وقتی DB پایین است) — نقطه‌ی مشکل‌گشاییِ اصلیِ فاز ۱.
    writeJsonl(jsonlLine);

    pushEventRow({
      ts: now,
      client_ts: e.clientTs ?? null,
      source: e.source || 'server',
      severity: e.severity || 'info',
      event: jsonlLine.event || 'unknown',
      code: jsonlLine.code,
      therapist_id: jsonlLine.therapist_id,
      client_id: jsonlLine.client_id,
      session_id: jsonlLine.session_id,
      run_id: jsonlLine.run_id,
      request_id: jsonlLine.request_id,
      nav_id: jsonlLine.nav_id,
      route: jsonlLine.route,
      method: jsonlLine.method,
      status_code: jsonlLine.status_code,
      duration_ms: jsonlLine.duration_ms,
      detail: JSON.stringify(detail),
    });

    if (eventQueue.length >= IMMEDIATE_DRAIN_THRESHOLD) {
      void drainEvents();
    }
  } catch {
    // هرگز نباید callerِ اصلی را fail کند
  }
}

// همگام (enqueue)؛ هرگز throw نمی‌کند. batch از POST /api/obs/events می‌آید.
export function logUiEvents(events: ObsUiEventInput[]): void {
  try {
    const now = new Date();
    for (const e of events) {
      if (!e || typeof e.navId !== 'string' || typeof e.seq !== 'number') continue;
      totalEnqueued++;
      if (uiQueue.length >= MAX_QUEUE) {
        droppedSinceLastLog++;
        maybeLogOverflow();
        continue;
      }
      uiQueue.push({
        ts: now,
        client_ts: e.clientTs ?? null,
        therapist_id: e.therapistId ?? null,
        session_id: e.sessionId ?? null,
        nav_id: e.navId,
        seq: clampNum(e.seq) ?? 0,
        kind: e.kind,
        screen: clampStr(e.screen ?? null, 64),
        target_id: clampStr(e.targetId ?? null, 64),
        target_role: clampStr(e.targetRole ?? null, 32),
        target_tag: clampStr(e.targetTag ?? null, 16),
        value_num: clampNum(e.valueNum ?? null),
      });
    }
    if (uiQueue.length >= IMMEDIATE_DRAIN_THRESHOLD) {
      void drainUi();
    }
  } catch {
    // no-op
  }
}

function maybeLogDbFailure(err: unknown) {
  const now = Date.now();
  totalDbErrors++;
  if (now - lastDbFailLogAt < DB_FAIL_LOG_INTERVAL_MS) return;
  lastDbFailLogAt = now;
  try {
    console.log('[obs] db sink failing:', err instanceof Error ? err.message.slice(0, 160) : String(err).slice(0, 160));
  } catch {
    // no-op
  }
}

async function drainEvents(): Promise<void> {
  if (!eventQueue.length) return;
  const batch = eventQueue.splice(0, DRAIN_BATCH);
  try {
    // ستون‌ها: ts, client_ts, source, severity, event, code, therapist_id, client_id,
    // session_id, run_id, request_id, nav_id, route, method, status_code, duration_ms, detail (۱۷ ستون)
    const cols = 17;
    const placeholders = batch.map(() => `(${Array(cols).fill('?').join(',')})`).join(',');
    const values: unknown[] = [];
    for (const r of batch) {
      values.push(
        r.ts, r.client_ts, r.source, r.severity, r.event, r.code,
        r.therapist_id, r.client_id, r.session_id, r.run_id, r.request_id,
        r.nav_id, r.route, r.method, r.status_code, r.duration_ms, r.detail
      );
    }
    await query(
      `INSERT INTO obs_events
        (ts, client_ts, source, severity, event, code, therapist_id, client_id, session_id, run_id, request_id, nav_id, route, method, status_code, duration_ms, detail)
       VALUES ${placeholders}`,
      values
    );
    totalInserted += batch.length;
    if (!dbHealthy) {
      dbHealthy = true;
      currentIntervalMs = DRAIN_INTERVAL_OK_MS;
      rescheduleTimer();
    }
  } catch (err) {
    // ردیف‌ها requeue نمی‌شوند — قبلاً در JSONL نوشته شده‌اند (fail-open طبقِ پلن).
    maybeLogDbFailure(err);
    if (dbHealthy) {
      dbHealthy = false;
      currentIntervalMs = DRAIN_INTERVAL_DOWN_MS;
      rescheduleTimer();
    }
  }
}

async function drainUi(): Promise<void> {
  if (!uiQueue.length) return;
  const batch = uiQueue.splice(0, DRAIN_BATCH);
  try {
    const cols = 12;
    const placeholders = batch.map(() => `(${Array(cols).fill('?').join(',')})`).join(',');
    const values: unknown[] = [];
    for (const r of batch) {
      values.push(
        r.ts, r.client_ts, r.therapist_id, r.session_id, r.nav_id, r.seq,
        r.kind, r.screen, r.target_id, r.target_role, r.target_tag, r.value_num
      );
    }
    await query(
      `INSERT INTO obs_ui_events
        (ts, client_ts, therapist_id, session_id, nav_id, seq, kind, screen, target_id, target_role, target_tag, value_num)
       VALUES ${placeholders}`,
      values
    );
    totalInserted += batch.length;
    if (!dbHealthy) {
      dbHealthy = true;
      currentIntervalMs = DRAIN_INTERVAL_OK_MS;
      rescheduleTimer();
    }
  } catch (err) {
    maybeLogDbFailure(err);
    if (dbHealthy) {
      dbHealthy = false;
      currentIntervalMs = DRAIN_INTERVAL_DOWN_MS;
      rescheduleTimer();
    }
  }
}

async function drainBoth(): Promise<void> {
  await drainEvents();
  await drainUi();
}

function rescheduleTimer() {
  if (drainTimer) clearInterval(drainTimer);
  drainTimer = setInterval(() => { void drainBoth(); }, currentIntervalMs);
  // ⭐ اجازه بده پروسه بدونِ منتظرماندنِ این تایمر خارج شود (فقط برایِ test-harness/CLI مهم است)
  if (typeof (drainTimer as any).unref === 'function') (drainTimer as any).unref();
}

export function startObsDrainLoop(): void {
  if (drainTimer) return;
  rescheduleTimer();
}

// از SIGTERM/Fastify onClose صدا زده می‌شود — تلاشِ نهایی برایِ خالی‌کردنِ صف قبل از خروج.
export async function flushObsQueue(): Promise<void> {
  try {
    if (drainTimer) {
      clearInterval(drainTimer);
      drainTimer = null;
    }
    // چند دور، چون هر دور فقط DRAIN_BATCH ردیف می‌فرستد.
    for (let i = 0; i < 10 && (eventQueue.length || uiQueue.length); i++) {
      await drainBoth();
    }
  } catch {
    // no-op — خروج نباید به‌خاطرِ obs گیر کند
  }
}

export function obsQueueStats() {
  return {
    event_queue_length: eventQueue.length,
    ui_queue_length: uiQueue.length,
    db_healthy: dbHealthy,
    drain_interval_ms: currentIntervalMs,
    total_enqueued: totalEnqueued,
    total_inserted: totalInserted,
    total_db_errors: totalDbErrors,
  };
}
