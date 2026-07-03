import { StripeEvent } from '../entities/stripe-event.entity';

export interface StripeEventRepository {
  findByStripeEventId(stripeEventId: string): Promise<StripeEvent | null>;
  save(event: StripeEvent): Promise<void>;
}
