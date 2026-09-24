// رضایتِ ضبط و رونویسی — یک بار برایِ هر مراجع (migration 024، دستورِ مالک 2026-09-24).
// LAW-009 همچنان برقرار است: هیچ جلسه/آپلودی بدونِ رضایتِ صریح شروع نمی‌شود — فقط رضایتِ صریحِ قبلیِ
// همان مراجع (ثبت‌شده با زمان) برایِ دفعاتِ بعد معتبر می‌ماند تا وقتی تراپیست لغوش کند.
import { query } from '../db/connection.js';
import { logEvent } from '../obs/eventLog.js';

export function hasStoredConsent(client: { recording_consent_at?: unknown } | null | undefined): boolean {
  return !!client?.recording_consent_at;
}

// فقط اولین بار ثبت می‌شود (زمانِ اولین رضایت حفظ می‌شود). idempotent.
export async function recordClientConsent(clientId: string, therapistId: string): Promise<void> {
  const r = await query(
    'UPDATE clients SET recording_consent_at = NOW() WHERE id = ? AND therapist_id = ? AND recording_consent_at IS NULL',
    [clientId, therapistId]
  );
  if (r.rowCount === 1) logEvent({ event: 'client.consent_recorded', therapistId, clientId });
}
