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
  required: ['currentContext', 'memory', 'pattern', 'mood', 'sleep'],
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
    },
    mood: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: [
            'primaryEmotion',
            'secondaryEmotions',
            'intensity',
            'energy',
            'valence',
            'occurredAt',
            'period',
            'context',
            'confidence'
          ],
          properties: {
            primaryEmotion: { type: 'string', minLength: 1, maxLength: 60 },
            secondaryEmotions: {
              type: 'array',
              maxItems: 4,
              items: { type: 'string', maxLength: 60 }
            },
            intensity: { anyOf: [{ type: 'number', minimum: 0, maximum: 10 }, { type: 'null' }] },
            energy: { anyOf: [{ type: 'number', minimum: 0, maximum: 10 }, { type: 'null' }] },
            valence: { anyOf: [{ type: 'number', minimum: -1, maximum: 1 }, { type: 'null' }] },
            occurredAt: nullableString,
            period: nullableString,
            context: nullableString,
            confidence: { type: 'number', minimum: 0, maximum: 1 }
          }
        }
      ]
    },
    sleep: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: [
            'durationMinutes',
            'durationMinMinutes',
            'durationMaxMinutes',
            'bedtime',
            'wakeTime',
            'quality',
            'awakenings',
            'wakeFeeling',
            'date',
            'period',
            'precision',
            'confidence'
          ],
          properties: {
            durationMinutes: {
              anyOf: [{ type: 'number', minimum: 1, maximum: 1440 }, { type: 'null' }]
            },
            durationMinMinutes: {
              anyOf: [{ type: 'number', minimum: 1, maximum: 1440 }, { type: 'null' }]
            },
            durationMaxMinutes: {
              anyOf: [{ type: 'number', minimum: 1, maximum: 1440 }, { type: 'null' }]
            },
            bedtime: nullableString,
            wakeTime: nullableString,
            quality: nullableString,
            awakenings: { anyOf: [{ type: 'number', minimum: 0, maximum: 100 }, { type: 'null' }] },
            wakeFeeling: nullableString,
            date: nullableString,
            period: nullableString,
            precision: { type: 'string', enum: ['exact', 'approximate'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 }
          }
        }
      ]
    }
  }
};
