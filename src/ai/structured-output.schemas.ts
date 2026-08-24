const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] };

export const CONVERSATION_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'riskLevel', 'scopeStatus'],
  properties: {
    reply: { type: 'string', minLength: 1, maxLength: 4000 },
    riskLevel: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
    scopeStatus: { type: 'string', enum: ['in_scope', 'out_of_scope'] }
  }
};

const topicArray = {
  type: 'array',
  maxItems: 8,
  items: { type: 'string', minLength: 1, maxLength: 60 }
};

export const POST_CONVERSATION_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['currentContext', 'memory', 'pattern'],
  properties: {
    currentContext: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['summary', 'topics', 'pendingItems', 'confidence'],
          properties: {
            summary: { type: 'string', minLength: 1, maxLength: 320 },
            topics: topicArray,
            pendingItems: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 120 } },
            confidence: { type: 'number', minimum: 0, maximum: 1 }
          }
        }
      ]
    },
    memory: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['summary', 'kind', 'topics', 'eventDate', 'importance', 'confidence'],
          properties: {
            summary: { type: 'string', minLength: 1, maxLength: 280 },
            kind: {
              type: 'string',
              enum: ['event', 'fact', 'preference', 'relationship', 'routine']
            },
            topics: topicArray,
            eventDate: nullableString,
            importance: { type: 'number', minimum: 0, maximum: 1 },
            confidence: { type: 'number', minimum: 0, maximum: 1 }
          }
        }
      ]
    },
    pattern: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['summary', 'topics'],
          properties: {
            summary: { type: 'string', minLength: 1, maxLength: 280 },
            topics: topicArray
          }
        }
      ]
    }
  }
};

const nullableScore = {
  anyOf: [{ type: 'integer', minimum: 0, maximum: 10 }, { type: 'null' }]
};
const nullableConfidence = {
  anyOf: [{ type: 'number', minimum: 0, maximum: 1 }, { type: 'null' }]
};
export const DAILY_CHECK_IN_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['extracted', 'nextQuestion', 'completed', 'requiresSafetyHandoff'],
  properties: {
    extracted: {
      type: 'object',
      additionalProperties: false,
      required: ['mood'],
      properties: {
        mood: {
          anyOf: [
            { type: 'null' },
            {
              type: 'object',
              additionalProperties: false,
              required: ['score', 'scoreConfidence', 'note'],
              properties: {
                score: nullableScore,
                scoreConfidence: nullableConfidence,
                note: nullableString
              }
            }
          ]
        }
      }
    },
    nextQuestion: nullableString,
    completed: { type: 'boolean' },
    requiresSafetyHandoff: { type: 'boolean' }
  }
};
