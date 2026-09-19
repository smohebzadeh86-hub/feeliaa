// منطقِ merge: فیلدهایی که تراپیست تاییدشان کرده (reviewedByTherapist=true) هرگز با
// regeneration جایگزین نمی‌شوند — تازه‌ی مدل به‌جایِ overwrite در suggestedUpdate
// می‌نشیند (اگر واقعاً فرق کرده باشد). این دقیقاً «یخ‌زدگیِ ابدی» را حل می‌کند بدونِ
// از دست دادنِ کارِ دستیِ تراپیست (اصلِ ۲/۴/۶ سندِ بازبینیِ نقادانه‌ی مالک).
import { randomUUID } from 'node:crypto';
import type {
  CaseFileContent, CaseFileDraft, CaseFileField, DraftField,
  CaseFileAxis, DraftAxis,
  CaseFileMedicationEntry, DraftMedicationEntry,
  CaseFileRelationshipGroup, DraftRelationshipGroup,
  CaseFileRoadmapStep, DraftRoadmapStep,
  CaseFilePendingQuestion, DraftPendingQuestion,
  CaseFileSessionSummaryEntry, DraftSessionSummaryEntry,
} from '../domain/types.js';
import type { ClientCorpus } from './aggregateClientCorpus.js';

function normKey(s: string): string {
  return s.trim().toLowerCase();
}

function mergeField(existing: CaseFileField | undefined, draft: DraftField): CaseFileField {
  // ⭐ دفاعی: در تستِ واقعی دیده شد مدل گاهی value خالی می‌دهد ولی pending=false می‌گذارد
  // (خلافِ system prompt) — این‌جا صرف‌نظر از ادعایِ مدل، مقدارِ خالی همیشه pending است؛
  // یعنی هیچ‌وقت یک فیلدِ خالی بدونِ نشانه‌ی «در انتظار ثبت» به تراپیست نشان داده نمی‌شود.
  const pending = draft.pending || draft.value.trim() === '';
  // فیلدِ خالی/pending هرگز «یخ‌زده» حساب نمی‌شود، حتی اگر قبلاً (approveِ بی‌مقدار) reviewed شده باشد.
  if (!existing || !existing.reviewedByTherapist || existing.pending) {
    return { value: draft.value, source: 'ai', reviewedByTherapist: false, suggestedUpdate: null, pending };
  }
  const changed = !pending && draft.value.trim() !== existing.value.trim();
  return { ...existing, suggestedUpdate: changed ? draft.value : null };
}

// ردیف‌هایِ دستیِ تراپیست که مدل نیاورده در regenerate حفظ می‌شوند (وگرنه کارِ دستی گم می‌شد).
function keepManual<T extends { addedByTherapist?: boolean }>(existing: T[] | undefined, merged: T[], key: (x: T) => string): T[] {
  const have = new Set(merged.map(key));
  const extra = (existing || []).filter(x => x.addedByTherapist && !have.has(key(x)));
  return [...merged, ...extra];
}

function mergeAxes(existing: CaseFileAxis[] | undefined, draft: DraftAxis[]): CaseFileAxis[] {
  const byTitle = new Map((existing || []).map(a => [normKey(a.title), a]));
  return keepManual(existing, draft.map(d => {
    const prev = byTitle.get(normKey(d.title));
    const field = mergeField(prev, { value: d.body, pending: d.pending });
    return {
      id: prev?.id || randomUUID(),
      title: d.title,
      statusTone: d.statusTone,
      sensitiveDoNotDiscussInFrontOfClient: d.sensitiveDoNotDiscussInFrontOfClient,
      ...(prev?.addedByTherapist ? { addedByTherapist: true } : {}),
      ...field,
    };
  }), a => normKey(a.title));
}

function mergeRelationshipGroup(
  existing: CaseFileRelationshipGroup | null | undefined,
  draft: DraftRelationshipGroup | null
): CaseFileRelationshipGroup | null {
  if (!draft) return null;
  const byKey = new Map((existing?.fields || []).map(f => [f.key, f]));
  return {
    title: draft.title,
    fields: draft.fields.map(d => ({
      key: d.key,
      label: d.label,
      ...mergeField(byKey.get(d.key), { value: d.value, pending: d.pending }),
    })),
  };
}

function mergeMedication(existing: CaseFileMedicationEntry[] | undefined, draft: DraftMedicationEntry[]): CaseFileMedicationEntry[] {
  const byName = new Map((existing || []).map(m => [normKey(m.name), m]));
  return keepManual(existing, draft.map(d => {
    const prev = byName.get(normKey(d.name));
    return {
      id: prev?.id || randomUUID(),
      name: d.name,
      dose: mergeField(prev?.dose, { value: d.dose, pending: d.pending }),
      frequency: mergeField(prev?.frequency, { value: d.frequency, pending: d.pending }),
      lastChange: mergeField(prev?.lastChange, { value: d.lastChange, pending: d.pending }),
      prescriber: mergeField(prev?.prescriber, { value: d.prescriber, pending: d.pending }),
      ...(prev?.addedByTherapist ? { addedByTherapist: true } : {}),
    };
  }), m => normKey(m.name));
}

function mergeRoadmap(existing: CaseFileRoadmapStep[] | undefined, draft: DraftRoadmapStep[]): CaseFileRoadmapStep[] {
  const byQuestion = new Map((existing || []).map(r => [normKey(r.question), r]));
  return keepManual(existing, draft.map(d => {
    const prev = byQuestion.get(normKey(d.question));
    return {
      id: prev?.id || randomUUID(),
      priority: d.priority,
      question: d.question,
      why: d.why,
      detail: mergeField(prev?.detail, { value: d.detail, pending: false }),
      ...(prev?.addedByTherapist ? { addedByTherapist: true } : {}),
    };
  }), r => normKey(r.question));
}

function mergePendingQuestions(existing: CaseFilePendingQuestion[] | undefined, draft: DraftPendingQuestion[]): CaseFilePendingQuestion[] {
  // سوال‌هایی که تراپیست جواب داده حفظ می‌شوند (پاک نمی‌شوند)؛ سوال‌هایِ تازه‌ای که
  // متنِ یکسان دارند دوباره اضافه نمی‌شوند.
  const answered = (existing || []).filter(q => q.answer && q.answer.trim());
  const answeredKeys = new Set(answered.map(q => normKey(q.question)));
  const fresh = draft
    .filter(d => !answeredKeys.has(normKey(d.question)))
    .map(d => ({ id: randomUUID(), question: d.question, relatedAxis: d.relatedAxis ?? null, answer: null }));
  return [...answered, ...fresh];
}

function mergeSessionsSummary(
  existing: CaseFileSessionSummaryEntry[] | undefined,
  draft: DraftSessionSummaryEntry[],
  corpus: ClientCorpus
): CaseFileSessionSummaryEntry[] {
  const byNum = new Map((existing || []).map(s => [s.sessionNum, s]));
  // sessionId واقعی از corpus resolve می‌شود، نه از خروجیِ مدل (مدل فقط sessionNum
  // می‌بیند، هرگز UUIDِ واقعی را نمی‌داند تا حدس‌زدنِ شناسه ممکن نباشد).
  const sessionIdByNum = new Map(corpus.sessions.map(s => [s.sessionNum, s.id]));
  return draft.map(d => {
    const prev = byNum.get(d.sessionNum);
    return {
      sessionId: sessionIdByNum.get(d.sessionNum) || prev?.sessionId || '',
      sessionNum: d.sessionNum,
      title: mergeField(prev?.title, { value: d.title, pending: false }),
      body: mergeField(prev?.body, { value: d.body, pending: false }),
      durationIndicator: d.durationIndicator ?? prev?.durationIndicator ?? null,
    };
  });
}

// existing=null یعنی merge کامل بدونِ حفظِ هیچ‌چیزی — دقیقاً همان چیزی که «بازتولیدِ
// کامل» (force=true) می‌خواهد.
export function mergeCaseFileDraft(
  existing: CaseFileContent | null,
  draft: CaseFileDraft,
  corpus: ClientCorpus
): CaseFileContent {
  return {
    identity: mergeField(existing?.identity, draft.identity),
    mainIssue: mergeField(existing?.mainIssue, draft.mainIssue),
    overallStatus: mergeField(existing?.overallStatus, draft.overallStatus),
    safetyRisk: mergeField(existing?.safetyRisk, draft.safetyRisk),
    sensitiveContext: mergeField(existing?.sensitiveContext, draft.sensitiveContext),
    medication: mergeMedication(existing?.medication, draft.medication),
    axes: mergeAxes(existing?.axes, draft.axes),
    familyRelationship: mergeRelationshipGroup(existing?.familyRelationship, draft.familyRelationship) as CaseFileRelationshipGroup,
    coupleRelationship: mergeRelationshipGroup(existing?.coupleRelationship, draft.coupleRelationship),
    changeOverTime: {
      before: mergeField(existing?.changeOverTime?.before, draft.changeOverTime.before),
      after: mergeField(existing?.changeOverTime?.after, draft.changeOverTime.after),
    },
    sessionsSummary: mergeSessionsSummary(existing?.sessionsSummary, draft.sessionsSummary, corpus),
    roadmap: mergeRoadmap(existing?.roadmap, draft.roadmap),
    pendingQuestions: mergePendingQuestions(existing?.pendingQuestions, draft.pendingQuestions),
  };
}
