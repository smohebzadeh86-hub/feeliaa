// اندازه‌گیریِ Core (F10، 2026-10-02) — متریک‌هایِ §۱۴ product-thesis: Capture Reliability، Recovery Success، Correction Rate،
// Repeat Usage. فقط شمارنده و نسبت؛ هرگز متنِ بالینی (LAW-001). محاسبه‌یِ خالص (بدونِ DB) تا harness تست کند؛ SQL در همین فایل
// پایین‌تر (loadCoreMetricsInput) است.
import { query } from '../../db/connection.js';

export interface CoreMetricsInput {
  windowDays: number;
  // جلساتِ زنده‌یِ پایان‌یافته در پنجره
  live: { sessions: number; reliable: number; withText: number; withAudio: number };
  // رویدادهایِ مرورگر/سرور در پنجره (obs_events)
  events: {
    reconnectOk: number; reconnectExhausted: number; gapMarked: number;
    batchCompleted: number; batchFailed: number; segmentUnrecoverable: number;
    watchdogSilent: number; healthProblem: number; micLost: number; liveLockDenied: number;
  };
  // اصلاحِ دستی (روی همان جلساتِ زنده‌یِ پایان‌یافته)
  corrections: { revisedSessions: number; roleEditedSessions: number };
  // استفاده‌یِ مکرر (همه‌ی جلساتِ پنجره، هر نوع)
  usage: { activeTherapists: number; returningTherapists: number; totalSessions: number; weeklyActiveTherapists: number };
}

export interface CoreMetrics {
  window_days: number;
  capture_reliability: {
    live_sessions: number;
    realtime_reliable_rate: number | null; // سهمِ جلساتی که متنِ زنده بدونِ گپ/قطعِ جبران‌نشده ساخته شد
    text_captured_rate: number | null;     // سهمِ جلساتی که متنِ غیرِخالی دارند
    audio_saved_rate: number | null;       // سهمِ جلساتی که دست‌کم یک سگمنتِ صدا ذخیره شد
    mic_lost_events: number;
    health_problem_events: number;
    live_lock_denied_events: number;
  };
  recovery_success: {
    reconnect_ok: number;
    reconnect_exhausted: number;
    reconnect_success_rate: number | null;
    gap_marked: number;
    silent_ws_detected: number;
    batch_completed: number;
    batch_failed: number;
    segment_unrecoverable: number;
    batch_success_rate: number | null;
  };
  correction_rate: {
    sessions: number;
    revised_sessions: number;
    revision_rate: number | null;          // سهمِ جلساتی که متنشان بعد از ثبت دستی اصلاح/جایگزین شد
    role_edited_sessions: number;
    role_edit_rate: number | null;
  };
  repeat_usage: {
    active_therapists: number;
    returning_therapists: number;          // ≥۲ جلسه در پنجره
    returning_rate: number | null;
    weekly_active_therapists: number;      // ≥۱ جلسه در ۷ روزِ اخیر
    sessions_per_active_therapist: number | null;
  };
}

const rate = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 1000 : null);

export function computeCoreMetrics(i: CoreMetricsInput): CoreMetrics {
  const e = i.events;
  return {
    window_days: i.windowDays,
    capture_reliability: {
      live_sessions: i.live.sessions,
      realtime_reliable_rate: rate(i.live.reliable, i.live.sessions),
      text_captured_rate: rate(i.live.withText, i.live.sessions),
      audio_saved_rate: rate(i.live.withAudio, i.live.sessions),
      mic_lost_events: e.micLost,
      health_problem_events: e.healthProblem,
      live_lock_denied_events: e.liveLockDenied,
    },
    recovery_success: {
      reconnect_ok: e.reconnectOk,
      reconnect_exhausted: e.reconnectExhausted,
      reconnect_success_rate: rate(e.reconnectOk, e.reconnectOk + e.reconnectExhausted),
      gap_marked: e.gapMarked,
      silent_ws_detected: e.watchdogSilent,
      batch_completed: e.batchCompleted,
      batch_failed: e.batchFailed,
      segment_unrecoverable: e.segmentUnrecoverable,
      batch_success_rate: rate(e.batchCompleted, e.batchCompleted + e.batchFailed + e.segmentUnrecoverable),
    },
    correction_rate: {
      sessions: i.live.sessions,
      revised_sessions: i.corrections.revisedSessions,
      revision_rate: rate(i.corrections.revisedSessions, i.live.sessions),
      role_edited_sessions: i.corrections.roleEditedSessions,
      role_edit_rate: rate(i.corrections.roleEditedSessions, i.live.sessions),
    },
    repeat_usage: {
      active_therapists: i.usage.activeTherapists,
      returning_therapists: i.usage.returningTherapists,
      returning_rate: rate(i.usage.returningTherapists, i.usage.activeTherapists),
      weekly_active_therapists: i.usage.weeklyActiveTherapists,
      sessions_per_active_therapist: i.usage.activeTherapists > 0 ? Math.round((i.usage.totalSessions / i.usage.activeTherapists) * 100) / 100 : null,
    },
  };
}

export const CORE_METRICS_MAX_DAYS = 365;
export const CORE_METRICS_DEFAULT_DAYS = 30;

export function clampDays(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return CORE_METRICS_DEFAULT_DAYS;
  return Math.min(n, CORE_METRICS_MAX_DAYS);
}

const num = (v: unknown): number => Number(v) || 0;

// همه‌ی پرسش‌ها فقط COUNT/SUM می‌گیرند. therapistId اختیاری ⇒ همان یک درمانگر.
export async function loadCoreMetricsInput(windowDays: number, therapistId: string | null): Promise<CoreMetricsInput> {
  const tFilter = therapistId ? ' AND c.therapist_id = ?' : '';
  const tParams = therapistId ? [therapistId] : [];
  const since = `s.created_at >= (NOW() - INTERVAL ${Math.floor(windowDays)} DAY)`;

  const live = (await query(
    `SELECT COUNT(*) AS sessions,
            SUM(s.realtime_reliable = 1) AS reliable,
            SUM(CHAR_LENGTH(COALESCE(s.transcript, '')) > 0) AS with_text,
            SUM(EXISTS(SELECT 1 FROM session_audio a WHERE a.session_id = s.id)) AS with_audio,
            SUM(EXISTS(SELECT 1 FROM session_transcript_revisions r WHERE r.session_id = s.id)) AS revised,
            SUM(EXISTS(SELECT 1 FROM final_transcript_versions v WHERE v.session_id = s.id AND v.kind = 'role_edit')) AS role_edited
       FROM sessions s JOIN clients c ON c.id = s.client_id
      WHERE s.source = 'live' AND s.status IN ('completed', 'recovered') AND ${since}${tFilter}`, tParams)).rows[0] || {};

  const evRows = (await query(
    `SELECT event, COUNT(*) AS n FROM obs_events
      WHERE ts >= (NOW() - INTERVAL ${Math.floor(windowDays)} DAY)
        AND event IN ('rt.reconnect_ok','rt.reconnect_exhausted','rt.gap_marked','batch.completed','batch.failed','batch.segment_unrecoverable',
                      'rt.watchdog_silent','rt.health_problem','rt.mic_lost','rt.live_lock_denied')
        ${therapistId ? 'AND therapist_id = ?' : ''}
      GROUP BY event`, therapistId ? [therapistId] : [])).rows as any[];
  const ev = new Map<string, number>(evRows.map((r) => [String(r.event), num(r.n)]));

  const perT = (await query(
    `SELECT c.therapist_id, COUNT(*) AS n, MAX(s.created_at) >= (NOW() - INTERVAL 7 DAY) AS weekly
       FROM sessions s JOIN clients c ON c.id = s.client_id JOIN therapists t ON t.id = c.therapist_id
      WHERE ${since} AND t.is_admin = 0${tFilter}
      GROUP BY c.therapist_id`, tParams)).rows as any[];

  return {
    windowDays,
    live: { sessions: num(live.sessions), reliable: num(live.reliable), withText: num(live.with_text), withAudio: num(live.with_audio) },
    events: {
      reconnectOk: ev.get('rt.reconnect_ok') ?? 0, reconnectExhausted: ev.get('rt.reconnect_exhausted') ?? 0, gapMarked: ev.get('rt.gap_marked') ?? 0,
      batchCompleted: ev.get('batch.completed') ?? 0, batchFailed: ev.get('batch.failed') ?? 0, segmentUnrecoverable: ev.get('batch.segment_unrecoverable') ?? 0,
      watchdogSilent: ev.get('rt.watchdog_silent') ?? 0, healthProblem: ev.get('rt.health_problem') ?? 0, micLost: ev.get('rt.mic_lost') ?? 0,
      liveLockDenied: ev.get('rt.live_lock_denied') ?? 0,
    },
    corrections: { revisedSessions: num(live.revised), roleEditedSessions: num(live.role_edited) },
    usage: {
      activeTherapists: perT.length,
      returningTherapists: perT.filter((r) => num(r.n) >= 2).length,
      totalSessions: perT.reduce((a, r) => a + num(r.n), 0),
      weeklyActiveTherapists: perT.filter((r) => num(r.weekly) === 1).length,
    },
  };
}
