import { DomainEvent } from '../../core/domain-event';

abstract class JournalDomainEvent implements DomainEvent {
  readonly occurredOn = new Date();

  protected constructor(
    readonly aggregateId: string,
    readonly name: string
  ) {}
}

export class JournalEntryCreatedEvent extends JournalDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'journal.entry.created');
  }
}

export class JournalEntryUpdatedEvent extends JournalDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'journal.entry.updated');
  }
}

export class JournalEntryTaggedEvent extends JournalDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'journal.entry.tagged');
  }
}

export class JournalEntryArchivedEvent extends JournalDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'journal.entry.archived');
  }
}
