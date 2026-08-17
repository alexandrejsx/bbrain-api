import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import config from './config';
import { AuthModule } from './modules/auth/auth.module';
import { InsightsModule } from './modules/insights/insights.module';
import { MongodbModule } from './modules/mongodb.module';
import { BillingModule } from './modules/billing/billing.module';
import { ProfileModule } from './modules/users/profile.module';
import { UsersModule } from './modules/users/users.module';
import { ChatModule } from './modules/chat/chat.module';
import { WellbeingModule } from './modules/wellbeing/wellbeing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: true,
      isGlobal: true,
      load: [config]
    }),
    MongodbModule,
    UsersModule,
    AuthModule,
    ChatModule,
    InsightsModule,
    BillingModule,
    ProfileModule,
    WellbeingModule
  ]
})
export class AppModule {}
