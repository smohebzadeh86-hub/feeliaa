// مرتب‌سازیِ متنِ جلسه با LLM در دو گذر:
//  ۱) برداشتِ کلی (یک فراخوانی رویِ کلِ متن یا نمونه‌ی فشرده‌اش): نگاشتِ «گوینده N» ⇒ نقش، خلاصه‌ی ماجرا، واژه‌نامه.
//  ۲) ویرایشِ تکه‌به‌تکه رویِ مرزِ نوبت، با برداشتِ کلی و دو نوبتِ قبلی به‌عنوانِ زمینه.
// هر نوبتِ خروجی (با src به نوبت‌هایِ خام گره خورده) از نگهبان‌هایِ قطعی (polishGuards) رد می‌شود؛ نوبتِ ردشده با متنِ خامِ
// خودش جایگزین می‌شود. اگر بخشِ بزرگی از تکه رد شد، یک تلاشِ دوباره با گفتنِ علت.
// ⚠️ LAW-001: متن هرگز لاگ نمی‌شود — فقط شمارنده‌ها در گزارش می‌آیند.
import {
  chunkTurns, parseTurns, renderClean, sampleForOverview, toFaDigits, type CleanTurn, type Turn,
} from '../domain/transcriptText.js';
import { checkPolishedChunk, uncertainCount, type GuardFailure, type GuardLimits } from '../domain/polishGuards.js';
import type { LlmJsonPort, SpeakerRoster } from '../ports.js';
import { OVERVIEW_SCHEMA, CHUNK_SCHEMA, OVERVIEW_SYSTEM_PROMPT, CHUNK_SYSTEM_PROMPT } from './prompts.js';

export interface PolishConfig {
  chunkChars: number;
  overviewChars: number;
  guards: GuardLimits;
  // متن از یک گذرِ diarizationِ async رویِ کلِ صداست (هر شماره‌ی گوینده در کلِ متن یک نفر است) ⇒ نگهبانِ برگشتِ نقش
  // مجاز است. متنِ realtime (شماره‌گذاری با هر reconnect از نو) یا متنِ الحاقی ⇒ false.
  trustDiarization?: boolean;
}

export interface Overview {
  speaker_map: Array<{ speaker: string; role: string }>;
  summary: string;
  glossary: string[];
}

export interface PolishReport {
  model: string;
  chunks: number;
  // تکه‌هایی که هیچ بخشی از آن‌ها ویرایش نشد
  fallback_chunks: number;
  // نوبت‌هایِ گفتار: کل، و آن‌هایی که (به‌خاطرِ نگهبان/خطا) خام ماندند
  turns: number;
  fallback_turns: number;
  // تلاشِ دوباره‌ی تکه (وقتی بخشِ بزرگی رد شد)
  retries: number;
  fallback_reasons: Partial<Record<GuardFailure | 'llm-error', number>>;
  uncertain: number;
  overview_ok: boolean;
  // نقشی که LLM نوشت ولی در فهرستِ حاضرین نبود ⇒ با نقشِ نگاشت‌شده/قبلی جایگزین شد (نگهبانِ قطعیِ نقش)
  role_fixes: number;
  // تکه‌هایی که نقش‌هایشان به نگاشتِ برداشتِ کلی برگشت (LLM بیشترِ نقش‌ها را برخلافِ تفکیکِ سالمِ Soniox عوض کرده بود)
  role_reverts: number;
}

export interface PolishResult { text: string; report: PolishReport; }

function rosterText(r: SpeakerRoster | null): string {
  if (!r) return 'اطلاعاتِ حاضرین در دسترس نیست. نقش‌ها را فقط از محتوا تشخیص بده (یکی درمانگر است).';
  const lines = [`نوعِ جلسه: ${r.unitLabel}`, 'حاضرین (نامِ نقش را دقیقاً همین‌طور بنویس):', '- درمانگر'];
  for (const s of r.speakers) lines.push(`- ${s}`);
  return lines.join('\n');
}

function roleFor(speaker: string | null, map: Map<string, string>, fallback: string): string {
  if (!speaker) return fallback;
  return map.get(speaker) || `گوینده ${speaker}`;
}

// متنِ خالصِ یک تکه برایِ نگهبان: نوبت‌ها بدونِ برچسب، نشانگرها داخلش.
function plain(turns: Array<{ text: string }>): string {
  return turns.map((t) => t.text).join('\n');
}

export async function polishTranscript(
  rawText: string,
  roster: SpeakerRoster | null,
  llm: LlmJsonPort,
  cfg: PolishConfig
): Promise<PolishResult> {
  const turns = parseTurns(rawText);
  const report: PolishReport = { model: llm.model, chunks: 0, fallback_chunks: 0, turns: 0, fallback_turns: 0, retries: 0, fallback_reasons: {}, uncertain: 0, overview_ok: false, role_fixes: 0, role_reverts: 0 };
  // نقش‌هایِ مجاز: فقط وقتی فهرستِ حاضرین معلوم است. نقشِ بیرون از فهرست (مثلاً «مراجع» در جلسه‌ی زوج، یا «گوینده ۳»)
  // نامِ نمایشیِ نادرست می‌سازد ⇒ با نقشِ نگاشت‌شده‌ی همان نوبت (اگر هم‌تراز است) یا نقشِ قبلی جایگزین می‌شود.
  const allowed = roster && roster.speakers.length ? new Set(['درمانگر', ...roster.speakers.map((s) => s.trim())]) : null;
  const bump = (k: GuardFailure | 'llm-error') => { report.fallback_reasons[k] = (report.fallback_reasons[k] || 0) + 1; };

  // ——— گذرِ ۱: برداشتِ کلی ———
  let overview: Overview = { speaker_map: [], summary: '', glossary: [] };
  const overviewUser = [
    rosterText(roster),
    roster?.terms.length ? `واژه‌هایِ تخصصیِ رویکردِ درمانگر: ${roster.terms.join('، ')}` : '',
    'متنِ خامِ جلسه:',
    sampleForOverview(rawText, cfg.overviewChars),
  ].filter(Boolean).join('\n\n');
  // خطایِ گذرایِ LLM در این گذر بالا پرتاب می‌شود تا job دوباره تلاش کند (بدونِ برداشتِ کلی، نقش‌گذاری بی‌پایه است).
  // پاسخِ JSONِ نامعتبر در این گذر هم گذرا حساب می‌شود (فاز ۰B: یک بار پس از ۲۵۹ث پاسخِ بریده آمد) — بدونِ آن کلِ کار
  // بی‌برگشت failed می‌شد. در گذرِ تکه‌ها همان تکه خام می‌ماند (ارزان‌تر از تکرارِ کلِ کار).
  try {
    overview = await llm.completeJson<Overview>(OVERVIEW_SYSTEM_PROMPT, overviewUser, OVERVIEW_SCHEMA);
  } catch (e) {
    if ((e as { code?: string })?.code === 'llm-invalid-output') (e as { transient?: boolean }).transient = true;
    throw e;
  }
  report.overview_ok = true;
  const map = new Map<string, string>();
  for (const m of overview.speaker_map || []) {
    const sp = String(m.speaker || '').replace(/[^0-9۰-۹]/g, '').replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
    if (sp && m.role) map.set(sp, String(m.role).trim());
  }
  // نگهبانِ «نقشِ مجاز ولی غلط» (2026-09-28، ریسکِ R20): نگاشتِ برداشتِ کلی فقط وقتی مبنایِ قابلِ‌اتکاست که تفکیکِ Soniox
  // ادغام‌نشده باشد — هر برچسبِ گوینده به نقشی مجاز نگاشت شده و این نقش‌ها همه‌ی حاضرین را پوشش می‌دهند. در این حالت
  // LLM که بیشترِ نقش‌هایِ یک تکه را برخلافِ نگاشت عوض کند، به احتمالِ زیاد اشتباه کرده ⇒ نقش‌ها به نگاشت برمی‌گردند (متنِ
  // مرتب‌شده می‌ماند). وقتی Soniox گوینده‌ها را ادغام کرده (برچسب کمتر از حاضرین — فاز ۰B: نویز/clipping/همهمه)، نقش فقط از
  // محتوا درمی‌آید و LLM باید آزاد باشد (همان‌جا ۶۹٪ ⇒ ۹۹٪ درست کرد) ⇒ نگهبان خاموش است.
  const labels = Array.from(new Set(turns.filter((t) => !t.marker && t.speaker).map((t) => t.speaker as string)));
  const mapTrusted = !!cfg.trustDiarization && !!allowed && labels.length > 0
    && labels.every((sp) => map.has(sp) && allowed.has(map.get(sp)!))
    && new Set(labels.map((sp) => map.get(sp)!)).size === allowed.size;

  // ——— گذرِ ۲: ویرایشِ تکه‌به‌تکه ———
  const chunks = chunkTurns(turns, cfg.chunkChars);
  report.chunks = chunks.length;
  const out: CleanTurn[] = [];
  let lastRole = 'درمانگر';
  for (const chunk of chunks) {
    const fallback = (): CleanTurn[] => {
      const res: CleanTurn[] = [];
      for (const t of chunk) {
        if (t.marker) { res.push({ role: '', text: t.text, marker: true }); continue; }
        const role = roleFor(t.speaker, map, lastRole);
        res.push({ role, text: t.text });
        report.uncertain += uncertainCount(t.text);
        lastRole = role;
      }
      return res;
    };
    const speechTurns = chunk.filter((t) => !t.marker);
    if (!speechTurns.length) { out.push(...fallback()); continue; }
    report.turns += speechTurns.length;

    const prev = out.filter((t) => !t.marker).slice(-2).map((t) => `${t.role}: ${t.text}`).join('\n');
    const user = [
      rosterText(roster),
      `برداشتِ کلی از جلسه:\n${overview.summary || '—'}`,
      map.size ? `نگاشتِ پیشنهادیِ گوینده‌ها: ${Array.from(map).map(([k, v]) => `گوینده ${k} = ${v}`).join('، ')}` : '',
      overview.glossary?.length ? `واژه‌نامه: ${overview.glossary.join('، ')}` : '',
      prev ? `دو نوبتِ قبل (فقط برایِ زمینه، دوباره ننویس):\n${prev}` : '',
      `تکه‌ای که باید مرتب شود:\n${chunkToPrompt(chunk)}`,
    ].filter(Boolean).join('\n\n');

    // تلاشِ اول؛ اگر بخشِ بزرگی رد شد (یا پاسخ خراب بود)، یک تلاشِ دوباره با گفتنِ علتِ رد — بهترینِ دو تلاش می‌ماند.
    const totalChars = speechTurns.reduce((n, t) => n + t.text.length, 0) || 1;
    let best: Attempt | null = null;
    let feedback = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      let a: Attempt | null = null;
      try {
        const r = await llm.completeJson<{ turns: LlmTurn[] }>(CHUNK_SYSTEM_PROMPT, feedback ? `${user}\n\n${feedback}` : user, CHUNK_SCHEMA);
        a = evaluateAttempt(Array.isArray(r?.turns) ? r.turns : [], speechTurns, cfg.guards);
      } catch (e) {
        // خطایِ گذرا ⇒ job دوباره تلاش می‌کند (کارِ انجام‌شده ارزان است). خطایِ دیگر ⇒ تلاشِ بعدی، یا همین تکه خام.
        if ((e as { transient?: boolean })?.transient) throw e;
      }
      if (attempt > 0) report.retries++;
      if (a && (!best || a.fallbackChars < best.fallbackChars)) best = a;
      if (best && best.fallbackChars / totalChars <= RETRY_ABOVE) break;
      feedback = a ? retryFeedback(a) : '';
    }
    if (!best) {
      bump('llm-error');
      report.fallback_chunks++;
      report.fallback_turns += speechTurns.length;
      out.push(...fallback());
      continue;
    }
    for (const g of best.groups) if (g.fail) bump(g.fail);
    if (best.groups.every((g) => g.fail)) report.fallback_chunks++;

    // نقش‌ها: برگشت به نگاشت وقتی LLM بیشترِ نقش‌هایِ هم‌ترازِ یک تکه را برخلافِ تفکیکِ سالم عوض کرده (R20)
    let revert = false;
    if (mapTrusted) {
      let comparable = 0;
      let deviated = 0;
      for (const g of best.groups) {
        if (g.fail || g.out.length !== 1) continue;
        const r = String(g.out[0].speaker_role || '').trim();
        const sp = speechTurns[g.start].speaker;
        if (!r || !allowed!.has(r) || !sp || !map.has(sp)) continue;
        comparable++;
        if (r !== map.get(sp)) deviated++;
      }
      if (comparable >= 2 && deviated / comparable > 0.5) { revert = true; report.role_reverts++; }
    }
    // نقشِ نوبتِ مرتب‌شده: اگر در فهرست نیست ⇒ نقشِ نگاشت‌شده‌ی نوبتِ خامِ متناظر (اگر معلوم است) یا نقشِ قبلی
    const roleOf = (t: LlmTurn, sp: string | null | undefined): string => {
      if (revert && sp && map.has(sp)) return map.get(sp)!;
      const r = String(t.speaker_role || '').trim();
      if (r && (!allowed || allowed.has(r))) return r;
      if (r) report.role_fixes++;
      const mapped = sp !== undefined ? roleFor(sp, map, lastRole) : lastRole;
      return !allowed || allowed.has(mapped) ? mapped : lastRole;
    };

    // واحدهایِ خروجی به ترتیب، هر کدام با جایگاهش در نوبت‌هایِ خام (برایِ درجِ نشانگرها در جایِ خودشان)
    const units: Array<{ start: number; emit: () => void }> = [];
    for (const g of best.groups) {
      if (g.fail) {
        // فقط همین نوبت(ها) خام می‌مانند، نه کلِ تکه
        report.fallback_turns += g.end - g.start;
        for (let i = g.start; i < g.end; i++) {
          const t = speechTurns[i];
          units.push({ start: i, emit: () => {
            const role = roleFor(t.speaker, map, lastRole);
            out.push({ role, text: t.text });
            report.uncertain += uncertainCount(t.text);
            lastRole = role;
          } });
        }
        continue;
      }
      // گروهِ چندخروجی فقط وقتی پیش می‌آید که src نامعتبر و تعدادِ نوبت‌ها نابرابر است (کلِ تکه یک گروه) ⇒ جایگاهِ تقریبی
      const sp = g.out.length === 1 ? speechTurns[g.start].speaker : undefined;
      g.out.forEach((t, k) => {
        const start = g.start + Math.round((k * (g.end - g.start)) / g.out.length);
        units.push({ start, emit: () => {
          const role = roleOf(t, sp);
          const text = String(t.text || '');
          out.push({ role, text });
          report.uncertain += uncertainCount(text);
          lastRole = role;
        } });
      });
    }
    // نشانگرها را LLM نمی‌بیند که جابه‌جا کند: پیش از اولین واحدی می‌آیند که در متنِ خام بعدشان است.
    let speechIdx = 0;
    let u = 0;
    for (const t of chunk) {
      if (!t.marker) { speechIdx++; continue; }
      while (u < units.length && units[u].start < speechIdx) units[u++].emit();
      out.push({ role: '', text: t.text, marker: true });
    }
    while (u < units.length) units[u++].emit();
  }
  return { text: renderClean(out), report };
}

type LlmTurn = { src?: unknown; speaker_role: string; text: string };
// نوبت‌هایِ خامِ [start, end) و نوبت‌هایِ خروجیِ ساخته‌شده از آن‌ها؛ fail = نتیجه‌ی نگهبان برایِ همین گروه
interface Group { start: number; end: number; out: LlmTurn[]; fail: GuardFailure | null; }
interface Attempt { groups: Group[]; fallbackChars: number; }

// بیش از این سهم از متنِ تکه خام بماند ⇒ یک تلاشِ دوباره
const RETRY_ABOVE = 0.15;

// src معتبر: شماره‌ها (از ۱) پیوسته و به ترتیب، هر نوبتِ خام دقیقاً یک بار.
function groupsFromSrc(polished: LlmTurn[], n: number): Group[] | null {
  const groups: Group[] = [];
  let next = 1;
  for (const t of polished) {
    const src = Array.isArray(t.src) ? t.src.map((x) => Number(x)) : [];
    if (!src.length) return null;
    for (let k = 0; k < src.length; k++) if (src[k] !== next + k) return null;
    groups.push({ start: next - 1, end: next - 1 + src.length, out: [t], fail: null });
    next += src.length;
  }
  return next === n + 1 ? groups : null;
}

// نگهبان رویِ هر گروه جدا (2026-09-28): قبلاً کلِ تکه (تا ۶۰۰۰ نویسه) با اولین ردشدن خام می‌ماند — تنها «متنِ نهایی»ِ prod
// بی‌هیچ ویرایشی نمایش داده شد. حالا فقط نوبتِ ردشده خام می‌ماند.
function evaluateAttempt(polished: LlmTurn[], speech: Turn[], guards: GuardLimits): Attempt {
  const n = speech.length;
  const groups = groupsFromSrc(polished, n)
    ?? (polished.length === n
      ? polished.map((t, i) => ({ start: i, end: i + 1, out: [t], fail: null }))
      : [{ start: 0, end: n, out: polished, fail: null }]);
  let fallbackChars = 0;
  for (const g of groups) {
    const raw = speech.slice(g.start, g.end);
    g.fail = checkPolishedChunk(plain(raw), g.out.map((t) => String(t.text || '')).join('\n'), guards);
    if (g.fail) fallbackChars += raw.reduce((s, t) => s + t.text.length, 0);
  }
  return { groups, fallbackChars };
}

const FAIL_HINT: Record<GuardFailure, string> = {
  negation: 'یک واژه‌ی منفی («نه»، «نمی‌…»، «هیچ…») اضافه یا حذف شده بود',
  number: 'یک عدد عوض یا حذف شده بود',
  length: 'متن خیلی کوتاه یا بلند شده بود (خلاصه یا اضافه)',
  overlap: 'واژه‌هایِ زیادی عوض شده بود',
  marker: 'نشانگرِ علامت جابه‌جا یا حذف شده بود',
  uncertain: 'علامتِ ⟦…؟⟧ برداشته شده بود',
  empty: 'متنِ نوبت خالی مانده بود',
};

function retryFeedback(a: Attempt): string {
  const failed = a.groups.filter((g) => g.fail);
  const lines = failed.slice(0, 12).map((g) => {
    const nums = Array.from({ length: g.end - g.start }, (_, k) => toFaDigits(String(g.start + k + 1))).join('، ');
    return `- نوبتِ [${nums}]: ${FAIL_HINT[g.fail!]}`;
  });
  if (!lines.length) lines.push('- ساختارِ پاسخ نامعتبر بود: src باید همه‌ی نوبت‌ها را به ترتیب و هر کدام یک بار پوشش دهد');
  return `تلاشِ قبلیِ تو برایِ این تکه رد شد:\n${lines.join('\n')}\nدوباره انجام بده: همه‌ی منفی‌ها، عددها و گفته‌ها را دقیقاً نگه دار و فقط املا، نیم‌فاصله، نقطه‌گذاری و واژه‌هایِ بدشنیده را درست کن.`;
}

function chunkToPrompt(chunk: Turn[]): string {
  return chunk.filter((t) => !t.marker)
    .map((t, i) => `[${toFaDigits(String(i + 1))}] ${t.speaker ? `گوینده ${t.speaker}: ${t.text}` : t.text}`)
    .join('\n\n');
}
