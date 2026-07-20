import { parseChatAgentResponse } from '../../../infrastructure/chat/structured-output/chat-agent-response.parser';

const validStateUpdate = {
  shouldUpdate: true,
  currentTopic: 'sono e sobrecarga de trabalho',
  currentConcerns: ['controle de impulsos'],
  userNeeds: ['apoio humano'],
  supportContext: 'none_reported',
  safetyState: 'needs_check',
  pendingQuestionCode: 'immediate_safety',
  lastAssistantIntent: 'check_immediate_safety'
};

describe('parseChatAgentResponse', () => {
  it('normalizes a structured response with ephemeral state', () => {
    const response = parseChatAgentResponse(
      `\`\`\`json\n${JSON.stringify({
        reply: '  Resposta acolhedora.  ',
        riskLevel: 'low',
        scopeStatus: 'in_scope',
        conversationStateUpdate: validStateUpdate
      })}\n\`\`\``,
      'Provider'
    );

    expect(response).toEqual({
      reply: 'Resposta acolhedora.',
      riskLevel: 'low',
      scopeStatus: 'in_scope',
      conversationStateUpdate: validStateUpdate
    });
  });

  it('repairs trailing commas without accepting the retired profileUpdate contract', () => {
    const response = parseChatAgentResponse(
      [
        '{',
        '"reply": "Resposta.",',
        '"riskLevel": "none",',
        '"scopeStatus": "in_scope",',
        '"conversationStateUpdate": {',
        '"shouldUpdate": false,',
        '"currentTopic": null,',
        '"currentConcerns": [],',
        '"userNeeds": [],',
        '"supportContext": "unknown",',
        '"safetyState": "none",',
        '"pendingQuestionCode": "none",',
        '"lastAssistantIntent": "listen",',
        '},',
        '}'
      ].join('\n'),
      'Provider'
    );

    expect(response.conversationStateUpdate.shouldUpdate).toBe(false);
  });

  it('rejects invalid state enums and legacy profile updates', () => {
    expect(() =>
      parseChatAgentResponse(
        JSON.stringify({
          reply: 'Resposta.',
          riskLevel: 'none',
          scopeStatus: 'in_scope',
          profileUpdate: { shouldUpdate: false }
        }),
        'Provider'
      )
    ).toThrow('Provider returned an invalid structured response');
  });
});
