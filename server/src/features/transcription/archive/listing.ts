// خواندنِ ردیف‌هایِ آرشیو (به ترتیبِ ضبط) و وضعیتِ مشتق‌شده‌ی صدا/رونویسی.
import { query } from '../../../db/connection.js';
import { runStartMs } from '../batch/queueFiles.js';
import type { SessionAudioRow } from './store.js';
import type { SkipRow } from './skips.js';

// ⭐ (A2، 2026-09-26) ترتیبِ ضبط، نه ترتیبِ رسیدن: (زمانِ شروعِ run، client_seq) — seqِ سرور MAX+1ِ لحظه‌ی رسیدن
// است و سگمنتِ دیررسیده (صفِ آفلاین) را بعد از سگمنت‌هایِ تازه‌تر می‌گذاشت. ردیفِ بدونِ client_seq ⇒ seq.
export function sortByRecordingOrder<T extends { run_id: string; seq: number; client_seq?: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    (runStartMs(a.run_id) - runStartMs(b.run_id)) ||
    ((a.client_seq ?? a.seq) - (b.client_seq ?? b.seq)) ||
    (a.seq - b.seq));
}

export async function listSessionAudio(sessionId: string): Promise<SessionAudioRow[]> {
  const r = await query(
    'SELECT * FROM session_audio WHERE session_id = ? ORDER BY seq',
    [sessionId]
  );
  return sortByRecordingOrder(r.rows as SessionAudioRow[]);
}

export async function getSessionAudioRow(id: string): Promise<SessionAudioRow | null> {
  const r = await query('SELECT * FROM session_audio WHERE id = ?', [id]);
  return r.rows[0] || null;
}

// ————————————————— بخشِ رصد/حسابرسی (فازِ ۱، 2026-09-22) —————————————————
// منطقِ audio_status/transcript_status/pendingCount قبلاً inline در
// GET /api/admin/sessions/:id/audio بود؛ endpointِ جدیدِ GET
// /api/admin/sessions/recent به همان منطق نیاز داشت — به‌جایِ دوباره‌نویسی، این‌جا
// export می‌شود و از هر دو مسیر صدا زده می‌شود.
export interface DerivedSessionStatus {
  audioStatus: 'none' | 'syncing' | 'incomplete' | 'complete';
  audioMissingSegments: number[];
  transcriptStatus: 'complete' | 'pending' | 'failed' | 'none';
  pendingCount: number;
}

export function deriveSessionStatus(
  sessionAudioRows: SessionAudioRow[],
  pendingCount: number,
  session: { batch_status: string | null; realtime_reliable: boolean | null; stt_mode: string | null },
  skips: SkipRow[] = []
): DerivedSessionStatus {
  const onlySession = sessionAudioRows.filter((r) => r.kind === 'session');
  const { complete: seqComplete, missing: missingSeq } = checkSeqContiguous(onlySession, skips);
  const audioStatus: DerivedSessionStatus['audioStatus'] =
    onlySession.length === 0 ? 'none'
      : pendingCount > 0 ? 'syncing'
        : !seqComplete ? 'incomplete'
          : 'complete';
  const transcriptStatus: DerivedSessionStatus['transcriptStatus'] =
    session.batch_status === 'failed' ? 'failed'
      : session.batch_status === 'queued' || session.batch_status === 'processing' ? 'pending'
        : session.stt_mode === 'realtime' && session.realtime_reliable ? 'complete'
          : session.batch_status === 'done' ? 'complete'
            : session.stt_mode ? 'pending' : 'none';
  return { audioStatus, audioMissingSegments: missingSeq, transcriptStatus, pendingCount };
}

// ⭐ (2026-10-01، ممیزیِ Core) باگِ قبلی: seq رویِ سرور MAX+1 است ⇒ همیشه پیوسته ⇒ این چک هرگز «ناقص» نمی‌داد.
// حالا شماره‌ی خودِ کلاینت (client_seq، migration 027) در هر run سنجیده می‌شود: شماره‌هایی که نه سگمنتشان رسیده و نه
// کلاینت «خالی بود» گزارش کرده (session_audio_skips، migration 039) = سگمنتِ گم‌شده (IndexedDBِ پر/خراب، تبِ بسته‌شده پیش
// از sync). ردیفِ بدونِ client_seq (قدیمی/آپلودی) بررسی نمی‌شود. missing = شماره‌هایِ client_seq (ممکن است بینِ runها تکرار شود).
// فقط چک می‌کند؛ چیزی نمی‌سازد/حذف نمی‌کند — fail-open برایِ خودِ آرشیو.
export function checkSeqContiguous(rows: SessionAudioRow[], skips: SkipRow[] = []): { complete: boolean; missing: number[] } {
  const byRun = new Map<string, { have: Set<number>; max: number }>();
  for (const r of rows) {
    if (r.client_seq === null || r.client_seq === undefined) continue;
    const g = byRun.get(r.run_id) || { have: new Set<number>(), max: -1 };
    g.have.add(r.client_seq);
    if (r.client_seq > g.max) g.max = r.client_seq;
    byRun.set(r.run_id, g);
  }
  for (const k of skips) byRun.get(k.run_id)?.have.add(k.client_seq);
  const missing: number[] = [];
  for (const g of byRun.values()) {
    for (let i = 0; i <= g.max; i++) if (!g.have.has(i)) missing.push(i);
  }
  return { complete: missing.length === 0, missing };
}
