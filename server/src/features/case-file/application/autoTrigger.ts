// سیاستِ مرکزیِ «تولیدِ خودکارِ پرونده» — قبلاً داخلِ http/sessions.ts بود و فقط از همان‌جا صدا زده
// می‌شد؛ حالا jobِ آپلودِ صدا و merge ِ late-transcript هم از همین مسیر استفاده می‌کنند (رفعِ F8).
// fire-and-forget: هرگز پاسخِ HTTPِ اصلی را بلاک یا fail نمی‌کند.
import { query } from '../../../db/connection.js';
import { generateCaseFile } from './generateCaseFile.js';
import { SqlCaseFileRepository } from '../adapters/repository/caseFileRepository.sql.js';
import { resolveLLMProvider } from '../adapters/llm/registry.js';
import { CaseFileGenerationError } from '../domain/errors.js';
import { createNotification } from '../../notifications/notify.js';

const repo = new SqlCaseFileRepository();

// ⭐ پی‌ریزی برایِ مراجعینِ فعال (تصمیمِ مالک 2026-09-23: «الان نه ولی پی‌ریزی انجام بشه»):
// امروز تولیدِ خودکار فقط برایِ مراجعِ غیرفعال است (همان رفتارِ قبلی). روشن‌کردنِ آن برایِ فعال‌ها
// فقط با CASE_FILE_AUTO_ACTIVE_CLIENTS=1 در env است — بدونِ تغییرِ کد/migration.
export function autoGenerateAllowedForActiveClients(): boolean {
  return process.env.CASE_FILE_AUTO_ACTIVE_CLIENTS === '1';
}

export type AutoCaseFileOutcome = 'not_applicable' | 'skipped' | 'generated' | 'busy' | 'failed' | 'transient';

export interface AutoTriggerOptions {
  // برایِ jobِ آپلود: اعلانِ نتیجه (پرونده به‌روز شد / ناموفق) با همین job_id ثبت می‌شود.
  notify?: { jobId?: string | null; sessionId?: string | null };
  // jobِ آپلود خودش دوباره تلاش می‌کند: خطایِ گذرایِ LLM ⇒ 'transient' بدونِ اعلانِ شکست (اعلان فقط در تلاشِ آخر).
  retryTransient?: boolean;
}

export async function maybeAutoGenerateCaseFile(
  clientId: string,
  therapistId: string,
  opts: AutoTriggerOptions = {}
): Promise<AutoCaseFileOutcome> {
  try {
    const therapistRow = await query(
      'SELECT case_file_auto_generate, case_file_enabled FROM therapists WHERE id = ?',
      [therapistId]
    );
    // فیچرِ پرونده فقط برایِ حسابِ دارایِ case_file_enabled (migration 022) — همان گاردِ requireCaseFileAccess.
    if (!therapistRow.rows[0]?.case_file_enabled) return 'not_applicable';
    if (therapistRow.rows[0]?.case_file_auto_generate !== true) return 'not_applicable';

    const clientRow = await query(
      'SELECT category, gender, alias, status FROM clients WHERE id = ? AND therapist_id = ?',
      [clientId, therapistId]
    );
    const client = clientRow.rows[0];
    if (!client) return 'not_applicable';
    if (client.status !== 'inactive' && !autoGenerateAllowedForActiveClients()) return 'not_applicable';

    const llmProvider = resolveLLMProvider();
    const { skipped } = await generateCaseFile(
      clientId,
      { category: client.category ?? null, gender: client.gender ?? null, alias: client.alias ?? null },
      { llmProvider, caseFileRepo: repo },
      { therapistId }
    );
    if (!skipped && opts.notify) {
      await createNotification({ therapistId, kind: 'case_file_updated', clientId, sessionId: opts.notify.sessionId, jobId: opts.notify.jobId });
    }
    return skipped ? 'skipped' : 'generated';
  } catch (err) {
    if (err instanceof CaseFileGenerationError && err.code === 'busy') return 'busy';
    if (opts.retryTransient && err instanceof CaseFileGenerationError && err.transient) {
      console.log('[case-file] auto-generate خطایِ گذرا برایِ client=' + clientId + ' — jobِ آپلود دوباره تلاش می‌کند');
      return 'transient';
    }
    // خطاها فقط لاگ می‌شوند — بدونِ افشایِ متنِ بالینی (LAW-001). وضعیتِ رکورد در
    // client_case_file.status='error' می‌ماند (خودِ generateCaseFile این را ثبت می‌کند).
    console.log('[case-file] auto-generate ناموفق برایِ client=' + clientId + ':', err instanceof Error ? err.message : String(err));
    if (opts.notify) {
      await createNotification({ therapistId, kind: 'case_file_failed', clientId, sessionId: opts.notify.sessionId, jobId: opts.notify.jobId }).catch(() => {});
    }
    return 'failed';
  }
}

// برایِ مسیرهایی که فقط sessionId دارند (merge ِ late-transcript) — فقط جلسه‌ی completed.
export async function triggerCaseFileForSession(sessionId: string, reason: string): Promise<void> {
  try {
    const r = await query(
      `SELECT s.client_id, s.status, c.therapist_id FROM sessions s JOIN clients c ON c.id = s.client_id WHERE s.id = ?`,
      [sessionId]
    );
    const row = r.rows[0];
    if (!row || row.status !== 'completed') return;
    await maybeAutoGenerateCaseFile(row.client_id, row.therapist_id);
  } catch (e) {
    console.log('[case-file] trigger for session failed (' + reason + '):', String(e).slice(0, 160));
  }
}
