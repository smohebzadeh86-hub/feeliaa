// SQLِ پنلِ ادمین — رشته‌هایِ SQLِ قبلیِ admin.routes، بدونِ تغییر (همه‌ی مسیرها پشتِ requireAdmin).
// LAW-001: هر جا متن فقط طولش لازم است، فقط CHAR_LENGTH خوانده می‌شود (نه LENGTH؛ فارسیِ utf8mb4 چندبایتی است).
import { query } from '../../db/connection.js';

// ————— آمار / تراپیست‌ها / مراجعین —————
export async function getStats(): Promise<any> {
  const result = await query(`
      SELECT
        (SELECT COUNT(*) FROM therapists) as therapists,
        (SELECT COUNT(*) FROM clients) as clients,
        (SELECT COUNT(*) FROM sessions) as sessions,
        (SELECT COUNT(*) FROM sessions WHERE created_at >= CURRENT_DATE) as sessions_today,
        (SELECT COUNT(*) FROM sessions WHERE created_at >= CURRENT_DATE - INTERVAL 7 DAY) as sessions_this_week
    `);
  return result.rows[0];
}

// (2026-10-03) «آخرین فعالیت» = تازه‌ترین ضبطِ صدایِ جلسه (kind='session')، وگرنه زمانِ ساختِ جلسه — نه s.date (تاریخِ شروعِ جلسه که
// با ادامه‌یِ همان جلسه در روزِ بعد عقب می‌ماند) و نه updated_at (ویرایش/پردازش آن را جابه‌جا می‌کند). مالکِ تعریف: همین SQL.
const SESSION_ACTIVITY_SQL = `
  SELECT s.id AS session_id,
         (SELECT MAX(a.created_at) FROM session_audio a WHERE a.session_id = s.id AND a.kind = 'session') AS rec_at,
         GREATEST(s.created_at, COALESCE((SELECT MAX(a.created_at) FROM session_audio a WHERE a.session_id = s.id AND a.kind = 'session'), s.created_at)) AS activity_at
    FROM sessions s`;

export async function listTherapistsWithStats(search: string | null): Promise<any[]> {
  const result = await query(`
      SELECT
        t.id, t.phone, t.email, t.name, t.specialty, t.is_admin, t.active, t.created_at, t.final_transcript_enabled,
        COUNT(DISTINCT c.id) as client_count,
        COUNT(DISTINCT s.id) as session_count,
        MAX(s.created_at) as last_session_at,
        MAX(sa.rec_at) as last_recording_at,
        MAX(sa.activity_at) as last_activity_at
      FROM therapists t
      LEFT JOIN clients c ON c.therapist_id = t.id
      LEFT JOIN sessions s ON s.client_id = c.id
      LEFT JOIN (${SESSION_ACTIVITY_SQL}) sa ON sa.session_id = s.id
      WHERE ? IS NULL OR t.phone LIKE CONCAT('%', ?, '%') OR t.name LIKE CONCAT('%', ?, '%') OR t.email LIKE CONCAT('%', ?, '%')
      GROUP BY t.id
      ORDER BY (MAX(sa.activity_at) IS NULL), MAX(sa.activity_at) DESC, t.created_at DESC
    `, [search, search, search, search]);
  return result.rows;
}

export async function getTherapistBrief(id: string): Promise<any> {
  return (await query('SELECT id, phone, name, specialty FROM therapists WHERE id = ?', [id])).rows[0];
}

export async function listClientsOfTherapistWithStats(therapistId: string): Promise<any[]> {
  const clients = await query(`
      SELECT c.id, c.code, c.alias, c.status, c.status_reason, c.category, c.gender, c.created_at, c.deleted_at,
        COUNT(s.id) as session_count,
        MAX(s.date) as last_session_date,
        MAX(sa.rec_at) as last_recording_at,
        MAX(sa.activity_at) as last_activity_at
      FROM clients c
      LEFT JOIN sessions s ON s.client_id = c.id
      LEFT JOIN (${SESSION_ACTIVITY_SQL}) sa ON sa.session_id = s.id
      WHERE c.therapist_id = ?
      GROUP BY c.id
      ORDER BY (MAX(sa.activity_at) IS NULL), MAX(sa.activity_at) DESC, c.created_at DESC
    `, [therapistId]);
  return clients.rows;
}

export async function getClientBrief(id: string): Promise<any> {
  return (await query('SELECT id, code, alias FROM clients WHERE id = ?', [id])).rows[0];
}

// (2026-10-01) ترتیب: آخرین ضبطِ صدایِ جلسه (kind='session')، وگرنه زمانِ ساختِ جلسه — تازه‌ترین بالا.
export async function listSessionsOfClient(clientId: string): Promise<any[]> {
  const sessions = await query(`
      SELECT s.id, s.session_num, s.date, s.start_time, s.duration_ms, s.status, s.source, s.consent, s.deleted_at,
        s.created_at, s.updated_at, s.batch_status, s.auto_closed_at, s.realtime_reliable, CHAR_LENGTH(COALESCE(s.transcript, '')) as transcript_len,
        COUNT(a.id) as audio_count,
        MAX(CASE WHEN a.kind = 'session' THEN a.created_at END) AS last_recording_at,
        GREATEST(s.created_at, COALESCE(MAX(CASE WHEN a.kind = 'session' THEN a.created_at END), s.created_at)) AS last_activity_at
      FROM sessions s
      LEFT JOIN session_audio a ON a.session_id = s.id
      WHERE s.client_id = ?
      GROUP BY s.id
      ORDER BY last_activity_at DESC, s.session_num DESC
    `, [clientId]);
  return sessions.rows;
}

export async function countAdmins(): Promise<number> {
  const adminCount = await query('SELECT COUNT(*) AS count FROM therapists WHERE is_admin = true');
  return Number(adminCount.rows[0].count);
}

// updates/values را route ساخته (values با id در انتها). خروجی: rowCount
export async function updateTherapistFlags(updates: string[], values: unknown[]): Promise<number> {
  const update = await query(
    `UPDATE therapists SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  return update.rowCount;
}

export async function getTherapistAccount(id: string): Promise<any> {
  const result = await query(
    'SELECT id, phone, email, name, is_admin, active, created_at, final_transcript_enabled FROM therapists WHERE id = ?',
    [id]
  );
  return result.rows[0];
}

export async function getTherapistPhoneRow(id: string): Promise<any> {
  return (await query('SELECT phone FROM therapists WHERE id = ?', [id])).rows[0];
}

export async function listSessionIdsOfTherapist(therapistId: string): Promise<string[]> {
  const sessionIdsResult = await query(
    'SELECT s.id FROM sessions s JOIN clients c ON s.client_id = c.id WHERE c.therapist_id = ?',
    [therapistId]
  );
  return sessionIdsResult.rows.map((r: { id: string }) => r.id);
}

export async function getClientCodeRow(id: string): Promise<any> {
  return (await query('SELECT code FROM clients WHERE id = ?', [id])).rows[0];
}

export async function listSessionIdsOfClient(clientId: string): Promise<string[]> {
  const sessionIdsResult = await query('SELECT id FROM sessions WHERE client_id = ?', [clientId]);
  return sessionIdsResult.rows.map((r: { id: string }) => r.id);
}

// ⭐ حذفِ نرم (migration 043) — حذفِ سخت ممنوع است.
export async function deleteClient(id: string, by: string | null = null): Promise<number> {
  return (await query('UPDATE clients SET deleted_at = NOW(), deleted_by = ? WHERE id = ? AND deleted_at IS NULL', [by, id])).rowCount;
}

export async function restoreClient(id: string): Promise<number> {
  return (await query('UPDATE clients SET deleted_at = NULL, deleted_by = NULL WHERE id = ? AND deleted_at IS NOT NULL', [id])).rowCount;
}

// ————— جلسات —————
export async function sessionExists(id: string): Promise<boolean> {
  return (await query('SELECT id FROM sessions WHERE id = ?', [id])).rows.length > 0;
}

export async function getSessionWithTranscript(id: string): Promise<any> {
  const session = await query(`
      SELECT s.id, s.client_id, s.session_num, s.date, s.start_time, s.duration_ms,
        s.status, s.source, s.consent, s.transcript, s.created_at,
        s.updated_at, s.transcript_version, s.realtime_reliable, s.stt_mode, s.batch_status, s.auto_closed_at, s.pre_note, s.deleted_at, s.deleted_by
      FROM sessions s WHERE s.id = ?
    `, [id]);
  return session.rows[0];
}

export async function listSessionNotesForAdmin(sessionId: string): Promise<any[]> {
  const notes = await query(`
      SELECT id, type, text, sign_type, offset_ms, wall_clock, created_at, deleted_at
      FROM session_notes
      WHERE session_id = ?
      ORDER BY (offset_ms IS NULL), offset_ms, created_at
    `, [sessionId]);
  return notes.rows;
}

export async function getSessionSttState(id: string): Promise<any> {
  const session = await query(
    'SELECT id, batch_status, realtime_reliable, stt_mode FROM sessions WHERE id = ?',
    [id]
  );
  return session.rows[0];
}

// conditions/params را route ساخته؛ خودِ متنِ transcript هرگز SELECT نمی‌شود — فقط CHAR_LENGTH.
// ترتیب‌هایِ مجاز (whitelist — هرگز مستقیم از ورودیِ کاربر در SQL نمی‌رود).
export const RECENT_SORTS: Record<string, string> = {
  activity: 'last_activity_at',
  recording: '(last_recording_at IS NULL), last_recording_at',
  created: 's.created_at',
  updated: 's.updated_at',
  date: 's.date',
  num: 's.session_num',
  duration: 'audio_duration_ms',
  transcript: 'transcript_len',
  therapist: 't.name',
  client: 'c.code',
};
export async function listRecentSessions(conditions: string[], params: unknown[], limit: number, offset: number, sort = 'activity', dir: 'asc' | 'desc' = 'desc'): Promise<any[]> {
  const orderBy = `${RECENT_SORTS[sort] ?? RECENT_SORTS.activity} ${dir === 'asc' ? 'ASC' : 'DESC'}, s.updated_at DESC`;
  const rows = await query(
    `SELECT s.id, s.session_num, s.date, s.start_time, s.status, s.source, s.deleted_at, s.deleted_by,
              s.created_at, s.updated_at, s.batch_status, s.realtime_reliable, s.stt_mode,
              c.id AS client_id, c.code AS client_code,
              t.id AS therapist_id, t.name AS therapist_name,
              CHAR_LENGTH(s.transcript) AS transcript_len,
              (SELECT COUNT(*) FROM session_audio a WHERE a.session_id = s.id) AS audio_count,
              (SELECT COALESCE(SUM(a.bytes), 0) FROM session_audio a WHERE a.session_id = s.id) AS audio_bytes,
              (SELECT COALESCE(SUM(a.duration_ms), 0) FROM session_audio a WHERE a.session_id = s.id) AS audio_duration_ms,
              (SELECT COUNT(*) FROM session_notes n WHERE n.session_id = s.id) AS note_count,
              (SELECT MAX(a.created_at) FROM session_audio a WHERE a.session_id = s.id AND a.kind = 'session') AS last_recording_at,
              GREATEST(s.created_at, COALESCE((SELECT MAX(a.created_at) FROM session_audio a WHERE a.session_id = s.id AND a.kind = 'session'), s.created_at)) AS last_activity_at
       FROM sessions s
       JOIN clients c ON c.id = s.client_id
       JOIN therapists t ON t.id = c.therapist_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows.rows;
}

// diagnosis: متنِ جلسه فقط برایِ شمارشِ نویسه/بند خوانده می‌شود و برگردانده نمی‌شود (LAW-001).
export async function getSessionForDiagnosis(id: string): Promise<any> {
  const sres = await query(
    `SELECT id, status, source, duration_ms, created_at, updated_at, batch_status, realtime_reliable, transcript
       FROM sessions WHERE id = ?`, [id]
  );
  return sres.rows[0];
}

// (2026-09-29) تشخیصِ جلسه‌ی آپلودی — فقط زمان‌ها/مرحله/کدِ خطا از جدول‌هایِ job (نه obs_events که جارو می‌شود)؛ بدونِ متن.
export async function listUploadJobsForDiagnosis(sessionId: string): Promise<any[]> {
  return (await query(
    `SELECT j.stage, j.attempts, j.duration_ms, j.transcript_chars, j.error_code, j.quality_warning, j.transcript_metrics,
            j.created_at, j.transcript_applied_at, j.finished_at,
            u.size_bytes, u.created_at AS upload_started_at, u.completed_at AS upload_completed_at
       FROM audio_jobs j LEFT JOIN audio_uploads u ON u.id = j.upload_id
      WHERE j.session_id = ? ORDER BY j.created_at`, [sessionId]
  )).rows;
}

export async function getFinalTranscriptForDiagnosis(sessionId: string): Promise<any> {
  return (await query(
    'SELECT stage, attempts, error_code, queued_at, finished_at FROM final_transcripts WHERE session_id = ?', [sessionId]
  )).rows[0] || null;
}

export async function listSessionEventsBrief(sessionId: string): Promise<any[]> {
  return (await query('SELECT ts, event, detail FROM obs_events WHERE session_id = ? ORDER BY ts', [sessionId])).rows;
}

export async function listSessionUiEventsBrief(sessionId: string): Promise<any[]> {
  return (await query('SELECT ts, kind, target_id FROM obs_ui_events WHERE session_id = ? ORDER BY ts', [sessionId])).rows;
}

export async function getSessionTimelineHead(id: string): Promise<any> {
  return (await query('SELECT id, created_at, updated_at, status FROM sessions WHERE id = ?', [id])).rows[0];
}

export async function listSessionEvents(sessionId: string): Promise<any[]> {
  const events = await query(
    'SELECT ts, source, severity, event, code, duration_ms, status_code, route, method, detail FROM obs_events WHERE session_id = ? ORDER BY ts',
    [sessionId]
  );
  return events.rows;
}

export async function listSessionUiEvents(sessionId: string): Promise<any[]> {
  const uiEvents = await query(
    'SELECT ts, kind, screen, target_id, target_role, target_tag, value_num FROM obs_ui_events WHERE session_id = ? ORDER BY ts',
    [sessionId]
  );
  return uiEvents.rows;
}

// متنِ یادداشت هرگز SELECT نمی‌شود — فقط متادیتا (LAW-001).
export async function listSessionNotesMeta(sessionId: string): Promise<any[]> {
  const notes = await query(
    'SELECT id, type, sign_type, created_at, CHAR_LENGTH(text) AS text_len FROM session_notes WHERE session_id = ? ORDER BY created_at',
    [sessionId]
  );
  return notes.rows;
}

// ————— صدا —————
// f: فیلترهایِ audioFilters (alias‌هایِ a/s/c)؛ روزهایِ باقی‌مانده تا حذفِ قدیمی‌ترین سگمنت در خودِ SQL (هم‌زمان با sweep).
export function audioArchiveBase(f: { sql: string; params: unknown[] }): string {
  return `FROM session_audio a JOIN sessions s ON s.id = a.session_id JOIN clients c ON c.id = s.client_id
      JOIN therapists t ON t.id = c.therapist_id WHERE a.kind = 'session'${f.sql}`;
}

export async function listAudioArchivePage(base: string, f: { sql: string; params: unknown[] }, retentionSec: number, limit: number, offset: number): Promise<any[]> {
  const r = await query(
    `SELECT s.id AS session_id, s.session_num, s.date, s.status, s.source, s.client_id, c.code AS client_code,
              c.therapist_id, t.name AS therapist_name,
              COUNT(*) AS segments, COALESCE(SUM(a.bytes), 0) AS bytes, COALESCE(SUM(a.duration_ms), 0) AS audio_ms,
              MIN(a.created_at) AS first_at, MAX(a.created_at) AS last_at,
              TIMESTAMPDIFF(SECOND, NOW(), MIN(a.created_at) + INTERVAL ? SECOND) AS expires_in_sec
         ${base}
        GROUP BY s.id, s.session_num, s.date, s.status, s.source, s.client_id, c.code, c.therapist_id, t.name
        ORDER BY last_at DESC LIMIT ? OFFSET ?`,
    [retentionSec, ...f.params, limit + 1, offset]
  );
  return r.rows;
}

export async function listSessionSeqs(ids: string[]): Promise<any[]> {
  return (await query(`SELECT session_id, seq, run_id, client_seq FROM session_audio WHERE kind = 'session' AND session_id IN (${ids.map(() => '?').join(',')})`, ids)).rows;
}

export async function audioArchiveTotals(base: string, f: { sql: string; params: unknown[] }): Promise<any> {
  const tot = await query(
    `SELECT COUNT(DISTINCT a.session_id) AS sessions, COALESCE(SUM(a.bytes), 0) AS bytes, COALESCE(SUM(a.duration_ms), 0) AS audio_ms ${base}`,
    f.params
  );
  return tot.rows[0];
}

export async function countAudioExpiringSoon(base: string, f: { sql: string; params: unknown[] }, retentionSec: number): Promise<any> {
  const exp = await query(
    `SELECT COUNT(*) AS n FROM (SELECT a.session_id, MIN(a.created_at) AS m ${base} GROUP BY a.session_id) x
        WHERE TIMESTAMPDIFF(SECOND, NOW(), x.m + INTERVAL ? SECOND) <= 2 * 86400`,
    [...f.params, retentionSec]
  );
  return exp.rows[0];
}

export async function sessionAudioTotals(sessionId: string): Promise<any> {
  return (await query('SELECT COUNT(*) AS n, COALESCE(SUM(bytes), 0) AS b FROM session_audio WHERE session_id = ?', [sessionId])).rows[0];
}

// f: فیلترهایِ audioFilters رویِ x.ts
export async function listVoiceNoteSessionsPage(f: { sql: string; params: unknown[] }, limit: number, offset: number): Promise<any[]> {
  const r = await query(
    `SELECT x.session_id, MAX(x.ts) AS last_at FROM (
          SELECT n.session_id, n.created_at AS ts FROM session_notes n WHERE n.type IN ('voice', 'voice_before')
          UNION ALL SELECT a.session_id, a.created_at AS ts FROM session_audio a WHERE a.kind IN ('note', 'prenote')
        ) x JOIN sessions s ON s.id = x.session_id JOIN clients c ON c.id = s.client_id
        WHERE 1 = 1${f.sql}
        GROUP BY x.session_id ORDER BY last_at DESC LIMIT ? OFFSET ?`,
    [...f.params, limit + 1, offset]
  );
  return r.rows;
}

export async function listSessionsInfo(ph: string, ids: string[]): Promise<any[]> {
  const info = await query(
    `SELECT s.id, s.session_num, s.date, s.status, s.client_id, c.code AS client_code, c.therapist_id, t.name AS therapist_name
         FROM sessions s JOIN clients c ON c.id = s.client_id JOIN therapists t ON t.id = c.therapist_id WHERE s.id IN (${ph})`, ids);
  return info.rows;
}

// فقط طولِ متن — متنِ یادداشتِ صوتی فقط با کلیکِ صریح (تصمیمِ D2).
export async function listVoiceNotesMeta(ph: string, ids: string[]): Promise<any[]> {
  const notes = await query(
    `SELECT id, session_id, type, wall_clock, created_at, CHAR_LENGTH(COALESCE(text, '')) AS text_len FROM session_notes
        WHERE type IN ('voice', 'voice_before') AND session_id IN (${ph}) ORDER BY created_at`, ids);
  return notes.rows;
}

export async function listNoteAudio(ph: string, ids: string[]): Promise<any[]> {
  const audio = await query(
    `SELECT id, session_id, kind, bytes, duration_ms, created_at FROM session_audio WHERE kind IN ('note', 'prenote') AND session_id IN (${ph}) ORDER BY created_at`, ids);
  return audio.rows;
}

export async function getVoiceNoteText(noteId: string): Promise<any> {
  return (await query(`SELECT id, session_id, text FROM session_notes WHERE id = ? AND type IN ('voice', 'voice_before')`, [noteId])).rows[0];
}

// ————— export —————
export async function getTherapistForExport(therapistId: string): Promise<any> {
  return (await query('SELECT id, phone, email, name, specialty, created_at FROM therapists WHERE id = ?', [therapistId])).rows[0];
}

export async function listClientsForExport(therapistId: string): Promise<any[]> {
  const clients = await query(
    'SELECT id, code, alias, status, status_reason, category, gender, created_at, deleted_at, deleted_by FROM clients WHERE therapist_id = ? ORDER BY created_at',
    [therapistId]
  );
  return clients.rows;
}

export async function listSessionsForExport(therapistId: string): Promise<any[]> {
  const sessions = await query(`
    SELECT s.id, s.client_id, s.session_num, s.date, s.start_time, s.duration_ms,
           s.status, s.source, s.consent, s.transcript, s.created_at, s.unit_type, s.modalities, s.deleted_at, s.deleted_by
    FROM sessions s
    JOIN clients c ON c.id = s.client_id
    WHERE c.therapist_id = ?
    ORDER BY s.client_id, s.session_num
  `, [therapistId]);
  return sessions.rows;
}

// MySQL از NULLS LAST پشتیبانی نمی‌کند؛ `(offset_ms IS NULL)` در ASC همان اثر را دارد.
export async function listNotesForExport(therapistId: string): Promise<any[]> {
  const notes = await query(`
    SELECT n.id, n.session_id, n.type, n.text, n.sign_type, n.offset_ms, n.wall_clock, n.created_at, n.deleted_at, n.deleted_by
    FROM session_notes n
    JOIN sessions s ON s.id = n.session_id
    JOIN clients c ON c.id = s.client_id
    WHERE c.therapist_id = ?
    ORDER BY n.session_id, (n.offset_ms IS NULL), n.offset_ms, n.created_at
  `, [therapistId]);
  return notes.rows;
}

export async function listTherapistIdsForExport(): Promise<string[]> {
  const ids = await query('SELECT id FROM therapists ORDER BY created_at');
  return ids.rows.map((row: { id: string }) => row.id);
}

// ————— رصد (obs) —————
export async function listObsEvents(f: {
  event: string | null; severity: string | null; therapistId: string | null; sessionId: string | null;
  source: string | null; from: string | null; to: string | null; limit: number;
}): Promise<any[]> {
  const { event, severity, therapistId, sessionId, source, from, to, limit } = f;
  const rows = await query(
    `SELECT id, ts, client_ts, source, severity, event, code, therapist_id, client_id, session_id,
              run_id, request_id, nav_id, route, method, status_code, duration_ms, detail
       FROM obs_events
       WHERE (? IS NULL OR event = ?)
         AND (? IS NULL OR severity = ?)
         AND (? IS NULL OR therapist_id = ?)
         AND (? IS NULL OR session_id = ?)
         AND (? IS NULL OR source = ?)
         AND (? IS NULL OR ts >= ?)
         AND (? IS NULL OR ts <= ?)
       ORDER BY ts DESC
       LIMIT ?`,
    [event, event, severity, severity, therapistId, therapistId, sessionId, sessionId, source, source, from, from, to, to, limit]
  );
  return rows.rows;
}

export async function listObsUiEvents(f: {
  kind: string | null; therapistId: string | null; sessionId: string | null; navId: string | null;
  from: string | null; to: string | null; limit: number;
}): Promise<any[]> {
  const { kind, therapistId, sessionId, navId, from, to, limit } = f;
  const rows = await query(
    `SELECT id, ts, client_ts, therapist_id, session_id, nav_id, seq, kind, screen, target_id, target_role, target_tag, value_num
       FROM obs_ui_events
       WHERE (? IS NULL OR kind = ?)
         AND (? IS NULL OR therapist_id = ?)
         AND (? IS NULL OR session_id = ?)
         AND (? IS NULL OR nav_id = ?)
         AND (? IS NULL OR ts >= ?)
         AND (? IS NULL OR ts <= ?)
       ORDER BY ts DESC
       LIMIT ?`,
    [kind, kind, therapistId, therapistId, sessionId, sessionId, navId, navId, from, from, to, to, limit]
  );
  return rows.rows;
}

export async function obsDailyCounts(): Promise<any[]> {
  const daily = await query(
    `SELECT DATE(ts) AS day, event, COUNT(*) AS count
       FROM obs_events
       WHERE ts >= DATE_SUB(NOW(), INTERVAL 14 DAY)
       GROUP BY DATE(ts), event
       ORDER BY day DESC`
  );
  return daily.rows;
}

// information_schema ممکن است در بعضی محیط‌ها در دسترس نباشد — caller خطا را fail-open می‌گیرد.
export async function obsTableSizes(): Promise<any[]> {
  const sizeRows = await query(
    `SELECT table_name, (DATA_LENGTH + INDEX_LENGTH) AS size_bytes
         FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name IN ('obs_events', 'obs_ui_events')`
  );
  return sizeRows.rows;
}

// ————— جلساتِ در حالِ ضبط / صفِ سراسری / سلامتِ سیستم (2026-10-01) — فقط متادیتا، هرگز متنِ بالینی —————
// سنِ آخرین سگمنت از خودِ MySQL (TIMESTAMPDIFF با NOW()) — اختلافِ timezoneِ درایور/DB دقیقه‌ها را جابه‌جا نکند.
export async function listLiveSessions(windowHours: number): Promise<any[]> {
  return (await query(
    `SELECT s.id, s.session_num, s.duration_ms, s.updated_at, s.auto_closed_at,
            c.id AS client_id, c.code AS client_code, t.id AS therapist_id, t.name AS therapist_name,
            CHAR_LENGTH(s.transcript) AS transcript_len,
            TIMESTAMPDIFF(SECOND, s.updated_at, NOW()) AS since_update_s,
            a.seg_count, a.seg_bytes, TIMESTAMPDIFF(SECOND, a.last_at, NOW()) AS last_segment_age_s
       FROM sessions s
       JOIN clients c ON c.id = s.client_id
       JOIN therapists t ON t.id = c.therapist_id
       LEFT JOIN (SELECT session_id, COUNT(*) AS seg_count, COALESCE(SUM(bytes), 0) AS seg_bytes, MAX(created_at) AS last_at
                    FROM session_audio WHERE kind = 'session' GROUP BY session_id) a ON a.session_id = s.id
      WHERE s.status = 'in_progress' AND s.source = 'live' AND s.deleted_at IS NULL AND s.updated_at >= (NOW() - INTERVAL ? HOUR)
      ORDER BY s.updated_at DESC LIMIT 200`, [windowHours])).rows;
}

export async function listFinalTranscriptQueue(f: { therapistId: string | null; stage: string | null }): Promise<any[]> {
  return (await query(
    `SELECT f.session_id, f.stage, f.attempts, f.error_code, f.queued_at, f.finished_at, f.next_attempt_at,
            s.session_num, c.id AS client_id, c.code AS client_code, t.id AS therapist_id, t.name AS therapist_name
       FROM final_transcripts f
       JOIN sessions s ON s.id = f.session_id JOIN clients c ON c.id = f.client_id JOIN therapists t ON t.id = f.therapist_id
      WHERE (f.stage NOT IN ('done','failed','skipped') OR f.queued_at > (NOW() - INTERVAL 14 DAY))
        AND (? IS NULL OR f.therapist_id = ?) AND (? IS NULL OR f.stage = ?)
      ORDER BY f.queued_at DESC LIMIT 100`,
    [f.therapistId, f.therapistId, f.stage, f.stage])).rows;
}

export async function countFinalTranscriptsByStage(): Promise<any[]> {
  return (await query(
    `SELECT stage, COUNT(*) AS n FROM final_transcripts
      WHERE stage NOT IN ('done','failed','skipped') OR queued_at > (NOW() - INTERVAL 14 DAY) GROUP BY stage`)).rows;
}

export async function listBatchQueueSessions(therapistId: string | null): Promise<any[]> {
  return (await query(
    `SELECT s.id, s.session_num, s.batch_status, s.updated_at, c.id AS client_id, c.code AS client_code,
            t.id AS therapist_id, t.name AS therapist_name
       FROM sessions s JOIN clients c ON c.id = s.client_id JOIN therapists t ON t.id = c.therapist_id
      WHERE s.batch_status IN ('queued','processing','failed') AND (? IS NULL OR t.id = ?)
      ORDER BY s.updated_at DESC LIMIT 100`, [therapistId, therapistId])).rows;
}

export async function pingDb(): Promise<number> {
  const t0 = process.hrtime.bigint();
  await query('SELECT 1');
  return Number(process.hrtime.bigint() - t0) / 1e6;
}

export async function dbTotalSizeBytes(): Promise<number> {
  const r = await query(
    `SELECT COALESCE(SUM(DATA_LENGTH + INDEX_LENGTH), 0) AS size_bytes FROM information_schema.tables WHERE table_schema = DATABASE()`);
  return Number(r.rows[0]?.size_bytes) || 0;
}

export async function obsSeverityCounts24h(): Promise<{ error: number; warn: number }> {
  const r = await query(
    `SELECT severity, COUNT(*) AS n FROM obs_events
      WHERE ts >= (NOW() - INTERVAL 24 HOUR) AND severity IN ('error','warn') GROUP BY severity`);
  const out = { error: 0, warn: 0 };
  for (const row of r.rows as Array<{ severity: 'error' | 'warn'; n: number }>) out[row.severity] = Number(row.n);
  return out;
}

export async function countLlmUnavailable24h(): Promise<number> {
  const r = await query(
    `SELECT COUNT(*) AS n FROM notifications WHERE kind = 'llm_unavailable' AND created_at >= (NOW() - INTERVAL 24 HOUR)`);
  return Number(r.rows[0]?.n) || 0;
}

// حذفِ نرمِ جلسه (migration 042): بازگردانی توسطِ ادمین. rowCount
export async function restoreDeletedSession(id: string): Promise<number> {
  return (await query('UPDATE sessions SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW() WHERE id = ? AND deleted_at IS NOT NULL', [id])).rowCount;
}

// ————— دسترسیِ کاملِ ادمین به همه‌یِ داده (2026-10-02: «به همه دیتا دسترسی داشته باشم و هیچی هارد دیلیت نشه») —————
// مرورِ حذف‌شده‌ها (حذفِ نرم، migration 042/043)
export async function listDeletedOverview(): Promise<{ clients: any[]; sessions: any[]; notes: any[] }> {
  const clients = (await query(
    `SELECT c.id, c.code, c.alias, c.deleted_at, c.deleted_by, t.id AS therapist_id, t.name AS therapist_name,
            (SELECT COUNT(*) FROM sessions s WHERE s.client_id = c.id) AS session_count
       FROM clients c JOIN therapists t ON t.id = c.therapist_id WHERE c.deleted_at IS NOT NULL ORDER BY c.deleted_at DESC LIMIT 200`)).rows;
  const sessions = (await query(
    `SELECT s.id, s.session_num, s.status, s.source, s.deleted_at, s.deleted_by, c.id AS client_id, c.code AS client_code, t.id AS therapist_id, t.name AS therapist_name,
            CHAR_LENGTH(COALESCE(s.transcript, '')) AS transcript_len, (SELECT COUNT(*) FROM session_audio a WHERE a.session_id = s.id) AS audio_count
       FROM sessions s JOIN clients c ON c.id = s.client_id JOIN therapists t ON t.id = c.therapist_id WHERE s.deleted_at IS NOT NULL ORDER BY s.deleted_at DESC LIMIT 200`)).rows;
  const notes = (await query(
    `SELECT n.id, n.session_id, n.type, n.deleted_at, n.deleted_by, CHAR_LENGTH(COALESCE(n.text, '')) AS text_len, c.code AS client_code, t.name AS therapist_name
       FROM session_notes n JOIN sessions s ON s.id = n.session_id JOIN clients c ON c.id = s.client_id JOIN therapists t ON t.id = c.therapist_id
      WHERE n.deleted_at IS NOT NULL ORDER BY n.deleted_at DESC LIMIT 200`)).rows;
  return { clients, sessions, notes };
}

export async function restoreDeletedNote(id: string): Promise<number> {
  return (await query('UPDATE session_notes SET deleted_at = NULL, deleted_by = NULL WHERE id = ? AND deleted_at IS NOT NULL', [id])).rowCount;
}

// تاریخچه‌یِ متنِ جلسه (migration 040) — ادمین هر جلسه‌ای را می‌خواند (حتی حذف‌شده)
export async function listTranscriptRevisionsAdmin(sessionId: string): Promise<any[]> {
  return (await query(
    `SELECT id, version, cause, actor IS NOT NULL AS by_user, chars, created_at FROM session_transcript_revisions WHERE session_id = ? ORDER BY id DESC LIMIT 500`, [sessionId])).rows;
}
export async function getTranscriptRevisionAdmin(sessionId: string, id: number): Promise<any> {
  return (await query('SELECT id, version, cause, chars, created_at, text FROM session_transcript_revisions WHERE session_id = ? AND id = ?', [sessionId, id])).rows[0];
}

// تاریخچه‌یِ یادداشت (044)
export async function listNoteRevisionsAdmin(noteId: string): Promise<any[]> {
  return (await query('SELECT id, CHAR_LENGTH(COALESCE(text, \'\')) AS chars, created_at FROM session_note_revisions WHERE note_id = ? ORDER BY id DESC LIMIT 500', [noteId])).rows;
}
export async function getNoteRevisionAdmin(noteId: string, id: number): Promise<any> {
  return (await query('SELECT id, text, created_at FROM session_note_revisions WHERE note_id = ? AND id = ?', [noteId, id])).rows[0];
}

// پروندهٔ درمان: محتوایِ فعلی و نسخه‌هایِ قبلی (044)
export async function getCaseFileAdmin(clientId: string): Promise<any> {
  return (await query('SELECT client_id, content, status, model, content_version, generated_at, updated_at FROM client_case_file WHERE client_id = ?', [clientId])).rows[0];
}
export async function listCaseFileVersionsAdmin(clientId: string): Promise<any[]> {
  return (await query('SELECT id, content_version, status, model, created_at, CHAR_LENGTH(content) AS chars FROM client_case_file_versions WHERE client_id = ? ORDER BY id DESC LIMIT 500', [clientId])).rows;
}
export async function getCaseFileVersionAdmin(clientId: string, id: number): Promise<any> {
  return (await query('SELECT id, content_version, status, model, created_at, content FROM client_case_file_versions WHERE client_id = ? AND id = ?', [clientId, id])).rows[0];
}

// برایِ export (schema v3): همه‌چیز، شاملِ حذف‌شده‌ها و تاریخچه‌ها
export async function listTranscriptRevisionsForExport(therapistId: string): Promise<any[]> {
  return (await query(
    `SELECT r.session_id, r.id, r.version, r.cause, r.created_at, r.text FROM session_transcript_revisions r
       JOIN sessions s ON s.id = r.session_id JOIN clients c ON c.id = s.client_id WHERE c.therapist_id = ? ORDER BY r.session_id, r.id`, [therapistId])).rows;
}
export async function listNoteRevisionsForExport(therapistId: string): Promise<any[]> {
  return (await query(
    `SELECT r.session_id, r.note_id, r.id, r.created_at, r.text FROM session_note_revisions r
       JOIN sessions s ON s.id = r.session_id JOIN clients c ON c.id = s.client_id WHERE c.therapist_id = ? ORDER BY r.note_id, r.id`, [therapistId])).rows;
}
export async function listCaseFilesForExport(therapistId: string): Promise<any[]> {
  return (await query(
    `SELECT f.client_id, f.content, f.status, f.model, f.content_version, f.generated_at FROM client_case_file f JOIN clients c ON c.id = f.client_id WHERE c.therapist_id = ?`, [therapistId])).rows;
}
export async function listCaseFileVersionsForExport(therapistId: string): Promise<any[]> {
  return (await query(
    `SELECT v.client_id, v.id, v.content_version, v.created_at, v.content FROM client_case_file_versions v JOIN clients c ON c.id = v.client_id WHERE c.therapist_id = ? ORDER BY v.client_id, v.id`, [therapistId])).rows;
}
