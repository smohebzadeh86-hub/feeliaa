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

// ارجاعِ متقاطع: یافته‌ای که فکتش «خانه‌ی کامل» دیگری دارد این‌جا حذف می‌شود و فقط یک ارجاعِ کوچک به خانه‌اش می‌ماند
// (اطلاعات گم نمی‌شود و متنِ کامل تکرار هم نمی‌شود).
export interface CaseFileRef { label: string; where: string; findingId: string }

export interface CaseFileChangeRow { id: string; label: string; before: string; after: string }

// ردیفِ خامِ قبل/اکنون: مدل فقط جمله‌هایِ کوتاهِ قبل و اکنون + factIds می‌دهد
export interface RawChange { label: string; before: string; after: string; factIds: string[] }

export interface DraftAxis {
  title: string;
  body: string;
  pending: boolean;
  statusTone: AxisTone;
  sensitiveDoNotDiscussInFrontOfClient: boolean;
  // body از رویِ items مشتق می‌شود (سطرِ «خلاصه: …» + یافته‌ها)؛ پرونده‌هایِ قدیمی items ندارند
  items?: CaseFileFinding[];
  refs?: CaseFileRef[];
}

// نقشِ بالینیِ یک یافته در یک محور — واژگانِ ثابت (بر پایه‌ی فرمولاسیونِ ۵P) تا جای هر نوع اطلاعات همیشه یکی باشد.
// مدل بر اساسِ محتوا انتخاب می‌کند؛ نقشِ بدونِ داده نمایش داده نمی‌شود (بارِ شناختیِ ردیفِ خالی در هر محور زیاد است).
export const FINDING_ROLES = [
  'state', 'evidence', 'impact', 'cognition', 'predisposing', 'precipitating', 'maintaining', 'coping', 'protective', 'treatment_history', 'treatment_response', 'goals', 'change', 'unknown', 'session_note', 'other',
] as const;
export type FindingRole = typeof FINDING_ROLES[number];
export const FINDING_ROLE_LABEL: Record<FindingRole, string> = {
  state: 'وضعیتِ فعلی',
  evidence: 'نشانه‌ها و شواهد',
  impact: 'تأثیر بر عملکرد',
  cognition: 'افکار و باورها',
  predisposing: 'عوامل زمینه‌ای',
  precipitating: 'محرک‌ها',
  maintaining: 'عوامل نگه‌دارنده و تشدیدکننده',
  coping: 'راهبردهای مقابله',
  protective: 'عوامل محافظتی',
  treatment_history: 'سابقه‌ی درمان',
  treatment_response: 'پاسخ به مداخله',
  goals: 'اهداف و ارزش‌ها',
  change: 'تغییر نسبت به قبل',
  unknown: 'ابهام و اطلاعاتِ ناکافی',
  session_note: 'نکته برای جلسه',
  other: 'سایر',
};

// «یافته» = واحدِ پایه‌ی اطلاعات (نه پاراگراف): یک گزاره‌ی کامل و خودکفا با منبع و فردِ مرتبط.
// منبع از فیلدِ داده می‌آید، نه از عبارتِ داخلِ متن؛ متن هرگز خلاصه نمی‌شود.
export type FindingSource = 'client_report' | 'therapist_observation' | 'therapist_inference' | 'unspecified';

// خروجیِ خامِ مدل برایِ یک یافته. factIds = شناسه‌ی فکت/نقلِ digest که این یافته از آن‌ها ساخته شده
// (ردیابیِ مکانیکیِ حفظِ اطلاعات؛ مدل فقط ارجاع می‌دهد، متنِ نقل‌ها را کد از digest برمی‌دارد).
export interface RawFinding {
  label: string;
  text: string;
  source: FindingSource;
  about: string;
  factIds: string[];
}

// یافته‌ی ذخیره‌شده — id پایدار (hash) تا بینِ regenerate هویتش حفظ شود.
export interface CaseFileFinding {
  id: string;
  label: string;
  text: string;
  source: FindingSource;
  about: string;
  // فقط یافته‌هایِ محور (نقشِ بالینی)؛ در رابطه‌ها نقش همان field است
  role?: FindingRole;
  // جابه‌جاییِ دستیِ تراپیست (خطایِ طبقه‌بندیِ مدل قابلِ اصلاح است)؛ merge آن را بعد از regenerate دوباره اعمال می‌کند
  movedTo?: { axisTitle: string; role: FindingRole };
}

// یافته‌ی خامِ محور: نقشِ بالینی را مدل بر اساسِ محتوا انتخاب می‌کند
export interface RawAxisFinding extends RawFinding {
  role: FindingRole;
}

export interface RawAxis {
  title: string;
  // یک سطرِ عنوانِ اسکن‌پذیر (فقط جمع‌بندیِ همان محور)؛ محتوا در items کامل می‌ماند
  summary: string;
  pending: boolean;
  statusTone: AxisTone;
  sensitiveDoNotDiscussInFrontOfClient: boolean;
  items: RawAxisFinding[];
}

export interface DraftRelationshipField {
  key: string;
  label: string;
  value: string;
  pending: boolean;
  // فقط رابطه‌ی زوجین: value از رویِ items مشتق می‌شود (برایِ ویرایش/merge/پرونده‌هایِ قدیمی)
  items?: CaseFileFinding[];
  refs?: CaseFileRef[];
}

export interface RawCoupleField {
  key: string;
  label: string;
  pending: boolean;
  items: RawFinding[];
}

export interface RawCoupleGroup {
  title: string;
  fields: RawCoupleField[];
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
  // قبل/اکنون به‌صورتِ ردیف‌هایِ موازی (۱ تا ۳)؛ ردیفِ اول = مهم‌ترین و اخیرترین. changeOverTime از رویِ ردیفِ اول مشتق می‌شود
  // (ویرایش/merge/پرونده‌هایِ قدیمی). ردیف‌ها «خانه‌ی کاملِ» تغییرند؛ همان فکت در محور تکرار نمی‌شود (ارجاعِ متقاطع).
  changeRows: CaseFileChangeRow[];
  sessionsSummary: DraftSessionSummaryEntry[];
  roadmap: DraftRoadmapStep[];
  pendingQuestions: DraftPendingQuestion[];
  // ۱ تا ۳ «نکته‌ی کلیدی» = شناسه‌ی یافته‌هایِ نهایی (اشاره‌گر، نه کپیِ متن: هر فکت یک خانه‌ی کامل دارد)
  keyPointIds: string[];
}

// خروجیِ خامِ مدل (مرحله‌ی ۲): محورها و رابطه‌ها (خانواده/زوجین) شکلِ «یافته» دارند؛ بعدِ finalizeDraft (کد) به CaseFileDraft می‌رسند.
// نکته‌ی کلیدیِ خام: مدل فقط شناسه‌ی فکت‌هایِ مهم‌ترین چیزی را می‌دهد که تراپیست باید هنگامِ ورود به جلسه در ذهن داشته باشد؛
// کد آن را به یافته‌ی نهایی وصل می‌کند.
export interface RawKeyPoint { factIds: string[] }

export type RawCaseFileDraft = Omit<CaseFileDraft, 'coupleRelationship' | 'familyRelationship' | 'axes' | 'keyPointIds' | 'changeOverTime' | 'changeRows'> & {
  changes: RawChange[];
  keyPoints: RawKeyPoint[];
  coupleRelationship: RawCoupleGroup | null;
  familyRelationship: RawCoupleGroup;
  axes: RawAxis[];
};

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
  // یافته‌هایِ ساخت‌یافته؛ با edit/accept-suggestion دستی حذف می‌شود و نمایش به value برمی‌گردد
  items?: CaseFileFinding[];
  refs?: CaseFileRef[];
}

export interface CaseFileRelationshipField extends CaseFileField {
  key: string;
  label: string;
  // یافته‌هایِ ساخت‌یافته (فقط زوجین). با edit/accept-suggestion دستیِ تراپیست حذف می‌شود و نمایش
  // به value برمی‌گردد؛ نبودنش (پرونده‌هایِ قدیمی) یعنی نمایشِ قدیمی.
  items?: CaseFileFinding[];
  refs?: CaseFileRef[];
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
  // ⭐ فیلدِ قدیمی — از وقتی پاسخ به answeredQuestions منتقل می‌شود دیگر ست نمی‌شود؛
  // فقط برایِ سازگاری با رکوردهایِ قدیمی در DB نگه داشته شده (نگاه کنید به
  // migrateAnsweredQuestions در applyFieldPatch.ts).
  answer: string | null;
}

// سوالی که تراپیست پاسخ داده — دیگر در «سوالاتِ باز» نمایش داده نمی‌شود، ولی به‌عنوانِ
// دیتا (مثلِ یادداشت) در regenerateِ بعدی به مدل داده می‌شود (buildCaseFilePrompt).
export interface CaseFileAnsweredQuestion {
  id: string;
  question: string;
  relatedAxis: string | null;
  answer: string;
  answeredAt: string;
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
  // پاسخ‌هایِ ثبت‌شده به سوالاتِ باز — نبودنش = پرونده‌ی قدیمی (نگاه کنید به migrateAnsweredQuestions)
  answeredQuestions?: CaseFileAnsweredQuestion[];
  // نکات کلیدی (حداکثر ۳)؛ edited=true یعنی تراپیست دستی تغییر داده و regenerate آن را عوض نمی‌کند. نبودنش = پرونده‌ی قدیمی.
  keyPoints?: { ids: string[]; edited: boolean };
  // ردیف‌هایِ قبل/اکنون؛ نبودنش = پرونده‌ی قدیمی (نمایشِ دوجعبه‌ایِ changeOverTime)
  changeRows?: CaseFileChangeRow[];
}

// خروجیِ مرحله‌ی ۱ (digest) — متنِ تصحیح‌شده + فکت‌ها؛ ورودیِ مرحله‌ی ۲ (compose). ذخیره نمی‌شود.
export type DigestFactCategory = 'symptom' | 'event' | 'relationship' | 'medication' | 'risk' | 'intervention' | 'other';

// منبعِ هر فکت: روایتِ مراجع / مشاهده‌ی مستقیمِ درمانگر / استنباطِ درمانگر / نامشخص — از نظرِ
// بالینی فرق دارند و مرحله‌ی ۲ فقط اگر مرحله‌ی ۱ ثبتشان کند می‌تواند نشانشان بدهد.
export type DigestFactSource = 'client_report' | 'therapist_observation' | 'therapist_inference' | 'unspecified';

export interface CaseFileDigestFact {
  category: DigestFactCategory;
  text: string;
  source: DigestFactSource;
  // فردِ مرتبط (مثلاً «همسر»، «مادرِ مراجع»)؛ رشته‌ی خالی اگر فرد خاصی نیست
  about: string;
}

export interface CaseFileDigestSession {
  sessionNum: number;
  date: string;
  source: string;
  correctedText: string;
  facts: CaseFileDigestFact[];
  quotes: string[];
  ambiguities: string[];
}

export interface CaseFileDigest {
  overallStory: string;
  sessions: CaseFileDigestSession[];
}
