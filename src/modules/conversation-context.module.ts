import { Module } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReflectiveProfileRepository } from '../domain/conversation/repositories/reflective-profile.repository';
import { UserRepository } from '../domain/users/repositories/user.repository';
import { MongoConversationMessageHistoryRepository } from '../infrastructure/database/mongodb/repositories/mongo-conversation-message-history.repository';
import { MongoReflectiveProfileRepository } from '../infrastructure/database/mongodb/repositories/mongo-reflective-profile.repository';
import { MongodbRepository } from '../infrastructure/database/mongodb/mongodb.repository';
import {
  ConversationMessageDocument,
  ConversationMessageMongo,
  ConversationMessageSchema
} from '../infrastructure/database/mongodb/schemas/conversation-message.schema';
import {
  ReflectiveProfileDocument,
  ReflectiveProfileMongo,
  ReflectiveProfileSchema
} from '../infrastructure/database/mongodb/schemas/reflective-profile.schema';
import { ConversationAgentContextBuilderService } from '../use-cases/conversation/conversation-agent-context-builder.service';
import { ConversationMessageHistoryPort } from '../use-cases/conversation/ports/conversation-message-history.port';
import {
  CONVERSATION_MESSAGE_HISTORY_BASE_REPOSITORY,
  CONVERSATION_MESSAGE_HISTORY_REPOSITORY,
  REFLECTIVE_PROFILES_BASE_REPOSITORY,
  REFLECTIVE_PROFILES_REPOSITORY,
  USERS_REPOSITORY
} from './tokens';
import { UsersModule } from './users.module';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: ConversationMessageMongo.name, schema: ConversationMessageSchema },
      { name: ReflectiveProfileMongo.name, schema: ReflectiveProfileSchema }
    ])
  ],
  providers: [
    {
      provide: CONVERSATION_MESSAGE_HISTORY_BASE_REPOSITORY,
      useFactory: (model: Model<ConversationMessageDocument>) =>
        new MongodbRepository<ConversationMessageDocument>(model),
      inject: [getModelToken(ConversationMessageMongo.name)]
    },
    {
      provide: CONVERSATION_MESSAGE_HISTORY_REPOSITORY,
      useFactory: (baseRepository: MongodbRepository<ConversationMessageDocument>) =>
        new MongoConversationMessageHistoryRepository(baseRepository),
      inject: [CONVERSATION_MESSAGE_HISTORY_BASE_REPOSITORY]
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
      provide: ConversationAgentContextBuilderService,
      useFactory: (
        userRepository: UserRepository,
        profileRepository: ReflectiveProfileRepository,
        messageHistory: ConversationMessageHistoryPort
      ) =>
        new ConversationAgentContextBuilderService(
          userRepository,
          profileRepository,
          messageHistory
        ),
      inject: [
        USERS_REPOSITORY,
        REFLECTIVE_PROFILES_REPOSITORY,
        CONVERSATION_MESSAGE_HISTORY_REPOSITORY
      ]
    }
  ],
  exports: [
    ConversationAgentContextBuilderService,
    CONVERSATION_MESSAGE_HISTORY_REPOSITORY,
    REFLECTIVE_PROFILES_REPOSITORY
  ]
})
export class ConversationContextModule {}
