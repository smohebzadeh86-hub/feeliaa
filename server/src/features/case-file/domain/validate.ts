// اعتبارسنجیِ ساختاریِ خروجیِ LLM قبل از ورود به merge — حتی با json_schema:strict
// باز هم مرزِ domain باید خودش را از دیتایِ خارجی محافظت کند (Anti-Corruption Layer).
import type { CaseFileDraft } from './types.js';
import { CaseFileValidationError } from './errors.js';

function assertField(obj: any, name: string): void {
  if (!obj || typeof obj.value !== 'string' || typeof obj.pending !== 'boolean') {
    throw new CaseFileValidationError(`ساختارِ نامعتبر در ${name}`);
  }
}

function assertRelationshipGroup(obj: any, name: string): void {
  if (!obj || typeof obj.title !== 'string' || !Array.isArray(obj.fields)) {
    throw new CaseFileValidationError(`ساختارِ نامعتبر در ${name}`);
  }
  for (const f of obj.fields) {
    if (typeof f.key !== 'string' || typeof f.label !== 'string' || typeof f.value !== 'string' || typeof f.pending !== 'boolean') {
      throw new CaseFileValidationError(`فیلدِ نامعتبر در ${name}`);
    }
  }
}

export function validateCaseFileDraft(draft: unknown): asserts draft is CaseFileDraft {
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
    if (typeof a.title !== 'string' || typeof a.body !== 'string' || typeof a.pending !== 'boolean' ||
        !['good', 'watch', 'sensitive'].includes(a.statusTone)) {
      throw new CaseFileValidationError('ساختارِ نامعتبر در axes');
    }
  }

  assertRelationshipGroup(d.familyRelationship, 'familyRelationship');
  if (d.coupleRelationship !== null) assertRelationshipGroup(d.coupleRelationship, 'coupleRelationship');

  if (!d.changeOverTime) throw new CaseFileValidationError('changeOverTime نامعتبر');
  assertField(d.changeOverTime.before, 'changeOverTime.before');
  assertField(d.changeOverTime.after, 'changeOverTime.after');

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

  if (!Array.isArray(d.pendingQuestions)) throw new CaseFileValidationError('pendingQuestions باید آرایه باشد');
  for (const q of d.pendingQuestions) {
    if (typeof q.question !== 'string') throw new CaseFileValidationError('ساختارِ نامعتبر در pendingQuestions');
  }
}

// قواعدی که فقط در prompt بودند ولی مدل گاهی نقضشان می‌کند — سمتِ کد اصلاح می‌شوند (بدونِ حذفِ محتوا).
const PRIORITY_RANK: Record<string, number> = { p1: 1, p2: 2, p3: 3, p4: 4 };
const ROADMAP_DETAIL_PREFIX = 'نقش در مسیر درمان:';

export function enforceCaseFileRules(draft: CaseFileDraft): void {
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
