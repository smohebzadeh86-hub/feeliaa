// اعتبارسنجیِ ساختاریِ خروجیِ LLM قبل از ورود به merge — حتی با json_schema:strict
// باز هم مرزِ domain باید خودش را از دیتایِ خارجی محافظت کند (Anti-Corruption Layer).
import type { CaseFileDraft, RawCaseFileDraft } from './types.js';
import { CaseFileValidationError } from './errors.js';
import { stems } from './findings.js';

function assertField(obj: any, name: string): void {
  if (!obj || typeof obj.value !== 'string' || typeof obj.pending !== 'boolean') {
    throw new CaseFileValidationError(`ساختارِ نامعتبر در ${name}`);
  }
}

const SOURCES = ['client_report', 'therapist_observation', 'therapist_inference', 'unspecified'];

// رابطه‌ی زوجین شکلِ «یافته» دارد (items) نه رشته‌ی چندخطی؛ ساختار با schema و این چک تضمین می‌شود.
function assertCoupleGroup(obj: any, name: string): void {
  if (!obj || typeof obj.title !== 'string' || !Array.isArray(obj.fields)) {
    throw new CaseFileValidationError(`ساختارِ نامعتبر در ${name}`);
  }
  for (const f of obj.fields) {
    if (typeof f.key !== 'string' || typeof f.label !== 'string' || typeof f.pending !== 'boolean' || !Array.isArray(f.items)) {
      throw new CaseFileValidationError(`فیلدِ نامعتبر در ${name}`);
    }
    for (const it of f.items) {
      if (typeof it.label !== 'string' || typeof it.text !== 'string' || typeof it.about !== 'string' ||
          !SOURCES.includes(it.source) || !Array.isArray(it.factIds) || it.factIds.some((x: unknown) => typeof x !== 'string')) {
        throw new CaseFileValidationError(`یافته‌ی نامعتبر در ${name}`);
      }
    }
  }
}

export function validateCaseFileDraft(draft: unknown): asserts draft is RawCaseFileDraft {
  if (!draft || typeof draft !== 'object') {
    throw new CaseFileValidationError('خروجیِ مدل یک object نیست');
  }
  const d = draft as any;
  assertField(d.identity, 'identity');
  assertField(d.mainIssue, 'mainIssue');
  assertField(d.overallStatus, 'overallStatus');
  assertField(d.safetyRisk, 'safetyRisk');
  assertField(d.sensitiveContext, 'sensitiveContext');

  if (!Array.isArray(d.medication)) throw new CaseFileValidationError('medication باید آرایه باشد');
  for (const m of d.medication) {
    if (typeof m.name !== 'string' || typeof m.dose !== 'string' || typeof m.frequency !== 'string' ||
        typeof m.lastChange !== 'string' || typeof m.prescriber !== 'string' || typeof m.pending !== 'boolean') {
      throw new CaseFileValidationError('ساختارِ نامعتبر در medication');
    }
  }

  if (!Array.isArray(d.axes)) throw new CaseFileValidationError('axes باید آرایه باشد');
  for (const a of d.axes) {
    if (typeof a.title !== 'string' || typeof a.summary !== 'string' || typeof a.pending !== 'boolean' ||
        !['good', 'watch', 'sensitive'].includes(a.statusTone) || !Array.isArray(a.items)) {
      throw new CaseFileValidationError('ساختارِ نامعتبر در axes');
    }
    for (const it of a.items) {
      if (typeof it.label !== 'string' || typeof it.text !== 'string' || typeof it.about !== 'string' || typeof it.role !== 'string' ||
          !SOURCES.includes(it.source) || !Array.isArray(it.factIds) || it.factIds.some((x: unknown) => typeof x !== 'string')) {
        throw new CaseFileValidationError('یافته‌ی نامعتبر در axes');
      }
    }
  }

  assertCoupleGroup(d.familyRelationship, 'familyRelationship');
  if (d.coupleRelationship !== null) assertCoupleGroup(d.coupleRelationship, 'coupleRelationship');

  if (!Array.isArray(d.changes)) throw new CaseFileValidationError('changes باید آرایه باشد');
  for (const c of d.changes) {
    if (!c || typeof c.label !== 'string' || typeof c.before !== 'string' || typeof c.after !== 'string' || !Array.isArray(c.factIds) || c.factIds.some((x: unknown) => typeof x !== 'string')) {
      throw new CaseFileValidationError('ساختارِ نامعتبر در changes');
    }
  }

  if (!Array.isArray(d.sessionsSummary)) throw new CaseFileValidationError('sessionsSummary باید آرایه باشد');
  for (const s of d.sessionsSummary) {
    if (typeof s.sessionNum !== 'number' || typeof s.title !== 'string' || typeof s.body !== 'string') {
      throw new CaseFileValidationError('ساختارِ نامعتبر در sessionsSummary');
    }
    // ⭐ باگِ واقعیِ کشف‌شده (2026-09-18): json_schema:strict فقط type را enforce می‌کند،
    // نه طول رشته — مدل یک‌بار durationIndicator را با کلِ متنِ خامِ جلسه پر کرد و در
    // تیترِ کارتِ UI رندر شد. این فیلد فقط باید یک برچسبِ خیلی کوتاه باشد.
    if (s.durationIndicator !== null && (typeof s.durationIndicator !== 'string' || s.durationIndicator.length > 60)) {
      throw new CaseFileValidationError('durationIndicator باید یک برچسبِ کوتاه یا null باشد');
    }
  }

  if (!Array.isArray(d.roadmap)) throw new CaseFileValidationError('roadmap باید آرایه باشد');
  for (const r of d.roadmap) {
    if (typeof r.question !== 'string' || typeof r.why !== 'string' || typeof r.detail !== 'string' ||
        !['p1', 'p2', 'p3', 'p4'].includes(r.priority)) {
      throw new CaseFileValidationError('ساختارِ نامعتبر در roadmap');
    }
  }

  if (!Array.isArray(d.keyPoints)) throw new CaseFileValidationError('keyPoints باید آرایه باشد');
  for (const k of d.keyPoints) {
    if (!k || !Array.isArray(k.factIds) || k.factIds.some((x: unknown) => typeof x !== 'string')) throw new CaseFileValidationError('ساختارِ نامعتبر در keyPoints');
  }

  if (!Array.isArray(d.pendingQuestions)) throw new CaseFileValidationError('pendingQuestions باید آرایه باشد');
  for (const q of d.pendingQuestions) {
    if (typeof q.question !== 'string') throw new CaseFileValidationError('ساختارِ نامعتبر در pendingQuestions');
  }
}

// ===== رابطه‌ی زوجین: نقش‌هایِ بالینیِ ثابت (کلیدِ پایدار برایِ merge و جایگاهِ ثابت در UI) =====
// ساختارِ «یافته» با schema تضمین می‌شود؛ حفظِ اطلاعات و عینیِ نقل‌ها در domain/findings.ts (کد، نه قولِ مدل).
export const COUPLE_ROLE_ORDER = ['background', 'interaction', 'stressors', 'protective', 'key_people', 'quotes', 'other'];

// مرحله‌ی ۱ هم می‌تواند فکت بیندازد (مشاهده‌ی واقعی: استنباطِ درمانگر دربارهِ مادرِ مراجع در digest
// نیامد و compose هرگز آن را ندید). یادداشت‌هایِ تراپیست متنِ کوتاهِ منسجمِ بالینی‌اند و تصحیحِ ASR
// لازم ندارند، پس «هر جمله‌ی یادداشت باید در digest ردی داشته باشد» چکِ کم‌نویزی است. (رونویسیِ خام
// عمداً چک نمی‌شود: پر از پرکننده/تکرارِ گفتاری است و هشدارِ کاذب زیاد می‌دهد.)
export interface CorpusLike {
  sessions: { sessionNum: number; transcript?: string | null; notes: { text: string | null }[] }[];
}

export function checkDigestCoverage(corpus: CorpusLike, digest: unknown): string[] {
  const hay = new Set(stems(JSON.stringify(digest ?? {})));
  const problems: string[] = [];
  // شکستِ خاموش: جلسه‌ای که ورودی دارد ولی digest برایش هیچ فکتی نداده ⇒ کلِ ضمانتِ مکانیکی (شناسه/یتیم/dedupe/نکاتِ
  // کلیدی) چیزی برایِ ردیابی ندارد. (دیده‌شده در آزمونِ واقعی: digestFacts=0 با correctedText سالم.)
  const dSessions: any[] = (digest as any)?.sessions ?? [];
  for (const s of corpus.sessions) {
    const hasInput = (s.transcript || '').trim().length >= 40 || s.notes.some(n => (n.text || '').trim().length >= 15);
    if (!hasInput) continue;
    const ds = dSessions.find(x => x.sessionNum === s.sessionNum);
    if (!ds) problems.push(`جلسه‌ی ${s.sessionNum} در digest نیست؛ برایِ هر جلسه‌یِ ورودی دقیقاً یک ورودی بده`);
    else if (!Array.isArray(ds.facts) || ds.facts.length === 0) problems.push(`جلسه‌ی ${s.sessionNum} هیچ فکتی در facts ندارد؛ فکت‌هایِ بالینیِ همان جلسه را جدا و با category/source/about بیاور`);
  }
  for (const s of corpus.sessions) {
    for (const n of s.notes) {
      for (const sentence of (n.text || '').split(/[.؟!\n]+/).map(x => x.trim()).filter(x => x.length >= 15)) {
        const st = [...new Set(stems(sentence))];
        if (st.length < 3) continue;
        if (st.filter(x => hay.has(x)).length / st.length < 0.5) {
          problems.push(`جمله‌ی یادداشتِ جلسه‌ی ${s.sessionNum} در digest نیامده و باید بیاید (حذف ممنوع): «${sentence.slice(0, 120)}»`);
        }
      }
    }
  }
  return problems.slice(0, 8);
}

function stableKey(label: string): string {
  let h = 5381;
  for (let i = 0; i < label.length; i++) h = ((h << 5) + h + label.charCodeAt(i)) >>> 0;
  return 'x_' + h.toString(36);
}

// کلیدِ نقش را پایدار می‌کند (مدل گاهی کلیدِ آزاد می‌دهد) و ترتیبِ ثابت می‌دهد؛ محتوا را عوض نمی‌کند.
function normalizeCoupleKeys(draft: CaseFileDraft): void {
  const group = draft.coupleRelationship;
  if (!group) return;
  const seen = new Set<string>();
  for (const f of group.fields) {
    f.key = f.key.trim();
    let key = COUPLE_ROLE_ORDER.includes(f.key) ? f.key : (/^x_[a-z0-9_]{1,30}$/.test(f.key) ? f.key : stableKey(f.label));
    while (seen.has(key)) key += '_2';
    seen.add(key);
    f.key = key;
  }
  const rank = (k: string) => { const i = COUPLE_ROLE_ORDER.indexOf(k); return i < 0 ? COUPLE_ROLE_ORDER.length : i; };
  group.fields.sort((a, b) => rank(a.key) - rank(b.key));
}

// قواعدی که فقط در prompt بودند ولی مدل گاهی نقضشان می‌کند — سمتِ کد اصلاح می‌شوند (بدونِ حذفِ محتوا).
const PRIORITY_RANK: Record<string, number> = { p1: 1, p2: 2, p3: 3, p4: 4 };
const ROADMAP_DETAIL_PREFIX = 'نقش در مسیر درمان:';

export function enforceCaseFileRules(draft: CaseFileDraft): void {
  normalizeCoupleKeys(draft);
  // مدل گاهی یک آیتمِ medication با name خالی برمی‌گرداند (مثلاً وقتی دارویی مطرح نشده)؛
  // validateCaseFileDraft فقط نوعِ string بودنِ name را چک می‌کند نه خالی‌نبودنش، پس این ردیفِ
  // بی‌نام تا mergeMedication می‌رسید و به‌صورتِ یک ردیفِ خالی با همه‌یِ زیرفیلدهایِ «در انتظار ثبت»
  // در جدولِ دارو ظاهر می‌شد.
  draft.medication = draft.medication.filter(m => m.name.trim() !== '');
  // p1 فقط وقتی بنرِ ایمنی مستند است (safetyRisk پر)
  const hasSafety = !draft.safetyRisk.pending && draft.safetyRisk.value.trim() !== '';
  for (const r of draft.roadmap) {
    if (r.priority === 'p1' && !hasSafety) r.priority = 'p2';
    // برچسبِ دلیل: ۲ تا ۴ کلمه
    const words = r.why.trim().split(/\s+/).filter(Boolean);
    if (words.length > 4) r.why = words.slice(0, 4).join(' ');
    const d = r.detail.trim();
    if (d && !d.startsWith(ROADMAP_DETAIL_PREFIX)) r.detail = `${ROADMAP_DETAIL_PREFIX} ${d}`;
  }
  // ترتیبِ شدت (sort در JS پایدار است)
  draft.roadmap.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9));
}
