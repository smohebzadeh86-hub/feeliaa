// Port — قراردادِ مستقل از provider برایِ تولیدِ پرونده. تنها فایل‌هایی که مجازند
// از این interface پیاده‌سازیِ واقعی بسازند، زیرِ adapters/llm/ هستند.
import type { CaseFileDraft, CaseFileDigest } from '../domain/types.js';

export interface CaseFilePromptInput {
  clientMeta: { category: string | null; gender: string | null; alias: string | null };
  corpusText: string;
}

export interface LLMProvider {
  // نامِ مدلی که واقعاً استفاده شد — application/generateCaseFile.ts این را در
  // client_case_file.model ذخیره می‌کند؛ هیچ مدلی در application/domain hardcode نمی‌شود.
  readonly model: string;
  // مرحله‌ی ۱: رونویسیِ خام → digestِ تصحیح‌شده (املا/ASR)، بدونِ افزودن/حذفِ فکت
  digestCorpus(input: CaseFilePromptInput): Promise<CaseFileDigest>;
  // مرحله‌ی ۲: input.corpusText اینجا خروجیِ رندرشده‌ی digest است، نه رونویسیِ خام
  generateCaseFile(input: CaseFilePromptInput): Promise<CaseFileDraft>;
}
