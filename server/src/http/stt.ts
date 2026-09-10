// تست اتصال به Soniox — قبل از شروع جلسه، بدون اینکه صدایی رد و بدل بشه
// قدم ۵ (پروژه فیلیا): Mint Endpoint برای اتصال مستقیم Client-Side.
// طبق soniox.html، مرورگر برای اتصال مستقیم به wss://stt-rt.soniox.com باید api_key را
// در پیام اول WS بفرستد. این کلید فقط به تراپیستِ لاگین‌کرده + صاحبِ همین session داده
// می‌شود (نه هاردکد در فرانت)، با rate-limit ساده. فرانت هنوز از مسیر قدیمی (/ws/t)
// استفاده می‌کند؛ این endpoint فقط credential می‌دهد و هیچ صدایی از آن رد نمی‌شود.
import { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/guard.js';
import { getOwnedSession } from '../db/ownership.js';
import { SonioxEngine } from '../stt/soniox.js';

const SONIOX_WS_URL = 'wss://stt-rt.soniox.com/transcribe-websocket';
// rate-limit ساده درون‌حافظه‌ای: هر تراپیست حداکثر ۳۰ mint در دقیقه
const mintHits = new Map<string, number[]>();
function mintRateLimited(therapistId: string): boolean {
  const now = Date.now();
  const arr = (mintHits.get(therapistId) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= 30) {
    mintHits.set(therapistId, arr);
    return true;
  }
  arr.push(now);
  mintHits.set(therapistId, arr);
  return false;
}

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

  // POST /api/stt/realtime-session — صدور credential برای اتصال مستقیم مرورگر به Soniox
  // body: { session_id: string } — session باید مال همین تراپیست باشد.
  app.post('/api/stt/realtime-session', async (request, reply) => {
    const sonioxKey = process.env.SONIOX_API_KEY;
    if (!sonioxKey) {
      reply.code(500);
      return { error: 'کلید Soniox روی سرور تنظیم نشده' };
    }
    const { session_id } = (request.body ?? {}) as { session_id?: string };
    if (!session_id) {
      reply.code(400);
      return { error: 'session_id الزامی است' };
    }
    const therapistId = (request as any).therapistId as string | undefined;
    if (!therapistId) {
      reply.code(401);
      return { error: 'وارد نشده‌اید' };
    }
    if (mintRateLimited(therapistId)) {
      reply.code(429);
      return { error: 'درخواست زیاد؛ کمی صبر کنید' };
    }
    const owned = await getOwnedSession(session_id, therapistId);
    if (!owned) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }
    if (owned.status === 'completed' || owned.status === 'canceled') {
      reply.code(400);
      return { error: 'جلسه پایان یافته است' };
    }
    try {
      console.log(`[stt-mint] therapist sessions mint: session=${session_id}`);
    } catch {}
    return {
      websocket_url: SONIOX_WS_URL,
      model: 'stt-rt-v5',
      api_key: sonioxKey,
      stt_defaults: {
        model: 'stt-rt-v5',
        audio_format: 'auto',
        language_hints: ['fa'],
        enable_language_identification: true,
        enable_speaker_diarization: true,
        enable_endpoint_detection: true,
      },
    };
  });
}
