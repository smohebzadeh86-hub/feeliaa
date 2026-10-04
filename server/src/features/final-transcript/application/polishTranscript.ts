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
import type { LlmJsonPort, LlmUsageSnapshot, SpeakerRoster } from '../ports.js';
import { OVERVIEW_SCHEMA, CHUNK_SCHEMA, OVERVIEW_SYSTEM_PROMPT, CHUNK_SYSTEM_PROMPT } from './prompts.js';
import type { BoundaryJudgeReport } from './boundaryJudge.js';

export interface PolishConfig {
  chunkChars: number;
  overviewChars: number;
  guards: GuardLimits;
  // متن از یک گذرِ diarizationِ async رویِ کلِ صداست (هر شماره‌ی گوینده در کلِ متن یک نفر است) ⇒ نگهبانِ برگشتِ نقش
  // مجاز است. متنِ realtime (شماره‌گذاری با هر reconnect از نو) یا متنِ الحاقی ⇒ false.
  trustDiarization?: boolean;
  // یادداشت‌هایِ درمانگر پیش از جلسه (متنی/صوتی، بدونِ برچسب). فقط «زمینه»: املایِ نام‌ها و موضوع. به LLM داده می‌شود
  // ولی هرگز منبعِ محتوایِ متن نیست و نگهبان‌هایِ قطعی همان‌طور رویِ متنِ خام کار می‌کنند.
  briefing?: string;
  // نقش‌هایِ تأییدشده‌ی درمانگر (برچسبِ گوینده با ارقامِ فارسی ⇒ نامِ نقش، مثلاً {'۲': 'مراجع'}) از رکوردِ canonical. این نقش‌ها پین‌اند:
  // نه LLM می‌تواند عوضشان کند و نه نگاشتِ برداشتِ کلی؛ «ساختِ دوباره» ویرایشِ نقشِ درمانگر را بازنویسی نمی‌کند (F7).
  confirmedRoles?: Record<string, string>;
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
  // نوبت‌هایی که LLM نقششان را برخلافِ نگاشت/تأییدِ درمانگر نوشت (پین‌شده‌ها برگردانده شدند) — فقط شمارنده
  role_overrides: number;
  // متنِ async از یک گذرِ diarizationِ کامل بود ⇒ داورِ مرزِ نوبت (بعد از done، بدونِ تأخیرِ کاربر) مجاز است
  diarization_trusted?: boolean;
  // داورِ مرزِ نوبت (فقط ثبت، **بعد از** done با UPDATE اضافه می‌شود): اندیس و نمره‌یِ مرزهایِ مشکوک، بدونِ متن
  boundary_judge?: BoundaryJudgeReport;
  usage?: PolishUsage;
}

// مصرفِ هر ویرایش (2026-10-01): جمع، گذرِ برداشتِ کلی، و هر تکه (هر تکه = یک «ادیت»). فقط عدد، هرگز متن.
export interface ChunkUsage extends LlmUsageSnapshot { turns: number; chars: number; }
export interface PolishUsage { total: LlmUsageSnapshot; overview: LlmUsageSnapshot; chunks: ChunkUsage[]; boundary_judge?: LlmUsageSnapshot; }

export interface PolishResult { text: string; report: PolishReport; turns: CleanTurn[]; }

function rosterText(r: SpeakerRoster | null): string {
  if (!r) return 'اطلاعاتِ حاضرین در دسترس نیست. نقش‌ها را فقط از محتوا تشخیص بده (یکی درمانگر است).';
  const lines = [`نوعِ جلسه: ${r.unitLabel}`, 'حاضرین (نامِ نقش را دقیقاً همین‌طور بنویس):', '- درمانگر'];
  for (const s of r.speakers) lines.push(`- ${s}`);
  return lines.join('\n');
}

// سقفِ طولِ یادداشت‌هایِ پیش از جلسه در پرامپت (هزینه + جلوگیری از غلبه‌ی زمینه بر متن)
export const BRIEFING_MAX_CHARS = 3000;
function briefingText(b?: string): string {
  const t = (b || '').trim();
  if (!t) return '';
  return `یادداشتِ درمانگر پیش از جلسه (فقط زمینه: املایِ درستِ نام‌ها و موضوعِ جلسه؛ هیچ چیزِ آن را به متن اضافه نکن و گفته‌ای را بر اساسِ آن عوض نکن):\n${t.slice(0, BRIEFING_MAX_CHARS)}`;
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
  const report: PolishReport = { model: llm.model, chunks: 0, fallback_chunks: 0, turns: 0, fallback_turns: 0, retries: 0, fallback_reasons: {}, uncertain: 0, overview_ok: false, role_fixes: 0, role_reverts: 0, role_overrides: 0 };
  // نقش‌هایِ مجاز: فقط وقتی فهرستِ حاضرین معلوم است. نقشِ بیرون از فهرست (مثلاً «مراجع» در جلسه‌ی زوج، یا «گوینده ۳»)
  // نامِ نمایشیِ نادرست می‌سازد ⇒ با نقشِ نگاشت‌شده‌ی همان نوبت (اگر هم‌تراز است) یا نقشِ قبلی جایگزین می‌شود.
  const allowed = roster && roster.speakers.length ? new Set(['درمانگر', ...roster.speakers.map((s) => s.trim())]) : null;
  // مصرفِ توکن/هزینه: اختلافِ شمارنده‌یِ تجمیعیِ llm بینِ دو نقطه (فیک‌هایِ بدونِ usage ⇒ گزارش نمی‌شود)
  const startUsage = llm.usage?.() ?? null;
  let lastUsage = startUsage;
  const takeUsage = (): LlmUsageSnapshot | null => {
    const now = llm.usage?.() ?? null;
    if (!now || !lastUsage) return null;
    const dlt: LlmUsageSnapshot = {
      calls: now.calls - lastUsage.calls, prompt_tokens: now.prompt_tokens - lastUsage.prompt_tokens,
      completion_tokens: now.completion_tokens - lastUsage.completion_tokens, reasoning_tokens: now.reasoning_tokens - lastUsage.reasoning_tokens,
      cost_usd: now.cost_usd === null || lastUsage.cost_usd === null ? null : Math.round((now.cost_usd - lastUsage.cost_usd) * 1e8) / 1e8,
    };
    lastUsage = now;
    return dlt;
  };
  const chunkUsage: ChunkUsage[] = [];
  let overviewUsage: LlmUsageSnapshot | null = null;
  let openChunk: { turns: number; chars: number } | null = null;
  const closeChunk = () => {
    if (!openChunk) return;
    const u = takeUsage();
    if (u) chunkUsage.push({ ...u, ...openChunk });
    openChunk = null;
  };
  const bump = (k: GuardFailure | 'llm-error') => { report.fallback_reasons[k] = (report.fallback_reasons[k] || 0) + 1; };

  // ——— گذرِ ۱: برداشتِ کلی ———
  let overview: Overview = { speaker_map: [], summary: '', glossary: [] };
  const overviewUser = [
    rosterText(roster),
    briefingText(cfg.briefing),
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
  overviewUsage = takeUsage();
  const map = new Map<string, string>();
  for (const m of overview.speaker_map || []) {
    const sp = String(m.speaker || '').replace(/[^0-9۰-۹]/g, '').replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
    if (sp && m.role) map.set(sp, String(m.role).trim());
  }
  // نقش‌هایِ تأییدشده‌ی درمانگر: روی نگاشت می‌نشینند و پین می‌شوند (فقط اگر نقش در فهرستِ مجاز باشد).
  const pinned = new Set<string>();
  for (const [sp, role] of Object.entries(cfg.confirmedRoles || {})) {
    const r = String(role || '').trim();
    if (r && (!allowed || allowed.has(r))) { map.set(sp, r); pinned.add(sp); }
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
  let succeededChunks = 0;
  let transientChunkFailures = 0;
  for (const chunk of chunks) {
    const fallback = (): CleanTurn[] => {
      const res: CleanTurn[] = [];
      for (const t of chunk) {
        if (t.marker) { res.push({ role: '', text: t.text, marker: true }); continue; }
        const role = roleFor(t.speaker, map, lastRole);
        res.push({ role, text: t.text, raw: t.text, sp: t.speaker });
        report.uncertain += uncertainCount(t.text);
        lastRole = role;
      }
      return res;
    };
    const speechTurns = chunk.filter((t) => !t.marker);
    if (!speechTurns.length) { out.push(...fallback()); continue; }
    report.turns += speechTurns.length;
    closeChunk();
    openChunk = { turns: speechTurns.length, chars: speechTurns.reduce((n, t) => n + t.text.length, 0) };

    const prev = out.filter((t) => !t.marker).slice(-2).map((t) => `${t.role}: ${t.text}`).join('\n');
    const user = [
      rosterText(roster),
      briefingText(cfg.briefing),
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
        // خطایِ گذرا (بعد از تلاش‌هایِ درجایِ آداپتور): تا وقتی هیچ تکه‌ای موفق نشده ⇒ job دوباره تلاش می‌کند (چیزی از دست
        // نمی‌رود). بعد از آن ⇒ فقط همین تکه خام می‌ماند و پیشرفت حفظ می‌شود — قبلاً یک خطا در تکه‌ی ۱۱ از ۱۴ کلِ کارِ یک
        // جلسه‌ی بلند را از اول به backoff می‌برد و با مدلِ رایگانِ ناپایدار هرگز تمام نمی‌شد (prod، 2026-09-28).
        if ((e as { transient?: boolean })?.transient) {
          if (!succeededChunks) throw e;
          transientChunkFailures++;
          break;
        }
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
    succeededChunks++;
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
      if (sp && pinned.has(sp)) {
        const llmRole = String(t.speaker_role || '').trim();
        if (llmRole && llmRole !== map.get(sp)) report.role_overrides++;
        return map.get(sp)!;
      }
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
            out.push({ role, text: t.text, raw: t.text, sp: t.speaker });
            report.uncertain += uncertainCount(t.text);
            lastRole = role;
          } });
        }
        continue;
      }
      // گروهِ چندخروجی فقط وقتی پیش می‌آید که src نامعتبر و تعدادِ نوبت‌ها نابرابر است (کلِ تکه یک گروه) ⇒ جایگاهِ تقریبی
      const sp = g.out.length === 1 ? speechTurns[g.start].speaker : undefined;
      // متنِ خامِ سازنده فقط وقتی گروه یک خروجی دارد (نگاشتِ یک‌به‌چند نامعلوم است)؛ گوینده فقط اگر همه‌ی نوبت‌هایِ خام یکی‌اند
      const srcTurns = speechTurns.slice(g.start, g.end);
      const raw = g.out.length === 1 ? srcTurns.map((x) => x.text).join(' ') : undefined;
      const oneSp = g.out.length === 1 && srcTurns.every((x) => x.speaker === srcTurns[0].speaker) ? srcTurns[0].speaker : null;
      g.out.forEach((t, k) => {
        const start = g.start + Math.round((k * (g.end - g.start)) / g.out.length);
        units.push({ start, emit: () => {
          const role = roleOf(t, sp);
          const text = String(t.text || '');
          out.push({ role, text, ...(raw !== undefined ? { raw } : {}), sp: oneSp });
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
  // بیش از نیمِ تکه‌ها با خطایِ گذرا خام ماندند ⇒ نتیجه عملاً ویرایش‌نشده است؛ job بعداً دوباره تلاش می‌کند.
  if (transientChunkFailures * 2 > chunks.length) {
    throw Object.assign(new Error(`بیش از نیمِ تکه‌ها با خطایِ گذرایِ LLM خام ماندند (${transientChunkFailures}/${chunks.length})`), { transient: true, code: 'llm-failed' });
  }
  closeChunk();
  report.diarization_trusted = !!cfg.trustDiarization;
  if (startUsage && overviewUsage) {
    const sum = llm.usage!();
    report.usage = {
      total: {
        calls: sum.calls - startUsage.calls, prompt_tokens: sum.prompt_tokens - startUsage.prompt_tokens,
        completion_tokens: sum.completion_tokens - startUsage.completion_tokens, reasoning_tokens: sum.reasoning_tokens - startUsage.reasoning_tokens,
        cost_usd: sum.cost_usd === null || startUsage.cost_usd === null ? null : Math.round((sum.cost_usd - startUsage.cost_usd) * 1e8) / 1e8,
      },
      overview: overviewUsage,
      chunks: chunkUsage,
    };
  }
  return { text: renderClean(out), report, turns: out };
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
    g.fail = g.out.length === 1 && mergesSpeakers(raw) ? 'speakers' : checkPolishedChunk(plain(raw), g.out.map((t) => String(t.text || '')).join('\n'), guards);
    if (g.fail) fallbackChars += raw.reduce((s, t) => s + t.text.length, 0);
  }
  return { groups, fallbackChars };
}

// ادغامِ نوبت‌هایِ دو گویندهٔ متفاوت در یک خروجی (F7): فقط وقتی مجاز است که گویندهٔ کم‌حرف‌تر حداکثر ۲ واژه گفته باشد (همهمه/تأییدِ
// کوتاه مثلِ «آره»)؛ وگرنه گفته‌هایِ یک نفر به نقشِ دیگری نسبت داده می‌شود.
const BACKCHANNEL_MAX_WORDS = 2;
function mergesSpeakers(raw: Turn[]): boolean {
  const by = new Map<string, number>();
  for (const t of raw) if (t.speaker) by.set(t.speaker, (by.get(t.speaker) || 0) + t.text.split(/\s+/).filter(Boolean).length);
  if (by.size < 2) return false;
  const counts = Array.from(by.values()).sort((a, b) => b - a);
  return counts.slice(1).some((n) => n > BACKCHANNEL_MAX_WORDS);
}

const FAIL_HINT: Record<GuardFailure, string> = {
  negation: 'یک واژه‌ی منفی («نه»، «نمی‌…»، «هیچ…») اضافه یا حذف شده بود',
  number: 'یک عدد عوض یا حذف شده بود',
  length: 'متن خیلی کوتاه یا بلند شده بود (خلاصه یا اضافه)',
  overlap: 'واژه‌هایِ زیادی عوض شده بود',
  marker: 'نشانگرِ علامت جابه‌جا یا حذف شده بود',
  uncertain: 'علامتِ ⟦…؟⟧ برداشته شده بود',
  empty: 'متنِ نوبت خالی مانده بود',
  speakers: 'نوبت‌هایِ دو گویندهٔ متفاوت در یک خروجی ادغام شده بود (هر گوینده باید نوبتِ جدا بماند)',
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
