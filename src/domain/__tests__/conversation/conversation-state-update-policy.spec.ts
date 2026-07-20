import { ConversationStateUpdatePolicy } from '../../conversation/services/conversation-state-update-policy.service';
import { ConversationStateSchema } from '../../../infrastructure/database/mongodb/schemas/conversation-state.schema';
import { ConversationExchangeLedgerSchema } from '../../../infrastructure/database/mongodb/schemas/conversation-exchange-ledger.schema';

const baseProposal = {
  shouldUpdate: true,
  currentTopic: 'sono e sobrecarga de trabalho',
  currentConcerns: ['dificuldade com controle de impulsos'],
  userNeeds: ['apoio humano'],
  supportContext: 'none_reported' as const,
  safetyState: 'needs_check' as const,
  pendingQuestionCode: 'immediate_safety' as const,
  lastAssistantIntent: 'check_immediate_safety' as const
};

describe('ConversationStateUpdatePolicy', () => {
  it('creates a short-lived non-clinical snapshot', () => {
    const policy = new ConversationStateUpdatePolicy();
    const now = new Date('2026-07-20T10:00:00.000Z');

    const result = policy.buildNext(
      'user-id',
      'conversation-id',
      null,
      baseProposal,
      'somente você',
      'Não quero ser seu único apoio. Você está em risco agora?',
      now,
      24
    );

    expect(result?.expectedRevision).toBe(0);
    expect(result?.state.toSnapshot()).toEqual({
      currentTopic: 'sono e sobrecarga de trabalho',
      currentConcerns: ['dificuldade com controle de impulsos'],
      userNeeds: ['apoio humano'],
      supportContext: 'none_reported',
      safetyState: 'needs_check',
      pendingQuestionCode: 'immediate_safety',
      lastAssistantIntent: 'check_immediate_safety'
    });
    expect(result?.state.expiresAt.toISOString()).toBe('2026-07-21T10:00:00.000Z');
  });

  it.each([
    [{ ...baseProposal, currentTopic: 'mania' }, 'creio que esteja em mania'],
    [
      { ...baseProposal, currentConcerns: ['controlar impulsividade, no momento'] },
      'controlar impulsividade, no momento dado ao fato de estar em mania'
    ]
  ])('rejects clinical labels and copied passages', (proposal, currentMessage) => {
    const policy = new ConversationStateUpdatePolicy();

    expect(
      policy.buildNext(
        'user-id',
        'conversation-id',
        null,
        proposal,
        currentMessage,
        'Resposta segura.',
        new Date('2026-07-20T10:00:00.000Z'),
        24
      )
    ).toBeUndefined();
  });

  it('declares TTL indexes and no transcript content field in active schemas', () => {
    expect(ConversationStateSchema.indexes()).toEqual(
      expect.arrayContaining([
        [{ expires_at: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })]
      ])
    );
    expect(ConversationExchangeLedgerSchema.indexes()).toEqual(
      expect.arrayContaining([
        [{ expires_at: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })]
      ])
    );
    expect(ConversationStateSchema.path('content')).toBeUndefined();
    expect(ConversationExchangeLedgerSchema.path('content')).toBeUndefined();
  });
});
