export interface DomainEvent {
  aggregateId: string;
  occurredOn: Date;
  name: string;
}
