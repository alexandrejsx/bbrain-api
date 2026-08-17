import { Module } from '@nestjs/common';
import { DailyCheckInAgent } from '../../ai/daily-check-in-agent';
import { AiModule } from '../../ai/ai.module';
import { ConversationSafetyPolicy } from '../../ai/safety/conversation-safety.policy';
import { AuthModule } from '../auth/auth.module';
import { MoodModule } from '../mood/mood.module';
import { SleepModule } from '../sleep/sleep.module';
import { DataConsentPolicy } from '../users/data-consent.policy';
import { UsersModule } from '../users/users.module';
import { DailyCheckInAccessPolicy } from './daily-check-in-access.policy';
import { DailyCheckInController } from './daily-check-in.controller';
import { DailyCheckInService } from './daily-check-in.service';
import { DailyCheckInStorageModule } from './daily-check-in-storage.module';

@Module({
  imports: [AuthModule, UsersModule, AiModule, MoodModule, SleepModule, DailyCheckInStorageModule],
  controllers: [DailyCheckInController],
  providers: [
    DailyCheckInAgent,
    DailyCheckInAccessPolicy,
    DataConsentPolicy,
    ConversationSafetyPolicy,
    DailyCheckInService
  ]
})
export class DailyCheckInModule {}
