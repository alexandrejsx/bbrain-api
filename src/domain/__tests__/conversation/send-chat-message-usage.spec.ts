import { ReflectiveProfile } from '../../conversation/entities/reflective-profile.entity';
import { ConversationScopePolicy } from '../../conversation/services/conversation-scope-policy.service';
import { UsageLimitError } from '../../usage/services/usage.service';
import { AIContextService } from '../../../modules/ai-context/ai-context.service';
import { AIContextMessageRepository } from '../../../modules/ai-context/ai-context-message.repository';
import { ChatAgent } from '../../../use-cases/conversation/chat-agent.port';
import { ProfileUpdateService } from '../../../use-cases/conversation/profile-update.service';
import { SendChatMessageUseCase } from '../../../use-cases/conversation/send-chat-message.use-case';

function createUseCase(input?: {
  usageService?: {
    assertCanSendMessage: jest.Mock;
    registerLlmUsage: jest.Mock;
  };
  chatAgent?: ChatAgent;
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
  const aiContextService = {
    build: jest.fn().mockResolvedValue({
      profileConfigured: true,
      sourceProfile: profile,
      context: {
        userProfileSummary: {},
        recentMessages: []
      }
    })
  };
  const profileRepository = {
    save: jest.fn().mockResolvedValue(undefined)
  };
  const messageRepository = {
    appendExchange: jest.fn().mockResolvedValue(undefined)
  };

  return {
    useCase: new SendChatMessageUseCase(
      profileRepository as never,
      chatAgent,
      scopePolicy,
      aiContextService as unknown as AIContextService,
      new ProfileUpdateService(scopePolicy),
      messageRepository as unknown as AIContextMessageRepository,
      usageService as never
    ),
    usageService,
    chatAgent,
    messageRepository
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
    const { useCase, usageService } = createUseCase();

    await useCase.execute({ userId: 'user-id', conversationId: 'conversation-id', message: 'Oi' });

    expect(usageService.registerLlmUsage).toHaveBeenCalledWith('user-id', {
      inputTokens: 3,
      outputTokens: 4,
      totalTokens: 7
    });
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
});
