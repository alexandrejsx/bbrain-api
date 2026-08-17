import { PaymentProviderType } from '../../plans/plan-definition';
import { Uuid } from '../../shared/uuid.vo';

export interface ProviderEventProps {
  provider: PaymentProviderType;
  providerEventId: string;
  type: string;
  processedAt: Date;
  createdAt: Date;
}

export class ProviderEvent {
  readonly id: Uuid;

  private constructor(
    private readonly props: ProviderEventProps,
    id?: Uuid
  ) {
    this.id = id ?? Uuid.create();
  }

  static create(props: Omit<ProviderEventProps, 'createdAt'> & { createdAt?: Date }, id?: Uuid) {
    return new ProviderEvent(
      {
        ...props,
        createdAt: props.createdAt ?? new Date()
      },
      id
    );
  }

  static reconstitute(props: ProviderEventProps, id: Uuid): ProviderEvent {
    return new ProviderEvent(props, id);
  }

  get provider(): PaymentProviderType {
    return this.props.provider;
  }

  get providerEventId(): string {
    return this.props.providerEventId;
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
      provider: this.provider,
      providerEventId: this.providerEventId,
      type: this.type,
      processedAt: this.processedAt.toISOString(),
      createdAt: this.createdAt.toISOString()
    };
  }
}
