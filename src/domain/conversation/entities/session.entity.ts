import { Entity } from '../../core/entity';
import { Uuid } from '../../shared/uuid.vo';
import { SessionStatus } from '../value-objects/conversation.value-objects';

export interface SessionProps {
  conversationId: string;
  status: SessionStatus;
  startedAt: Date;
  closedAt?: Date;
}

export class Session extends Entity<SessionProps> {
  private constructor(
    private readonly props: SessionProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: SessionProps, id?: Uuid): Session {
    return new Session(props, id);
  }

  toJson() {
    return {
      id: this.id.value,
      conversationId: this.props.conversationId,
      status: this.props.status.value,
      startedAt: this.props.startedAt.toISOString(),
      closedAt: this.props.closedAt?.toISOString()
    };
  }
}
