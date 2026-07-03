import { ProviderEvent } from '../../../../domain/billing/entities/provider-event.entity';
import {
  normalizePaymentProviderType,
  PaymentProviderType
} from '../../../../domain/plans/plan-definition';
import { Uuid } from '../../../../domain/shared/uuid.vo';
import { ProviderEventDocument, ProviderEventMongo } from '../schemas/provider-event.schema';

export class MongoProviderEventMapper {
  static toPersistence(event: ProviderEvent): Partial<ProviderEventMongo> {
    return {
      _id: event.id.value,
      provider: event.provider,
      provider_event_id: event.providerEventId,
      type: event.type,
      processed_at: event.processedAt,
      created_at: event.createdAt
    };
  }

  static toDomain(raw: ProviderEventDocument | ProviderEventMongo): ProviderEvent {
    return ProviderEvent.reconstitute(
      {
        provider: normalizePaymentProviderType(raw.provider) ?? PaymentProviderType.ASAAS,
        providerEventId: raw.provider_event_id,
        type: raw.type,
        processedAt: raw.processed_at,
        createdAt: raw.created_at
      },
      new Uuid(raw._id)
    );
  }
}
