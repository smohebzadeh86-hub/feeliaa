// ساختِ اپِ Fastify — همه‌ی pluginها و routeها، بدونِ listen و بدونِ jobهایِ پس‌زمینه.
// index.ts (سرورِ واقعی) و ابزارهایِ تست (route snapshot، API contract harness) هر دو از همین استفاده می‌کنند.
import Fastify, { type FastifyInstance, type RouteOptions } from 'fastify';
import { fastifyStatic } from '@fastify/static';
import multipart from '@fastify/multipart';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { testConnection } from './db/connection.js';
import { registerAuthContext } from './auth/guard.js';
import { authRoutes } from './features/auth/auth.routes.js';
import { adminRoutes } from './features/admin/admin.routes.js';
import { clientRoutes } from './features/clients/clients.routes.js';
import { sessionRoutes } from './features/sessions/sessions.routes.js';
import { sttRoutes } from './features/transcription/stt.routes.js';
import { clientConfigRoutes } from './features/client-config/clientConfig.routes.js';
import { transcriptionRoutes } from './features/legacy-ws/transcription.routes.js';
import { caseFileRoutes } from './features/case-file/api/caseFile.routes.js';
import { treatmentUnitRoutes, treatmentUnits } from './features/treatment-unit/index.js';
import { obsRoutes } from './obs/obs.routes.js';
import { registerObsHooks } from './obs/httpHook.js';
import { flushObsQueue } from './obs/eventLog.js';
import { audioUploadRoutes, registerUploadChunkParser } from './features/audio-upload/uploads.routes.js';
import { enqueueRecordMetrics } from './features/audio-upload/index.js';
import { notificationRoutes } from './features/notifications/notifications.routes.js';
import { finalTranscriptRoutes, finalTranscriptSpeakerRoles } from './features/final-transcript/index.js';
import { sessionRecordRoutes, setSpeakerSuggestionSources, setRecordSavedListener } from './features/session-record/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface BuildAppOptions {
  // فقط برایِ ابزارِ route snapshot — قبل از ثبتِ هر routeی نصب می‌شود.
  onRoute?: (opts: RouteOptions) => void;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  // فیکسِ نشتِ حریمِ‌خصوصی (فازِ ۱ِ رصد/حسابرسی، 2026-09-22): پیش‌فرضِ logger:true
  // هر کوکی (شاملِ feelia_session) و هدرِ Authorization را در stdout چاپ می‌کرد.
  // disableRequestLogging:true چون log-per-request حالا کارِ registerObsHooks
  // (server/src/obs/httpHook.ts) است، نه لاگرِ خامِ Fastify.
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      redact: {
        paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
        remove: true,
      },
    },
    disableRequestLogging: true,
  });
  if (opts.onRoute) app.addHook('onRoute', opts.onRoute);

  // Health check
  app.get('/api/health', async () => {
    const dbOk = await testConnection();
    return {
      status: dbOk ? 'ok' : 'degraded',
      name: 'feelia',
      version: '0.1.0',
      database: dbOk ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  });

  // API Routes
  // ⭐ سقفِ پیش‌فرضِ ۱MiB برایِ سگمنتِ صوتی کم بود (فایندینگِ audit صدا/۲۰۲۶-۰۹-۱۶):
  // سگمنتِ ۱۵ثانیه‌ای با DURABLE_BITRATE=24kbps ~۴۵KB است، ولی نرخِ واقعیِ مرورگر
  // می‌تونه بالاتر بره، و یادداشتِ صوتیِ legacy می‌تونه طولانی‌تر باشه. ۱۰MB زیرِ
  // MAX_AUDIO_BYTES موجودِ batchqueue.ts (۵۰MB) و کاملاً کافیه.
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await registerAuthContext(app);
  // بلافاصله بعدِ registerAuthContext — طبقِ پلن، تا request.therapistId برایِ هرهوک
  // در دسترس باشد. باید قبل از ثبتِ روت‌ها بیاید تا onRequest/onResponse همه‌ی مسیرها را بپوشاند.
  registerObsHooks(app);
  await app.register(authRoutes);
  await app.register(adminRoutes);
  await app.register(clientRoutes);
  await app.register(sessionRoutes);
  await app.register(sttRoutes);
  await app.register(clientConfigRoutes);
  await app.register(transcriptionRoutes);
  await app.register(caseFileRoutes);
  await app.register(treatmentUnitRoutes);
  await app.register(obsRoutes);
  // آپلودِ صدا + اعلان‌ها در یک scopeِ encapsulated با parserِ application/octet-stream (تکه‌هایِ خامِ آپلود).
  // routeهایِ اعلان تا پیش از جداشدن (refactorِ ماژولار) داخلِ pluginِ آپلود بودند و این parser را داشتند؛ برایِ
  // حفظِ دقیقِ قراردادِ HTTP در همین scope می‌مانند (FINDING در PROJECT_STATUS: octet-stream رویِ
  // POST /api/notifications/read ⇒ 200ِ بی‌اثر، نه 415).
  await app.register(async (uploadScope) => {
    registerUploadChunkParser(uploadScope);
    await uploadScope.register(audioUploadRoutes);
    await uploadScope.register(notificationRoutes);
  });
  await app.register(finalTranscriptRoutes);
  // پیشنهادِ نقشِ گوینده (core-data-plan قدمِ ۳): حاضرینِ واحدِ درمان + نقش‌هایِ «متنِ نهایی». تزریق از ریشه‌ی ترکیب (بدونِ چرخه).
  setSpeakerSuggestionSources({
    roster: async (sid) => (await treatmentUnits.sessionSpeakerRoster(sid))?.speakers ?? null,
    finalRoles: finalTranscriptSpeakerRoles,
  });
  // سنجه‌هایِ کیفیت برایِ هر گذرِ تازه‌ی رکورد (core-data-plan قدمِ ۴) — صفِ سریالِ fail-open در audio-upload.
  setRecordSavedListener(enqueueRecordMetrics);
  await app.register(sessionRecordRoutes);

  // Serve static (فرانت)
  const publicDir = path.join(__dirname, '..', '..', 'public');
  try {
    // ⭐ باگِ واقعیِ deploy (۲۰۲۶-۰۹-۲۳): پیش‌فرضِ fastify-static یعنی «public, max-age=0» — مرورگر
    // اجازه داشت feelia-rt.jsِ کش‌شده را بدونِ پرسیدن از سرور دوباره اجرا کند؛ تبِ مالک بعد از دو
    // deployِ رفعِ موتورِ رونویسی هنوز نسخه‌ی قدیمی را اجرا می‌کرد (در لاگِ nginx هیچ درخواستی برایِ
    // /feelia-rt.js نبود). no-cache = همیشه revalidate (ETag/Last-Modified → ۳۰۴ِ ارزان).
    await app.register(fastifyStatic, {
      root: publicDir,
      cacheControl: false,
      setHeaders: (reply) => { reply.header('Cache-Control', 'no-cache'); },
    });
  } catch (e) {
    // public/ وجود نداره
  }

  // خاموشیِ تمیز: تلاشِ نهایی برایِ خالی‌کردنِ صفِ obs قبل از خروج (data/logs/obs.jsonl
  // همیشه از قبل نوشته شده؛ این فقط برایِ ردیف‌های هنوز-در-صفِ DB است).
  app.addHook('onClose', async () => {
    await flushObsQueue();
  });

  return app;
}
