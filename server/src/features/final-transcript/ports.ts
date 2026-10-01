// پورت‌هایِ ماژولِ «متنِ نهایی» — domain/application فقط این‌ها را می‌شناسند، نه SQL/Soniox/OpenAI.

// مصرفِ توکن/هزینه‌ی تجمیعیِ یک LlmJsonPort (فقط عدد). cost_usd=null ⇒ هزینه‌ی قابلِ‌اعتماد در دسترس نبود.
export interface LlmUsageSnapshot {
  calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
  cost_usd: number | null;
}

// یک فراخوانیِ structured-output. خطایِ گذرا باید `transient: true` داشته باشد.
export interface LlmJsonPort {
  readonly model: string;
  // اختیاری (فیک‌ها ندارند): مصرفِ تجمیعیِ تا این لحظه. polish اختلافِ قبل/بعد را در گزارشِ هر ویرایش می‌گذارد.
  usage?(): LlmUsageSnapshot;
  completeJson<T>(system: string, user: string, schema: unknown): Promise<T>;
}

// حاضرینِ جلسه برایِ نقش‌گذاری (از واحدِ درمان). برچسب‌ها همان برچسبِ نمایشیِ UI‌اند (مستعار یا نقش).
export interface SpeakerRoster {
  unitLabel: string;
  speakers: string[];
  terms: string[];
}
