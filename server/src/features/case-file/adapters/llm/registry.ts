// نقطه‌ی تکی برای انتخاب provider — provider/مدل/پارامترها کاملاً از env (src/llm/config.ts)؛ application/domain/frontend
// لمس نمی‌شوند. providerِ جدیدِ سازگار با OpenAI = یک ردیف در PROFILES یا LLM_PROVIDER=custom بدونِ تغییرِ کد.
import type { LLMProvider } from '../../ports/llmProvider.port.js';
import { CaseFileGenerationError } from '../../domain/errors.js';
import { createJsonCaller } from '../../../../llm/jsonCall.js';
import { ChatLlmAdapter } from './chatLlm.adapter.js';

export function resolveLLMProvider(): LLMProvider {
  try {
    return new ChatLlmAdapter(createJsonCaller('case-file'));
  } catch (e) {
    throw new CaseFileGenerationError('llm-failed', (e as Error).message);
  }
}
