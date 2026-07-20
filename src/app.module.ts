import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import config from './config';
import { AuthModule } from './modules/auth.module';
import { ConversationModule } from './modules/conversation.module';
import { EventsModule } from './modules/events.module';
import { InsightsModule } from './modules/insights.module';
import { MongodbModule } from './modules/mongodb.module';
import { PlansModule } from './modules/plans.module';
import { ProfileModule } from './modules/profile.module';
import { UsersModule } from './modules/users.module';
import { WellbeingHistoryModule } from './modules/wellbeing-history.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: true,
      isGlobal: true,
      load: [config]
    }),
    EventEmitterModule.forRoot(),
    MongodbModule,
    EventsModule,
    UsersModule,
    AuthModule,
    ConversationModule,
    InsightsModule,
    PlansModule,
    ProfileModule,
    WellbeingHistoryModule
  ]
})
export class AppModule {}
