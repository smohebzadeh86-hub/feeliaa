// تنها آداپتورِ LLMِ پرونده‌ی درمان — مستقل از provider (2026-09-28). انتخابِ provider/مدل/حالتِ JSON/استدلال کاملاً
// در src/llm/config.ts و env است؛ اینجا فقط پرامپت‌ها و schemaهایِ پرونده به هسته‌ی مشترک داده می‌شوند و خطا به
// خطایِ دامنه (CaseFileGenerationError) ترجمه می‌شود (Anti-Corruption Layer).
// ⚠️ هیچ‌جا payload/response کامل لاگ نمی‌شود — ممکن است داده‌ی بالینی (LAW-001) داشته باشد.
import type { LLMProvider, CaseFilePromptInput } from '../../ports/llmProvider.port.js';
import type { RawCaseFileDraft, CaseFileDigest } from '../../domain/types.js';
import { CaseFileGenerationError } from '../../domain/errors.js';
import { validateCaseFileDraft } from '../../domain/validate.js';
import { CASE_FILE_SYSTEM_PROMPT, CASE_FILE_DIGEST_SYSTEM_PROMPT } from '../../prompts/systemPrompts.js';
import { digestUserPrompt, composeUserPrompt } from '../../prompts/userPrompts.js';
import { CASE_FILE_JSON_SCHEMA } from './caseFileJsonSchema.js';
import { CASE_FILE_DIGEST_JSON_SCHEMA } from './caseFileDigestSchema.js';
import type { JsonCaller, JsonCallOptions } from '../../../../llm/jsonCall.js';

export class ChatLlmAdapter implements LLMProvider {
  constructor(private caller: JsonCaller) {}

  // provider:model ِ آخرین پاسخِ موفق — generateCaseFile آن را در client_case_file.model ذخیره می‌کند
  get model(): string {
    return this.caller.modelTag;
  }

  async digestCorpus(input: CaseFilePromptInput): Promise<CaseFileDigest> {
    const userPrompt = digestUserPrompt(input);
    return this.call<CaseFileDigest>('digest', CASE_FILE_DIGEST_SYSTEM_PROMPT, userPrompt, CASE_FILE_DIGEST_JSON_SCHEMA);
  }

  async generateCaseFile(input: CaseFilePromptInput): Promise<RawCaseFileDraft> {
    const userPrompt = composeUserPrompt(input);
    // بدونِ schemaِ strict (مثلاً DeepSeek) ساختارِ عمیق تضمین نیست ⇒ همان validateCaseFileDraft ِ repairLoop اینجا هم
    // اجرا می‌شود تا خروجیِ بدساختار یک بار دوباره پرسیده شود، نه اینکه کلِ تولید fail شود.
    return this.call<RawCaseFileDraft>('compose', CASE_FILE_SYSTEM_PROMPT, userPrompt, CASE_FILE_JSON_SCHEMA, { validate: validateCaseFileDraft });
  }

  // فقط مدت و نامِ مرحله؛ هرگز متن یا داده‌ی بالینی در لاگ نمی‌آید.
  private async call<T>(stage: string, system: string, user: string, schema: unknown, opts?: JsonCallOptions): Promise<T> {
    const startedAt = Date.now();
    try {
      const result = await this.caller.complete<T>(system, user, schema, opts);
      console.log(`[case-file] ${this.caller.label} ${stage} completed in ${Date.now() - startedAt}ms`);
      return result;
    } catch (err) {
      console.log(`[case-file] ${this.caller.label} ${stage} failed after ${Date.now() - startedAt}ms`);
      const e = err as { code?: string; transient?: boolean; message?: string };
      const code = e?.code === 'llm-invalid-output' ? 'llm-invalid-output' : 'llm-failed';
      throw new CaseFileGenerationError(code, e?.message || 'خطای نامشخص', { transient: !!e?.transient });
    }
  }
}
