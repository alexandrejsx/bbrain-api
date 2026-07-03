import {
  BillingCurrency,
  BillingInterval,
  PaymentMethodType,
  PaymentProviderType,
  PlanType
} from '../plans/plan-definition';

export interface CreateCheckoutInput {
  userId: string;
  plan: Exclude<PlanType, PlanType.FREE>;
  billingInterval: BillingInterval;
  currency: BillingCurrency;
  paymentMethod: PaymentMethodType;
}

export interface CheckoutResult {
  provider: PaymentProviderType;
  type: 'redirect' | 'pix';
  url?: string;
  qrCodeImage?: string;
  qrCodeText?: string;
  paymentId?: string;
  expiresAt?: Date;
}
