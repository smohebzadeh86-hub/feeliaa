// نقطه‌ی تکی برای انتخاب provider — برای عوض‌کردن LLM (مثلاً بعداً Anthropic)، فقط
// یک آداپتور جدید اینجا اضافه می‌شود؛ application/domain/frontend لمس نمی‌شوند.
import type { LLMProvider } from '../../ports/llmProvider.port.js';
import { OpenAIAdapter } from './openai.adapter.js';
import { OpenRouterAdapter } from './openrouter.adapter.js';

export function resolveLLMProvider(): LLMProvider {
  const kind = process.env.LLM_PROVIDER || 'openai';
  switch (kind) {
    case 'openai':
      return new OpenAIAdapter();
    case 'openrouter':
      return new OpenRouterAdapter();
    default:
      throw new Error(`LLM_PROVIDER نامعتبر: ${kind}`);
  }
}
