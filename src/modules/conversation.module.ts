import { Module } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatController } from '../controllers/chat.controller';
import { ReflectiveProfileRepository } from '../domain/conversation/repositories/reflective-profile.repository';
import { ConversationScopePolicy } from '../domain/conversation/services/conversation-scope-policy.service';
import { MongoReflectiveProfileRepository } from '../infrastructure/database/mongodb/repositories/mongo-reflective-profile.repository';
import { MongodbRepository } from '../infrastructure/database/mongodb/mongodb.repository';
import {
  ReflectiveProfileDocument,
  ReflectiveProfileMongo,
  ReflectiveProfileSchema
} from '../infrastructure/database/mongodb/schemas/reflective-profile.schema';
import { OpenAiChatAgent } from '../infrastructure/openai/openai-chat-agent';
import { GeminiChatAgent } from '../infrastructure/gemini/gemini-chat-agent';
import { MockChatAgent } from '../infrastructure/mock/mock-chat-agent';
import { ChatAgent } from '../use-cases/conversation/chat-agent.port';
import { SendChatMessageUseCase } from '../use-cases/conversation/send-chat-message.use-case';
import { AuthModule } from './auth.module';
import {
  CHAT_AGENT,
  REFLECTIVE_PROFILES_BASE_REPOSITORY,
  REFLECTIVE_PROFILES_REPOSITORY
} from './tokens';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: ReflectiveProfileMongo.name, schema: ReflectiveProfileSchema }
    ])
  ],
  controllers: [ChatController],
  providers: [
    ConversationScopePolicy,
    GeminiChatAgent,
    MockChatAgent,
    OpenAiChatAgent,
    {
      provide: REFLECTIVE_PROFILES_BASE_REPOSITORY,
      useFactory: (model: Model<ReflectiveProfileDocument>) =>
        new MongodbRepository<ReflectiveProfileDocument>(model),
      inject: [getModelToken(ReflectiveProfileMongo.name)]
    },
    {
      provide: REFLECTIVE_PROFILES_REPOSITORY,
      useFactory: (baseRepository: MongodbRepository<ReflectiveProfileDocument>) =>
        new MongoReflectiveProfileRepository(baseRepository),
      inject: [REFLECTIVE_PROFILES_BASE_REPOSITORY]
    },
    {
      provide: CHAT_AGENT,
      useExisting: GeminiChatAgent
    },
    {
      provide: SendChatMessageUseCase,
      useFactory: (
        profileRepository: ReflectiveProfileRepository,
        chatAgent: ChatAgent,
        scopePolicy: ConversationScopePolicy
      ) => new SendChatMessageUseCase(profileRepository, chatAgent, scopePolicy),
      inject: [REFLECTIVE_PROFILES_REPOSITORY, CHAT_AGENT, ConversationScopePolicy]
    }
  ]
})
export class ConversationModule {}
