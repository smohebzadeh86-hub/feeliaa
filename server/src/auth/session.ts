// نشست‌های احراز هویت — توکن تصادفی، فقط هش آن در دیتابیس ذخیره می‌شود
import { createHash, randomBytes } from 'node:crypto';
import { query } from '../db/connection.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // ۳۰ روز

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(therapistId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await query(
    'INSERT INTO auth_sessions (token_hash, therapist_id, expires_at) VALUES ($1, $2, $3)',
    [hashToken(token), therapistId, expiresAt]
  );

  return token;
}

export interface ResolvedSession {
  therapistId: string;
  isAdmin: boolean;
  active: boolean;
}

// ⭐ یک کوئری (نه دو): وضعیتِ نشست + is_admin/active همین‌جا برمی‌گرده تا هر
// درخواست بلافاصله بعدِ غیرفعال‌شدنِ حساب رد بشه (نه فقط دفعه‌ی بعدیِ لاگین).
export async function resolveSession(token: string | undefined): Promise<ResolvedSession | null> {
  if (!token) return null;

  const result = await query(
    `SELECT t.id as therapist_id, t.is_admin, t.active
     FROM auth_sessions s
     JOIN therapists t ON t.id = s.therapist_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)]
  );

  const row = result.rows[0];
  if (!row) return null;
  return { therapistId: row.therapist_id, isAdmin: row.is_admin, active: row.active };
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await query('DELETE FROM auth_sessions WHERE token_hash = $1', [hashToken(token)]);
}
