import { Module } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { ReflectiveProfileRepository } from '../domain/conversation/repositories/reflective-profile.repository';
import { ConversationStateRepository } from '../domain/conversation/repositories/conversation-state.repository';
import { UserRepository } from '../domain/users/repositories/user.repository';
import { MongoConversationStateRepository } from '../infrastructure/database/mongodb/repositories/mongo-conversation-state.repository';
import { MongoConversationExchangeLedgerRepository } from '../infrastructure/database/mongodb/repositories/mongo-conversation-exchange-ledger.repository';
import { MongoReflectiveProfileRepository } from '../infrastructure/database/mongodb/repositories/mongo-reflective-profile.repository';
import { MongodbRepository } from '../infrastructure/database/mongodb/mongodb.repository';
import {
  ConversationExchangeLedgerDocument,
  ConversationExchangeLedgerMongo,
  ConversationExchangeLedgerSchema
} from '../infrastructure/database/mongodb/schemas/conversation-exchange-ledger.schema';
import {
  ConversationStateDocument,
  ConversationStateMongo,
  ConversationStateSchema
} from '../infrastructure/database/mongodb/schemas/conversation-state.schema';
import {
  ReflectiveProfileDocument,
  ReflectiveProfileMongo,
  ReflectiveProfileSchema
} from '../infrastructure/database/mongodb/schemas/reflective-profile.schema';
import { ConversationAgentContextBuilderService } from '../use-cases/conversation/conversation-agent-context-builder.service';
import { ConversationExchangeLedgerPort } from '../use-cases/conversation/ports/conversation-exchange-ledger.port';
import { SensitiveTextFingerprintPort } from '../use-cases/conversation/ports/sensitive-text-fingerprint.port';
import { HmacSensitiveTextFingerprintService } from '../infrastructure/security/hmac-sensitive-text-fingerprint.service';
import {
  CONVERSATION_EXCHANGE_LEDGER,
  CONVERSATION_EXCHANGE_LEDGERS_BASE_REPOSITORY,
  CONVERSATION_STATES_BASE_REPOSITORY,
  CONVERSATION_STATES_REPOSITORY,
  REFLECTIVE_PROFILES_BASE_REPOSITORY,
  REFLECTIVE_PROFILES_REPOSITORY,
  SENSITIVE_TEXT_FINGERPRINT,
  USERS_REPOSITORY
} from './tokens';
import { UsersModule } from './users.module';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: ConversationStateMongo.name, schema: ConversationStateSchema },
      { name: ConversationExchangeLedgerMongo.name, schema: ConversationExchangeLedgerSchema },
      { name: ReflectiveProfileMongo.name, schema: ReflectiveProfileSchema }
    ])
  ],
  providers: [
    {
      provide: CONVERSATION_STATES_BASE_REPOSITORY,
      useFactory: (model: Model<ConversationStateDocument>) =>
        new MongodbRepository<ConversationStateDocument>(model),
      inject: [getModelToken(ConversationStateMongo.name)]
    },
    {
      provide: CONVERSATION_STATES_REPOSITORY,
      useFactory: (baseRepository: MongodbRepository<ConversationStateDocument>) =>
        new MongoConversationStateRepository(baseRepository),
      inject: [CONVERSATION_STATES_BASE_REPOSITORY]
    },
    {
      provide: CONVERSATION_EXCHANGE_LEDGERS_BASE_REPOSITORY,
      useFactory: (model: Model<ConversationExchangeLedgerDocument>) =>
        new MongodbRepository<ConversationExchangeLedgerDocument>(model),
      inject: [getModelToken(ConversationExchangeLedgerMongo.name)]
    },
    {
      provide: CONVERSATION_EXCHANGE_LEDGER,
      useFactory: (
        baseRepository: MongodbRepository<ConversationExchangeLedgerDocument>,
        config: ConfigService
      ): ConversationExchangeLedgerPort =>
        new MongoConversationExchangeLedgerRepository(baseRepository, {
          ttlHours: config.get<number>('conversation.exchangeLedgerTtlHours') || 24,
          processingLeaseSeconds:
            config.get<number>('conversation.exchangeProcessingLeaseSeconds') || 120
        }),
      inject: [CONVERSATION_EXCHANGE_LEDGERS_BASE_REPOSITORY, ConfigService]
    },
    {
      provide: SENSITIVE_TEXT_FINGERPRINT,
      useFactory: (config: ConfigService): SensitiveTextFingerprintPort =>
        new HmacSensitiveTextFingerprintService(
          config.getOrThrow<string>('conversation.fingerprintSecret')
        ),
      inject: [ConfigService]
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
        conversationStateRepository: ConversationStateRepository
      ) =>
        new ConversationAgentContextBuilderService(
          userRepository,
          profileRepository,
          conversationStateRepository
        ),
      inject: [USERS_REPOSITORY, REFLECTIVE_PROFILES_REPOSITORY, CONVERSATION_STATES_REPOSITORY]
    }
  ],
  exports: [
    ConversationAgentContextBuilderService,
    CONVERSATION_STATES_REPOSITORY,
    CONVERSATION_EXCHANGE_LEDGER,
    SENSITIVE_TEXT_FINGERPRINT,
    REFLECTIVE_PROFILES_REPOSITORY
  ]
})
export class ConversationContextModule {}
