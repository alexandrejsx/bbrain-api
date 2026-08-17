import { ContextBuilder } from './context-builder';

function user() {
  return {
    name: { value: 'Alexandre' },
    timezone: 'America/Sao_Paulo',
    profile: {
      profileCompleted: true,
      basicInfo: { preferredName: 'Alex', language: 'pt-BR' },
      goals: { mainGoals: ['organizar rotina'], otherGoal: undefined },
      conversationPreferences: { communicationStyle: 'balanced' },
      professionalContext: {
        hasFormalDiagnosis: 'yes',
        diagnoses: [{ condition: 'TDAH' }],
        isInTherapy: 'yes',
        hasPsychiatricFollowUp: 'no',
        usesMedicationWithProfessionalFollowUp: 'no'
      },
      privacySettings: {
        allowPersonalization: true,
        allowMemory: true,
        allowMoodInsights: true,
        allowSensitiveDataStorage: true
      }
    }
  };
}

describe('ContextBuilder', () => {
  it('centralizes profile, user-reported diagnosis, current context, relevant memory and recent window', async () => {
    const recentAt = new Date('2026-08-14T12:00:00Z');
    const builder = new ContextBuilder(
      { findById: jest.fn().mockResolvedValue(user()) } as never,
      {
        getRecent: jest
          .fn()
          .mockResolvedValue([
            { id: 'm1', role: 'user', content: 'Ainda estou preocupado.', createdAt: recentAt }
          ])
      } as never,
      {
        findByUserId: jest.fn().mockResolvedValue({
          summary: 'Lidando com um conflito recente no trabalho.',
          topics: ['trabalho', 'conflito'],
          pendingItems: ['conversa com a liderança']
        })
      } as never,
      {
        findRelevant: jest
          .fn()
          .mockResolvedValueOnce([
            {
              summary: 'Teve uma discussão no trabalho.',
              kind: 'event',
              topics: ['trabalho', 'conflito'],
              eventDate: recentAt
            }
          ])
          .mockResolvedValueOnce([
            {
              summary: 'Conflitos no trabalho têm sido recorrentes.',
              topics: ['trabalho', 'conflito'],
              evidenceCount: 2
            }
          ])
      } as never,
      {
        resolve: jest.fn().mockReturnValue({
          timezone: 'America/Sao_Paulo',
          allowPersonalization: true,
          allowMemory: true,
          allowMoodInsights: true,
          allowSensitiveDataStorage: true,
          canUseConversationData: true,
          canExtractWellbeing: true
        })
      }
    );

    const result = await builder.build('user-1', 'session-1', 'E sobre o trabalho?');

    expect(result.context.identity?.preferredName).toBe('Alex');
    expect(result.context.profile?.formalDiagnoses).toEqual([
      { condition: 'TDAH', source: 'user_reported_formal_diagnosis' }
    ]);
    expect(result.context.currentContext?.topics).toEqual(['trabalho', 'conflito']);
    expect(result.context.memories).toHaveLength(1);
    expect(result.context.patterns[0]?.evidenceCount).toBe(2);
    expect(result.context.recentMessages).toEqual([
      expect.objectContaining({
        content: 'Ainda estou preocupado.',
        createdAt: recentAt.toISOString()
      })
    ]);
  });

  it('does not load persisted conversational data without centralized consent', async () => {
    const sessions = { getRecent: jest.fn() };
    const contexts = { findByUserId: jest.fn() };
    const memories = { findRelevant: jest.fn() };
    const builder = new ContextBuilder(
      { findById: jest.fn().mockResolvedValue(user()) } as never,
      sessions as never,
      contexts as never,
      memories as never,
      {
        resolve: jest.fn().mockReturnValue({
          timezone: 'UTC',
          allowPersonalization: false,
          allowMemory: false,
          allowMoodInsights: false,
          allowSensitiveDataStorage: false,
          canUseConversationData: false,
          canExtractWellbeing: false
        })
      }
    );

    const result = await builder.build('user-1', 'session-1', 'Oi');

    expect(sessions.getRecent).not.toHaveBeenCalled();
    expect(contexts.findByUserId).not.toHaveBeenCalled();
    expect(memories.findRelevant).not.toHaveBeenCalled();
    expect(result.context.memories).toEqual([]);
    expect(result.context.profile).toBeUndefined();
  });
});
