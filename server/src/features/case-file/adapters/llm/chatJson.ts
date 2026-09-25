// هلپر مشترک هر دو adapter (OpenAI/OpenRouter) برای یک فراخوانی structured-output.
// بدون tools؛ هیچ‌جا payload/response کامل لاگ نمی‌شود (LAW-001).
import type OpenAI from 'openai';
import { CaseFileGenerationError } from '../../domain/errors.js';

// خطایِ گذرا: بدونِ status (خطایِ اتصال/timeout/قطعِ بدنه — مثلاً ECONNRESETِ مشاهده‌شده در E2E 2026-09-25) یا
// statusِ 408/429/5xx. خطایِ 4xxِ دیگر (کلید/مدل/درخواستِ نامعتبر) گذرا نیست — تکرارش فقط هزینه است.
export function isTransientLlmError(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === 'number') return status === 408 || status === 429 || status >= 500;
  const text = err instanceof Error ? `${err.name} ${err.message} ${(err as any).code ?? ''} ${(err as any).cause?.code ?? ''}` : String(err);
  return /connection|timed? ?out|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|ENOTFOUND|EAI_AGAIN|socket|network|fetch failed|terminated|Invalid response body/i.test(text);
}

export async function callStructured<T>(
  client: OpenAI,
  model: string,
  providerLabel: string,
  system: string,
  user: string,
  schema: unknown,
  // پارامترهایِ اضافیِ خاصِ provider (مثلاً reasoning در OpenRouter)؛ به بدنه‌ی درخواست اضافه می‌شود
  extraBody?: Record<string, unknown>
): Promise<T> {
  let raw: string | null | undefined;
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_schema', json_schema: schema } as any,
      ...(extraBody ?? {}),
    } as any);
    raw = response.choices[0]?.message?.content;
  } catch (err) {
    throw new CaseFileGenerationError(
      'llm-failed',
      `فراخوانی ${providerLabel} ناموفق بود: ` + (err instanceof Error ? err.message : 'خطای نامشخص'),
      { transient: isTransientLlmError(err) }
    );
  }
  if (!raw) throw new CaseFileGenerationError('llm-invalid-output', `پاسخ خالی از ${providerLabel}`);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new CaseFileGenerationError('llm-invalid-output', `پاسخ ${providerLabel} JSON معتبر نبود`);
  }
}
