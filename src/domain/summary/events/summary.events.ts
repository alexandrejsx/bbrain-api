import { DomainEvent } from '../../core/domain-event';

abstract class SummaryDomainEvent implements DomainEvent {
  readonly occurredOn = new Date();

  protected constructor(
    readonly aggregateId: string,
    readonly name: string
  ) {}
}

export class WeeklySummaryGeneratedEvent extends SummaryDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'summary.weekly.generated');
  }
}

export class MonthlySummaryGeneratedEvent extends SummaryDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'summary.monthly.generated');
  }
}

export class PeriodSummaryGeneratedEvent extends SummaryDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'summary.period.generated');
  }
}
