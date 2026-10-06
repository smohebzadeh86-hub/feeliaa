// «کیفیت به عدد» برایِ هر گذرِ رکوردِ جلسه (core-data-plan-2026-10-03، قدمِ ۴) — نه فقط آپلود.
// پس از ذخیره‌ی هر گذر (realtime/async/upload): بازه‌هایِ صدادار از صدایِ کاملِ آرشیو (ffmpeg، همان FileQualityMeter) + توکن‌هایِ
// همان گذر ⇒ computeTranscriptMetrics ⇒ session_transcript_tokens.metrics. فقط عدد و پرچم (LAW-001). fail-open و سریالی
// (یک ffmpeg در هر لحظه؛ runtimeِ تک‌پروسه‌ای، LAW-013).
//
// هم‌ترازیِ زمان: توکن‌هایِ realtime «زمانِ صدایِ ضبط‌شده» (بدونِ توقفِ دستی) دارند و فایلِ کامل هم الحاقِ سگمنت‌هایِ ضبط‌شده است ⇒
// تقریباً هم‌تراز. وقتی هم‌ترازی معلوم نیست (چند run در realtime، یا صدایِ ناقص/ناخوانا) پوشش حساب نمی‌شود (null)، نه پرچمِ غلط.
import { computeTranscriptMetrics, type TranscriptMetrics } from './transcriptMetrics.js';
import { measureAudioQuality } from './quality.js';
import { getFullSessionAudio, lowConfidenceRatio } from '../transcription/index.js';
import { treatmentUnits } from '../treatment-unit/index.js';
import { loadCurrentRecordForMetrics, saveRecordMetrics, type RecordForMetrics } from '../session-record/index.js';
import { logEvent } from '../../obs/eventLog.js';

export interface RecordMetricsDeps {
  load: (sessionId: string) => Promise<RecordForMetrics | null>;
  speechSpans: (sessionId: string) => Promise<Array<[number, number]> | null>;
  expectedSpeakers: (sessionId: string) => Promise<number | null>;
  save: (recordId: number, m: TranscriptMetrics) => Promise<void>;
}

// realtimeِ چند-run یا نسل‌دار (reconnect) ⇒ شماره‌ی گوینده‌ها یکدست نیست ⇒ مقایسه با حاضرین بی‌معناست.
export function alignmentFor(rec: Pick<RecordForMetrics, 'source' | 'meta'>): { coverage: boolean; speakers: boolean } {
  if (rec.source !== 'realtime') return { coverage: true, speakers: true };
  const runs = Number((rec.meta as any)?.runs ?? 1);
  const complete = (rec.meta as any)?.complete === true;
  return { coverage: runs === 1, speakers: complete };
}

export async function measureRecord(sessionId: string, deps: RecordMetricsDeps): Promise<TranscriptMetrics | null> {
  const rec = await deps.load(sessionId);
  if (!rec || !rec.tokens.length) return null;
  const al = alignmentFor(rec);
  const spans = al.coverage ? await deps.speechSpans(sessionId).catch(() => null) : null;
  const expected = al.speakers ? await deps.expectedSpeakers(sessionId).catch(() => null) : null;
  const lastEnd = rec.tokens.reduce((m, t) => (Number.isFinite(t.end_ms) && (t.end_ms as number) > m ? (t.end_ms as number) : m), 0);
  const m = computeTranscriptMetrics({
    tokens: rec.tokens.map((t) => ({ text: t.text, speaker: t.speaker ?? undefined, start_ms: t.start_ms, end_ms: t.end_ms, confidence: t.confidence })),
    speechSpans: spans, durationMs: lastEnd || null,
    lowConfRatio: lowConfidenceRatio(rec.tokens.map((t) => ({ text: t.text, confidence: t.confidence }))),
    expectedSpeakers: expected,
  });
  await deps.save(rec.recordId, m);
  return m;
}

const realDeps: RecordMetricsDeps = {
  load: loadCurrentRecordForMetrics,
  speechSpans: async (sessionId) => {
    const full = await getFullSessionAudio(sessionId);
    if (!full.ok || !full.complete) return null;
    const q = await measureAudioQuality(full.path, null);
    return q?.speech_spans ?? null;
  },
  expectedSpeakers: async (sessionId) => {
    const roster = await treatmentUnits.sessionSpeakerRoster(sessionId);
    return roster && roster.speakers.length ? roster.speakers.length + 1 : null;
  },
  save: saveRecordMetrics,
};

// صفِ سریال: هر جلسه یک بار در صف؛ درخواستِ تکراری تا شروعِ اجرا ادغام می‌شود.
const queue: string[] = [];
let running = false;
export function enqueueRecordMetrics(sessionId: string): void {
  if (!queue.includes(sessionId)) queue.push(sessionId);
  if (!running) void drain();
}
async function drain(): Promise<void> {
  running = true;
  try {
    while (queue.length) {
      const sid = queue.shift()!;
      try {
        const m = await measureRecord(sid, realDeps);
        // speakers_minor فقط اطلاعی است (diagnosis.ts: level 'ok') ⇒ جلسه را «ناسالم» نشان نمی‌دهد.
        if (m) logEvent({ event: 'session_record.metrics', sessionId: sid, source: 'server', detail: { count: m.words, ok: m.flags.every((f) => f === 'speakers_minor'), reason: m.flags.join(',').slice(0, 64) || undefined } });
      } catch (e) {
        console.log('[record-metrics] failed (ignored):', String((e as Error)?.message || e).slice(0, 120));
      }
    }
  } finally {
    running = false;
  }
}
