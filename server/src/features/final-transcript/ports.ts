// پورت‌هایِ ماژولِ «متنِ نهایی» — domain/application فقط این‌ها را می‌شناسند، نه SQL/Soniox/OpenAI.

// یک فراخوانیِ structured-output. خطایِ گذرا باید `transient: true` داشته باشد.
export interface LlmJsonPort {
  readonly model: string;
  completeJson<T>(system: string, user: string, schema: unknown): Promise<T>;
}

// حاضرینِ جلسه برایِ نقش‌گذاری (از واحدِ درمان). برچسب‌ها همان برچسبِ نمایشیِ UI‌اند (مستعار یا نقش).
export interface SpeakerRoster {
  unitLabel: string;
  speakers: string[];
  terms: string[];
}
