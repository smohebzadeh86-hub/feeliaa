// تنها فایلی که 'openai' SDK و OPENAI_API_KEY را import/می‌خواند (همان الگوی
// stt/tempkey.ts برای SONIOX_API_KEY — کلید هرگز از این فایل خارج نمی‌شود، هرگز به
// فرانت نمی‌رود، فراخوانی کاملاً سرور-به-سرور است).
//
// عمداً بدون هیچ tools/functions — طبق اصل صریح مالک: مدل فقط از متن دادهشده
// استفاده می‌کند، نمی‌تواند از دانش عمومی/اینترنت چیزی «اضافه» کند.
//
// ⚠️ هیچ‌جا payload/response کامل لاگ نمی‌شود — ممکن است داده‌ی بالینی (LAW-001) داشته باشد.
import OpenAI from 'openai';
import type { LLMProvider, CaseFilePromptInput } from '../../ports/llmProvider.port.js';
import type { CaseFileDraft, CaseFileDigest } from '../../domain/types.js';
import { CaseFileGenerationError } from '../../domain/errors.js';
import { CASE_FILE_SYSTEM_PROMPT, CASE_FILE_DIGEST_SYSTEM_PROMPT, describeClientMeta } from '../../application/buildCaseFilePrompt.js';
import { CASE_FILE_JSON_SCHEMA } from './caseFileJsonSchema.js';
import { CASE_FILE_DIGEST_JSON_SCHEMA } from './caseFileDigestSchema.js';
import { callStructured } from './chatJson.js';

export class OpenAIAdapter implements LLMProvider {
  private client: OpenAI;
  readonly model: string;

  // ⭐ عمداً بدون مدل hardcode‌شده در کد (تصمیم صریح مالک) — OPENAI_CASE_FILE_MODEL
  // در server/.env الزامی است، نه یک fallback در کد.
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new CaseFileGenerationError('llm-failed', 'کلید OpenAI روی سرور تنظیم نشده');
    }
    const model = process.env.OPENAI_CASE_FILE_MODEL;
    if (!model) {
      throw new CaseFileGenerationError('llm-failed', 'OPENAI_CASE_FILE_MODEL روی سرور تنظیم نشده');
    }
    this.model = model;
    this.client = new OpenAI({ apiKey });
  }

  async digestCorpus(input: CaseFilePromptInput): Promise<CaseFileDigest> {
    const userPrompt = `${describeClientMeta(input.clientMeta)}

متن خام جلسات ثبت‌شده:
${input.corpusText}`;
    return callStructured<CaseFileDigest>(
      this.client, this.model, 'OpenAI', CASE_FILE_DIGEST_SYSTEM_PROMPT, userPrompt, CASE_FILE_DIGEST_JSON_SCHEMA
    );
  }

  async generateCaseFile(input: CaseFilePromptInput): Promise<CaseFileDraft> {
    const userPrompt = `${describeClientMeta(input.clientMeta)}

خلاصه‌ی تصحیح‌شده‌ی جلسات ثبت‌شده:
${input.corpusText}`;
    return callStructured<CaseFileDraft>(
      this.client, this.model, 'OpenAI', CASE_FILE_SYSTEM_PROMPT, userPrompt, CASE_FILE_JSON_SCHEMA
    );
  }
}
