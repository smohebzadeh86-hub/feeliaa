// آداپتورِ LLM برایِ مرتب‌سازیِ متن — همان provider و کلیدِ پرونده‌ی درمان (LLM_PROVIDER)، ولی client و timeoutِ جدا.
// پورت و پرامپت‌هایِ case-file دست نمی‌خورند. از callStructuredِ مشترک استفاده می‌شود (خطایِ گذرا ⇒ transient).
// ⚠️ LAW-001: هیچ‌جا payload/response لاگ نمی‌شود — فقط مدت و نامِ گذر.
import OpenAI from 'openai';
import { callStructured, isTransientLlmError } from '../../case-file/adapters/llm/chatJson.js';
import { CaseFileGenerationError } from '../../case-file/domain/errors.js';
import { resolveReasoningBody } from '../../case-file/adapters/llm/openrouter.adapter.js';
import type { LlmJsonPort } from '../ports.js';

export class FinalTranscriptConfigError extends Error {
  transient = false;
  constructor(message: string) { super(message); this.name = 'FinalTranscriptConfigError'; }
}

// JSON از متنِ آزاد: حذفِ بلوکِ استدلال (<think>…</think>) و fence، سپس اولین «{» تا آخرین «}». نامعتبر ⇒ null.
export function extractJson(raw: string): unknown | null {
  let s = String(raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '').trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  s = s.slice(a, b + 1);
  try { return JSON.parse(s); } catch { return null; }
}

// مقایسه‌ی ساختارِ خروجی با schema (فقط کلیدهایِ required و نوعِ آرایه/رشته در سطحِ اول و آیتم‌ها) — نه اعتبارسنجِ کامل،
// فقط تا خروجیِ بی‌ربط (مثلاً {"answer": …}) به‌جایِ نوبت‌ها پذیرفته نشود.
function shapeOk(v: unknown, schema: any): boolean {
  const s = schema?.schema ?? schema;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  for (const key of s?.required || []) {
    const val = (v as any)[key];
    const t = s.properties?.[key]?.type;
    if (val === undefined) return false;
    if (t === 'array' && !Array.isArray(val)) return false;
    if (t === 'string' && typeof val !== 'string') return false;
    if (t === 'array' && s.properties[key].items?.type === 'object') {
      for (const it of val) if (!shapeOk(it, s.properties[key].items)) return false;
    }
  }
  return true;
}

async function promptJson<T>(client: OpenAI, model: string, label: string, system: string, user: string, schema: unknown, extraBody?: Record<string, unknown>): Promise<T> {
  const spec = JSON.stringify((schema as any)?.schema ?? schema);
  const sys = `${system}\n\nقالبِ خروجی: فقط و فقط یک شیءِ JSONِ معتبر مطابقِ این JSON Schema برگردان — بدونِ هیچ توضیح، مقدمه، یا \`\`\`:\n${spec}`;
  // یک تلاشِ دوباره برایِ خروجیِ نامعتبر (مدل‌هایِ بدونِ structured output گاهی متنِ آزاد می‌دهند)
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string | null | undefined;
    try {
      const res = await client.chat.completions.create({
        model,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        ...(extraBody ?? {}),
      } as any);
      raw = (res as any).choices?.[0]?.message?.content;
    } catch (err) {
      throw new CaseFileGenerationError('llm-failed', `فراخوانی ${label} ناموفق بود: ` + (err instanceof Error ? err.message : 'خطای نامشخص'), { transient: isTransientLlmError(err) });
    }
    const parsed = extractJson(raw || '');
    if (parsed && shapeOk(parsed, schema)) return parsed as T;
  }
  throw new CaseFileGenerationError('llm-invalid-output', `پاسخ ${label} JSON معتبر نبود`);
}

function envInt(name: string, def: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

export function createTranscriptLlm(): LlmJsonPort {
  const kind = process.env.LLM_PROVIDER || 'openai';
  const timeout = envInt('FINAL_TRANSCRIPT_LLM_TIMEOUT_MS', 3 * 60_000);
  // سقفِ توکنِ خروجی (2026-09-28): بدونِ آن OpenRouter برایِ هر درخواست سقفِ کاملِ مدل (۱۳۱۰۷۲ توکن) را از اعتبار رزرو
  // می‌کند و با اعتبارِ کم «402 … requires more credits, or fewer max_tokens» می‌دهد، هرچند مصرفِ واقعی کم است.
  // خروجیِ یک تکه (≤ FINAL_TRANSCRIPT_CHUNK_CHARS نویسه) + استدلال زیرِ این سقف است؛ خروجیِ بریده ⇒ JSONِ نامعتبر ⇒
  // تکه خام می‌ماند (گذرِ برداشتِ کلی: تلاشِ دوباره).
  const maxTokens = envInt('FINAL_TRANSCRIPT_MAX_TOKENS', 16_384);
  let client: OpenAI;
  let model: string | undefined;
  let label: string;
  let extraBody: Record<string, unknown> | undefined;
  if (kind === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    model = process.env.FINAL_TRANSCRIPT_MODEL || process.env.OPENROUTER_MODEL;
    if (!apiKey || !model) throw new FinalTranscriptConfigError('کلید یا مدلِ OpenRouter رویِ سرور تنظیم نشده');
    label = 'OpenRouter';
    // مدل‌هایِ جایگزین (2026-09-28، دستورِ مالک: مدلِ رایگان): اگر مدلِ اصلی (مثلاً یک مدلِ :free) با 429/خطا جواب ندهد،
    // خودِ OpenRouter همان درخواست را به این‌ها می‌فرستد ⇒ «متنِ نهایی» به محدودیتِ نرخِ مدلِ رایگان گیر نمی‌کند.
    const fallbacks = String(process.env.FINAL_TRANSCRIPT_FALLBACK_MODELS || '').split(',').map((s) => s.trim()).filter((s) => s && s !== model);
    extraBody = {
      ...(resolveReasoningBody(process.env.FINAL_TRANSCRIPT_REASONING_EFFORT || process.env.OPENROUTER_REASONING_EFFORT) ?? {}),
      // require_parameters (2026-09-28): فقط providerهایی که json_schema را واقعاً پشتیبانی می‌کنند. بدونِ آن sort:'latency'
      // ممکن بود درخواست را به providerی بفرستد که schema را نادیده می‌گیرد (مثلاً چند provider ِ DeepSeek) ⇒ خروجیِ آزاد.
      // data_collection:'deny' (2026-09-28): متنِ بالینی هرگز به providerی نمی‌رود که داده را نگه می‌دارد یا با آن آموزش
      // می‌دهد — به‌ویژه مهم برایِ مدل‌هایِ :free (LAW-001).
      provider: { sort: 'latency', require_parameters: true, data_collection: 'deny' },
      ...(fallbacks.length ? { models: [model, ...fallbacks] } : {}),
      max_tokens: maxTokens,
    };
    client = new OpenAI({
      apiKey, baseURL: 'https://openrouter.ai/api/v1', timeout, maxRetries: 0,
      defaultHeaders: { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://feelia.ir', 'X-Title': 'Feelia - Final Transcript' },
    });
  } else if (kind === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    model = process.env.FINAL_TRANSCRIPT_MODEL || process.env.OPENAI_CASE_FILE_MODEL;
    if (!apiKey || !model) throw new FinalTranscriptConfigError('کلید یا مدلِ OpenAI رویِ سرور تنظیم نشده');
    label = 'OpenAI';
    client = new OpenAI({ apiKey, timeout, maxRetries: 0 });
    // مدل‌هایِ جدیدِ OpenAI (reasoning) فقط max_completion_tokens را می‌پذیرند
    extraBody = { max_completion_tokens: maxTokens };
  } else {
    throw new FinalTranscriptConfigError(`LLM_PROVIDER نامعتبر: ${kind}`);
  }
  const m = model;
  // حالتِ JSON (2026-09-28): 'schema' (پیش‌فرض) = response_format: json_schema ِ strict. 'prompt' = برایِ مدل‌هایی که
  // structured output ندارند (بیشترِ مدل‌هایِ :free — Nemotron، Inkling، Ling): schema در پرامپت می‌آید و خروجی با parseِ
  // مقاوم خوانده می‌شود. نگهبان‌هایِ قطعیِ polish در هر دو حالت همان‌اند، پس خروجیِ بد به متنِ خام برمی‌گردد نه به متنِ نهایی.
  const jsonMode = kind === 'openrouter' && process.env.FINAL_TRANSCRIPT_JSON_MODE === 'prompt' ? 'prompt' : 'schema';
  if (jsonMode === 'prompt' && extraBody) {
    // require_parameters بدونِ response_format معنایی ندارد و providerهایِ بی‌پشتیبانی از max_tokens را هم حذف می‌کرد
    extraBody = { ...extraBody, provider: { sort: 'latency', data_collection: 'deny' } };
  }
  return {
    model: m,
    async completeJson<T>(system: string, user: string, schema: unknown): Promise<T> {
      // تلاشِ دوباره‌ی همان فراخوانی برایِ خطایِ گذرا (2026-09-28): مدل‌هایِ :free گاهی کند/ناپایدارند و بدونِ این، یک
      // خطا در یک تکه کلِ jobِ یک جلسه‌ی بلند را از اول به backoff می‌برد (مشاهده در prod: جلسه‌ی ۵dbb946c هرگز تمام نمی‌شد).
      const retries = envInt('FINAL_TRANSCRIPT_CALL_RETRIES', 2);
      for (let attempt = 0; ; attempt++) {
        const startedAt = Date.now();
        try {
          const r = jsonMode === 'prompt'
            ? await promptJson<T>(client, m, label, system, user, schema, extraBody)
            : await callStructured<T>(client, m, label, system, user, schema, extraBody);
          console.log(`[final-transcript] ${label} call ok in ${Date.now() - startedAt}ms${attempt ? ` (retry ${attempt})` : ''}`);
          return r;
        } catch (e) {
          const transient = !!(e as { transient?: boolean })?.transient;
          // فقط کد/پیامِ خطایِ provider (بدونِ پرامپت/پاسخ — LAW-001) تا علتِ شکست در لاگ دیده شود
          const why = String((e as Error)?.message || '').replace(/\s+/g, ' ').slice(0, 140);
          console.log(`[final-transcript] ${label} call failed after ${Date.now() - startedAt}ms: ${why}`);
          if (!transient || attempt >= retries) throw e;
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
        }
      }
    },
  };
}
