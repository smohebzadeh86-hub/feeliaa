// JSON Schema برای response_format:{type:'json_schema',strict:true} — دقیقاً معادل
// CaseFileDraft (domain/types.ts). در strict mode، OpenAI هر object را با
// additionalProperties:false و همه‌ی propertyها در required می‌خواهد.
const fieldSchema = {
  type: 'object',
  properties: {
    value: { type: 'string' },
    pending: { type: 'boolean' },
  },
  required: ['value', 'pending'],
  additionalProperties: false,
} as const;

// محور: یک سطرِ خلاصه‌ی اسکن‌پذیر + یافته‌ها با نقشِ بالینی (انتخابِ مدل بر اساسِ محتوا؛ نقشِ بدونِ داده نمی‌آید)
const axisFindingSchema = {
  type: 'object',
  properties: {
    role: { type: 'string', enum: ['state', 'evidence', 'impact', 'cognition', 'predisposing', 'precipitating', 'maintaining', 'coping', 'protective', 'treatment_history', 'treatment_response', 'goals', 'change', 'unknown', 'session_note', 'other'] },
    label: { type: 'string' },
    text: { type: 'string' },
    source: { type: 'string', enum: ['client_report', 'therapist_observation', 'therapist_inference', 'unspecified'] },
    about: { type: 'string' },
    factIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['role', 'label', 'text', 'source', 'about', 'factIds'],
  additionalProperties: false,
} as const;

const axisSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    pending: { type: 'boolean' },
    statusTone: { type: 'string', enum: ['good', 'watch', 'sensitive'] },
    sensitiveDoNotDiscussInFrontOfClient: { type: 'boolean' },
    items: { type: 'array', items: axisFindingSchema },
  },
  required: ['title', 'summary', 'pending', 'statusTone', 'sensitiveDoNotDiscussInFrontOfClient', 'items'],
  additionalProperties: false,
} as const;

const relationshipFieldSchema = {
  type: 'object',
  properties: {
    key: { type: 'string' },
    label: { type: 'string' },
    value: { type: 'string' },
    pending: { type: 'boolean' },
  },
  required: ['key', 'label', 'value', 'pending'],
  additionalProperties: false,
} as const;

const relationshipGroupSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    fields: { type: 'array', items: relationshipFieldSchema },
  },
  required: ['title', 'fields'],
  additionalProperties: false,
} as const;

// رابطه‌ی زوجین: هر نقشِ بالینی یک فهرست از «یافته» است (نه رشته‌ی چندخطی)؛ منبع یک فیلدِ داده است.
const findingSchema = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    text: { type: 'string' },
    source: { type: 'string', enum: ['client_report', 'therapist_observation', 'therapist_inference', 'unspecified'] },
    about: { type: 'string' },
    factIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['label', 'text', 'source', 'about', 'factIds'],
  additionalProperties: false,
} as const;

const coupleFieldSchema = {
  type: 'object',
  properties: {
    key: { type: 'string' },
    label: { type: 'string' },
    pending: { type: 'boolean' },
    items: { type: 'array', items: findingSchema },
  },
  required: ['key', 'label', 'pending', 'items'],
  additionalProperties: false,
} as const;

const coupleGroupSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    fields: { type: 'array', items: coupleFieldSchema },
  },
  required: ['title', 'fields'],
  additionalProperties: false,
} as const;

// ۱ تا ۳ نکته‌ی کلیدی: فقط ارجاع به شناسه‌ی فکت‌ها (کد آن را به یافته‌ی نهایی وصل می‌کند)
const keyPointSchema = {
  type: 'object',
  properties: { factIds: { type: 'array', items: { type: 'string' } } },
  required: ['factIds'],
  additionalProperties: false,
} as const;

// ردیفِ قبل/اکنون: دو جمله‌ی کوتاه + ارجاع به فکت‌ها
const changeSchema = {
  type: 'object',
  properties: { label: { type: 'string' }, before: { type: 'string' }, after: { type: 'string' }, factIds: { type: 'array', items: { type: 'string' } } },
  required: ['label', 'before', 'after', 'factIds'],
  additionalProperties: false,
} as const;

const medicationSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    dose: { type: 'string' },
    frequency: { type: 'string' },
    lastChange: { type: 'string' },
    prescriber: { type: 'string' },
    pending: { type: 'boolean' },
  },
  required: ['name', 'dose', 'frequency', 'lastChange', 'prescriber', 'pending'],
  additionalProperties: false,
} as const;

const roadmapSchema = {
  type: 'object',
  properties: {
    priority: { type: 'string', enum: ['p1', 'p2', 'p3', 'p4'] },
    question: { type: 'string' },
    why: { type: 'string' },
    detail: { type: 'string' },
  },
  required: ['priority', 'question', 'why', 'detail'],
  additionalProperties: false,
} as const;

const pendingQuestionSchema = {
  type: 'object',
  properties: {
    question: { type: 'string' },
    relatedAxis: { type: ['string', 'null'] },
  },
  required: ['question', 'relatedAxis'],
  additionalProperties: false,
} as const;

const sessionSummarySchema = {
  type: 'object',
  properties: {
    sessionNum: { type: 'integer' },
    title: { type: 'string' },
    body: { type: 'string' },
    durationIndicator: { type: ['string', 'null'] },
  },
  required: ['sessionNum', 'title', 'body', 'durationIndicator'],
  additionalProperties: false,
} as const;

export const CASE_FILE_JSON_SCHEMA = {
  name: 'case_file_draft',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      identity: fieldSchema,
      mainIssue: fieldSchema,
      overallStatus: fieldSchema,
      safetyRisk: fieldSchema,
      sensitiveContext: fieldSchema,
      medication: { type: 'array', items: medicationSchema },
      axes: { type: 'array', items: axisSchema },
      familyRelationship: coupleGroupSchema,
      coupleRelationship: { anyOf: [coupleGroupSchema, { type: 'null' }] },
      changes: { type: 'array', items: changeSchema },
      sessionsSummary: { type: 'array', items: sessionSummarySchema },
      roadmap: { type: 'array', items: roadmapSchema },
      pendingQuestions: { type: 'array', items: pendingQuestionSchema },
      keyPoints: { type: 'array', items: keyPointSchema },
    },
    required: [
      'identity', 'mainIssue', 'overallStatus', 'safetyRisk', 'sensitiveContext',
      'medication', 'axes', 'familyRelationship',
      'coupleRelationship', 'changes', 'sessionsSummary', 'roadmap', 'pendingQuestions', 'keyPoints',
    ],
    additionalProperties: false,
  },
} as const;
