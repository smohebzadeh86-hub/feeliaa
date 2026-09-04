// Feelia Server — Entry Point
import Fastify from 'fastify';
import { fastifyStatic } from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { testConnection } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { clientRoutes } from './http/clients.js';
import { sessionRoutes } from './http/sessions.js';

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
await app.register(clientRoutes);
await app.register(sessionRoutes);

// Serve static (فرانت بعداً)
const publicDir = path.join(__dirname, '..', '..', 'public');
try {
  await app.register(fastifyStatic, { root: publicDir });
} catch (e) {
  // public/ هنوز وجود نداره — فعلاً اوکیه
}

const PORT = parseInt(process.env.PORT || '3000', 10);

const start = async () => {
  try {
    await runMigrations();
    console.log('🌿 Feelia server starting...');
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🌿 Feelia server running on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();