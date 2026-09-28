// رضایتِ ضبط و رونویسی — یک بار برایِ هر مراجع (migration 024، دستورِ مالک 2026-09-24).
// LAW-009 همچنان برقرار است: هیچ جلسه/آپلودی بدونِ رضایتِ صریح شروع نمی‌شود — فقط رضایتِ صریحِ قبلیِ
// همان مراجع (ثبت‌شده با زمان) برایِ دفعاتِ بعد معتبر می‌ماند تا وقتی تراپیست لغوش کند.
import { setRecordingConsentIfAbsent } from './clients.repository.js';
import { logEvent } from '../../obs/eventLog.js';
import { recordAudit } from '../../obs/audit.js';

export function hasStoredConsent(client: { recording_consent_at?: unknown } | null | undefined): boolean {
  return !!client?.recording_consent_at;
}

// فقط اولین بار ثبت می‌شود (زمانِ اولین رضایت حفظ می‌شود). idempotent.
export async function recordClientConsent(clientId: string, therapistId: string): Promise<void> {
  if ((await setRecordingConsentIfAbsent(clientId, therapistId)) === 1) {
    logEvent({ event: 'client.consent_recorded', therapistId, clientId });
    await recordAudit({ actorId: therapistId, action: 'consent.recorded', targetType: 'client', targetId: clientId });
  }
}
