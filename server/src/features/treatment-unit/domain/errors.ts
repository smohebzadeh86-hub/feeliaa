// خطایِ اعتبارسنجیِ واحدِ درمان — code ماشینی و پایدار (LAW-021)، پیامِ فارسی برایِ کاربر.
export class TreatmentUnitValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'TreatmentUnitValidationError';
  }
}
