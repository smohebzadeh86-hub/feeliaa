// اعمالِ ویرایش/تاییدِ یک فیلد — تنها مسیرِ نوشتنِ دستیِ تراپیست روی پرونده.
// fieldId schema (رشته‌ی نقطه‌جدا):
//   identity | mainIssue | overallStatus | safetyRisk | sensitiveContext |
//   changeOverTime.before | changeOverTime.after
//   axis.<axisId> | medication.<medId>.<dose|frequency|lastChange|prescriber>
//   family.<key> | couple.<key> | roadmap.<stepId>.detail
//   session.<sessionId>.<title|body> | question.<questionId>.answer
//   finding.<findingId> (pin|unpin — نکته‌ی کلیدی، حداکثر MAX_KEY_POINTS؛ یا move با value="<axisId>:<role>" — فقط یافته‌ی محور)
import { randomUUID } from 'node:crypto';
import type { CaseFileContent, CaseFileField, AxisTone, RoadmapPriority, FindingRole } from '../domain/types.js';
import { FINDING_ROLES } from '../domain/types.js';
import { rebuildAxisValue } from '../domain/findings.js';
import { CaseFileValidationError } from '../domain/errors.js';

export type FieldPatchAction = 'edit' | 'approve' | 'accept-suggestion' | 'dismiss-suggestion' | 'pin' | 'unpin' | 'move';

export const MAX_KEY_POINTS = 3;

// جابه‌جاییِ یافته‌یِ محور به نقش/محورِ دیگر. value = «<axisId>:<role>». فقط یافته‌یِ محور (در رابطه‌ها نقش همان field است).
function moveFinding(next: CaseFileContent, id: string, value: string | undefined): CaseFileContent {
  const [axisId, role] = String(value ?? '').split(':');
  if (!(FINDING_ROLES as readonly string[]).includes(role)) throw new CaseFileValidationError('نقشِ نامعتبر');
  const target = next.axes.find(a => a.id === axisId);
  if (!target) throw new CaseFileValidationError('محورِ مقصد یافت نشد');
  const src = next.axes.find(a => (a.items ?? []).some(i => i.id === id));
  if (!src) throw new CaseFileValidationError('فقط یافته‌ی محور قابلِ انتقال است');
  const item = src.items!.find(i => i.id === id)!;
  if (src.id === target.id && item.role === role) return next;
  src.items = src.items!.filter(i => i.id !== id);
  item.role = role as FindingRole;
  item.movedTo = { axisTitle: target.title, role: role as FindingRole };
  target.items = [...(target.items ?? []), item];
  rebuildAxisValue(src); rebuildAxisValue(target);
  return next;
}

// همه‌ی یافته‌هایِ ساخت‌یافته (محورها + زوجین + خانواده) — هدفِ ستاره‌گذاری
function allFindingIds(c: CaseFileContent): Set<string> {
  const ids = new Set<string>();
  for (const a of c.axes ?? []) for (const i of a.items ?? []) ids.add(i.id);
  for (const g of [c.coupleRelationship, c.familyRelationship]) for (const f of g?.fields ?? []) for (const i of f.items ?? []) ids.add(i.id);
  return ids;
}

// پرونده‌های قدیمی‌تر از افزودنِ برخی کلیدها (overallStatus/safetyRisk/…) آن کلید را ندارند؛
// بدونِ این پیش‌فرض، ویرایشِ دستیِ چنین فیلدی خطا می‌داد و تراپیست نمی‌توانست پرش کند.
const EMPTY_FIELD: CaseFileField = { value: '', source: 'ai', reviewedByTherapist: false, suggestedUpdate: null, pending: true };

// پاک‌سازیِ ردیفِ خالیِ دارو که پیش از فیکسِ enforceCaseFileRules (validate.ts) ساخته و ذخیره شده بود:
// مدل گاهی یک آیتمِ medication با name خالی برمی‌گرداند؛ آن ردیف addedByTherapist ندارد (پس دکمه‌ی
// «حذف» در UI نشانش نمی‌دهد) و چون در draftِ آینده هم دیگر نمی‌آید، mergeMedication تا اولین
// regenerate آن را حذف نمی‌کند — تراپیست تا آن‌موقع با یک ردیفِ همیشه-«در انتظار ثبت» و بدونِ هیچ
// راهِ حذفی گیر می‌کرد. این تابع هرجا content خوانده/نوشته می‌شود صدا زده می‌شود تا داده‌ی کهنه‌ی
// از قبل ذخیره‌شده هم فوراً پاک شود، نه فقط ورودیِ تازه‌ی مدل.
export function dropGhostMedication(content: CaseFileContent): CaseFileContent {
  if (content.medication?.some(m => !m.addedByTherapist && !m.name.trim())) {
    content.medication = content.medication.filter(m => m.addedByTherapist || m.name.trim() !== '');
  }
  return content;
}

// مهاجرتِ رکوردهایِ قدیمی‌تر از افزودنِ answeredQuestions: قبلاً پاسخ داخلِ خودِ
// pendingQuestions[].answer ذخیره می‌شد و سوال هم در لیستِ «باز» می‌ماند. حالا هر
// pendingQuestionِ پاسخ‌داده‌شده باید به answeredQuestions منتقل شود تا هم از لیستِ باز
// حذف شود هم به‌عنوانِ دیتا به regenerateِ بعدی برسد.
export function migrateAnsweredQuestions(content: CaseFileContent): CaseFileContent {
  const stale = (content.pendingQuestions || []).filter(q => q.answer && q.answer.trim());
  if (stale.length) {
    content.pendingQuestions = content.pendingQuestions.filter(q => !(q.answer && q.answer.trim()));
    content.answeredQuestions = [
      ...(content.answeredQuestions || []),
      ...stale.map(q => ({ id: q.id, question: q.question, relatedAxis: q.relatedAxis, answer: q.answer!.trim(), answeredAt: new Date().toISOString() })),
    ];
  } else if (!content.answeredQuestions) {
    content.answeredQuestions = [];
  }
  return content;
}

function applyToField(existing: CaseFileField | undefined, action: FieldPatchAction, value: string | undefined): CaseFileField {
  const field = existing ?? EMPTY_FIELD;
  switch (action) {
    case 'edit':
      if (typeof value !== 'string') throw new CaseFileValidationError('value برایِ edit الزامی است');
      // ⭐ ویرایشِ دستی همیشه یعنی تاییدِ همزمان (اصلِ سندِ بازبینی: source=therapist ⇒ reviewedByTherapist=true)
      return { value, source: 'therapist', reviewedByTherapist: true, suggestedUpdate: null, pending: false };
    case 'approve':
      // تاییدِ بدونِ ویرایش — value/source دست‌نخورده می‌مانند
      return { ...field, reviewedByTherapist: true };
    case 'accept-suggestion':
      if (!field.suggestedUpdate) throw new CaseFileValidationError('پیشنهادِ به‌روزرسانی برایِ این فیلد وجود ندارد');
      // قبولِ پیشنهاد یعنی متنِ AI جایگزین می‌شود ولی دوباره «تاییدنشده» می‌ماند تا
      // خودِ تراپیست صریحاً تاییدش کند (اصلِ ۴ سندِ بازبینی)
      return { value: field.suggestedUpdate, source: 'ai', reviewedByTherapist: false, suggestedUpdate: null, pending: false };
    case 'dismiss-suggestion':
      return { ...field, suggestedUpdate: null };
    default:
      throw new CaseFileValidationError('عملیاتِ نامعتبر');
  }
}

export function applyFieldPatch(
  content: CaseFileContent,
  fieldId: string,
  action: FieldPatchAction,
  value: string | undefined
): CaseFileContent {
  const next: CaseFileContent = JSON.parse(JSON.stringify(content));
  const parts = fieldId.split('.');

  // finding.<id> با pin/unpin: نکته‌ی کلیدی (حداکثر ۳). یافته‌ی نامعتبر یا بیش از سقف خطای واضح می‌دهد.
  if (parts[0] === 'finding' && parts.length === 2) {
    if (action !== 'pin' && action !== 'unpin' && action !== 'move') throw new CaseFileValidationError('برایِ یافته فقط pin، unpin یا move مجاز است');
    if (action === 'move') return moveFinding(next, parts[1], value);
    const cur = next.keyPoints?.ids ?? [];
    if (action === 'pin') {
      if (!allFindingIds(next).has(parts[1])) throw new CaseFileValidationError('یافته یافت نشد');
      if (!cur.includes(parts[1]) && cur.length >= MAX_KEY_POINTS) throw new CaseFileValidationError('حداکثر ' + MAX_KEY_POINTS + ' نکته‌ی کلیدی — اول یکی را بردارید');
      next.keyPoints = { ids: cur.includes(parts[1]) ? cur : [...cur, parts[1]], edited: true };
    } else {
      next.keyPoints = { ids: cur.filter(x => x !== parts[1]), edited: true };
    }
    return next;
  }


  if (fieldId === 'identity') { next.identity = applyToField(next.identity, action, value); return next; }
  if (fieldId === 'mainIssue') { next.mainIssue = applyToField(next.mainIssue, action, value); return next; }
  if (fieldId === 'overallStatus') { next.overallStatus = applyToField(next.overallStatus, action, value); return next; }
  if (fieldId === 'safetyRisk') { next.safetyRisk = applyToField(next.safetyRisk, action, value); return next; }
  if (fieldId === 'sensitiveContext') { next.sensitiveContext = applyToField(next.sensitiveContext, action, value); return next; }
  // ویرایش/پذیرشِ ردیفِ اصلی ⇒ ردیف‌هایِ موازی دیگر با آن هم‌خوان نیستند؛ نمایش به دوجعبه‌ی changeOverTime برمی‌گردد
  const dropRows = () => { if (action === 'edit' || action === 'accept-suggestion') delete next.changeRows; };
  if (fieldId === 'changeOverTime.before') { next.changeOverTime.before = applyToField(next.changeOverTime.before, action, value); dropRows(); return next; }
  if (fieldId === 'changeOverTime.after') { next.changeOverTime.after = applyToField(next.changeOverTime.after, action, value); dropRows(); return next; }

  if (parts[0] === 'axis' && parts.length === 2) {
    const axis = next.axes.find(a => a.id === parts[1]);
    if (!axis) throw new CaseFileValidationError('محور یافت نشد');
    Object.assign(axis, applyToField(axis, action, value));
    // با edit/accept-suggestion، body دیگر از رویِ items مشتق نیست
    if (action === 'edit' || action === 'accept-suggestion') { delete axis.items; delete axis.refs; }
    return next;
  }

  if (parts[0] === 'medication' && parts.length === 3) {
    const med = next.medication.find(m => m.id === parts[1]);
    if (!med) throw new CaseFileValidationError('دارو یافت نشد');
    const key = parts[2];
    if (key === 'name') {
      if (!med.addedByTherapist) throw new CaseFileValidationError('فقط نامِ دارویِ افزوده‌شده‌یِ دستی قابلِ ویرایش است');
      if (action !== 'edit') throw new CaseFileValidationError('برایِ نامِ دارو فقط عملیاتِ edit مجاز است');
      med.name = cleanText(value, 80, 'نامِ دارو');
      return next;
    }
    if (key !== 'dose' && key !== 'frequency' && key !== 'lastChange' && key !== 'prescriber') {
      throw new CaseFileValidationError('فیلدِ دارو نامعتبر');
    }
    med[key] = applyToField(med[key], action, value);
    return next;
  }

  if (parts[0] === 'family' && parts.length === 2) {
    const f = next.familyRelationship.fields.find(x => x.key === parts[1]);
    if (!f) throw new CaseFileValidationError('فیلدِ خانواده یافت نشد');
    Object.assign(f, applyToField(f, action, value));
    if (action === 'edit' || action === 'accept-suggestion') { delete f.items; delete f.refs; }
    return next;
  }

  if (parts[0] === 'couple' && parts.length === 2) {
    if (!next.coupleRelationship) throw new CaseFileValidationError('بخشِ رابطه‌ی زوجین موجود نیست');
    const f = next.coupleRelationship.fields.find(x => x.key === parts[1]);
    if (!f) throw new CaseFileValidationError('فیلدِ زوجین یافت نشد');
    Object.assign(f, applyToField(f, action, value));
    // با edit/accept-suggestion، value دیگر از رویِ items مشتق نیست؛ نگه‌داشتنِ items نمایشِ کهنه نشان می‌داد.
    if (action === 'edit' || action === 'accept-suggestion') { delete f.items; delete f.refs; }
    return next;
  }

  if (parts[0] === 'roadmap' && parts.length === 3 && parts[2] === 'detail') {
    const step = next.roadmap.find(r => r.id === parts[1]);
    if (!step) throw new CaseFileValidationError('گامِ نقشه‌راه یافت نشد');
    step.detail = applyToField(step.detail, action, value);
    return next;
  }

  if (parts[0] === 'session' && parts.length === 3) {
    const s = next.sessionsSummary.find(x => x.sessionId === parts[1]);
    if (!s) throw new CaseFileValidationError('خلاصه‌ی جلسه یافت نشد');
    const key = parts[2];
    if (key !== 'title' && key !== 'body') throw new CaseFileValidationError('فیلدِ جلسه نامعتبر');
    s[key] = applyToField(s[key], action, value);
    return next;
  }

  if (parts[0] === 'question' && parts.length === 3 && parts[2] === 'answer') {
    if (action !== 'edit' || typeof value !== 'string') {
      throw new CaseFileValidationError('برایِ پاسخ به سوال فقط عملیاتِ edit مجاز است');
    }
    const answer = value.trim();
    if (!answer) throw new CaseFileValidationError('پاسخ نمی‌تواند خالی باشد');
    const idx = next.pendingQuestions.findIndex(x => x.id === parts[1]);
    if (idx < 0) throw new CaseFileValidationError('سوال یافت نشد');
    const q = next.pendingQuestions[idx];
    // ⭐ پاسخ‌دادن یعنی سوال از «سوالاتِ باز» خارج و به‌عنوانِ دیتا (مثلِ یادداشت) به
    // answeredQuestions منتقل می‌شود — هم از UI محو می‌شود هم در regenerateِ بعدی به مدل می‌رسد.
    next.pendingQuestions.splice(idx, 1);
    next.answeredQuestions = [
      ...(next.answeredQuestions || []),
      { id: q.id, question: q.question, relatedAxis: q.relatedAxis, answer, answeredAt: new Date().toISOString() },
    ];
    return next;
  }

  throw new CaseFileValidationError('شناسه‌ی فیلد نامعتبر: ' + fieldId);
}

// ===== افزودن/حذفِ ردیفِ دستی (محور، دارو، گامِ نقشه‌راه) =====
// ردیفِ دستی addedByTherapist=true دارد تا mergeCaseFileDraft آن را در regenerate نگه دارد.
export type AddableKind = 'axis' | 'medication' | 'roadmap';

const therapistField = (value: string): CaseFileField => ({
  value, source: 'therapist', reviewedByTherapist: value.trim() !== '', suggestedUpdate: null, pending: value.trim() === '',
});

function cleanText(v: unknown, max: number, what: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new CaseFileValidationError(`${what} الزامی است`);
  if (v.trim().length > max) throw new CaseFileValidationError(`${what} بیش از حد طولانی است`);
  return v.trim();
}

// برخلافِ cleanText، مقدارِ خالی خطا نمی‌دهد — برایِ زیرفیلدهایِ اختیاریِ دارو هنگامِ افزودن
function optionalText(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

export function addCaseFileItem(content: CaseFileContent, kind: AddableKind, input: Record<string, unknown>): CaseFileContent {
  const next: CaseFileContent = JSON.parse(JSON.stringify(content));
  if (kind === 'axis') {
    const tone = ['good', 'watch', 'sensitive'].includes(input.statusTone as string) ? (input.statusTone as AxisTone) : 'watch';
    next.axes = next.axes || [];
    next.axes.push({
      id: randomUUID(), title: cleanText(input.title, 80, 'عنوانِ محور'), statusTone: tone,
      sensitiveDoNotDiscussInFrontOfClient: false, addedByTherapist: true, ...therapistField(''),
    });
  } else if (kind === 'medication') {
    next.medication = next.medication || [];
    next.medication.push({
      id: randomUUID(), name: cleanText(input.name, 80, 'نامِ دارو'), addedByTherapist: true,
      dose: therapistField(optionalText(input.dose, 120)),
      frequency: therapistField(optionalText(input.frequency, 120)),
      lastChange: therapistField(optionalText(input.lastChange, 120)),
      prescriber: therapistField(optionalText(input.prescriber, 120)),
    });
  } else if (kind === 'roadmap') {
    const pr = ['p2', 'p3', 'p4'].includes(input.priority as string) ? (input.priority as RoadmapPriority) : 'p3';
    next.roadmap = next.roadmap || [];
    next.roadmap.push({
      id: randomUUID(), priority: pr, question: cleanText(input.question, 200, 'عنوانِ گام'),
      why: typeof input.why === 'string' ? input.why.trim().slice(0, 40) : '', addedByTherapist: true, detail: therapistField(''),
    });
    const order = { p1: 1, p2: 2, p3: 3, p4: 4 };
    next.roadmap.sort((a, b) => order[a.priority] - order[b.priority]); // sort پایدار؛ ترتیبِ نسبیِ هم‌اولویت‌ها حفظ می‌شود
  } else {
    throw new CaseFileValidationError('نوعِ ردیف نامعتبر');
  }
  return next;
}

export function removeCaseFileItem(content: CaseFileContent, kind: AddableKind, id: string): CaseFileContent {
  const next: CaseFileContent = JSON.parse(JSON.stringify(content));
  const list: Array<{ id: string; addedByTherapist?: boolean }> | undefined =
    kind === 'axis' ? next.axes : kind === 'medication' ? next.medication : kind === 'roadmap' ? next.roadmap : undefined;
  if (!list) throw new CaseFileValidationError('نوعِ ردیف نامعتبر');
  const idx = list.findIndex(x => x.id === id);
  if (idx < 0) throw new CaseFileValidationError('ردیف یافت نشد');
  // فقط ردیفِ دستی حذف می‌شود؛ ردیفِ AI با regenerate برمی‌گشت و حذفش گمراه‌کننده بود
  if (!list[idx].addedByTherapist) throw new CaseFileValidationError('فقط ردیفِ افزوده‌شده‌ی دستی قابلِ حذف است');
  list.splice(idx, 1);
  return next;
}
