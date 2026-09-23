// harness پرونده‌ی درمان — بدونِ شبکه/DB/LLMِ واقعی. دادهٔ کاملاً ساختگی (LAW-001: هیچ متنِ بالینیِ واقعی).
// اجرا: pnpm test:cf
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  factId, quoteId, indexDigest, splitSourcePhrase, finalizeDraft as finalizeCouple, reportProblems, deriveValue, deriveAxisBody,
} from '../server/src/features/case-file/domain/findings.js';
import { validateCaseFileDraft, checkDigestCoverage } from '../server/src/features/case-file/domain/validate.js';
import { renderDigest } from '../server/src/features/case-file/application/renderDigest.js';
import { mergeCaseFileDraft } from '../server/src/features/case-file/application/mergeTherapistEdits.js';
import { applyFieldPatch, dropGhostMedication, migrateAnsweredQuestions } from '../server/src/features/case-file/application/applyFieldPatch.js';
import { upgradeLegacyContent } from '../server/src/features/case-file/application/upgradeLegacyContent.js';
import { composeWithRepair, digestWithRepair } from '../server/src/features/case-file/application/repairLoop.js';
import { resolveReasoningBody } from '../server/src/features/case-file/adapters/llm/openrouter.adapter.js';
import { FINDING_ROLES, FINDING_ROLE_LABEL } from '../server/src/features/case-file/domain/types.js';
import { CASE_FILE_JSON_SCHEMA } from '../server/src/features/case-file/adapters/llm/caseFileJsonSchema.js';
import { CASE_FILE_SYSTEM_PROMPT as SYSTEM_PROMPT, buildAnsweredQuestionsBlock } from '../server/src/features/case-file/application/buildCaseFilePrompt.js';
import type { CaseFileDigest, RawCaseFileDraft, RawFinding, RawAxis, RawAxisFinding } from '../server/src/features/case-file/domain/types.js';

let pass = 0, fail = 0;
async function t(name: string, fn: () => void | Promise<void>) {
  try { await fn(); pass++; console.log('PASS ' + name); }
  catch (e: any) { fail++; console.log('FAIL ' + name + ' — ' + (e?.message || e)); }
}

// ---------- دادهٔ ساختگی ----------
const digest: CaseFileDigest = {
  overallStory: 'داستانِ ساختگی',
  sessions: [
    {
      sessionNum: 1, date: '', source: '', correctedText: '',
      facts: [
        { category: 'relationship', text: 'همسر شب‌ها دیر به خانه می‌آید و بحث بالا می‌گیرد', source: 'client_report', about: 'همسر' },
        { category: 'relationship', text: 'مراجع هنگامِ بحث سکوت می‌کند و از اتاق بیرون می‌رود', source: 'therapist_observation', about: '' },
        { category: 'symptom', text: 'بی‌خوابیِ شبانه از دو ماه پیش', source: 'client_report', about: '' },
      ],
      quotes: ['شوهر سوارت می‌شه', 'دیگه نمی‌تونم ادامه بدم'],
      ambiguities: [],
    },
    {
      sessionNum: 2, date: '', source: '', correctedText: '',
      facts: [
        { category: 'relationship', text: 'مادرِ همسر در تصمیم‌های مالیِ خانواده دخالت می‌کند', source: 'therapist_inference', about: 'مادرِ همسر' },
        { category: 'relationship', text: 'زوج آخرِ هفته‌ها با هم پیاده‌روی می‌کنند و از آن رضایت دارند', source: 'client_report', about: '' },
      ],
      quotes: [],
      ambiguities: [],
    },
  ],
};

const F = (label: string, text: string, factIds: string[], source: RawFinding['source'] = 'unspecified', about = ''): RawFinding =>
  ({ label, text, source, about, factIds });

// یافته‌ی محور: نقشِ بالینی + همان فیلدهایِ یافته
const AF = (role: RawAxisFinding['role'], label: string, text: string, factIds: string[], source: RawFinding['source'] = 'unspecified', about = ''): RawAxisFinding =>
  ({ role, label, text, source, about, factIds });
const AX = (title: string, summary: string, items: RawAxisFinding[], statusTone: RawAxis['statusTone'] = 'watch'): RawAxis =>
  ({ title, summary, items, pending: false, statusTone, sensitiveDoNotDiscussInFrontOfClient: false });
// محورِ پیش‌فرض: علامتِ بی‌خوابی (S1F3) را پوشش می‌دهد تا در مسیرِ سالمِ زوجین «فکتِ یتیم» نسازد
const sleepAxis = () => AX('خواب', 'بی‌خوابیِ شبانه', [AF('evidence', 'بی‌خوابی', 'بی‌خوابیِ شبانه از دو ماه پیش', [factId(1, 2)], 'client_report')]);

function mkRaw(couple: RawCaseFileDraft['coupleRelationship'], extra: Partial<RawCaseFileDraft> = {}): RawCaseFileDraft {
  const fld = { value: '', pending: true };
  return {
    identity: fld, mainIssue: fld, overallStatus: fld, safetyRisk: fld, sensitiveContext: fld,
    medication: [], axes: [sleepAxis()], familyRelationship: { title: 'ارتباط با خانواده', fields: [] },
    coupleRelationship: couple, changes: [],
    sessionsSummary: [], roadmap: [], pendingQuestions: [], keyPoints: [], ...extra,
  };
}
const group = (fields: { key: string; label: string; items: RawFinding[] }[]) =>
  ({ title: 'رابطه‌ی زوجین', fields: fields.map(f => ({ ...f, pending: f.items.length === 0 })) });

const fullCouple = () => group([
  { key: 'interaction', label: 'الگوی تعامل', items: [
    F('الگوی بحث', 'همسر شب‌ها دیر به خانه می‌آید و بحث بالا می‌گیرد', [factId(1, 0)], 'client_report', 'همسر'),
    F('واکنش مراجع', 'مراجع هنگامِ بحث سکوت می‌کند و از اتاق بیرون می‌رود', [factId(1, 1)], 'therapist_observation'),
  ] },
  { key: 'protective', label: 'منابع و عوامل محافظتی', items: [
    F('وقتِ مشترک', 'زوج آخرِ هفته‌ها با هم پیاده‌روی می‌کنند و از آن رضایت دارند', [factId(2, 1)], 'client_report'),
  ] },
  { key: 'key_people', label: 'افراد مؤثر', items: [
    F('مادرِ همسر', 'در تصمیم‌های مالیِ خانواده دخالت می‌کند', [factId(2, 0)], 'therapist_inference', 'مادرِ همسر'),
  ] },
  { key: 'quotes', label: 'نقل‌ها', items: [
    F('', 'شوهر سوارت می‌شه', [quoteId(1, 0)]), F('', 'دیگه نمی‌تونم ادامه بدم', [quoteId(1, 1)]),
  ] },
]);

const field = (r: ReturnType<typeof finalizeCouple>, key: string) => r.draft.coupleRelationship!.fields.find(f => f.key === key)!;

(async () => {
  // ---------- شناسه‌ها و رندر ----------
  await t('F1 شناسه‌ها موقعیتی و یکتا', () => {
    const idx = indexDigest(digest);
    assert.equal(idx.size, 3 + 2 + 2);
    assert.equal(idx.get('S1F1')!.kind, 'fact');
    assert.equal(idx.get('S1Q2')!.text, 'دیگه نمی‌تونم ادامه بدم');
    assert.equal(idx.get('S2F1')!.about, 'مادرِ همسر');
  });
  await t('F2 renderDigest شناسه‌ها را چاپ می‌کند', () => {
    const txt = renderDigest(digest);
    assert.ok(txt.includes('[S1F1 · رابطه · همسر · به گفته‌ی مراجع]'), txt);
    assert.ok(txt.includes('[S1Q1] «شوهر سوارت می‌شه»'));
    assert.ok(txt.includes('[S2F1 · رابطه · مادرِ همسر · به توصیف درمانگر]'));
  });

  // ---------- جداکردنِ عبارتِ منبع ----------
  await t('F3 عبارتِ منبع از متن جدا و source می‌شود', () => {
    assert.deepEqual(splitSourcePhrase('به گفته‌ی مراجع، خواب ندارد'), { text: 'خواب ندارد', source: 'client_report' });
    assert.deepEqual(splitSourcePhrase('مشاهده در جلسه: گریه کرد'), { text: 'گریه کرد', source: 'therapist_observation' });
    assert.deepEqual(splitSourcePhrase('به توصیف درمانگر، اجتنابی است'), { text: 'اجتنابی است', source: 'therapist_inference' });
    assert.deepEqual(splitSourcePhrase('خواب ندارد'), { text: 'خواب ندارد', source: null });
  });

  // ---------- finalize: مسیرِ سالم ----------
  await t('F4 خروجیِ کامل: بدونِ تخلف و بدونِ موارد دیگر', () => {
    const r = finalizeCouple(mkRaw(fullCouple()), digest);
    assert.deepEqual(reportProblems(r.report), []);
    assert.equal(r.draft.coupleRelationship!.fields.some(f => f.key === 'other'), false);
    assert.equal(field(r, 'interaction').items!.length, 2);
    assert.equal(field(r, 'interaction').items![0].source, 'client_report');
    assert.equal(field(r, 'interaction').items![0].about, 'همسر');
  });
  await t('F5 value مشتق با قالبِ قدیمی (برچسب: منبع، متن) و نقل با « »', () => {
    const r = finalizeCouple(mkRaw(fullCouple()), digest);
    assert.equal(field(r, 'interaction').value.split('\n')[0],
      'الگوی بحث: به گفته‌ی مراجع، همسر شب‌ها دیر به خانه می‌آید و بحث بالا می‌گیرد');
    assert.equal(field(r, 'quotes').value, '«شوهر سوارت می‌شه»\n«دیگه نمی‌تونم ادامه بدم»');
    assert.equal(deriveValue([], false), '');
  });

  // ---------- منبع/برچسب ----------
  await t('F6 عبارتِ منبعِ داخلِ متن حذف و به source منتقل می‌شود', () => {
    const raw = mkRaw(group([{ key: 'interaction', label: 'الگوی تعامل', items: [
      F('الگوی بحث', 'به گفته‌ی مراجع، همسر دیر می‌آید', [factId(1, 0)]),
    ] }]));
    const it = field(finalizeCouple(raw, digest), 'interaction').items![0];
    assert.equal(it.text, 'همسر دیر می‌آید');
    assert.equal(it.source, 'client_report');
  });
  await t('F7 برچسبِ نامعتبر (عبارتِ منبع/بلند/خالی) گزارش و جایگزین می‌شود', () => {
    const raw = mkRaw(group([{ key: 'interaction', label: 'الگوی تعامل', items: [
      F('به گفته‌ی مراجع', 'همسر دیر می‌آید', [factId(1, 0)]),
      F('', 'مراجع سکوت می‌کند', [factId(1, 1)]),
      F('یک برچسبِ بسیار بسیار بسیار بلند که دیگر برچسب نیست و یک جمله است', 'متنِ سوم', []),
    ] }]));
    const r = finalizeCouple(raw, digest);
    assert.equal(r.report.badLabels.length, 3);
    for (const it of field(r, 'interaction').items!) assert.ok(it.label.length > 0 && it.label.length <= 40, it.label);
  });

  // ---------- نقل‌هایِ عینی ----------
  await t('F8 نقلِ دست‌کاری‌شده با ارجاع، عینِ digest می‌شود', () => {
    const raw = mkRaw(group([{ key: 'quotes', label: 'نقل‌ها', items: [F('', 'شوهرت سوارت میشه', [quoteId(1, 0)])] }]));
    const r = finalizeCouple(raw, digest);
    assert.equal(field(r, 'quotes').items![0].text, 'شوهر سوارت می‌شه');
  });
  await t('F9 نقلِ بدونِ ارجاع ولی نزدیک، با تطبیق عینِ digest می‌شود', () => {
    const raw = mkRaw(group([{ key: 'quotes', label: 'نقل‌ها', items: [F('', 'شوهر سوارت میشه', [])] }]));
    assert.equal(field(finalizeCouple(raw, digest), 'quotes').items![0].text, 'شوهر سوارت می‌شه');
  });
  await t('F10 نقلِ ساختگی حذف و گزارش می‌شود؛ نقلِ درست دست‌نخورده', () => {
    const raw = mkRaw(group([{ key: 'quotes', label: 'نقل‌ها', items: [
      F('', 'این را مراجع هرگز نگفته', []), F('', 'دیگه نمی‌تونم ادامه بدم', [quoteId(1, 1)]),
    ] }]));
    const r = finalizeCouple(raw, digest);
    assert.equal(r.report.unmatchedQuotes.length, 1);
    assert.deepEqual(field(r, 'quotes').items!.map(i => i.text), ['دیگه نمی‌تونم ادامه بدم']);
  });
  await t('F11 نقلِ تکراری یک‌بار می‌آید', () => {
    const raw = mkRaw(group([{ key: 'quotes', label: 'نقل‌ها', items: [
      F('', 'شوهر سوارت می‌شه', [quoteId(1, 0)]), F('', 'شوهر سوارت می‌شه', [quoteId(1, 0)]),
    ] }]));
    assert.equal(field(finalizeCouple(raw, digest), 'quotes').items!.length, 1);
  });

  // ---------- ردیابیِ مکانیکی ----------
  await t('F12 فکتِ رابطه‌ایِ گم‌شده به «موارد دیگر» می‌رود (با متن/منبع/فرد)', () => {
    const c = fullCouple();
    c.fields = c.fields.filter(f => f.key !== 'key_people'); // فکتِ مادرِ همسر (S2F1) فراموش شد
    const r = finalizeCouple(mkRaw(c), digest);
    const other = field(r, 'other');
    assert.equal(other.label, 'موارد دیگر');
    assert.equal(other.items!.length, 1);
    assert.equal(other.items![0].text, 'مادرِ همسر در تصمیم‌های مالیِ خانواده دخالت می‌کند');
    assert.equal(other.items![0].source, 'therapist_inference');
    assert.equal(other.items![0].about, 'مادرِ همسر');
    assert.equal(r.report.orphanFacts.length, 1);
    assert.equal(reportProblems(r.report).length, 1);
  });
  await t('F13 همه‌ی فکت‌هایِ رابطه‌ایِ digest در خروجی هستند (بدونِ استثنا)', () => {
    const r = finalizeCouple(mkRaw(group([{ key: 'protective', label: 'محافظتی', items: [] }])), digest);
    const all = r.draft.coupleRelationship!.fields.flatMap(f => f.items!.map(i => i.text));
    for (const e of indexDigest(digest).values()) {
      if (e.kind === 'fact' && e.category === 'relationship') assert.ok(all.includes(e.text), 'گم شد: ' + e.text);
    }
    assert.equal(field(r, 'protective').pending, true);
  });
  await t('F14 فکتی که جایِ دیگرِ پرونده (خانواده) ردی دارد یتیم حساب نمی‌شود', () => {
    const c = fullCouple();
    c.fields = c.fields.filter(f => f.key !== 'key_people');
    const raw = mkRaw(c, { familyRelationship: { title: 'ارتباط با خانواده', fields: [
      { key: 'in_law', label: 'خانواده‌ی همسر', pending: false, items: [F('مادرِ همسر', 'مادرِ همسر در تصمیم‌های مالیِ خانواده دخالت می‌کند', [])] },
    ] } });
    const r = finalizeCouple(raw, digest);
    assert.equal(r.report.orphanFacts.length, 0);
    assert.equal(r.draft.coupleRelationship!.fields.some(f => f.key === 'other'), false);
  });
  await t('F15 فکتِ غیررابطه‌ای (علامت) وارد زوجین نمی‌شود', () => {
    const r = finalizeCouple(mkRaw(group([])), digest);
    const all = r.draft.coupleRelationship!.fields.flatMap(f => f.items!.map(i => i.text));
    assert.ok(!all.some(x => x.includes('بی‌خوابی')));
  });
  await t('F16 coupleRelationship=null و digest=null بدونِ خطا', () => {
    assert.equal(finalizeCouple(mkRaw(null), digest).draft.coupleRelationship, null);
    const r = finalizeCouple(mkRaw(fullCouple()), null);
    assert.equal(r.report.orphanFacts.length, 0);
    assert.equal(field(r, 'interaction').items!.length, 2);
  });

  // ---------- اعتبارسنجی ----------
  await t('F17 validate: شکلِ قدیمیِ زوجین (value رشته‌ای) رد می‌شود', () => {
    const old: any = mkRaw(null);
    old.coupleRelationship = { title: 'x', fields: [{ key: 'a', label: 'b', value: 'c', pending: false }] };
    assert.throws(() => validateCaseFileDraft(old));
  });
  await t('F18 validate: شکلِ جدید و source نامعتبر', () => {
    validateCaseFileDraft(mkRaw(fullCouple()));
    const bad: any = mkRaw(fullCouple());
    bad.coupleRelationship.fields[0].items[0].source = 'whatever';
    assert.throws(() => validateCaseFileDraft(bad));
  });

  // ---------- merge و patch ----------
  const corpus: any = { sessions: [] };
  await t('F19 merge: فیلدِ تازه items می‌گیرد', () => {
    const c = mergeCaseFileDraft(null, finalizeCouple(mkRaw(fullCouple()), digest).draft, corpus);
    const f = c.coupleRelationship!.fields.find(x => x.key === 'interaction')!;
    assert.equal(f.items!.length, 2);
    assert.equal(f.source, 'ai');
  });
  await t('F20 merge: فیلدِ تاییدشده یخ می‌زند؛ items و متنِ تراپیست می‌ماند، تازه در suggestedUpdate', () => {
    const first = mergeCaseFileDraft(null, finalizeCouple(mkRaw(fullCouple()), digest).draft, corpus);
    const approved = applyFieldPatch(first, 'couple.interaction', 'approve', undefined);
    const c2 = fullCouple();
    c2.fields[0].items = [F('الگوی بحث', 'متنِ کاملاً تازه‌ی مدل', [factId(1, 0)])];
    const second = mergeCaseFileDraft(approved, finalizeCouple(mkRaw(c2), digest).draft, corpus);
    const f = second.coupleRelationship!.fields.find(x => x.key === 'interaction')!;
    assert.equal(f.reviewedByTherapist, true);
    assert.equal(f.items!.length, 2, 'items قدیمی باید بماند');
    assert.ok(f.suggestedUpdate && f.suggestedUpdate.includes('متنِ کاملاً تازه‌ی مدل'));
  });
  await t('F21 patch: edit، items را حذف می‌کند؛ approve نگه می‌دارد', () => {
    const first = mergeCaseFileDraft(null, finalizeCouple(mkRaw(fullCouple()), digest).draft, corpus);
    const edited = applyFieldPatch(first, 'couple.interaction', 'edit', 'برچسب: متنِ دستیِ تراپیست');
    const fe = edited.coupleRelationship!.fields.find(x => x.key === 'interaction')!;
    assert.equal(fe.items, undefined);
    assert.equal(fe.value, 'برچسب: متنِ دستیِ تراپیست');
    assert.equal(fe.source, 'therapist');
    const appr = applyFieldPatch(first, 'couple.interaction', 'approve', undefined);
    assert.equal(appr.coupleRelationship!.fields.find(x => x.key === 'interaction')!.items!.length, 2);
  });
  await t('F22 patch: accept-suggestion، items را حذف می‌کند', () => {
    const first = mergeCaseFileDraft(null, finalizeCouple(mkRaw(fullCouple()), digest).draft, corpus);
    const approved = applyFieldPatch(first, 'couple.interaction', 'approve', undefined);
    const c2 = fullCouple(); c2.fields[0].items = [F('الگوی بحث', 'پیشنهادِ تازه', [factId(1, 0)])];
    const second = mergeCaseFileDraft(approved, finalizeCouple(mkRaw(c2), digest).draft, corpus);
    const acc = applyFieldPatch(second, 'couple.interaction', 'accept-suggestion', undefined);
    const f = acc.coupleRelationship!.fields.find(x => x.key === 'interaction')!;
    assert.equal(f.items, undefined);
    assert.ok(f.value.includes('پیشنهادِ تازه'));
  });

  // ---------- repairLoop با LLMِ ساختگی ----------
  const llm = (outputs: (() => RawCaseFileDraft)[]) => {
    let i = 0;
    return { model: 'mock', calls: () => i,
      digestCorpus: async () => digest,
      generateCaseFile: async () => outputs[Math.min(i++, outputs.length - 1)]() } as any;
  };
  const noKey = () => { const c = fullCouple(); c.fields = c.fields.filter(f => f.key !== 'key_people'); return mkRaw(c); };
  const input = { clientMeta: { category: 'adult', gender: null, alias: null }, corpusText: 'x' };

  await t('F23 repair: تخلف ← retry اصلاح‌شده ← بدونِ «موارد دیگر»', async () => {
    const m = llm([noKey, () => mkRaw(fullCouple())]);
    const d = await composeWithRepair(m, input, digest, { startedAt: Date.now() });
    assert.equal(m.calls(), 2);
    assert.equal(d.coupleRelationship!.fields.some(f => f.key === 'other'), false);
  });
  await t('F24 repair: retry بی‌اثر ← باز هم فکت گم نمی‌شود (بازیابیِ کدی)', async () => {
    const m = llm([noKey, noKey]);
    const d = await composeWithRepair(m, input, digest, { startedAt: Date.now() });
    const other = d.coupleRelationship!.fields.find(f => f.key === 'other')!;
    assert.equal(other.items!.length, 1);
  });
  await t('F25 repair: retry خطا بدهد ← باز هم فکت گم نمی‌شود', async () => {
    let n = 0;
    const m: any = { model: 'mock', digestCorpus: async () => digest,
      generateCaseFile: async () => { if (n++) throw new Error('boom'); return noKey(); } };
    const d = await composeWithRepair(m, input, digest, { startedAt: Date.now() });
    assert.equal(d.coupleRelationship!.fields.find(f => f.key === 'other')!.items!.length, 1);
  });
  await t('F26 repair: خارج از بودجه ← retry نمی‌شود ولی فکت حفظ می‌شود', async () => {
    const m = llm([noKey, () => mkRaw(fullCouple())]);
    const d = await composeWithRepair(m, input, digest, { startedAt: Date.now() - 6 * 60 * 1000 });
    assert.equal(m.calls(), 1);
    assert.equal(d.coupleRelationship!.fields.find(f => f.key === 'other')!.items!.length, 1);
  });
  await t('F27 repair: خروجیِ سالم فقط یک فراخوانی', async () => {
    const m = llm([() => mkRaw(fullCouple())]);
    await composeWithRepair(m, input, digest, { startedAt: Date.now() });
    assert.equal(m.calls(), 1);
  });

  // ================= تعمیم به محورها و خانواده =================
  const axisOf = (r: ReturnType<typeof finalizeCouple>, title: string) => r.draft.axes.find(a => a.title === title)!;
  const emptyRaw = (extra: Partial<RawCaseFileDraft> = {}) => mkRaw(group([]), { axes: [], ...extra });

  await t('G1 محور: یافته‌ها به ترتیبِ ثابتِ نقش می‌نشینند و body مشتق می‌شود', () => {
    const raw = mkRaw(null, { axes: [AX('خواب', 'بی‌خوابیِ شبانه', [
      AF('maintaining', 'نگرانیِ شبانه', 'ذهنِ مراجع شب‌ها درگیرِ بحث‌هاست', [], 'client_report'),
      AF('evidence', 'بی‌خوابی', 'بی‌خوابیِ شبانه از دو ماه پیش', [factId(1, 2)], 'client_report'),
      AF('state', 'الان', 'خواب هنوز مختل است', []),
    ])] });
    const a = axisOf(finalizeCouple(raw, digest), 'خواب');
    assert.deepEqual(a.items!.map(i => i.role), ['state', 'evidence', 'maintaining']);
    assert.equal(a.body.split('\n')[0], 'خلاصه: بی‌خوابیِ شبانه');
    assert.equal(a.body.split('\n').length, 4);
    assert.equal(a.pending, false);
  });
  await t('G2 نقشِ نامعتبر ⇒ other؛ یافته حذف نمی‌شود', () => {
    const raw = mkRaw(null, { axes: [AX('خواب', 's', [AF('whatever' as any, 'الف', 'بی‌خوابیِ شبانه از دو ماه پیش', [factId(1, 2)])])] });
    assert.equal(axisOf(finalizeCouple(raw, digest), 'خواب').items![0].role, 'other');
  });
  await t('G3 فکتِ غیررابطه‌ایِ گم‌شده ⇒ محورِ «سایر موارد» با نقشِ evidence (نه زوجین)', () => {
    const r = finalizeCouple(emptyRaw(), digest);
    const other = axisOf(r, 'سایر موارد');
    assert.ok(other, 'محورِ سایر موارد ساخته نشد');
    assert.ok(other.items!.some(i => i.text.includes('بی‌خوابی') && i.role === 'evidence'));
    assert.ok(r.report.orphanFacts.some(o => o.category === 'symptom'));
  });
  await t('G4 ردیابیِ همه‌ی دسته‌ها: هر فکتِ digest در خروجی هست (property)', () => {
    const r = finalizeCouple(emptyRaw(), digest);
    const all = JSON.stringify(r.draft.axes) + JSON.stringify(r.draft.coupleRelationship) + JSON.stringify(r.draft.familyRelationship);
    for (const e of indexDigest(digest).values()) if (e.kind === 'fact') assert.ok(all.includes(e.text.slice(0, 20)), 'گم شد: ' + e.text);
  });
  await t('G5 فکتی که در mainIssue ردی دارد یتیم نیست', () => {
    const raw = emptyRaw({ mainIssue: { value: 'بی‌خوابیِ شبانه از دو ماه پیش و غمگینی', pending: false } });
    const r = finalizeCouple(raw, digest);
    assert.ok(!r.report.orphanFacts.some(o => o.category === 'symptom'));
  });
  await t('G6 روندِ جلسات جایگزینِ ردِ فکت نمی‌شود (نمای زمان ≠ نمای وضعیت)', () => {
    const raw = emptyRaw({ sessionsSummary: [{ sessionNum: 1, title: 't', body: 'بی‌خوابیِ شبانه از دو ماه پیش', durationIndicator: null }] });
    assert.ok(finalizeCouple(raw, digest).report.orphanFacts.some(o => o.category === 'symptom'));
  });
  await t('G7 خانواده: یافته‌ها نهایی و value مشتق؛ بی‌دادهٔ رابطه‌ای بدونِ زوجین ⇒ family/other', () => {
    const raw = mkRaw(null, { familyRelationship: { title: 'ارتباط با خانواده', fields: [
      { key: 'mother', label: 'مادر', pending: false, items: [F('دخالت', 'به گفته‌ی مراجع، مادر در تصمیم‌ها دخالت می‌کند', [])] },
    ] } });
    const r = finalizeCouple(raw, digest);
    const mother = r.draft.familyRelationship.fields.find(f => f.key === 'mother')!;
    assert.equal(mother.items![0].source, 'client_report');
    assert.equal(mother.value, 'دخالت: به گفته‌ی مراجع، مادر در تصمیم‌ها دخالت می‌کند');
    const other = r.draft.familyRelationship.fields.find(f => f.key === 'other');
    assert.ok(other && other.items!.length >= 1, 'فکتِ رابطه‌ایِ یتیم باید در family/other بیاید');
    assert.equal(r.draft.coupleRelationship, null);
  });
  await t('G8 محور بدونِ items و بدونِ summary ⇒ pending؛ فقط summary ⇒ pending نیست', () => {
    const raw = mkRaw(null, { axes: [AX('الف', '', []), AX('ب', 'فقط عنوان', [])] });
    const r = finalizeCouple(raw, digest);
    assert.equal(axisOf(r, 'الف').pending, true);
    assert.equal(axisOf(r, 'ب').pending, false);
    assert.equal(deriveAxisBody('', []), '');
  });
  await t('G9 validate: شکلِ قدیمیِ محور (body رشته‌ای) رد می‌شود', () => {
    const old: any = mkRaw(null);
    old.axes = [{ title: 'x', body: 'y', pending: false, statusTone: 'watch', sensitiveDoNotDiscussInFrontOfClient: false }];
    assert.throws(() => validateCaseFileDraft(old));
    validateCaseFileDraft(mkRaw(null));
  });
  await t('G10 merge: محورِ تاییدشده یخ می‌زند و items را نگه می‌دارد', () => {
    const first = mergeCaseFileDraft(null, finalizeCouple(mkRaw(null), digest).draft, corpus);
    const id = first.axes.find(a => a.title === 'خواب')!.id;
    const approved = applyFieldPatch(first, 'axis.' + id, 'approve', undefined);
    const raw2 = mkRaw(null, { axes: [AX('خواب', 'خلاصه‌ی تازه', [AF('state', 'الان', 'متنِ کاملاً تازه‌ی مدل', [factId(1, 2)])])] });
    const second = mergeCaseFileDraft(approved, finalizeCouple(raw2, digest).draft, corpus);
    const a = second.axes.find(x => x.title === 'خواب')!;
    assert.equal(a.reviewedByTherapist, true);
    assert.equal(a.items![0].text, 'بی‌خوابیِ شبانه از دو ماه پیش');
    assert.ok(a.suggestedUpdate && a.suggestedUpdate.includes('متنِ کاملاً تازه‌ی مدل'));
  });
  await t('G11 patch: edit روی محور items را حذف می‌کند؛ approve نگه می‌دارد', () => {
    const first = mergeCaseFileDraft(null, finalizeCouple(mkRaw(null), digest).draft, corpus);
    const id = first.axes.find(a => a.title === 'خواب')!.id;
    const edited = applyFieldPatch(first, 'axis.' + id, 'edit', 'خلاصه: دستی\nمتنِ تراپیست');
    assert.equal(edited.axes.find(a => a.id === id)!.items, undefined);
    assert.equal(applyFieldPatch(first, 'axis.' + id, 'approve', undefined).axes.find(a => a.id === id)!.items!.length, 1);
  });
  await t('G12 patch: edit/accept روی خانواده items را حذف می‌کند', () => {
    const raw = mkRaw(null, { familyRelationship: { title: 'ارتباط با خانواده', fields: [
      { key: 'mother', label: 'مادر', pending: false, items: [F('دخالت', 'مادر دخالت می‌کند', [])] } ] } });
    const first = mergeCaseFileDraft(null, finalizeCouple(raw, null).draft, corpus);
    assert.equal(first.familyRelationship.fields[0].items!.length, 1);
    const edited = applyFieldPatch(first, 'family.mother', 'edit', 'دخالت: دستی');
    assert.equal(edited.familyRelationship.fields[0].items, undefined);
  });

  // ================= «یک فکت = یک خانه‌ی کامل» =================
  const homes = (r: ReturnType<typeof finalizeCouple>) => {
    const m: Record<string, string[]> = {};
    const add = (loc: string, items: any[]) => items.forEach(i => { (m[i.text] = m[i.text] || []).push(loc); });
    r.draft.coupleRelationship?.fields.forEach(f => f.key !== 'key_people' && add('couple:' + f.key, f.items!));
    r.draft.familyRelationship.fields.forEach(f => add('family:' + f.key, f.items!));
    r.draft.axes.forEach(a => add('axis:' + a.title, a.items!));
    return m;
  };

  await t('H1 فکتِ زوجین در محور تکرار نمی‌شود؛ محورِ تهی‌شده حذف می‌شود', () => {
    const raw = mkRaw(fullCouple(), { axes: [sleepAxis(), AX('تنش زناشویی', 'x', [
      AF('state', 'الگوی بحث', 'همسر شب‌ها دیر به خانه می‌آید و بحث بالا می‌گیرد', [factId(1, 0)], 'client_report'),
    ])] });
    const r = finalizeCouple(raw, digest);
    assert.equal(r.draft.axes.some(a => a.title === 'تنش زناشویی'), false);
    assert.equal(r.report.droppedDuplicates, 1);
    assert.equal(field(r, 'interaction').items!.length, 2, 'خانه‌ی اصلی دست‌نخورده');
    assert.ok(r.draft.axes.some(a => a.title === 'خواب'), 'محورِ سالم نمی‌ماند');
  });
  await t('H2 خانواده در برابرِ محور: خانواده خانه می‌ماند', () => {
    const raw = mkRaw(null, {
      familyRelationship: { title: 'ارتباط با خانواده', fields: [
        { key: 'in_law', label: 'خانواده‌ی همسر', pending: false, items: [F('دخالت', 'مادرِ همسر در تصمیم‌های مالیِ خانواده دخالت می‌کند', [factId(2, 0)])] } ] },
      axes: [sleepAxis(), AX('خانواده', 'x', [AF('maintaining', 'دخالت', 'مادرِ همسر در تصمیم‌های مالیِ خانواده دخالت می‌کند', [factId(2, 0)])])],
    });
    const r = finalizeCouple(raw, digest);
    assert.equal(r.draft.axes.some(a => a.title === 'خانواده'), false);
    assert.equal(r.draft.familyRelationship.fields[0].items!.length, 1);
  });
  await t('H3 key_people مستثناست: هم فهرستِ افراد هم خانه‌ی اصلی می‌ماند', () => {
    const raw = mkRaw(fullCouple(), { familyRelationship: { title: 'ارتباط با خانواده', fields: [] } });
    const r = finalizeCouple(raw, digest);
    assert.equal(field(r, 'key_people').items!.length, 1);
    assert.equal(r.report.droppedDuplicates, 0);
  });
  await t('H4 نقل در محور و در نقشِ quotes: فقط در quotes می‌ماند', () => {
    const raw = mkRaw(fullCouple(), { axes: [sleepAxis(), AX('نقل‌ها', 'x', [AF('state', 'الف', 'شوهر سوارت می‌شه', [quoteId(1, 0)])])] });
    const r = finalizeCouple(raw, digest);
    assert.equal(r.draft.axes.some(a => a.title === 'نقل‌ها'), false);
    assert.equal(field(r, 'quotes').items!.length, 2);
  });
  await t('H5 یک فکت در دو محور: فقط اولی می‌ماند', () => {
    const it = () => AF('evidence', 'بی‌خوابی', 'بی‌خوابیِ شبانه از دو ماه پیش', [factId(1, 2)]);
    const r = finalizeCouple(mkRaw(null, { axes: [AX('الف', 's', [it()]), AX('ب', 's', [it()])] }), digest);
    assert.deepEqual(r.draft.axes.map(a => a.title), ['الف']);
  });
  await t('H6 یافته‌ی بدونِ ارجاع یا با ارجاعِ جزئیِ تازه حذف نمی‌شود', () => {
    const c6 = fullCouple(); c6.fields = c6.fields.filter(f => f.key !== 'protective'); // S2F2 آزاد شد
    const raw = mkRaw(c6, { axes: [sleepAxis(), AX('ج', 's', [
      AF('state', 'بدونِ ارجاع', 'یک گزاره‌ی بی‌ارجاع', []),
      AF('state', 'ارجاعِ جزئی', 'ترکیبِ فکتِ تکراری و تازه', [factId(1, 0), factId(2, 1)]),
    ])] });
    const a = finalizeCouple(raw, digest).draft.axes.find(x => x.title === 'ج')!;
    assert.equal(a.items!.length, 2);
  });
  await t('H7 property: هیچ متنی در دو «خانه‌ی کامل» نیست و هر فکت جایی هست', () => {
    const raw = mkRaw(fullCouple(), { axes: [sleepAxis(), AX('تنش', 'x', [
      AF('state', 'الف', 'همسر شب‌ها دیر به خانه می‌آید و بحث بالا می‌گیرد', [factId(1, 0)]),
      AF('state', 'ب', 'زوج آخرِ هفته‌ها با هم پیاده‌روی می‌کنند و از آن رضایت دارند', [factId(2, 1)]),
    ])] });
    const r = finalizeCouple(raw, digest);
    for (const [txt, where] of Object.entries(homes(r))) assert.equal(where.length, 1, txt + ' ← ' + where.join(','));
    const all = JSON.stringify(r.draft);
    for (const e of indexDigest(digest).values()) if (e.kind === 'fact') assert.ok(all.includes(e.text.slice(-12)), 'گم شد: ' + e.text);
  });

  // ================= heartbeat حینِ فراخوانیِ کندِ LLM =================
  const slowLlm = (ms: number) => ({ model: 'mock', digestCorpus: async () => digest,
    generateCaseFile: async () => { await new Promise(r => setTimeout(r, ms)); return mkRaw(fullCouple()); } }) as any;
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  await t('I1 heartbeat در «حینِ» فراخوانیِ کند صدا زده می‌شود و بعدش قطع می‌شود', async () => {
    let beats = 0;
    await composeWithRepair(slowLlm(420), input, digest, { startedAt: Date.now(), heartbeatMs: 50, beforeCall: async () => { beats++; } });
    assert.ok(beats >= 5, 'beats=' + beats);            // ۱ قبل + چند تا حین
    const after = beats; await sleep(200);
    assert.equal(beats, after, 'بعد از پایان نباید heartbeat بماند');
  });
  await t('I2 خطایِ heartbeat تولید را نمی‌کشد', async () => {
    let n = 0;
    const d = await composeWithRepair(slowLlm(200), input, digest, { startedAt: Date.now(), heartbeatMs: 40, beforeCall: async () => { if (n++ > 0) throw new Error('db down'); } });
    assert.ok(d.coupleRelationship);
    assert.ok(n >= 3);
  });
  await t('I3 بدونِ beforeCall هیچ timerی ساخته نمی‌شود و کار می‌کند', async () => {
    const d = await composeWithRepair(slowLlm(30), input, digest, { startedAt: Date.now() });
    assert.ok(d.axes.length >= 1);
  });
  await t('I4 خطایِ خودِ LLM منتشر می‌شود و timer نمی‌ماند', async () => {
    let beats = 0;
    const bad: any = { model: 'm', digestCorpus: async () => digest, generateCaseFile: async () => { await sleep(120); throw new Error('llm boom'); } };
    await assert.rejects(() => composeWithRepair(bad, input, digest, { startedAt: Date.now(), heartbeatMs: 30, beforeCall: async () => { beats++; } }), /llm boom/);
    const after = beats; await sleep(150);
    assert.equal(beats, after);
  });

  // ================= تنظیمِ reasoning (OpenRouter) =================
  await t('J1 reasoning: پیش‌فرض low؛ حساس به حروف نیست؛ default ⇒ بدونِ پارامتر', () => {
    assert.deepEqual(resolveReasoningBody(undefined), { reasoning: { effort: 'low' } });
    assert.deepEqual(resolveReasoningBody(''), { reasoning: { effort: 'low' } });
    assert.deepEqual(resolveReasoningBody(' HIGH '), { reasoning: { effort: 'high' } });
    assert.equal(resolveReasoningBody('default'), undefined);
  });
  await t('J2 reasoning: مقدارِ نامعتبر خطای واضح می‌دهد', () => {
    assert.throws(() => resolveReasoningBody('turbo'), /OPENROUTER_REASONING_EFFORT/);
  });

  // ================= واژگانِ نقش‌ها و ترتیبِ محورها =================
  await t('K1 واژگانِ نقش‌ها در types، json-schema، prompt و UI یکی است', () => {
    const roles = [...FINDING_ROLES];
    assert.deepEqual(Object.keys(FINDING_ROLE_LABEL).sort(), [...roles].sort());
    const schemaRoles = (CASE_FILE_JSON_SCHEMA.schema.properties.axes.items.properties.items.items.properties.role as any).enum;
    assert.deepEqual([...schemaRoles], roles, 'ترتیب/محتوایِ enum در schema');
    const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
    const m = html.match(/const CF_ROLE=\{([^}]*)\};/);
    assert.ok(m, 'CF_ROLE در UI نیست');
    const uiKeys = [...m![1].matchAll(/(\w+):'/g)].map(x => x[1]);
    assert.deepEqual(uiKeys, roles, 'UI');
    for (const r of roles) assert.ok(SYSTEM_PROMPT.includes(r + ' ('), 'پرامپت نقشِ ' + r + ' را ندارد');
    for (const r of roles) assert.ok(html.includes(FINDING_ROLE_LABEL[r]), 'برچسبِ UI: ' + r);
  });
  await t('K2 نقش‌هایِ تازه به ترتیبِ ثابت می‌نشینند', () => {
    const raw = mkRaw(null, { axes: [AX('خواب', 's', [
      AF('goals', 'هدف', 'مراجع می‌خواهد شب‌ها ۷ ساعت بخوابد', []),
      AF('coping', 'مقابله', 'قبل از خواب چای گیاهی می‌نوشد', []),
      AF('impact', 'اثر', 'صبح‌ها در کار تمرکز ندارد', []),
      AF('cognition', 'باور', 'فکر می‌کند اگر نخوابد از پا می‌افتد', []),
      AF('treatment_response', 'پاسخ', 'تمرینِ تنفس مفید بود', []),
      AF('treatment_history', 'سابقه', 'پارسال یک دوره مشاوره داشته', []),
      AF('state', 'الان', 'خواب هنوز مختل است', []),
    ])] });
    const a = finalizeCouple(raw, null).draft.axes[0];
    assert.deepEqual(a.items!.map(i => i.role), ['state', 'impact', 'cognition', 'coping', 'treatment_history', 'treatment_response', 'goals']);
  });
  await t('K3 محورها بر اساسِ لحن مرتب می‌شوند: حساس ← توجه ← مطلوب؛ سایر موارد آخر؛ ترتیبِ هم‌لحن‌ها پایدار', () => {
    const raw = mkRaw(null, { axes: [
      AX('الف', 's', [AF('state', 'x', 'الف۱', [])], 'good'),
      AX('ب', 's', [AF('state', 'x', 'ب۱', [])], 'watch'),
      AX('ج', 's', [AF('state', 'x', 'ج۱', [])], 'sensitive'),
      AX('د', 's', [AF('state', 'x', 'د۱', [])], 'watch'),
    ] });
    const titles = finalizeCouple(raw, null).draft.axes.map(a => a.title);
    assert.deepEqual(titles, ['ج', 'ب', 'د', 'الف']);
  });
  await t('K4 «سایر موارد» حتی با لحنِ watch همیشه آخرِ محورهاست (حتی بعد از good)', () => {
    const r = finalizeCouple(emptyRaw({ axes: [AX('خوب', 's', [AF('state', 'x', 'خوب۱', [])], 'good')] }), digest);
    const titles = r.draft.axes.map(a => a.title);
    assert.equal(titles[titles.length - 1], 'سایر موارد');
    assert.equal(titles[0], 'خوب');
  });

  // ================= نکات کلیدی (۱ تا ۳، اشاره‌گر به یافته) =================
  const KP = (...ids: string[][]) => ids.map(factIds => ({ factIds }));
  const sleepId = (r: ReturnType<typeof finalizeCouple>) => r.draft.axes.find(a => a.title === 'خواب')!.items![0].id;

  await t('L1 نکته‌ی کلیدی به یافته‌ی نهایی وصل می‌شود (نه کپیِ متن)', () => {
    const r = finalizeCouple(mkRaw(null, { keyPoints: KP([factId(1, 2)]) }), digest);
    assert.deepEqual(r.draft.keyPointIds, [sleepId(r)]);
    assert.equal((r.draft as any).keyPoints, undefined, 'شکلِ خام نباید در پیش‌نویسِ نهایی بماند');
  });
  await t('L2 سقفِ ۳، بدونِ تکرار، شناسه‌یِ نامعتبر نادیده', () => {
    const raw = mkRaw(fullCouple(), { keyPoints: KP([factId(1, 2)], [factId(1, 2)], ['S9F9'], [factId(1, 0)], [factId(1, 1)], [factId(2, 1)]) });
    const r = finalizeCouple(raw, digest);
    assert.equal(r.draft.keyPointIds.length, 3);
    assert.equal(new Set(r.draft.keyPointIds).size, 3);
  });
  await t('L3 key_people نکته‌ی کلیدی نمی‌شود', () => {
    const c = fullCouple(); c.fields = c.fields.filter(f => f.key === 'key_people');
    const r = finalizeCouple(mkRaw(c, { keyPoints: KP([factId(2, 0)]) }), digest);
    assert.deepEqual(r.draft.keyPointIds, []);
  });
  await t('L4 نکته به «خانه‌ی نهایی» وصل می‌شود، نه یافته‌ی حذف‌شده‌یِ تکراری', () => {
    const raw = mkRaw(fullCouple(), { keyPoints: KP([factId(1, 0)]), axes: [sleepAxis(), AX('تنش', 'x', [
      AF('state', 'الف', 'همسر شب‌ها دیر به خانه می‌آید و بحث بالا می‌گیرد', [factId(1, 0)])])] });
    const r = finalizeCouple(raw, digest);
    assert.equal(r.draft.keyPointIds.length, 1);
    assert.equal(r.draft.keyPointIds[0], field(r, 'interaction').items![0].id);
  });
  await t('L5 یافته‌یِ بازیابی‌شده (یتیم) هم می‌تواند نکته‌ی کلیدی باشد', () => {
    const r = finalizeCouple(emptyRaw({ keyPoints: KP([factId(1, 2)]) }), digest);
    const other = r.draft.axes.find(a => a.title === 'سایر موارد')!;
    assert.deepEqual(r.draft.keyPointIds, [other.items!.find(i => i.text.includes('بی‌خوابی'))!.id]);
  });
  await t('L6 merge: نکاتِ دست‌نخورده از مدل، ویرایش‌شده از تراپیست', () => {
    const r1 = finalizeCouple(mkRaw(null, { keyPoints: KP([factId(1, 2)]) }), digest);
    const first = mergeCaseFileDraft(null, r1.draft, corpus);
    assert.deepEqual(first.keyPoints, { ids: [sleepId(r1)], edited: false });
    const pinnedNone = applyFieldPatch(first, 'finding.' + sleepId(r1), 'unpin', undefined);
    assert.deepEqual(pinnedNone.keyPoints, { ids: [], edited: true });
    const r2 = finalizeCouple(mkRaw(null, { keyPoints: KP([factId(1, 2)]) }), digest);
    const again = mergeCaseFileDraft(pinnedNone, r2.draft, corpus);
    assert.deepEqual(again.keyPoints, { ids: [], edited: true }, 'انتخابِ تراپیست نباید با regenerate برگردد');
    const forced = mergeCaseFileDraft(null, r2.draft, corpus);
    assert.equal(forced.keyPoints!.edited, false);
  });
  await t('L7 patch: pin/unpin، ایدمپوتنت، سقفِ ۳، یافته‌یِ ناموجود', () => {
    const raw = mkRaw(fullCouple());
    const c0 = mergeCaseFileDraft(null, finalizeCouple(raw, digest).draft, corpus);
    const ids = [
      ...c0.axes.flatMap(a => a.items!.map(i => i.id)),
      ...c0.coupleRelationship!.fields.filter(f => f.key !== 'key_people').flatMap(f => f.items!.map(i => i.id)),
    ];
    assert.ok(ids.length >= 5);
    let c = c0;
    c = applyFieldPatch(c, 'finding.' + ids[0], 'pin', undefined);
    c = applyFieldPatch(c, 'finding.' + ids[0], 'pin', undefined);
    assert.deepEqual(c.keyPoints!.ids, [ids[0]]);
    c = applyFieldPatch(c, 'finding.' + ids[1], 'pin', undefined);
    c = applyFieldPatch(c, 'finding.' + ids[2], 'pin', undefined);
    assert.throws(() => applyFieldPatch(c, 'finding.' + ids[3], 'pin', undefined), /حداکثر 3/);
    assert.throws(() => applyFieldPatch(c, 'finding.f_nope', 'pin', undefined), /یافت نشد/);
    c = applyFieldPatch(c, 'finding.' + ids[1], 'unpin', undefined);
    c = applyFieldPatch(c, 'finding.' + ids[3], 'pin', undefined);
    assert.deepEqual(c.keyPoints!.ids, [ids[0], ids[2], ids[3]]);
    assert.equal(c.keyPoints!.edited, true);
    assert.equal(c0.keyPoints!.ids.length, 0, 'ورودی دست‌نخورده (immutable)');
  });
  await t('L8 patch: عملیاتِ غیر از pin/unpin روی یافته رد می‌شود؛ pin روی فیلدِ دیگر رد می‌شود', () => {
    const c0 = mergeCaseFileDraft(null, finalizeCouple(mkRaw(null), digest).draft, corpus);
    const id = c0.axes[0].items![0].id;
    assert.throws(() => applyFieldPatch(c0, 'finding.' + id, 'edit', 'x'), /pin، unpin یا move/);
    assert.throws(() => applyFieldPatch(c0, 'identity', 'pin', undefined), /نامعتبر/);
  });
  await t('L9 پرونده‌ی قدیمی بدونِ keyPoints: pin کار می‌کند و undefined کرش نمی‌دهد', () => {
    const c0: any = mergeCaseFileDraft(null, finalizeCouple(mkRaw(null), digest).draft, corpus);
    delete c0.keyPoints;
    const c = applyFieldPatch(c0, 'finding.' + c0.axes[0].items[0].id, 'pin', undefined);
    assert.equal(c.keyPoints!.ids.length, 1);
  });
  await t('L10 validate: keyPoints الزامی و ساختارش چک می‌شود', () => {
    validateCaseFileDraft(mkRaw(null));
    const a: any = mkRaw(null); delete a.keyPoints;
    assert.throws(() => validateCaseFileDraft(a), /keyPoints/);
    const b: any = mkRaw(null, { keyPoints: [{ factIds: [1] }] as any });
    assert.throws(() => validateCaseFileDraft(b), /keyPoints/);
  });
  await t('L11 schema/prompt هم‌خوان: keyPoints در schema هست و prompt قاعده‌ی آن را دارد', () => {
    const props = (CASE_FILE_JSON_SCHEMA.schema.properties as any);
    assert.ok(props.keyPoints);
    assert.ok((CASE_FILE_JSON_SCHEMA.schema.required as readonly string[]).includes('keyPoints'));
    assert.ok(SYSTEM_PROMPT.includes('keyPoints'));
  });

  // ================= digest بدونِ فکت (شکستِ خاموش) =================
  const longTx = 'مراجع می‌گوید از دو ماه پیش شب‌ها خوابش نمی‌برد و وقتی با همسرش بحث می‌شود قلبش تند می‌زند';
  const cps = (over: any = {}) => ({ sessions: [{ sessionNum: 1, transcript: longTx, notes: [], ...over }] });
  const dg = (facts: any[]) => ({ overallStory: 'x', sessions: [{ sessionNum: 1, date: '', source: '', correctedText: longTx, facts, quotes: [], ambiguities: [] }] });
  const oneFact = [{ category: 'symptom', text: 'بی‌خوابیِ شبانه از دو ماه پیش', source: 'client_report', about: '' }];

  await t('M1 جلسه‌ی دارای ورودی با facts خالی ⇒ تخلف', () => {
    const p = checkDigestCoverage(cps() as any, dg([]));
    assert.ok(p.some(x => x.includes('هیچ فکتی')), JSON.stringify(p));
  });
  await t('M2 جلسه‌ی دارای فکت ⇒ بدونِ تخلف؛ جلسه‌ی بدونِ ورودی نادیده', () => {
    assert.deepEqual(checkDigestCoverage(cps() as any, dg(oneFact)), []);
    assert.deepEqual(checkDigestCoverage(cps({ transcript: 'کوتاه' }) as any, dg([])), []);
  });
  await t('M3 جلسه‌ای که در digest نیست ⇒ تخلف', () => {
    const p = checkDigestCoverage({ sessions: [{ sessionNum: 2, transcript: longTx, notes: [] }] } as any, dg(oneFact));
    assert.ok(p.some(x => x.includes('در digest نیست')), JSON.stringify(p));
  });
  const digLlm = (outs: any[]) => { let i = 0; return { model: 'm', calls: () => i, digestCorpus: async () => outs[Math.min(i++, outs.length - 1)], generateCaseFile: async () => { throw new Error('unused'); } } as any; };
  await t('M4 digestWithRepair: facts خالی ⇒ retry و digestِ بهتر جایگزین می‌شود', async () => {
    const m = digLlm([dg([]), dg(oneFact)]);
    const d = await digestWithRepair(m, input, cps() as any, { startedAt: Date.now() });
    assert.equal(m.calls(), 2);
    assert.equal(d.sessions[0].facts.length, 1);
  });
  await t('M5 digestWithRepair: retry هم خالی ⇒ خطا نمی‌دهد و همان را برمی‌گرداند', async () => {
    const m = digLlm([dg([]), dg([])]);
    const d = await digestWithRepair(m, input, cps() as any, { startedAt: Date.now() });
    assert.equal(m.calls(), 2);
    assert.equal(d.sessions[0].facts.length, 0);
  });
  await t('M6 digestWithRepair: خروجیِ سالم فقط یک فراخوانی', async () => {
    const m = digLlm([dg(oneFact)]);
    await digestWithRepair(m, input, cps() as any, { startedAt: Date.now() });
    assert.equal(m.calls(), 1);
  });

  // ================= برچسبِ یافته‌ی بازیابی‌شده =================
  await t('N1 فکتِ یتیم با about عمومی («مراجع») برچسبِ معنادار می‌گیرد و چیپِ بی‌معنا نمی‌سازد', () => {
    const d2: any = { overallStory: '', sessions: [{ sessionNum: 1, date: '', source: '', correctedText: '', quotes: [], ambiguities: [], facts: [
      { category: 'risk', text: 'مراجع افکار خودکشی را صریحاً رد کرد', source: 'client_report', about: 'مراجع' },
      { category: 'symptom', text: 'ضربان قلب هنگام بحث تند می‌شود', source: 'client_report', about: 'همسر' } ] }] };
    const r = finalizeCouple(emptyRaw(), d2);
    const other = r.draft.axes.find(a => a.title === 'سایر موارد')!;
    const risk = other.items!.find(i => i.text.includes('خودکشی'))!;
    assert.notEqual(risk.label, 'مراجع');
    assert.equal(risk.about, '');
    assert.ok(risk.label.length > 3);
    const sym = other.items!.find(i => i.text.includes('ضربان'))!;
    assert.equal(sym.label, 'همسر', 'about معنادار همچنان برچسب می‌شود');
    assert.equal(sym.about, 'همسر');
  });

  // ================= ارجاعِ متقاطع (یک خانه‌ی کامل + ارجاعِ کوچک) =================
  const dupRaw = () => mkRaw(fullCouple(), { axes: [sleepAxis(), AX('تنش', 'x', [
    AF('state', 'الگوی بحث', 'همسر شب‌ها دیر به خانه می‌آید و بحث بالا می‌گیرد', [factId(1, 0)]),
    AF('evidence', 'خواب', 'بی‌خوابیِ شبانه از دو ماه پیش', [factId(1, 2)]),
  ])] });
  await t('O1 یافته‌ی حذف‌شده‌ی تکراری ⇒ ارجاع به خانه‌ی اصلی می‌ماند (نه متنِ کامل)', () => {
    const r = finalizeCouple(dupRaw(), digest);
    // «الگوی بحث» در زوجین خانه دارد؛ محورِ «تنش» فقط یک یافته‌ی تازه (خواب) نگه می‌دارد ⇒ ولی خواب هم در محورِ «خواب» خانه دارد ⇒ کلِ محور حذف
    assert.equal(r.draft.axes.some(a => a.title === 'تنش'), false);
    const r2 = finalizeCouple(mkRaw(fullCouple(), { axes: [sleepAxis(), AX('تنش', 'x', [
      AF('state', 'الگوی بحث', 'همسر شب‌ها دیر به خانه می‌آید و بحث بالا می‌گیرد', [factId(1, 0)]),
      AF('state', 'تازه', 'یک یافته‌ی کاملاً تازه', []),
    ])] }), digest);
    const a = r2.draft.axes.find(x => x.title === 'تنش')!;
    assert.equal(a.items!.length, 1);
    assert.equal(a.refs!.length, 1);
    assert.equal(a.refs![0].label, 'الگوی بحث');
    assert.equal(a.refs![0].where, 'رابطه‌ی زوجین — الگوی تعامل');
    assert.equal(a.refs![0].findingId, field(r2, 'interaction').items![0].id);
  });
  await t('O2 ارجاع به «خانه»ی واقعی اشاره می‌کند (نه یافته‌ی حذف‌شده)', () => {
    const r = finalizeCouple(mkRaw(fullCouple(), { axes: [sleepAxis(), AX('تنش', 'x', [
      AF('state', 'الگوی بحث', 'همسر شب‌ها دیر به خانه می‌آید و بحث بالا می‌گیرد', [factId(1, 0)]),
      AF('state', 'تازه', 'یک یافته‌ی کاملاً تازه', []),
    ])] }), digest);
    const ids = new Set([...r.draft.axes.flatMap(a => a.items!.map(i => i.id)), ...r.draft.coupleRelationship!.fields.flatMap(f => f.items!.map(i => i.id))]);
    for (const a of r.draft.axes) for (const ref of a.refs ?? []) assert.ok(ids.has(ref.findingId), 'ارجاعِ معلق');
  });
  await t('O3 merge: refs همراه می‌آید؛ محورِ تاییدشده refs قبلی را نگه می‌دارد', () => {
    const mk2 = (extraText: string) => mkRaw(fullCouple(), { axes: [sleepAxis(), AX('تنش', 'x', [
      AF('state', 'الگوی بحث', 'همسر شب‌ها دیر به خانه می‌آید و بحث بالا می‌گیرد', [factId(1, 0)]), AF('state', 'تازه', extraText, [])])] });
    const first = mergeCaseFileDraft(null, finalizeCouple(mk2('اول'), digest).draft, corpus);
    const ax = first.axes.find(a => a.title === 'تنش')!;
    assert.equal(ax.refs!.length, 1);
    const approved = applyFieldPatch(first, 'axis.' + ax.id, 'approve', undefined);
    assert.equal(approved.axes.find(a => a.title === 'تنش')!.refs!.length, 1, 'approve نباید refs را پاک کند');
    const second = mergeCaseFileDraft(approved, finalizeCouple(mk2('دوم'), digest).draft, corpus);
    assert.equal(second.axes.find(a => a.title === 'تنش')!.items![0].text, 'اول', 'محورِ تاییدشده باید یافته‌ی قبلی را نگه دارد');
  });
  await t('O4 patch: edit روی محور/خانواده refs را هم پاک می‌کند؛ approve نه', () => {
    const raw = mkRaw(fullCouple(), { axes: [sleepAxis(), AX('تنش', 'x', [
      AF('state', 'الگوی بحث', 'همسر شب‌ها دیر به خانه می‌آید و بحث بالا می‌گیرد', [factId(1, 0)]), AF('state', 'تازه', 'تازه', [])])] });
    const c0 = mergeCaseFileDraft(null, finalizeCouple(raw, digest).draft, corpus);
    const id = c0.axes.find(a => a.title === 'تنش')!.id;
    assert.ok(applyFieldPatch(c0, 'axis.' + id, 'approve', undefined).axes.find(a => a.id === id)!.refs);
    assert.equal(applyFieldPatch(c0, 'axis.' + id, 'edit', 'x').axes.find(a => a.id === id)!.refs, undefined);
  });

  // ================= قبل/اکنون به‌صورتِ ردیف‌هایِ موازی =================
  const CH = (label: string, before: string, after: string, factIds: string[] = []) => ({ label, before, after, factIds });
  await t('P1 ردیف‌ها: trim، حذفِ کاملاً خالی، سقفِ ۳، changeOverTime از ردیفِ اول', () => {
    const r = finalizeCouple(mkRaw(null, { changes: [
      CH('خواب', '  بی‌خوابیِ شدید ', ' حدود پنج ساعت '), CH('خالی', ' ', ''), CH('اضطراب', 'بحران', 'کنترل‌شده'),
      CH('کار', 'غیبت', 'حضور'), CH('چهارم', 'الف', 'ب') ] }), null);
    assert.equal(r.draft.changeRows.length, 3);
    assert.deepEqual(r.draft.changeRows.map(c => c.label), ['خواب', 'اضطراب', 'کار']);
    assert.equal(r.draft.changeRows[0].before, 'بی‌خوابیِ شدید');
    assert.deepEqual(r.draft.changeOverTime.before, { value: 'بی‌خوابیِ شدید', pending: false });
    assert.deepEqual(r.draft.changeOverTime.after, { value: 'حدود پنج ساعت', pending: false });
  });
  await t('P2 بدونِ ردیف ⇒ changeOverTime pending و changeRows خالی', () => {
    const r = finalizeCouple(mkRaw(null, { changes: [] }), null);
    assert.deepEqual(r.draft.changeRows, []);
    assert.equal(r.draft.changeOverTime.before.pending, true);
    assert.equal(r.draft.changeOverTime.after.pending, true);
  });
  await t('P3 یک طرفِ خالی حذف نمی‌شود (اطلاعات گم نمی‌شود) و pending فقط همان طرف', () => {
    const r = finalizeCouple(mkRaw(null, { changes: [CH('خواب', 'بی‌خوابی', '')] }), null);
    assert.equal(r.draft.changeRows.length, 1);
    assert.equal(r.draft.changeOverTime.before.pending, false);
    assert.equal(r.draft.changeOverTime.after.pending, true);
  });
  await t('P4 خانه‌ی تغییر ردیف است: همان فکت در محور حذف و به ردیف ارجاع می‌شود', () => {
    const raw = mkRaw(null, { changes: [CH('خواب', 'بی‌خوابیِ شدید', 'بهتر', [factId(1, 2)])], axes: [AX('خواب', 's', [
      AF('change', 'روند', 'بی‌خوابیِ شبانه از دو ماه پیش', [factId(1, 2)]), AF('state', 'الان', 'یک یافته‌ی تازه', [])])] });
    const r = finalizeCouple(raw, digest);
    const a = r.draft.axes.find(x => x.title === 'خواب')!;
    assert.equal(a.items!.length, 1);
    assert.equal(a.refs![0].where, 'قبل/اکنون — خواب');
    assert.equal(a.refs![0].findingId, r.draft.changeRows[0].id);
    assert.equal(r.report.droppedDuplicates, 1);
  });
  await t('P5 فکتِ ارجاع‌شده در ردیف «یتیم» نیست (پوشش)', () => {
    const r = finalizeCouple(emptyRaw({ changes: [CH('خواب', 'بی‌خوابی', 'بهتر', [factId(1, 2)])] }), digest);
    assert.ok(!r.report.orphanFacts.some(o => o.id === factId(1, 2)));
  });
  await t('P6 merge/patch: ردیف‌ها از پیش‌نویس؛ ویرایشِ ردیفِ اصلی ردیف‌ها را حذف؛ approve نه', () => {
    const rows = () => mkRaw(null, { changes: [CH('خواب', 'قبل۱', 'بعد۱'), CH('اضطراب', 'قبل۲', 'بعد۲')] });
    const first = mergeCaseFileDraft(null, finalizeCouple(rows(), null).draft, corpus);
    assert.equal(first.changeRows!.length, 2);
    const appr = applyFieldPatch(first, 'changeOverTime.before', 'approve', undefined);
    assert.equal(appr.changeRows!.length, 2);
    const ed = applyFieldPatch(first, 'changeOverTime.after', 'edit', 'دستی');
    assert.equal(ed.changeRows, undefined);
    assert.equal(ed.changeOverTime.after.value, 'دستی');
    const raw2 = mkRaw(null, { changes: [CH('تازه', 'ق', 'ب')] });
    const again = mergeCaseFileDraft(appr, finalizeCouple(raw2, null).draft, corpus);
    assert.equal(again.changeRows!.length, 2, 'ردیفِ اصلیِ تاییدشده ⇒ ردیف‌هایِ قبلی می‌مانند');
    const fresh = mergeCaseFileDraft(first, finalizeCouple(raw2, null).draft, corpus);
    assert.equal(fresh.changeRows![0].label, 'تازه', 'بدونِ تایید ⇒ ردیف‌هایِ جدیدِ مدل');
  });
  await t('P7 validate/schema: changes الزامی، ساختار چک، changeOverTime از schema رفته', () => {
    validateCaseFileDraft(mkRaw(null));
    const a: any = mkRaw(null); delete a.changes;
    assert.throws(() => validateCaseFileDraft(a), /changes/);
    const b: any = mkRaw(null, { changes: [{ label: 'x', before: 1 }] as any });
    assert.throws(() => validateCaseFileDraft(b), /changes/);
    const props = CASE_FILE_JSON_SCHEMA.schema.properties as any;
    assert.ok(props.changes);
    assert.equal(props.changeOverTime, undefined);
    assert.ok((CASE_FILE_JSON_SCHEMA.schema.required as readonly string[]).includes('changes'));
    assert.ok(SYSTEM_PROMPT.includes('changes'));
  });

  // ================= ارتقای پرونده‌ی قدیمی (بدونِ LLM) =================
  const LF_ = (v: string, o: any = {}) => ({ value: v, source: 'ai', reviewedByTherapist: false, suggestedUpdate: null, pending: !v, ...o });
  const legacy = (): any => ({
    identity: LF_('زن'), mainIssue: LF_('اضطراب'), overallStatus: LF_(''), safetyRisk: LF_(''), sensitiveContext: LF_(''), medication: [],
    axes: [
      { id: 'a1', title: 'اضطراب', statusTone: 'watch', sensitiveDoNotDiscussInFrontOfClient: false,
        ...LF_('خلاصه: علائم بدنی هنگام تنش\nشرح وضعیت: به گفته‌ی مراجع، ضربان قلب بالا می‌رود\nنقل‌ها و شواهد: «مثلِ یه سنگ رو سینه‌مه»\nنکته برای جلسه: پیگیریِ تمرین تنفس\nعوامل تشدید: مشاهده در جلسه، از اتاق بیرون می‌رود') },
      { id: 'a2', title: 'دستی', statusTone: 'good', sensitiveDoNotDiscussInFrontOfClient: false, ...LF_('شرح وضعیت: متنِ دستی', { source: 'therapist', reviewedByTherapist: true }) },
      { id: 'a3', title: 'خالی', statusTone: 'good', sensitiveDoNotDiscussInFrontOfClient: false, ...LF_('') } ],
    familyRelationship: { title: 'ارتباط با خانواده', fields: [{ key: 'mother', label: 'مادر', ...LF_('رابطه‌ی کودکی: به توصیف درمانگر، سرد و انتقادی بود') }] },
    coupleRelationship: { title: 'رابطه‌ی زوجین', fields: [
      { key: 'interaction', label: 'الگوی تعامل', ...LF_('الگوی بحث: به گفته‌ی مراجع، همسر دیر می‌آید') },
      { key: 'quotes', label: 'نقل‌ها', ...LF_('«شوهر سوارت می‌شه»\n«دیگه نمی‌تونم»') } ] },
    changeOverTime: { before: LF_('بی‌خوابیِ شدید'), after: LF_('پنج ساعت می‌خوابد') },
    sessionsSummary: [], roadmap: [], pendingQuestions: [],
  });
  await t('Q1 محور: خلاصه/برچسب/منبع/نقش از برچسب‌هایِ قدیمیِ prompt', () => {
    const { content, upgraded } = upgradeLegacyContent(legacy());
    const a = content.axes.find(x => x.id === 'a1')!;
    assert.ok(upgraded >= 1);
    assert.deepEqual(a.items!.map(i => i.role), ['state', 'evidence', 'session_note', 'maintaining']);
    assert.equal(a.items![0].source, 'client_report');
    assert.equal(a.items![0].text, 'ضربان قلب بالا می‌رود');
    assert.equal(a.items![3].source, 'therapist_observation');
    assert.ok(!a.items!.some(i => i.label === 'خلاصه'), 'سطرِ خلاصه یافته نمی‌شود');
    assert.equal(a.value, legacy().axes[0].value, 'value دست‌نخورده');
  });
  await t('Q2 نقل‌ها (label خالی)، زوجین و خانواده', () => {
    const { content } = upgradeLegacyContent(legacy());
    const q = content.coupleRelationship!.fields.find(f => f.key === 'quotes')!;
    assert.deepEqual(q.items!.map(i => [i.label, i.text]), [['', 'شوهر سوارت می‌شه'], ['', 'دیگه نمی‌تونم']]);
    const m = content.familyRelationship.fields[0];
    assert.equal(m.items![0].source, 'therapist_inference');
    assert.equal(m.items![0].label, 'رابطه‌ی کودکی');
  });
  await t('Q3 کارِ تراپیست و فیلدِ pending/خالی دست‌نخورده', () => {
    const { content } = upgradeLegacyContent(legacy());
    assert.equal(content.axes.find(x => x.id === 'a2')!.items, undefined);
    assert.equal(content.axes.find(x => x.id === 'a3')!.items, undefined);
  });
  await t('Q4 قبل/اکنون ⇒ یک ردیفِ اصلی', () => {
    const { content } = upgradeLegacyContent(legacy());
    assert.equal(content.changeRows!.length, 1);
    assert.deepEqual([content.changeRows![0].label, content.changeRows![0].before, content.changeRows![0].after], ['تغییر اصلی', 'بی‌خوابیِ شدید', 'پنج ساعت می‌خوابد']);
    const ed: any = legacy(); ed.changeOverTime.before = LF_('دستی', { source: 'therapist', reviewedByTherapist: true });
    assert.equal(upgradeLegacyContent(ed).content.changeRows, undefined, 'ویرایشِ تراپیست ⇒ ردیف ساخته نمی‌شود');
  });
  await t('Q5 ایدمپوتنت و immutable و شناسه‌ی پایدار', () => {
    const src = legacy(); const snap = JSON.stringify(src);
    const one = upgradeLegacyContent(src);
    assert.equal(JSON.stringify(src), snap, 'ورودی نباید تغییر کند');
    const two = upgradeLegacyContent(one.content);
    assert.equal(two.upgraded, 0);
    assert.deepEqual(two.content, one.content);
    assert.deepEqual(upgradeLegacyContent(legacy()).content.axes[0].items!.map(i => i.id), one.content.axes[0].items!.map(i => i.id));
  });
  await t('Q6 پرونده‌ی ارتقاءیافته با ستاره/نکته‌ی کلیدی سازگار است', () => {
    const { content } = upgradeLegacyContent(legacy());
    const id = content.axes[0].items![0].id;
    const pinned = applyFieldPatch(content, 'finding.' + id, 'pin', undefined);
    assert.deepEqual(pinned.keyPoints, { ids: [id], edited: true });
  });
  await t('Q7 محتوایِ کاملاً خالی/بدونِ چیزِ قابلِ ارتقا ⇒ upgraded=0', () => {
    const e: any = legacy(); e.axes = []; e.familyRelationship.fields = []; e.coupleRelationship = null; e.changeOverTime = { before: LF_(''), after: LF_('') };
    assert.equal(upgradeLegacyContent(e).upgraded, 0);
  });

  // ================= جابه‌جاییِ یافته توسطِ تراپیست =================
  const mvRaw = () => mkRaw(null, { axes: [
    AX('اضطراب', 'علائم بدنی', [AF('evidence', 'علائم', 'ضربان قلب هنگام بحث بالا می‌رود', []), AF('state', 'الان', 'هنوز فعال است', [])], 'watch'),
    AX('خواب', 'بی‌خوابی', [AF('evidence', 'بی‌خوابی', 'خوابش شبانه مختل است', [])], 'good'),
  ] });
  const mvBase = () => mergeCaseFileDraft(null, finalizeCouple(mvRaw(), null).draft, corpus);
  const axId = (c: any, title: string) => c.axes.find((a: any) => a.title === title).id;
  const itId = (c: any, title: string, label: string) => c.axes.find((a: any) => a.title === title).items.find((i: any) => i.label === label).id;

  await t('R1 rebuildAxisValue سطرِ «خلاصه:» را واقعاً می‌خواند (رگرسیونِ regex)', () => {
    const c = mvBase();
    const before = c.axes.find(a => a.title === 'اضطراب')!.value;
    assert.equal(before.split('\n')[0], 'خلاصه: علائم بدنی');
    const moved = applyFieldPatch(c, 'finding.' + itId(c, 'اضطراب', 'علائم'), 'move', axId(c, 'اضطراب') + ':impact');
    const a = moved.axes.find(x => x.title === 'اضطراب')!;
    assert.equal(a.value.split('\n')[0], 'خلاصه: علائم بدنی', 'summary نباید گم شود');
    assert.equal(a.value.split('\n').length, 3);
  });
  await t('R2 جابه‌جایی در همان محور: نقش عوض و ترتیبِ ثابت می‌شود', () => {
    const c = mvBase();
    const m = applyFieldPatch(c, 'finding.' + itId(c, 'اضطراب', 'علائم'), 'move', axId(c, 'اضطراب') + ':goals');
    const a = m.axes.find(x => x.title === 'اضطراب')!;
    assert.deepEqual(a.items!.map(i => i.role), ['state', 'goals']);
    assert.deepEqual(a.items!.find(i => i.label === 'علائم')!.movedTo, { axisTitle: 'اضطراب', role: 'goals' });
  });
  await t('R3 جابه‌جایی به محورِ دیگر: از مبدأ حذف، به مقصد اضافه؛ هر دو بدنه بازسازی', () => {
    const c = mvBase();
    const m = applyFieldPatch(c, 'finding.' + itId(c, 'اضطراب', 'علائم'), 'move', axId(c, 'خواب') + ':impact');
    assert.equal(m.axes.find(a => a.title === 'اضطراب')!.items!.length, 1);
    const sleep = m.axes.find(a => a.title === 'خواب')!;
    assert.equal(sleep.items!.length, 2);
    assert.deepEqual(sleep.items!.map(i => i.role), ['evidence', 'impact'].sort((x, y) => FINDING_ROLES.indexOf(x as any) - FINDING_ROLES.indexOf(y as any)));
    assert.ok(sleep.value.includes('ضربان قلب هنگام بحث بالا می‌رود'));
    assert.ok(!m.axes.find(a => a.title === 'اضطراب')!.value.includes('ضربان قلب'));
    assert.equal(c.axes.find(a => a.title === 'خواب')!.items!.length, 1, 'ورودی immutable');
  });
  await t('R4 خطاها: نقش/محور نامعتبر، یافته‌ی غیرِمحور، بدونِ value', () => {
    const c = mvBase(); const id = itId(c, 'اضطراب', 'علائم');
    assert.throws(() => applyFieldPatch(c, 'finding.' + id, 'move', axId(c, 'خواب') + ':nope'), /نقشِ نامعتبر/);
    assert.throws(() => applyFieldPatch(c, 'finding.' + id, 'move', 'no-axis:impact'), /محورِ مقصد/);
    assert.throws(() => applyFieldPatch(c, 'finding.f_nope', 'move', axId(c, 'خواب') + ':impact'), /یافت نشد|قابلِ انتقال/);
    assert.throws(() => applyFieldPatch(c, 'finding.' + id, 'move', undefined), /نقشِ نامعتبر/);
  });
  await t('R5 محورِ تاییدشده‌ی تراپیست: یافته جابه‌جا می‌شود ولی متنِ ویرایش‌شده بازنویسی نمی‌شود', () => {
    const c0 = mvBase(); const apr = applyFieldPatch(c0, 'axis.' + axId(c0, 'اضطراب'), 'approve', undefined);
    const m = applyFieldPatch(apr, 'finding.' + itId(c0, 'اضطراب', 'علائم'), 'move', axId(c0, 'خواب') + ':impact');
    const a = m.axes.find(x => x.title === 'اضطراب')!;
    assert.equal(a.value, c0.axes.find(x => x.title === 'اضطراب')!.value, 'متنِ تاییدشده بازنویسی نمی‌شود');
    assert.ok(!a.items!.some(i => i.label === 'علائم'), 'ولی یافته جابه‌جا شده');
  });
  await t('R6 merge: جابه‌جاییِ تراپیست بعد از regenerate دوباره اعمال می‌شود', () => {
    const c = mvBase();
    const moved = applyFieldPatch(c, 'finding.' + itId(c, 'اضطراب', 'علائم'), 'move', axId(c, 'خواب') + ':impact');
    const again = mergeCaseFileDraft(moved, finalizeCouple(mvRaw(), null).draft, corpus);
    const sleep = again.axes.find(a => a.title === 'خواب')!;
    assert.ok(sleep.items!.some(i => i.label === 'علائم' && i.role === 'impact'), 'جابه‌جایی برنگردد');
    assert.ok(!again.axes.find(a => a.title === 'اضطراب')!.items!.some(i => i.label === 'علائم'));
    assert.ok(sleep.value.includes('ضربان قلب'));
    const forced = mergeCaseFileDraft(null, finalizeCouple(mvRaw(), null).draft, corpus);
    assert.ok(forced.axes.find(a => a.title === 'اضطراب')!.items!.some(i => i.label === 'علائم'), 'force ⇒ طبقه‌بندیِ مدل');
  });
  await t('R7 merge: یافته‌ی جابه‌جاشده که در خروجیِ تازه نیست ⇒ بی‌اثر و بدونِ کرش؛ محورِ مقصدِ ناموجود ⇒ در جای خود', () => {
    const c = mvBase();
    const moved = applyFieldPatch(c, 'finding.' + itId(c, 'اضطراب', 'علائم'), 'move', axId(c, 'خواب') + ':impact');
    const changed = mkRaw(null, { axes: [AX('اضطراب', 's', [AF('state', 'الان', 'هنوز فعال است', [])], 'watch'), AX('خواب', 's', [AF('evidence', 'بی‌خوابی', 'خوابش شبانه مختل است', [])], 'good')] });
    const a1 = mergeCaseFileDraft(moved, finalizeCouple(changed, null).draft, corpus);
    assert.equal(a1.axes.find(a => a.title === 'خواب')!.items!.length, 1);
    const noTarget = mkRaw(null, { axes: [AX('اضطراب', 's', [AF('evidence', 'علائم', 'ضربان قلب هنگام بحث بالا می‌رود', [])], 'watch')] });
    const a2 = mergeCaseFileDraft(moved, finalizeCouple(noTarget, null).draft, corpus);
    assert.ok(a2.axes.find(a => a.title === 'اضطراب')!.items!.some(i => i.label === 'علائم'), 'بدونِ محورِ مقصد چیزی گم نشود');
  });
  await t('R8 نکته‌ی کلیدی بعد از جابه‌جایی معتبر می‌ماند (شناسه‌ی یافته عوض نمی‌شود)', () => {
    const c = mvBase(); const id = itId(c, 'اضطراب', 'علائم');
    const p = applyFieldPatch(c, 'finding.' + id, 'pin', undefined);
    const m = applyFieldPatch(p, 'finding.' + id, 'move', axId(c, 'خواب') + ':impact');
    assert.deepEqual(m.keyPoints!.ids, [id]);
    assert.ok(m.axes.some(a => a.items!.some(i => i.id === id)));
  });

  await t('S1 dropGhostMedication: ردیفِ AI بدونِ نام (کهنه، از قبلِ فیکسِ validate.ts) حذف می‌شود؛ دستی و AIِ نام‌دار دست‌نخورده می‌مانند', () => {
    const emptyField = { value: '', source: 'ai' as const, reviewedByTherapist: false, suggestedUpdate: null, pending: true };
    const c = mvBase();
    c.medication = [
      { id: 'ghost', name: '', dose: emptyField, frequency: emptyField, lastChange: emptyField, prescriber: emptyField },
      { id: 'ghost-space', name: '   ', dose: emptyField, frequency: emptyField, lastChange: emptyField, prescriber: emptyField },
      { id: 'ai-named', name: 'سرترالین', dose: emptyField, frequency: emptyField, lastChange: emptyField, prescriber: emptyField },
      { id: 'manual-empty', name: 'میو', addedByTherapist: true, dose: emptyField, frequency: emptyField, lastChange: emptyField, prescriber: emptyField },
    ];
    const out = dropGhostMedication(c);
    assert.deepEqual(out.medication.map(m => m.id), ['ai-named', 'manual-empty'], 'فقط ردیفِ AIِ بدونِ نام حذف می‌شود');
    assert.strictEqual(out, c, 'in-place — همان شیء برمی‌گردد (سازگار با فراخوانی در route)');
  });
  await t('S2 dropGhostMedication: بدونِ ردیفِ کهنه ⇒ بدونِ تغییر (ایدمپوتنت)', () => {
    const c = mvBase();
    c.medication = [{ id: 'm1', name: 'دارو', dose: { value: '', source: 'ai', reviewedByTherapist: false, suggestedUpdate: null, pending: true }, frequency: { value: '', source: 'ai', reviewedByTherapist: false, suggestedUpdate: null, pending: true }, lastChange: { value: '', source: 'ai', reviewedByTherapist: false, suggestedUpdate: null, pending: true }, prescriber: { value: '', source: 'ai', reviewedByTherapist: false, suggestedUpdate: null, pending: true } }];
    const before = c.medication;
    dropGhostMedication(c);
    assert.strictEqual(c.medication, before, 'آرایه بازساخته نمی‌شود اگر چیزی برایِ حذف نبود');
  });

  // ================= پاسخ به سوالاتِ باز — به‌عنوانِ دیتا، نه فقط یادداشت =================
  await t('T1 patch: پاسخ به سوال آن را از pendingQuestions حذف و به answeredQuestions اضافه می‌کند', () => {
    const c = mvBase();
    c.pendingQuestions = [{ id: 'q1', question: 'آیا دارویی مصرف می‌شود؟', relatedAxis: null, answer: null }];
    const out = applyFieldPatch(c, 'question.q1.answer', 'edit', 'بله، سرترالین ۵۰ میلی‌گرم');
    assert.deepEqual(out.pendingQuestions, [], 'دیگر در سوالاتِ باز نمی‌ماند');
    assert.equal(out.answeredQuestions!.length, 1);
    assert.equal(out.answeredQuestions![0].id, 'q1');
    assert.equal(out.answeredQuestions![0].question, 'آیا دارویی مصرف می‌شود؟');
    assert.equal(out.answeredQuestions![0].answer, 'بله، سرترالین ۵۰ میلی‌گرم');
    assert.ok(out.answeredQuestions![0].answeredAt);
  });
  await t('T2 patch: پاسخِ خالی/فقط‌فاصله رد می‌شود؛ سوالِ ناموجود هم', () => {
    const c = mvBase();
    c.pendingQuestions = [{ id: 'q1', question: 'س', relatedAxis: null, answer: null }];
    assert.throws(() => applyFieldPatch(c, 'question.q1.answer', 'edit', '   '), /خالی/);
    assert.throws(() => applyFieldPatch(c, 'question.missing.answer', 'edit', 'x'), /یافت نشد/);
  });
  await t('T3 migrateAnsweredQuestions: pendingQuestionِ پاسخ‌دارِ قدیمی منتقل می‌شود؛ ایدمپوتنت', () => {
    const c = mvBase();
    c.pendingQuestions = [
      { id: 'q1', question: 'آیا دارویی مصرف می‌شود؟', relatedAxis: null, answer: 'خیر' },
      { id: 'q2', question: 'خطرِ جانی مطرح است؟', relatedAxis: null, answer: null },
    ];
    delete (c as any).answeredQuestions;
    const out = migrateAnsweredQuestions(c);
    assert.deepEqual(out.pendingQuestions.map(q => q.id), ['q2'], 'فقط سوالِ پاسخ‌دار منتقل می‌شود');
    assert.equal(out.answeredQuestions!.length, 1);
    assert.equal(out.answeredQuestions![0].answer, 'خیر');
    const again = migrateAnsweredQuestions(out);
    assert.equal(again.answeredQuestions!.length, 1, 'دوباره صدازدن چیزی تکرار نمی‌کند');
  });
  await t('T4 merge: سوالِ پاسخ‌داده‌شده دوباره در pendingQuestions نمی‌آید؛ answeredQuestions دست‌نخورده می‌ماند', () => {
    const answered = mvBase();
    answered.answeredQuestions = [{ id: 'q1', question: 'آیا دارویی مصرف می‌شود؟', relatedAxis: null, answer: 'خیر', answeredAt: '2026-01-01T00:00:00.000Z' }];
    const draft = mkRaw(null, { pendingQuestions: [
      { question: 'آیا دارویی مصرف می‌شود؟', relatedAxis: null },
      { question: 'مدتِ دقیقِ خواب چقدر است؟', relatedAxis: null },
    ] });
    const out = mergeCaseFileDraft(answered, finalizeCouple(draft, null).draft, corpus);
    assert.deepEqual(out.pendingQuestions.map(q => q.question), ['مدتِ دقیقِ خواب چقدر است؟'], 'سوالِ پاسخ‌داده‌شده دوباره باز نمی‌شود');
    assert.deepEqual(out.answeredQuestions, answered.answeredQuestions, 'regenerate پاسخ‌هایِ ثبت‌شده را دست‌نمی‌زند');
  });
  await t('T5 buildAnsweredQuestionsBlock: متنِ بلوک و حالتِ خالی', () => {
    assert.equal(buildAnsweredQuestionsBlock([]), '');
    const block = buildAnsweredQuestionsBlock([{ id: 'q1', question: 'آیا دارویی مصرف می‌شود؟', relatedAxis: null, answer: 'خیر', answeredAt: '2026-01-01T00:00:00.000Z' }]);
    assert.ok(block.includes('پاسخ‌هایِ تراپیست به سوالاتِ پروندهٔ پیشین'));
    assert.ok(block.includes('سوال: آیا دارویی مصرف می‌شود؟'));
    assert.ok(block.includes('پاسخ: خیر'));
  });
  await t('T6 composeWithRepair: پاسخ‌هایِ ثبت‌شده به corpusTextِ مرحله‌ی ۲ می‌رسد (نه مرحله‌ی ۱)', async () => {
    let seenDigestText = '', seenComposeText = '';
    const m: any = {
      model: 'mock',
      digestCorpus: async (i: any) => { seenDigestText = i.corpusText; return digest; },
      generateCaseFile: async (i: any) => { seenComposeText = i.corpusText; return mkRaw(fullCouple()); },
    };
    const qa = buildAnsweredQuestionsBlock([{ id: 'q1', question: 'آیا دارویی مصرف می‌شود؟', relatedAxis: null, answer: 'خیر', answeredAt: '2026-01-01T00:00:00.000Z' }]);
    await digestWithRepair(m, input, corpus as any, { startedAt: Date.now() });
    await composeWithRepair(m, input, digest, { startedAt: Date.now() }, qa);
    assert.ok(!seenDigestText.includes('پاسخ‌هایِ تراپیست'), 'مرحله‌ی ۱ نباید بلوکِ پاسخ را ببیند (digest بر اساسِ جلسه است)');
    assert.ok(seenComposeText.includes('سوال: آیا دارویی مصرف می‌شود؟'), 'مرحله‌ی ۲ باید پاسخ را ببیند');
  });

  console.log(`\n${pass} PASS / ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();
