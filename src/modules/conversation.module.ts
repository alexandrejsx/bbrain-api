import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatController } from '../controllers/chat.controller';
import { ReflectiveProfileRepository } from '../domain/conversation/repositories/reflective-profile.repository';
import { ConversationScopePolicy } from '../domain/conversation/services/conversation-scope-policy.service';
import type { EventDispatcher } from '../domain/core/event-dispatcher';
import { OpenAiChatAgent } from '../infrastructure/openai/openai-chat-agent';
import { GeminiChatAgent } from '../infrastructure/gemini/gemini-chat-agent';
import { MockChatAgent } from '../infrastructure/mock/mock-chat-agent';
import { ChatAgent } from '../use-cases/conversation/chat-agent.port';
import { ConversationAgentContextBuilderService } from '../use-cases/conversation/conversation-agent-context-builder.service';
import { ConversationLanguageService } from '../use-cases/conversation/conversation-language.service';
import { ConversationReplyCatalog } from '../use-cases/conversation/conversation-reply-catalog';
import { ConversationMessageHistoryPort } from '../use-cases/conversation/ports/conversation-message-history.port';
import { ProfileUpdateService } from '../use-cases/conversation/profile-update.service';
import { SendChatMessageUseCase } from '../use-cases/conversation/send-chat-message.use-case';
import { AuthModule } from './auth.module';
import { ConversationContextModule } from './conversation-context.module';
import { EventsModule } from './events.module';
import { PlansModule } from './plans.module';
import { UsageService } from '../domain/usage/services/usage.service';
import {
  CHAT_AGENT,
  CONVERSATION_MESSAGE_HISTORY_REPOSITORY,
  EVENT_DISPATCHER,
  REFLECTIVE_PROFILES_REPOSITORY
} from './tokens';
import { UsersModule } from './users.module';

@Module({
  imports: [AuthModule, ConversationContextModule, EventsModule, UsersModule, PlansModule],
  controllers: [ChatController],
  providers: [
    ConversationScopePolicy,
    GeminiChatAgent,
    MockChatAgent,
    OpenAiChatAgent,
    {
      provide: CHAT_AGENT,
      useFactory: (
        config: ConfigService,
        gemini: GeminiChatAgent,
        openAi: OpenAiChatAgent,
        mock: MockChatAgent
      ): ChatAgent => {
        const provider = config.get<string>('ai.chatProvider') ?? 'gemini';

        if (provider === 'openai') return openAi;
        if (provider === 'mock') return mock;
        return gemini;
      },
      inject: [ConfigService, GeminiChatAgent, OpenAiChatAgent, MockChatAgent]
    },
    {
      provide: ProfileUpdateService,
      useFactory: (scopePolicy: ConversationScopePolicy) => new ProfileUpdateService(scopePolicy),
      inject: [ConversationScopePolicy]
    },
    {
      provide: ConversationLanguageService,
      useFactory: () => new ConversationLanguageService()
    },
    {
      provide: ConversationReplyCatalog,
      useFactory: () => new ConversationReplyCatalog()
    },
    {
      provide: SendChatMessageUseCase,
      useFactory: (
        profileRepository: ReflectiveProfileRepository,
        chatAgent: ChatAgent,
        scopePolicy: ConversationScopePolicy,
        contextBuilder: ConversationAgentContextBuilderService,
        profileUpdateService: ProfileUpdateService,
        messageHistory: ConversationMessageHistoryPort,
        usageService: UsageService,
        eventDispatcher: EventDispatcher,
        languageService: ConversationLanguageService,
        replyCatalog: ConversationReplyCatalog
      ) =>
        new SendChatMessageUseCase(
          profileRepository,
          chatAgent,
          scopePolicy,
          contextBuilder,
          profileUpdateService,
          messageHistory,
          usageService,
          eventDispatcher,
          languageService,
          replyCatalog
        ),
      inject: [
        REFLECTIVE_PROFILES_REPOSITORY,
        CHAT_AGENT,
        ConversationScopePolicy,
        ConversationAgentContextBuilderService,
        ProfileUpdateService,
        CONVERSATION_MESSAGE_HISTORY_REPOSITORY,
        UsageService,
        EVENT_DISPATCHER,
        ConversationLanguageService,
        ConversationReplyCatalog
      ]
    }
  ]
})
export class ConversationModule {}
