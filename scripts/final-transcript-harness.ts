// هارنسِ «متنِ نهایی» (migration 031) — بدونِ DB/شبکه/Soniox/LLMِ واقعی. دادهٔ ساختگی.
// پوشش: ماشینِ حالت (انتظارِ آرشیو، timeout ⇒ realtime، نسبتِ ۰٫۶، retry/backoff، ذخیره‌ی شناسه پیش از قدمِ بعد،
// پاک‌سازیِ Soniox)، نگهبان‌ها (منفی/عدد/نشانگر/طول/هم‌پوشانی ⇒ fallbackِ تکه)، تکه‌بندی رویِ مرزِ نوبت، polishِ دوگذره.
// اجرا: pnpm test:ft
import assert from 'node:assert/strict';
import {
  stepFinalTranscript, BACKOFF_MS, MAX_ATTEMPTS, AUDIO_RECHECK_MS,
  type FtJob, type FtDeps, type FtPatch, type AudioState, type FullAudio, type PolishOutcome,
} from '../server/src/features/final-transcript/domain/jobMachine.js';
import { parseTurns, chunkTurns, renderClean, sampleForOverview, UPLOAD_LABEL, appendUploadForPolish, maxSpeakerNumber } from '../server/src/features/final-transcript/domain/transcriptText.js';
import { checkPolishedChunk, negationCount, numberBag } from '../server/src/features/final-transcript/domain/polishGuards.js';
import { polishTranscript } from '../server/src/features/final-transcript/application/polishTranscript.js';
import type { LlmJsonPort } from '../server/src/features/final-transcript/ports.js';

let pass = 0;
let fail = 0;
async function t(name: string, fn: () => Promise<void> | void) {
  try { await fn(); pass++; console.log('PASS ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + '\n   ' + (e instanceof Error ? e.stack?.split('\n').slice(0, 3).join('\n   ') : String(e))); }
}

// ————————————————— fakes —————————————————
interface World {
  job: FtJob & { nextAttemptInMs?: number; clean?: string; report?: any };
  now: number;
  transcript: string;
  version: number;
  audio: AudioState;
  full: FullAudio;
  soniox: string[];
  pollStatus: string[];
  asyncText: string;
  failUpload: number;
  polish: (text: string) => PolishOutcome;
  polishedInputs: string[];
  log: string[];
}

function newJob(p: Partial<FtJob> = {}): FtJob {
  return {
    sessionId: 's1', therapistId: 't1', clientId: 'c1', stage: 'waiting_audio', attempts: 0, source: null, sourceVersion: 1,
    sonioxFileId: null, sonioxTranscriptionId: null, transcriptionStartedAt: null, asyncText: null, errorCode: null,
    queuedAt: new Date(0), ...p,
  };
}

function world(p: Partial<World> = {}): World {
  return {
    job: newJob(), now: 10 * 60_000, transcript: 'گوینده ۱: سلام خوش اومدید\n\nگوینده ۲: ممنون', version: 1,
    audio: 'complete', full: { ok: true, path: '/a/full.webm', complete: true }, soniox: [], pollStatus: ['completed'],
    asyncText: 'گوینده ۱: سلام، خوش اومدید.\n\nگوینده ۲: ممنونم.', failUpload: 0,
    polish: (text) => ({ ok: true, text: 'CLEAN:' + text.length, report: { chunks: 1 } }), polishedInputs: [], log: [], ...p,
  };
}

function deps(w: World): FtDeps {
  return {
    store: {
      async update(job, patch: FtPatch) { Object.assign(job, patch); Object.assign(w.job, patch); },
      async finish(job, clean, report) { job.stage = 'done'; w.job.stage = 'done'; w.job.clean = clean; w.job.report = report; },
      async skip(job, code) { job.stage = 'skipped'; w.job.stage = 'skipped'; w.job.errorCode = code; },
      async fail(job, code) { job.stage = 'failed'; w.job.stage = 'failed'; w.job.errorCode = code; },
    },
    session: async () => ({ transcript: w.transcript, transcriptVersion: w.version }),
    audioState: async () => w.audio,
    fullAudio: async () => w.full,
    soniox: {
      async uploadFile(p) { if (w.failUpload-- > 0) throw new Error('net'); w.soniox.push('upload:' + p); return 'F1'; },
      async createTranscription(fid) { w.soniox.push('create:' + fid); return 'T1'; },
      async poll() { const s = w.pollStatus.length > 1 ? w.pollStatus.shift()! : w.pollStatus[0]; w.soniox.push('poll:' + s); return { status: s }; },
      async getText() { w.soniox.push('get'); return w.asyncText; },
      async deleteTranscription(id) { w.soniox.push('delT:' + id); return true; },
      async deleteFile(id) { w.soniox.push('delF:' + id); return true; },
    },
    polish: async (_sid, text) => { w.polishedInputs.push(text); return w.polish(text); },
    config: { audioWaitMs: 30 * 60_000, settleMs: 90_000 },
    now: () => w.now,
    log: (m) => w.log.push(m),
  };
}

async function drive(w: World, max = 20) {
  const d = deps(w);
  for (let i = 0; i < max; i++) {
    if (['done', 'failed', 'skipped'].includes(w.job.stage)) return;
    const r = await stepFinalTranscript(w.job, d);
    if (!r.continueNow) {
      // «زمان» جلو می‌رود تا nextAttempt
      w.now += Math.max(1000, w.job.nextAttemptInMs ?? 1000);
    }
  }
}

void (async () => {
// ————————————————— ماشینِ حالت —————————————————
await t('settle: پیش از ۹۰ث بعد از پایان هیچ تصمیمی گرفته نمی‌شود', async () => {
  const w = world({ now: 30_000 });
  await stepFinalTranscript(w.job, deps(w));
  assert.equal(w.job.stage, 'waiting_audio');
  assert.equal(w.job.nextAttemptInMs, 60_000);
  assert.equal(w.soniox.length, 0);
});

await t('مسیرِ کامل: صدا کامل ⇒ async ⇒ polish ⇒ done، و منابعِ Soniox پاک می‌شوند', async () => {
  const w = world();
  await drive(w);
  assert.equal(w.job.stage, 'done');
  assert.equal(w.job.source, 'async');
  assert.deepEqual(w.polishedInputs, [w.asyncText]);
  assert.ok(w.soniox.includes('delT:T1') && w.soniox.includes('delF:F1'));
  assert.equal(w.job.sonioxFileId, null);
  assert.equal(w.job.sonioxTranscriptionId, null);
});

await t('صدا در حالِ sync ⇒ صبر (۳۰ث)', async () => {
  const w = world({ audio: 'syncing' });
  await stepFinalTranscript(w.job, deps(w));
  assert.equal(w.job.stage, 'waiting_audio');
  assert.equal(w.job.nextAttemptInMs, AUDIO_RECHECK_MS);
});

await t('sync بیش از سقفِ انتظار ⇒ source=realtime، بدونِ Soniox', async () => {
  const w = world({ audio: 'syncing', now: 31 * 60_000 });
  await drive(w);
  assert.equal(w.job.stage, 'done');
  assert.equal(w.job.source, 'realtime');
  assert.equal(w.soniox.length, 0);
  assert.deepEqual(w.polishedInputs, [w.transcript]);
});

await t('صدایِ ناقص (seq گمشده) ⇒ realtime', async () => {
  const w = world({ audio: 'incomplete' });
  await drive(w);
  assert.equal(w.job.source, 'realtime');
  assert.equal(w.soniox.length, 0);
});

await t('صدایِ بدونِ سگمنت ⇒ realtime', async () => {
  const w = world({ audio: 'none' });
  await drive(w);
  assert.equal(w.job.source, 'realtime');
});

await t('فایلِ کامل در لحظه‌ی آپلود ناقص درآمد ⇒ realtime (بدونِ آپلود)', async () => {
  const w = world({ full: { ok: true, path: '/a/full.webm', complete: false } });
  await drive(w);
  assert.equal(w.job.source, 'realtime');
  assert.ok(!w.soniox.some((s) => s.startsWith('upload')));
});

await t('نگهبانِ نسبتِ ۰٫۶: متنِ async خیلی کوتاه ⇒ realtime', async () => {
  const w = world({ transcript: 'گوینده ۱: ' + 'واژه '.repeat(100), asyncText: 'گوینده ۱: کوتاه' });
  await drive(w);
  assert.equal(w.job.source, 'realtime');
  assert.ok(w.soniox.includes('delT:T1'), 'منابع باز هم پاک شوند');
});

await t('شناسه‌ی فایل پیش از ساختِ transcription ذخیره می‌شود؛ ری‌استارت دوباره آپلود نمی‌کند', async () => {
  const w = world({ job: newJob({ stage: 'transcribing', sonioxFileId: 'F0' }) });
  await stepFinalTranscript(w.job, deps(w));
  assert.ok(!w.soniox.some((s) => s.startsWith('upload')));
  assert.ok(w.soniox.includes('create:F0'));
  assert.equal(w.job.sonioxTranscriptionId, 'T1');
});

await t('خطایِ آپلود ⇒ backoff؛ بعد از MAX_ATTEMPTS ⇒ failed', async () => {
  const w = world({ job: newJob({ stage: 'transcribing' }), failUpload: 99 });
  const d = deps(w);
  await stepFinalTranscript(w.job, d);
  assert.equal(w.job.attempts, 1);
  assert.equal(w.job.nextAttemptInMs, BACKOFF_MS[0]);
  for (let i = 0; i < MAX_ATTEMPTS + 1; i++) await stepFinalTranscript(w.job, d);
  assert.equal(w.job.stage, 'failed');
  assert.equal(w.job.errorCode, 'soniox-unavailable');
});

await t('processing ⇒ poll دوباره بدونِ شمارشِ تلاش', async () => {
  const w = world({ job: newJob({ stage: 'transcribing', sonioxFileId: 'F1', sonioxTranscriptionId: 'T1', transcriptionStartedAt: new Date(10 * 60_000) }), pollStatus: ['processing'] });
  await stepFinalTranscript(w.job, deps(w));
  assert.equal(w.job.stage, 'transcribing');
  assert.equal(w.job.attempts, 0);
});

await t('polish گذرا ⇒ retry؛ polish دائمی ⇒ failed', async () => {
  const w = world({ job: newJob({ stage: 'polishing', source: 'realtime' }), polish: () => ({ ok: false, transient: true, code: 'llm-unavailable' }) });
  await stepFinalTranscript(w.job, deps(w));
  assert.equal(w.job.stage, 'polishing');
  assert.equal(w.job.attempts, 1);
  w.polish = () => ({ ok: false, transient: false, code: 'llm-not-configured' });
  await stepFinalTranscript(w.job, deps(w));
  assert.equal(w.job.stage, 'failed');
  assert.equal(w.job.errorCode, 'llm-not-configured');
});

await t('متنِ خالی ⇒ skipped', async () => {
  const w = world({ job: newJob({ stage: 'polishing', source: 'realtime' }), transcript: '  ' });
  await stepFinalTranscript(w.job, deps(w));
  assert.equal(w.job.stage, 'skipped');
});

await t('مسیرِ آپلود (source=async از قبل) ⇒ بدونِ Soniox مستقیم polish', async () => {
  const w = world({ job: newJob({ stage: 'polishing', source: 'async', asyncText: 'گوینده ۱: متنِ آپلود' }) });
  await drive(w);
  assert.equal(w.job.stage, 'done');
  assert.equal(w.soniox.length, 0);
  assert.deepEqual(w.polishedInputs, ['گوینده ۱: متنِ آپلود']);
});

await t('sourceVersion در لحظه‌ی polish به نسخه‌ی فعلی می‌رسد (مبنایِ stale)', async () => {
  const w = world({ job: newJob({ stage: 'polishing', source: 'realtime', sourceVersion: 1 }), version: 4 });
  await drive(w);
  assert.equal(w.job.sourceVersion, 4);
});

// ————————————————— متن و تکه‌بندی —————————————————
await t('parseTurns: گوینده، ادامه، نشانگرِ چسبیده به متن', () => {
  const turns = parseTurns('گوینده 1: سلام\n\nادامه\n\nگوینده ۲: خوبم [علامت · ۰۱:۲۳ — گریه] بعدش');
  assert.deepEqual(turns.map((x) => [x.speaker, x.text, !!x.marker]), [
    ['۱', 'سلام', false], [null, 'ادامه', false], ['۲', 'خوبم', false], [null, '[علامت · ۰۱:۲۳ — گریه]', true], [null, 'بعدش', false],
  ]);
});

await t('chunkTurns: مرزِ نوبت حفظ می‌شود و هیچ تکه‌ای از سقف رد نمی‌شود', () => {
  const turns = Array.from({ length: 30 }, (_, i) => ({ speaker: String(i % 2), text: 'جمله '.repeat(40).trim() }));
  const chunks = chunkTurns(turns, 1000);
  assert.ok(chunks.length > 1);
  for (const c of chunks) assert.ok(c.reduce((a, x) => a + x.text.length + 16, 0) <= 1000 + 16);
  assert.equal(chunks.flat().length, 30);
});

await t('chunkTurns: نوبتِ خیلی بلند رویِ مرزِ جمله شکسته می‌شود، بدونِ گم‌شدنِ متن', () => {
  const long = Array.from({ length: 50 }, (_, i) => `جمله‌ی شماره ${i}.`).join(' ');
  const chunks = chunkTurns([{ speaker: '۱', text: long }], 200);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.flat().map((x) => x.text).join(' '), long);
});

await t('renderClean: نوبت‌هایِ پشتِ‌سرِ‌همِ یک نقش یکی و نشانگر جدا می‌ماند', () => {
  const out = renderClean([{ role: 'درمانگر', text: 'سلام.' }, { role: 'درمانگر', text: 'خوبی؟' }, { role: '', text: '[علامت · ۰۰:۱۰ — سکوت]', marker: true }, { role: 'مراجع', text: 'آره.' }]);
  assert.equal(out, 'درمانگر: سلام. خوبی؟\n\n[علامت · ۰۰:۱۰ — سکوت]\n\nمراجع: آره.');
});

await t('sampleForOverview: متنِ بلند فشرده می‌شود', () => {
  const s = sampleForOverview('ا'.repeat(10000), 3000);
  assert.ok(s.length < 3100);
});

// ————————————————— نگهبان‌ها —————————————————
const RAW = 'اِ... نمی‌دونم از کجا شروع کنم. من من این هفته دو بار حمله‌ی اضطراب داشتم و چهل دقیقه طول کشید.';
await t('نگهبان: ویرایشِ مجاز (مکث/تکرار حذف، نقطه‌گذاری) قبول می‌شود', () => {
  assert.equal(checkPolishedChunk(RAW, 'نمی‌دونم از کجا شروع کنم. من این هفته دو بار حمله‌ی اضطراب داشتم و چهل دقیقه طول کشید.'), null);
});
await t('نگهبان: حذفِ منفی ⇒ negation', () => {
  assert.equal(checkPolishedChunk(RAW, 'می‌دونم از کجا شروع کنم. من این هفته دو بار حمله‌ی اضطراب داشتم و چهل دقیقه طول کشید.'), 'negation');
});
await t('نگهبان: تغییرِ عدد ⇒ number (۴۰ = چهل پذیرفته)', () => {
  assert.equal(checkPolishedChunk(RAW, 'نمی‌دونم از کجا شروع کنم. من این هفته سه بار حمله‌ی اضطراب داشتم و چهل دقیقه طول کشید.'), 'number');
  assert.equal(checkPolishedChunk(RAW, 'نمی‌دونم از کجا شروع کنم. من این هفته ۲ بار حمله‌ی اضطراب داشتم و ۴۰ دقیقه طول کشید.'), null);
});
await t('نگهبان: خلاصه‌کردن ⇒ length', () => {
  assert.equal(checkPolishedChunk(RAW, 'نمی‌دونم. دو بار حمله، چهل دقیقه.'), 'length');
});
await t('نگهبان: افزودنِ جمله ⇒ length', () => {
  assert.equal(checkPolishedChunk(RAW, RAW + ' و فکر می‌کنم دلیلش استرسِ کاری و فشارِ خانواده بود که خیلی سنگین است.'), 'length');
});
await t('نگهبان: بازنویسیِ کامل با همان طول ⇒ overlap', () => {
  const raw = 'من دیروز با مادرم رفتم بازار و کلی خرید کردیم ولی آخرش دعوامون شد سرِ پول';
  const pol = 'دیروز همراهِ والده به فروشگاه رفتیم، اقلامی تهیه شد اما بعد بر سرِ هزینه مشاجره شد';
  assert.equal(checkPolishedChunk(raw, pol), 'overlap');
});
await t('نگهبان: نشانگرِ علامت باید دقیقاً بماند', () => {
  const raw = 'گفتم خوبم [علامت · ۰۱:۲۳ — گریه] ولی نبودم';
  assert.equal(checkPolishedChunk(raw, 'گفتم خوبم، ولی نبودم.'), 'marker');
});
await t('negationCount/numberBag پایه', () => {
  assert.equal(negationCount('نه، نمی‌خوام. هیچ‌وقت نیست. نیاز دارم نمونه نشون بدم'), 4);
  assert.deepEqual(numberBag('ساعتِ یازده، ۱۰ دقیقه، دو بار'), ['10', '11', '2']);
});

// ————————————————— polishِ دوگذره با LLMِ جعلی —————————————————
function fakeLlm(chunkFn: (user: string) => any): LlmJsonPort & { calls: string[] } {
  const calls: string[] = [];
  return {
    model: 'fake', calls,
    async completeJson<T>(system: string, user: string): Promise<T> {
      calls.push(system.includes('ویراستار') ? 'chunk' : 'overview');
      if (!system.includes('ویراستار')) return { speaker_map: [{ speaker: '1', role: 'درمانگر' }, { speaker: '۲', role: 'مراجع' }], summary: 'خلاصه', glossary: [] } as T;
      return chunkFn(user) as T;
    },
  };
}
const RAW_SESSION = 'گوینده ۱: سلام مهسا خوش اومدی\n\nگوینده ۲: اِ... نمی‌دونم از کجا شروع کنم من من دو بار حمله داشتم\n\n[علامت · ۰۰:۴۰ — گریه]\n\nگوینده ۱: دو بار. بیشتر بگو';

await t('polish: نقش‌گذاری + نشانگر در جایِ خود + گزارش', async () => {
  const llm = fakeLlm(() => ({ turns: [
    { speaker_role: 'درمانگر', text: 'سلام مهسا، خوش اومدی.' },
    { speaker_role: 'مراجع', text: 'نمی‌دونم از کجا شروع کنم. من دو بار حمله داشتم.' },
    { speaker_role: 'درمانگر', text: 'دو بار. بیشتر بگو.' },
  ] }));
  const r = await polishTranscript(RAW_SESSION, { unitLabel: 'فردی', speakers: ['مراجع'], terms: [] }, llm, { chunkChars: 6000, overviewChars: 60000, guards: { minLengthRatio: 0.65, maxLengthRatio: 1.15, minOverlap: 0.7 } });
  assert.equal(r.text, 'درمانگر: سلام مهسا، خوش اومدی.\n\nمراجع: نمی‌دونم از کجا شروع کنم. من دو بار حمله داشتم.\n\n[علامت · ۰۰:۴۰ — گریه]\n\nدرمانگر: دو بار. بیشتر بگو.');
  assert.equal(r.report.fallback_chunks, 0);
  assert.deepEqual(llm.calls, ['overview', 'chunk']);
});

await t('polish: تکه‌ی ردشده (منفی حذف شد) ⇒ متنِ خام با نقشِ نگاشت‌شده', async () => {
  const llm = fakeLlm(() => ({ turns: [
    { speaker_role: 'درمانگر', text: 'سلام مهسا، خوش اومدی.' },
    { speaker_role: 'مراجع', text: 'می‌دونم از کجا شروع کنم. من دو بار حمله داشتم.' },
    { speaker_role: 'درمانگر', text: 'دو بار. بیشتر بگو.' },
  ] }));
  const r = await polishTranscript(RAW_SESSION, null, llm, { chunkChars: 6000, overviewChars: 60000, guards: { minLengthRatio: 0.65, maxLengthRatio: 1.15, minOverlap: 0.7 } });
  assert.equal(r.report.fallback_chunks, 1);
  assert.equal(r.report.fallback_reasons.negation, 1);
  assert.ok(r.text.startsWith('درمانگر: سلام مهسا خوش اومدی'));
  assert.ok(r.text.includes('مراجع: اِ... نمی‌دونم'));
  assert.ok(r.text.includes('[علامت · ۰۰:۴۰ — گریه]'));
});

await t('polish: خطایِ گذرایِ LLM بالا می‌رود (job دوباره تلاش می‌کند)', async () => {
  const llm = fakeLlm(() => { throw Object.assign(new Error('timeout'), { transient: true }); });
  await assert.rejects(polishTranscript(RAW_SESSION, null, llm, { chunkChars: 6000, overviewChars: 60000, guards: { minLengthRatio: 0.65, maxLengthRatio: 1.15, minOverlap: 0.7 } }));
});

await t('polish: خطایِ غیرگذرایِ یک تکه ⇒ فقط همان تکه خام', async () => {
  const llm = fakeLlm(() => { throw new Error('bad json'); });
  const r = await polishTranscript(RAW_SESSION, null, llm, { chunkChars: 6000, overviewChars: 60000, guards: { minLengthRatio: 0.65, maxLengthRatio: 1.15, minOverlap: 0.7 } });
  assert.equal(r.report.fallback_reasons['llm-error'], 1);
  assert.ok(r.text.includes('گوینده') === false);
});

await t('polish: ⟦…؟⟧ شمرده می‌شود', async () => {
  const llm = fakeLlm(() => ({ turns: [
    { speaker_role: 'درمانگر', text: 'سلام ⟦مهسا؟⟧، خوش اومدی.' },
    { speaker_role: 'مراجع', text: 'نمی‌دونم از کجا شروع کنم. من دو بار حمله داشتم.' },
    { speaker_role: 'درمانگر', text: 'دو بار. بیشتر بگو.' },
  ] }));
  const r = await polishTranscript(RAW_SESSION, null, llm, { chunkChars: 6000, overviewChars: 60000, guards: { minLengthRatio: 0.65, maxLengthRatio: 1.15, minOverlap: 0.7 } });
  assert.equal(r.report.uncertain, 1);
});

// ————————————————— پلنِ B (2026-09-28): ⟦…؟⟧ِ قطعی، نگهبانِ نقش، برچسبِ آپلود، 402/JSON —————————————————
const PCFG = { chunkChars: 6000, overviewChars: 60000, guards: { minLengthRatio: 0.65, maxLengthRatio: 1.15, minOverlap: 0.7 } };

await t('B1 نگهبان: حذفِ ⟦…؟⟧ِ ورودی ⇒ uncertain؛ اصلاحِ واژه‌ی داخل با حفظِ علامت پذیرفته؛ علامتِ بیشتر پذیرفته', () => {
  const raw = 'من ⟦حملهِ؟⟧ اضطراب داشتم و خیلی ترسیدم';
  assert.equal(checkPolishedChunk(raw, 'من حمله‌ی اضطراب داشتم و خیلی ترسیدم.'), 'uncertain');
  assert.equal(checkPolishedChunk(raw, 'من ⟦حمله‌ی؟⟧ اضطراب داشتم و خیلی ترسیدم.'), null);
  assert.equal(checkPolishedChunk(raw, 'من ⟦حمله‌ی؟⟧ اضطراب داشتم و ⟦خیلی؟⟧ ترسیدم.'), null);
});

await t('B2 polish: LLM علامتِ Soniox را برداشت ⇒ همان تکه خام با ⟦…؟⟧ و شمارشِ uncertain', async () => {
  const raw = 'گوینده ۱: سلام خوش اومدی\n\nگوینده ۲: من دو بار ⟦حمله؟⟧ داشتم و نمی‌دونم چرا';
  const llm = fakeLlm(() => ({ turns: [
    { speaker_role: 'درمانگر', text: 'سلام، خوش اومدی.' },
    { speaker_role: 'مراجع', text: 'من دو بار حمله داشتم و نمی‌دونم چرا.' },
  ] }));
  const r = await polishTranscript(raw, { unitLabel: 'فردی', speakers: ['مراجع'], terms: [] }, llm, PCFG);
  assert.equal(r.report.fallback_reasons.uncertain, 1);
  assert.ok(r.text.includes('⟦حمله؟⟧'), r.text);
  assert.equal(r.report.uncertain, 1, 'علامتِ تکه‌ی برگشته به خام هم شمرده می‌شود');
});

await t('B3 نگهبانِ نقش: نقشِ بیرون از فهرستِ حاضرین ⇒ نقشِ نگاشت‌شده‌ی نوبتِ هم‌تراز (role_fixes)', async () => {
  const llm = fakeLlm(() => ({ turns: [
    { speaker_role: 'درمانگر', text: 'سلام مهسا، خوش اومدی.' },
    { speaker_role: 'گوینده ۳', text: 'نمی‌دونم از کجا شروع کنم. من دو بار حمله داشتم.' },
    { speaker_role: 'درمانگر', text: 'دو بار. بیشتر بگو.' },
  ] }));
  const r = await polishTranscript(RAW_SESSION, { unitLabel: 'فردی', speakers: ['مراجع'], terms: [] }, llm, PCFG);
  assert.equal(r.report.role_fixes, 1);
  assert.ok(r.text.includes('مراجع: نمی‌دونم از کجا'), r.text);
  assert.ok(!r.text.includes('گوینده ۳'));
  // بدونِ فهرست (roster=null) نقش آزاد است
  const r2 = await polishTranscript(RAW_SESSION, null, llm, PCFG);
  assert.equal(r2.report.role_fixes, 0);
});

await t('B4 برچسبِ بخشِ آپلودی: با «\\n» چسبیده به نوبت ⇒ نشانگرِ دست‌نخورده + نوبت با گوینده‌اش؛ برابر با ثابتِ jobRunner', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../server/src/features/audio-upload/jobRunner.ts', import.meta.url), 'utf8');
  const m = /UPLOAD_TRANSCRIPT_LABEL_PREFIX = '([^']+)'/.exec(src);
  assert.equal(m?.[1], UPLOAD_LABEL);
  const turns = parseTurns('گوینده ۱: سلام\n\n' + UPLOAD_LABEL + '\nگوینده ۱: ادامه‌ی جلسه');
  assert.deepEqual(turns.map((x) => [x.speaker, x.text, !!x.marker]), [['۱', 'سلام', false], [null, UPLOAD_LABEL, true], ['۱', 'ادامه‌ی جلسه', false]]);
});

await t('B5 appendUploadForPolish: شماره‌ی گوینده‌هایِ بخشِ آپلودی بعد از بیشینه‌ی بخشِ قبلی (دو diarizationِ مستقل)', () => {
  const cur = 'گوینده ۱: الف\n\nگوینده ۳: ب\n\n[علامت · ۰۰:۴۰ — گریه]';
  assert.equal(maxSpeakerNumber(cur), 3);
  const out = appendUploadForPolish(cur, UPLOAD_LABEL, 'گوینده ۱: ج\n\nگوینده ۲: د\n\nگوینده ۱: ه');
  assert.equal(out, cur + '\n\n' + UPLOAD_LABEL + '\n\nگوینده ۴: ج\n\nگوینده ۵: د\n\nگوینده ۴: ه');
  assert.equal(appendUploadForPolish('متنِ بدونِ گوینده', UPLOAD_LABEL, 'گوینده ۱: x'), 'متنِ بدونِ گوینده\n\n' + UPLOAD_LABEL + '\n\nگوینده ۱: x');
});

await t('B6 polish: برچسبِ آپلودی مثلِ نشانگر دست‌نخورده می‌ماند و به LLM داده نمی‌شود', async () => {
  const raw = appendUploadForPolish('گوینده ۱: سلام خوش اومدی', UPLOAD_LABEL, 'گوینده ۱: من امروز خیلی خسته‌ام');
  let seen = '';
  const llm = fakeLlm((user) => { seen = user; return { turns: [
    { speaker_role: 'درمانگر', text: 'سلام، خوش اومدی.' },
    { speaker_role: 'مراجع', text: 'من امروز خیلی خسته‌ام.' },
  ] }; });
  const r = await polishTranscript(raw, { unitLabel: 'فردی', speakers: ['مراجع'], terms: [] }, llm, PCFG);
  assert.ok(!seen.includes(UPLOAD_LABEL), 'برچسب به تکه‌ی LLM نرفت');
  assert.ok(seen.includes('گوینده ۲: من امروز'), 'گوینده‌یِ بخشِ آپلودی شماره‌ی جدا دارد');
  assert.ok(r.text.includes('\n\n' + UPLOAD_LABEL + '\n\n'), r.text);
});

await t('B7 گذرِ برداشتِ کلی: JSONِ نامعتبر ⇒ خطایِ گذرا (job دوباره تلاش می‌کند، failedِ بی‌برگشت نه)', async () => {
  const llm: LlmJsonPort = { model: 'fake', async completeJson() { throw Object.assign(new Error('bad'), { code: 'llm-invalid-output', transient: false }); } };
  await assert.rejects(polishTranscript(RAW_SESSION, null, llm, PCFG), (e: any) => e.transient === true);
});

await t('B8 نسبتِ ۰٫۶: علامت‌هایِ ⟦…؟⟧ در طولِ متنِ async شمرده نمی‌شوند', async () => {
  // «گوینده» ۶ نویسه < ۰٫۶×۱۱ = ۶٫۶ ⇒ realtime؛ با شمردنِ علامت‌ها (۹ نویسه) به‌اشتباه async می‌ماند
  const w = world({ asyncText: '⟦گوینده؟⟧', transcript: 'x'.repeat(11) });
  await drive(w);
  assert.equal(w.job.source, 'realtime');
});

// ——— نگهبانِ «نقشِ مجاز ولی غلط» (R20) ———
const COUPLE = { unitLabel: 'زوج', speakers: ['خانم', 'آقا'], terms: [] as string[] };
function mapLlm(map: Array<[string, string]>, turns: Array<{ speaker_role: string; text: string }>): LlmJsonPort {
  return {
    model: 'fake',
    async completeJson<T>(system: string): Promise<T> {
      if (!system.includes('ویراستار')) return { speaker_map: map.map(([speaker, role]) => ({ speaker, role })), summary: 'خلاصه', glossary: [] } as T;
      return { turns } as T;
    },
  };
}
const RAW3 = 'گوینده ۱: سلام خوش اومدید امروز از کجا شروع کنیم\n\nگوینده ۲: این هفته خیلی سخت گذشت برامون\n\nگوینده ۳: من فکر می‌کنم بحث نبود فقط گفتم الان وقتش نیست';
const SWAPPED = [
  { speaker_role: 'درمانگر', text: 'سلام، خوش اومدید. امروز از کجا شروع کنیم؟' },
  { speaker_role: 'آقا', text: 'این هفته خیلی سخت گذشت برامون.' },
  { speaker_role: 'خانم', text: 'من فکر می‌کنم بحث نبود، فقط گفتم الان وقتش نیست.' },
];

await t('B9 تفکیکِ سالم (async، ۳ برچسب = ۳ حاضر): LLM بیشترِ نقش‌ها را برخلافِ نگاشت عوض کرد ⇒ نقش‌ها به نگاشت برمی‌گردند (متنِ مرتب می‌ماند)', async () => {
  const llm = mapLlm([['۱', 'درمانگر'], ['۲', 'خانم'], ['۳', 'آقا']], SWAPPED);
  const r = await polishTranscript(RAW3, COUPLE, llm, { ...PCFG, trustDiarization: true });
  assert.equal(r.report.role_reverts, 1);
  assert.ok(r.text.includes('خانم: این هفته خیلی سخت گذشت برامون.'), r.text);
  assert.ok(r.text.includes('آقا: من فکر می‌کنم بحث نبود، فقط گفتم'), r.text);
  // همان ورودی بدونِ اعتماد (realtime/الحاقی) ⇒ انتخابِ LLM می‌ماند
  const r2 = await polishTranscript(RAW3, COUPLE, llm, { ...PCFG, trustDiarization: false });
  assert.equal(r2.report.role_reverts, 0);
  assert.ok(r2.text.includes('آقا: این هفته'), r2.text);
});

await t('B10 تفکیکِ ادغام‌شده (۲ برچسب برایِ ۳ حاضر، مثلِ فاز ۰B): نگهبان خاموش، نقش از محتوا (LLM) می‌ماند', async () => {
  const raw = 'گوینده ۱: سلام خوش اومدید امروز از کجا شروع کنیم\n\nگوینده ۲: این هفته خیلی سخت گذشت برامون\n\nگوینده ۲: من فکر می‌کنم بحث نبود فقط گفتم الان وقتش نیست';
  const llm = mapLlm([['۱', 'درمانگر'], ['۲', 'خانم']], [SWAPPED[0], { speaker_role: 'خانم', text: SWAPPED[1].text }, { speaker_role: 'آقا', text: SWAPPED[2].text }]);
  const r = await polishTranscript(raw, COUPLE, llm, { ...PCFG, trustDiarization: true });
  assert.equal(r.report.role_reverts, 0);
  assert.ok(r.text.includes('آقا: من فکر می‌کنم'), r.text);
});

await t('B11 یک اصلاحِ تکی (کمتر از نیمِ نوبت‌ها) ⇒ پذیرفته، بدونِ برگشت', async () => {
  const llm = mapLlm([['۱', 'درمانگر'], ['۲', 'خانم'], ['۳', 'آقا']], [SWAPPED[0], { speaker_role: 'خانم', text: SWAPPED[1].text }, { speaker_role: 'خانم', text: SWAPPED[2].text }]);
  const r = await polishTranscript(RAW3, COUPLE, llm, { ...PCFG, trustDiarization: true });
  assert.equal(r.report.role_reverts, 0);
  assert.ok(r.text.includes('خانم: این هفته خیلی سخت گذشت برامون. من فکر می‌کنم'), r.text);
});

await t('B12 ماشینِ حالت: trustDiarization فقط برایِ asyncِ بدونِ برچسبِ آپلود', async () => {
  const seen: Array<boolean | undefined> = [];
  for (const [source, text] of [['async', 'گوینده ۱: سلام'], ['async', 'گوینده ۱: الف\n\n' + UPLOAD_LABEL + '\n\nگوینده ۲: ب'], ['realtime', null]] as const) {
    const w = world();
    w.job = newJob({ stage: 'polishing', source, asyncText: text });
    const d = deps(w);
    d.polish = async (_s, _t, o) => { seen.push(o?.trustDiarization); return { ok: true, text: 'x', report: {} }; };
    await stepFinalTranscript(w.job, d);
  }
  assert.deepEqual(seen, [true, false, false]);
});

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
})();
