// ادمین: جدول‌هایِ لایه‌ی رصد (obs_events / obs_ui_events) و آمارِ صف/فایل/DB. pluginِ فرزندِ adminRoutes (requireAdmin).
import { FastifyInstance } from 'fastify';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { obsQueueStats } from '../../obs/eventLog.js';
import { listObsEvents, listObsUiEvents, obsDailyCounts, obsTableSizes } from './admin.repository.js';

export async function obsAdminRoutes(app: FastifyInstance) {
  // GET /api/admin/obs/events — جدولِ فیلترشده‌ی obs_events (فیلترهایِ اختیاری، الگوی
  // موجودِ `? IS NULL OR col = ?`).
  app.get('/api/admin/obs/events', async (request) => {
    const q = request.query as {
      event?: string; severity?: string; therapist_id?: string; session_id?: string;
      source?: string; from?: string; to?: string; limit?: string;
    };
    const limitRaw = Number(q.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 500) : 100;
    const event = q.event?.trim() || null;
    const severity = q.severity?.trim() || null;
    const therapistId = q.therapist_id?.trim() || null;
    const sessionId = q.session_id?.trim() || null;
    const source = q.source?.trim() || null;
    const from = q.from?.trim() || null;
    const to = q.to?.trim() || null;

    return { events: await listObsEvents({ event, severity, therapistId, sessionId, source, from, to, limit }) };
  });

  // GET /api/admin/obs/ui-events — همان الگو برایِ obs_ui_events.
  app.get('/api/admin/obs/ui-events', async (request) => {
    const q = request.query as {
      kind?: string; therapist_id?: string; session_id?: string; nav_id?: string;
      from?: string; to?: string; limit?: string;
    };
    const limitRaw = Number(q.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 500) : 100;
    const kind = q.kind?.trim() || null;
    const therapistId = q.therapist_id?.trim() || null;
    const sessionId = q.session_id?.trim() || null;
    const navId = q.nav_id?.trim() || null;
    const from = q.from?.trim() || null;
    const to = q.to?.trim() || null;

    return { events: await listObsUiEvents({ kind, therapistId, sessionId, navId, from, to, limit }) };
  });

  // GET /api/admin/obs/stats — شمارشِ روزانه‌ی ۱۴روزه به تفکیکِ رویداد، آمارِ صفِ درون‌حافظه‌ای،
  // اندازه‌ی فایل‌هایِ JSONL، و حجمِ DBِ دو جدول.
  app.get('/api/admin/obs/stats', async () => {
    const daily = await obsDailyCounts();

    let dbSize: { obs_events: number; obs_ui_events: number } = { obs_events: 0, obs_ui_events: 0 };
    try {
      const sizeRows = await obsTableSizes();
      for (const r of sizeRows) {
        if (r.table_name === 'obs_events') dbSize.obs_events = Number(r.size_bytes) || 0;
        if (r.table_name === 'obs_ui_events') dbSize.obs_ui_events = Number(r.size_bytes) || 0;
      }
    } catch {
      // information_schema ممکن است در بعضی محیط‌های محدودشده در دسترس نباشد — fail-open
    }

    const logDir = path.join(process.cwd(), 'data', 'logs');
    let jsonlFiles: Array<{ name: string; bytes: number }> = [];
    try {
      if (existsSync(logDir)) {
        jsonlFiles = readdirSync(logDir)
          .filter((f) => f.startsWith('obs.jsonl'))
          .map((f) => {
            try { return { name: f, bytes: statSync(path.join(logDir, f)).size }; }
            catch { return { name: f, bytes: 0 }; }
          });
      }
    } catch {
      // no-op
    }

    return {
      daily_counts: daily,
      queue: obsQueueStats(),
      jsonl_files: jsonlFiles,
      db_size_bytes: dbSize,
    };
  });
}
