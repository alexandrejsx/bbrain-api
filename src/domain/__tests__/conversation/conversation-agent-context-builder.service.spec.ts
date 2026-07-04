import { ReflectiveProfile } from '../../conversation/entities/reflective-profile.entity';
import { ConversationAgentContextBuilderService } from '../../../use-cases/conversation/conversation-agent-context-builder.service';

describe('ConversationAgentContextBuilderService', () => {
  it('builds canonical agent context without prompt instructions', async () => {
    const profile = ReflectiveProfile.create('user-id', new Date('2026-01-01T00:00:00.000Z'));
    profile.configureFromSetup({
      preferredTone: 'direct',
      analysisGoals: ['organizar rotina'],
      reportedFormalDiagnoses: ['TDAH'],
      reportedMedication: 'Medicação com acompanhamento profissional: sim.',
      professionalSupport: 'Terapia atualmente: sim'
    });
    profile.applyUpdate({
      currentContextSummary: 'Semana com sobrecarga no trabalho.',
      recurringThemesToAdd: ['trabalho'],
      emotionalPatternsToAdd: ['sobrecarga'],
      routineNotesToAdd: ['dorme tarde'],
      helpfulStrategiesToAdd: ['pausas curtas'],
      unhelpfulStrategiesToAdd: ['adiar descanso'],
      boundariesToAdd: ['prefere respostas curtas']
    });

    const userRepository = {
      findById: jest.fn().mockResolvedValue({
        name: { value: 'Nome completo' },
        profile: { basicInfo: { preferredName: 'Alex', language: 'en-US', sex: 'male' } }
      })
    };
    const profileRepository = {
      findByUserId: jest.fn().mockResolvedValue(profile)
    };
    const messageHistory = {
      findRecent: jest.fn().mockResolvedValue([
        { role: 'user', content: 'Oi' },
        { role: 'assistant', content: 'Estou aqui.' }
      ])
    };
    const service = new ConversationAgentContextBuilderService(
      userRepository as never,
      profileRepository as never,
      messageHistory as never
    );

    const result = await service.build('user-id', 'conversation-id');

    expect(result.profileConfigured).toBe(true);
    expect(result.sourceProfile).toBe(profile);
    expect(result.context).toMatchObject({
      userIdentityContext: {
        displayName: 'Alex',
        preferredLanguage: 'en-US'
      },
      userProfileSummary: {
        goals: ['organizar rotina'],
        recurringThemes: ['trabalho'],
        emotionalPatterns: ['sobrecarga'],
        routineSummary: 'dorme tarde',
        helpfulStrategies: ['pausas curtas'],
        unhelpfulStrategies: ['adiar descanso'],
        declaredLimits: ['prefere respostas curtas'],
        reportedFormalDiagnoses: ['TDAH'],
        reportedMedication: 'Medicação com acompanhamento profissional: sim.',
        professionalSupport: 'Terapia atualmente: sim'
      },
      conversationStyle: { preferredTone: 'direct' },
      conversationSummary: 'Semana com sobrecarga no trabalho.',
      recentMessages: [
        { role: 'user', content: 'Oi' },
        { role: 'assistant', content: 'Estou aqui.' }
      ]
    });
    expect(result.context.conversationStyle).not.toHaveProperty('instructions');
    expect(result.context.userIdentityContext).not.toHaveProperty('sex');
    expect(messageHistory.findRecent).toHaveBeenCalledWith('user-id', 'conversation-id', 20);
  });

  it('returns a profile setup context when the reflective profile is missing', async () => {
    const messageHistory = { findRecent: jest.fn().mockResolvedValue([]) };
    const service = new ConversationAgentContextBuilderService(
      {
        findById: jest.fn().mockResolvedValue({
          name: { value: 'Nome completo' },
          profile: { basicInfo: { language: 'pt-BR' } }
        })
      } as never,
      { findByUserId: jest.fn().mockResolvedValue(null) } as never,
      messageHistory as never
    );

    const result = await service.build('user-id');

    expect(result).toEqual({
      profileConfigured: false,
      context: {
        userIdentityContext: {
          displayName: 'Nome completo',
          preferredLanguage: 'pt-BR'
        },
        userProfileSummary: {},
        recentMessages: []
      }
    });
    expect(messageHistory.findRecent).not.toHaveBeenCalled();
  });

  it('preserves recent messages in chronological order for short-reply continuity', async () => {
    const recentMessages = [
      {
        role: 'assistant',
        content: 'Voce sente que esse cansaco parece mais fisico ou emocional?'
      },
      { role: 'user', content: 'os dois' },
      {
        role: 'assistant',
        content: 'Entendi. O que voce sente que mais contribuiu para isso hoje?'
      }
    ];
    const service = new ConversationAgentContextBuilderService(
      {
        findById: jest.fn().mockResolvedValue({
          name: { value: 'Nome completo' },
          profile: { basicInfo: { language: 'pt-BR' } }
        })
      } as never,
      {
        findByUserId: jest
          .fn()
          .mockResolvedValue(
            ReflectiveProfile.create('user-id', new Date('2026-01-01T00:00:00.000Z'))
          )
      } as never,
      { findRecent: jest.fn().mockResolvedValue(recentMessages) } as never
    );

    const result = await service.build('user-id', 'conversation-id');

    expect(result.context.recentMessages).toEqual(recentMessages);
  });
});
