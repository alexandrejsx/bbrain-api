import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MoodModule } from '../mood/mood.module';
import { SleepModule } from '../sleep/sleep.module';
import { UsersModule } from '../users/users.module';
import { WellbeingController } from './wellbeing.controller';
import { WellbeingService } from './wellbeing.service';

@Module({
  imports: [AuthModule, UsersModule, MoodModule, SleepModule],
  controllers: [WellbeingController],
  providers: [WellbeingService]
})
export class WellbeingModule {}
