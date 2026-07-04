const stringArraySchema = {
  type: 'array',
  items: { type: 'string' },
  maxItems: 10
} as const;

export const CHAT_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reply: { type: 'string', minLength: 1 },
    riskLevel: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
    scopeStatus: { type: 'string', enum: ['in_scope', 'out_of_scope'] },
    profileUpdate: {
      type: 'object',
      additionalProperties: false,
      properties: {
        shouldUpdate: { type: 'boolean' },
        currentContextSummary: { type: ['string', 'null'], maxLength: 500 },
        recurringThemesToAdd: stringArraySchema,
        emotionalPatternsToAdd: stringArraySchema,
        routineNotesToAdd: stringArraySchema,
        helpfulStrategiesToAdd: stringArraySchema,
        unhelpfulStrategiesToAdd: stringArraySchema,
        boundariesToAdd: stringArraySchema
      },
      required: [
        'shouldUpdate',
        'currentContextSummary',
        'recurringThemesToAdd',
        'emotionalPatternsToAdd',
        'routineNotesToAdd',
        'helpfulStrategiesToAdd',
        'unhelpfulStrategiesToAdd',
        'boundariesToAdd'
      ]
    }
  },
  required: ['reply', 'riskLevel', 'scopeStatus', 'profileUpdate']
} as const;
