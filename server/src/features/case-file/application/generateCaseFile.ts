// Use-case اصلی — فقط با دو port کار می‌کند؛ هیچ importی از 'openai' یا هر provider
// دیگری اینجا نیست. تنها مسیرِ نوشتن: caseFileRepo (یک‌طرفه، هرگز sessions/session_notes
// را تغییر نمی‌دهد — پرونده‌ی سنتزشده از دیتایِ خام کاملاً جدا است).
import { aggregateClientCorpus } from './aggregateClientCorpus.js';
import { buildCaseFilePrompt } from './buildCaseFilePrompt.js';
import { mergeCaseFileDraft } from './mergeTherapistEdits.js';
import { renderDigest } from './renderDigest.js';
import { normalizeDeep } from '../domain/normalizeText.js';
import { validateCaseFileDraft, enforceCaseFileRules } from '../domain/validate.js';
import { CaseFileGenerationError } from '../domain/errors.js';
import type { LLMProvider } from '../ports/llmProvider.port.js';
import type { CaseFileRepository, CaseFileRecord } from '../ports/caseFileRepo.port.js';

export interface GenerateCaseFileDeps {
  llmProvider: LLMProvider;
  caseFileRepo: CaseFileRepository;
}

export interface GenerateCaseFileOptions {
  force?: boolean;
  therapistId?: string;
}

export interface GenerateCaseFileResult {
  record: CaseFileRecord;
  skipped: boolean;
}

// دو فراخوانیِ پیاپیِ LLM (digest + compose) — canary روی OpenRouter: ~۵۸ + ~۱۰۷ ثانیه؛ TTL باید بیشتر باشد.
const GENERATING_LOCK_TTL_MS = 8 * 60 * 1000;

export async function generateCaseFile(
  clientId: string,
  clientMeta: { category: string | null; gender: string | null; alias: string | null },
  deps: GenerateCaseFileDeps,
  opts: GenerateCaseFileOptions = {}
): Promise<GenerateCaseFileResult> {
  const { llmProvider, caseFileRepo } = deps;

  // force=true ⇒ بازتولیدِ کامل، حتی فیلدهایِ تاییدشده دور ریخته می‌شوند (تصمیمِ
  // آگاهانه و خطرناک — فقط با تاییدِ دوباره در UI قابلِ فراخوانی است)
  const previous = await caseFileRepo.get(clientId);

  if (previous?.status === 'generating' && previous.generatingStartedAt) {
    const startedAt = new Date(previous.generatingStartedAt).getTime();
    if (Date.now() - startedAt < GENERATING_LOCK_TTL_MS) {
      throw new CaseFileGenerationError('busy', 'در حالِ تولید است — چند لحظه صبر کنید');
    }
    // قفلِ قدیمی‌تر از ۳ دقیقه یعنی تلاشِ قبلی احتمالاً crash کرده — ادامه بده
  }

  const corpus = await aggregateClientCorpus(clientId);

  if (!opts.force && previous?.status === 'ready' && previous.corpusSignature === corpus.corpusSignature) {
    return { record: previous, skipped: true };
  }

  await caseFileRepo.markGenerating(clientId);

  try {
    const promptInput = buildCaseFilePrompt(corpus, clientMeta);
    // مرحله‌ی ۱: فهم و تصحیحِ متنِ خام. corpusِ خالی (بدونِ جلسه) digest نمی‌خواهد.
    const digest = corpus.sessions.length
      ? normalizeDeep(await llmProvider.digestCorpus(promptInput))
      : null;
    // مرحله‌ی ۲: چیدنِ پرونده از رویِ digest
    const draft = normalizeDeep(
      await llmProvider.generateCaseFile(digest ? { ...promptInput, corpusText: renderDigest(digest) } : promptInput)
    );
    validateCaseFileDraft(draft);
    enforceCaseFileRules(draft);

    const content = mergeCaseFileDraft(opts.force ? null : previous?.content ?? null, draft, corpus);

    const record = await caseFileRepo.upsert(clientId, {
      content,
      status: 'ready',
      model: llmProvider.model,
      generatedAt: new Date(),
      generatedFromSessionId: corpus.latestSessionId,
      corpusSignature: corpus.corpusSignature,
      errorMessage: null,
      ...(opts.force
        ? { forceRegeneratedAt: new Date(), forceRegeneratedBy: opts.therapistId ?? null }
        : {}),
    });
    return { record, skipped: false };
  } catch (err) {
    // ⭐ باگِ واقعیِ رفع‌شده: قبلاً هر خطایِ غیرِ CaseFileGenerationError (مثلاً
    // CaseFileValidationError از validateCaseFileDraft) با یک پیامِ عمومیِ بی‌فایده
    // جایگزین می‌شد — دلیلِ واقعیِ شکست هم در پاسخِ API هم در error_message گم می‌شد.
    const message = err instanceof Error ? err.message : 'تولیدِ پرونده ناموفق بود';
    await caseFileRepo.markError(clientId, message);
    throw err instanceof CaseFileGenerationError ? err : new CaseFileGenerationError('unknown', message);
  }
}
