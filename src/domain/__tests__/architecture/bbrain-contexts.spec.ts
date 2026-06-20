import { MoodCheckin } from '../../check-in/entities/check-in.entities';
import { MoodLevel } from '../../check-in/value-objects/check-in.value-objects';
import { Conversation } from '../../conversation/entities/conversation.entity';
import { JournalEntry } from '../../journal/entities/journal-entry.entity';
import { JournalText, JournalVisibility } from '../../journal/value-objects/journal.value-objects';
import { Memory } from '../../memory/entities/memory.entity';
import {
  ConfidenceLevel,
  MemoryCategory,
  MemoryContent,
  MemorySource,
  RelevanceScore,
  RetentionPolicy
} from '../../memory/value-objects/memory.value-objects';
import { PatternInsight } from '../../pattern-analysis/entities/pattern-insight.entity';
import {
  EvidenceWindow,
  InsightConfidence,
  InsightStatus
} from '../../pattern-analysis/value-objects/pattern-analysis.value-objects';
import { RiskAssessment } from '../../risk-assessment/entities/risk-assessment.entity';
import { RiskSignal } from '../../risk-assessment/entities/risk-signal.entity';
import {
  RiskEvidence,
  RiskLevel,
  RiskScore,
  RiskSignalType
} from '../../risk-assessment/value-objects/risk-assessment.value-objects';
import { UserSummary } from '../../summary/entities/user-summary.entity';
import {
  SummaryContent,
  SummaryKind,
  SummaryPeriod,
  SummarySource
} from '../../summary/value-objects/summary.value-objects';
import { SupportPlan } from '../../support-plan/entities/support-plan.entity';
import { PlanPeriod } from '../../support-plan/value-objects/support-plan.value-objects';

describe('BBrain context skeletons', () => {
  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates conversation aggregate with its initial event', () => {
    const conversation = Conversation.create({
      userId: 'user-id',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    });

    expect(conversation.toJson()).toMatchObject({ userId: 'user-id' });
    expect(conversation.pullDomainEvents()).toEqual([
      expect.objectContaining({ name: 'conversation.started' })
    ]);
  });

  it('creates memory aggregate with its initial event', () => {
    const memory = Memory.create({
      userId: 'user-id',
      category: new MemoryCategory('preference'),
      content: new MemoryContent('prefers evening check-ins'),
      confidence: new ConfidenceLevel(0.8),
      source: new MemorySource('conversation'),
      relevance: new RelevanceScore(0.7),
      retentionPolicy: new RetentionPolicy('retain'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    });

    expect(memory.toJson()).toMatchObject({ category: 'preference' });
    expect(memory.pullDomainEvents()).toEqual([
      expect.objectContaining({ name: 'memory.created' })
    ]);
  });

  it('creates check-in aggregate with its initial event', () => {
    const checkin = MoodCheckin.create({
      userId: 'user-id',
      mood: new MoodLevel(4),
      registeredAt: new Date('2026-01-01T00:00:00.000Z')
    });

    expect(checkin.toJson()).toMatchObject({ mood: 4 });
    expect(checkin.pullDomainEvents()).toEqual([
      expect.objectContaining({ name: 'checkin.registered' })
    ]);
  });

  it('creates journal aggregate with its initial event', () => {
    const entry = JournalEntry.create({
      userId: 'user-id',
      text: new JournalText('free reflection'),
      visibility: new JournalVisibility('private'),
      tags: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    });

    expect(entry.toJson()).toMatchObject({ text: 'free reflection' });
    expect(entry.pullDomainEvents()).toEqual([
      expect.objectContaining({ name: 'journal.entry.created' })
    ]);
  });

  it('creates pattern insight aggregate with its initial event', () => {
    const insight = PatternInsight.create({
      userId: 'user-id',
      title: 'Energy trend',
      description: 'Energy appears lower late in the week.',
      evidenceWindow: new EvidenceWindow({
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        endsAt: new Date('2026-01-07T00:00:00.000Z')
      }),
      confidence: new InsightConfidence(0.6),
      status: new InsightStatus('active'),
      createdAt: new Date('2026-01-08T00:00:00.000Z')
    });

    expect(insight.toJson()).toMatchObject({ title: 'Energy trend' });
    expect(insight.pullDomainEvents()).toEqual([
      expect.objectContaining({ name: 'pattern-analysis.insight.generated' })
    ]);
  });

  it('creates deterministic risk assessment aggregate with its initial event', () => {
    const signal = RiskSignal.create({
      type: new RiskSignalType('example'),
      evidence: new RiskEvidence('structured evidence'),
      detectedAt: new Date('2026-01-01T00:00:00.000Z')
    });
    const assessment = RiskAssessment.create({
      userId: 'user-id',
      score: new RiskScore(0),
      level: new RiskLevel('low'),
      signals: [signal],
      ruleEvaluations: [],
      generatedAt: new Date('2026-01-01T00:00:00.000Z')
    });

    expect(assessment.toJson()).toMatchObject({ score: 0, level: 'low' });
    expect(assessment.pullDomainEvents()).toEqual([
      expect.objectContaining({ name: 'risk-assessment.generated' })
    ]);
  });

  it('creates summary aggregate with its initial event', () => {
    const summary = UserSummary.create({
      userId: 'user-id',
      kind: new SummaryKind('weekly'),
      period: new SummaryPeriod({
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        endsAt: new Date('2026-01-07T00:00:00.000Z')
      }),
      content: new SummaryContent('weekly summary'),
      source: new SummarySource('system'),
      generatedAt: new Date('2026-01-08T00:00:00.000Z')
    });

    expect(summary.toJson()).toMatchObject({ kind: 'weekly' });
    expect(summary.pullDomainEvents()).toEqual([
      expect.objectContaining({ name: 'summary.period.generated' })
    ]);
  });

  it('creates support plan aggregate with its initial event', () => {
    const plan = SupportPlan.create({
      userId: 'user-id',
      period: new PlanPeriod({
        startsAt: new Date('2026-01-01T00:00:00.000Z')
      }),
      habitGoals: [],
      progress: [],
      smallSteps: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    });

    expect(plan.toJson()).toMatchObject({ userId: 'user-id' });
    expect(plan.pullDomainEvents()).toEqual([
      expect.objectContaining({ name: 'support-plan.created' })
    ]);
  });
});
