// ادمین: متریک‌هایِ Core (F10) — فقط شمارنده/نسبت. pluginِ فرزندِ adminRoutes (requireAdmin). بدونِ متنِ بالینی (LAW-001).
import { FastifyInstance } from 'fastify';
import { clampDays, computeCoreMetrics, loadCoreMetricsInput } from './coreMetrics.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function metricsAdminRoutes(app: FastifyInstance) {
  // GET /api/admin/core-metrics?days=30&therapist_id=
  app.get('/api/admin/core-metrics', async (request) => {
    const q = request.query as { days?: string; therapist_id?: string };
    const therapistId = q.therapist_id && UUID_RE.test(q.therapist_id) ? q.therapist_id : null;
    const days = clampDays(q.days);
    return computeCoreMetrics(await loadCoreMetricsInput(days, therapistId));
  });
}
