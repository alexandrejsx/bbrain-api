import { AggregateRoot } from '../../core/aggregate-root';
import { Uuid } from '../../shared/uuid.vo';
import { ConversationStartedEvent } from '../events/conversation.events';

export interface ConversationProps {
  userId: string;
  activeSessionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Conversation extends AggregateRoot<ConversationProps> {
  private constructor(
    private readonly props: ConversationProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: ConversationProps, id?: Uuid): Conversation {
    const conversation = new Conversation(props, id);
    conversation.addDomainEvent(new ConversationStartedEvent(conversation.id.value));
    return conversation;
  }

  static reconstitute(props: ConversationProps, id: Uuid): Conversation {
    return new Conversation(props, id);
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.props.userId,
      activeSessionId: this.props.activeSessionId,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString()
    };
  }
}
