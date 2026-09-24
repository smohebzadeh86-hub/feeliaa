// مسیرهای STT — معماری production:
//   Realtime اصلی: Browser → Soniox (با Temporary API Key کوتاه‌عمر).
//   Backend: auth + صدور temp-key + diagnostics. کلید اصلی (SONIOX_API_KEY)
//   هرگز به browser داده/لاگ نمی‌شود — فقط طول آن در لاگ می‌آید.
//   مسیر قدیمی proxy (/ws/t) دست‌نخورده به‌عنوان legacy باقی است؛(sprite در ws/).
import { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/guard.js';
import { getOwnedSession } from '../db/ownership.js';
import { logEvent } from '../obs/eventLog.js';
import {
  SONIOX_WS_URL,
  TEMP_KEY_EXPIRES_IN_SECONDS,
  TEMP_KEY_MAX_SESSION_SECONDS,
  TempKeyError,
  mintTemporaryKey,
} from '../stt/tempkey.js';

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

// enable_endpoint_detection:true — برگردوندم به مقدارِ قبلی: خاموش‌کردنش (طبقِ
// توصیه‌ی docsِ Soniox برایِ دقتِ diarization) در عمل با صدایِ واقعی تاخیرِ محسوس و
// غیرقابل‌قبولی توی finalize‌شدنِ متنِ زنده ایجاد کرد — سرعتِ کپشنِ زنده اولویتِ بالاتریه.
const STT_DEFAULTS = {
  model: 'stt-rt-v5',
  audio_format: 'auto',
  language_hints: ['fa'],
  enable_language_identification: true,
  enable_speaker_diarization: true,
  enable_endpoint_detection: true,
};

export async function sttRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /api/stt/check — diagnostic مسیر واقعی production:
  //   mint temp-key (control-plane لازم برای Browser→Soniox) — ملاک ok
  // ⭐ (2026-09-24، تصمیمِ مالک — گزینه‌ی B) probeِ legacyِ «اتصالِ آزمایشیِ VPS→Soniox» حذف شد: نتیجه‌اش
  // (`proxy`) هیچ‌جا خوانده نمی‌شد، به ازایِ هر preflight یک WSِ master-key باز می‌کرد (LAW-015)، ~۱ث (تا ۸ث)
  // به check اضافه می‌کرد، و چون بدونِ صدا finalize می‌فرستاد، Soniox هر بار «No audio received» (400) می‌داد که
  // در لاگ شبیهِ خطایِ رونویسی بود (verification/2026-09-24-stt-check-no-audio-log.md).
  // ⚠️ این check نباید شروع session را بلاک کند (فرانت جدید آن را gate نمی‌کند)؛
  // چون failure realtime باید داخل lifecycle با reconnect/fallback مدیریت شود.
  // ⭐ code ماشینی برای افتراق علت:
  // 'no-key' | 'mint-transport' | 'mint-timeout' | 'mint-rejected' (مسیر اصلی)
  // ⚠️ مقدار هیچ کلیدی (اصلی یا موقت) هرگز لاگ/برگردانده نمی‌شود.
  app.get('/api/stt/check', async () => {
    const masterKey = process.env.SONIOX_API_KEY;
    if (!masterKey) {
      console.log('[stt-check] fail code=no-key (SONIOX_API_KEY missing)');
      return { ok: false, code: 'no-key', error: 'کلید Soniox روی سرور تنظیم نشده' };
    }

    // mint آزمایشی — با client_reference_id مشخصِ diagnostic (در usage logs قابل ردیابی)
    let mintOk = false;
    let mintCode = 'mint-transport';
    let mintError = 'ارتباط با سرویس Soniox برای صدور credential برقرار نشد';
    try {
      await mintTemporaryKey({
        clientReferenceId: 'feelia:healthcheck',
        singleUse: true,
        expiresInSeconds: 60,
      });
      mintOk = true;
      mintCode = 'mint-ok';
      mintError = '';
    } catch (err) {
      if (err instanceof TempKeyError) {
        mintCode = err.code;
        mintError = err.message;
      }
      console.log(
        `[stt-check] mint code=${mintCode} key_len=${masterKey.length} proxy=${process.env.PROXY_URL ? 'set' : 'unset'}`
      );
    }

    if (mintOk) {
      return { ok: true, code: 'mint-ok', websocket_url: SONIOX_WS_URL };
    }
    return { ok: false, code: mintCode, error: mintError };
  });

  // POST /api/stt/realtime-session — صدور Temporary API Key برای اتصال مستقیم مرورگر.
  // body: { session_id: string } — session باید مال همین تراپیست و ناتمام باشد.
  // خروجی: { websocket_url, model, api_key: <TEMP کوتاه‌عمرِ single-use>, ... }
  // ⚠️ کلید اصلی هرگز برنمی‌گردد. هر connection (شروع/reconnect) باید mint تازه بگیرد.
  app.post('/api/stt/realtime-session', async (request, reply) => {
    const masterKey = process.env.SONIOX_API_KEY;
    if (!masterKey) {
      reply.code(500);
      return { error: 'کلید Soniox روی سرور تنظیم نشده', code: 'no-key' };
    }
    const { session_id, purpose: rawPurpose } = (request.body ?? {}) as {
      session_id?: string;
      purpose?: string;
    };
    const purpose = rawPurpose === 'note' ? 'note' : 'transcript';
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
    // ⭐ فیکسِ باگِ واقعی: این گارد باعث می‌شد mintِ realtime برایِ یادداشتِ صوتی
    // (purpose=note) همیشه رد بشه — چون تنها نقطه‌ی UI که یادداشتِ صوتی می‌سازد
    // (دکمه‌ی Wrapup) همیشه *بعد* از این اجرا می‌شود که endNewRTSession() همین‌جا
    // status=completed فرستاده. یعنی یادداشتِ صوتی هیچ‌وقت credential نمی‌گرفت و
    // صددرصدِ مواقع fail-open به durable-only می‌رفت. purpose=transcript (پیش‌فرض،
    // جلسه‌ی زنده‌ی اصلی) همچنان درست مسدود می‌ماند — نباید رویِ جلسه‌ی تمام‌شده
    // realtimeِ transcript دوباره باز بشه.
    if (purpose === 'transcript' && (owned.status === 'completed' || owned.status === 'canceled')) {
      reply.code(400);
      return { error: 'جلسه پایان یافته است' };
    }
    try {
      const minted = await mintTemporaryKey({
        clientReferenceId: `feelia:${therapistId}:${session_id}:${purpose}`,
        singleUse: true,
        expiresInSeconds: TEMP_KEY_EXPIRES_IN_SECONDS,
        maxSessionDurationSeconds: TEMP_KEY_MAX_SESSION_SECONDS,
      });
      // لاگ ممیزی بدون هیچ کلیدی: چه کسی، برای کدام session، کی
      console.log(
        `[stt-mint] temp-key issued therapist=${therapistId} session=${session_id} expires_in=${TEMP_KEY_EXPIRES_IN_SECONDS}s single_use=true`
      );
      logEvent({ event: 'stt.mint_ok', sessionId: session_id, therapistId, detail: { purpose } });
      return {
        websocket_url: SONIOX_WS_URL,
        model: 'stt-rt-v5',
        api_key: minted.api_key,
        expires_in_seconds: TEMP_KEY_EXPIRES_IN_SECONDS,
        single_use: true,
        credential_scope: 'transcribe_websocket',
        expires_at: minted.expires_at,
        stt_defaults: STT_DEFAULTS,
      };
    } catch (err) {
      const code = err instanceof TempKeyError ? err.code : 'mint-transport';
      const status = err instanceof TempKeyError ? err.status : 503;
      const message = err instanceof Error ? err.message : 'صدور credential ناموفق بود';
      console.log(
        `[stt-mint] fail code=${code} therapist=${therapistId} session=${session_id} key_len=${masterKey.length}`
      );
      logEvent({ event: 'stt.mint_failed', sessionId: session_id, therapistId, severity: 'warn', code, detail: { purpose } });
      reply.code(status);
      // 503 یعنی: session می‌تواند ساخته/ادامه یابد ولی realtime الان ممکن نیست —
      // فرانت باید durable ضبط کند و به صف batch برود، نه اینکه session را بلاک کند.
      return { error: message, code };
    }
  });
}
