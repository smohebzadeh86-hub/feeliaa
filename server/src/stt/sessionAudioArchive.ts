// آرشیوِ صدایِ جلسات — فقط برایِ بازبینیِ ادمین (پیداکردنِ ریشه‌ی باگ‌هایِ STT).
// جدا از data/batch-queue (که یه صفِ گذرا برایِ رونویسیه و بعدِ موفقیت پاک می‌شه):
// این یه آرشیوِ عمدیه، با نگه‌داریِ محدود (پیش‌فرض ۱۴ روز)، فقط پشتِ requireAdmin
// قابلِ‌شنیدنه — نه تراپیست، نه هیچ کاربرِ عادی.
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { query } from '../db/connection.js';

const ARCHIVE_DIR = path.join(process.cwd(), 'data', 'session-audio');
const RETENTION_MS = 14 * 24 * 60 * 60 * 1000; // ۱۴ روز — طبقِ تصمیمِ تیم

function ensureArchiveDir() {
  if (!existsSync(ARCHIVE_DIR)) mkdirSync(ARCHIVE_DIR, { recursive: true });
}

function sessionDir(sessionId: string): string {
  const safe = String(sessionId).replace(/[^a-zA-Z0-9-]/g, '');
  return path.join(ARCHIVE_DIR, safe);
}

export type AudioSource = 'durable' | 'offline';

// بعدِ رونویسیِ موفقِ یک سگمنت، به‌جایِ پاک‌کردنِ صدا، یه نسخه این‌جا نگه داشته می‌شه.
export async function archiveAudioForAdmin(
  sessionId: string,
  seq: number,
  buffer: Buffer,
  mime: string | null,
  source: AudioSource = 'durable'
): Promise<void> {
  ensureArchiveDir();
  const dir = sessionDir(sessionId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const ext = mime && mime.includes('ogg') ? 'ogg' : 'webm';
  const filePath = path.join(dir, `${String(seq).padStart(6, '0')}.${ext}`);
  writeFileSync(filePath, buffer);
  await query(
    `INSERT INTO session_audio (session_id, seq, path, bytes, mime, source)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (session_id, seq) DO UPDATE SET path = EXCLUDED.path, bytes = EXCLUDED.bytes, mime = EXCLUDED.mime`,
    [sessionId, seq, filePath, buffer.length, mime, source]
  );
}

export interface SessionAudioRow {
  id: string;
  session_id: string;
  seq: number;
  path: string;
  bytes: number;
  mime: string | null;
  source: string;
  created_at: string;
}

export async function listSessionAudio(sessionId: string): Promise<SessionAudioRow[]> {
  const r = await query(
    'SELECT * FROM session_audio WHERE session_id = $1 ORDER BY seq',
    [sessionId]
  );
  return r.rows;
}

export async function getSessionAudioRow(id: string): Promise<SessionAudioRow | null> {
  const r = await query('SELECT * FROM session_audio WHERE id = $1', [id]);
  return r.rows[0] || null;
}

// اجرا در startup + هر ۲۴ ساعت — نه فقط سرِ راه‌اندازی، چون سروری که هفته‌ها ری‌استارت
// نمی‌شه نباید صدایِ بیشتر از ۱۴ روز رو نگه داره.
export async function sweepOldSessionAudio(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - RETENTION_MS);
    const old = await query('SELECT id, path FROM session_audio WHERE created_at < $1', [cutoff]);
    for (const row of old.rows) {
      try { rmSync(row.path, { force: true }); } catch {}
    }
    if (old.rows.length) {
      await query('DELETE FROM session_audio WHERE created_at < $1', [cutoff]);
      console.log(`[session-audio] swept ${old.rows.length} expired file(s)`);
    }
    // پوشه‌هایِ خالیِ session (همه‌ی فایل‌هاشون پاک شده) رو هم جارو کن
    ensureArchiveDir();
    for (const name of readdirSync(ARCHIVE_DIR)) {
      const dir = path.join(ARCHIVE_DIR, name);
      try {
        if (readdirSync(dir).length === 0) rmSync(dir, { recursive: true, force: true });
      } catch {}
    }
  } catch (e) {
    console.log('[session-audio] sweep failed:', String(e).slice(0, 160));
  }
}
