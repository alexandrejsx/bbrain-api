import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentOrder } from '../../../domain/billing/entities/payment-order.entity';
import { User } from '../../../domain/users/entities/user.entity';

export interface AsaasPixChargeResult {
  customerId?: string;
  providerPaymentId: string;
  checkoutUrl?: string;
  qrCodeImage?: string;
  qrCodeText?: string;
  expiresAt?: Date;
}

export interface AsaasWebhookEvent {
  providerEventId: string;
  type: string;
  providerPaymentId?: string;
  correlationId?: string;
  paid: boolean;
  expired: boolean;
  canceled: boolean;
  failed: boolean;
}

type HeaderBag = Record<string, string | string[] | undefined>;

type AsaasCustomerResponse = {
  id?: string;
};

type AsaasPaymentResponse = {
  id?: string;
  invoiceUrl?: string;
  dueDate?: string;
};

type AsaasPixQrCodeResponse = {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
};

export class AsaasPixProvider {
  constructor(private readonly config: ConfigService) {}

  async createPixCharge(input: {
    order: PaymentOrder;
    user: User;
    amount: number;
    expiresAt: Date;
  }): Promise<AsaasPixChargeResult> {
    const customerId = input.user.asaasCustomerId ?? (await this.ensureCustomer(input.user));
    const payment = await this.request<AsaasPaymentResponse>('/payments', {
      method: 'POST',
      body: JSON.stringify({
        customer: customerId,
        billingType: 'PIX',
        value: centsToAmount(input.amount),
        dueDate: toDateOnly(input.expiresAt),
        description: `BBrain ${input.order.plan} ${input.order.billingInterval}`,
        externalReference: input.order.id.value
        // TODO: avaliar callback/redirect do Asaas quando o fluxo Pix migrar para uma tela hospedada.
      })
    });
    const providerPaymentId = payment.id ?? input.order.id.value;
    const qrCode = await this.request<AsaasPixQrCodeResponse>(
      `/payments/${providerPaymentId}/pixQrCode`
    );

    return {
      customerId,
      providerPaymentId,
      checkoutUrl: payment.invoiceUrl,
      qrCodeImage: qrCode.encodedImage,
      qrCodeText: qrCode.payload,
      expiresAt: parseDate(qrCode.expirationDate ?? payment.dueDate) ?? input.expiresAt
    };
  }

  parseWebhook(rawBody: Buffer, headers: HeaderBag): AsaasWebhookEvent {
    this.validateWebhook(headers);

    const payload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    const payment =
      readObject(payload.payment) ??
      readObject(readObject(payload.data)?.payment) ??
      readObject(payload.data) ??
      payload;
    const type = (readString(payload.event) ?? readString(payload.type) ?? 'asaas.event').trim();
    const normalizedType = type.toUpperCase();
    const status = (
      readString(payment.status) ??
      readString(payload.status) ??
      readString(payload.event) ??
      type
    ).toLowerCase();

    return {
      providerEventId:
        readString(payload.eventId) ??
        readString(payload.id) ??
        `${type}:${readString(payment.id) ?? readString(payment.externalReference) ?? Date.now()}`,
      type,
      providerPaymentId: readString(payment.id),
      correlationId: readString(payment.externalReference),
      paid:
        normalizedType === 'PAYMENT_RECEIVED' ||
        normalizedType === 'PAYMENT_CONFIRMED' ||
        status === 'received' ||
        status === 'confirmed',
      expired:
        normalizedType === 'PAYMENT_OVERDUE' ||
        normalizedType === 'PAYMENT_EXPIRED' ||
        status.includes('expired') ||
        status.includes('overdue'),
      canceled:
        normalizedType === 'PAYMENT_DELETED' ||
        normalizedType === 'PAYMENT_CANCELED' ||
        status.includes('canceled') ||
        status.includes('cancelled'),
      failed:
        normalizedType === 'PAYMENT_REFUNDED' ||
        normalizedType === 'PAYMENT_REPROVED_BY_RISK_ANALYSIS' ||
        normalizedType === 'PAYMENT_REFUSED' ||
        status.includes('failed') ||
        status.includes('refunded')
    };
  }

  private validateWebhook(headers: HeaderBag): void {
    const secret = this.config.get<string>('billing.asaasWebhookSecret');

    if (!secret) {
      throw new ServiceUnavailableException('Asaas webhook is not configured');
    }

    const token =
      readHeader(headers, 'asaas-access-token') ??
      readHeader(headers, 'x-webhook-secret') ??
      readHeader(headers, 'x-asaas-secret');

    if (token !== secret) {
      throw new BadRequestException('Invalid Asaas webhook signature');
    }
  }

  private async ensureCustomer(user: User): Promise<string> {
    const customer = await this.request<AsaasCustomerResponse>('/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: user.name.value,
        email: user.email.value,
        mobilePhone: sanitizePhone(user.phone),
        externalReference: user.id.value,
        notificationDisabled: true
        // TODO: incluir cpfCnpj quando o onboarding coletar o documento do usuário para produção.
      })
    });

    if (!customer.id) {
      throw new ServiceUnavailableException('Não foi possível preparar o pagamento via Pix.');
    }

    return customer.id;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const apiKey = this.config.get<string>('billing.asaasApiKey');

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Este método de pagamento ainda não está disponível. Tente outro método ou aguarde a configuração.'
      );
    }

    const response = await fetch(`${this.getApiUrl()}/v3${path}`, {
      ...init,
      headers: {
        access_token: apiKey,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {})
      }
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        'Não foi possível gerar o Pix agora. Tente outro método ou aguarde alguns instantes.'
      );
    }

    return (await response.json()) as T;
  }

  private getApiUrl(): string {
    const configuredUrl = this.config.get<string>('billing.asaasApiUrl');
    return configuredUrl?.replace(/\/(?:api\/v1|v3)\/?$/, '') ?? 'https://api.asaas.com.br';
  }
}

function readHeader(headers: HeaderBag, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function readObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parseDate(value?: string): Date | undefined {
  return value ? new Date(value) : undefined;
}

function sanitizePhone(phone?: string): string | undefined {
  if (!phone) {
    return undefined;
  }

  const digits = phone.replace(/\D/g, '');
  return digits.length > 0 ? digits : undefined;
}

function centsToAmount(amountCents: number): number {
  return Number((amountCents / 100).toFixed(2));
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
