// فقط از sessions.transcript و session_notes.text همان client_id می‌خواند — هیچ منبعِ
// دیگری وارد نمی‌شود (اصلِ مالک: «AI فقط بر اساسِ داده‌های مجاز و ثبت‌شده کار کنه»).
//
// عمداً بدونِ فیلترِ consent: آن فیلد فقط «رضایتِ ضبطِ صوتِ زنده»ست (LAW-009،
// server/src/http/sessions.ts)، نه «مجاز بودنِ استفاده از متن». جلسه‌ی دستی همیشه
// consent=false دارد ولی کاملاً معتبر است (تراپیست خودش تایپ کرده). معیارِ «مجاز و
// ثبت‌شده» همین است که داده از دو جدولِ رسمی/از طریقِ APIِ موجود ذخیره شده باشد.
import { query } from '../../../db/connection.js';
import { canonicalTextForSession } from '../../session-record/index.js';

export interface CorpusNote {
  type: string;
  text: string | null;
  createdAt: string;
}

export interface CorpusSession {
  id: string;
  sessionNum: number;
  date: string | null;
  source: string;
  transcript: string | null;
  notes: CorpusNote[];
}

export interface ClientCorpus {
  clientId: string;
  sessions: CorpusSession[];
  latestSessionId: string | null;
  corpusSignature: string;
}

export async function aggregateClientCorpus(clientId: string): Promise<ClientCorpus> {
  // فقط جلساتِ پایان‌یافته/بازیابی‌شده — جلسه‌ی در جریان هنوز متنِ نهایی ندارد.
  const sessionsResult = await query(
    `SELECT id, session_num, date, source, transcript, pre_note
     FROM sessions
     WHERE client_id = ? AND status IN ('completed', 'recovered') AND deleted_at IS NULL
     ORDER BY session_num ASC`,
    [clientId]
  );

  const sessions: CorpusSession[] = [];
  for (const row of sessionsResult.rows) {
    const notesResult = await query(
      `SELECT type, text, created_at FROM session_notes
       WHERE session_id = ? AND text IS NOT NULL AND text <> '' AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [row.id]
    );
    const notes: CorpusNote[] = notesResult.rows.map((n: any) => ({ type: n.type, text: n.text, createdAt: n.created_at }));
    // ستونِ قدیمیِ sessions.pre_note (2026-09-27..29، پیش از انتقال به session_notes) — تصمیمِ مالک: واردِ پرونده شود.
    if (typeof row.pre_note === 'string' && row.pre_note.trim()) {
      notes.unshift({ type: 'note_before', text: row.pre_note.trim(), createdAt: '' });
    }
    sessions.push({
      id: row.id,
      sessionNum: row.session_num,
      date: row.date,
      source: row.source,
      // رکوردِ canonical (فاز ۳، 2026-10-01): گذرِ کاملِ صدا با نقشِ تأییدشده‌یِ گوینده‌ها — فقط اگر پس از آن کسی متن را ویرایش نکرده.
      // وگرنه (یا بدونِ رکورد) همان sessions.transcript مثلِ قبل.
      transcript: (await canonicalTextForSession(row.id))?.text ?? row.transcript,
      notes,
    });
  }

  // امضایِ سبک برایِ تشخیصِ «داده‌ی جدید» بدونِ نیاز به مقایسه‌ی کاملِ متن‌ها — فراتر از
  // latestSessionId چون یادداشتِ جدید روی همان آخرین جلسه یا ویرایشِ transcript آن را
  // عوض نمی‌کند (sessions.updated_at با هر ویرایش/تغییرِ status خودکار به‌روز می‌شود).
  const signatureResult = await query(
    `SELECT COUNT(DISTINCT s.id) session_count, MAX(s.updated_at) latest_session_update,
            COUNT(n.id) note_count, MAX(n.created_at) latest_note_created
     FROM sessions s
     LEFT JOIN session_notes n ON n.session_id = s.id AND n.text IS NOT NULL AND n.text <> '' AND n.deleted_at IS NULL
     WHERE s.client_id = ? AND s.status IN ('completed','recovered') AND s.deleted_at IS NULL`,
    [clientId]
  );
  const sig = signatureResult.rows[0] || {};
  const latestSessionId = sessions.length ? sessions[sessions.length - 1].id : null;
  const corpusSignature = [
    sig.session_count ?? 0,
    latestSessionId,
    sig.note_count ?? 0,
    sig.latest_session_update ?? '',
    sig.latest_note_created ?? '',
  ].join(':');

  return {
    clientId,
    sessions,
    latestSessionId,
    corpusSignature,
  };
}
