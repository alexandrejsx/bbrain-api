const stateStringArraySchema = {
  type: 'array',
  items: { type: 'string', minLength: 1, maxLength: 100 },
  maxItems: 5
} as const;

export const CHAT_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reply: { type: 'string', minLength: 1 },
    riskLevel: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
    scopeStatus: { type: 'string', enum: ['in_scope', 'out_of_scope'] },
    conversationStateUpdate: {
      type: 'object',
      additionalProperties: false,
      properties: {
        shouldUpdate: { type: 'boolean' },
        currentTopic: { type: ['string', 'null'], maxLength: 100 },
        currentConcerns: stateStringArraySchema,
        userNeeds: stateStringArraySchema,
        supportContext: { type: 'string', enum: ['unknown', 'available', 'none_reported'] },
        safetyState: { type: 'string', enum: ['none', 'needs_check', 'immediate'] },
        pendingQuestionCode: {
          type: 'string',
          enum: [
            'none',
            'current_feeling',
            'routine_impact',
            'coping_strategy',
            'human_support_available',
            'immediate_safety',
            'next_step_preference',
            'clarification',
            'other'
          ]
        },
        lastAssistantIntent: {
          type: 'string',
          enum: [
            'listen',
            'explore_impact',
            'explore_coping',
            'check_human_support',
            'check_immediate_safety',
            'offer_next_step',
            'encourage_professional_support',
            'close_topic',
            'other'
          ]
        }
      },
      required: [
        'shouldUpdate',
        'currentTopic',
        'currentConcerns',
        'userNeeds',
        'supportContext',
        'safetyState',
        'pendingQuestionCode',
        'lastAssistantIntent'
      ]
    }
  },
  required: ['reply', 'riskLevel', 'scopeStatus', 'conversationStateUpdate']
} as const;
