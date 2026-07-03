import { Entity } from '../../core/entity';
import { Uuid } from '../../shared/uuid.vo';

export interface StripeEventProps {
  stripeEventId: string;
  type: string;
  processedAt: Date;
  createdAt: Date;
}

export class StripeEvent extends Entity<StripeEventProps> {
  private constructor(
    private readonly props: StripeEventProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: Omit<StripeEventProps, 'createdAt'> & { createdAt?: Date }, id?: Uuid) {
    return new StripeEvent(
      {
        ...props,
        createdAt: props.createdAt ?? new Date()
      },
      id
    );
  }

  static reconstitute(props: StripeEventProps, id: Uuid): StripeEvent {
    return new StripeEvent(props, id);
  }

  get stripeEventId(): string {
    return this.props.stripeEventId;
  }

  get type(): string {
    return this.props.type;
  }

  get processedAt(): Date {
    return this.props.processedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  toJson() {
    return {
      id: this.id.value,
      stripeEventId: this.stripeEventId,
      type: this.type,
      processedAt: this.processedAt.toISOString(),
      createdAt: this.createdAt.toISOString()
    };
  }
}
