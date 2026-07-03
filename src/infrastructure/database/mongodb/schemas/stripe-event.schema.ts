import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({
  collection: 'stripe_events',
  timestamps: {
    createdAt: 'created_at',
    updatedAt: false
  }
})
export class StripeEventMongo {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  stripe_event_id: string;

  @Prop({ type: String, required: true })
  type: string;

  @Prop({ type: Date, required: true })
  processed_at: Date;

  @Prop({ type: Date })
  created_at: Date;
}

export type StripeEventDocument = HydratedDocument<StripeEventMongo>;
export const StripeEventSchema = SchemaFactory.createForClass(StripeEventMongo);
