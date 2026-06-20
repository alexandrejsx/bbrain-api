import { Entity } from '../../core/entity';
import { Uuid } from '../../shared/uuid.vo';
import { ConversationPolicy } from '../value-objects/conversation.value-objects';

export interface CompanionProfileProps {
  userId: string;
  policy: ConversationPolicy;
  createdAt: Date;
  updatedAt: Date;
}

export class CompanionProfile extends Entity<CompanionProfileProps> {
  private constructor(
    private readonly props: CompanionProfileProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: CompanionProfileProps, id?: Uuid): CompanionProfile {
    return new CompanionProfile(props, id);
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.props.userId,
      policy: this.props.policy.value,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString()
    };
  }
}
