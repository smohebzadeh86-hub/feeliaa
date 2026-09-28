// SQLِ جدولِ therapists برایِ ثبت‌نام/ورود/نشست — فقط رشته‌هایِ SQLِ قبلیِ auth.routes، بدونِ تغییر.
import { query } from '../../db/connection.js';

export async function findTherapistIdByPhone(phone: string): Promise<{ id: string } | undefined> {
  const r = await query('SELECT id FROM therapists WHERE phone = ?', [phone]);
  return r.rows[0];
}

export async function insertTherapist(t: {
  id: string; phone: string; email: string | null; passwordHash: string; name: string; specialty: string;
}): Promise<void> {
  await query(
    'INSERT INTO therapists (id, phone, email, password_hash, name, specialty) VALUES (?, ?, ?, ?, ?, ?)',
    [t.id, t.phone, t.email, t.passwordHash, t.name, t.specialty]
  );
}

// ستون‌هایِ عمومیِ پروفایل (publicTherapist)
export async function getTherapistProfile(id: string): Promise<any | undefined> {
  const r = await query(
    'SELECT id, phone, email, name, specialty, is_admin, created_at, case_file_auto_generate, case_file_enabled, final_transcript_enabled FROM therapists WHERE id = ?',
    [id]
  );
  return r.rows[0];
}

export async function getIsAdmin(id: string): Promise<boolean> {
  return (await query('SELECT is_admin FROM therapists WHERE id = ?', [id])).rows[0].is_admin;
}

// true اگر همین فراخوانی نقشِ ادمین را داد (قبلاً ادمین نبود)
export async function grantAdminFlag(id: string): Promise<boolean> {
  const r = await query('UPDATE therapists SET is_admin = true WHERE id = ? AND is_admin = false', [id]);
  return r.rowCount === 1;
}

export async function findTherapistByPhone(phone: string): Promise<any | undefined> {
  const r = await query('SELECT * FROM therapists WHERE phone = ?', [phone]);
  return r.rows[0];
}

export async function setCaseFileAutoGenerate(id: string, enabled: boolean): Promise<void> {
  await query('UPDATE therapists SET case_file_auto_generate = ? WHERE id = ?', [enabled, id]);
}
