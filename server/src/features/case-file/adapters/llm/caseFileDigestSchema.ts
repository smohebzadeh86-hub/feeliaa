// JSON Schema مرحله‌ی ۱ (digest) — معادل CaseFileDigest (domain/types.ts). strict mode:
// هر object با additionalProperties:false و همه‌ی propertyها در required.
export const CASE_FILE_DIGEST_JSON_SCHEMA = {
  name: 'case_file_digest',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      overallStory: { type: 'string' },
      sessions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sessionNum: { type: 'integer' },
            date: { type: 'string' },
            source: { type: 'string' },
            correctedText: { type: 'string' },
            facts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  category: {
                    type: 'string',
                    enum: ['symptom', 'event', 'relationship', 'medication', 'risk', 'intervention', 'other'],
                  },
                  text: { type: 'string' },
                  source: {
                    type: 'string',
                    enum: ['client_report', 'therapist_observation', 'therapist_inference', 'unspecified'],
                  },
                  about: { type: 'string' },
                },
                required: ['category', 'text', 'source', 'about'],
                additionalProperties: false,
              },
            },
            quotes: { type: 'array', items: { type: 'string' } },
            ambiguities: { type: 'array', items: { type: 'string' } },
          },
          required: ['sessionNum', 'date', 'source', 'correctedText', 'facts', 'quotes', 'ambiguities'],
          additionalProperties: false,
        },
      },
    },
    required: ['overallStory', 'sessions'],
    additionalProperties: false,
  },
} as const;
