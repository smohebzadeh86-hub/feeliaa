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

export async function resolveSession(token: string | undefined): Promise<string | null> {
  if (!token) return null;

  const result = await query(
    'SELECT therapist_id FROM auth_sessions WHERE token_hash = $1 AND expires_at > now()',
    [hashToken(token)]
  );

  return result.rows[0]?.therapist_id ?? null;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await query('DELETE FROM auth_sessions WHERE token_hash = $1', [hashToken(token)]);
}
