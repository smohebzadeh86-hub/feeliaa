// هلپر مشترک هر دو adapter (OpenAI/OpenRouter) برای یک فراخوانی structured-output.
// بدون tools؛ هیچ‌جا payload/response کامل لاگ نمی‌شود (LAW-001).
import type OpenAI from 'openai';
import { CaseFileGenerationError } from '../../domain/errors.js';

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
      `فراخوانی ${providerLabel} ناموفق بود: ` + (err instanceof Error ? err.message : 'خطای نامشخص')
    );
  }
  if (!raw) throw new CaseFileGenerationError('llm-invalid-output', `پاسخ خالی از ${providerLabel}`);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new CaseFileGenerationError('llm-invalid-output', `پاسخ ${providerLabel} JSON معتبر نبود`);
  }
}
