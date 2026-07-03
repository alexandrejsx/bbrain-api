import { PaymentOrder } from '../../../../domain/billing/entities/payment-order.entity';
import {
  normalizePaymentProviderType,
  PaymentProviderType
} from '../../../../domain/plans/plan-definition';
import { Uuid } from '../../../../domain/shared/uuid.vo';
import { PaymentOrderDocument, PaymentOrderMongo } from '../schemas/payment-order.schema';

export class MongoPaymentOrderMapper {
  static toPersistence(order: PaymentOrder): Partial<PaymentOrderMongo> {
    return {
      _id: order.id.value,
      user_id: order.userId,
      provider: order.provider,
      provider_payment_id: order.providerPaymentId,
      plan: order.plan,
      billing_interval: order.billingInterval,
      currency: order.currency,
      amount_cents: order.amountCents,
      status: order.status,
      payment_method: order.paymentMethod,
      access_days: order.accessDays,
      is_plan_change: order.isPlanChange,
      previous_plan: order.previousPlan,
      credit_amount_cents: order.creditAmountCents,
      amount_to_pay_cents: order.amountToPayCents,
      checkout_url: order.checkoutUrl,
      qr_code_image: order.qrCodeImage,
      qr_code_text: order.qrCodeText,
      expires_at: order.expiresAt,
      paid_at: order.paidAt,
      created_at: order.createdAt,
      updated_at: order.updatedAt
    };
  }

  static toDomain(raw: PaymentOrderDocument | PaymentOrderMongo): PaymentOrder {
    return PaymentOrder.reconstitute(
      {
        userId: raw.user_id,
        provider: normalizePaymentProviderType(raw.provider) ?? PaymentProviderType.ASAAS,
        providerPaymentId: raw.provider_payment_id,
        plan: raw.plan,
        billingInterval: raw.billing_interval,
        currency: raw.currency,
        amountCents: raw.amount_cents,
        status: raw.status,
        paymentMethod: raw.payment_method,
        accessDays: raw.access_days,
        isPlanChange: raw.is_plan_change,
        previousPlan: raw.previous_plan,
        creditAmountCents: raw.credit_amount_cents,
        amountToPayCents: raw.amount_to_pay_cents,
        checkoutUrl: raw.checkout_url,
        qrCodeImage: raw.qr_code_image,
        qrCodeText: raw.qr_code_text,
        expiresAt: raw.expires_at,
        paidAt: raw.paid_at,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at
      },
      new Uuid(raw._id)
    );
  }
}
