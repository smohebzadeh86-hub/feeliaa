// دو مرحله‌ی LLM (digest، compose) هر کدام یک «اصلاحِ یک‌باره» دارند: اگر چکِ کدی تخلفی دید،
// همان مرحله یک بار با فهرستِ تخلف‌ها دوباره پرسیده می‌شود و فقط اگر تخلف کمتر شد جایگزین می‌شود.
// اصلاح فقط وقتی اجرا می‌شود که هنوز در بودجه‌ی زمانی باشیم: مرحله‌هایِ مدل گاهی ۵–۷ دقیقه
// می‌کشند و بدونِ سقف، دو retry تولید را از قفلِ ۸ دقیقه‌ایِ generateCaseFile بیرون می‌برد.
//
// تفاوتِ مهمِ مرحله‌ی ۲: حتی اگر اصلاح کمکی نکند، خروجی از finalizeDraft (کد) می‌گذرد؛ پس فکتِ
// رابطه‌ایِ گم‌شده به «موارد دیگر» می‌رود و نقل‌ها عینِ digest‌اند — حفظِ اطلاعات به retry وابسته نیست.
import { normalizeDeep } from '../domain/normalizeText.js';
import { validateCaseFileDraft, checkDigestCoverage } from '../domain/validate.js';
import { finalizeDraft, reportProblems } from '../domain/findings.js';
import { renderDigest } from './renderDigest.js';
import type { CaseFileDraft, CaseFileDigest, RawCaseFileDraft } from '../domain/types.js';
import type { LLMProvider, CaseFilePromptInput } from '../ports/llmProvider.port.js';
import type { ClientCorpus } from './aggregateClientCorpus.js';

export const REPAIR_BUDGET_MS = 5 * 60 * 1000;

export interface RepairHooks {
  startedAt: number;
  // قفلِ «در حال تولید» را تمدید می‌کند (heartbeat): قبل از هر فراخوانیِ LLM و هر heartbeatMs در «حینِ» آن.
  // فراخوانیِ مدل گاهی ۵–۸+ دقیقه می‌کشد (دیده‌شده: ۲۶۲/۲۹۳/۴۶۶ث)؛ تمدیدِ فقط-قبلِ-فراخوانی اجازه می‌داد
  // قفل وسطِ یک فراخوانیِ کند منقضی شود و درخواستِ دیگری تولیدِ هم‌زمانِ دوم را شروع کند.
  beforeCall?: () => Promise<void>;
  heartbeatMs?: number;
  // فقط شمارنده‌ها (بدونِ متنِ بالینی — LAW-001)
  log?: (msg: string) => void;
}

export const HEARTBEAT_MS = 30 * 1000;

const inBudget = (h: RepairHooks) => Date.now() - h.startedAt < REPAIR_BUDGET_MS;

// یک فراخوانیِ LLM با heartbeat؛ خطایِ تمدید (مثلاً DB) تولید را نمی‌کشد — فقط heartbeatِ آن دور رد می‌شود.
async function withBeat<T>(h: RepairHooks, fn: () => Promise<T>): Promise<T> {
  await h.beforeCall?.();
  const timer = h.beforeCall
    ? setInterval(() => { h.beforeCall!().catch(() => { /* دورِ بعد دوباره */ }); }, h.heartbeatMs ?? HEARTBEAT_MS)
    : null;
  try { return await fn(); } finally { if (timer) clearInterval(timer); }
}

const NOTE_HEADER = '\n\n[اصلاحِ الزامی — خروجیِ قبلی این موارد را نقض کرد؛ همان کار را دوباره و با رعایتِ کاملِ آن‌ها انجام بده]\n';
const asNote = (problems: string[]) => NOTE_HEADER + problems.map(p => '- ' + p).join('\n');
// digest: جمله‌هایِ افتاده باید در facts (با source مناسب) و correctedText بیایند، نه در quotes — در آزمونِ واقعی
// مدل برایِ راضی‌کردنِ چک جمله‌هایِ یادداشت را در quotes چپاند و بخشِ «نقل‌ها» آلوده شد.
const DIGEST_HINT = '\n(توجه: این جمله‌ها را به‌صورتِ فکتِ جدا در facts با category/source/about مناسب و در correctedText بیاور؛ آن‌ها را هرگز در quotes نگذار — quotes فقط برایِ گفته‌ی عینیِ مراجع/درمانگر داخلِ « » است.)';

export async function digestWithRepair(
  llm: LLMProvider, input: CaseFilePromptInput, corpus: ClientCorpus, h: RepairHooks
): Promise<CaseFileDigest> {
  let digest = normalizeDeep(await withBeat(h, () => llm.digestCorpus(input)));
  const problems = checkDigestCoverage(corpus, digest);
  if (!problems.length) return digest;
  if (!inBudget(h)) { h.log?.(`digest: ${problems.length} تخلف، اصلاح ردشد (بودجه‌ی زمانی)`); return digest; }
  try {
    const retry = normalizeDeep(await withBeat(h, () => llm.digestCorpus({ ...input, corpusText: input.corpusText + asNote(problems) + DIGEST_HINT })));
    const after = checkDigestCoverage(corpus, retry);
    if (after.length < problems.length) digest = retry;
    h.log?.(`digest: تخلف ${problems.length} → ${after.length}`);
  } catch {
    h.log?.(`digest: اصلاح شکست خورد؛ ${problems.length} تخلف باقی ماند`);
  }
  return digest;
}

export async function composeWithRepair(
  llm: LLMProvider, input: CaseFilePromptInput, digest: CaseFileDigest | null, h: RepairHooks, extraCorpusText = ''
): Promise<CaseFileDraft> {
  const baseText = digest ? renderDigest(digest) : input.corpusText;
  const composeInput = { ...input, corpusText: extraCorpusText ? baseText + '\n\n' + extraCorpusText : baseText };
  const raw: RawCaseFileDraft = normalizeDeep(await withBeat(h, () => llm.generateCaseFile(composeInput)));
  validateCaseFileDraft(raw);
  let best = finalizeDraft(raw, digest);
  const problems = reportProblems(best.report);
  if (!problems.length) return best.draft;
  if (!inBudget(h)) { h.log?.(`compose: ${problems.length} تخلف، اصلاح ردشد (بودجه‌ی زمانی؛ بازیابیِ کدی اعمال شد)`); return best.draft; }
  try {
    const retryRaw: RawCaseFileDraft = normalizeDeep(await withBeat(h, () => llm.generateCaseFile({ ...composeInput, corpusText: composeInput.corpusText + asNote(problems) })));
    validateCaseFileDraft(retryRaw);
    const retry = finalizeDraft(retryRaw, digest);
    const after = reportProblems(retry.report);
    if (after.length < problems.length) best = retry;
    h.log?.(`compose: تخلف ${problems.length} → ${after.length}`);
  } catch {
    h.log?.(`compose: اصلاح شکست خورد؛ ${problems.length} تخلف باقی ماند (بازیابیِ کدی اعمال شد)`);
  }
  return best.draft;
}
