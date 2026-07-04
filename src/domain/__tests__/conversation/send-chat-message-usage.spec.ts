import { ReflectiveProfile } from '../../conversation/entities/reflective-profile.entity';
import { ConversationScopePolicy } from '../../conversation/services/conversation-scope-policy.service';
import { UsageLimitError } from '../../usage/services/usage.service';
import { ChatAgent } from '../../../use-cases/conversation/chat-agent.port';
import { ConversationLanguageService } from '../../../use-cases/conversation/conversation-language.service';
import { ConversationReplyCatalog } from '../../../use-cases/conversation/conversation-reply-catalog';
import { ConversationMessageHistoryPort } from '../../../use-cases/conversation/ports/conversation-message-history.port';
import { ProfileUpdateService } from '../../../use-cases/conversation/profile-update.service';
import { SendChatMessageUseCase } from '../../../use-cases/conversation/send-chat-message.use-case';

function createUseCase(input?: {
  usageService?: {
    assertCanSendMessage: jest.Mock;
    registerLlmUsage: jest.Mock;
  };
  chatAgent?: ChatAgent;
  contextBuilder?: {
    build: jest.Mock;
  };
}) {
  const profile = ReflectiveProfile.create('user-id', new Date('2026-01-01T00:00:00.000Z'));
  const scopePolicy = new ConversationScopePolicy();
  const usageService = input?.usageService ?? {
    assertCanSendMessage: jest.fn().mockResolvedValue(undefined),
    registerLlmUsage: jest.fn().mockResolvedValue(undefined)
  };
  const chatAgent =
    input?.chatAgent ??
    ({
      respond: jest.fn().mockResolvedValue({
        reply: 'Resposta acolhedora',
        riskLevel: 'none',
        scopeStatus: 'in_scope',
        profileUpdate: { shouldUpdate: false },
        usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 }
      })
    } satisfies ChatAgent);
  const contextBuilder =
    input?.contextBuilder ??
    ({
      build: jest.fn().mockResolvedValue({
        profileConfigured: true,
        sourceProfile: profile,
        context: {
          userIdentityContext: { preferredLanguage: 'pt-BR' },
          userProfileSummary: {},
          recentMessages: []
        }
      })
    } as const);
  const profileRepository = {
    save: jest.fn().mockResolvedValue(undefined)
  };
  const messageRepository = {
    appendExchange: jest.fn().mockResolvedValue(undefined)
  };
  const eventDispatcher = {
    dispatch: jest.fn().mockResolvedValue(undefined)
  };

  return {
    useCase: new SendChatMessageUseCase(
      profileRepository as never,
      chatAgent,
      scopePolicy,
      contextBuilder,
      new ProfileUpdateService(scopePolicy),
      messageRepository as unknown as ConversationMessageHistoryPort,
      usageService as never,
      eventDispatcher,
      new ConversationLanguageService(),
      new ConversationReplyCatalog()
    ),
    usageService,
    chatAgent,
    contextBuilder,
    profileRepository,
    messageRepository,
    eventDispatcher
  };
}

describe('SendChatMessageUseCase usage flow', () => {
  it('asserts usage before calling the LLM', async () => {
    const order: string[] = [];
    const usageService = {
      assertCanSendMessage: jest.fn().mockImplementation(() => {
        order.push('assert');
        return Promise.resolve();
      }),
      registerLlmUsage: jest.fn().mockResolvedValue(undefined)
    };
    const chatAgent = {
      respond: jest.fn().mockImplementation(() => {
        order.push('llm');
        return Promise.resolve({
          reply: 'Resposta acolhedora',
          riskLevel: 'none',
          scopeStatus: 'in_scope',
          profileUpdate: { shouldUpdate: false },
          usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 }
        });
      })
    } satisfies ChatAgent;
    const { useCase } = createUseCase({ usageService, chatAgent });

    await useCase.execute({ userId: 'user-id', message: 'Oi' });

    expect(order).toEqual(['assert', 'llm']);
  });

  it('registers LLM usage after a successful response', async () => {
    const { useCase, usageService, eventDispatcher, profileRepository, messageRepository } =
      createUseCase();

    await useCase.execute({ userId: 'user-id', conversationId: 'conversation-id', message: 'Oi' });

    expect(profileRepository.save).toHaveBeenCalledTimes(1);
    expect(messageRepository.appendExchange).toHaveBeenCalledWith(
      'user-id',
      'conversation-id',
      'Oi',
      'Resposta acolhedora',
      expect.any(Date)
    );
    expect(usageService.registerLlmUsage).toHaveBeenCalledWith('user-id', {
      inputTokens: 3,
      outputTokens: 4,
      totalTokens: 7
    });
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith([
      expect.objectContaining({
        aggregateId: 'conversation-id',
        name: 'conversation.message.received'
      }),
      expect.objectContaining({
        aggregateId: 'conversation-id',
        name: 'conversation.assistant-response.produced'
      })
    ]);
  });

  it('loads recent conversation context when conversationId is provided', async () => {
    const { useCase, contextBuilder, chatAgent } = createUseCase();

    await useCase.execute({
      userId: 'user-id',
      conversationId: 'conversation-id',
      message: 'os dois'
    });

    expect(contextBuilder.build).toHaveBeenCalledWith('user-id', 'conversation-id');
    expect(chatAgent.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          recentMessages: []
        })
      })
    );
  });

  it('behaves statelessly when conversationId is absent', async () => {
    const { useCase, contextBuilder } = createUseCase();

    await useCase.execute({
      userId: 'user-id',
      message: 'os dois'
    });

    expect(contextBuilder.build).toHaveBeenCalledWith('user-id', undefined);
  });

  it('does not call the LLM when the user is blocked by usage limits', async () => {
    const usageService = {
      assertCanSendMessage: jest
        .fn()
        .mockRejectedValue(
          new UsageLimitError(
            'USAGE_MESSAGE_LIMIT_REACHED',
            'Você chegou ao limite diário de mensagens do seu plano.'
          )
        ),
      registerLlmUsage: jest.fn().mockResolvedValue(undefined)
    };
    const chatAgent = {
      respond: jest.fn()
    } satisfies ChatAgent;
    const { useCase } = createUseCase({ usageService, chatAgent });

    await expect(useCase.execute({ userId: 'user-id', message: 'Oi' })).rejects.toMatchObject({
      code: 'USAGE_MESSAGE_LIMIT_REACHED'
    });
    expect(chatAgent.respond).not.toHaveBeenCalled();
    expect(usageService.registerLlmUsage).not.toHaveBeenCalled();
  });

  it('keeps riskLevel from the ChatAgent in the normal flow', async () => {
    const chatAgent = {
      respond: jest.fn().mockResolvedValue({
        reply: 'Resposta de alto risco vinda do agente',
        riskLevel: 'high',
        scopeStatus: 'in_scope',
        profileUpdate: { shouldUpdate: false },
        usage: { inputTokens: 5, outputTokens: 6, totalTokens: 11 }
      })
    } satisfies ChatAgent;
    const { useCase } = createUseCase({ chatAgent });

    const result = await useCase.execute({
      userId: 'user-id',
      message: 'quero me matar',
      acceptedLanguage: 'pt-BR'
    });

    expect(result.riskLevel).toBe('high');
  });

  it('keeps the response language in pt-BR when the profile is pt-BR even if the message is in English', async () => {
    const chatAgent = {
      respond: jest.fn().mockResolvedValue({
        reply: 'Resposta acolhedora',
        riskLevel: 'none',
        scopeStatus: 'in_scope',
        profileUpdate: { shouldUpdate: false },
        usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 }
      })
    } satisfies ChatAgent;
    const { useCase } = createUseCase({ chatAgent });

    await useCase.execute({
      userId: 'user-id',
      message: 'I feel overwhelmed today',
      acceptedLanguage: 'en-US'
    });

    expect(chatAgent.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredLanguage: 'pt-BR',
        responseLanguage: 'pt-BR'
      })
    );
  });

  it('keeps the response language in en-US when the profile is en-US even if the message is in Portuguese', async () => {
    const chatAgent = {
      respond: jest.fn().mockResolvedValue({
        reply: 'Supportive reply',
        riskLevel: 'none',
        scopeStatus: 'in_scope',
        profileUpdate: { shouldUpdate: false },
        usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 }
      })
    } satisfies ChatAgent;
    const contextBuilder = {
      build: jest.fn().mockResolvedValue({
        profileConfigured: true,
        sourceProfile: ReflectiveProfile.create('user-id', new Date('2026-01-01T00:00:00.000Z')),
        context: {
          userIdentityContext: { preferredLanguage: 'en-US' },
          userProfileSummary: {},
          recentMessages: []
        }
      })
    };
    const { useCase } = createUseCase({ chatAgent, contextBuilder });

    await useCase.execute({
      userId: 'user-id',
      message: 'estou sobrecarregado hoje',
      acceptedLanguage: 'pt-BR'
    });

    expect(chatAgent.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredLanguage: 'en-US',
        responseLanguage: 'en-US'
      })
    );
  });

  it('propagates UsageLimitError when usage is blocked', async () => {
    const usageError = new UsageLimitError(
      'USAGE_MESSAGE_LIMIT_REACHED',
      'Você chegou ao limite diário de mensagens do seu plano.'
    );
    const usageService = {
      assertCanSendMessage: jest.fn().mockRejectedValue(usageError),
      registerLlmUsage: jest.fn().mockResolvedValue(undefined)
    };
    const { useCase, chatAgent } = createUseCase({ usageService });

    await expect(
      useCase.execute({ userId: 'user-id', message: 'hoje foi dificil', acceptedLanguage: 'pt-BR' })
    ).rejects.toBe(usageError);
    expect(chatAgent.respond).not.toHaveBeenCalled();
  });

  it('dispatches a policy violation event when the agent marks the reply as out of scope', async () => {
    const chatAgent = {
      respond: jest.fn().mockResolvedValue({
        reply: 'Nao posso ajudar com isso, mas podemos falar do que isso desperta em voce.',
        riskLevel: 'none',
        scopeStatus: 'out_of_scope',
        profileUpdate: { shouldUpdate: false },
        usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 }
      })
    } satisfies ChatAgent;
    const { useCase, eventDispatcher } = createUseCase({ chatAgent });

    await useCase.execute({
      userId: 'user-id',
      conversationId: 'conversation-id',
      message: 'faça meu trabalho'
    });

    expect(eventDispatcher.dispatch).toHaveBeenCalledWith([
      expect.objectContaining({
        aggregateId: 'conversation-id',
        name: 'conversation.message.received'
      }),
      expect.objectContaining({
        aggregateId: 'conversation-id',
        name: 'conversation.assistant-response.produced'
      }),
      expect.objectContaining({
        aggregateId: 'conversation-id',
        name: 'conversation.policy.violated'
      })
    ]);
  });
});
