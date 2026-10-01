// یک فراخوانیِ «JSON از LLM» برایِ هر providerِ سازگار با OpenAI — مشترکِ پرونده‌ی درمان و «متنِ نهایی».
// سه حالتِ JSON (config.ts): schema = response_format: json_schemaِ strict؛ object = json_object + schema در پرامپت؛
// prompt = فقط schema در پرامپت. در دو حالتِ آخر خروجی با parseِ مقاوم + چکِ ساختار خوانده و یک بار دوباره پرسیده می‌شود.
// بدون tools/functions (اصلِ صریحِ مالک: مدل فقط از متنِ داده‌شده استفاده می‌کند).
// ⚠️ LAW-001: هیچ‌جا payload/response/پرامپت لاگ نمی‌شود؛ پیامِ خطا فقط پیامِ خودِ provider است.
import OpenAI from 'openai';
import { resolveLlmConfig, resolveLlmFallbackConfig, type LlmConfig, type LlmPurpose } from './config.js';

// خطایِ دامنه‌ایِ مستقل از provider. مصرف‌کننده‌ها فقط code/transient را می‌خوانند (duck typing).
export class LlmError extends Error {
  constructor(public code: 'llm-failed' | 'llm-invalid-output', message: string, public transient = false, public status?: number) {
    super(message);
    this.name = 'LlmError';
  }
}

// سلامتِ سرویس (2026-09-28): هر پاسخِ provider (موفق/خطا) به یک شنونده‌ی اختیاری گزارش می‌شود تا ادمین از قطعیِ
// سرویس (تمام‌شدنِ اعتبار، کلیدِ نامعتبر، قطعیِ طولانی) باخبر شود — دو بار اعتبار بی‌صدا تمام شد و همه‌چیز خوابید.
// پاسخِ JSONِ نامعتبر «سلامت» حساب می‌شود (سرویس جواب داد). فقط status/provider — هرگز متن (LAW-001).
export type LlmHealthEvent =
  | { ok: true; provider: string; purpose: string }
  | { ok: false; provider: string; purpose: string; status?: number; transient: boolean };
let healthListener: ((e: LlmHealthEvent) => void) | null = null;
export function onLlmHealth(fn: ((e: LlmHealthEvent) => void) | null): void { healthListener = fn; }
function reportHealth(e: LlmHealthEvent): void {
  try { healthListener?.(e); } catch { /* شنونده هرگز فراخوانی را نمی‌شکند */ }
}

// ثبتِ «هر فراخوانی» (2026-10-01): هر درخواستِ HTTP به provider (موفق یا شکست‌خورده، اصلی یا تلاشِ دوباره) یک رویداد.
// فقط متادیتا و عدد — هرگز پرامپت/پاسخ (LAW-001). شنونده را jobs/backgroundJobs به obs_events (`llm.call`) وصل می‌کند.
export interface LlmCallRef { sessionId?: string; clientId?: string; therapistId?: string }
export interface LlmCallEvent {
  purpose: string; provider: string; model: string;
  ok: boolean; status?: number; transient?: boolean; durationMs: number;
  attempt: number; // شماره‌ی تلاشِ درونِ همان complete (۰ = اول)
  finish?: string; usage?: LlmUsage; ref?: LlmCallRef;
}
let callListener: ((e: LlmCallEvent) => void) | null = null;
export function onLlmCall(fn: ((e: LlmCallEvent) => void) | null): void { callListener = fn; }
function reportCall(e: LlmCallEvent): void {
  try { callListener?.(e); } catch { /* ثبت هرگز فراخوانی را نمی‌شکند */ }
}

// خطایِ گذرا: بدونِ status (خطایِ اتصال/timeout/قطعِ بدنه — مثلاً ECONNRESETِ مشاهده‌شده در E2E 2026-09-25) یا
// statusِ 402/408/429/5xx. خطایِ 4xxِ دیگر (کلید/مدل/درخواستِ نامعتبر) گذرا نیست — تکرارش فقط هزینه است.
// 402 (2026-09-28، فاز ۰B): اعتبارِ تمام‌شده («402 … exceed your available credits») با شارژ رفع می‌شود (همان معنایِ
// 429 insufficient_quotaِ OpenAI). تلاش‌ها در هر دو مسیر (پرونده‌ی آپلود: ۳ بار، متنِ نهایی: ۵ بار با backoff) سقف دارند.
export function isTransientLlmError(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === 'number') return status === 402 || status === 408 || status === 429 || status >= 500;
  const text = err instanceof Error ? `${err.name} ${err.message} ${(err as any).code ?? ''} ${(err as any).cause?.code ?? ''}` : String(err);
  return /connection|timed? ?out|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|ENOTFOUND|EAI_AGAIN|socket|network|fetch failed|terminated|Invalid response body/i.test(text);
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
// فقط تا خروجیِ بی‌ربط (مثلاً {"answer": …}) به‌جایِ ساختارِ خواسته‌شده پذیرفته نشود.
export function shapeOk(v: unknown, schema: any): boolean {
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

// بدنه‌ی کاملِ درخواست — تابعِ خالص تا harness بتواند شکلِ هر provider را بدونِ شبکه بسنجد.
export function buildRequest(cfg: LlmConfig, system: string, user: string, schema: unknown): Record<string, unknown> {
  let sys = system;
  let responseFormat: Record<string, unknown> | undefined;
  if (cfg.jsonMode === 'schema') {
    responseFormat = { type: 'json_schema', json_schema: schema };
  } else {
    // json_object ِ DeepSeek/OpenAI واژه‌ی «JSON» را در پرامپت لازم دارد؛ قالب هم باید در پرامپت باشد.
    const spec = JSON.stringify((schema as any)?.schema ?? schema);
    sys = `${system}\n\nقالبِ خروجی: فقط و فقط یک شیءِ JSONِ معتبر مطابقِ این JSON Schema برگردان — بدونِ هیچ توضیح، مقدمه، یا \`\`\`:\n${spec}`;
    if (cfg.jsonMode === 'object') responseFormat = { type: 'json_object' };
  }
  return {
    model: cfg.model,
    messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    ...(responseFormat ? { response_format: responseFormat } : {}),
    ...cfg.body,
  };
}

// کمینه‌ی قراردادِ SDK که استفاده می‌کنیم — harness یک کلاینتِ جعلی با همین شکل می‌دهد.
export interface ChatClient {
  chat: { completions: { create(body: any): Promise<any> } };
}

export function createChatClient(cfg: LlmConfig): ChatClient {
  return new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, timeout: cfg.timeoutMs, maxRetries: 0, defaultHeaders: cfg.headers });
}

// مصرفِ توکن/هزینه (2026-10-01) — برایِ آمارِ هر ویرایش و سقفِ بودجه. فقط عدد؛ هرگز متن (LAW-001).
export interface LlmUsage {
  calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
  // دلار؛ null = provider هزینه نداد و قیمتِ env هم تنظیم نیست
  cost_usd: number | null;
}
export const emptyUsage = (): LlmUsage => ({ calls: 0, prompt_tokens: 0, completion_tokens: 0, reasoning_tokens: 0, cost_usd: 0 });

export function addUsage(a: LlmUsage, b: Partial<LlmUsage>): void {
  a.calls += b.calls ?? 0;
  a.prompt_tokens += b.prompt_tokens ?? 0;
  a.completion_tokens += b.completion_tokens ?? 0;
  a.reasoning_tokens += b.reasoning_tokens ?? 0;
  // اگر حتی یک فراخوانی هزینه‌ی نامعلوم داشت، جمع هم نامعلوم است (دروغِ «۰ دلار» نمی‌گوییم)
  if (b.cost_usd === undefined) return;
  a.cost_usd = a.cost_usd === null || b.cost_usd === null ? null : a.cost_usd + b.cost_usd;
}

export function usageFromResponse(res: any, cfg: LlmConfig): LlmUsage {
  const u = res?.usage || {};
  const pt = Number(u.prompt_tokens) || 0;
  const ct = Number(u.completion_tokens) || 0;
  const rt = Number(u.completion_tokens_details?.reasoning_tokens) || 0;
  let cost: number | null = typeof u.cost === 'number' && Number.isFinite(u.cost) ? u.cost : null;
  if (cost === null && cfg.prices) cost = (pt * cfg.prices.inPerM + ct * cfg.prices.outPerM) / 1e6;
  return { calls: 1, prompt_tokens: pt, completion_tokens: ct, reasoning_tokens: rt, cost_usd: cost };
}

export interface JsonCallOptions {
  // هر پاسخِ دریافتی (حتی اگر JSONش نامعتبر بود — توکن‌هایش خرج شده) یک بار گزارش می‌شود
  onUsage?: (u: LlmUsage) => void;
  // به چه چیزی تعلق دارد (فقط شناسه) — در رویدادِ llm.call می‌آید
  ref?: LlmCallRef;
  // اعتبارسنجیِ عمیق‌ترِ مصرف‌کننده (مثلاً validateCaseFileDraft) — فقط در حالت‌هایِ بدونِ schemaِ strict؛ خطا ⇒ یک تلاشِ دوباره.
  validate?: (v: unknown) => void;
}

export async function completeJsonWith<T>(client: ChatClient, cfg: LlmConfig, system: string, user: string, schema: unknown, opts: JsonCallOptions = {}): Promise<T> {
  const body = buildRequest(cfg, system, user, schema);
  const strict = cfg.jsonMode === 'schema';
  // حالت‌هایِ بدونِ schemaِ strict: یک تلاشِ دوباره برایِ پاسخِ خالی/نامعتبر (json_objectِ DeepSeek گاهی content ِ خالی می‌دهد)
  const attempts = strict ? 1 : 2;
  let why = 'JSON معتبر نبود';
  for (let attempt = 0; attempt < attempts; attempt++) {
    let raw: string | null | undefined;
    let finish: string | undefined;
    const startedAt = Date.now();
    try {
      const res = await client.chat.completions.create(body);
      raw = res?.choices?.[0]?.message?.content;
      finish = res?.choices?.[0]?.finish_reason;
      const usage = usageFromResponse(res, cfg);
      try { opts.onUsage?.(usage); } catch { /* آمار هرگز فراخوانی را نمی‌شکند */ }
      reportCall({ purpose: cfg.purpose, provider: cfg.provider, model: cfg.modelTag, ok: true, durationMs: Date.now() - startedAt, attempt, finish, usage, ref: opts.ref });
    } catch (err) {
      const status = typeof (err as { status?: unknown })?.status === 'number' ? (err as { status: number }).status : undefined;
      const transient = isTransientLlmError(err);
      reportHealth({ ok: false, provider: cfg.provider, purpose: cfg.purpose, status, transient });
      reportCall({ purpose: cfg.purpose, provider: cfg.provider, model: cfg.modelTag, ok: false, status, transient, durationMs: Date.now() - startedAt, attempt, ref: opts.ref });
      throw new LlmError('llm-failed', `فراخوانی ${cfg.label} ناموفق بود: ` + (err instanceof Error ? err.message : 'خطای نامشخص'), transient, status);
    }
    reportHealth({ ok: true, provider: cfg.provider, purpose: cfg.purpose });
    if (!raw) { why = `پاسخ خالی از ${cfg.label}`; continue; }
    // خروجیِ بریده به سقفِ توکن ⇒ JSONِ ناقص؛ فقط کدِ آن در پیام (نه متن)
    const cut = finish === 'length' ? ' (بریده به سقفِ توکن)' : '';
    if (strict) {
      try { return JSON.parse(raw) as T; } catch { throw new LlmError('llm-invalid-output', `پاسخ ${cfg.label} JSON معتبر نبود${cut}`); }
    }
    const parsed = extractJson(raw);
    if (!parsed || !shapeOk(parsed, schema)) { why = `پاسخ ${cfg.label} JSON معتبر نبود${cut}`; continue; }
    if (opts.validate) {
      try { opts.validate(parsed); } catch (e) { why = `پاسخ ${cfg.label} ساختارِ نامعتبر داشت: ${(e as Error).message}`; continue; }
    }
    return parsed as T;
  }
  throw new LlmError('llm-invalid-output', why);
}

// ورودیِ اصلیِ مصرف‌کننده‌ها: config از env + providerِ جایگزینِ اختیاری. خطایِ گذرایِ providerِ اصلی ⇒ یک بار providerِ
// جایگزین (اگر تنظیم شده). modelTag همیشه مدلی است که آخرین پاسخِ موفق را داد.
export interface JsonCaller {
  readonly label: string;
  readonly modelTag: string;
  readonly config: LlmConfig;
  // جمعِ مصرفِ همه‌ی فراخوانی‌هایِ همین caller (کپی)
  usage(): LlmUsage;
  complete<T>(system: string, user: string, schema: unknown, opts?: JsonCallOptions): Promise<T>;
}

export function createJsonCaller(purpose: LlmPurpose, env: NodeJS.ProcessEnv = process.env, makeClient: (c: LlmConfig) => ChatClient = createChatClient, ref?: LlmCallRef): JsonCaller {
  const primary = resolveLlmConfig(purpose, env);
  const fallback = resolveLlmFallbackConfig(purpose, env);
  const pc = makeClient(primary);
  const fc = fallback ? makeClient(fallback) : null;
  let lastTag = primary.modelTag;
  const total = emptyUsage();
  const track = (o?: JsonCallOptions): JsonCallOptions => ({ ...o, ref: o?.ref ?? ref, onUsage: (u) => { addUsage(total, u); o?.onUsage?.(u); } });
  return {
    usage: () => ({ ...total }),
    label: primary.label,
    config: primary,
    get modelTag() { return lastTag; },
    async complete<T>(system: string, user: string, schema: unknown, opts?: JsonCallOptions): Promise<T> {
      try {
        const r = await completeJsonWith<T>(pc, primary, system, user, schema, track(opts));
        lastTag = primary.modelTag;
        return r;
      } catch (e) {
        if (!fc || !fallback || !(e as LlmError).transient) throw e;
        console.log(`[llm] ${purpose}: ${primary.label} خطایِ گذرا ⇒ ${fallback.label}`);
        const r = await completeJsonWith<T>(fc, fallback, system, user, schema, track(opts));
        lastTag = fallback.modelTag;
        return r;
      }
    },
  };
}
