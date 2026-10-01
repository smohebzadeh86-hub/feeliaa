// آداپتورِ LLM برایِ مرتب‌سازیِ متن — مستقل از provider (2026-09-28): provider/مدل/حالتِ JSON/استدلال از src/llm/config.ts
// (LLM_PROVIDER یا FINAL_TRANSCRIPT_LLM_PROVIDER). پورت و پرامپت‌ها دست نمی‌خورند؛ اینجا فقط تلاشِ دوباره‌ی درجا می‌ماند.
// ⚠️ LAW-001: هیچ‌جا payload/response لاگ نمی‌شود — فقط مدت، نامِ provider و پیامِ خطایِ provider.
import { createJsonCaller, type ChatClient, type LlmCallRef } from '../../../llm/jsonCall.js';
import type { LlmConfig } from '../../../llm/config.js';
import type { LlmJsonPort } from '../ports.js';

export class FinalTranscriptConfigError extends Error {
  transient = false;
  constructor(message: string) { super(message); this.name = 'FinalTranscriptConfigError'; }
}

function envInt(name: string, def: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

export function createTranscriptLlm(env: NodeJS.ProcessEnv = process.env, makeClient?: (c: LlmConfig) => ChatClient, ref?: LlmCallRef): LlmJsonPort {
  let caller: ReturnType<typeof createJsonCaller>;
  try {
    caller = createJsonCaller('final-transcript', env, makeClient, ref);
  } catch (e) {
    throw new FinalTranscriptConfigError((e as Error).message);
  }
  const label = caller.label;
  return {
    get model() { return caller.modelTag; },
    usage: () => caller.usage(),
    async completeJson<T>(system: string, user: string, schema: unknown): Promise<T> {
      // تلاشِ دوباره‌ی همان فراخوانی برایِ خطایِ گذرا (2026-09-28): مدل‌هایِ :free گاهی کند/ناپایدارند و بدونِ این، یک
      // خطا در یک تکه کلِ jobِ یک جلسه‌ی بلند را از اول به backoff می‌برد (مشاهده در prod: جلسه‌ی ۵dbb946c هرگز تمام نمی‌شد).
      const retries = envInt('FINAL_TRANSCRIPT_CALL_RETRIES', 2);
      for (let attempt = 0; ; attempt++) {
        const startedAt = Date.now();
        try {
          const r = await caller.complete<T>(system, user, schema);
          console.log(`[final-transcript] ${label} call ok in ${Date.now() - startedAt}ms${attempt ? ` (retry ${attempt})` : ''}`);
          return r;
        } catch (e) {
          const transient = !!(e as { transient?: boolean })?.transient;
          // پاسخِ خالی/JSONِ نامعتبر هم یک بار دوباره امتحان می‌شود (مدل‌هایِ :free گاهی خالی جواب می‌دهند)؛ بعد از آن همان
          // رفتارِ قبلی: تکه خام می‌ماند (گذرِ تکه) یا job دوباره تلاش می‌کند (گذرِ برداشتِ کلی).
          const invalid = (e as { code?: string })?.code === 'llm-invalid-output';
          // فقط کد/پیامِ خطایِ provider (بدونِ پرامپت/پاسخ — LAW-001) تا علتِ شکست در لاگ دیده شود
          const why = String((e as Error)?.message || '').replace(/\s+/g, ' ').slice(0, 140);
          console.log(`[final-transcript] ${label} call failed after ${Date.now() - startedAt}ms: ${why}`);
          if (!(transient || (invalid && attempt < 1)) || attempt >= retries) throw e;
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
        }
      }
    },
  };
}
