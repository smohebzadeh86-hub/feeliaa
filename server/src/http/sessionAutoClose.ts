// A3 (پلنِ رفعِ ذخیره‌سازی، تصمیمِ مالک 2026-09-26: جلسه‌ی رهاشده «خودکار بسته شود»).
// قبلاً جلسه‌ی زنده‌ای که تراپیست «پایان» نمی‌زد (تب بسته، گوشی خاموش) برایِ همیشه in_progress/recovered می‌ماند:
// ادمین نمی‌فهمید تمام شده یا نه، پرونده هرگز trigger نمی‌شد و preflightِ deploy همیشه «جلسه‌ی زنده» می‌دید.
// این worker جلسه‌ای را می‌بندد که در هیچ‌کدام از سه سیگنال فعالیتی نداشته: ذخیره‌ی خودِ جلسه (updated_at —
// autosaveِ متن/مدت)، رسیدنِ صدا (session_audio) و رویدادِ obs (rt.*، mint، …). جلسه‌ی خودکاربسته قابلِ ادامه است.
import { query } from '../db/connection.js';
import { logEvent } from '../obs/eventLog.js';
import { recordAudit } from '../obs/audit.js';
import { maybeAutoGenerateCaseFile } from '../features/case-file/application/autoTrigger.js';
import { enqueueFinalTranscript } from '../features/final-transcript/index.js';

export const AUTO_CLOSE_IDLE_SECONDS = Number(process.env.SESSION_AUTO_CLOSE_IDLE_SECONDS || 2 * 60 * 60);
export const AUTO_CLOSE_INTERVAL_MS = 15 * 60 * 1000;

// opts.therapistId: محدود به یک تراپیست (فقط برایِ تستِ E2E رویِ DBِ مشترکِ dev تا جلسه‌هایِ دیگران بسته نشوند).
export async function autoCloseAbandonedSessions(opts: { therapistId?: string } = {}): Promise<number> {
  const idle = Math.max(15 * 60, Math.floor(AUTO_CLOSE_IDLE_SECONDS));
  let closed = 0;
  try {
    const scope = opts.therapistId ? ' AND c.therapist_id = ?' : '';
    const r = await query(
      `SELECT s.id, s.client_id, c.therapist_id FROM sessions s
         JOIN clients c ON c.id = s.client_id
        WHERE s.status IN ('in_progress', 'recovered')
          AND (s.source IS NULL OR s.source <> 'upload')
          AND s.updated_at < (NOW() - INTERVAL ? SECOND)
          AND NOT EXISTS (SELECT 1 FROM session_audio a WHERE a.session_id = s.id AND a.created_at > (NOW() - INTERVAL ? SECOND))
          AND NOT EXISTS (SELECT 1 FROM obs_events e WHERE e.session_id = s.id AND e.ts > (NOW() - INTERVAL ? SECOND))${scope}`,
      opts.therapistId ? [idle, idle, idle, opts.therapistId] : [idle, idle, idle]
    );
    for (const row of r.rows as Array<{ id: string; client_id: string; therapist_id: string }>) {
      // شرطِ بی‌فعالیتی دوباره در خودِ UPDATE — اگر همین لحظه ذخیره‌ای رسید، بسته نمی‌شود.
      const u = await query(
        `UPDATE sessions SET status = 'completed', auto_closed_at = NOW()
          WHERE id = ? AND status IN ('in_progress', 'recovered') AND updated_at < (NOW() - INTERVAL ? SECOND)`,
        [row.id, idle]
      );
      if (u.rowCount !== 1) continue;
      closed++;
      logEvent({ event: 'session.auto_closed', sessionId: row.id, clientId: row.client_id, therapistId: row.therapist_id, source: 'server', detail: { elapsed_ms: idle * 1000 } });
      await recordAudit({ actorId: null, action: 'session.auto_closed', targetType: 'session', targetId: row.id, detail: { elapsed_ms: idle * 1000 } });
      void maybeAutoGenerateCaseFile(row.client_id, row.therapist_id);
      void enqueueFinalTranscript(row.id);
    }
    if (closed) console.log(`[session] auto-closed ${closed} abandoned session(s)`);
  } catch (e) {
    console.log('[session] auto-close failed:', String(e).slice(0, 160));
  }
  return closed;
}
