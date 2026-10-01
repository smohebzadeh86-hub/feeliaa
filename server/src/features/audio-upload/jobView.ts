// نمایِ job برایِ APIها (تراپیست و ادمین) — تنها منبعِ شکلِ پاسخِ job.
import { uploadCaseFileAllowed } from './jobMachine.js';
import { parseAudioQuality } from './quality.js';

export function jobView(j: any) {
  return {
    id: j.id,
    stage: j.stage,
    attempts: j.attempts,
    error_code: j.error_code,
    duration_ms: j.duration_ms,
    case_file_status: j.case_file_status,
    transcript_ready: !!j.transcript_applied_at,
    transcript_chars: j.transcript_chars,
    created_at: j.created_at,
    updated_at: j.updated_at,
    finished_at: j.finished_at,
    next_attempt_at: j.next_attempt_at,
    session_id: j.session_id,
    session_num: j.session_num,
    client_id: j.client_id,
    client_code: j.client_code,
    client_alias: j.client_alias,
    client_status: j.client_status ?? null,
    // پیش از ثبتِ متن: آیا این job (با وضعیتِ فعلی) به مرحله‌ی پرونده می‌رود؟ تنها منبعِ UI برایِ stepper (همان uploadCaseFileAllowed).
    case_file_planned: uploadCaseFileAllowed({
      clientStatus: j.client_status ?? null,
      caseFileEnabled: !!j.t_case_file_enabled,
      autoGenerate: j.t_case_file_auto_generate === null || j.t_case_file_auto_generate === undefined ? null : !!j.t_case_file_auto_generate,
    }),
    original_name: j.original_name,
    parts_total: j.parts_total ?? null,
    // پلنِ B: فقط نامِ flagها (علتِ احتمالی) و هشدارِ کم‌اطمینان — سنجه‌هایِ عددی به UI نمی‌روند.
    quality_flags: parseAudioQuality(j.audio_quality)?.flags ?? [],
    quality_warning: j.quality_warning ?? null,
  };
}
