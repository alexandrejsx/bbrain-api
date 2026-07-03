import { StripeEvent } from '../../../../domain/billing/entities/stripe-event.entity';
import { Uuid } from '../../../../domain/shared/uuid.vo';
import { StripeEventDocument, StripeEventMongo } from '../schemas/stripe-event.schema';

export class MongoStripeEventMapper {
  static toPersistence(event: StripeEvent): Partial<StripeEventMongo> {
    return {
      _id: event.id.value,
      stripe_event_id: event.stripeEventId,
      type: event.type,
      processed_at: event.processedAt,
      created_at: event.createdAt
    };
  }

  static toDomain(raw: StripeEventDocument | StripeEventMongo): StripeEvent {
    return StripeEvent.reconstitute(
      {
        stripeEventId: raw.stripe_event_id,
        type: raw.type,
        processedAt: raw.processed_at,
        createdAt: raw.created_at
      },
      new Uuid(raw._id)
    );
  }
}
