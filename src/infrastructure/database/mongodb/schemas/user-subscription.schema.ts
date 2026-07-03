import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  BillingCurrency,
  BillingInterval,
  PaymentProviderType,
  PlanType,
  SubscriptionStatus
} from '../../../../domain/plans/plan-definition';

@Schema({
  collection: 'user_subscriptions',
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
})
export class UserSubscriptionMongo {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, index: true })
  user_id: string;

  @Prop({ type: String, required: true, enum: Object.values(PaymentProviderType), index: true })
  provider: PaymentProviderType;

  @Prop({ type: String, index: true })
  provider_customer_id?: string;

  @Prop({ type: String, index: true })
  provider_subscription_id?: string;

  @Prop({ type: String })
  provider_price_id?: string;

  @Prop({ type: String, index: true })
  stripe_customer_id?: string;

  @Prop({ type: String, index: true })
  stripe_subscription_id?: string;

  @Prop({ type: String })
  stripe_price_id?: string;

  @Prop({ type: String, required: true, enum: Object.values(PlanType) })
  plan: PlanType;

  @Prop({ type: String, required: true, enum: Object.values(BillingInterval) })
  billing_interval: BillingInterval;

  @Prop({ type: String, required: true, enum: Object.values(BillingCurrency) })
  currency: BillingCurrency;

  @Prop({ type: String, required: true, enum: Object.values(SubscriptionStatus) })
  status: SubscriptionStatus;

  @Prop({ type: Date })
  current_period_start?: Date;

  @Prop({ type: Date })
  current_period_end?: Date;

  @Prop({ type: Boolean, required: true, default: false })
  cancel_at_period_end: boolean;

  @Prop({ type: Date })
  cancel_at?: Date;

  @Prop({ type: Date })
  canceled_at?: Date;

  @Prop({ type: String })
  latest_invoice_id?: string;

  @Prop({ type: Date })
  created_at: Date;

  @Prop({ type: Date })
  updated_at: Date;
}

export type UserSubscriptionDocument = HydratedDocument<UserSubscriptionMongo>;
export const UserSubscriptionSchema = SchemaFactory.createForClass(UserSubscriptionMongo);
UserSubscriptionSchema.index({ user_id: 1, updated_at: -1 });
UserSubscriptionSchema.index(
  { provider: 1, provider_subscription_id: 1 },
  { unique: true, sparse: true }
);
