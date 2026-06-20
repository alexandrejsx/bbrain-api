import { DomainEvent } from '../../core/domain-event';

export class UserCreatedEvent implements DomainEvent {
  readonly occurredOn = new Date();
  readonly name = 'user.created';

  constructor(readonly aggregateId: string) {}
}
