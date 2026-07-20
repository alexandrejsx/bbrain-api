import { DomainEvent } from '../../core/domain-event';

abstract class WellbeingObservationDomainEvent implements DomainEvent {
  protected constructor(
    readonly aggregateId: string,
    readonly name: string,
    readonly occurredOn: Date
  ) {}
}

export class WellbeingObservationCreatedEvent extends WellbeingObservationDomainEvent {
  constructor(aggregateId: string, occurredOn = new Date()) {
    super(aggregateId, 'wellbeing-history.observation.created', occurredOn);
  }
}

export class WellbeingObservationCorrectedEvent extends WellbeingObservationDomainEvent {
  constructor(aggregateId: string, occurredOn = new Date()) {
    super(aggregateId, 'wellbeing-history.observation.corrected', occurredOn);
  }
}

export class WellbeingObservationRemovedEvent extends WellbeingObservationDomainEvent {
  constructor(aggregateId: string, occurredOn = new Date()) {
    super(aggregateId, 'wellbeing-history.observation.removed', occurredOn);
  }
}

export class WellbeingMoodSummaryMarkedStaleEvent extends WellbeingObservationDomainEvent {
  constructor(aggregateId: string, occurredOn = new Date()) {
    super(aggregateId, 'wellbeing-history.mood-summary.marked-stale', occurredOn);
  }
}

export class WellbeingMoodSummaryRestoredEvent extends WellbeingObservationDomainEvent {
  constructor(aggregateId: string, occurredOn = new Date()) {
    super(aggregateId, 'wellbeing-history.mood-summary.restored', occurredOn);
  }
}
