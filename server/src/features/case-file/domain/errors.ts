// خطاهای دامنه‌ای — جدا از خطایِ خامِ provider (Anti-Corruption Layer). هیچ‌جا
// payload/response خامِ OpenAI را حمل نمی‌کنند (ممکن است داده‌ی بالینی داشته باشد).

export class CaseFileGenerationError extends Error {
  code: 'llm-failed' | 'llm-invalid-output' | 'no-corpus' | 'busy' | 'unknown';
  // خطایِ گذرایِ شبکه/سرویس (قطعِ اتصال، timeout، 429، 5xx) — تلاشِ دوباره‌ی بعدی احتمالاً موفق است.
  transient: boolean;
  constructor(code: CaseFileGenerationError['code'], message: string, opts: { transient?: boolean } = {}) {
    super(message);
    this.code = code;
    this.transient = !!opts.transient;
    this.name = 'CaseFileGenerationError';
  }
}

export class CaseFileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CaseFileValidationError';
  }
}
