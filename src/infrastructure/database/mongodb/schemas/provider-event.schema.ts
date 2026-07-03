import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PaymentProviderType } from '../../../../domain/plans/plan-definition';

@Schema({
  collection: 'provider_events',
  timestamps: {
    createdAt: 'created_at',
    updatedAt: false
  }
})
export class ProviderEventMongo {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, enum: Object.values(PaymentProviderType), index: true })
  provider: PaymentProviderType;

  @Prop({ type: String, required: true, index: true })
  provider_event_id: string;

  @Prop({ type: String, required: true })
  type: string;

  @Prop({ type: Date, required: true })
  processed_at: Date;

  @Prop({ type: Date })
  created_at: Date;
}

export type ProviderEventDocument = HydratedDocument<ProviderEventMongo>;
export const ProviderEventSchema = SchemaFactory.createForClass(ProviderEventMongo);
ProviderEventSchema.index({ provider: 1, provider_event_id: 1 }, { unique: true });
