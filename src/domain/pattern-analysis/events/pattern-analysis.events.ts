import { DomainEvent } from '../../core/domain-event';

abstract class PatternAnalysisDomainEvent implements DomainEvent {
  readonly occurredOn = new Date();

  protected constructor(
    readonly aggregateId: string,
    readonly name: string
  ) {}
}

export class InsightGeneratedEvent extends PatternAnalysisDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'pattern-analysis.insight.generated');
  }
}

export class BehaviorChangeDetectedEvent extends PatternAnalysisDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'pattern-analysis.behavior-change.detected');
  }
}

export class CorrelationDetectedEvent extends PatternAnalysisDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'pattern-analysis.correlation.detected');
  }
}

export class InsightDismissedEvent extends PatternAnalysisDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'pattern-analysis.insight.dismissed');
  }
}
