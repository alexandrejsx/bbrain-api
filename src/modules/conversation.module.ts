import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatController } from '../controllers/chat.controller';
import { ConversationStateRepository } from '../domain/conversation/repositories/conversation-state.repository';
import { ConversationScopePolicy } from '../domain/conversation/services/conversation-scope-policy.service';
import { ConversationStateUpdatePolicy } from '../domain/conversation/services/conversation-state-update-policy.service';
import type { EventDispatcher } from '../domain/core/event-dispatcher';
import { OpenAiChatAgent } from '../infrastructure/openai/openai-chat-agent';
import { GeminiChatAgent } from '../infrastructure/gemini/gemini-chat-agent';
import { MockChatAgent } from '../infrastructure/mock/mock-chat-agent';
import { ChatAgent } from '../use-cases/conversation/chat-agent.port';
import { ConversationAgentContextBuilderService } from '../use-cases/conversation/conversation-agent-context-builder.service';
import { ConversationLanguageService } from '../use-cases/conversation/conversation-language.service';
import { ConversationReplyCatalog } from '../use-cases/conversation/conversation-reply-catalog';
import { ConversationSafetyReplyPolicy } from '../use-cases/conversation/conversation-safety-reply.policy';
import { ConversationExchangeLedgerPort } from '../use-cases/conversation/ports/conversation-exchange-ledger.port';
import { SensitiveTextFingerprintPort } from '../use-cases/conversation/ports/sensitive-text-fingerprint.port';
import { SendChatMessageUseCase } from '../use-cases/conversation/send-chat-message.use-case';
import { AuthModule } from './auth.module';
import { ConversationContextModule } from './conversation-context.module';
import { EventsModule } from './events.module';
import { PlansModule } from './plans.module';
import { UsageService } from '../domain/usage/services/usage.service';
import {
  CHAT_AGENT,
  CONVERSATION_EXCHANGE_LEDGER,
  CONVERSATION_STATES_REPOSITORY,
  EVENT_DISPATCHER,
  SENSITIVE_TEXT_FINGERPRINT
} from './tokens';
import { UsersModule } from './users.module';
import { WellbeingHistoryModule } from './wellbeing-history.module';
import { WellbeingObservationCaptureScheduler } from '../use-cases/wellbeing-history/wellbeing-observation-capture.scheduler';

@Module({
  imports: [
    AuthModule,
    ConversationContextModule,
    EventsModule,
    UsersModule,
    PlansModule,
    WellbeingHistoryModule
  ],
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
    ConversationStateUpdatePolicy,
    ConversationSafetyReplyPolicy,
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
        chatAgent: ChatAgent,
        scopePolicy: ConversationScopePolicy,
        contextBuilder: ConversationAgentContextBuilderService,
        conversationStateRepository: ConversationStateRepository,
        conversationStateUpdatePolicy: ConversationStateUpdatePolicy,
        exchangeLedger: ConversationExchangeLedgerPort,
        fingerprintService: SensitiveTextFingerprintPort,
        usageService: UsageService,
        eventDispatcher: EventDispatcher,
        languageService: ConversationLanguageService,
        replyCatalog: ConversationReplyCatalog,
        safetyReplyPolicy: ConversationSafetyReplyPolicy,
        config: ConfigService,
        wellbeingCapture: WellbeingObservationCaptureScheduler
      ) =>
        new SendChatMessageUseCase(
          chatAgent,
          scopePolicy,
          contextBuilder,
          conversationStateRepository,
          conversationStateUpdatePolicy,
          exchangeLedger,
          fingerprintService,
          usageService,
          eventDispatcher,
          languageService,
          replyCatalog,
          safetyReplyPolicy,
          config.get<number>('conversation.stateTtlHours') || 24,
          wellbeingCapture
        ),
      inject: [
        CHAT_AGENT,
        ConversationScopePolicy,
        ConversationAgentContextBuilderService,
        CONVERSATION_STATES_REPOSITORY,
        ConversationStateUpdatePolicy,
        CONVERSATION_EXCHANGE_LEDGER,
        SENSITIVE_TEXT_FINGERPRINT,
        UsageService,
        EVENT_DISPATCHER,
        ConversationLanguageService,
        ConversationReplyCatalog,
        ConversationSafetyReplyPolicy,
        ConfigService,
        WellbeingObservationCaptureScheduler
      ]
    }
  ]
})
export class ConversationModule {}
