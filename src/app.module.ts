import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import config from './config';
import { AgentsModule } from './modules/agents.module';
import { AuthModule } from './modules/auth.module';
import { CheckInModule } from './modules/check-in.module';
import { ConversationModule } from './modules/conversation.module';
import { EventsModule } from './modules/events.module';
import { JournalModule } from './modules/journal.module';
import { MemoryModule } from './modules/memory.module';
import { MongodbModule } from './modules/mongodb.module';
import { PatternAnalysisModule } from './modules/pattern-analysis.module';
import { RiskAssessmentModule } from './modules/risk-assessment.module';
import { SafetyModule } from './modules/safety.module';
import { SummaryModule } from './modules/summary.module';
import { SupportPlanModule } from './modules/support-plan.module';
import { UsersModule } from './modules/users.module';

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
    MemoryModule,
    CheckInModule,
    JournalModule,
    PatternAnalysisModule,
    RiskAssessmentModule,
    SummaryModule,
    SupportPlanModule,
    SafetyModule,
    AgentsModule
  ]
})
export class AppModule {}
