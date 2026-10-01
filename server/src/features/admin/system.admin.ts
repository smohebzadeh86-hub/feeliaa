// ادمین: سلامت و آمارِ سیستم. هیچ داده‌ی بالینی/کاربری — فقط شمارنده‌ها، زمان‌ها و حجم‌ها. pluginِ فرزندِ adminRoutes.
import { FastifyInstance } from 'fastify';
import { statfs, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { heartbeats } from '../../obs/heartbeat.js';
import { httpMetrics } from '../../obs/httpMetrics.js';
import { obsQueueStats } from '../../obs/eventLog.js';
import { pingDb, dbTotalSizeBytes, obsSeverityCounts24h, countLlmUnavailable24h } from './admin.repository.js';

const STARTED_AT = Date.now();
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_SUBDIRS = ['session-audio', 'uploads', 'logs', 'batch-queue'];
const DIR_CACHE_MS = 5 * 60 * 1000;
let dirCache: { at: number; value: Array<{ name: string; bytes: number }> } | null = null;

async function dirBytes(dir: string, depth = 0): Promise<number> {
  let total = 0;
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    try {
      if (e.isDirectory()) { if (depth < 6) total += await dirBytes(p, depth + 1); }
      else if (e.isFile()) total += (await stat(p)).size;
    } catch {}
  }
  return total;
}

async function dataDirSizes() {
  if (dirCache && Date.now() - dirCache.at < DIR_CACHE_MS) return dirCache;
  const value: Array<{ name: string; bytes: number }> = [];
  for (const n of DATA_SUBDIRS) value.push({ name: n, bytes: await dirBytes(path.join(DATA_DIR, n)) });
  dirCache = { at: Date.now(), value };
  return dirCache;
}

// fail-open: هر بخش جدا — خطایِ یکی بقیه را نمی‌اندازد
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

export async function systemAdminRoutes(app: FastifyInstance) {
  // GET /api/admin/system
  app.get('/api/admin/system', async () => {
    const now = Date.now();
    const [ping, dbSize, sev, llm, disk, dirs] = await Promise.all([
      safe(() => pingDb(), null as number | null),
      safe(() => dbTotalSizeBytes(), null as number | null),
      safe(() => obsSeverityCounts24h(), null as { error: number; warn: number } | null),
      safe(() => countLlmUnavailable24h(), null as number | null),
      safe(async () => {
        const s = await statfs(DATA_DIR);
        return { free_bytes: Number(s.bavail) * Number(s.bsize), total_bytes: Number(s.blocks) * Number(s.bsize) };
      }, null as { free_bytes: number; total_bytes: number } | null),
      safe(() => dataDirSizes(), { at: now, value: [] as Array<{ name: string; bytes: number }> }),
    ]);
    return {
      uptime_s: Math.round(process.uptime()),
      started_at: new Date(STARTED_AT).toISOString(),
      node: process.version,
      db: { ok: ping !== null, ping_ms: ping === null ? null : Math.round(ping * 10) / 10, size_bytes: dbSize },
      disk: {
        free_bytes: disk?.free_bytes ?? null, total_bytes: disk?.total_bytes ?? null,
        dirs: dirs.value, dirs_cached_at: new Date(dirs.at).toISOString(),
      },
      workers: heartbeats(now).map((h) => ({
        name: h.name, status: h.status, interval_ms: h.intervalMs, age_s: h.age_s, count: h.count, last_error: h.lastError,
      })),
      http: httpMetrics.snapshot(),
      obs: { queue: obsQueueStats(), events_24h: sev },
      llm_unavailable_24h: llm,
    };
  });
}
