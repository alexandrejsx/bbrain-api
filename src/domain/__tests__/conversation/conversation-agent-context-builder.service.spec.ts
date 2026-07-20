import { ConversationState } from '../../conversation/entities/conversation-state.entity';
import { ReflectiveProfile } from '../../conversation/entities/reflective-profile.entity';
import { buildUserContextMessage } from '../../../infrastructure/chat/prompt-rendering/bbrain-chat-prompt.renderer';
import { ConversationAgentContextBuilderService } from '../../../use-cases/conversation/conversation-agent-context-builder.service';

const activeState = () =>
  ConversationState.create(
    { userId: 'user-id', conversationId: 'conversation-id' },
    {
      currentTopic: 'sono e sobrecarga de trabalho',
      currentConcerns: ['controle de impulsos'],
      userNeeds: ['apoio humano'],
      supportContext: 'none_reported',
      safetyState: 'needs_check',
      pendingQuestionCode: 'immediate_safety',
      lastAssistantIntent: 'check_immediate_safety'
    },
    new Date('2026-07-20T10:00:00.000Z'),
    new Date('2026-07-21T10:00:00.000Z')
  );

describe('ConversationAgentContextBuilderService', () => {
  it('builds context from an active structured state without loading transcript messages', async () => {
    const profile = ReflectiveProfile.create('user-id', new Date('2026-01-01T00:00:00.000Z'));
    profile.configureFromSetup({ preferredTone: 'direct', analysisGoals: ['organizar rotina'] });
    const state = activeState();
    const stateRepository = { findActive: jest.fn().mockResolvedValue(state) };
    const service = new ConversationAgentContextBuilderService(
      {
        findById: jest.fn().mockResolvedValue({
          name: { value: 'Nome completo' },
          timezone: 'America/Sao_Paulo',
          profile: {
            basicInfo: { preferredName: 'Alex', language: 'pt-BR' },
            privacySettings: {
              allowPersonalization: true,
              allowMemory: true,
              allowMoodInsights: true,
              allowSensitiveDataStorage: true
            }
          }
        })
      } as never,
      { findByUserId: jest.fn().mockResolvedValue(profile) } as never,
      stateRepository as never
    );

    const result = await service.build('user-id', 'conversation-id');

    expect(result.context.conversationState).toEqual(state.toSnapshot());
    expect(result.sourceConversationState).toBe(state);
    expect(stateRepository.findActive).toHaveBeenCalledWith('user-id', 'conversation-id');
    expect(result.context).not.toHaveProperty('recentMessages');
    expect(result.context).not.toHaveProperty('conversationSummary');
  });

  it('does not read structured sensitive state when privacy flags deny it', async () => {
    const profile = ReflectiveProfile.create('user-id');
    profile.configureFromSetup({
      preferredTone: 'reflective',
      analysisGoals: ['acompanhar humor']
    });
    const stateRepository = { findActive: jest.fn() };
    const service = new ConversationAgentContextBuilderService(
      {
        findById: jest.fn().mockResolvedValue({
          name: { value: 'Nome completo' },
          timezone: 'America/Sao_Paulo',
          profile: {
            basicInfo: { preferredName: 'Alex', language: 'pt-BR' },
            privacySettings: {
              allowPersonalization: false,
              allowMemory: false,
              allowMoodInsights: false,
              allowSensitiveDataStorage: false
            }
          }
        })
      } as never,
      { findByUserId: jest.fn().mockResolvedValue(profile) } as never,
      stateRepository as never
    );

    const result = await service.build('user-id', 'conversation-id');
    const rendered = buildUserContextMessage({
      message: 'mensagem atual',
      context: result.context,
      preferredLanguage: 'pt-BR',
      responseLanguage: 'pt-BR'
    });

    expect(stateRepository.findActive).not.toHaveBeenCalled();
    expect(result.context.conversationState).toBeUndefined();
    expect(result.context.userProfileSummary).toEqual({});
    expect(result.context.userIdentityContext).toEqual({ preferredLanguage: 'pt-BR' });
    expect(rendered.content).not.toContain('Alex');
  });

  it('returns the setup response context without reading state when no conversation id exists', async () => {
    const stateRepository = { findActive: jest.fn() };
    const service = new ConversationAgentContextBuilderService(
      {
        findById: jest.fn().mockResolvedValue({
          name: { value: 'Nome completo' },
          timezone: 'UTC',
          profile: { basicInfo: { language: 'pt-BR' } }
        })
      } as never,
      { findByUserId: jest.fn().mockResolvedValue(null) } as never,
      stateRepository as never
    );

    const result = await service.build('user-id');

    expect(result.profileConfigured).toBe(false);
    expect(result.context).toEqual({
      userIdentityContext: { displayName: 'Nome completo', preferredLanguage: 'pt-BR' },
      userProfileSummary: {},
      conversationState: undefined
    });
    expect(stateRepository.findActive).not.toHaveBeenCalled();
  });
});
