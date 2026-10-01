// «کیفیت به عدد» برایِ جلسه‌ی آپلودی (Session Data Engine، فاز Q-U، 2026-10-01).
// توکن‌هایِ async ِSoniox (زمان/گوینده/اطمینان) قبلاً فقط به متن تبدیل و دور ریخته می‌شدند؛ اینجا پیش از دور ریختن
// چند عدد از آن‌ها گرفته می‌شود — بدونِ هیچ تماسِ اضافه با Soniox. خالص (بدونِ DB/شبکه/فایل) تا harness تستش کند.
// LAW-001: خروجی فقط عدد و نامِ پرچم است؛ هیچ متن/واژه‌ای برنمی‌گردد.
//
// پوششِ متن = سهمِ زمانِ «صدادار» (VADِ انرژی، quality.speechSpans) که توکنی نزدیکش هست. VAD گفتار را از صدایِ غیرِگفتاری
// (خنده، تق، صندلی) جدا نمی‌کند ⇒ پوشش هرگز دقیقاً ۱ نیست؛ پرچم‌ها فقط رویِ حفره‌هایِ بلند و افتِ واضح‌اند.
// آستانه‌ها با دادهٔ ساختگی تنظیم شده‌اند (verification/2026-10-01-upload-transcript-metrics.md) و با دادهٔ واقعی بازبینی می‌شوند.

export interface TimedToken {
  text: string;
  speaker?: number | string;
  start_ms?: number;
  end_ms?: number;
  confidence?: number;
}

export type MetricsFlag =
  | 'low_coverage'      // بخشِ قابلِ‌توجهی از صدایِ گفتاری متن ندارد
  | 'uncovered_gap'     // دست‌کم یک تکه‌ی صدادارِ بلندِ بدونِ متن (وسطِ جلسه)
  | 'head_gap'          // ابتدایِ صدا متن ندارد
  | 'tail_gap'          // انتهایِ صدا متن ندارد
  | 'speakers_merged'   // گوینده‌هایِ پیدا‌شده کمتر از حاضرینِ جلسه
  | 'speakers_extra'    // گوینده‌هایِ پیدا‌شده بیشتر از حاضرینِ جلسه
  | 'fragmented_turns'; // نوبت‌هایِ خیلی کوتاهِ زیاد (جابه‌جاییِ گوینده)

export interface TranscriptMetrics {
  v: 1;
  duration_ms: number | null;
  // پوشش — null وقتی بازه‌هایِ صدادار نامعلوم‌اند (فایلِ قدیمی/نویزِ غالب) یا توکن‌ها زمان ندارند.
  speech_ms: number | null;
  covered_speech_ms: number | null;
  coverage: number | null;
  uncovered_speech_ms: number | null;
  longest_uncovered_ms: number | null;
  uncovered_gaps: number | null;
  head_gap_ms: number | null;
  tail_gap_ms: number | null;
  // متن
  words: number;
  words_per_min: number | null;
  low_conf_ratio: number | null;
  uncertain_words: number;
  // گوینده
  speakers_found: number;
  speakers_raw: number;
  speakers_expected: number | null;
  speaker_shares: number[];
  turns: number;
  short_turn_ratio: number | null;
  flags: MetricsFlag[];
}

export const METRICS = {
  // هر توکن این مقدار قبل و بعدش را «پوشش» می‌دهد (مرزِ VAD و زمانِ توکن دقیقاً یکی نیستند).
  TOKEN_PAD_MS: 600,
  // مکثِ بینِ دو توکن کوتاه‌تر از این ⇒ پوشش‌داده‌شده (مکثِ طبیعیِ گفتار).
  TOKEN_BRIDGE_MS: 2000,
  // توکنِ بدونِ end_ms: طولِ فرضی.
  TOKEN_DEFAULT_MS: 400,
  // تکه‌هایِ بدونِ‌متن که کمتر از این از هم فاصله دارند یک حفره حساب می‌شوند.
  GAP_MERGE_MS: 3000,
  GAP_FLAG_MS: 15_000,
  EDGE_FLAG_MS: 15_000,
  LOW_COVERAGE: 0.85,
  // زیرِ این مقدار صدایِ گفتاری، پوشش قضاوت نمی‌شود.
  MIN_SPEECH_MS: 60_000,
  // گوینده‌ای با سهمِ کمتر از این (از واژه‌ها) «پیدا‌شده» حساب نمی‌شود (برچسبِ تصادفیِ Soniox).
  MIN_SPEAKER_SHARE: 0.03,
  SHORT_TURN_WORDS: 3,
  MIN_TURNS_FOR_RATIO: 10,
  FRAGMENTED_RATIO: 0.4,
  UNCERTAIN_CONFIDENCE: 0.5,
} as const;

const HAS_CONTENT = /[\p{L}\p{N}]/u;
type Span = [number, number];

function mergeSpans(spans: Span[], bridge: number): Span[] {
  const sorted = spans.filter((s) => s[1] > s[0]).sort((a, b) => a[0] - b[0]);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s[0] - last[1] <= bridge) last[1] = Math.max(last[1], s[1]);
    else out.push([s[0], s[1]]);
  }
  return out;
}

// speech منهای covered (هر دو مرتب و بدونِ هم‌پوشانی).
function subtract(speech: Span[], covered: Span[]): Span[] {
  const out: Span[] = [];
  let j = 0;
  for (const [s0, s1] of speech) {
    let cur = s0;
    while (j < covered.length && covered[j][1] <= cur) j++;
    let k = j;
    while (k < covered.length && covered[k][0] < s1) {
      if (covered[k][0] > cur) out.push([cur, covered[k][0]]);
      cur = Math.max(cur, covered[k][1]);
      k++;
    }
    if (cur < s1) out.push([cur, s1]);
  }
  return out;
}

const total = (spans: Span[]) => spans.reduce((a, s) => a + (s[1] - s[0]), 0);

// حفره = تکه‌هایِ بدونِ‌متنی که کمتر از GAP_MERGE_MS از هم فاصله دارند؛ اندازه = جمعِ صدادارِ بدونِ‌متنِ داخلش (نه فاصله‌ی ساعت).
function gapSizes(uncovered: Span[]): number[] {
  const out: number[] = [];
  let end = -Infinity, sum = 0;
  for (const u of uncovered) {
    if (u[0] - end <= METRICS.GAP_MERGE_MS) sum += u[1] - u[0];
    else { if (sum) out.push(sum); sum = u[1] - u[0]; }
    end = u[1];
  }
  if (sum) out.push(sum);
  return out;
}
const r3 = (x: number) => Math.round(x * 1000) / 1000;

interface Word { speaker: string | null; conf: number; }

// واژه = توکن‌ها تا توکنِ بعدی که با فاصله شروع شود یا گوینده‌اش عوض شود (همان قاعده‌ی markUncertainTokens).
function toWords(tokens: TimedToken[]): Word[] {
  const words: Word[] = [];
  let cur = null as Word | null;
  let hasContent = false;
  for (const t of tokens) {
    if (!t.text) continue;
    const sp = t.speaker != null ? String(t.speaker) : null;
    if (!cur || /^\s/.test(t.text) || (sp !== null && sp !== cur.speaker)) {
      if (cur && hasContent) words.push(cur);
      cur = { speaker: sp ?? cur?.speaker ?? null, conf: Infinity };
      hasContent = false;
    }
    if (HAS_CONTENT.test(t.text)) {
      hasContent = true;
      if (typeof t.confidence === 'number' && t.confidence < cur.conf) cur.conf = t.confidence;
    }
  }
  if (cur && hasContent) words.push(cur);
  return words;
}

export interface MetricsInput {
  tokens: TimedToken[];
  // از quality.speechSpans؛ null/undefined ⇒ پوشش نامعلوم.
  speechSpans?: Array<[number, number]> | null;
  durationMs: number | null;
  lowConfRatio: number | null;
  // حاضرینِ جلسه شاملِ درمانگر (واحدِ درمان)؛ null ⇒ نامعلوم.
  expectedSpeakers?: number | null;
}

export function computeTranscriptMetrics(input: MetricsInput): TranscriptMetrics {
  const { tokens, durationMs, lowConfRatio } = input;
  const flags: MetricsFlag[] = [];

  // ——— پوشش ———
  const timed = tokens.filter((t) => t.text && HAS_CONTENT.test(t.text) && typeof t.start_ms === 'number');
  let speech_ms: number | null = null, covered_speech_ms: number | null = null, coverage: number | null = null;
  let uncovered_speech_ms: number | null = null, longest_uncovered_ms: number | null = null, uncovered_gaps: number | null = null;
  let head_gap_ms: number | null = null, tail_gap_ms: number | null = null;
  const speech = input.speechSpans ? mergeSpans(input.speechSpans.map((s) => [s[0], s[1]] as Span), 0) : null;
  if (speech && (timed.length || !tokens.length)) {
    const covered = mergeSpans(timed.map((t) => {
      const s = t.start_ms as number;
      const e = typeof t.end_ms === 'number' && t.end_ms > s ? t.end_ms : s + METRICS.TOKEN_DEFAULT_MS;
      return [Math.max(0, s - METRICS.TOKEN_PAD_MS), e + METRICS.TOKEN_PAD_MS] as Span;
    }), METRICS.TOKEN_BRIDGE_MS);
    const uncovered = subtract(speech, covered);
    speech_ms = total(speech);
    uncovered_speech_ms = total(uncovered);
    covered_speech_ms = speech_ms - uncovered_speech_ms;
    coverage = speech_ms > 0 ? r3(covered_speech_ms / speech_ms) : null;
    // حفره = تکه‌هایِ بدونِ‌متنِ نزدیک به هم؛ طولِ حفره = صدادارِ بدونِ‌متنِ داخلش (نه فاصله‌ی ساعت).
    longest_uncovered_ms = Math.max(0, ...gapSizes(uncovered));
    const firstTok = covered.length ? covered[0][0] + METRICS.TOKEN_PAD_MS : Infinity;
    const lastTok = covered.length ? covered[covered.length - 1][1] - METRICS.TOKEN_PAD_MS : -Infinity;
    head_gap_ms = total(uncovered.map((u) => [u[0], Math.min(u[1], firstTok)] as Span).filter((u) => u[1] > u[0]));
    tail_gap_ms = total(uncovered.map((u) => [Math.max(u[0], lastTok), u[1]] as Span).filter((u) => u[1] > u[0]));
    // حفره‌هایِ وسط (بینِ اولین و آخرین توکن) برایِ پرچمِ uncovered_gap؛ سر و ته پرچمِ خودشان را دارند.
    const middle = uncovered.map((u) => [Math.max(u[0], firstTok), Math.min(u[1], lastTok)] as Span).filter((u) => u[1] > u[0]);
    uncovered_gaps = gapSizes(middle).filter((g) => g >= METRICS.GAP_FLAG_MS).length;
    if (speech_ms >= METRICS.MIN_SPEECH_MS && coverage !== null && coverage < METRICS.LOW_COVERAGE) flags.push('low_coverage');
    if (uncovered_gaps > 0) flags.push('uncovered_gap');
    if (head_gap_ms >= METRICS.EDGE_FLAG_MS) flags.push('head_gap');
    if (tail_gap_ms >= METRICS.EDGE_FLAG_MS) flags.push('tail_gap');
  }

  // ——— واژه و گوینده ———
  const words = toWords(tokens);
  const bySpeaker = new Map<string, number>();
  for (const w of words) if (w.speaker !== null) bySpeaker.set(w.speaker, (bySpeaker.get(w.speaker) || 0) + 1);
  const labelled = [...bySpeaker.values()].reduce((a, b) => a + b, 0);
  const shares = labelled ? [...bySpeaker.values()].map((n) => n / labelled).sort((a, b) => b - a) : [];
  const speakers_found = shares.filter((s) => s >= METRICS.MIN_SPEAKER_SHARE).length;
  const expected = input.expectedSpeakers && input.expectedSpeakers > 0 ? input.expectedSpeakers : null;
  if (expected !== null && labelled) {
    if (speakers_found < expected) flags.push('speakers_merged');
    else if (speakers_found > expected) flags.push('speakers_extra');
  }
  let turns = 0, shortTurns = 0, run = 0;
  let prev: string | null | undefined = undefined;
  for (const w of words) {
    if (w.speaker !== prev) {
      if (prev !== undefined) { turns++; if (run <= METRICS.SHORT_TURN_WORDS) shortTurns++; }
      prev = w.speaker; run = 0;
    }
    run++;
  }
  if (prev !== undefined) { turns++; if (run <= METRICS.SHORT_TURN_WORDS) shortTurns++; }
  const short_turn_ratio = turns >= METRICS.MIN_TURNS_FOR_RATIO ? r3(shortTurns / turns) : null;
  if (short_turn_ratio !== null && short_turn_ratio > METRICS.FRAGMENTED_RATIO) flags.push('fragmented_turns');

  return {
    v: 1,
    duration_ms: durationMs,
    speech_ms, covered_speech_ms, coverage, uncovered_speech_ms, longest_uncovered_ms, uncovered_gaps, head_gap_ms, tail_gap_ms,
    words: words.length,
    words_per_min: durationMs && durationMs > 0 ? Math.round((words.length / (durationMs / 60000)) * 10) / 10 : null,
    low_conf_ratio: lowConfRatio === null ? null : r3(lowConfRatio),
    uncertain_words: words.filter((w) => w.conf < METRICS.UNCERTAIN_CONFIDENCE).length,
    speakers_found,
    speakers_raw: bySpeaker.size,
    speakers_expected: expected,
    speaker_shares: shares.map(r3),
    turns,
    short_turn_ratio,
    flags,
  };
}

// پاک‌سازیِ JSONِ ذخیره‌شده (audio_jobs.transcript_metrics) پیش از برگرداندن به ادمین.
export function parseTranscriptMetrics(raw: unknown): TranscriptMetrics | null {
  if (!raw) return null;
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return v && typeof v === 'object' && (v as any).v === 1 && Array.isArray((v as any).flags) ? (v as TranscriptMetrics) : null;
  } catch {
    return null;
  }
}
