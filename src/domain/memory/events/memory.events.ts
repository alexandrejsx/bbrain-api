import { DomainEvent } from '../../core/domain-event';

abstract class MemoryDomainEvent implements DomainEvent {
  readonly occurredOn = new Date();

  protected constructor(
    readonly aggregateId: string,
    readonly name: string
  ) {}
}

export class MemoryCreatedEvent extends MemoryDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'memory.created');
  }
}

export class MemoryUpdatedEvent extends MemoryDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'memory.updated');
  }
}

export class MemoryArchivedEvent extends MemoryDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'memory.archived');
  }
}

export class MemoryReferencedEvent extends MemoryDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'memory.referenced');
  }
}

export class MemoryRelevanceChangedEvent extends MemoryDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'memory.relevance.changed');
  }
}
