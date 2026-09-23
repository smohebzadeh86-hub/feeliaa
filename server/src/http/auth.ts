// ثبت‌نام / ورود / خروج تراپیست — شناسه‌ی اصلی: شماره‌ی موبایل (ایمیل اختیاری، برای آینده)
import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { query } from '../db/connection.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { createSession, destroySession } from '../auth/session.js';
import { SESSION_COOKIE, SESSION_COOKIE_MAX_AGE } from '../auth/guard.js';
import { logEvent } from '../obs/eventLog.js';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// شماره‌ی موبایلِ ایران: ورودی رو نرمال می‌کنه به فرمتِ ۰۹XXXXXXXXX
// قبول می‌کنه: 09123456789 / +989123456789 / 00989123456789 / با فاصله یا خط‌تیره
// ⭐ باگِ واقعی (UI-03): ارقامِ فارسی/عربی (۰۹۱۲…, ٠٩١٢…) رد می‌شدن — دقیقاً همون
// چیزی که placeholderِ فیلدِ موبایل نشون می‌ده. قبل از حذفِ غیررقمی به لاتین تبدیل می‌شن.
function toLatinDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776)) // فارسی: U+06F0..U+06F9
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632)); // عربی: U+0660..U+0669
}
function normalizePhone(raw: string): string | null {
  const digits = toLatinDigits(raw).replace(/[^\d+]/g, '');
  let d = digits;
  if (d.startsWith('+98')) d = '0' + d.slice(3);
  else if (d.startsWith('0098')) d = '0' + d.slice(4);
  else if (d.startsWith('98') && d.length === 12) d = '0' + d.slice(2);
  if (!/^09\d{9}$/.test(d)) return null;
  return d;
}

function publicTherapist(row: { id: string; phone: string; email: string | null; name: string | null; specialty: string | null; is_admin: boolean; created_at: string; case_file_auto_generate: boolean | null; case_file_enabled: boolean }) {
  return { id: row.id, phone: row.phone, email: row.email, name: row.name, specialty: row.specialty, is_admin: row.is_admin, created_at: row.created_at, case_file_auto_generate: row.case_file_auto_generate, case_file_enabled: row.case_file_enabled };
}

// ⭐ هش ثابتِ ساختگی — وقتی شماره پیدا نشه هم scrypt اجرا میشه تا زمان پاسخ
// یکسان بمونه و نشه با اندازه‌گیری تاخیر فهمید شماره‌ای اصلاً ثبت‌نام شده یا نه.
const DUMMY_PASSWORD_HASH = hashPassword('a-constant-value-for-timing-safety');

// ⭐ بوت‌استرپِ اولین ادمین: هر شماره‌ای که با ADMIN_PHONE توی .env یکی باشه،
// موقعِ ثبت‌نام/ورود خودکار is_admin=true می‌گیره. بدونِ این، هیچ راهِ UI‌ای
// برای ساختنِ اولین ادمین وجود نداره (چون خودِ پنلِ ادمین به یه ادمین نیاز داره).
async function ensureAdminFlag(therapistId: string, normalizedPhone: string): Promise<void> {
  const adminPhoneRaw = process.env.ADMIN_PHONE?.trim();
  if (!adminPhoneRaw) return;
  const adminPhone = normalizePhone(adminPhoneRaw);
  if (!adminPhone || adminPhone !== normalizedPhone) return;
  await query('UPDATE therapists SET is_admin = true WHERE id = ? AND is_admin = false', [therapistId]);
}

export async function authRoutes(app: FastifyInstance) {

  // POST /api/auth/register — ثبت‌نام تراپیست جدید
  app.post('/api/auth/register', async (request, reply) => {
    const { phone, email, password, name, specialty } = request.body as { phone?: string; email?: string; password?: string; name?: string; specialty?: string };

    if (!phone) {
      reply.code(400);
      return { error: 'شماره موبایل الزامی است' };
    }
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      reply.code(400);
      return { error: 'شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)' };
    }
    if (email && !isValidEmail(email)) {
      reply.code(400);
      return { error: 'ایمیل معتبر نیست' };
    }
    if (!password || password.length < 8) {
      reply.code(400);
      return { error: 'رمز عبور باید حداقل ۸ کاراکتر باشد' };
    }
    // ⭐ فیکسِ باگِ واقعی (تصمیمِ مالک D3، 2026-09-15): نام/تخصص فقط برایِ ثبت‌نامِ
    // جدید الزامی است؛ حساب‌های قدیمی (که ممکن است null داشته باشند) دست نمی‌خورند —
    // چک فقط اینجاست، نه در login/me.
    const trimmedName = name?.trim() || '';
    const trimmedSpecialty = specialty?.trim() || '';
    if (!trimmedName || trimmedName.length > 100) {
      reply.code(400);
      return { error: 'نام الزامی است' };
    }
    if (!trimmedSpecialty || trimmedSpecialty.length > 100) {
      reply.code(400);
      return { error: 'تخصص الزامی است' };
    }

    const exists = await query('SELECT id FROM therapists WHERE phone = ?', [normalizedPhone]);
    if (exists.rows.length > 0) {
      reply.code(409);
      return { error: 'این شماره قبلاً ثبت شده است' };
    }

    const normalizedEmail = email ? email.trim().toLowerCase() : null;
    const newId = randomUUID();
    await query(
      'INSERT INTO therapists (id, phone, email, password_hash, name, specialty) VALUES (?, ?, ?, ?, ?, ?)',
      [newId, normalizedPhone, normalizedEmail, hashPassword(password), trimmedName, trimmedSpecialty]
    );
    const inserted = await query(
      'SELECT id, phone, email, name, specialty, is_admin, created_at, case_file_auto_generate, case_file_enabled FROM therapists WHERE id = ?',
      [newId]
    );
    const therapist = inserted.rows[0];
    await ensureAdminFlag(therapist.id, normalizedPhone);
    therapist.is_admin = (await query('SELECT is_admin FROM therapists WHERE id = ?', [therapist.id])).rows[0].is_admin;

    const token = await createSession(therapist.id);
    reply.setCookie(SESSION_COOKIE, token, {
      path: '/', httpOnly: true, sameSite: 'lax', maxAge: SESSION_COOKIE_MAX_AGE,
    });

    reply.code(201);
    return { therapist: publicTherapist(therapist) };
  });

  // POST /api/auth/login
  app.post('/api/auth/login', async (request, reply) => {
    const { phone, password } = request.body as { phone?: string; password?: string };
    if (!phone || !password) {
      reply.code(400);
      return { error: 'شماره موبایل و رمز عبور الزامی است' };
    }
    const normalizedPhone = normalizePhone(phone);

    const result = normalizedPhone
      ? await query('SELECT * FROM therapists WHERE phone = ?', [normalizedPhone])
      : { rows: [] as any[] };
    const therapist = result.rows[0];

    // ⭐ حتی اگر تراپیست پیدا نشه، verifyPassword روی یک هش ساختگی اجرا میشه
    // تا زمان پاسخ لو ندهد که آیا این شماره اصلاً ثبت‌نام شده یا نه.
    const passwordOk = verifyPassword(password, therapist?.password_hash || DUMMY_PASSWORD_HASH);

    if (!therapist || !passwordOk) {
      // ⭐ هرگز شماره/شناسه در detail نمی‌رود (LAW-001 — شماره‌ی موبایل PII است، نه
      // متادیتایِ امن)؛ فقط اینکه یک تلاشِ ورودِ ناموفق رخ داد.
      logEvent({ event: 'auth.login_failed', severity: 'warn' });
      reply.code(401);
      return { error: 'شماره موبایل یا رمز عبور اشتباه است' };
    }
    if (!therapist.active) {
      logEvent({ event: 'auth.login_failed', therapistId: therapist.id, severity: 'warn', code: 'inactive' });
      reply.code(403);
      return { error: 'این حساب غیرفعال شده است' };
    }

    await ensureAdminFlag(therapist.id, normalizedPhone!);
    therapist.is_admin = (await query('SELECT is_admin FROM therapists WHERE id = ?', [therapist.id])).rows[0].is_admin;

    const token = await createSession(therapist.id);
    reply.setCookie(SESSION_COOKIE, token, {
      path: '/', httpOnly: true, sameSite: 'lax', maxAge: SESSION_COOKIE_MAX_AGE,
    });
    logEvent({ event: 'auth.login_ok', therapistId: therapist.id });

    return { therapist: publicTherapist(therapist) };
  });

  // POST /api/auth/logout
  app.post('/api/auth/logout', async (request, reply) => {
    logEvent({ event: 'auth.logout', therapistId: request.therapistId });
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
      'SELECT id, phone, email, name, specialty, is_admin, created_at, case_file_auto_generate, case_file_enabled FROM therapists WHERE id = ?',
      [request.therapistId]
    );
    if (result.rows.length === 0) {
      reply.code(401);
      return { error: 'وارد نشده‌اید' };
    }

    return { therapist: publicTherapist(result.rows[0]) };
  });

  // PATCH /api/auth/case-file-auto-generate — تنظیمِ خودکارسازیِ تولیدِ پرونده (همیشه قابلِ‌تغییر،
  // نه یک تصمیمِ یک‌طرفه — بخشِ ۱ِ پلنِ auto-trigger)
  app.patch('/api/auth/case-file-auto-generate', async (request, reply) => {
    if (!request.therapistId) {
      reply.code(401);
      return { error: 'وارد نشده‌اید' };
    }
    if (!request.caseFileEnabled) {
      reply.code(403);
      return { error: 'این قابلیت برایِ حسابِ شما فعال نیست', code: 'forbidden' };
    }
    const { enabled } = (request.body as { enabled?: unknown }) || {};
    if (typeof enabled !== 'boolean') {
      reply.code(400);
      return { error: 'enabled باید boolean باشد' };
    }
    await query('UPDATE therapists SET case_file_auto_generate = ? WHERE id = ?', [enabled, request.therapistId]);
    return { case_file_auto_generate: enabled };
  });
}
