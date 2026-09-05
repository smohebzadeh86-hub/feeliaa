// ثبت‌نام / ورود / خروج تراپیست
import { FastifyInstance } from 'fastify';
import { query } from '../db/connection.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { createSession, destroySession } from '../auth/session.js';
import { SESSION_COOKIE, SESSION_COOKIE_MAX_AGE } from '../auth/guard.js';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicTherapist(row: { id: string; email: string; name: string | null; created_at: string }) {
  return { id: row.id, email: row.email, name: row.name, created_at: row.created_at };
}

// ⭐ هش ثابتِ ساختگی — وقتی ایمیل پیدا نشه هم scrypt اجرا میشه تا زمان پاسخ
// یکسان بمونه و نشه با اندازه‌گیری تاخیر فهمید ایمیلی ثبت‌شده یا نه.
const DUMMY_PASSWORD_HASH = hashPassword('a-constant-value-for-timing-safety');

export async function authRoutes(app: FastifyInstance) {

  // POST /api/auth/register — ثبت‌نام تراپیست جدید
  app.post('/api/auth/register', async (request, reply) => {
    const { email, password, name } = request.body as { email?: string; password?: string; name?: string };

    if (!email || !isValidEmail(email)) {
      reply.code(400);
      return { error: 'ایمیل معتبر نیست' };
    }
    if (!password || password.length < 8) {
      reply.code(400);
      return { error: 'رمز عبور باید حداقل ۸ کاراکتر باشد' };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const exists = await query('SELECT id FROM therapists WHERE email = $1', [normalizedEmail]);
    if (exists.rows.length > 0) {
      reply.code(409);
      return { error: 'این ایمیل قبلاً ثبت شده است' };
    }

    const result = await query(
      'INSERT INTO therapists (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
      [normalizedEmail, hashPassword(password), name?.trim() || null]
    );
    const therapist = result.rows[0];

    const token = await createSession(therapist.id);
    reply.setCookie(SESSION_COOKIE, token, {
      path: '/', httpOnly: true, sameSite: 'lax', maxAge: SESSION_COOKIE_MAX_AGE,
    });

    reply.code(201);
    return { therapist: publicTherapist(therapist) };
  });

  // POST /api/auth/login
  app.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body as { email?: string; password?: string };
    if (!email || !password) {
      reply.code(400);
      return { error: 'ایمیل و رمز عبور الزامی است' };
    }

    const result = await query('SELECT * FROM therapists WHERE email = $1', [email.trim().toLowerCase()]);
    const therapist = result.rows[0];

    // ⭐ حتی اگر تراپیست پیدا نشه، verifyPassword روی یک هش ساختگی اجرا میشه
    // تا زمان پاسخ لو ندهد که آیا این ایمیل اصلاً ثبت‌نام شده یا نه.
    const passwordOk = verifyPassword(password, therapist?.password_hash || DUMMY_PASSWORD_HASH);

    if (!therapist || !passwordOk) {
      reply.code(401);
      return { error: 'ایمیل یا رمز عبور اشتباه است' };
    }

    const token = await createSession(therapist.id);
    reply.setCookie(SESSION_COOKIE, token, {
      path: '/', httpOnly: true, sameSite: 'lax', maxAge: SESSION_COOKIE_MAX_AGE,
    });

    return { therapist: publicTherapist(therapist) };
  });

  // POST /api/auth/logout
  app.post('/api/auth/logout', async (request, reply) => {
    await destroySession(request.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  // GET /api/auth/me — وضعیت فعلی نشست
  app.get('/api/auth/me', async (request, reply) => {
    if (!request.therapistId) {
      reply.code(401);
      return { error: 'وارد نشده‌اید' };
    }

    const result = await query(
      'SELECT id, email, name, created_at FROM therapists WHERE id = $1',
      [request.therapistId]
    );
    if (result.rows.length === 0) {
      reply.code(401);
      return { error: 'وارد نشده‌اید' };
    }

    return { therapist: publicTherapist(result.rows[0]) };
  });
}
