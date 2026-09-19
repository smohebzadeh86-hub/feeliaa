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

const axisSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    body: { type: 'string' },
    pending: { type: 'boolean' },
    statusTone: { type: 'string', enum: ['good', 'watch', 'sensitive'] },
    sensitiveDoNotDiscussInFrontOfClient: { type: 'boolean' },
  },
  required: ['title', 'body', 'pending', 'statusTone', 'sensitiveDoNotDiscussInFrontOfClient'],
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
      familyRelationship: relationshipGroupSchema,
      coupleRelationship: { anyOf: [relationshipGroupSchema, { type: 'null' }] },
      changeOverTime: {
        type: 'object',
        properties: { before: fieldSchema, after: fieldSchema },
        required: ['before', 'after'],
        additionalProperties: false,
      },
      sessionsSummary: { type: 'array', items: sessionSummarySchema },
      roadmap: { type: 'array', items: roadmapSchema },
      pendingQuestions: { type: 'array', items: pendingQuestionSchema },
    },
    required: [
      'identity', 'mainIssue', 'overallStatus', 'safetyRisk', 'sensitiveContext',
      'medication', 'axes', 'familyRelationship',
      'coupleRelationship', 'changeOverTime', 'sessionsSummary', 'roadmap', 'pendingQuestions',
    ],
    additionalProperties: false,
  },
} as const;
