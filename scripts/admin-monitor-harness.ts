// harness پنلِ ادمین (جلسات زنده / صف / سلامتِ سیستم) — توابعِ خالص، بدونِ DB/شبکه. اجرا: pnpm test:adm
import assert from 'node:assert/strict';
import { liveHealth, LIVE_RECORDING_MAX_S, LIVE_QUIET_MAX_S } from '../server/src/features/admin/liveHealth.js';
import { beat, heartbeats, heartbeatStatus, scheduleBeating } from '../server/src/obs/heartbeat.js';
import { createHttpMetrics, percentile, BUCKET_MS, BUCKET_COUNT } from '../server/src/obs/httpMetrics.js';

let pass = 0, fail = 0;
async function t(name: string, fn: () => void | Promise<void>) {
  try { await fn(); pass++; console.log('PASS ' + name); }
  catch (e: any) { fail++; console.log('FAIL ' + name + ' — ' + (e?.message || e)); }
}

(async () => {
  await t('liveHealth: مرزهایِ recording/quiet/stalled', () => {
    assert.equal(liveHealth(0, 0), 'recording');
    assert.equal(liveHealth(LIVE_RECORDING_MAX_S - 1, 0), 'recording');
    assert.equal(liveHealth(LIVE_RECORDING_MAX_S, 0), 'quiet');
    assert.equal(liveHealth(LIVE_QUIET_MAX_S, 0), 'quiet');
    assert.equal(liveHealth(LIVE_QUIET_MAX_S + 1, 0), 'stalled');
  });
  await t('liveHealth: بدونِ سگمنت ⇒ سنِ آخرین ذخیره‌ی جلسه ملاک است', () => {
    assert.equal(liveHealth(null, 30), 'recording');
    assert.equal(liveHealth(null, 600), 'quiet');
    assert.equal(liveHealth(null, 3600), 'stalled');
  });

  await t('heartbeat: worker «ok» تا ۳× بازه، بعد stale؛ بدونِ ضربان unknown', () => {
    assert.equal(heartbeatStatus({ intervalMs: 1000, lastAt: null }, 5000), 'unknown');
    assert.equal(heartbeatStatus({ intervalMs: 1000, lastAt: 1000 }, 3999), 'ok');
    assert.equal(heartbeatStatus({ intervalMs: 1000, lastAt: 1000 }, 4001), 'stale');
  });
  await t('heartbeat: beat شمارنده/خطا را نگه می‌دارد و خطا به ۱۲۰ نویسه بریده می‌شود', () => {
    beat('h-test', 500);
    beat('h-test', undefined, new Error('x'.repeat(300)));
    const h = heartbeats().find((x) => x.name === 'h-test')!;
    assert.equal(h.count, 2);
    assert.equal(h.intervalMs, 500);
    assert.equal(h.lastError!.length, 120);
    beat('h-test');
    assert.equal(heartbeats().find((x) => x.name === 'h-test')!.lastError, null);
  });

  await t('scheduleBeating: ضربان با هر اجرا، خطایِ async/sync ثبت می‌شود و worker زنده می‌ماند', async () => {
    let n = 0;
    const timer = scheduleBeating('sb-test', 20, () => { n++; if (n === 2) throw new Error('boom'); if (n === 3) return Promise.reject(new Error('rej')); });
    assert.equal(heartbeats().find((x) => x.name === 'sb-test')!.count, 1); // ثبتِ فوریِ بازه
    await new Promise((r) => setTimeout(r, 150));
    clearInterval(timer);
    const h = heartbeats().find((x) => x.name === 'sb-test')!;
    assert.ok(n >= 4 && h.count >= 5, `n=${n} count=${h.count}`);
    assert.equal(h.lastError, null); // اجرایِ سالمِ بعدی خطا را پاک می‌کند
    assert.equal(h.status, 'ok');
  });

  await t('percentile: p50/p95 روشِ nearest-rank', () => {
    const v = Array.from({ length: 100 }, (_, i) => i + 1);
    assert.equal(percentile(v, 50), 50);
    assert.equal(percentile(v, 95), 95);
    assert.equal(percentile([], 95), null);
    assert.equal(percentile([7], 95), 7);
  });
  await t('httpMetrics: سطل‌بندیِ ۳۰دقیقه‌ای، 4xx/5xx، و خروج از پنجره‌ی ۲۴ساعته', () => {
    let now = 10 * BUCKET_MS;
    const m = createHttpMetrics(() => now);
    m.record(200, 10); m.record(404, 20); m.record(500, 30);
    now += BUCKET_MS;
    m.record(200, 40);
    let s = m.snapshot();
    assert.equal(s.buckets.length, BUCKET_COUNT);
    assert.equal(s.total, 4); assert.equal(s.c4xx, 1); assert.equal(s.c5xx, 1);
    assert.equal(s.error_rate_5xx, 0.25);
    assert.equal(s.buckets[BUCKET_COUNT - 1].count, 1);
    assert.equal(s.buckets[BUCKET_COUNT - 2].count, 3);
    now += BUCKET_COUNT * BUCKET_MS; // همه از پنجره بیرون
    s = m.snapshot();
    assert.equal(s.total, 0); assert.equal(s.p95_ms, null);
  });
  await t('httpMetrics: reservoir حافظه را محدود نگه می‌دارد ولی شمارش دقیق است', () => {
    const m = createHttpMetrics(() => 5 * BUCKET_MS);
    for (let i = 0; i < 5000; i++) m.record(200, i);
    const s = m.snapshot();
    assert.equal(s.total, 5000);
    assert.ok(s.p95_ms! > 3500 && s.p95_ms! <= 4999, 'p95=' + s.p95_ms);
  });

  // ——— متریک‌هایِ Core (F10، 2026-10-02): محاسبه‌یِ خالص ———
  await t('coreMetrics: نسبت‌ها، گردکردن به ۳ رقم و null وقتی مخرج صفر است', async () => {
    const { computeCoreMetrics, clampDays, CORE_METRICS_DEFAULT_DAYS, CORE_METRICS_MAX_DAYS } = await import('../server/src/features/admin/coreMetrics.js');
    const zero = computeCoreMetrics({
      windowDays: 30, live: { sessions: 0, reliable: 0, withText: 0, withAudio: 0 },
      events: { reconnectOk: 0, reconnectExhausted: 0, gapMarked: 0, batchCompleted: 0, batchFailed: 0, segmentUnrecoverable: 0, watchdogSilent: 0, healthProblem: 0, micLost: 0, liveLockDenied: 0 },
      corrections: { revisedSessions: 0, roleEditedSessions: 0 }, usage: { activeTherapists: 0, returningTherapists: 0, totalSessions: 0, weeklyActiveTherapists: 0 },
    });
    assert.equal(zero.capture_reliability.realtime_reliable_rate, null);
    assert.equal(zero.recovery_success.reconnect_success_rate, null);
    assert.equal(zero.recovery_success.batch_success_rate, null);
    assert.equal(zero.correction_rate.revision_rate, null);
    assert.equal(zero.repeat_usage.returning_rate, null);
    assert.equal(zero.repeat_usage.sessions_per_active_therapist, null);
    const m = computeCoreMetrics({
      windowDays: 7, live: { sessions: 30, reliable: 29, withText: 30, withAudio: 27 },
      events: { reconnectOk: 8, reconnectExhausted: 2, gapMarked: 9, batchCompleted: 6, batchFailed: 1, segmentUnrecoverable: 1, watchdogSilent: 3, healthProblem: 4, micLost: 5, liveLockDenied: 1 },
      corrections: { revisedSessions: 6, roleEditedSessions: 3 }, usage: { activeTherapists: 7, returningTherapists: 5, totalSessions: 30, weeklyActiveTherapists: 4 },
    });
    assert.equal(m.window_days, 7);
    assert.equal(m.capture_reliability.realtime_reliable_rate, 0.967);
    assert.equal(m.capture_reliability.text_captured_rate, 1);
    assert.equal(m.capture_reliability.audio_saved_rate, 0.9);
    assert.equal(m.recovery_success.reconnect_success_rate, 0.8);
    assert.equal(m.recovery_success.batch_success_rate, 0.75);
    assert.equal(m.recovery_success.silent_ws_detected, 3);
    assert.equal(m.correction_rate.revision_rate, 0.2);
    assert.equal(m.correction_rate.role_edit_rate, 0.1);
    assert.equal(m.repeat_usage.returning_rate, 0.714);
    assert.equal(m.repeat_usage.sessions_per_active_therapist, 4.29);
    assert.equal(m.repeat_usage.weekly_active_therapists, 4);
    // خروجی فقط عدد است: هیچ رشته‌ی آزادی (متنِ بالینی) در JSON نیست
    const flat = JSON.stringify(m).replace(/"[a-z_]+":/g, '');
    assert.ok(!/[؀-ۿ]/.test(flat), 'بدونِ متنِ فارسی');
    assert.equal(clampDays(undefined), CORE_METRICS_DEFAULT_DAYS);
    assert.equal(clampDays('0'), CORE_METRICS_DEFAULT_DAYS);
    assert.equal(clampDays('-5'), CORE_METRICS_DEFAULT_DAYS);
    assert.equal(clampDays('abc'), CORE_METRICS_DEFAULT_DAYS);
    assert.equal(clampDays('9999'), CORE_METRICS_MAX_DAYS);
    assert.equal(clampDays('14'), 14);
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
