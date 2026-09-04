// Feelia Server — Entry Point
import Fastify from 'fastify';
import { fastifyStatic } from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: true });

// Health check
app.get('/api/health', async () => {
  return { status: 'ok', name: 'feelia', version: '0.1.0' };
});

// Serve static files (frontend will go here later)
const publicDir = path.join(__dirname, '..', '..', 'public');
try {
  await app.register(fastifyStatic, { root: publicDir });
} catch (e) {
  // public/ doesn't exist yet — fine for now
}

const PORT = parseInt(process.env.PORT || '3000', 10);

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🌿 Feelia server running on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();