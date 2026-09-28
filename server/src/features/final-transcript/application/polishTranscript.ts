// مرتب‌سازیِ متنِ جلسه با LLM در دو گذر:
//  ۱) برداشتِ کلی (یک فراخوانی رویِ کلِ متن یا نمونه‌ی فشرده‌اش): نگاشتِ «گوینده N» ⇒ نقش، خلاصه‌ی ماجرا، واژه‌نامه.
//  ۲) ویرایشِ تکه‌به‌تکه رویِ مرزِ نوبت، با برداشتِ کلی و دو نوبتِ قبلی به‌عنوانِ زمینه.
// هر تکه از نگهبان‌هایِ قطعی (polishGuards) رد می‌شود؛ تکه‌ی ردشده با متنِ خامِ خودش جایگزین می‌شود.
// ⚠️ LAW-001: متن هرگز لاگ نمی‌شود — فقط شمارنده‌ها در گزارش می‌آیند.
import {
  chunkTurns, parseTurns, renderClean, sampleForOverview, type CleanTurn, type Turn,
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
  fallback_chunks: number;
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
  const report: PolishReport = { model: llm.model, chunks: 0, fallback_chunks: 0, fallback_reasons: {}, uncertain: 0, overview_ok: false, role_fixes: 0, role_reverts: 0 };
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

    const prev = out.filter((t) => !t.marker).slice(-2).map((t) => `${t.role}: ${t.text}`).join('\n');
    const user = [
      rosterText(roster),
      `برداشتِ کلی از جلسه:\n${overview.summary || '—'}`,
      map.size ? `نگاشتِ پیشنهادیِ گوینده‌ها: ${Array.from(map).map(([k, v]) => `گوینده ${k} = ${v}`).join('، ')}` : '',
      overview.glossary?.length ? `واژه‌نامه: ${overview.glossary.join('، ')}` : '',
      prev ? `دو نوبتِ قبل (فقط برایِ زمینه، دوباره ننویس):\n${prev}` : '',
      `تکه‌ای که باید مرتب شود:\n${chunkToPrompt(chunk)}`,
    ].filter(Boolean).join('\n\n');

    let polished: Array<{ speaker_role: string; text: string }>;
    try {
      const r = await llm.completeJson<{ turns: Array<{ speaker_role: string; text: string }> }>(CHUNK_SYSTEM_PROMPT, user, CHUNK_SCHEMA);
      polished = Array.isArray(r?.turns) ? r.turns : [];
    } catch (e) {
      // خطایِ گذرا ⇒ job دوباره تلاش می‌کند (کارِ انجام‌شده ارزان است). خطایِ دیگر ⇒ فقط همین تکه خام می‌ماند.
      if ((e as { transient?: boolean })?.transient) throw e;
      bump('llm-error');
      report.fallback_chunks++;
      out.push(...fallback());
      continue;
    }

    // نشانگرها را LLM نمی‌بیند که جابه‌جا کند: خروجی با نشانگرهایِ خام در جایِ نسبیِ خودشان ترکیب می‌شود.
    const rawPlain = plain(speechTurns);
    const polPlain = polished.map((t) => String(t.text || '')).join('\n');
    const fail = checkPolishedChunk(rawPlain, polPlain, cfg.guards);
    if (fail) {
      bump(fail);
      report.fallback_chunks++;
      out.push(...fallback());
      continue;
    }
    report.uncertain += uncertainCount(polPlain);
    // نقشِ خروجیِ نوبتِ i: اگر در فهرست نیست ⇒ نقشِ نگاشت‌شده‌ی نوبتِ خامِ هم‌تراز (وقتی تعدادِ نوبت‌ها برابر است) یا نقشِ قبلی
    const aligned = polished.length === speechTurns.length;
    let revert = false;
    if (mapTrusted && aligned) {
      let comparable = 0;
      let deviated = 0;
      for (let i = 0; i < polished.length; i++) {
        const r = String(polished[i].speaker_role || '').trim();
        const sp = speechTurns[i].speaker;
        if (!r || !allowed!.has(r) || !sp || !map.has(sp)) continue;
        comparable++;
        if (r !== map.get(sp)) deviated++;
      }
      if (comparable >= 2 && deviated / comparable > 0.5) { revert = true; report.role_reverts++; }
    }
    const roleAt = (i: number): string => {
      if (revert) {
        const sp = speechTurns[i].speaker;
        if (sp && map.has(sp)) return map.get(sp)!;
      }
      const r = String(polished[i].speaker_role || '').trim();
      if (r && (!allowed || allowed.has(r))) return r;
      if (r) report.role_fixes++;
      const mapped = aligned ? roleFor(speechTurns[i].speaker, map, lastRole) : lastRole;
      return !allowed || allowed.has(mapped) ? mapped : lastRole;
    };
    const emit = (i: number) => { const role = roleAt(i); out.push({ role, text: String(polished[i].text || '') }); lastRole = role; };
    const markersInChunk = chunk.filter((t) => t.marker);
    if (!markersInChunk.length) {
      for (let i = 0; i < polished.length; i++) emit(i);
    } else {
      // تکه‌ی دارایِ نشانگر: نشانگرها به ترتیب، پیش از نوبتی که در متنِ خام بعدشان آمده، می‌آیند (تقریبِ جایگاه)
      const ratio = polished.length / speechTurns.length;
      let speechIdx = 0;
      let polIdx = 0;
      for (const t of chunk) {
        if (t.marker) {
          const upto = Math.min(polished.length, Math.round(speechIdx * ratio));
          while (polIdx < upto) emit(polIdx++);
          out.push({ role: '', text: t.text, marker: true });
        } else speechIdx++;
      }
      while (polIdx < polished.length) emit(polIdx++);
    }
  }
  return { text: renderClean(out), report };
}

function chunkToPrompt(chunk: Turn[]): string {
  return chunk.filter((t) => !t.marker).map((t) => (t.speaker ? `گوینده ${t.speaker}: ${t.text}` : t.text)).join('\n\n');
}
