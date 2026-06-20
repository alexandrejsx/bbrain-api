import { DomainEvent } from '../../core/domain-event';

abstract class ConversationDomainEvent implements DomainEvent {
  readonly occurredOn = new Date();

  protected constructor(
    readonly aggregateId: string,
    readonly name: string
  ) {}
}

export class ConversationStartedEvent extends ConversationDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'conversation.started');
  }
}

export class MessageReceivedEvent extends ConversationDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'conversation.message.received');
  }
}

export class AssistantResponseProducedEvent extends ConversationDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'conversation.assistant-response.produced');
  }
}

export class SessionClosedEvent extends ConversationDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'conversation.session.closed');
  }
}

export class ConversationPolicyViolatedEvent extends ConversationDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'conversation.policy.violated');
  }
}
