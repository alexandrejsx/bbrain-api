import { PaymentProviderType } from '../../plans/plan-definition';
import { ProviderEvent } from '../entities/provider-event.entity';

export interface ProviderEventRepository {
  findByProviderEventId(
    provider: PaymentProviderType,
    providerEventId: string
  ): Promise<ProviderEvent | null>;
  save(event: ProviderEvent): Promise<void>;
}
