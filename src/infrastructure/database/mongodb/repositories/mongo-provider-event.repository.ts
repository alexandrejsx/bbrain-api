import { Injectable } from '@nestjs/common';
import { ProviderEvent } from '../../../../domain/billing/entities/provider-event.entity';
import { ProviderEventRepository } from '../../../../domain/billing/repositories/provider-event.repository';
import { PaymentProviderType } from '../../../../domain/plans/plan-definition';
import { MongoProviderEventMapper } from '../mappers/provider-event.mapper';
import { MongodbRepository } from '../mongodb.repository';
import { ProviderEventDocument } from '../schemas/provider-event.schema';

@Injectable()
export class MongoProviderEventRepository implements ProviderEventRepository {
  constructor(private readonly baseRepository: MongodbRepository<ProviderEventDocument>) {}

  async findByProviderEventId(
    provider: PaymentProviderType,
    providerEventId: string
  ): Promise<ProviderEvent | null> {
    const doc = await this.baseRepository.findOne({
      provider,
      provider_event_id: providerEventId
    });

    return doc ? MongoProviderEventMapper.toDomain(doc) : null;
  }

  async save(event: ProviderEvent): Promise<void> {
    const persistence = MongoProviderEventMapper.toPersistence(event);

    if (!persistence._id) {
      throw new Error('Cannot persist provider event without id');
    }

    const exists = await this.baseRepository.findOne(persistence._id);

    if (exists) {
      await this.baseRepository.update(exists._id.toString(), persistence);
      return;
    }

    await this.baseRepository.add(persistence);
  }
}
