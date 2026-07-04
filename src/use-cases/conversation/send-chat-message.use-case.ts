import { EventDispatcher } from '../../domain/core/event-dispatcher';
import {
  AssistantResponseProducedEvent,
  ConversationPolicyViolatedEvent,
  MessageReceivedEvent
} from '../../domain/conversation/events/conversation.events';
import { ReflectiveProfileRepository } from '../../domain/conversation/repositories/reflective-profile.repository';
import {
  ConversationScopePolicy,
  ConversationScopeStatus
} from '../../domain/conversation/services/conversation-scope-policy.service';
import { UsageService } from '../../domain/usage/services/usage.service';
import { ChatAgent, ChatRiskLevel } from './chat-agent.port';
import { ConversationLanguageService } from './conversation-language.service';
import { ConversationReplyCatalog } from './conversation-reply-catalog';
import { ConversationAgentContextBuilderPort } from './ports/conversation-agent-context-builder.port';
import { ConversationMessageHistoryPort } from './ports/conversation-message-history.port';
import { ProfileUpdateService } from './profile-update.service';

export interface SendChatMessageInput {
  userId: string;
  conversationId?: string;
  message: string;
  acceptedLanguage?: string;
}

export interface SendChatMessageOutput {
  reply: string;
  riskLevel: ChatRiskLevel;
  scopeStatus: ConversationScopeStatus;
}

export class ChatProviderUnavailableError extends Error {
  constructor() {
    super('Chat provider unavailable');
    this.name = 'ChatProviderUnavailableError';
  }
}

export class SendChatMessageUseCase {
  constructor(
    private readonly profileRepository: ReflectiveProfileRepository,
    private readonly chatAgent: ChatAgent,
    private readonly scopePolicy: ConversationScopePolicy,
    private readonly contextBuilder: ConversationAgentContextBuilderPort,
    private readonly profileUpdateService: ProfileUpdateService,
    private readonly messageHistory: ConversationMessageHistoryPort,
    private readonly usageService: UsageService,
    private readonly eventDispatcher: EventDispatcher,
    private readonly languageService: ConversationLanguageService,
    private readonly replyCatalog: ConversationReplyCatalog
  ) {}

  async execute(input: SendChatMessageInput): Promise<SendChatMessageOutput> {
    const contextResult = await this.contextBuilder.build(input.userId, input.conversationId);
    const language = this.languageService.resolve(
      contextResult.context.userIdentityContext?.preferredLanguage,
      input.acceptedLanguage
    );

    if (!contextResult.profileConfigured) {
      return {
        reply: this.replyCatalog.getProfileSetupReply(language.responseLanguage),
        riskLevel: 'none',
        scopeStatus: 'in_scope'
      };
    }

    const profile = contextResult.sourceProfile;
    if (!profile) throw new Error('Configured reflective profile was not found');

    await this.usageService.assertCanSendMessage(input.userId, input.message);

    let agentResponse;
    try {
      agentResponse = await this.chatAgent.respond({
        message: input.message,
        context: contextResult.context,
        preferredLanguage: language.preferredLanguage,
        responseLanguage: language.responseLanguage
      });
    } catch {
      throw new ChatProviderUnavailableError();
    }

    const now = new Date();
    this.profileUpdateService.apply(
      profile,
      agentResponse.scopeStatus,
      agentResponse.profileUpdate,
      input.message,
      now
    );

    const reply = this.scopePolicy.resolveReply(
      agentResponse.scopeStatus,
      agentResponse.reply,
      language.responseLanguage
    );
    const persistenceTasks: Promise<void>[] = [this.profileRepository.save(profile)];

    if (input.conversationId) {
      persistenceTasks.push(
        this.messageHistory.appendExchange(
          input.userId,
          input.conversationId,
          input.message,
          reply,
          now
        )
      );
    }

    await Promise.all(persistenceTasks);
    await this.usageService.registerLlmUsage(input.userId, agentResponse.usage);
    await this.eventDispatcher.dispatch(
      input.conversationId
        ? [
            new MessageReceivedEvent(input.conversationId),
            new AssistantResponseProducedEvent(input.conversationId),
            ...(agentResponse.scopeStatus === 'out_of_scope'
              ? [new ConversationPolicyViolatedEvent(input.conversationId)]
              : [])
          ]
        : []
    );

    return {
      reply,
      riskLevel: agentResponse.riskLevel,
      scopeStatus: agentResponse.scopeStatus
    };
  }
}
