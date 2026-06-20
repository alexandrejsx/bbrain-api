import { Entity } from '../../core/entity';
import { Uuid } from '../../shared/uuid.vo';
import { MessageContent, MessageRole } from '../value-objects/conversation.value-objects';

export interface MessageProps {
  conversationId: string;
  role: MessageRole;
  content: MessageContent;
  createdAt: Date;
}

export class Message extends Entity<MessageProps> {
  private constructor(
    private readonly props: MessageProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: MessageProps, id?: Uuid): Message {
    return new Message(props, id);
  }

  toJson() {
    return {
      id: this.id.value,
      conversationId: this.props.conversationId,
      role: this.props.role.value,
      content: this.props.content.value,
      createdAt: this.props.createdAt.toISOString()
    };
  }
}
