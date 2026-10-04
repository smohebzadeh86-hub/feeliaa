// داورِ مرزِ نوبت — حالتِ «فقط ثبت» (2026-10-03).
// مسئله: Soniox برچسبِ گوینده را به‌ازایِ هر جمله می‌دهد و صدایِ درمانگر/مراجع شبیه است؛ گاهی جمله‌یِ کوتاهِ لبه‌یِ نوبت
// («درسته.»، «تموم شد، آره.») به طرفِ اشتباه می‌رود. این ماژول هر مرزِ تعویضِ گوینده را (با پیش‌فیلترِ «جمله‌یِ لبه ≤ ۶ واژه»)
// با LLMِ استدل‌گر نمره می‌دهد و فقط نمره‌هایِ بالا را در گزارش می‌گذارد.
// ⚠️ هرگز متن/نقشِ نوبت‌ها را تغییر نمی‌دهد و هرگز پرتاب نمی‌کند (خطا ⇒ فقط شمارنده). LAW-001: گزارش فقط اندیس و عدد دارد.
import type { CleanTurn } from '../domain/transcriptText.js';
import type { LlmJsonPort, LlmUsageSnapshot } from '../ports.js';
import { BOUNDARY_SCHEMA, BOUNDARY_SYSTEM_PROMPT } from './prompts.js';

export interface BoundaryJudgeConfig {
  llm: LlmJsonPort;
  maxItems?: number;   // سقفِ مرزهایِ داوری‌شده در یک جلسه (هزینه)
  budgetMs?: number;   // سقفِ زمانِ کل؛ بعد از آن دسته‌یِ جدید شروع نمی‌شود
  concurrency?: number;
  minScore?: number;   // نمره‌یِ حداقلِ ثبت در flagged
}

export interface BoundaryJudgeReport {
  v: 1;
  candidates: number;        // مرزهایِ تعویضِ گوینده که از پیش‌فیلتر گذشتند
  checked: number;           // مرزهایی که نمره‌شان آمد
  truncated: number;         // کاندیدهایِ حذف‌شده به‌خاطرِ سقفِ maxItems
  failed_batches: number;
  timed_out: boolean;
  min_score: number;
  // [اندیسِ نوبتِ «قبل» در clean_turns (مرز بینِ i و i+1)، a، b] — به ترتیبِ نمره‌یِ نزولی، حداکثر ۸۰ مورد
  flagged: Array<[number, number, number]>;
}

export const BOUNDARY_EDGE_MAX_WORDS = 6;
const BATCH = 10;
const CTX_SENTENCES = 3;
const FLAGGED_CAP = 80;

const sentences = (t: string): string[] => t.split(/(?<=[.!؟?…])\s+/).map((s) => s.trim()).filter(Boolean);
const wordCount = (s: string): number => s.replace(/⟦|؟⟧/g, '').split(/\s+/).filter(Boolean).length;
const tail = (s: string, n: number): string => (s.length > n ? '…' + s.slice(-n) : s);
const head = (s: string, n: number): string => (s.length > n ? s.slice(0, n) + '…' : s);
const numbered = (a: string[]): string => a.map((s, i) => `(${i + 1}) ${s}`).join(' ');

interface Cand { i: number; text: string; a?: number; b?: number }

// مرزهایِ تعویضِ نقش (بدونِ نشانگر) که جمله‌یِ آخرِ قبل یا جمله‌یِ اولِ بعد ≤ ۶ واژه است.
export function boundaryCandidates(out: CleanTurn[]): Cand[] {
  const res: Cand[] = [];
  for (let i = 0; i < out.length - 1; i++) {
    const p = out[i], n = out[i + 1];
    if (p.marker || n.marker || p.role === n.role) continue;
    const sp = sentences(p.text), sn = sentences(n.text);
    if (!sp.length || !sn.length) continue;
    if (wordCount(sp[sp.length - 1]) > BOUNDARY_EDGE_MAX_WORDS && wordCount(sn[0]) > BOUNDARY_EDGE_MAX_WORDS) continue;
    const text = `قبل (${p.role}): ${numbered(sp.slice(-CTX_SENTENCES).map((s) => tail(s, 200)))}\nبعد (${n.role}): ${numbered(sn.slice(0, CTX_SENTENCES).map((s) => head(s, 200)))}`;
    res.push({ i, text });
  }
  return res;
}

const clampScore = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
};

export async function judgeBoundaries(out: CleanTurn[], cfg: BoundaryJudgeConfig): Promise<{ report: BoundaryJudgeReport; usage: LlmUsageSnapshot | null }> {
  const minScore = cfg.minScore ?? 50;
  const all = boundaryCandidates(out);
  const max = cfg.maxItems ?? 120;
  // بیش از سقف ⇒ نمونه‌یِ یکنواخت از کلِ جلسه (نه فقط اولِ جلسه)
  const cands = all.length <= max ? all : Array.from({ length: max }, (_, k) => all[Math.floor((k * all.length) / max)]);
  const report: BoundaryJudgeReport = { v: 1, candidates: all.length, checked: 0, truncated: all.length - cands.length, failed_batches: 0, timed_out: false, min_score: minScore, flagged: [] };
  const before = cfg.llm.usage?.() ?? null;
  const deadline = Date.now() + (cfg.budgetMs ?? 6 * 60_000);
  const batches: Cand[][] = [];
  for (let k = 0; k < cands.length; k += BATCH) batches.push(cands.slice(k, k + BATCH));
  let next = 0;
  const worker = async () => {
    for (;;) {
      const bi = next++;
      if (bi >= batches.length) return;
      if (Date.now() > deadline) { report.timed_out = true; return; }
      const batch = batches[bi];
      const user = batch.map((c, k) => `[${k + 1}]\n${c.text}`).join('\n\n');
      try {
        const r = await cfg.llm.completeJson<{ items?: unknown }>(BOUNDARY_SYSTEM_PROMPT, user, BOUNDARY_SCHEMA);
        const seen = new Set<number>();
        for (const it of Array.isArray(r?.items) ? (r.items as Array<{ id?: unknown; a?: unknown; b?: unknown }>) : []) {
          const id = Number(it?.id);
          const a = clampScore(it?.a), b = clampScore(it?.b);
          if (!Number.isInteger(id) || id < 1 || id > batch.length || seen.has(id) || a === null || b === null) continue;
          seen.add(id);
          batch[id - 1].a = a;
          batch[id - 1].b = b;
        }
      } catch {
        report.failed_batches++;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(cfg.concurrency ?? 3, batches.length || 1)) }, worker));
  const scored = cands.filter((c) => c.a !== undefined && c.b !== undefined);
  report.checked = scored.length;
  report.flagged = scored
    .filter((c) => Math.max(c.a!, c.b!) >= minScore)
    .sort((x, y) => Math.max(y.a!, y.b!) - Math.max(x.a!, x.b!))
    .slice(0, FLAGGED_CAP)
    .map((c) => [c.i, c.a!, c.b!] as [number, number, number]);
  const after = cfg.llm.usage?.() ?? null;
  const usage: LlmUsageSnapshot | null = before && after ? {
    calls: after.calls - before.calls, prompt_tokens: after.prompt_tokens - before.prompt_tokens,
    completion_tokens: after.completion_tokens - before.completion_tokens, reasoning_tokens: after.reasoning_tokens - before.reasoning_tokens,
    cost_usd: after.cost_usd === null || before.cost_usd === null ? null : Math.round((after.cost_usd - before.cost_usd) * 1e8) / 1e8,
  } : null;
  return { report, usage };
}

// ادغامِ نتیجه‌یِ داور در polish_report (خالص): boundary_judge + usage.boundary_judge، و مصرفِ داور به usage.total اضافه می‌شود
// تا سقفِ بودجه‌یِ روزانه (spentToday) آن را هم بشمارد. ورودی را تغییر نمی‌دهد.
export function mergeJudgeIntoReport(report: Record<string, unknown>, judge: BoundaryJudgeReport, usage: LlmUsageSnapshot | null): Record<string, unknown> {
  const out: Record<string, unknown> = { ...report, boundary_judge: judge };
  const u = report.usage as { total?: LlmUsageSnapshot } | undefined;
  if (usage && u && u.total) {
    const t = u.total;
    out.usage = {
      ...u,
      total: {
        calls: t.calls + usage.calls, prompt_tokens: t.prompt_tokens + usage.prompt_tokens,
        completion_tokens: t.completion_tokens + usage.completion_tokens, reasoning_tokens: t.reasoning_tokens + usage.reasoning_tokens,
        cost_usd: t.cost_usd === null || usage.cost_usd === null ? null : Math.round((t.cost_usd + usage.cost_usd) * 1e8) / 1e8,
      },
      boundary_judge: usage,
    };
  } else if (usage) {
    out.usage = { ...(u || {}), boundary_judge: usage };
  }
  return out;
}
