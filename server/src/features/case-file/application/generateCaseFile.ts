// Use-case اصلی — فقط با دو port کار می‌کند؛ هیچ importی از 'openai' یا هر provider
// دیگری اینجا نیست. تنها مسیرِ نوشتن: caseFileRepo (یک‌طرفه، هرگز sessions/session_notes
// را تغییر نمی‌دهد — پرونده‌ی سنتزشده از دیتایِ خام کاملاً جدا است).
import { aggregateClientCorpus } from './aggregateClientCorpus.js';
import { buildCaseFilePrompt, buildAnsweredQuestionsBlock } from './buildCaseFilePrompt.js';
import { mergeCaseFileDraft } from './mergeTherapistEdits.js';
import { digestWithRepair, composeWithRepair } from './repairLoop.js';
import { enforceCaseFileRules } from '../domain/validate.js';
import { CaseFileGenerationError } from '../domain/errors.js';
import type { LLMProvider } from '../ports/llmProvider.port.js';
import type { CaseFileRepository, CaseFileRecord } from '../ports/caseFileRepo.port.js';
import { logEvent } from '../../../obs/eventLog.js';

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

// قفلِ «در حال تولید» با heartbeat (هر ۳۰ثانیه، حینِ هر فراخوانیِ LLM — repairLoop.withBeat) زنده نگه داشته می‌شود؛
// پس TTL فقط «مدتِ بی‌heartbeat» است: تولیدِ زنده هر قدر کند باشد قفلش نمی‌پرد (فراخوانیِ مرحله‌ی ۲ تا ۴۶۶ث دیده شد)،
// و اگر سرور وسطِ تولید بمیرد، بعد از ۴ دقیقه آزاد می‌شود (قبلاً ۸ دقیقه).
const GENERATING_LOCK_TTL_MS = 4 * 60 * 1000;

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
    // بی‌heartbeat بیش از TTL یعنی تلاشِ قبلی احتمالاً crash کرده — ادامه بده
  }

  const corpus = await aggregateClientCorpus(clientId);
  // پاسخ‌هایِ ثبت‌شده به سوالاتِ باز هم دیتا هستند (مثلِ یادداشت)؛ باید هم به prompt برسند
  // هم در تشخیصِ «داده‌ی جدید» لحاظ شوند — وگرنه دکمه‌ی «به‌روزرسانی» بعدِ پاسخ‌دادن اثری ندارد
  // چون corpusSignature فقط از sessions/session_notes می‌آید و با پاسخ عوض نمی‌شود.
  const answeredQuestions = previous?.content?.answeredQuestions ?? [];
  const effectiveSignature = answeredQuestions.length
    ? corpus.corpusSignature + '::qa:' + answeredQuestions.map(q => q.id).sort().join(',')
    : corpus.corpusSignature;

  if (!opts.force && previous?.status === 'ready' && previous.corpusSignature === effectiveSignature) {
    return { record: previous, skipped: true };
  }

  await caseFileRepo.markGenerating(clientId);

  try {
    const promptInput = buildCaseFilePrompt(corpus, clientMeta);
    const hooks = {
      startedAt: Date.now(),
      // قفلِ «در حال تولید» قبل از هر مرحله‌ی LLM تمدید می‌شود؛ وگرنه دو مرحله + اصلاح از TTL می‌گذشت
      // و درخواستِ هم‌زمانِ دیگر می‌توانست تولیدِ دوم را شروع کند.
      beforeCall: () => caseFileRepo.markGenerating(clientId),
      log: (m: string) => console.log('[case-file] ' + m),
    };
    // مرحله‌ی ۱: فهم و تصحیحِ متنِ خام. corpusِ خالی (بدونِ جلسه) digest نمی‌خواهد.
    const digest = corpus.sessions.length ? await digestWithRepair(llmProvider, promptInput, corpus, hooks) : null;
    // مرحله‌ی ۲: چیدنِ پرونده از رویِ digest (با اصلاحِ یک‌باره در صورتِ تخلفِ ساختار/حفظِ فکت).
    // پاسخ‌هایِ ثبت‌شده مستقیماً اینجا چسبانده می‌شوند (نه به ورودیِ مرحله‌ی ۱ — نگاه کنید به buildAnsweredQuestionsBlock).
    const draft = await composeWithRepair(llmProvider, promptInput, digest, hooks, buildAnsweredQuestionsBlock(answeredQuestions));
    enforceCaseFileRules(draft);

    const content = mergeCaseFileDraft(opts.force ? null : previous?.content ?? null, draft, corpus);

    const record = await caseFileRepo.upsert(clientId, {
      content,
      status: 'ready',
      model: llmProvider.model,
      generatedAt: new Date(),
      generatedFromSessionId: corpus.latestSessionId,
      corpusSignature: effectiveSignature,
      errorMessage: null,
      ...(opts.force
        ? { forceRegeneratedAt: new Date(), forceRegeneratedBy: opts.therapistId ?? null }
        : {}),
    });
    logEvent({ event: 'casefile.generated', clientId, therapistId: opts.therapistId, detail: { model: llmProvider.model } });
    return { record, skipped: false };
  } catch (err) {
    // ⭐ باگِ واقعیِ رفع‌شده: قبلاً هر خطایِ غیرِ CaseFileGenerationError (مثلاً
    // CaseFileValidationError از validateCaseFileDraft) با یک پیامِ عمومیِ بی‌فایده
    // جایگزین می‌شد — دلیلِ واقعیِ شکست هم در پاسخِ API هم در error_message گم می‌شد.
    const message = err instanceof Error ? err.message : 'تولیدِ پرونده ناموفق بود';
    await caseFileRepo.markError(clientId, message);
    logEvent({ event: 'casefile.failed', clientId, therapistId: opts.therapistId, severity: 'error' });
    throw err instanceof CaseFileGenerationError ? err : new CaseFileGenerationError('unknown', message);
  }
}
