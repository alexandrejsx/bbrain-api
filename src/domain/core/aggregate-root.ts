import { DomainEvent } from './domain-event';
import { Entity } from './entity';

export abstract class AggregateRoot<T> extends Entity<T> {
  private _domainEvents: DomainEvent[] = [];

  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }
}
