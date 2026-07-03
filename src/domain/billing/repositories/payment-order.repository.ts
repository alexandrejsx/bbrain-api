import { PaymentProviderType, PaymentStatus } from '../../plans/plan-definition';
import { PaymentOrder } from '../entities/payment-order.entity';

export interface PaymentOrderRepository {
  findById(id: string): Promise<PaymentOrder | null>;
  findByProviderPaymentId(
    provider: PaymentProviderType,
    providerPaymentId: string
  ): Promise<PaymentOrder | null>;
  findLatestByUserIdAndStatus(userId: string, status: PaymentStatus): Promise<PaymentOrder | null>;
  save(order: PaymentOrder): Promise<void>;
}
