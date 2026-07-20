import { ConversationScopePolicy } from '../../conversation/services/conversation-scope-policy.service';
import { ConversationStateUpdatePolicy } from '../../conversation/services/conversation-state-update-policy.service';
import { UsageLimitError } from '../../usage/services/usage.service';
import { ChatAgent } from '../../../use-cases/conversation/chat-agent.port';
import { ConversationLanguageService } from '../../../use-cases/conversation/conversation-language.service';
import { ConversationReplyCatalog } from '../../../use-cases/conversation/conversation-reply-catalog';
import { ConversationSafetyReplyPolicy } from '../../../use-cases/conversation/conversation-safety-reply.policy';
import {
  ChatProviderUnavailableError,
  ConversationMessageAlreadyProcessedError,
  ConversationMessageFingerprintConflictError,
  ConversationMessageInProgressError,
  SendChatMessageUseCase
} from '../../../use-cases/conversation/send-chat-message.use-case';

const noStateUpdate = {
  shouldUpdate: false,
  currentConcerns: [],
  userNeeds: [],
  supportContext: 'unknown' as const,
  safetyState: 'none' as const,
  pendingQuestionCode: 'none' as const,
  lastAssistantIntent: 'listen' as const
};

function createUseCase(input?: {
  chatAgent?: ChatAgent;
  usageService?: Record<string, jest.Mock>;
  contextBuilder?: { build: jest.Mock };
  ledgerClaim?: unknown;
}) {
  const usageService = {
    assertCanSendMessage: jest.fn().mockResolvedValue({
      usageId: 'usage-id',
      dailyTokenLimit: 30_000,
      dailyMessageLimit: 20
    }),
    registerReservedLlmUsage: jest.fn().mockResolvedValue(undefined),
    releaseMessageReservation: jest.fn().mockResolvedValue(undefined),
    ...input?.usageService
  };
  const chatAgent =
    input?.chatAgent ??
    ({
      respond: jest.fn().mockResolvedValue({
        reply: 'Resposta acolhedora',
        riskLevel: 'none',
        scopeStatus: 'in_scope',
        conversationStateUpdate: noStateUpdate,
        usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 }
      })
    } satisfies ChatAgent);
  const contextBuilder =
    input?.contextBuilder ??
    ({
      build: jest.fn().mockResolvedValue({
        profileConfigured: true,
        dataPolicy: {
          timezone: 'UTC',
          allowPersonalization: true,
          allowMemory: true,
          allowMoodInsights: true,
          allowSensitiveDataStorage: true
        },
        context: {
          userIdentityContext: { preferredLanguage: 'pt-BR' },
          userProfileSummary: {}
        }
      })
    } as const);
  const stateRepository = {
    save: jest.fn().mockResolvedValue(true),
    deleteByConversation: jest.fn().mockResolvedValue(undefined)
  };
  const exchangeLedger = {
    claim: jest
      .fn()
      .mockResolvedValue(input?.ledgerClaim ?? { status: 'claimed', claimId: 'claim-id' }),
    complete: jest.fn().mockResolvedValue(true),
    release: jest.fn().mockResolvedValue(undefined)
  };
  const fingerprint = { fingerprint: jest.fn().mockReturnValue('f'.repeat(64)) };
  const eventDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
  const wellbeingCapture = { schedule: jest.fn() };

  return {
    useCase: new SendChatMessageUseCase(
      chatAgent,
      new ConversationScopePolicy(),
      contextBuilder,
      stateRepository as never,
      new ConversationStateUpdatePolicy(),
      exchangeLedger as never,
      fingerprint,
      usageService as never,
      eventDispatcher,
      new ConversationLanguageService(),
      new ConversationReplyCatalog(),
      new ConversationSafetyReplyPolicy(),
      24,
      wellbeingCapture as never
    ),
    chatAgent,
    usageService,
    contextBuilder,
    stateRepository,
    exchangeLedger,
    fingerprint,
    eventDispatcher,
    wellbeingCapture
  };
}

describe('SendChatMessageUseCase state-only flow', () => {
  it('calls the provider without writing literal user or assistant messages', async () => {
    const setup = createUseCase();

    const result = await setup.useCase.execute({
      userId: 'user-id',
      conversationId: 'conversation-id',
      clientMessageId: 'message-id',
      message: 'Dormi pouco.'
    });

    expect(result.reply).toBe('Resposta acolhedora');
    expect(setup.exchangeLedger.claim).toHaveBeenCalledWith(
      expect.objectContaining({ requestFingerprint: 'f'.repeat(64) })
    );
    expect(setup.exchangeLedger.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        conversationId: 'conversation-id',
        sourceMessageId: 'message-id',
        riskLevel: 'none',
        scopeStatus: 'in_scope'
      })
    );
    expect(JSON.stringify(setup.exchangeLedger.complete.mock.calls)).not.toContain('Dormi pouco.');
    expect(JSON.stringify(setup.exchangeLedger.complete.mock.calls)).not.toContain(
      'Resposta acolhedora'
    );
  });

  it('persists only a validated ephemeral state with TTL semantics', async () => {
    const chatAgent = {
      respond: jest.fn().mockResolvedValue({
        reply: 'Obrigado por contar. Você sente que pode agir de modo a colocar alguém em risco?',
        riskLevel: 'medium',
        scopeStatus: 'in_scope',
        conversationStateUpdate: {
          shouldUpdate: true,
          currentTopic: 'sono e sobrecarga de trabalho',
          currentConcerns: ['dificuldade com controle de impulsos'],
          userNeeds: ['apoio humano'],
          supportContext: 'none_reported',
          safetyState: 'needs_check',
          pendingQuestionCode: 'immediate_safety',
          lastAssistantIntent: 'check_immediate_safety'
        },
        usage: { inputTokens: 5, outputTokens: 8, totalTokens: 13 }
      })
    } satisfies ChatAgent;
    const setup = createUseCase({ chatAgent });

    await setup.useCase.execute({
      userId: 'user-id',
      conversationId: 'conversation-id',
      clientMessageId: 'message-id',
      message: 'Não tenho ninguém por perto.'
    });

    expect(setup.stateRepository.save).toHaveBeenCalledTimes(1);
    const state = setup.stateRepository.save.mock.calls[0][0];
    expect(state.toSnapshot()).toEqual(
      expect.objectContaining({
        supportContext: 'none_reported',
        safetyState: 'needs_check',
        pendingQuestionCode: 'immediate_safety'
      })
    );
    expect(state.expiresAt.getTime()).toBeGreaterThan(state.toJson().updatedAt.getTime());
    expect(JSON.stringify(state.toJson())).not.toContain('Não tenho ninguém por perto.');
  });

  it('rejects model state containing a clinical label or copied passage', async () => {
    const chatAgent = {
      respond: jest.fn().mockResolvedValue({
        reply: 'Não consigo confirmar um diagnóstico.',
        riskLevel: 'low',
        scopeStatus: 'in_scope',
        conversationStateUpdate: {
          shouldUpdate: true,
          currentTopic: 'mania',
          currentConcerns: ['creio que esteja em mania'],
          userNeeds: [],
          supportContext: 'unknown',
          safetyState: 'none',
          pendingQuestionCode: 'clarification',
          lastAssistantIntent: 'listen'
        },
        usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 }
      })
    } satisfies ChatAgent;
    const setup = createUseCase({ chatAgent });

    await setup.useCase.execute({
      userId: 'user-id',
      conversationId: 'conversation-id',
      message: 'creio que esteja em mania'
    });

    const state = setup.stateRepository.save.mock.calls[0][0];
    expect(JSON.stringify(state.toJson())).not.toMatch(/mania|maníac/iu);
    expect(state.toSnapshot().currentTopic).toBe('mudanças percebidas na rotina');
  });

  it('deletes previous state and disables capture when sensitive storage is denied', async () => {
    const contextBuilder = {
      build: jest.fn().mockResolvedValue({
        profileConfigured: true,
        dataPolicy: {
          timezone: 'UTC',
          allowPersonalization: true,
          allowMemory: true,
          allowMoodInsights: true,
          allowSensitiveDataStorage: false
        },
        context: { userProfileSummary: {} }
      })
    };
    const setup = createUseCase({ contextBuilder });

    await setup.useCase.execute({
      userId: 'user-id',
      conversationId: 'conversation-id',
      clientMessageId: 'message-id',
      message: 'Hoje foi difícil.'
    });

    expect(setup.stateRepository.deleteByConversation).toHaveBeenCalledWith(
      'user-id',
      'conversation-id'
    );
    expect(setup.stateRepository.save).not.toHaveBeenCalled();
    expect(setup.wellbeingCapture.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ allowAutomaticCapture: false })
    );
  });

  it.each([
    [{ status: 'already_completed' }, ConversationMessageAlreadyProcessedError],
    [{ status: 'in_progress' }, ConversationMessageInProgressError],
    [{ status: 'fingerprint_conflict' }, ConversationMessageFingerprintConflictError]
  ])('does not call the provider for ledger result %o', async (ledgerClaim, expectedError) => {
    const setup = createUseCase({ ledgerClaim });

    await expect(
      setup.useCase.execute({
        userId: 'user-id',
        conversationId: 'conversation-id',
        clientMessageId: 'message-id',
        message: 'Oi'
      })
    ).rejects.toBeInstanceOf(expectedError);
    expect(setup.chatAgent.respond).not.toHaveBeenCalled();
    expect(setup.usageService.assertCanSendMessage).not.toHaveBeenCalled();
  });

  it('releases usage and the processing claim when the provider fails', async () => {
    const setup = createUseCase({
      chatAgent: { respond: jest.fn().mockRejectedValue(new Error('provider failed')) }
    });

    await expect(
      setup.useCase.execute({
        userId: 'user-id',
        conversationId: 'conversation-id',
        clientMessageId: 'message-id',
        message: 'Oi'
      })
    ).rejects.toBeInstanceOf(ChatProviderUnavailableError);
    expect(setup.usageService.releaseMessageReservation).toHaveBeenCalled();
    expect(setup.exchangeLedger.release).toHaveBeenCalledWith(
      'user-id',
      'conversation-id',
      'message-id',
      'claim-id'
    );
  });

  it('releases a claim if usage limits block the message', async () => {
    const usageError = new UsageLimitError(
      'USAGE_MESSAGE_LIMIT_REACHED',
      'Você chegou ao limite diário de mensagens do seu plano.'
    );
    const setup = createUseCase({
      usageService: { assertCanSendMessage: jest.fn().mockRejectedValue(usageError) }
    });

    await expect(
      setup.useCase.execute({
        userId: 'user-id',
        conversationId: 'conversation-id',
        clientMessageId: 'message-id',
        message: 'Oi'
      })
    ).rejects.toBe(usageError);
    expect(setup.exchangeLedger.release).toHaveBeenCalled();
    expect(setup.chatAgent.respond).not.toHaveBeenCalled();
  });

  it('overrides the observed exclusivity flow with a direct safety check', async () => {
    const contextBuilder = {
      build: jest.fn().mockResolvedValue({
        profileConfigured: true,
        dataPolicy: {
          timezone: 'UTC',
          allowPersonalization: true,
          allowMemory: true,
          allowMoodInsights: true,
          allowSensitiveDataStorage: true
        },
        context: {
          userProfileSummary: {},
          conversationState: {
            currentTopic: 'sono e trabalho',
            currentConcerns: ['dificuldade com controle de impulsos'],
            userNeeds: [],
            supportContext: 'unknown',
            safetyState: 'needs_check',
            pendingQuestionCode: 'human_support_available',
            lastAssistantIntent: 'check_human_support'
          }
        }
      })
    };
    const unsafeAgent = {
      respond: jest.fn().mockResolvedValue({
        reply: 'Como estamos sozinhos nessa, podemos pensar juntos.',
        riskLevel: 'none',
        scopeStatus: 'in_scope',
        conversationStateUpdate: noStateUpdate,
        usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 }
      })
    } satisfies ChatAgent;
    const setup = createUseCase({ chatAgent: unsafeAgent, contextBuilder });

    const result = await setup.useCase.execute({
      userId: 'user-id',
      conversationId: 'conversation-id',
      message: 'somente você'
    });

    expect(result.reply).toContain('Não quero ser seu único apoio.');
    expect(result.reply).toContain('coloque você ou outra pessoa em risco?');
    expect(result.reply).not.toContain('estamos sozinhos nessa');
    expect(result.riskLevel).toBe('medium');
  });

  it('does not let a provider confirm a self-reported clinical label', async () => {
    const unsafeAgent = {
      respond: jest.fn().mockResolvedValue({
        reply: 'Entendo que você está em mania e com energia elevada.',
        riskLevel: 'none',
        scopeStatus: 'in_scope',
        conversationStateUpdate: noStateUpdate,
        usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 }
      })
    } satisfies ChatAgent;
    const setup = createUseCase({ chatAgent: unsafeAgent });

    const result = await setup.useCase.execute({
      userId: 'user-id',
      conversationId: 'conversation-id',
      message: 'creio que esteja em mania'
    });

    expect(result.reply).toContain('não consigo confirmar se isso é mania');
    expect(result.reply).not.toContain('energia elevada');
    const state = setup.stateRepository.save.mock.calls[0][0];
    expect(JSON.stringify(state.toJson())).not.toMatch(/mania|maníac/iu);
  });

  it('also catches self-label wording with "estar em mania"', async () => {
    const unsafeAgent = {
      respond: jest.fn().mockResolvedValue({
        reply: 'Isso acontece porque você está em mania.',
        riskLevel: 'none',
        scopeStatus: 'in_scope',
        conversationStateUpdate: noStateUpdate,
        usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 }
      })
    } satisfies ChatAgent;
    const setup = createUseCase({ chatAgent: unsafeAgent });

    const result = await setup.useCase.execute({
      userId: 'user-id',
      conversationId: 'conversation-id',
      message: 'controlar impulsividade, dado ao fato de estar em mania'
    });

    expect(result.reply).toContain('não consigo confirmar se isso é mania');
    expect(result.reply).not.toContain('você está em mania');
    expect(result.riskLevel).toBe('medium');
    const state = setup.stateRepository.save.mock.calls[0][0];
    expect(state.toSnapshot()).toEqual(
      expect.objectContaining({
        currentConcerns: ['controle de impulsos'],
        safetyState: 'needs_check',
        pendingQuestionCode: 'immediate_safety'
      })
    );
  });

  it('advances a short negative safety answer to the human support check', async () => {
    const contextBuilder = {
      build: jest.fn().mockResolvedValue({
        profileConfigured: true,
        dataPolicy: {
          timezone: 'UTC',
          allowPersonalization: true,
          allowMemory: true,
          allowMoodInsights: true,
          allowSensitiveDataStorage: true
        },
        context: {
          userProfileSummary: {},
          conversationState: {
            currentTopic: 'sono e trabalho',
            currentConcerns: ['controle de impulsos'],
            userNeeds: [],
            supportContext: 'unknown',
            safetyState: 'needs_check',
            pendingQuestionCode: 'immediate_safety',
            lastAssistantIntent: 'check_immediate_safety'
          }
        }
      })
    };
    const setup = createUseCase({ contextBuilder });

    const result = await setup.useCase.execute({
      userId: 'user-id',
      conversationId: 'conversation-id',
      message: 'nada'
    });

    expect(result.reply).toContain('não percebe um risco imediato');
    expect(result.reply).toContain('alguém de confiança');
    expect(result.riskLevel).toBe('low');
    const state = setup.stateRepository.save.mock.calls[0][0];
    expect(state.toSnapshot()).toEqual(
      expect.objectContaining({
        safetyState: 'none',
        pendingQuestionCode: 'human_support_available'
      })
    );
  });

  it('applies the dependency boundary even without previous state', async () => {
    const setup = createUseCase();

    const result = await setup.useCase.execute({
      userId: 'user-id',
      conversationId: 'conversation-id',
      message: 'somente você'
    });

    expect(result.reply).toContain('não devo ser seu único apoio');
    expect(result.reply).toContain('alguém de confiança');
    expect(result.riskLevel).toBe('low');
  });
});
