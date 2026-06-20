import { DomainEvent } from '../../core/domain-event';

abstract class CheckinDomainEvent implements DomainEvent {
  readonly occurredOn = new Date();

  protected constructor(
    readonly aggregateId: string,
    readonly name: string
  ) {}
}

export class CheckinRegisteredEvent extends CheckinDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'checkin.registered');
  }
}

export class CheckinCorrectedEvent extends CheckinDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'checkin.corrected');
  }
}

export class CheckinHistoryRequestedEvent extends CheckinDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'checkin.history.requested');
  }
}
