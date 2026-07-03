import { Injectable } from '@nestjs/common';
import { PaymentOrder } from '../../../../domain/billing/entities/payment-order.entity';
import { PaymentOrderRepository } from '../../../../domain/billing/repositories/payment-order.repository';
import { PaymentProviderType, PaymentStatus } from '../../../../domain/plans/plan-definition';
import { MongoPaymentOrderMapper } from '../mappers/payment-order.mapper';
import { MongodbRepository } from '../mongodb.repository';
import { PaymentOrderDocument } from '../schemas/payment-order.schema';

@Injectable()
export class MongoPaymentOrderRepository implements PaymentOrderRepository {
  constructor(private readonly baseRepository: MongodbRepository<PaymentOrderDocument>) {}

  async findById(id: string): Promise<PaymentOrder | null> {
    const doc = await this.baseRepository.findOne(id);

    return doc ? MongoPaymentOrderMapper.toDomain(doc) : null;
  }

  async findByProviderPaymentId(
    provider: PaymentProviderType,
    providerPaymentId: string
  ): Promise<PaymentOrder | null> {
    const doc = await this.baseRepository.findOne({
      provider,
      provider_payment_id: providerPaymentId
    });

    return doc ? MongoPaymentOrderMapper.toDomain(doc) : null;
  }

  async findLatestByUserIdAndStatus(
    userId: string,
    status: PaymentStatus
  ): Promise<PaymentOrder | null> {
    const [doc] = await this.baseRepository.findAll(
      { user_id: userId, status },
      { updated_at: -1 },
      1
    );

    return doc ? MongoPaymentOrderMapper.toDomain(doc) : null;
  }

  async save(order: PaymentOrder): Promise<void> {
    const persistence = MongoPaymentOrderMapper.toPersistence(order);

    if (!persistence._id) {
      throw new Error('Cannot persist payment order without id');
    }

    const exists = await this.baseRepository.findOne(persistence._id);

    if (exists) {
      await this.baseRepository.update(exists._id.toString(), persistence);
      return;
    }

    await this.baseRepository.add(persistence);
  }
}
