// Feelia Server — Entry Point
// ترتیب: dotenv → ساختِ اپ (app.ts) → migrations → jobهایِ پس‌زمینه (jobs/backgroundJobs.ts) → listen.
import 'dotenv/config';
import { runMigrations } from './db/migrate.js';
import { flushObsQueue } from './obs/eventLog.js';
import { buildApp } from './app.js';
import { startBackgroundJobs } from './jobs/backgroundJobs.js';

const app = await buildApp();

process.on('SIGTERM', () => {
  flushObsQueue().finally(() => process.exit(0));
});
// (A6، 2026-09-26) Ctrl+C / pm2 stop با SIGINT هم باید صفِ obs را خالی کند — قبلاً رویدادهایِ در صف گم می‌شدند.
process.on('SIGINT', () => {
  flushObsQueue().finally(() => process.exit(0));
});

const PORT = parseInt(process.env.PORT || '3000', 10);

const start = async () => {
  try {
    await runMigrations();
    await startBackgroundJobs();
    console.log('🌿 Feelia server starting...');
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🌿 Feelia server running on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
