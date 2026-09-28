// سیم‌کشیِ adapterها برایِ مصرف‌کننده‌هایِ داخلِ feature (routes، autoTrigger) — application/domain هیچ adapterی را
// مستقیم import نمی‌کنند. SqlCaseFileRepository بدونِ state است؛ یک instance برایِ همه کافی است. provider در هر
// فراخوانی از env ساخته می‌شود (همان رفتارِ قبلی: کلید/مدل هنگامِ فراخوانی خوانده می‌شود).
import { SqlCaseFileRepository } from './adapters/repository/caseFileRepository.sql.js';
import { resolveLLMProvider } from './adapters/llm/registry.js';
import type { CaseFileRepository } from './ports/caseFileRepo.port.js';
import type { LLMProvider } from './ports/llmProvider.port.js';

export const caseFileRepo: CaseFileRepository = new SqlCaseFileRepository();

export function llmProvider(): LLMProvider {
  return resolveLLMProvider();
}
