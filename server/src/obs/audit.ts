// ممیزیِ کنش‌هایِ حساس (A6، 2026-09-26، migration 028). helperِ واحد — هر نقطه‌ی ثبت فقط همین را صدا می‌زند.
// LAW-001: detail از sanitizeDetail عبور می‌کند؛ target_id فقط UUID. fail-open: شکستِ ثبت هرگز عملیاتِ اصلی را fail نمی‌کند،
// ولی در obs (JSONL) هم ثبت می‌شود تا ردِ آن گم نشود.
import { query } from '../db/connection.js';
import { sanitizeDetail } from './redact.js';
import { writeJsonl } from './fileSink.js';

export const AUDIT_ACTIONS = [
  'admin.export',               // خروجیِ داده (یک تراپیست یا کلِ سیستم)
  'admin.therapist_update',     // تغییرِ active / is_admin
  'admin.therapist_delete',
  'admin.client_delete',
  'admin.session_view',         // مشاهده‌ی متن/یادداشت‌هایِ یک جلسه
  'admin.audio_play',           // پخشِ صدا (شروع، نه هر Range)
  'admin.audio_download',
  'admin.session_audio_delete', // حذفِ فقط صدایِ یک جلسه (B2)
  'admin.voice_note_text_view', // نمایشِ متنِ یادداشتِ صوتی (B3)
  'admin.flag_granted',         // ادمین‌شدنِ خودکار با ADMIN_PHONE (ensureAdminFlag)
  'therapist.client_delete',
  'therapist.session_delete',
  'consent.recorded',
  'consent.revoked',
  'session.auto_closed',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AuditInput {
  actorId?: string | null;
  actorIsAdmin?: boolean;
  action: AuditAction;
  targetType?: 'therapist' | 'client' | 'session' | 'session_audio' | 'note' | 'system';
  targetId?: string | null;
  detail?: Record<string, unknown>;
}

export async function recordAudit(e: AuditInput): Promise<void> {
  const actor = e.actorId && UUID_RE.test(e.actorId) ? e.actorId : null;
  const target = e.targetId && UUID_RE.test(e.targetId) ? e.targetId : null;
  const detail = sanitizeDetail(e.detail || {});
  try {
    await query(
      `INSERT INTO audit_log (actor_id, actor_is_admin, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?, ?)`,
      [actor, !!e.actorIsAdmin, e.action, e.targetType || null, target, Object.keys(detail).length ? JSON.stringify(detail) : null]
    );
  } catch (err) {
    writeJsonl({ ts: new Date().toISOString(), event: 'audit.write_failed', severity: 'error', action: e.action, target_type: e.targetType || null, target_id: target, actor_id: actor });
    console.log('[audit] write failed:', String(err).slice(0, 160));
  }
}
