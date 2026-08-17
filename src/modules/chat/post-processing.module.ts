import { Module } from '@nestjs/common';
import { AiModule } from '../../ai/ai.module';
import { PostConversationExtractor } from '../../ai/post-conversation.extractor';
import { UsersModule } from '../users/users.module';
import { MemoryModule } from '../memory/memory.module';
import { DataConsentPolicy } from '../users/data-consent.policy';
import {
  PostConversationProcessor,
  PostConversationScheduler
} from './post-conversation.processor';

@Module({
  imports: [AiModule, UsersModule, MemoryModule],
  providers: [
    PostConversationExtractor,
    DataConsentPolicy,
    PostConversationProcessor,
    PostConversationScheduler
  ],
  exports: [DataConsentPolicy, PostConversationScheduler]
})
export class PostProcessingModule {}
