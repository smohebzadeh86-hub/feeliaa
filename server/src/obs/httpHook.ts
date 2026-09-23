// هوکِ Fastify: هر درخواست HTTP یک رویدادِ `http.request` می‌سازد. همیشه در JSONL
// نوشته می‌شود؛ فقط زیرمجموعه‌ای (خطا/کند/mutationِ مهم/مسیرِ ادمین) به DB می‌رود —
// جزئیات در گیتِ نمونه‌برداریِ پایین. query string و body و هدرها هرگز ثبت نمی‌شوند.
import type { FastifyInstance } from 'fastify';
import { logEvent } from './eventLog.js';
import { writeJsonl } from './fileSink.js';

const OBS_SLOW_MS = Number(process.env.OBS_SLOW_MS) > 0 ? Number(process.env.OBS_SLOW_MS) : 1500;

// mutationِ غیر-GET که حتی زیرِ آستانه‌ی کندی/خطا هم ارزشِ ثبت در DB را دارد.
const AUDITED_ROUTES = new Set<string>([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/sessions',
  '/api/sessions/:id',
  '/api/sessions/:id/notes',
  '/api/notes/:id',
  '/api/sessions/:id/voice-note',
  '/api/sessions/:id/batch-audio',
  '/api/sessions/:id/resolve-speakers',
  '/api/clients',
  '/api/clients/:id',
  '/api/therapists/:id',
  '/api/stt/realtime-session',
  '/api/obs/events',
]);

declare module 'fastify' {
  interface FastifyRequest {
    obsStartHrtime?: [number, number];
  }
}

export function registerObsHooks(app: FastifyInstance): void {
  app.addHook('onRequest', async (request) => {
    request.obsStartHrtime = process.hrtime();
  });

  app.addHook('onResponse', async (request, reply) => {
    try {
      const start = request.obsStartHrtime;
      const diff = start ? process.hrtime(start) : [0, 0];
      const durationMs = Math.round(diff[0] * 1000 + diff[1] / 1e6);
      // الگو نه URLِ خام — پارامترها (:id) جایگزینِ مقدارِ واقعی می‌شوند، هیچ query string.
      const route = request.routeOptions?.url || null;
      const statusCode = reply.statusCode;
      const method = request.method;
      const therapistId = (request as any).therapistId as string | null | undefined;

      const isSlow = durationMs >= OBS_SLOW_MS;
      const isError = statusCode >= 400;
      const isAdminRoute = !!route && route.startsWith('/api/admin/');
      const isAuditedMutation = method !== 'GET' && !!route && AUDITED_ROUTES.has(route);
      const toDb = isError || isSlow || isAuditedMutation || isAdminRoute;

      const detail = { status: statusCode, duration_ms: durationMs };

      if (toDb) {
        logEvent({
          event: 'http.request',
          source: 'server',
          severity: isError ? 'warn' : 'info',
          route: route || undefined,
          method,
          statusCode,
          durationMs,
          requestId: String(request.id),
          therapistId: therapistId || null,
          detail,
        });
      } else {
        // فقط فایل — هرگز DB. همان شکلِ خطِ logEvent برایِ یکنواختیِ ابزارِ خواندنِ لاگ.
        writeJsonl({
          ts: new Date().toISOString(),
          source: 'server',
          severity: 'info',
          event: 'http.request',
          route,
          method,
          status_code: statusCode,
          duration_ms: durationMs,
          request_id: String(request.id),
          therapist_id: therapistId || null,
          detail,
        });
      }
    } catch {
      // هرگز نباید پاسخِ HTTP را تحتِ تأثیر قرار دهد
    }
  });
}
