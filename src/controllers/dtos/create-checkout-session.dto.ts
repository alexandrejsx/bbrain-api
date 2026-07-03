import { IsEnum } from 'class-validator';
import {
  BillingCurrency,
  BillingInterval,
  PaymentMethodType,
  PlanType
} from '../../domain/plans/plan-definition';

export class CreateCheckoutSessionDto {
  @IsEnum(PlanType)
  plan: PlanType;

  @IsEnum(BillingInterval)
  billingInterval: BillingInterval;

  @IsEnum(BillingCurrency)
  currency: BillingCurrency;

  @IsEnum(PaymentMethodType)
  paymentMethod: PaymentMethodType;
}
