// زیرساخت احراز هویت: کوکی نشست + decorator + preHandler محافظ
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import { resolveSession } from './session.js';

export const SESSION_COOKIE = 'feelia_session';
export const SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // ثانیه

declare module 'fastify' {
  interface FastifyRequest {
    therapistId: string | null;
    isAdmin: boolean;
  }
}

// باید قبل از ثبت روت‌هایی که به request.therapistId نیاز دارند صدا زده شود
export async function registerAuthContext(app: FastifyInstance) {
  await app.register(cookie);

  app.decorateRequest('therapistId', null);
  app.decorateRequest('isAdmin', false);

  app.addHook('onRequest', async (request) => {
    const token = request.cookies[SESSION_COOKIE];
    const resolved = await resolveSession(token);
    // ⭐ active=false یعنی همون لحظه، بدونِ نیاز به حذفِ خودِ نشست، دسترسی قطع می‌شه
    if (!resolved || !resolved.active) {
      request.therapistId = null;
      request.isAdmin = false;
      return;
    }
    request.therapistId = resolved.therapistId;
    request.isAdmin = resolved.isAdmin;
  });
}

// preHandler برای روت‌هایی که فقط تراپیستِ واردشده باید بهشان دسترسی داشته باشد
// ⭐ return reply بعد از send الزامی است: وگرنه Fastify هندلر را هم اجرا می‌کند
// (double-send) و ریجکتِ upgrade وب‌سوکت (/ws/t ،/ws/voice) هم تمیز نیست —
// در DevTools به‌صورت 401 مبهم روی همان endpoint دیده می‌شود.
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.therapistId) {
    return reply.code(401).send({ error: 'ابتدا وارد شوید', code: 'unauthorized' });
  }
}

// preHandler برای روت‌های ادمین — عمداً ۴۰۳ (نه ۴۰۴) تا ادمینِ واقعی بفهمه چرا رد شد
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.therapistId) {
    return reply.code(401).send({ error: 'ابتدا وارد شوید', code: 'unauthorized' });
  }
  if (!request.isAdmin) {
    return reply.code(403).send({ error: 'دسترسی ادمین لازم است', code: 'forbidden' });
  }
}
