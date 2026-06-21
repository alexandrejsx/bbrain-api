import { Module } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReflectiveProfileRepository } from '../../domain/conversation/repositories/reflective-profile.repository';
import { MongoAIContextMessageRepository } from '../../infrastructure/database/mongodb/repositories/mongo-ai-context-message.repository';
import { MongoReflectiveProfileRepository } from '../../infrastructure/database/mongodb/repositories/mongo-reflective-profile.repository';
import { MongodbRepository } from '../../infrastructure/database/mongodb/mongodb.repository';
import {
  ConversationMessageDocument,
  ConversationMessageMongo,
  ConversationMessageSchema
} from '../../infrastructure/database/mongodb/schemas/conversation-message.schema';
import {
  ReflectiveProfileDocument,
  ReflectiveProfileMongo,
  ReflectiveProfileSchema
} from '../../infrastructure/database/mongodb/schemas/reflective-profile.schema';
import {
  AI_CONTEXT_MESSAGES_BASE_REPOSITORY,
  AI_CONTEXT_MESSAGES_REPOSITORY,
  REFLECTIVE_PROFILES_BASE_REPOSITORY,
  REFLECTIVE_PROFILES_REPOSITORY
} from '../tokens';
import { AIContextMessageRepository } from './ai-context-message.repository';
import { AIContextService } from './ai-context.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConversationMessageMongo.name, schema: ConversationMessageSchema },
      { name: ReflectiveProfileMongo.name, schema: ReflectiveProfileSchema }
    ])
  ],
  providers: [
    {
      provide: AI_CONTEXT_MESSAGES_BASE_REPOSITORY,
      useFactory: (model: Model<ConversationMessageDocument>) =>
        new MongodbRepository<ConversationMessageDocument>(model),
      inject: [getModelToken(ConversationMessageMongo.name)]
    },
    {
      provide: AI_CONTEXT_MESSAGES_REPOSITORY,
      useFactory: (baseRepository: MongodbRepository<ConversationMessageDocument>) =>
        new MongoAIContextMessageRepository(baseRepository),
      inject: [AI_CONTEXT_MESSAGES_BASE_REPOSITORY]
    },
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
      provide: AIContextService,
      useFactory: (
        profileRepository: ReflectiveProfileRepository,
        messageRepository: AIContextMessageRepository
      ) => new AIContextService(profileRepository, messageRepository),
      inject: [REFLECTIVE_PROFILES_REPOSITORY, AI_CONTEXT_MESSAGES_REPOSITORY]
    }
  ],
  exports: [AIContextService, AI_CONTEXT_MESSAGES_REPOSITORY, REFLECTIVE_PROFILES_REPOSITORY]
})
export class AIContextModule {}
