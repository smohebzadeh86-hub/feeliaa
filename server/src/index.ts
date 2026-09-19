// Feelia Server — Entry Point
import 'dotenv/config';
import Fastify from 'fastify';
import { fastifyStatic } from '@fastify/static';
import multipart from '@fastify/multipart';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { testConnection } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { registerAuthContext } from './auth/guard.js';
import { authRoutes } from './http/auth.js';
import { adminRoutes } from './http/admin.js';
import { clientRoutes } from './http/clients.js';
import { sessionRoutes } from './http/sessions.js';
import { sttRoutes } from './http/stt.js';
import { clientConfigRoutes } from './http/clientConfig.js';
import { transcriptionRoutes } from './ws/transcription.js';
import { caseFileRoutes } from './features/case-file/api/caseFile.routes.js';
import { sweepOldBatchFiles, retryQueuedBatches } from './stt/batchqueue.js';
import { sweepOldSessionAudio } from './stt/sessionAudioArchive.js';
import { sweepOldResolveJobs } from './stt/speakerResolve.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: true });

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
await app.register(authRoutes);
await app.register(adminRoutes);
await app.register(clientRoutes);
await app.register(sessionRoutes);
await app.register(sttRoutes);
await app.register(clientConfigRoutes);
await app.register(transcriptionRoutes);
await app.register(caseFileRoutes);

// Serve static (فرانت)
const publicDir = path.join(__dirname, '..', '..', 'public');
try {
  await app.register(fastifyStatic, { root: publicDir });
} catch (e) {
  // public/ وجود نداره
}

const PORT = parseInt(process.env.PORT || '3000', 10);

const start = async () => {
  try {
    await runMigrations();
    // پاک‌سازی فایل‌های صوت batch قدیمی (حریم خصوصی/دیسک) — قبل از حذف، تلاش می‌کنه آرشیو کنه
    try { await sweepOldBatchFiles(); } catch {}
    // آرشیوِ صدایِ ادمین: هم سرِ startup هم هر ۲۴ ساعت — سروری که هفته‌ها ری‌استارت
    // نمی‌شه هم نباید صدایِ بیشتر از سقفِ نگه‌داری رو نگه داره.
    try { await sweepOldSessionAudio(); } catch {}
    setInterval(() => { sweepOldSessionAudio().catch(() => {}); }, 24 * 60 * 60 * 1000);
    setInterval(() => { try { sweepOldResolveJobs(); } catch {} }, 60 * 60 * 1000);
    // ⭐ workerِ دوره‌ایِ retry برایِ صفِ batch (فایندینگِ audit صدا): شکستِ Soniox/کلید
    // وقتِ enqueue قبلاً بدونِ رفرشِ صفحه یا ری‌استارتِ سرور هیچ‌وقت دوباره امتحان نمی‌شد.
    try { await retryQueuedBatches(); } catch {}
    setInterval(() => { retryQueuedBatches().catch(() => {}); }, 5 * 60 * 1000);
    console.log('🌿 Feelia server starting...');
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🌿 Feelia server running on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();