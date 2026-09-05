// زیرساخت احراز هویت: کوکی نشست + decorator + preHandler محافظ
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import { resolveSession } from './session.js';

export const SESSION_COOKIE = 'feelia_session';
export const SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // ثانیه

declare module 'fastify' {
  interface FastifyRequest {
    therapistId: string | null;
  }
}

// باید قبل از ثبت روت‌هایی که به request.therapistId نیاز دارند صدا زده شود
export async function registerAuthContext(app: FastifyInstance) {
  await app.register(cookie);

  app.decorateRequest('therapistId', null);

  app.addHook('onRequest', async (request) => {
    const token = request.cookies[SESSION_COOKIE];
    request.therapistId = await resolveSession(token);
  });
}

// preHandler برای روت‌هایی که فقط تراپیستِ واردشده باید بهشان دسترسی داشته باشد
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.therapistId) {
    reply.code(401).send({ error: 'ابتدا وارد شوید' });
  }
}
