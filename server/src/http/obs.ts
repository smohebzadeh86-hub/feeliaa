// POST /api/obs/events — دریافتِ بچِ تله‌متریِ UI از public/feelia-obs.js.
// هرگز existence oracle نمی‌شود (مالکیتِ نادرستِ session_id → ذخیره با session_id=null
// + یک رویدادِ obs.session_mismatch، نه 404). ts همیشه از سرور می‌آید.
import { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/guard.js';
import { getOwnedSession } from '../db/ownership.js';
import { logEvent, logUiEvents } from '../obs/eventLog.js';
import { isSafeToken, sanitizeDetail } from '../obs/redact.js';
import { OBS_CLIENT_EVENTS } from '../obs/types.js';
import type { ObsUiEventInput, ObsUiKind } from '../obs/types.js';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const VALID_KINDS = new Set<string>(['click', 'nav', 'visibility', 'net', 'lifecycle', 'error']);
// فازِ ۲: 'client_event' یک kindِ جداست — به obs_ui_events نمی‌رود (آن جدول ستونِ
// detail/run_id ندارد)، بلکه از همان logEvent سمتِ سرور به obs_events می‌رود (که
// run_id دارد و به session_audio.run_id join می‌شود، طبقِ migration 017/021).
const CLIENT_EVENT_NAMES = new Set<string>(OBS_CLIENT_EVENTS);
const MAX_EVENTS_PER_BATCH = 200;
const CLIENT_TS_WINDOW_MS = 24 * 60 * 60 * 1000; // ±۲۴ ساعت

// rate-limit درون‌حافظه‌ای — همان الگویِ mintRateLimited در stt.ts.
const reqHits = new Map<string, number[]>();
const eventHits = new Map<string, number[]>();
function limited(map: Map<string, number[]>, key: string, max: number, weight = 1): boolean {
  const now = Date.now();
  const arr = (map.get(key) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= max) {
    map.set(key, arr);
    return true;
  }
  for (let i = 0; i < weight; i++) arr.push(now);
  map.set(key, arr);
  return false;
}

interface RawObsEvent {
  nav_id?: unknown;
  seq?: unknown;
  kind?: unknown;
  screen?: unknown;
  session_id?: unknown;
  target_id?: unknown;
  target_role?: unknown;
  target_tag?: unknown;
  value_num?: unknown;
  ts?: unknown; // client_ts — نامِ فیلد در بدنه؛ هرگز به‌عنوانِ ts اصلی استفاده نمی‌شود
  // فازِ ۲ — فقط وقتی kind === 'client_event'
  event?: unknown;
  detail?: unknown;
  run_id?: unknown;
}

// دفاعِ عمیق (LAW-001): feelia-obs.js سمتِ کلاینت همین الگو را با isSafeToken فیلتر
// می‌کند، ولی این endpoint نباید فقط به کلاینتِ خودمان متکی باشد — یک کلاینتِ دیگر
// (یا باگ/دستکاریِ درخواست) می‌تواند مستقیماً هر رشته‌ای بفرستد. کشف‌شده در verificationِ
// canaryِ 2026-09-22: بدونِ این چک، `target_id` می‌توانست متنِ فارسیِ دلخواه در DB بنشیند.
function safeShortToken(v: unknown, max: number): string | null {
  if (!isSafeToken(v)) return null;
  return v.length <= max ? v : null;
}

// بعدِ پاسخِ ۲۰۴ اجرا می‌شود — fire-and-forget، هرگز نباید request/reply را لمس کند.
async function processEvents(therapistId: string, rawEvents: RawObsEvent[]): Promise<void> {
  const now = Date.now();
  const sessionCache = new Map<string, boolean>();
  const toEnqueue: ObsUiEventInput[] = [];

  for (const raw of rawEvents) {
    if (!raw || typeof raw !== 'object') continue;
    const navId = typeof raw.nav_id === 'string' && UUID_RE.test(raw.nav_id) ? raw.nav_id : null;

    let sessionId: string | null = null;
    const rawSessionId = typeof raw.session_id === 'string' ? raw.session_id : null;
    if (rawSessionId) {
      let owns = sessionCache.get(rawSessionId);
      if (owns === undefined) {
        try {
          owns = !!(await getOwnedSession(rawSessionId, therapistId));
        } catch {
          owns = false;
        }
        sessionCache.set(rawSessionId, owns);
      }
      if (owns) {
        sessionId = rawSessionId;
      } else {
        // تله‌متری نباید existence oracle شود — نه 404، فقط session_id=null + یک رویدادِ جدا.
        logEvent({ event: 'obs.session_mismatch', source: 'client', severity: 'debug', therapistId, detail: {} });
      }
    }

    let clientTs: Date | null = null;
    if (typeof raw.ts === 'number' && Number.isFinite(raw.ts)) {
      const delta = Math.abs(now - raw.ts);
      if (delta <= CLIENT_TS_WINDOW_MS) clientTs = new Date(raw.ts);
    }

    // فازِ ۲: رویدادهایِ ساختاریافتهِ rt.* از FeeliaObs.event(name, detail) — به obs_events
    // (نه obs_ui_events) می‌روند تا detail JSON و run_id داشته باشند.
    if (raw.kind === 'client_event') {
      if (!navId) continue;
      const eventName = typeof raw.event === 'string' && CLIENT_EVENT_NAMES.has(raw.event) ? raw.event : null;
      if (!eventName) continue; // نامِ ناشناس → بی‌صدا drop (همون الگویِ بقیه‌ی این تابع)
      const runId = typeof raw.run_id === 'string' && isSafeToken(raw.run_id) ? raw.run_id : null;
      logEvent({
        event: eventName,
        source: 'client',
        severity: 'info',
        therapistId,
        sessionId,
        runId,
        navId,
        clientTs,
        detail: sanitizeDetail(raw.detail),
      });
      continue;
    }

    const kind = typeof raw.kind === 'string' && VALID_KINDS.has(raw.kind) ? (raw.kind as ObsUiKind) : null;
    const seq = typeof raw.seq === 'number' && Number.isFinite(raw.seq) ? Math.trunc(raw.seq) : null;
    if (!navId || !kind || seq === null) continue; // نامِ ناشناس/بدشکل → بی‌صدا drop

    toEnqueue.push({
      therapistId,
      sessionId,
      navId,
      seq,
      kind,
      screen: safeShortToken(raw.screen, 64),
      targetId: safeShortToken(raw.target_id, 64),
      targetRole: safeShortToken(raw.target_role, 32),
      targetTag: safeShortToken(raw.target_tag, 16),
      valueNum: typeof raw.value_num === 'number' && Number.isFinite(raw.value_num) ? Math.trunc(raw.value_num) : null,
      clientTs,
    });
  }

  if (toEnqueue.length) logUiEvents(toEnqueue);
}

export async function obsRoutes(app: FastifyInstance) {
  app.register(async (scope) => {
    scope.addHook('preHandler', requireAuth);

    scope.post(
      '/api/obs/events',
      { bodyLimit: 64 * 1024 },
      async (request, reply) => {
        const therapistId = request.therapistId!;
        if (limited(reqHits, therapistId, 20)) {
          reply.code(429);
          return { error: 'درخواست زیاد؛ کمی صبر کنید', code: 'obs-rate-limited' };
        }

        const body = request.body as { events?: unknown } | undefined;
        const rawEvents = Array.isArray(body?.events) ? (body!.events as RawObsEvent[]) : null;
        if (!rawEvents || rawEvents.length === 0 || rawEvents.length > MAX_EVENTS_PER_BATCH) {
          reply.code(400);
          return { error: 'بدنه‌ی نامعتبر است', code: 'obs-bad-payload' };
        }

        if (limited(eventHits, therapistId, 1500, rawEvents.length)) {
          reply.code(429);
          return { error: 'درخواست زیاد؛ کمی صبر کنید', code: 'obs-rate-limited' };
        }

        // پاسخِ ۲۰۴ قبل از کارِ DB — طبقِ پلن. باقیِ کار (شاملِ چکِ مالکیتِ session_id،
        // که خودش یک کوئریِ async است) بعدِ send شروع می‌شود، بدونِ اینکه پاسخِ HTTP
        // منتظرش بماند.
        reply.code(204).send();
        void processEvents(therapistId, rawEvents);
      }
    );
  });
}
