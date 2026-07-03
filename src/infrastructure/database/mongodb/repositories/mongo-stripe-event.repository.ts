import { Injectable } from '@nestjs/common';
import { StripeEvent } from '../../../../domain/billing/entities/stripe-event.entity';
import { StripeEventRepository } from '../../../../domain/billing/repositories/stripe-event.repository';
import { MongoStripeEventMapper } from '../mappers/stripe-event.mapper';
import { MongodbRepository } from '../mongodb.repository';
import { StripeEventDocument } from '../schemas/stripe-event.schema';

@Injectable()
export class MongoStripeEventRepository implements StripeEventRepository {
  constructor(private readonly baseRepository: MongodbRepository<StripeEventDocument>) {}

  async findByStripeEventId(stripeEventId: string): Promise<StripeEvent | null> {
    const doc = await this.baseRepository.findOne({
      stripe_event_id: stripeEventId
    });

    return doc ? MongoStripeEventMapper.toDomain(doc) : null;
  }

  async save(event: StripeEvent): Promise<void> {
    const persistence = MongoStripeEventMapper.toPersistence(event);

    if (!persistence._id) {
      throw new Error('Cannot persist Stripe event without id');
    }

    const exists = await this.baseRepository.findOne(persistence._id);

    if (exists) {
      await this.baseRepository.update(exists._id.toString(), persistence);
      return;
    }

    await this.baseRepository.add(persistence);
  }
}
