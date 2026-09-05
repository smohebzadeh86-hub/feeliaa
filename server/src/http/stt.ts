// تست اتصال به Soniox — قبل از شروع جلسه، بدون اینکه صدایی رد و بدل بشه
import { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/guard.js';
import { SonioxEngine } from '../stt/soniox.js';

export async function sttRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /api/stt/check — یک اتصال آزمایشی به Soniox باز و بلافاصله بسته می‌شود
  app.get('/api/stt/check', async () => {
    const sonioxKey = process.env.SONIOX_API_KEY;
    if (!sonioxKey) {
      return { ok: false, error: 'کلید Soniox روی سرور تنظیم نشده' };
    }

    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      let settled = false;

      const engine = new SonioxEngine(sonioxKey, {
        onPreview: () => {},
        onStatus: () => {},
        onFinished: () => {},
        onError: (message) => {
          if (settled) return;
          settled = true;
          resolve({ ok: false, error: message });
        },
      });

      engine.start()
        .then(() => {
          if (settled) return;
          settled = true;
          engine.stop().catch(() => {});
          resolve({ ok: true });
        })
        .catch(() => {
          if (settled) return;
          settled = true;
          resolve({ ok: false, error: 'اتصال به سرویس رونویسی برقرار نشد' });
        });
    });
  });
}
