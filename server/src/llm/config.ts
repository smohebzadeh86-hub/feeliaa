// لایه‌ی LLMِ مستقل از provider (2026-09-28) — تنها جایی که دانستنِ «هر provider چه می‌خواهد» زندگی می‌کند.
// هر provider یک ردیف در PROFILES است؛ کدِ case-file و final-transcript فقط `resolveLlmConfig(purpose)` را می‌شناسند.
// سوییچ = عوض‌کردنِ LLM_PROVIDER (یا <PURPOSE>_LLM_PROVIDER) در env + restart. کلید/مدلِ هر provider کنارِ هم می‌مانند.
//
// قراردادِ env برایِ providerِ P با پیشوندِ <P> (مثلاً METIS):
//   <P>_API_KEY، <P>_BASE_URL (اختیاری؛ پیش‌فرضِ جدول)، <P>_MODEL،
//   <P>_CASE_FILE_MODEL / <P>_FINAL_TRANSCRIPT_MODEL (اختیاری، مدلِ جدا برایِ هر مسیر).
// سطحِ استدلال یک واژگانِ مشترک دارد (REASONING_LEVELS) و هر provider آن را به پارامترِ خودش ترجمه می‌کند —
// پارامترِ اشتباه را providerها بی‌صدا نادیده می‌گیرند (probe ِ متیس 2026-09-28: `reasoning:{enabled:false}` ⇒ استدلال روشن ماند).
// ⚠️ LAW-001: این فایل هرگز کلید را برنمی‌گرداند یا لاگ نمی‌کند (describeLlmConfig فقط «کلید هست/نیست»).

export type LlmPurpose = 'case-file' | 'final-transcript';
export type JsonMode = 'schema' | 'object' | 'prompt';
export const REASONING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'max', 'default'] as const;
export type ReasoningLevel = (typeof REASONING_LEVELS)[number];
type ReasoningStyle = 'openrouter' | 'deepseek' | 'openai' | 'none';

export class LlmConfigError extends Error {
  transient = false;
  constructor(message: string) { super(message); this.name = 'LlmConfigError'; }
}

interface ProviderProfile {
  label: string;
  envPrefix: string;
  baseURL?: string;
  // حالت‌هایِ JSONِ پشتیبانی‌شده؛ اولی پیش‌فرض است. درخواستِ حالتِ پشتیبانی‌نشده ⇒ حالتِ پیش‌فرض (با هشدار)، نه خطا —
  // تا سوییچِ provider با یک FINAL_TRANSCRIPT_JSON_MODEِ جامانده از providerِ قبلی نشکند.
  jsonModes: JsonMode[];
  reasoningStyle: ReasoningStyle;
  tokenParam: 'max_tokens' | 'max_completion_tokens';
  // سطحِ استدلالِ پیش‌فرض برایِ هر مسیر وقتی env چیزی نگفته
  defaultReasoning: Record<LlmPurpose, ReasoningLevel>;
  headers?: (purpose: LlmPurpose) => Record<string, string>;
}

const PROFILES: Record<string, ProviderProfile> = {
  openai: {
    label: 'OpenAI', envPrefix: 'OPENAI', jsonModes: ['schema', 'object', 'prompt'], reasoningStyle: 'openai',
    // مدل‌هایِ جدیدِ OpenAI (reasoning) فقط max_completion_tokens را می‌پذیرند
    tokenParam: 'max_completion_tokens',
    // رفتارِ قبلی: هیچ پارامترِ استدلالی فرستاده نمی‌شد (مدل‌هایِ غیرِ reasoning با reasoning_effort خطا می‌دهند)
    defaultReasoning: { 'case-file': 'default', 'final-transcript': 'default' },
  },
  openrouter: {
    label: 'OpenRouter', envPrefix: 'OPENROUTER', baseURL: 'https://openrouter.ai/api/v1',
    jsonModes: ['schema', 'prompt', 'object'], reasoningStyle: 'openrouter', tokenParam: 'max_tokens',
    defaultReasoning: { 'case-file': 'low', 'final-transcript': 'low' },
    // هدرهای توصیه‌شده‌ی OpenRouter برای شناسایی اپ — بدون داده‌ی کاربر/بالینی.
    // ⭐ فقط ASCII: em-dash (—) در مقدارِ هدر را Node رد می‌کند و کلِ فراخوانی با «Connection error»ِ گمراه‌کننده fail می‌شد.
    headers: (p) => ({
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://feelia.ir',
      'X-Title': p === 'case-file' ? 'Feelia - Case File' : 'Feelia - Final Transcript',
    }),
  },
  // متیس (Metis AI) — دروازه‌ی ایرانیِ DeepSeek با پرداختِ ریالی. probe 2026-09-28: json_schema ⇒ 400
  // «This response_format type is unavailable»؛ json_object کار می‌کند؛ بدونِ پارامتر استدلال روشن است.
  metis: {
    label: 'Metis', envPrefix: 'METIS', baseURL: 'https://api.metisai.ir/deepseek/v1',
    jsonModes: ['object', 'prompt'], reasoningStyle: 'deepseek', tokenParam: 'max_tokens',
    // «متنِ نهایی» با low (سنجش 2026-09-28، ۸ متنِ ساختگی): off ۴–۸ث ولی ۲/۸ بدتر از خام و نقش ۹۶٫۱٪؛ low ۱۲–۳۷ث،
    // ۸/۸ ≤ خام، نقش ≥۹۸٫۷٪. (ردِ قبلیِ «off» مالِ مدلِ دیگری رویِ OpenRouter بود با ۱۲k توکنِ استدلال.)
    defaultReasoning: { 'case-file': 'low', 'final-transcript': 'low' },
  },
  // APIِ مستقیمِ DeepSeek — همان قراردادِ متیس (سنجیده‌نشده؛ فقط برایِ سوییچِ آماده).
  deepseek: {
    label: 'DeepSeek', envPrefix: 'DEEPSEEK', baseURL: 'https://api.deepseek.com/v1',
    jsonModes: ['object', 'prompt'], reasoningStyle: 'deepseek', tokenParam: 'max_tokens',
    defaultReasoning: { 'case-file': 'low', 'final-transcript': 'low' },
  },
};

// هر سرویسِ سازگار با OpenAI (بدونِ تغییرِ کد): CUSTOM_LLM_BASE_URL (الزامی)، CUSTOM_LLM_API_KEY، CUSTOM_LLM_MODEL،
// CUSTOM_LLM_JSON_MODE (schema|object|prompt، پیش‌فرض prompt)، CUSTOM_LLM_REASONING_STYLE (none|openrouter|deepseek|openai)،
// CUSTOM_LLM_TOKEN_PARAM (max_tokens|max_completion_tokens).
function customProfile(env: NodeJS.ProcessEnv): ProviderProfile {
  const mode = pick(env.CUSTOM_LLM_JSON_MODE, ['schema', 'object', 'prompt'] as const, 'prompt', 'CUSTOM_LLM_JSON_MODE');
  const style = pick(env.CUSTOM_LLM_REASONING_STYLE, ['none', 'openrouter', 'deepseek', 'openai'] as const, 'none', 'CUSTOM_LLM_REASONING_STYLE');
  const tokenParam = pick(env.CUSTOM_LLM_TOKEN_PARAM, ['max_tokens', 'max_completion_tokens'] as const, 'max_tokens', 'CUSTOM_LLM_TOKEN_PARAM');
  return {
    label: 'Custom', envPrefix: 'CUSTOM_LLM', jsonModes: [mode], reasoningStyle: style, tokenParam,
    defaultReasoning: { 'case-file': 'default', 'final-transcript': 'default' },
  };
}

export const LLM_PROVIDERS = [...Object.keys(PROFILES), 'custom'];

function pick<T extends string>(raw: string | undefined, allowed: readonly T[], def: T, name: string): T {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v) return def;
  if (!(allowed as readonly string[]).includes(v)) throw new LlmConfigError(`${name} نامعتبر است (${allowed.join('|')})`);
  return v as T;
}

function envInt(env: NodeJS.ProcessEnv, name: string): number | undefined {
  const n = Number(env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

const PURPOSE_ENV: Record<LlmPurpose, string> = { 'case-file': 'CASE_FILE', 'final-transcript': 'FINAL_TRANSCRIPT' };

// ترجمه‌ی سطحِ مشترک به پارامترِ provider. 'default' ⇒ هیچ پارامتری (رفتارِ پیش‌فرضِ provider).
export function reasoningBody(style: ReasoningStyle, level: ReasoningLevel): Record<string, unknown> {
  if (level === 'default' || style === 'none') return {};
  switch (style) {
    case 'openrouter':
      if (level === 'off') return { reasoning: { enabled: false } };
      return { reasoning: { effort: level === 'max' ? 'high' : level } };
    case 'deepseek':
      // DeepSeek فقط low|high|max دارد
      if (level === 'off') return { thinking: { type: 'disabled' } };
      return { thinking: { type: 'enabled' }, reasoning_effort: level === 'minimal' || level === 'low' ? 'low' : level === 'max' ? 'max' : 'high' };
    case 'openai':
      return { reasoning_effort: level === 'off' ? 'minimal' : level === 'max' ? 'high' : level };
  }
}

export interface LlmConfig {
  provider: string;
  label: string;
  purpose: LlmPurpose;
  apiKey: string;
  baseURL?: string;
  model: string;
  // برچسبِ ذخیره‌شده در DB/گزارش: provider:model (client_case_file.model = VARCHAR(64))
  modelTag: string;
  jsonMode: JsonMode;
  reasoning: ReasoningLevel;
  maxTokens?: number;
  timeoutMs: number;
  headers?: Record<string, string>;
  // پارامترهایِ بدنه‌ی درخواست به‌جز model/messages/response_format
  body: Record<string, unknown>;
  warnings: string[];
}

function providerFor(purpose: LlmPurpose, env: NodeJS.ProcessEnv, fallback: boolean): string | undefined {
  const P = PURPOSE_ENV[purpose];
  if (fallback) return (env[`${P}_LLM_FALLBACK_PROVIDER`] || env.LLM_FALLBACK_PROVIDER || '').trim().toLowerCase() || undefined;
  return (env[`${P}_LLM_PROVIDER`] || env.LLM_PROVIDER || 'openai').trim().toLowerCase();
}

export function resolveLlmConfig(purpose: LlmPurpose, env: NodeJS.ProcessEnv = process.env, provider = providerFor(purpose, env, false)!): LlmConfig {
  const profile = provider === 'custom' ? customProfile(env) : PROFILES[provider];
  if (!profile) throw new LlmConfigError(`LLM_PROVIDER نامعتبر: ${provider} (${LLM_PROVIDERS.join('|')})`);
  const P = PURPOSE_ENV[purpose];
  const X = profile.envPrefix;
  const warnings: string[] = [];

  const apiKey = env[`${X}_API_KEY`];
  const baseURL = env[`${X}_BASE_URL`] || profile.baseURL;
  if (provider === 'custom' && !baseURL) throw new LlmConfigError('CUSTOM_LLM_BASE_URL رویِ سرور تنظیم نشده');

  // ⭐ عمداً بدون مدل hardcode‌شده در کد (تصمیم صریح مالک). نامِ مدل مالِ provider است، پس متغیرهایِ قدیمیِ بی‌پیشوند
  // (FINAL_TRANSCRIPT_MODEL، …) فقط برایِ providerهایی خوانده می‌شوند که قبلاً با آن‌ها معنا داشتند.
  const legacy = provider === 'openrouter' || provider === 'openai';
  const model = (env[`${X}_${P}_MODEL`]
    || (purpose === 'final-transcript' && legacy ? env.FINAL_TRANSCRIPT_MODEL : undefined)
    || env[`${X}_MODEL`]
    || (purpose === 'final-transcript' ? env[`${X}_CASE_FILE_MODEL`] : undefined)
    || '').trim();
  if (!apiKey || !model) throw new LlmConfigError(`کلید یا مدلِ ${profile.label} رویِ سرور تنظیم نشده (${X}_API_KEY، ${X}_MODEL)`);

  // حالتِ JSON: <PURPOSE>_JSON_MODE، وگرنه پیش‌فرضِ provider
  const wanted = pick(env[`${P}_JSON_MODE`], ['schema', 'object', 'prompt'] as const, profile.jsonModes[0], `${P}_JSON_MODE`);
  let jsonMode: JsonMode = wanted;
  if (!profile.jsonModes.includes(wanted)) {
    jsonMode = profile.jsonModes[0];
    warnings.push(`${P}_JSON_MODE=${wanted} را ${profile.label} پشتیبانی نمی‌کند ⇒ ${jsonMode}`);
  }

  // استدلال: <P>_<PURPOSE>_REASONING_EFFORT (مخصوصِ provider — سطحِ مناسب به مدل بستگی دارد: Dots3 بدونِ استدلال، DeepSeek با
  // low)، وگرنه <PURPOSE>_REASONING_EFFORT، وگرنه (فقط OpenRouter، سازگاری) OPENROUTER_REASONING_EFFORT، وگرنه پیش‌فرضِ provider
  const reasoningVar = env[`${X}_${P}_REASONING_EFFORT`] ? `${X}_${P}_REASONING_EFFORT`
    : (env[`${P}_REASONING_EFFORT`] || provider !== 'openrouter') ? `${P}_REASONING_EFFORT` : 'OPENROUTER_REASONING_EFFORT';
  const reasoning = pick(env[reasoningVar], REASONING_LEVELS, profile.defaultReasoning[purpose], reasoningVar);

  // سقفِ توکنِ خروجی: بدونِ آن OpenRouter سقفِ کاملِ مدل را از اعتبار رزرو می‌کرد ⇒ 402 با اعتبارِ کم (2026-09-28).
  // OpenAI در پرونده‌ی درمان قبلاً سقف نداشت (بعضی مدل‌ها خروجیِ ۳۲k را نمی‌پذیرند) ⇒ فقط اگر env بگوید.
  const maxTokens = envInt(env, `${P}_MAX_TOKENS`)
    ?? (purpose === 'final-transcript' ? 16_384 : provider === 'openai' ? undefined : 32_768);

  const timeoutMs = purpose === 'final-transcript'
    ? envInt(env, 'FINAL_TRANSCRIPT_LLM_TIMEOUT_MS') ?? 3 * 60_000
    // timeout ده‌دقیقه‌ای با retry یک مرحله را تا ~۳۰ دقیقه معطل می‌کرد؛ repairLoop خودش retry ِ محتوایی دارد.
    : envInt(env, 'CASE_FILE_LLM_TIMEOUT_MS') ?? 5 * 60_000;

  const body: Record<string, unknown> = { ...reasoningBody(profile.reasoningStyle, reasoning) };
  if (provider === 'openrouter') {
    // sort:'latency' = سریع‌ترین عرضه‌کننده‌ی همان مدل. data_collection:'deny' ⇒ متنِ بالینی به عرضه‌کننده‌ای که داده را
    // نگه می‌دارد/با آن آموزش می‌دهد نمی‌رود (LAW-001). require_parameters فقط با json_schema معنا دارد (بعضی عرضه‌کننده‌ها
    // schema را نادیده می‌گیرند)؛ در حالتِ prompt عرضه‌کننده‌هایِ بی‌پشتیبانی از max_tokens را هم بی‌دلیل حذف می‌کرد.
    body.provider = jsonMode === 'schema'
      ? { sort: 'latency', require_parameters: true, data_collection: 'deny' }
      : { sort: 'latency', data_collection: 'deny' };
    // مدل‌هایِ جایگزینِ خودِ OpenRouter (پارامترِ models) — فقط «متنِ نهایی»، همان رفتارِ قبلی
    if (purpose === 'final-transcript') {
      const fallbacks = String(env.OPENROUTER_FINAL_TRANSCRIPT_FALLBACK_MODELS || env.FINAL_TRANSCRIPT_FALLBACK_MODELS || '')
        .split(',').map((s) => s.trim()).filter((s) => s && s !== model);
      if (fallbacks.length) body.models = [model, ...fallbacks];
    }
  } else if (env.FINAL_TRANSCRIPT_FALLBACK_MODELS && purpose === 'final-transcript') {
    warnings.push(`FINAL_TRANSCRIPT_FALLBACK_MODELS فقط در OpenRouter معنا دارد ⇒ نادیده گرفته شد`);
  }
  if (maxTokens) body[profile.tokenParam] = maxTokens;

  return {
    provider, label: profile.label, purpose, apiKey, baseURL, model,
    modelTag: `${provider}:${model}`.slice(0, 64),
    jsonMode, reasoning, maxTokens, timeoutMs, headers: profile.headers?.(purpose), body, warnings,
  };
}

// providerِ جایگزین (اختیاری، پیش‌فرض خاموش): <PURPOSE>_LLM_FALLBACK_PROVIDER یا LLM_FALLBACK_PROVIDER.
// ⚠️ روشن‌کردنش یعنی متنِ بالینی ممکن است به providerِ دوم هم برود — تصمیمِ مالک.
export function resolveLlmFallbackConfig(purpose: LlmPurpose, env: NodeJS.ProcessEnv = process.env): LlmConfig | null {
  const fb = providerFor(purpose, env, true);
  if (!fb || fb === 'none' || fb === providerFor(purpose, env, false)) return null;
  return resolveLlmConfig(purpose, env, fb);
}

// یک خط برایِ لاگِ شروعِ سرور — بدونِ کلید (LAW-001).
export function describeLlmConfig(purpose: LlmPurpose, env: NodeJS.ProcessEnv = process.env): string {
  const one = (c: LlmConfig) => `${c.label} model=${c.model} json=${c.jsonMode} reasoning=${c.reasoning} max_tokens=${c.maxTokens ?? '-'}`;
  try {
    const c = resolveLlmConfig(purpose, env);
    const fb = resolveLlmFallbackConfig(purpose, env);
    return `[llm] ${purpose}: ${one(c)}${fb ? ` | fallback: ${one(fb)}` : ''}${[...c.warnings, ...(fb?.warnings ?? [])].map((w) => ` ⚠ ${w}`).join('')}`;
  } catch (e) {
    return `[llm] ${purpose}: پیکربندی نامعتبر — ${(e as Error).message}`;
  }
}
