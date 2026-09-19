// آداپتور OpenRouter — تنها فایلی که OPENROUTER_API_KEY را می‌خواند. OpenRouter یک
// endpoint سازگار با OpenAI SDK دارد (فقط baseURL عوض می‌شود)، پس از همان SDK 'openai'
// استفاده می‌کنیم، نه یک client جدا. همان قاعده‌ی openai.adapter.ts: بدون tools/functions،
// هیچ‌جا payload/response کامل لاگ نمی‌شود.
import OpenAI from 'openai';
import type { LLMProvider, CaseFilePromptInput } from '../../ports/llmProvider.port.js';
import type { CaseFileDraft, CaseFileDigest } from '../../domain/types.js';
import { CaseFileGenerationError } from '../../domain/errors.js';
import { CASE_FILE_SYSTEM_PROMPT, CASE_FILE_DIGEST_SYSTEM_PROMPT, describeClientMeta } from '../../application/buildCaseFilePrompt.js';
import { CASE_FILE_JSON_SCHEMA } from './caseFileJsonSchema.js';
import { CASE_FILE_DIGEST_JSON_SCHEMA } from './caseFileDigestSchema.js';
import { callStructured } from './chatJson.js';

export class OpenRouterAdapter implements LLMProvider {
  private client: OpenAI;
  readonly model: string;

  // ⭐ عمداً بدون مدل hardcode‌شده در کد (تصمیم صریح مالک) — OPENROUTER_MODEL در
  // server/.env الزامی است؛ انتخاب مدل (کیفیت/هزینه/پشتیبانی strict json_schema) کاملاً
  // دست مالک است.
  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new CaseFileGenerationError('llm-failed', 'کلید OpenRouter روی سرور تنظیم نشده');
    }
    const model = process.env.OPENROUTER_MODEL;
    if (!model) {
      throw new CaseFileGenerationError('llm-failed', 'OPENROUTER_MODEL روی سرور تنظیم نشده');
    }
    this.model = model;
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      // هدرهای توصیه‌شده‌ی OpenRouter برای شناسایی اپ در داشبوردشان — بدون داده‌ی کاربر/بالینی.
      defaultHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://feelia.ir',
        // ⭐ باگ واقعی کشف‌شده: em-dash (—) در مقدار هدر یک بایت‌ غیر ASCII است و
        // Node آن را «not a legal HTTP header value» رد می‌کند — کل فراخوانی با یک
        // «Connection error» گمراه‌کننده fail می‌شد، نه خطای واضح هدر.
        'X-Title': 'Feelia - Case File',
      },
    });
  }

  async digestCorpus(input: CaseFilePromptInput): Promise<CaseFileDigest> {
    const userPrompt = `${describeClientMeta(input.clientMeta)}

متن خام جلسات ثبت‌شده:
${input.corpusText}`;
    return callStructured<CaseFileDigest>(
      this.client, this.model, 'OpenRouter', CASE_FILE_DIGEST_SYSTEM_PROMPT, userPrompt, CASE_FILE_DIGEST_JSON_SCHEMA
    );
  }

  async generateCaseFile(input: CaseFilePromptInput): Promise<CaseFileDraft> {
    const userPrompt = `${describeClientMeta(input.clientMeta)}

خلاصه‌ی تصحیح‌شده‌ی جلسات ثبت‌شده:
${input.corpusText}`;
    return callStructured<CaseFileDraft>(
      this.client, this.model, 'OpenRouter', CASE_FILE_SYSTEM_PROMPT, userPrompt, CASE_FILE_JSON_SCHEMA
    );
  }
}
