// خطاهای دامنه‌ای — جدا از خطایِ خامِ provider (Anti-Corruption Layer). هیچ‌جا
// payload/response خامِ OpenAI را حمل نمی‌کنند (ممکن است داده‌ی بالینی داشته باشد).

export class CaseFileGenerationError extends Error {
  code: 'llm-failed' | 'llm-invalid-output' | 'no-corpus' | 'busy' | 'unknown';
  constructor(code: CaseFileGenerationError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'CaseFileGenerationError';
  }
}

export class CaseFileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CaseFileValidationError';
  }
}
