// SQLِ جلسات و یادداشت‌ها — رشته‌هایِ SQLِ قبلیِ sessions.routes، بدونِ تغییر. مالکیت (clients.therapist_id) همان‌جا
// که بود در خودِ SQL یا با getOwnedSession در route.
import { randomUUID } from 'node:crypto';
import { query, pool } from '../../db/connection.js';
import { isSessionNumConflict, SESSION_NUM_MAX_RETRIES, sessionNumRetryPause } from './sessionNumber.js';
import { snapshotSessionUnit } from './sessionSnapshot.js';

// ⭐ رفعِ M7 (audit 2026-09-24): شماره‌ی جلسه MAX+1 است و UNIQUE(client_id, session_num) دارد. ساختِ هم‌زمانِ دو
// جلسه برایِ یک مراجع (مثلاً شروعِ جلسه‌ی زنده درست هم‌زمان با پایانِ آپلودِ فایلِ صوتیِ همان مراجع، یا دو کلیک)
// قبلاً یکی را با 500 شکست می‌داد. حالا با شماره‌ی تازه دوباره تلاش می‌شود — هیچ جلسه‌ای گم نمی‌شود و شماره‌یِ
// جلسه‌هایِ موجود هرگز عوض نمی‌شود. (بدونِ FOR UPDATE — آپلود مسیرِ جدایِ خودش را با FOR UPDATE دارد.)
async function nextSessionNum(clientId: string): Promise<number> {
  return (await query('SELECT COALESCE(MAX(session_num), 0) + 1 as next FROM sessions WHERE client_id = ?', [clientId])).rows[0].next;
}

// یک تراکنشِ اتمیک: جلسه بدونِ یادداشتش (یا برعکس) نیمه‌کاره ساخته نمی‌شود.
// (نسخه‌ی Postgres یک CTEِ نویسنده بود — MySQL از INSERT درونِ WITH پشتیبانی
// نمی‌کند، پس همان اتمیک‌بودن با تراکنشِ صریح تأمین شده.)
export async function createManualSession(s: {
  sessionId: string; clientId: string; date: string | null; time: string; noteText: string | null;
}): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    const sessionNum = await nextSessionNum(s.clientId);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `INSERT INTO sessions (id, client_id, session_num, date, start_time, consent, status, source)
             VALUES (?, ?, ?, ?, ?, false, 'completed', 'manual')`,
        [s.sessionId, s.clientId, sessionNum, s.date, s.time]
      );
      await snapshotSessionUnit(s.sessionId, conn);
      if (s.noteText !== null) {
        await conn.query(
          `INSERT INTO session_notes (id, session_id, type, text) VALUES (?, ?, 'note_after', ?)`,
          [randomUUID(), s.sessionId, s.noteText]
        );
      }
      await conn.commit();
      break;
    } catch (err) {
      await conn.rollback();
      if (isSessionNumConflict(err) && attempt < SESSION_NUM_MAX_RETRIES) { await sessionNumRetryPause(attempt); continue; }
      throw err;
    } finally {
      conn.release();
    }
  }
}

export async function createLiveSession(s: {
  sessionId: string; clientId: string; date: string | null; time: string; attendees: string | null; preNote: string | null;
}): Promise<void> {
  // (2026-09-29) یادداشتِ متنیِ پیش از جلسه دیگر در ستونِ sessions.pre_note نوشته نمی‌شود — یک ردیفِ
  // session_notes(type='note_before') در همان تراکنش (کنارِ یادداشتِ صوتیِ پیش از جلسه، قابلِ ویرایش در Wrapup،
  // و واردِ corpusِ پرونده). ستونِ pre_note فقط برایِ ردیف‌هایِ قدیمی (2026-09-27..29) خوانده می‌شود.
  for (let attempt = 0; ; attempt++) {
    const sessionNum = await nextSessionNum(s.clientId);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `INSERT INTO sessions (id, client_id, session_num, date, start_time, consent, status, attendees)
           VALUES (?, ?, ?, ?, ?, ?, 'in_progress', ?)`,
        [s.sessionId, s.clientId, sessionNum, s.date, s.time, true, s.attendees]
      );
      await snapshotSessionUnit(s.sessionId, conn);
      if (s.preNote !== null) {
        await conn.query(
          `INSERT INTO session_notes (id, session_id, type, text, wall_clock) VALUES (?, ?, 'note_before', ?, ?)`,
          [randomUUID(), s.sessionId, s.preNote, s.time]
        );
      }
      await conn.commit();
      break;
    } catch (err) {
      await conn.rollback();
      if (isSessionNumConflict(err) && attempt < SESSION_NUM_MAX_RETRIES) { await sessionNumRetryPause(attempt); continue; }
      throw err;
    } finally {
      conn.release();
    }
  }
}

// PATCH /api/notes/:id — متنِ یادداشت‌هایِ پیش از جلسه (تصمیمِ مالک 2026-09-29) و یادداشتِ سریعِ حینِ جلسه (`note_during`، درخواستِ مالک 2026-10-03).
export const EDITABLE_NOTE_TYPES = ['note_before', 'voice_before', 'note_during'] as const;
export async function getOwnedNoteType(id: string, therapistId: string | null): Promise<string | null> {
  const r = await query(
    `SELECT n.type FROM session_notes n
       JOIN sessions s ON n.session_id = s.id
       JOIN clients c ON s.client_id = c.id
       WHERE n.id = ? AND c.therapist_id = ? AND n.deleted_at IS NULL`,
    [id, therapistId]
  );
  return r.rows[0]?.type ?? null;
}
export async function updateNoteText(id: string, text: string): Promise<void> {
  await query('UPDATE session_notes SET text = ? WHERE id = ?', [text, id]);
}

// تاریخچه‌ی متنِ خام (migration 040): متنِ جایگزین‌شده را فقط‌افزودنی نگه می‌دارد. fail-open — شکست هرگز PUT را نمی‌اندازد.
export async function insertTranscriptRevision(r: { sessionId: string; version: number; cause: string; actor: string | null; text: string }): Promise<void> {
  try {
    await query(
      'INSERT INTO session_transcript_revisions (session_id, version, cause, actor, chars, text) VALUES (?, ?, ?, ?, ?, ?)',
      [r.sessionId, r.version, r.cause, r.actor, r.text.length, r.text]
    );
  } catch (e) {
    console.log('[session] transcript revision failed (ignored):', String((e as Error)?.message || e).slice(0, 120));
  }
}

export async function getSessionRow(id: string): Promise<any> {
  return (await query('SELECT * FROM sessions WHERE id = ?', [id])).rows[0];
}

export async function getClientConsentRow(clientId: string): Promise<any> {
  return (await query('SELECT recording_consent_at FROM clients WHERE id = ?', [clientId])).rows[0];
}

export async function getOwnedSessionWithClient(id: string, therapistId: string | null): Promise<any> {
  const sessionResult = await query(
    `SELECT s.*, c.code, c.alias
       FROM sessions s
       JOIN clients c ON c.id = s.client_id
       WHERE s.id = ? AND c.therapist_id = ? AND s.deleted_at IS NULL AND c.deleted_at IS NULL`, [id, therapistId]
  );
  return sessionResult.rows[0];
}

// MySQL از NULLS LAST پشتیبانی نمی‌کند؛ `(offset_ms IS NULL)` در ASC صفر (غیرِnull)
// را قبل از یک (null) می‌گذارد — همان اثرِ NULLS LAST.
export async function listSessionNotes(sessionId: string): Promise<any[]> {
  const notesResult = await query(
    'SELECT * FROM session_notes WHERE session_id = ? AND deleted_at IS NULL ORDER BY (offset_ms IS NULL), offset_ms, created_at',
    [sessionId]
  );
  return notesResult.rows;
}

export async function getTranscriptVersionRow(id: string): Promise<{ transcript_version: number } | undefined> {
  return (await query('SELECT transcript_version FROM sessions WHERE id = ?', [id])).rows[0];
}

// UPDATEِ PUT /api/sessions/:id — updates/values را route ساخته (validation)؛ گاردِ مالکیت و در صورتِ وجود،
// گاردِ اتمیکِ transcript_version در WHEREِ همین UPDATE. خروجی: rowCount.
export async function updateOwnedSession(
  updates: string[], values: unknown[], id: string, therapistId: string | null, versionGuard: number | undefined
): Promise<number> {
  values.push(id);
  values.push(therapistId);
  // گاردِ اتمیکِ واقعی: اگه transcript_versionِ caller داده شده، همون شرط مستقیم توی
  // WHEREِ همین UPDATE می‌آید — نه یک SELECTِ جداگانه‌ی قبلی. دو PUTِ هم‌زمان با نسخه‌ی
  // یکسان دیگر نمی‌توانند هر دو موفق شوند: اولی رَویی که می‌رسد نسخه را +1 می‌کند،
  // دومی چون `transcript_version = ?`ِ قدیمی دیگر با ردیفِ به‌روزشده نمی‌خورَد rowCount=0
  // می‌گیرد (نه overwriteِ بی‌صدا).
  let sql = `UPDATE sessions SET ${updates.join(', ')}
       WHERE id = ? AND client_id IN (SELECT id FROM clients WHERE therapist_id = ? AND deleted_at IS NULL)`;
  if (versionGuard !== undefined) {
    sql += ` AND transcript_version = ?`;
    values.push(versionGuard);
  }
  const update = await query(sql, values);
  return update.rowCount;
}

export async function getOwnedTranscriptVersionRow(id: string, therapistId: string | null): Promise<{ transcript_version: number } | undefined> {
  const recheck = await query(
    'SELECT transcript_version FROM sessions WHERE id = ? AND client_id IN (SELECT id FROM clients WHERE therapist_id = ? AND deleted_at IS NULL)',
    [id, therapistId]
  );
  return recheck.rows[0];
}

// rowCount. ⭐ (2026-10-02، تصمیمِ مالک) حذفِ جلسه توسطِ تراپیست «حذفِ نرم» است: deleted_at/deleted_by (migration 042)؛ متن، صدا،
// یادداشت‌ها و علائم برایِ ادمین می‌مانند و قابلِ بازگردانی‌اند. status دست نمی‌خورد (بازگردانی دقیقاً همان را برمی‌گرداند)؛ جلسه‌یِ باز در
// پایشِ زنده و بستنِ خودکار نمی‌آید (listLiveSessions/autoClose deleted_at IS NULL).
export async function deleteOwnedSession(id: string, therapistId: string | null): Promise<number> {
  const del = await query(
    `UPDATE sessions SET deleted_at = NOW(), deleted_by = ?, updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL AND client_id IN (SELECT id FROM clients WHERE therapist_id = ? AND deleted_at IS NULL)`,
    [therapistId, id, therapistId]
  );
  return del.rowCount;
}

export async function restoreOwnedSession(id: string, therapistId: string | null): Promise<number> {
  const r = await query(
    `UPDATE sessions SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW()
       WHERE id = ? AND deleted_at IS NOT NULL AND client_id IN (SELECT id FROM clients WHERE therapist_id = ? AND deleted_at IS NULL)`,
    [id, therapistId]
  );
  return r.rowCount;
}

export async function listDeletedSessionsOfClient(clientId: string): Promise<any[]> {
  return (await query(
    `SELECT id, session_num, date, start_time, status, source, deleted_at, CHAR_LENGTH(COALESCE(transcript, '')) AS transcript_len
       FROM sessions WHERE client_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 100`, [clientId])).rows;
}

// rowCount — CAS رویِ transcript_version
export async function appendTranscriptTail(id: string, tail: string, baseVersion: number): Promise<number> {
  const u = await query(
    `UPDATE sessions SET transcript = CONCAT(COALESCE(transcript, ''), ?), transcript_version = transcript_version + 1, updated_at = NOW()
        WHERE id = ? AND transcript_version = ?`,
    [tail, id, baseVersion]
  );
  return u.rowCount;
}

export async function insertNote(n: {
  id: string; sessionId: string; type: string; text: string | null; signType: string | null; offsetMs: number | null; wallClock: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO session_notes (id, session_id, type, text, sign_type, offset_ms, wall_clock)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [n.id, n.sessionId, n.type, n.text, n.signType, n.offsetMs, n.wallClock]
  );
}

export async function getNoteRow(id: string): Promise<any> {
  return (await query('SELECT * FROM session_notes WHERE id = ?', [id])).rows[0];
}

// MySQL از DELETE ... USING ... RETURNING پشتیبانی نمی‌کند؛ چکِ مالکیت با SELECT
// جدا انجام می‌شود (race در این اپِ تک‌پروسه‌ای — LAW-013 — عملاً بی‌اثر است).
export async function isNoteOwned(id: string, therapistId: string | null): Promise<boolean> {
  const owned = await query(
    `SELECT n.id FROM session_notes n
       JOIN sessions s ON n.session_id = s.id
       JOIN clients c ON s.client_id = c.id
       WHERE n.id = ? AND c.therapist_id = ? AND n.deleted_at IS NULL`,
    [id, therapistId]
  );
  return owned.rows.length > 0;
}

// ⭐ حذفِ نرم (migration 043)؛ ادمین یادداشتِ حذف‌شده را می‌بیند.
export async function deleteNote(id: string, by: string | null = null): Promise<void> {
  await query('UPDATE session_notes SET deleted_at = NOW(), deleted_by = ? WHERE id = ? AND deleted_at IS NULL', [by, id]);
}

// ——— تاریخچه‌ی متن: خواندن (F8، 2026-10-02) ———
export interface TranscriptRevisionMeta { id: number; version: number; cause: string; actor_is_user: boolean; chars: number; created_at: string }
export async function listTranscriptRevisions(sessionId: string): Promise<TranscriptRevisionMeta[]> {
  const r = await query(
    'SELECT id, version, cause, actor IS NOT NULL AS by_user, chars, created_at FROM session_transcript_revisions WHERE session_id = ? ORDER BY id DESC LIMIT 200',
    [sessionId]);
  return (r.rows as any[]).map((x) => ({
    id: Number(x.id), version: Number(x.version), cause: String(x.cause), actor_is_user: !!Number(x.by_user), chars: Number(x.chars || 0),
    created_at: new Date(x.created_at).toISOString(),
  }));
}
export async function getTranscriptRevision(sessionId: string, id: number): Promise<(TranscriptRevisionMeta & { text: string }) | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const r = await query(
    'SELECT id, version, cause, actor IS NOT NULL AS by_user, chars, created_at, text FROM session_transcript_revisions WHERE session_id = ? AND id = ?',
    [sessionId, id]);
  const x = (r.rows as any[])[0];
  return x ? {
    id: Number(x.id), version: Number(x.version), cause: String(x.cause), actor_is_user: !!Number(x.by_user), chars: Number(x.chars || 0),
    created_at: new Date(x.created_at).toISOString(), text: String(x.text || ''),
  } : null;
}

// ——— تاریخچه‌یِ ویرایشِ یادداشت (migration 044؛ «همه‌چیز قابلِ بازیابی باشد») ———
export async function insertNoteRevision(noteId: string, sessionId: string, text: string | null, actor: string | null): Promise<void> {
  try {
    await query('INSERT INTO session_note_revisions (note_id, session_id, text, actor) VALUES (?, ?, ?, ?)', [noteId, sessionId, text, actor]);
  } catch (e) {
    console.log('[note] revision failed (ignored):', String((e as Error)?.message || e).slice(0, 120));
  }
}
export async function listNoteRevisions(noteId: string): Promise<Array<{ id: number; chars: number; created_at: string }>> {
  const r = await query('SELECT id, CHAR_LENGTH(COALESCE(text, \'\')) AS chars, created_at FROM session_note_revisions WHERE note_id = ? ORDER BY id DESC LIMIT 100', [noteId]);
  return (r.rows as any[]).map((x) => ({ id: Number(x.id), chars: Number(x.chars || 0), created_at: new Date(x.created_at).toISOString() }));
}
export async function getNoteRevisionText(noteId: string, id: number): Promise<string | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const r = await query('SELECT text FROM session_note_revisions WHERE note_id = ? AND id = ?', [noteId, id]);
  const x = (r.rows as any[])[0];
  return x ? String(x.text ?? '') : null;
}
