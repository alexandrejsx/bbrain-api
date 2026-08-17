import { Module } from '@nestjs/common';
import { AiModule } from '../../ai/ai.module';
import { ConversationAgent } from '../../ai/conversation-agent';
import { ConversationSafetyPolicy } from '../../ai/safety/conversation-safety.policy';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { UsersModule } from '../users/users.module';
import { MemoryModule } from '../memory/memory.module';
import { MoodModule } from '../mood/mood.module';
import { SleepModule } from '../sleep/sleep.module';
import { ChatController } from './chat.controller';
import { ContextBuilder } from './context-builder';
import { SendChatMessageService } from './send-chat-message.service';
import { ChatStorageModule } from './chat-storage.module';
import { PostProcessingModule } from './post-processing.module';
import { DailyCheckInStorageModule } from '../daily-check-in/daily-check-in-storage.module';

@Module({
  imports: [
    AuthModule,
    BillingModule,
    UsersModule,
    AiModule,
    MemoryModule,
    MoodModule,
    SleepModule,
    ChatStorageModule,
    PostProcessingModule,
    DailyCheckInStorageModule
  ],
  controllers: [ChatController],
  providers: [ConversationAgent, ConversationSafetyPolicy, ContextBuilder, SendChatMessageService],
  exports: [ChatStorageModule, PostProcessingModule]
})
export class ChatModule {}
