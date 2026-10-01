// harness لایه‌ی LLMِ مستقل از provider (src/llm/) — بدونِ شبکه/DB؛ کلاینتِ جعلی، کلیدهایِ ساختگی، متنِ ساختگی.
// اجرا: pnpm test:llm
import assert from 'node:assert/strict';
import { resolveLlmConfig, resolveLlmFallbackConfig, reasoningBody, describeLlmConfig, LlmConfigError } from '../server/src/llm/config.js';
import { addUsage, emptyUsage, usageFromResponse, onLlmCall, type LlmCallEvent, buildRequest, completeJsonWith, createJsonCaller, LlmError, onLlmHealth, type ChatClient, type LlmHealthEvent } from '../server/src/llm/jsonCall.js';
import { createLlmAlertTracker, FAIL_STREAK, THROTTLE_MS } from '../server/src/llm/healthAlert.js';
import { ChatLlmAdapter } from '../server/src/features/case-file/adapters/llm/chatLlm.adapter.js';
import { CaseFileGenerationError } from '../server/src/features/case-file/domain/errors.js';
import { CASE_FILE_JSON_SCHEMA } from '../server/src/features/case-file/adapters/llm/caseFileJsonSchema.js';
import { createTranscriptLlm } from '../server/src/features/final-transcript/adapters/llmJson.js';

let pass = 0, fail = 0;
async function t(name: string, fn: () => void | Promise<void>) {
  try { await fn(); pass++; console.log('PASS ' + name); }
  catch (e: any) { fail++; console.log('FAIL ' + name + ' — ' + (e?.message || e)); }
}

const SCHEMA = { name: 'turns', strict: true, schema: { type: 'object', additionalProperties: false, required: ['turns'], properties: { turns: { type: 'array', items: { type: 'object', required: ['speaker_role', 'text'], properties: { speaker_role: { type: 'string' }, text: { type: 'string' } } } } } } };
const OK = JSON.stringify({ turns: [{ speaker_role: 'درمانگر', text: 'سلام' }] });

// کلاینتِ جعلی: هر فراخوانی یکی از پاسخ‌ها (رشته = content، شیء با status = خطا) را برمی‌گرداند و بدنه را نگه می‌دارد
function fake(replies: Array<string | null | { status: number; message?: string } | { content: string; finish: string }>) {
  const bodies: any[] = [];
  const client: ChatClient = { chat: { completions: { async create(body: any) {
    bodies.push(body);
    const r = replies[Math.min(bodies.length - 1, replies.length - 1)];
    if (r && typeof r === 'object' && 'status' in r) throw Object.assign(new Error(r.message || `${r.status} provider error`), { status: r.status });
    if (r && typeof r === 'object') return { choices: [{ message: { content: r.content }, finish_reason: r.finish }] };
    return { choices: [{ message: { content: r }, finish_reason: 'stop' }] };
  } } } };
  return { client, bodies };
}

// envِ فعلیِ prod (OpenRouter) — بدنه‌ی درخواست باید دقیقاً همان قبل از بازسازی باشد
const PROD_OR = {
  LLM_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'sk-or-fake', OPENROUTER_MODEL: 'deepseek/deepseek-v4.1-flash',
  FINAL_TRANSCRIPT_MODEL: 'qwen/qwen3.8-27b:free', FINAL_TRANSCRIPT_FALLBACK_MODELS: 'deepseek/deepseek-v4.1-flash, x/y',
};
const METIS = { METIS_API_KEY: 'tpsg-fake', METIS_MODEL: 'deepseek-v4-flash' };

(async () => {
await t('L1 رگرسیون: پرونده‌ی درمان رویِ OpenRouter همان بدنه‌ی قبلی را می‌سازد', () => {
  const c = resolveLlmConfig('case-file', PROD_OR);
  assert.equal(c.baseURL, 'https://openrouter.ai/api/v1');
  assert.equal(c.timeoutMs, 5 * 60_000);
  assert.deepEqual(c.headers, { 'HTTP-Referer': 'https://feelia.ir', 'X-Title': 'Feelia - Case File' });
  const body = buildRequest(c, 'S', 'U', CASE_FILE_JSON_SCHEMA);
  assert.deepEqual(body, {
    model: 'deepseek/deepseek-v4.1-flash',
    messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }],
    response_format: { type: 'json_schema', json_schema: CASE_FILE_JSON_SCHEMA },
    reasoning: { effort: 'low' },
    provider: { sort: 'latency', require_parameters: true, data_collection: 'deny' },
    usage: { include: true }, // (2026-10-01) هزینه‌ی واقعی در پاسخ
    max_tokens: 32_768,
  });
  assert.equal(c.modelTag, 'openrouter:deepseek/deepseek-v4.1-flash');
});

await t('L2 رگرسیون: «متنِ نهایی» رویِ OpenRouter (مدلِ جدا، جایگزین‌ها، off، prompt) همان بدنه‌ی قبلی', () => {
  const c = resolveLlmConfig('final-transcript', { ...PROD_OR, FINAL_TRANSCRIPT_REASONING_EFFORT: 'off', FINAL_TRANSCRIPT_JSON_MODE: 'prompt' });
  assert.equal(c.timeoutMs, 3 * 60_000);
  assert.equal(c.headers!['X-Title'], 'Feelia - Final Transcript');
  const body = buildRequest(c, 'S', 'U', SCHEMA);
  assert.equal(body.response_format, undefined);
  assert.match((body.messages as any)[0].content, /^S\n\nقالبِ خروجی: .*JSON/s);
  const { model, messages, ...rest } = body;
  assert.equal(model, 'qwen/qwen3.8-27b:free');
  assert.deepEqual(rest, {
    reasoning: { enabled: false },
    provider: { sort: 'latency', data_collection: 'deny' },
    usage: { include: true },
    models: ['qwen/qwen3.8-27b:free', 'deepseek/deepseek-v4.1-flash', 'x/y'],
    max_tokens: 16_384,
  });
  // حالتِ پیش‌فرض (schema) با require_parameters و استدلالِ low (از OPENROUTER_REASONING_EFFORT/پیش‌فرض)
  const d = resolveLlmConfig('final-transcript', PROD_OR);
  assert.equal(d.jsonMode, 'schema');
  assert.deepEqual(d.body.provider, { sort: 'latency', require_parameters: true, data_collection: 'deny' });
  assert.deepEqual(d.body.reasoning, { effort: 'low' });
});

await t('L3 رگرسیون: OpenAI — مدلِ قدیمی، max_completion_tokens، بدونِ پارامترِ استدلال؛ پرونده بدونِ سقف', () => {
  const env = { OPENAI_API_KEY: 'sk-fake', OPENAI_CASE_FILE_MODEL: 'gpt-x' };
  const ft = resolveLlmConfig('final-transcript', env);
  assert.equal(ft.provider, 'openai');
  assert.equal(ft.model, 'gpt-x');
  assert.deepEqual(ft.body, { max_completion_tokens: 16_384 });
  assert.equal(ft.baseURL, undefined);
  const cf = resolveLlmConfig('case-file', env);
  assert.deepEqual(cf.body, {});
  assert.equal(cf.jsonMode, 'schema');
  assert.equal(resolveLlmConfig('final-transcript', { ...env, FINAL_TRANSCRIPT_MODEL: 'gpt-ft' }).model, 'gpt-ft');
});

await t('L4 متیس: json_object، استدلالِ low در هر دو مسیر، off با env؛ مدلِ OpenRouterیِ جامانده نادیده', () => {
  const env = { ...PROD_OR, ...METIS, LLM_PROVIDER: 'metis' };
  const ft = resolveLlmConfig('final-transcript', env);
  assert.equal(ft.baseURL, 'https://api.metisai.ir/deepseek/v1');
  assert.equal(ft.model, 'deepseek-v4-flash', 'FINAL_TRANSCRIPT_MODEL (qwen) نباید به متیس برود');
  assert.equal(ft.jsonMode, 'object');
  assert.deepEqual(ft.body, { thinking: { type: 'disabled' }, max_tokens: 16_384 });
  assert.deepEqual(resolveLlmConfig('final-transcript', { ...env, FINAL_TRANSCRIPT_REASONING_EFFORT: 'low' }).body, { thinking: { type: 'enabled' }, reasoning_effort: 'low', max_tokens: 16_384 });
  assert.equal(ft.headers, undefined);
  assert.ok(ft.warnings.some((w) => /FALLBACK_MODELS/.test(w)));
  const cf = resolveLlmConfig('case-file', env);
  assert.deepEqual(cf.body, { thinking: { type: 'enabled' }, reasoning_effort: 'low', max_tokens: 32_768 });
  const body = buildRequest(cf, 'S', 'U', CASE_FILE_JSON_SCHEMA);
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.ok((body.messages as any)[0].content.includes(JSON.stringify(CASE_FILE_JSON_SCHEMA.schema)));
  assert.equal(cf.modelTag, 'metis:deepseek-v4-flash');
  // مدلِ جدا برایِ هر مسیر و base URLِ دلخواه
  const o = resolveLlmConfig('case-file', { ...env, METIS_CASE_FILE_MODEL: 'deepseek-v4-pro', METIS_BASE_URL: 'https://x.test/v1' });
  assert.equal(o.model, 'deepseek-v4-pro');
  assert.equal(o.baseURL, 'https://x.test/v1');
});

await t('L5 حالتِ JSONِ پشتیبانی‌نشده ⇒ پیش‌فرضِ provider + هشدار (نه خطا)', () => {
  const c = resolveLlmConfig('final-transcript', { ...METIS, LLM_PROVIDER: 'metis', FINAL_TRANSCRIPT_JSON_MODE: 'schema' });
  assert.equal(c.jsonMode, 'object');
  assert.ok(c.warnings.some((w) => /JSON_MODE=schema/.test(w)));
  assert.equal(resolveLlmConfig('final-transcript', { ...METIS, LLM_PROVIDER: 'metis', FINAL_TRANSCRIPT_JSON_MODE: 'prompt' }).jsonMode, 'prompt');
  assert.throws(() => resolveLlmConfig('final-transcript', { ...METIS, LLM_PROVIDER: 'metis', FINAL_TRANSCRIPT_JSON_MODE: 'strict' }), LlmConfigError);
});

await t('L6 سوییچ: همان env با دو کلید — فقط LLM_PROVIDER یا providerِ هر مسیر عوض می‌شود', () => {
  const both = { ...PROD_OR, ...METIS };
  assert.equal(resolveLlmConfig('case-file', both).provider, 'openrouter');
  assert.equal(resolveLlmConfig('case-file', { ...both, LLM_PROVIDER: 'metis' }).provider, 'metis');
  const split = { ...both, FINAL_TRANSCRIPT_LLM_PROVIDER: 'metis' };
  assert.equal(resolveLlmConfig('case-file', split).provider, 'openrouter');
  assert.equal(resolveLlmConfig('final-transcript', split).provider, 'metis');
  assert.equal(resolveLlmConfig('case-file', { ...both, LLM_PROVIDER: ' METIS ' }).provider, 'metis');
  // سطحِ استدلالِ مخصوصِ provider بر سطحِ عمومی مقدم است ⇒ برگشت به OpenRouter/Dots (off) و متیس (low) بدونِ دست‌زدن به env
  const prodLike = { ...both, OPENROUTER_FINAL_TRANSCRIPT_REASONING_EFFORT: 'off', FINAL_TRANSCRIPT_REASONING_EFFORT: 'high' };
  assert.deepEqual(resolveLlmConfig('final-transcript', prodLike).body.reasoning, { enabled: false });
  assert.equal(resolveLlmConfig('final-transcript', { ...prodLike, LLM_PROVIDER: 'metis' }).body.reasoning_effort, 'high');
  const noGlobal = { ...both, OPENROUTER_FINAL_TRANSCRIPT_REASONING_EFFORT: 'off', LLM_PROVIDER: 'metis' };
  assert.deepEqual(resolveLlmConfig('final-transcript', noGlobal).body.thinking, { type: 'disabled' }); // پیش‌فرضِ متیس برایِ «متنِ نهایی»: off (2026-10-01)
  assert.equal(resolveLlmConfig('case-file', noGlobal).body.reasoning_effort, 'low');
});

await t('L7 ترجمه‌ی سطحِ استدلال برایِ هر provider', () => {
  assert.deepEqual(reasoningBody('deepseek', 'off'), { thinking: { type: 'disabled' } });
  assert.deepEqual(reasoningBody('deepseek', 'minimal'), { thinking: { type: 'enabled' }, reasoning_effort: 'low' });
  assert.deepEqual(reasoningBody('deepseek', 'medium'), { thinking: { type: 'enabled' }, reasoning_effort: 'high' });
  assert.deepEqual(reasoningBody('deepseek', 'max'), { thinking: { type: 'enabled' }, reasoning_effort: 'max' });
  assert.deepEqual(reasoningBody('openrouter', 'off'), { reasoning: { enabled: false } });
  assert.deepEqual(reasoningBody('openrouter', 'max'), { reasoning: { effort: 'high' } });
  assert.deepEqual(reasoningBody('openai', 'off'), { reasoning_effort: 'minimal' });
  assert.deepEqual(reasoningBody('openai', 'medium'), { reasoning_effort: 'medium' });
  for (const s of ['deepseek', 'openrouter', 'openai', 'none'] as const) assert.deepEqual(reasoningBody(s, 'default'), {});
  assert.deepEqual(reasoningBody('none', 'high'), {});
});

await t('L8 خطایِ پیکربندی: کلید/مدلِ ناموجود، providerِ ناشناخته، custom بدونِ base URL', () => {
  assert.throws(() => resolveLlmConfig('case-file', { LLM_PROVIDER: 'metis', METIS_MODEL: 'm' }), /METIS_API_KEY/);
  assert.throws(() => resolveLlmConfig('case-file', { LLM_PROVIDER: 'metis', METIS_API_KEY: 'k' }), /METIS_MODEL/);
  assert.throws(() => resolveLlmConfig('case-file', { LLM_PROVIDER: 'nope' }), /LLM_PROVIDER نامعتبر/);
  assert.throws(() => resolveLlmConfig('case-file', { LLM_PROVIDER: 'custom', CUSTOM_LLM_API_KEY: 'k', CUSTOM_LLM_MODEL: 'm' }), /CUSTOM_LLM_BASE_URL/);
  assert.throws(() => resolveLlmConfig('final-transcript', { ...METIS, LLM_PROVIDER: 'metis', FINAL_TRANSCRIPT_REASONING_EFFORT: 'turbo' }), /FINAL_TRANSCRIPT_REASONING_EFFORT/);
});

await t('L9 custom: هر سرویسِ سازگار با OpenAI بدونِ تغییرِ کد', () => {
  const c = resolveLlmConfig('case-file', {
    LLM_PROVIDER: 'custom', CUSTOM_LLM_BASE_URL: 'http://llm.test/v1', CUSTOM_LLM_API_KEY: 'k', CUSTOM_LLM_MODEL: 'local-7b',
    CUSTOM_LLM_JSON_MODE: 'object', CUSTOM_LLM_REASONING_STYLE: 'deepseek', CASE_FILE_REASONING_EFFORT: 'off',
  });
  assert.equal(c.jsonMode, 'object');
  assert.deepEqual(c.body, { thinking: { type: 'disabled' }, max_tokens: 32_768 });
  assert.equal(c.modelTag, 'custom:local-7b');
  // پیش‌فرض‌ها: prompt، بدونِ پارامترِ استدلال
  const d = resolveLlmConfig('case-file', { LLM_PROVIDER: 'custom', CUSTOM_LLM_BASE_URL: 'http://llm.test/v1', CUSTOM_LLM_API_KEY: 'k', CUSTOM_LLM_MODEL: 'm' });
  assert.equal(d.jsonMode, 'prompt');
  assert.deepEqual(d.body, { max_tokens: 32_768 });
});

const metisCfg = () => resolveLlmConfig('final-transcript', { ...METIS, LLM_PROVIDER: 'metis' });

await t('L10 json_object: پاسخِ خالی ⇒ یک تلاشِ دوباره؛ دو بار نامعتبر ⇒ llm-invalid-output', async () => {
  const a = fake([null, OK]);
  assert.deepEqual(await completeJsonWith(a.client, metisCfg(), 'S', 'U', SCHEMA), JSON.parse(OK));
  assert.equal(a.bodies.length, 2);
  const b = fake(['{"answer":"x"}', 'متنِ آزاد']);
  await assert.rejects(() => completeJsonWith(b.client, metisCfg(), 'S', 'U', SCHEMA), (e: any) => e instanceof LlmError && e.code === 'llm-invalid-output' && !e.transient);
  assert.equal(b.bodies.length, 2);
  const c = fake([{ content: '{"turns":[{"spea', finish: 'length' }]);
  await assert.rejects(() => completeJsonWith(c.client, metisCfg(), 'S', 'U', SCHEMA), /بریده به سقفِ توکن/);
  // <think> و fence هم پذیرفته می‌شود
  const d = fake(['<think>x</think>```json\n' + OK + '\n```']);
  assert.deepEqual(await completeJsonWith(d.client, metisCfg(), 'S', 'U', SCHEMA), JSON.parse(OK));
});

await t('L11 خطایِ provider: 402/429/503/شبکه گذرا؛ 400/401 دائمی؛ بدونِ تلاشِ دوباره در همین لایه', async () => {
  for (const [status, transient] of [[402, true], [429, true], [503, true], [400, false], [401, false]] as const) {
    const f = fake([{ status }]);
    await assert.rejects(() => completeJsonWith(f.client, metisCfg(), 'S', 'U', SCHEMA), (e: any) => e.code === 'llm-failed' && e.transient === transient && /Metis/.test(e.message));
    assert.equal(f.bodies.length, 1);
  }
});

await t('L12 validate: ساختارِ عمیقِ نامعتبر ⇒ یک تلاشِ دوباره (فقط بدونِ schemaِ strict)', async () => {
  let n = 0;
  const validate = () => { if (n++ === 0) throw new Error('ساختارِ نامعتبر در axes'); };
  const f = fake([OK, OK]);
  await completeJsonWith(f.client, metisCfg(), 'S', 'U', SCHEMA, { validate });
  assert.equal(f.bodies.length, 2);
  const g = fake([OK, OK]);
  await assert.rejects(() => completeJsonWith(g.client, metisCfg(), 'S', 'U', SCHEMA, { validate: () => { throw new Error('بد'); } }), /ساختارِ نامعتبر داشت: بد/);
  // schemaِ strict: validate اینجا اجرا نمی‌شود (repairLoop خودش اجرا می‌کند — همان رفتارِ قبلی) و تلاشِ دوباره نیست
  const s = resolveLlmConfig('case-file', PROD_OR);
  const h = fake([OK]);
  await completeJsonWith(h.client, s, 'S', 'U', SCHEMA, { validate: () => { throw new Error('نباید اجرا شود'); } });
  const e = fake([null, OK]);
  await assert.rejects(() => completeJsonWith(e.client, s, 'S', 'U', SCHEMA), /پاسخ خالی از OpenRouter/);
  assert.equal(e.bodies.length, 1);
});

await t('L13 providerِ جایگزین: پیش‌فرض خاموش؛ فقط با خطایِ گذرا؛ modelTag = مدلی که جواب داد', async () => {
  const both = { ...PROD_OR, ...METIS, LLM_PROVIDER: 'metis' };
  assert.equal(resolveLlmFallbackConfig('case-file', both), null);
  assert.equal(resolveLlmFallbackConfig('case-file', { ...both, LLM_FALLBACK_PROVIDER: 'metis' }), null, 'همان provider ⇒ بی‌اثر');
  assert.equal(resolveLlmFallbackConfig('case-file', { ...both, LLM_FALLBACK_PROVIDER: 'none' }), null);
  const clients: Record<string, ReturnType<typeof fake>> = { metis: fake([{ status: 402 }]), openrouter: fake([OK]) };
  const caller = createJsonCaller('case-file', { ...both, CASE_FILE_LLM_FALLBACK_PROVIDER: 'openrouter' }, (c) => clients[c.provider].client);
  assert.equal(caller.modelTag, 'metis:deepseek-v4-flash');
  assert.deepEqual(await caller.complete('S', 'U', SCHEMA), JSON.parse(OK));
  assert.equal(caller.modelTag, 'openrouter:deepseek/deepseek-v4.1-flash');
  assert.equal(clients.openrouter.bodies[0].response_format.type, 'json_schema', 'جایگزین با قراردادِ خودش');
  // خطایِ دائمی ⇒ جایگزین صدا زده نمی‌شود
  const c2: Record<string, ReturnType<typeof fake>> = { metis: fake([{ status: 400 }]), openrouter: fake([OK]) };
  const caller2 = createJsonCaller('case-file', { ...both, LLM_FALLBACK_PROVIDER: 'openrouter' }, (c) => c2[c.provider].client);
  await assert.rejects(() => caller2.complete('S', 'U', SCHEMA), /400/);
  assert.equal(c2.openrouter.bodies.length, 0);
});

await t('L14 آداپتورِ پرونده: خطا ⇒ CaseFileGenerationError با همان code/transient؛ model = provider:model', async () => {
  const f = fake([{ status: 503 }]);
  const a = new ChatLlmAdapter(createJsonCaller('case-file', { ...METIS, LLM_PROVIDER: 'metis' }, () => f.client));
  assert.equal(a.model, 'metis:deepseek-v4-flash');
  const input = { clientMeta: { category: null, gender: null, alias: null }, corpusText: 'متنِ ساختگی' };
  await assert.rejects(() => a.digestCorpus(input), (e: any) => e instanceof CaseFileGenerationError && e.code === 'llm-failed' && e.transient);
  const g = fake(['{"x":1}']);
  const b = new ChatLlmAdapter(createJsonCaller('case-file', { ...METIS, LLM_PROVIDER: 'metis' }, () => g.client));
  await assert.rejects(() => b.generateCaseFile(input), (e: any) => e instanceof CaseFileGenerationError && e.code === 'llm-invalid-output' && !e.transient);
  assert.equal(g.bodies.length, 2);
});

await t('L15 «متنِ نهایی»: نبودِ کلید ⇒ FinalTranscriptConfigError؛ model = provider:model', async () => {
  assert.throws(() => createTranscriptLlm({ LLM_PROVIDER: 'metis' }), (e: any) => e.name === 'FinalTranscriptConfigError' && !e.transient);
  const f = fake([OK]);
  const llm = createTranscriptLlm({ ...METIS, LLM_PROVIDER: 'metis' }, () => f.client);
  assert.equal(llm.model, 'metis:deepseek-v4-flash');
  assert.deepEqual(await llm.completeJson('S', 'U', SCHEMA), JSON.parse(OK));
  assert.deepEqual(f.bodies[0].thinking, { type: 'disabled' });
  assert.equal(f.bodies[0].reasoning_effort, undefined);
});

await t('L16 لاگِ شروع: provider/مدل/حالت، هرگز کلید', () => {
  const line = describeLlmConfig('case-file', { ...PROD_OR, ...METIS, LLM_PROVIDER: 'metis', LLM_FALLBACK_PROVIDER: 'openrouter' });
  assert.match(line, /Metis model=deepseek-v4-flash json=object reasoning=low/);
  assert.match(line, /fallback: OpenRouter/);
  assert.ok(!line.includes('tpsg-fake') && !line.includes('sk-or-fake'));
  assert.match(describeLlmConfig('case-file', { LLM_PROVIDER: 'nope' }), /پیکربندی نامعتبر/);
});

await t('L17 سلامت: هر پاسخِ provider گزارش می‌شود (خطا با status)؛ JSONِ نامعتبر = سرویس سالم', async () => {
  const seen: LlmHealthEvent[] = [];
  onLlmHealth((e) => seen.push(e));
  try {
    await assert.rejects(() => completeJsonWith(fake([{ status: 402 }]).client, metisCfg(), 'S', 'U', SCHEMA));
    await completeJsonWith(fake(['{"x":1}', OK]).client, metisCfg(), 'S', 'U', SCHEMA);
  } finally { onLlmHealth(null); }
  assert.deepEqual(seen[0], { ok: false, provider: 'metis', purpose: 'final-transcript', status: 402, transient: true });
  assert.deepEqual(seen.slice(1).map((e) => e.ok), [true, true]);
  // شنونده‌ی خراب فراخوانی را نمی‌شکند
  onLlmHealth(() => { throw new Error('boom'); });
  try { assert.deepEqual(await completeJsonWith(fake([OK]).client, metisCfg(), 'S', 'U', SCHEMA), JSON.parse(OK)); } finally { onLlmHealth(null); }
});

await t('L18 هشدارِ ادمین: 402/401 فوری؛ خطایِ گذرا فقط پس از چند خطایِ پیاپی؛ موفقیت صفر می‌کند؛ هر ۶ ساعت یک بار', () => {
  let now = 0;
  const alerts: string[] = [];
  const tr = createLlmAlertTracker({ now: () => now, alert: (r, p) => alerts.push(`${p}:${r}`) });
  const fail = (status?: number) => tr.handle({ ok: false, provider: 'metis', purpose: 'case-file', status, transient: status !== 401 });
  fail(402);
  assert.deepEqual(alerts, ['metis:credit']);
  fail(402); now += THROTTLE_MS - 1; fail(402);
  assert.equal(alerts.length, 1, 'تکرار در همان ۶ ساعت');
  now += 2; fail(402);
  assert.deepEqual(alerts, ['metis:credit', 'metis:credit']);
  alerts.length = 0;
  tr.handle({ ok: true, provider: 'metis', purpose: 'case-file' });
  for (let i = 1; i < FAIL_STREAK; i++) fail(503);
  tr.handle({ ok: true, provider: 'metis', purpose: 'case-file' });
  for (let i = 1; i < FAIL_STREAK; i++) fail();
  assert.deepEqual(alerts, [], 'قطعیِ کوتاه با پاسخِ موفقِ میانی ⇒ بی‌هشدار');
  fail(503);
  assert.deepEqual(alerts, ['metis:unavailable']);
  fail(401);
  assert.deepEqual(alerts, ['metis:unavailable', 'metis:auth']);
});

// ——— مصرفِ توکن/هزینه (2026-10-01) ———
await t('U1 usageFromResponse: هزینه‌ی provider ارجح؛ وگرنه قیمتِ env؛ وگرنه null', () => {
  const orCfg = resolveLlmConfig('final-transcript', PROD_OR);
  const r1 = usageFromResponse({ usage: { prompt_tokens: 1000, completion_tokens: 500, cost: 0.00042, completion_tokens_details: { reasoning_tokens: 120 } } }, orCfg);
  assert.deepEqual(r1, { calls: 1, prompt_tokens: 1000, completion_tokens: 500, reasoning_tokens: 120, cost_usd: 0.00042 });
  const priced = resolveLlmConfig('final-transcript', { ...METIS, LLM_PROVIDER: 'metis', METIS_PRICE_IN_PER_M: '0.2', METIS_PRICE_OUT_PER_M: '0.8' });
  assert.ok(Math.abs(usageFromResponse({ usage: { prompt_tokens: 1_000_000, completion_tokens: 500_000 } }, priced).cost_usd! - 0.6) < 1e-9);
  const unpriced = resolveLlmConfig('final-transcript', { ...METIS, LLM_PROVIDER: 'metis' });
  assert.equal(usageFromResponse({ usage: { prompt_tokens: 10, completion_tokens: 5 } }, unpriced).cost_usd, null);
  assert.equal(usageFromResponse({}, unpriced).prompt_tokens, 0);
});
await t('U2 addUsage: هزینه‌ی نامعلومِ یک فراخوانی جمع را نامعلوم می‌کند (نه «۰ دلار»)', () => {
  const a = emptyUsage();
  addUsage(a, { calls: 1, prompt_tokens: 10, completion_tokens: 5, cost_usd: 0.001 });
  addUsage(a, { calls: 1, prompt_tokens: 20, completion_tokens: 5, cost_usd: 0.002 });
  assert.equal(a.calls, 2); assert.equal(a.prompt_tokens, 30);
  assert.ok(Math.abs(a.cost_usd! - 0.003) < 1e-12);
  addUsage(a, { calls: 1, cost_usd: null });
  assert.equal(a.cost_usd, null);
  addUsage(a, { calls: 1, cost_usd: 0.5 });
  assert.equal(a.cost_usd, null);
});
await t('U3 createJsonCaller: usage() جمعِ فراخوانی‌هاست، حتی پاسخِ JSONِ نامعتبر (توکنش خرج شده)', async () => {
  const bodies: any[] = [];
  const replies = [{ content: OK, usage: { prompt_tokens: 100, completion_tokens: 40, cost: 0.001 } }, { content: 'نه JSON', usage: { prompt_tokens: 100, completion_tokens: 10, cost: 0.0005 } }, { content: OK, usage: { prompt_tokens: 100, completion_tokens: 40, cost: 0.001 } }];
  const client: ChatClient = { chat: { completions: { async create(b: any) { bodies.push(b); const r = replies[bodies.length - 1]; return { choices: [{ message: { content: r.content }, finish_reason: 'stop' }], usage: r.usage }; } } } };
  const caller = createJsonCaller('final-transcript', { ...PROD_OR, FINAL_TRANSCRIPT_JSON_MODE: 'prompt' }, () => client);
  assert.equal(caller.usage().calls, 0);
  await caller.complete('s', 'u', SCHEMA);
  assert.equal(caller.usage().calls, 1);
  await caller.complete('s', 'u', SCHEMA); // پاسخِ اول نامعتبر ⇒ تلاشِ دوم؛ هر دو شمرده می‌شوند
  const u = caller.usage();
  assert.equal(u.calls, 3);
  assert.equal(u.prompt_tokens, 300);
  assert.ok(Math.abs(u.cost_usd! - 0.0025) < 1e-12);
});

await t('U4 onLlmCall: هر درخواستِ HTTP (موفق، نامعتبر، شکست) یک رویداد با ref و بدونِ متن', async () => {
  const seen: LlmCallEvent[] = [];
  onLlmCall((e) => seen.push(e));
  try {
    const replies: any[] = [{ content: OK, usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.0001 } }, { err: 402 }, { content: 'نه JSON', usage: { prompt_tokens: 7, completion_tokens: 3 } }, { content: OK, usage: { prompt_tokens: 7, completion_tokens: 3 } }];
    let i = 0;
    const client: ChatClient = { chat: { completions: { async create() {
      const r = replies[i++];
      if (r.err) throw Object.assign(new Error('Payment Required'), { status: r.err });
      return { choices: [{ message: { content: r.content }, finish_reason: 'stop' }], usage: r.usage };
    } } } };
    const caller = createJsonCaller('final-transcript', { ...PROD_OR, FINAL_TRANSCRIPT_JSON_MODE: 'prompt' }, () => client, { sessionId: 'sess-1' });
    await caller.complete('s', 'u', SCHEMA);
    await assert.rejects(caller.complete('s', 'u', SCHEMA), (e: any) => e.status === 402);
    await caller.complete('s', 'u', SCHEMA); // پاسخِ اول نامعتبر ⇒ تلاشِ دوم
    assert.equal(seen.length, 4);
    assert.deepEqual(seen.map((e) => e.ok), [true, false, true, true]);
    assert.deepEqual(seen.map((e) => e.attempt), [0, 0, 0, 1]);
    assert.equal(seen[1].status, 402);
    assert.ok(seen.every((e) => e.ref?.sessionId === 'sess-1' && e.purpose === 'final-transcript' && e.provider === 'openrouter'));
    assert.ok(!JSON.stringify(seen).includes('نه JSON'), 'هیچ متنی در رویداد نیست');
    // شنونده‌ی خراب فراخوانی را نمی‌شکند
    onLlmCall(() => { throw new Error('boom'); });
    i = 3;
    assert.deepEqual(await createJsonCaller('final-transcript', { ...PROD_OR, FINAL_TRANSCRIPT_JSON_MODE: 'prompt' }, () => client).complete('s', 'u', SCHEMA), JSON.parse(OK));
  } finally { onLlmCall(null); }
});

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
})();
