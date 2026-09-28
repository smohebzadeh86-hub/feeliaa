// آداپتورِ LLM برایِ مرتب‌سازیِ متن — همان provider و کلیدِ پرونده‌ی درمان (LLM_PROVIDER)، ولی client و timeoutِ جدا.
// پورت و پرامپت‌هایِ case-file دست نمی‌خورند. از callStructuredِ مشترک استفاده می‌شود (خطایِ گذرا ⇒ transient).
// ⚠️ LAW-001: هیچ‌جا payload/response لاگ نمی‌شود — فقط مدت و نامِ گذر.
import OpenAI from 'openai';
import { callStructured } from '../../case-file/adapters/llm/chatJson.js';
import { resolveReasoningBody } from '../../case-file/adapters/llm/openrouter.adapter.js';
import type { LlmJsonPort } from '../ports.js';

export class FinalTranscriptConfigError extends Error {
  transient = false;
  constructor(message: string) { super(message); this.name = 'FinalTranscriptConfigError'; }
}

function envInt(name: string, def: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

export function createTranscriptLlm(): LlmJsonPort {
  const kind = process.env.LLM_PROVIDER || 'openai';
  const timeout = envInt('FINAL_TRANSCRIPT_LLM_TIMEOUT_MS', 3 * 60_000);
  // سقفِ توکنِ خروجی (2026-09-28): بدونِ آن OpenRouter برایِ هر درخواست سقفِ کاملِ مدل (۱۳۱۰۷۲ توکن) را از اعتبار رزرو
  // می‌کند و با اعتبارِ کم «402 … requires more credits, or fewer max_tokens» می‌دهد، هرچند مصرفِ واقعی کم است.
  // خروجیِ یک تکه (≤ FINAL_TRANSCRIPT_CHUNK_CHARS نویسه) + استدلال زیرِ این سقف است؛ خروجیِ بریده ⇒ JSONِ نامعتبر ⇒
  // تکه خام می‌ماند (گذرِ برداشتِ کلی: تلاشِ دوباره).
  const maxTokens = envInt('FINAL_TRANSCRIPT_MAX_TOKENS', 16_384);
  let client: OpenAI;
  let model: string | undefined;
  let label: string;
  let extraBody: Record<string, unknown> | undefined;
  if (kind === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    model = process.env.FINAL_TRANSCRIPT_MODEL || process.env.OPENROUTER_MODEL;
    if (!apiKey || !model) throw new FinalTranscriptConfigError('کلید یا مدلِ OpenRouter رویِ سرور تنظیم نشده');
    label = 'OpenRouter';
    extraBody = {
      ...(resolveReasoningBody(process.env.FINAL_TRANSCRIPT_REASONING_EFFORT || process.env.OPENROUTER_REASONING_EFFORT) ?? {}),
      provider: { sort: 'latency' },
      max_tokens: maxTokens,
    };
    client = new OpenAI({
      apiKey, baseURL: 'https://openrouter.ai/api/v1', timeout, maxRetries: 0,
      defaultHeaders: { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://feelia.ir', 'X-Title': 'Feelia - Final Transcript' },
    });
  } else if (kind === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    model = process.env.FINAL_TRANSCRIPT_MODEL || process.env.OPENAI_CASE_FILE_MODEL;
    if (!apiKey || !model) throw new FinalTranscriptConfigError('کلید یا مدلِ OpenAI رویِ سرور تنظیم نشده');
    label = 'OpenAI';
    client = new OpenAI({ apiKey, timeout, maxRetries: 0 });
    // مدل‌هایِ جدیدِ OpenAI (reasoning) فقط max_completion_tokens را می‌پذیرند
    extraBody = { max_completion_tokens: maxTokens };
  } else {
    throw new FinalTranscriptConfigError(`LLM_PROVIDER نامعتبر: ${kind}`);
  }
  const m = model;
  return {
    model: m,
    async completeJson<T>(system: string, user: string, schema: unknown): Promise<T> {
      const startedAt = Date.now();
      try {
        const r = await callStructured<T>(client, m, label, system, user, schema, extraBody);
        console.log(`[final-transcript] ${label} call ok in ${Date.now() - startedAt}ms`);
        return r;
      } catch (e) {
        console.log(`[final-transcript] ${label} call failed after ${Date.now() - startedAt}ms`);
        throw e;
      }
    },
  };
}
