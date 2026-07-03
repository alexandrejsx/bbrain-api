import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  BillingCurrency,
  BillingInterval,
  PaymentMethodType,
  PaymentProviderType,
  PaymentStatus,
  PlanType
} from '../../../../domain/plans/plan-definition';

@Schema({
  collection: 'payment_orders',
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
})
export class PaymentOrderMongo {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, index: true })
  user_id: string;

  @Prop({ type: String, required: true, enum: Object.values(PaymentProviderType), index: true })
  provider: PaymentProviderType;

  @Prop({ type: String, index: true })
  provider_payment_id?: string;

  @Prop({ type: String, required: true, enum: Object.values(PlanType) })
  plan: PlanType;

  @Prop({ type: String, required: true, enum: Object.values(BillingInterval) })
  billing_interval: BillingInterval;

  @Prop({ type: String, required: true, enum: Object.values(BillingCurrency) })
  currency: BillingCurrency;

  @Prop({ type: Number, required: true })
  amount_cents: number;

  @Prop({ type: String, required: true, enum: Object.values(PaymentStatus), index: true })
  status: PaymentStatus;

  @Prop({ type: String, required: true, enum: Object.values(PaymentMethodType) })
  payment_method: PaymentMethodType;

  @Prop({ type: Number, required: true })
  access_days: number;

  @Prop({ type: Boolean, required: true, default: false })
  is_plan_change: boolean;

  @Prop({ type: String, enum: Object.values(PlanType) })
  previous_plan?: PlanType;

  @Prop({ type: Number, required: true, default: 0 })
  credit_amount_cents: number;

  @Prop({ type: Number, required: true })
  amount_to_pay_cents: number;

  @Prop({ type: String })
  checkout_url?: string;

  @Prop({ type: String })
  qr_code_image?: string;

  @Prop({ type: String })
  qr_code_text?: string;

  @Prop({ type: Date })
  expires_at?: Date;

  @Prop({ type: Date })
  paid_at?: Date;

  @Prop({ type: Date })
  created_at: Date;

  @Prop({ type: Date })
  updated_at: Date;
}

export type PaymentOrderDocument = HydratedDocument<PaymentOrderMongo>;
export const PaymentOrderSchema = SchemaFactory.createForClass(PaymentOrderMongo);
PaymentOrderSchema.index({ provider: 1, provider_payment_id: 1 }, { unique: true, sparse: true });
PaymentOrderSchema.index({ user_id: 1, status: 1, updated_at: -1 });
