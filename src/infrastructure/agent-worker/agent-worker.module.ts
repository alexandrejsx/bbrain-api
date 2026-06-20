import { Module } from '@nestjs/common';
import { CheckInModule } from '../../modules/check-in.module';
import { ConversationModule } from '../../modules/conversation.module';
import { JournalModule } from '../../modules/journal.module';
import { MemoryModule } from '../../modules/memory.module';
import { PatternAnalysisModule } from '../../modules/pattern-analysis.module';
import { RiskAssessmentModule } from '../../modules/risk-assessment.module';
import { SafetyModule } from '../../modules/safety.module';
import { SummaryModule } from '../../modules/summary.module';
import { SupportPlanModule } from '../../modules/support-plan.module';

@Module({
  imports: [
    ConversationModule,
    MemoryModule,
    CheckInModule,
    JournalModule,
    PatternAnalysisModule,
    RiskAssessmentModule,
    SummaryModule,
    SupportPlanModule,
    SafetyModule
  ]
})
export class AgentWorkerModule {}
