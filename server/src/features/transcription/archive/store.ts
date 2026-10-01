// آرشیوِ صدایِ جلسات — فقط برایِ بازبینیِ ادمین (پیداکردنِ ریشه‌ی باگ‌هایِ STT).
// جدا از data/batch-queue (که یه صفِ گذرا برایِ رونویسیه و بعدِ موفقیت پاک می‌شه):
// این یه آرشیوِ عمدیه، با نگه‌داریِ محدود (۳۰ روز)، فقط پشتِ requireAdmin
// قابلِ‌شنیدنه — نه تراپیست، نه هیچ کاربرِ عادی.
//
// محل و قفلِ آرشیو (data/session-audio/<sessionId>/) + نوع‌ها. قفلِ per-session یک instance است که هم نوشتن و هم
// ساختِ فایلِ کامل از آن استفاده می‌کنند (همان رفتارِ قبلی).
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createKeyedLock } from '../../../shared/keyedLock.js';

export const ARCHIVE_DIR = path.join(process.cwd(), 'data', 'session-audio');
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // ۳۰ روز (یک ماه) — تصمیمِ مالک 2026-10-01
export const SESSION_AUDIO_RETENTION_MS = RETENTION_MS; // برایِ «روزهایِ باقی‌مانده» در آرشیوِ ادمین (B2)

export function ensureArchiveDir() {
  if (!existsSync(ARCHIVE_DIR)) mkdirSync(ARCHIVE_DIR, { recursive: true });
}

export function sessionDir(sessionId: string): string {
  const safe = String(sessionId).replace(/[^a-zA-Z0-9-]/g, '');
  return path.join(ARCHIVE_DIR, safe);
}

export type AudioSource = 'durable' | 'offline' | 'upload';
// 'prenote' (2026-09-29): صدایِ یادداشتِ صوتیِ پیش از جلسه (خودِ تراپیست) — مثلِ 'note' هرگز واردِ متنِ جلسه نمی‌شود.
export type AudioKind = 'session' | 'note' | 'prenote';

// قفلِ per-session: بدونِ این، دو archiveAudioForAdmin هم‌زمان رویِ یک جلسه ممکنه
// هر دو همون MAX(seq) قدیمی رو ببینن و با seqِ یکسان تصادم/بازنویسی کنن (LAW-013:
// runtime تک‌پروسه‌ایه، پس این قفلِ in-memory برایِ همین سرور کافیه).
export const withSessionLock = createKeyedLock();

export interface SessionAudioRow {
  id: string;
  session_id: string;
  seq: number;
  path: string;
  bytes: number;
  mime: string | null;
  source: string;
  run_id: string;
  kind: string;
  sha256: string | null;
  duration_ms: number | null;
  created_at: string;
  client_seq?: number | null; // migration 027
}
