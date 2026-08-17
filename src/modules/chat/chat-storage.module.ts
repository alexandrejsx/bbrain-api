import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ChatRequestMongo,
  ChatRequestSchema,
  ChatSessionMongo,
  ChatSessionSchema
} from './chat-session.schema';
import { ChatRequestRepository, ChatSessionRepository } from './chat-session.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatSessionMongo.name, schema: ChatSessionSchema },
      { name: ChatRequestMongo.name, schema: ChatRequestSchema }
    ])
  ],
  providers: [ChatSessionRepository, ChatRequestRepository],
  exports: [ChatSessionRepository, ChatRequestRepository]
})
export class ChatStorageModule {}
