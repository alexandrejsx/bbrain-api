import { parseChatAgentResponse } from '../../../infrastructure/chat/structured-output/chat-agent-response.parser';

const validProfileUpdate = {
  shouldUpdate: true,
  currentContextSummary: 'Contexto atual.',
  recurringThemesToAdd: ['trabalho'],
  emotionalPatternsToAdd: ['sobrecarga'],
  routineNotesToAdd: ['dorme tarde'],
  helpfulStrategiesToAdd: ['pausas curtas'],
  unhelpfulStrategiesToAdd: ['adiar descanso'],
  boundariesToAdd: ['prefere respostas curtas']
};

describe('parseChatAgentResponse', () => {
  it('normalizes structured output wrapped in markdown fences', () => {
    const response = parseChatAgentResponse(
      [
        '```json',
        JSON.stringify({
          reply: '  Resposta acolhedora.  ',
          riskLevel: 'low',
          scopeStatus: 'in_scope',
          profileUpdate: validProfileUpdate
        }),
        '```'
      ].join('\n'),
      'Provider'
    );

    expect(response).toEqual({
      reply: 'Resposta acolhedora.',
      riskLevel: 'low',
      scopeStatus: 'in_scope',
      profileUpdate: validProfileUpdate
    });
  });

  it('repairs trailing commas from provider JSON output', () => {
    const response = parseChatAgentResponse(
      [
        '{',
        '"reply": "Resposta.",',
        '"riskLevel": "none",',
        '"scopeStatus": "in_scope",',
        '"profileUpdate": {',
        '"shouldUpdate": false,',
        '"currentContextSummary": null,',
        '"recurringThemesToAdd": [],',
        '"emotionalPatternsToAdd": [],',
        '"routineNotesToAdd": [],',
        '"helpfulStrategiesToAdd": [],',
        '"unhelpfulStrategiesToAdd": [],',
        '"boundariesToAdd": [],',
        '},',
        '}'
      ].join('\n'),
      'Provider'
    );

    expect(response).toMatchObject({
      reply: 'Resposta.',
      riskLevel: 'none',
      scopeStatus: 'in_scope',
      profileUpdate: { shouldUpdate: false }
    });
  });

  it('rejects invalid canonical risk and scope values', () => {
    expect(() =>
      parseChatAgentResponse(
        JSON.stringify({
          reply: 'Resposta.',
          riskLevel: 'critical',
          scopeStatus: 'in_scope',
          profileUpdate: validProfileUpdate
        }),
        'Provider'
      )
    ).toThrow('Provider returned an invalid structured response');
  });
});
