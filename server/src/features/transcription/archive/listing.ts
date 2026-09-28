// خواندنِ ردیف‌هایِ آرشیو (به ترتیبِ ضبط) و وضعیتِ مشتق‌شده‌ی صدا/رونویسی.
import { query } from '../../../db/connection.js';
import { runStartMs } from '../batch/queueFiles.js';
import type { SessionAudioRow } from './store.js';

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
  session: { batch_status: string | null; realtime_reliable: boolean | null; stt_mode: string | null }
): DerivedSessionStatus {
  const onlySession = sessionAudioRows.filter((r) => r.kind === 'session');
  const { complete: seqComplete, missing: missingSeq } = checkSeqContiguous(onlySession);
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

// بخشِ ۱۱ی audit «zero-loss recording» (2026-09-22): قبل از این، فایلِ نهایی/دانلود صرفاً
// concatِ ffmpeg بود — هیچ‌جا چک نمی‌شد که seqِ سگمنت‌هایِ kind='session' واقعاً پیوسته‌اند.
// اگر سگمنتی هیچ‌وقت آپلود نشود (کاربر تبِ مرورگر را قبل از sync کاملاً بست)، فایلِ نهایی
// بدونِ خطا ولی با gap ساخته می‌شد و هیچ‌جا علامت‌گذاری نمی‌شد. این تابع فقط چک می‌کند،
// چیزی نمی‌سازد/حذف نمی‌کند — fail-open برایِ خودِ آرشیو دست‌نخورده می‌ماند.
export function checkSeqContiguous(rows: SessionAudioRow[]): { complete: boolean; missing: number[] } {
  if (!rows.length) return { complete: true, missing: [] };
  const seqs = rows.map((r) => r.seq).sort((a, b) => a - b);
  const missing: number[] = [];
  for (let i = 0; i <= seqs[seqs.length - 1]; i++) {
    if (!seqs.includes(i)) missing.push(i);
  }
  return { complete: missing.length === 0, missing };
}
