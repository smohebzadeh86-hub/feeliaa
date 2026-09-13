// پیکربندیِ عمومیِ سمتِ کلاینت — فقط مقادیرِ غیرمحرمانه (الان فقط Microsoft Clarity).
// Project IDِ Clarity رازی نیست (در خودِ تگِ اسکریپت دیده می‌شود)، ولی عمداً hard-code
// نشده تا dev/prod فقط با .env از هم جدا شوند: CLARITY_PROJECT_ID خالی = Clarity خاموش.
// ⭐ برای ادمین همیشه null — پنلِ ادمین تلفن/ایمیلِ همه‌ی تراپیست‌ها و صدایِ جلسات را دارد.
// مستندات: docs/analytics-clarity.md
import { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/guard.js';

// شناسه‌ی پروژه‌های Clarity حروف کوچک + رقم است؛ هر چیزِ دیگری (فاصله، URL، کوتیشن)
// یعنی .env اشتباه است و نباید به src اسکریپت در مرورگر برسد.
const CLARITY_PROJECT_ID_RE = /^[a-z0-9]{6,20}$/;
let invalidIdWarned = false;

function clarityProjectId(): string | null {
  const raw = process.env.CLARITY_PROJECT_ID?.trim();
  if (!raw) return null;
  if (!CLARITY_PROJECT_ID_RE.test(raw)) {
    if (!invalidIdWarned) {
      console.warn('[client-config] CLARITY_PROJECT_ID has invalid format — Clarity disabled');
      invalidIdWarned = true;
    }
    return null;
  }
  return raw;
}

export async function clientConfigRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /api/client-config
  app.get('/api/client-config', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const projectId = request.isAdmin ? null : clarityProjectId();
    return { clarity: projectId ? { projectId } : null };
  });
}
