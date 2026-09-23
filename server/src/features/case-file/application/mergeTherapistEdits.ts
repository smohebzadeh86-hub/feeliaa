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
  CaseFilePendingQuestion, DraftPendingQuestion, CaseFileAnsweredQuestion,
  CaseFileSessionSummaryEntry, DraftSessionSummaryEntry,
} from '../domain/types.js';
import type { ClientCorpus } from './aggregateClientCorpus.js';
import { rebuildAxisValue } from '../domain/findings.js';

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
    // محورِ تاییدشده‌ی تراپیست یخ می‌زند (مثلِ mergeField)؛ یافته‌هایش با متنش می‌مانند
    const frozen = !!prev && prev.reviewedByTherapist && !prev.pending;
    const items = frozen ? prev!.items : d.items;
    const refs = frozen ? prev!.refs : d.refs;
    return {
      id: prev?.id || randomUUID(),
      title: d.title,
      statusTone: d.statusTone,
      sensitiveDoNotDiscussInFrontOfClient: d.sensitiveDoNotDiscussInFrontOfClient,
      ...(prev?.addedByTherapist ? { addedByTherapist: true } : {}),
      ...field,
      ...(items ? { items } : {}),
      ...(refs ? { refs } : {}),
    };
  }), a => normKey(a.title));
}

function mergeRelationshipGroup(
  existing: CaseFileRelationshipGroup | null | undefined,
  draft: DraftRelationshipGroup | null
): CaseFileRelationshipGroup | null {
  // فیلدی که تراپیست ویرایش/تأیید کرده و مدل (با کلیدِ دیگر یا null‌بودنِ کلِ گروه) نیاورده، نباید
  // بی‌صدا گم شود — مثلاً پرونده‌هایِ قدیمی با کلیدِ آزاد وقتی به کلیدهایِ نقشِ ثابت مهاجرت می‌کنند.
  const isTherapistWork = (f: { source: string; reviewedByTherapist: boolean; value: string }) =>
    (f.source === 'therapist' || f.reviewedByTherapist) && f.value.trim() !== '';
  if (!draft) {
    const kept = (existing?.fields || []).filter(isTherapistWork);
    return existing && kept.length ? { title: existing.title, fields: kept } : null;
  }
  const byKey = new Map((existing?.fields || []).map(f => [f.key, f]));
  const merged = draft.fields.map(d => {
    const prev = byKey.get(d.key);
    // فیلدِ تاییدشده‌ی تراپیست یخ می‌زند (مثلِ mergeField)؛ یافته‌هایش هم با متنش می‌مانند و
    // تازه‌ی مدل فقط در suggestedUpdate می‌نشیند. در غیر این صورت یافته‌هایِ تازه جایگزین می‌شوند.
    const frozen = !!prev && prev.reviewedByTherapist && !prev.pending;
    const items = frozen ? prev!.items : d.items;
    const refs = frozen ? prev!.refs : d.refs;
    return {
      key: d.key,
      label: d.label,
      ...mergeField(prev, { value: d.value, pending: d.pending }),
      ...(items ? { items } : {}),
      ...(refs ? { refs } : {}),
    };
  });
  const have = new Set(merged.map(f => f.key));
  const orphans = (existing?.fields || []).filter(f => !have.has(f.key) && isTherapistWork(f));
  return { title: draft.title, fields: [...merged, ...orphans] };
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

function mergePendingQuestions(answeredExisting: CaseFileAnsweredQuestion[] | undefined, draft: DraftPendingQuestion[]): CaseFilePendingQuestion[] {
  // سوالی که تراپیست قبلاً پاسخ داده (در answeredQuestions) دیگر به‌عنوانِ «باز» دوباره
  // اضافه نمی‌شود — چون پاسخش هم‌اکنون به‌عنوانِ دیتا به همین regenerate رسیده (buildCaseFilePrompt)
  // و مدل باید آن اطلاعات را در بخش‌هایِ مربوط (axes/medication/...) جا داده باشد.
  const answeredKeys = new Set((answeredExisting || []).map(q => normKey(q.question)));
  return draft
    .filter(d => !answeredKeys.has(normKey(d.question)))
    .map(d => ({ id: randomUUID(), question: d.question, relatedAxis: d.relatedAxis ?? null, answer: null }));
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

// جابه‌جاییِ دستیِ تراپیست (movedTo) بعد از regenerate دوباره اعمال می‌شود (شناسه‌ی یافته پایدار است: hash). اگر یافته در
// خروجیِ تازه نیست (متنش عوض شده/حذف شده)، جابه‌جایی بی‌اثر می‌ماند و چیزی گم نمی‌شود.
function reapplyMoves(existing: CaseFileAxis[] | undefined, merged: CaseFileAxis[]): CaseFileAxis[] {
  const moves = new Map<string, NonNullable<CaseFileAxis['items']>[number]['movedTo']>();
  for (const a of existing ?? []) for (const i of a.items ?? []) if (i.movedTo) moves.set(i.id, i.movedTo);
  if (!moves.size) return merged;
  const touched = new Set<CaseFileAxis>();
  for (const [id, mv] of moves) {
    if (!mv) continue;
    const src = merged.find(a => (a.items ?? []).some(i => i.id === id));
    const target = merged.find(a => normKey(a.title) === normKey(mv.axisTitle));
    if (!src || !target) continue;
    const item = src.items!.find(i => i.id === id)!;
    if (src === target && item.role === mv.role) { item.movedTo = mv; continue; }
    src.items = src.items!.filter(i => i.id !== id);
    item.role = mv.role; item.movedTo = mv;
    target.items = [...(target.items ?? []), item];
    touched.add(src); touched.add(target);
  }
  for (const a of touched) rebuildAxisValue(a);
  return merged;
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
    axes: reapplyMoves(existing?.axes, mergeAxes(existing?.axes, draft.axes)),
    familyRelationship: mergeRelationshipGroup(existing?.familyRelationship, draft.familyRelationship) as CaseFileRelationshipGroup,
    coupleRelationship: mergeRelationshipGroup(existing?.coupleRelationship, draft.coupleRelationship),
    changeOverTime: {
      before: mergeField(existing?.changeOverTime?.before, draft.changeOverTime.before),
      after: mergeField(existing?.changeOverTime?.after, draft.changeOverTime.after),
    },
    sessionsSummary: mergeSessionsSummary(existing?.sessionsSummary, draft.sessionsSummary, corpus),
    roadmap: mergeRoadmap(existing?.roadmap, draft.roadmap),
    pendingQuestions: mergePendingQuestions(existing?.answeredQuestions, draft.pendingQuestions),
    // پاسخ‌هایِ ثبت‌شده دستیِ تراپیست‌اند؛ regenerate آن‌ها را دست نمی‌زند (فقط applyFieldPatch اضافه می‌کند)
    answeredQuestions: existing?.answeredQuestions ?? [],
    // نکاتِ کلیدیِ دستیِ تراپیست (ستاره‌گذاری) با regenerate عوض نمی‌شود؛ وگرنه پیشنهادِ تازه‌ی مدل
    keyPoints: existing?.keyPoints?.edited ? existing.keyPoints : { ids: draft.keyPointIds ?? [], edited: false },
    // ردیف‌هایِ قبل/اکنون: اگر تراپیست ردیفِ اصلی (changeOverTime) را تایید/ویرایش کرده، ردیف‌هایِ قبلی با آن هم‌گام می‌مانند
    changeRows: (['before', 'after'] as const).some(k => existing?.changeOverTime?.[k]?.reviewedByTherapist && !existing.changeOverTime[k].pending)
      ? existing?.changeRows : draft.changeRows,
  };
}
