import { Module } from '@nestjs/common';
import { ChatController } from '../controllers/chat.controller';
import { ReflectiveProfileRepository } from '../domain/conversation/repositories/reflective-profile.repository';
import { ConversationScopePolicy } from '../domain/conversation/services/conversation-scope-policy.service';
import { OpenAiChatAgent } from '../infrastructure/openai/openai-chat-agent';
import { GeminiChatAgent } from '../infrastructure/gemini/gemini-chat-agent';
import { MockChatAgent } from '../infrastructure/mock/mock-chat-agent';
import { ChatAgent } from '../use-cases/conversation/chat-agent.port';
import { ProfileUpdateService } from '../use-cases/conversation/profile-update.service';
import { SendChatMessageUseCase } from '../use-cases/conversation/send-chat-message.use-case';
import { AIContextModule } from './ai-context/ai-context.module';
import { AIContextMessageRepository } from './ai-context/ai-context-message.repository';
import { AIContextService } from './ai-context/ai-context.service';
import { AuthModule } from './auth.module';
import {
  AI_CONTEXT_MESSAGES_REPOSITORY,
  CHAT_AGENT,
  REFLECTIVE_PROFILES_REPOSITORY
} from './tokens';

@Module({
  imports: [AuthModule, AIContextModule],
  controllers: [ChatController],
  providers: [
    ConversationScopePolicy,
    GeminiChatAgent,
    MockChatAgent,
    OpenAiChatAgent,
    {
      provide: CHAT_AGENT,
      useExisting: GeminiChatAgent
    },
    {
      provide: ProfileUpdateService,
      useFactory: (scopePolicy: ConversationScopePolicy) => new ProfileUpdateService(scopePolicy),
      inject: [ConversationScopePolicy]
    },
    {
      provide: SendChatMessageUseCase,
      useFactory: (
        profileRepository: ReflectiveProfileRepository,
        chatAgent: ChatAgent,
        scopePolicy: ConversationScopePolicy,
        aiContextService: AIContextService,
        profileUpdateService: ProfileUpdateService,
        messageRepository: AIContextMessageRepository
      ) =>
        new SendChatMessageUseCase(
          profileRepository,
          chatAgent,
          scopePolicy,
          aiContextService,
          profileUpdateService,
          messageRepository
        ),
      inject: [
        REFLECTIVE_PROFILES_REPOSITORY,
        CHAT_AGENT,
        ConversationScopePolicy,
        AIContextService,
        ProfileUpdateService,
        AI_CONTEXT_MESSAGES_REPOSITORY
      ]
    }
  ]
})
export class ConversationModule {}
