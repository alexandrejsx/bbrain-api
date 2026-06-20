import { DomainEvent } from '../../core/domain-event';

export class UserLoggedInEvent implements DomainEvent {
  readonly occurredOn = new Date();
  readonly name = 'user.logged_in';

  constructor(readonly aggregateId: string) {}
}
