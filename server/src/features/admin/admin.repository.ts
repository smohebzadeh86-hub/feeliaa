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

export async function listTherapistsWithStats(search: string | null): Promise<any[]> {
  const result = await query(`
      SELECT
        t.id, t.phone, t.email, t.name, t.specialty, t.is_admin, t.active, t.created_at, t.final_transcript_enabled,
        COUNT(DISTINCT c.id) as client_count,
        COUNT(DISTINCT s.id) as session_count,
        MAX(s.created_at) as last_session_at
      FROM therapists t
      LEFT JOIN clients c ON c.therapist_id = t.id
      LEFT JOIN sessions s ON s.client_id = c.id
      WHERE ? IS NULL OR t.phone LIKE CONCAT('%', ?, '%') OR t.name LIKE CONCAT('%', ?, '%') OR t.email LIKE CONCAT('%', ?, '%')
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `, [search, search, search, search]);
  return result.rows;
}

export async function getTherapistBrief(id: string): Promise<any> {
  return (await query('SELECT id, phone, name, specialty FROM therapists WHERE id = ?', [id])).rows[0];
}

export async function listClientsOfTherapistWithStats(therapistId: string): Promise<any[]> {
  const clients = await query(`
      SELECT c.id, c.code, c.alias, c.status, c.status_reason, c.category, c.gender, c.created_at,
        COUNT(s.id) as session_count,
        MAX(s.date) as last_session_date
      FROM clients c
      LEFT JOIN sessions s ON s.client_id = c.id
      WHERE c.therapist_id = ?
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `, [therapistId]);
  return clients.rows;
}

export async function getClientBrief(id: string): Promise<any> {
  return (await query('SELECT id, code, alias FROM clients WHERE id = ?', [id])).rows[0];
}

export async function listSessionsOfClient(clientId: string): Promise<any[]> {
  const sessions = await query(`
      SELECT s.id, s.session_num, s.date, s.start_time, s.duration_ms, s.status, s.source, s.consent,
        s.updated_at, s.batch_status, s.auto_closed_at, s.realtime_reliable, CHAR_LENGTH(COALESCE(s.transcript, '')) as transcript_len,
        COUNT(a.id) as audio_count
      FROM sessions s
      LEFT JOIN session_audio a ON a.session_id = s.id
      WHERE s.client_id = ?
      GROUP BY s.id
      ORDER BY s.session_num DESC
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

export async function deleteTherapist(id: string): Promise<void> {
  await query('DELETE FROM therapists WHERE id = ?', [id]);
}

export async function getClientCodeRow(id: string): Promise<any> {
  return (await query('SELECT code FROM clients WHERE id = ?', [id])).rows[0];
}

export async function listSessionIdsOfClient(clientId: string): Promise<string[]> {
  const sessionIdsResult = await query('SELECT id FROM sessions WHERE client_id = ?', [clientId]);
  return sessionIdsResult.rows.map((r: { id: string }) => r.id);
}

export async function deleteClient(id: string): Promise<void> {
  await query('DELETE FROM clients WHERE id = ?', [id]);
}

// ————— جلسات —————
export async function sessionExists(id: string): Promise<boolean> {
  return (await query('SELECT id FROM sessions WHERE id = ?', [id])).rows.length > 0;
}

export async function getSessionWithTranscript(id: string): Promise<any> {
  const session = await query(`
      SELECT s.id, s.client_id, s.session_num, s.date, s.start_time, s.duration_ms,
        s.status, s.source, s.consent, s.transcript, s.created_at,
        s.updated_at, s.transcript_version, s.realtime_reliable, s.stt_mode, s.batch_status, s.auto_closed_at
      FROM sessions s WHERE s.id = ?
    `, [id]);
  return session.rows[0];
}

export async function listSessionNotesForAdmin(sessionId: string): Promise<any[]> {
  const notes = await query(`
      SELECT id, type, text, sign_type, offset_ms, wall_clock, created_at
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
export async function listRecentSessions(conditions: string[], params: unknown[], limit: number, offset: number): Promise<any[]> {
  const rows = await query(
    `SELECT s.id, s.session_num, s.date, s.start_time, s.status, s.source,
              s.created_at, s.updated_at, s.batch_status, s.realtime_reliable, s.stt_mode,
              c.id AS client_id, c.code AS client_code,
              t.id AS therapist_id, t.name AS therapist_name,
              CHAR_LENGTH(s.transcript) AS transcript_len,
              (SELECT COUNT(*) FROM session_audio a WHERE a.session_id = s.id) AS audio_count,
              (SELECT COALESCE(SUM(a.bytes), 0) FROM session_audio a WHERE a.session_id = s.id) AS audio_bytes,
              (SELECT COALESCE(SUM(a.duration_ms), 0) FROM session_audio a WHERE a.session_id = s.id) AS audio_duration_ms,
              (SELECT COUNT(*) FROM session_notes n WHERE n.session_id = s.id) AS note_count
       FROM sessions s
       JOIN clients c ON c.id = s.client_id
       JOIN therapists t ON t.id = c.therapist_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.updated_at DESC
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
  return (await query(`SELECT session_id, seq FROM session_audio WHERE kind = 'session' AND session_id IN (${ids.map(() => '?').join(',')})`, ids)).rows;
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

export async function deleteSessionAudioRows(sessionId: string): Promise<void> {
  await query('DELETE FROM session_audio WHERE session_id = ?', [sessionId]);
}

// f: فیلترهایِ audioFilters رویِ x.ts
export async function listVoiceNoteSessionsPage(f: { sql: string; params: unknown[] }, limit: number, offset: number): Promise<any[]> {
  const r = await query(
    `SELECT x.session_id, MAX(x.ts) AS last_at FROM (
          SELECT n.session_id, n.created_at AS ts FROM session_notes n WHERE n.type = 'voice'
          UNION ALL SELECT a.session_id, a.created_at AS ts FROM session_audio a WHERE a.kind = 'note'
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
    `SELECT id, session_id, wall_clock, created_at, CHAR_LENGTH(COALESCE(text, '')) AS text_len FROM session_notes
        WHERE type = 'voice' AND session_id IN (${ph}) ORDER BY created_at`, ids);
  return notes.rows;
}

export async function listNoteAudio(ph: string, ids: string[]): Promise<any[]> {
  const audio = await query(
    `SELECT id, session_id, bytes, duration_ms, created_at FROM session_audio WHERE kind = 'note' AND session_id IN (${ph}) ORDER BY created_at`, ids);
  return audio.rows;
}

export async function getVoiceNoteText(noteId: string): Promise<any> {
  return (await query(`SELECT id, session_id, text FROM session_notes WHERE id = ? AND type = 'voice'`, [noteId])).rows[0];
}

// ————— export —————
export async function getTherapistForExport(therapistId: string): Promise<any> {
  return (await query('SELECT id, phone, email, name, specialty, created_at FROM therapists WHERE id = ?', [therapistId])).rows[0];
}

export async function listClientsForExport(therapistId: string): Promise<any[]> {
  const clients = await query(
    'SELECT id, code, alias, status, status_reason, category, gender, created_at FROM clients WHERE therapist_id = ? ORDER BY created_at',
    [therapistId]
  );
  return clients.rows;
}

export async function listSessionsForExport(therapistId: string): Promise<any[]> {
  const sessions = await query(`
    SELECT s.id, s.client_id, s.session_num, s.date, s.start_time, s.duration_ms,
           s.status, s.source, s.consent, s.transcript, s.created_at
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
    SELECT n.id, n.session_id, n.type, n.text, n.sign_type, n.offset_ms, n.wall_clock, n.created_at
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
