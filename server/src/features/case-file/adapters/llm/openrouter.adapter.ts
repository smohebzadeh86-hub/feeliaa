// آداپتور OpenRouter — تنها فایلی که OPENROUTER_API_KEY را می‌خواند. OpenRouter یک
// endpoint سازگار با OpenAI SDK دارد (فقط baseURL عوض می‌شود)، پس از همان SDK 'openai'
// استفاده می‌کنیم، نه یک client جدا. همان قاعده‌ی openai.adapter.ts: بدون tools/functions،
// هیچ‌جا payload/response کامل لاگ نمی‌شود.
import OpenAI from 'openai';
import type { LLMProvider, CaseFilePromptInput } from '../../ports/llmProvider.port.js';
import type { RawCaseFileDraft, CaseFileDigest } from '../../domain/types.js';
import { CaseFileGenerationError } from '../../domain/errors.js';
import { CASE_FILE_SYSTEM_PROMPT, CASE_FILE_DIGEST_SYSTEM_PROMPT, describeClientMeta } from '../../application/buildCaseFilePrompt.js';
import { CASE_FILE_JSON_SCHEMA } from './caseFileJsonSchema.js';
import { CASE_FILE_DIGEST_JSON_SCHEMA } from './caseFileDigestSchema.js';
import { callStructured } from './chatJson.js';

// سقفِ «فکرِ پنهان» (reasoning): در آزمونِ واقعی (2026-09-20، دادهٔ ساختگی، همین مدل) یک اجرا ۱۴٬۱۳۲ توکنِ
// reasoning از ۱۷٬۳۶۸ توکن داشت و ۷۸۹ثانیه طول کشید؛ اجراهایِ بدونِ reasoning ۱۸۴–۲۷۸ثانیه (۲٫۳–۳٫۵ هزار توکن).
// پیش‌فرض 'low'؛ با OPENROUTER_REASONING_EFFORT قابلِ تغییر (minimal|low|medium|high) یا 'default' = هیچ پارامتری
// نفرست (رفتارِ پیش‌فرضِ provider).
const REASONING_EFFORTS = ['minimal', 'low', 'medium', 'high'];
export function resolveReasoningBody(env: string | undefined): Record<string, unknown> | undefined {
  const v = (env || 'low').trim().toLowerCase();
  if (v === 'default') return undefined;
  if (!REASONING_EFFORTS.includes(v)) {
    throw new CaseFileGenerationError('llm-failed', `OPENROUTER_REASONING_EFFORT نامعتبر است (${REASONING_EFFORTS.join('|')}|default)`);
  }
  return { reasoning: { effort: v } };
}

export class OpenRouterAdapter implements LLMProvider {
  private client: OpenAI;
  readonly model: string;
  private extraBody: Record<string, unknown> | undefined;

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
    this.extraBody = {
      ...(resolveReasoningBody(process.env.OPENROUTER_REASONING_EFFORT) ?? {}),
      // همان مدل ممکن است روی چند provider عرضه شود؛ سریع‌ترین provider برای کارِ تعاملی
      // مناسب‌تر است و کیفیت/مدل را عوض نمی‌کند.
      provider: { sort: 'latency' },
    };
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      // timeout ده‌دقیقه‌ای همراه با ۲ retry می‌توانست یک مرحله را تا حدود ۳۰ دقیقه معطل کند.
      // repairLoop خودش retry محتواییِ کنترل‌شده دارد؛ در خطای شبکه وضعیت error می‌شود تا
      // تراپیست فوراً تصمیم بگیرد، نه اینکه بی‌پایان منتظر بماند.
      timeout: 5 * 60 * 1000,
      maxRetries: 0,
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
    return this.timed('digest', () => callStructured<CaseFileDigest>(
      this.client, this.model, 'OpenRouter', CASE_FILE_DIGEST_SYSTEM_PROMPT, userPrompt, CASE_FILE_DIGEST_JSON_SCHEMA, this.extraBody
    ));
  }

  async generateCaseFile(input: CaseFilePromptInput): Promise<RawCaseFileDraft> {
    const userPrompt = `${describeClientMeta(input.clientMeta)}

خلاصه‌ی تصحیح‌شده‌ی جلسات ثبت‌شده:
${input.corpusText}`;
    return this.timed('compose', () => callStructured<RawCaseFileDraft>(
      this.client, this.model, 'OpenRouter', CASE_FILE_SYSTEM_PROMPT, userPrompt, CASE_FILE_JSON_SCHEMA, this.extraBody
    ));
  }

  // فقط مدت و نامِ مرحله؛ هرگز متن یا داده‌ی بالینی در لاگ نمی‌آید.
  private async timed<T>(stage: string, fn: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    try {
      const result = await fn();
      console.log(`[case-file] OpenRouter ${stage} completed in ${Date.now() - startedAt}ms`);
      return result;
    } catch (err) {
      console.log(`[case-file] OpenRouter ${stage} failed after ${Date.now() - startedAt}ms`);
      throw err;
    }
  }
}
