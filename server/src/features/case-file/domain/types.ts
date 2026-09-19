// پرونده‌ی روندِ درمان — تایپ‌های دامنه‌ای. بدونِ importِ هیچ SDKِ providerای (قاعده‌ی
// معماری: domain/application هیچ وابستگی‌ای به OpenAI/provider ندارند — فقط ports/*).

export type FieldSource = 'ai' | 'therapist';
export type AxisTone = 'good' | 'watch' | 'sensitive';
export type RoadmapPriority = 'p1' | 'p2' | 'p3' | 'p4';
export type CaseFileStatus = 'ready' | 'generating' | 'error' | 'stale';

// ===== چیزی که LLM مستقیماً تولید می‌کند =====
// عمداً بدونِ source/reviewedByTherapist/suggestedUpdate — این متادیتا را merge (نه مدل)
// اضافه می‌کند، چون مدل هیچ ایده‌ای از تاریخچه‌ی تاییدهایِ قبلیِ تراپیست ندارد.
export interface DraftField {
  value: string;
  pending: boolean;
}

export interface DraftAxis {
  title: string;
  body: string;
  pending: boolean;
  statusTone: AxisTone;
  sensitiveDoNotDiscussInFrontOfClient: boolean;
}

export interface DraftRelationshipField {
  key: string;
  label: string;
  value: string;
  pending: boolean;
}

export interface DraftRelationshipGroup {
  title: string;
  fields: DraftRelationshipField[];
}

export interface DraftMedicationEntry {
  name: string;
  dose: string;
  frequency: string;
  lastChange: string;
  prescriber: string;
  pending: boolean;
}

export interface DraftRoadmapStep {
  priority: RoadmapPriority;
  question: string;
  why: string;
  detail: string;
}

export interface DraftPendingQuestion {
  question: string;
  relatedAxis: string | null;
}

export interface DraftSessionSummaryEntry {
  sessionNum: number;
  title: string;
  body: string;
  durationIndicator: string | null;
}

export interface CaseFileDraft {
  identity: DraftField;
  mainIssue: DraftField;
  // خلاصه‌ی یک‌خطیِ وضعیتِ کلی (برایِ status-pillِ هدر) — فقط وقتی داده‌ی کافی برایِ
  // قضاوتِ کلی هست پر می‌شود، وگرنه pending=true/خالی
  overallStatus: DraftField;
  // هشدارِ ایمنی/خطرِ جانی — مفهوماً جدا از sensitiveDoNotDiscussInFrontOfClientِ per-axis
  // (که یعنی «جلویِ مراجع نگو»، نه لزوماً خطر). فقط وقتی نشانه‌ی واقعیِ ریسک در متن هست پر می‌شود.
  safetyRisk: DraftField;
  // خلاصه‌ی سطحِ‌بالایِ زمینه‌ی حساسِ پرونده (برایِ بنرِ کهربایی) — جدا از هر axisِ خاص
  sensitiveContext: DraftField;
  medication: DraftMedicationEntry[];
  axes: DraftAxis[];
  familyRelationship: DraftRelationshipGroup;
  coupleRelationship: DraftRelationshipGroup | null;
  changeOverTime: { before: DraftField; after: DraftField };
  sessionsSummary: DraftSessionSummaryEntry[];
  roadmap: DraftRoadmapStep[];
  pendingQuestions: DraftPendingQuestion[];
}

// ===== ساختارِ نهایی، ذخیره‌شده (بعدِ merge) — با متادیتایِ source/reviewedByTherapist =====
// نکته‌ی UI (تصمیمِ صریحِ مالک): این متادیتا هرگز به‌صورتِ برچسبِ خام به تراپیست نشان
// داده نمی‌شود — فقط برایِ منطقِ merge/regeneration استفاده می‌شود.
export interface CaseFileField {
  value: string;
  source: FieldSource;
  reviewedByTherapist: boolean;
  suggestedUpdate: string | null;
  pending: boolean;
}

export interface CaseFileAxis extends CaseFileField {
  id: string;
  // ردیفی که تراپیست دستی افزوده؛ regenerate آن را حذف نمی‌کند
  addedByTherapist?: boolean;
  title: string;
  statusTone: AxisTone;
  sensitiveDoNotDiscussInFrontOfClient: boolean;
}

export interface CaseFileRelationshipField extends CaseFileField {
  key: string;
  label: string;
}

export interface CaseFileRelationshipGroup {
  title: string;
  fields: CaseFileRelationshipField[];
}

export interface CaseFileMedicationEntry {
  id: string;
  addedByTherapist?: boolean;
  name: string;
  dose: CaseFileField;
  frequency: CaseFileField;
  lastChange: CaseFileField;
  prescriber: CaseFileField;
}

export interface CaseFileRoadmapStep {
  id: string;
  addedByTherapist?: boolean;
  priority: RoadmapPriority;
  question: string;
  why: string;
  detail: CaseFileField;
}

export interface CaseFilePendingQuestion {
  id: string;
  question: string;
  relatedAxis: string | null;
  answer: string | null;
}

export interface CaseFileSessionSummaryEntry {
  sessionId: string;
  sessionNum: number;
  title: CaseFileField;
  body: CaseFileField;
  durationIndicator: string | null;
}

export interface CaseFileContent {
  identity: CaseFileField;
  mainIssue: CaseFileField;
  overallStatus: CaseFileField;
  safetyRisk: CaseFileField;
  sensitiveContext: CaseFileField;
  medication: CaseFileMedicationEntry[];
  axes: CaseFileAxis[];
  familyRelationship: CaseFileRelationshipGroup;
  coupleRelationship: CaseFileRelationshipGroup | null;
  changeOverTime: { before: CaseFileField; after: CaseFileField };
  sessionsSummary: CaseFileSessionSummaryEntry[];
  roadmap: CaseFileRoadmapStep[];
  pendingQuestions: CaseFilePendingQuestion[];
}

// خروجیِ مرحله‌ی ۱ (digest) — متنِ تصحیح‌شده + فکت‌ها؛ ورودیِ مرحله‌ی ۲ (compose). ذخیره نمی‌شود.
export type DigestFactCategory = 'symptom' | 'event' | 'relationship' | 'medication' | 'risk' | 'intervention' | 'other';

export interface CaseFileDigestSession {
  sessionNum: number;
  date: string;
  source: string;
  correctedText: string;
  facts: { category: DigestFactCategory; text: string }[];
  quotes: string[];
  ambiguities: string[];
}

export interface CaseFileDigest {
  overallStory: string;
  sessions: CaseFileDigestSession[];
}
