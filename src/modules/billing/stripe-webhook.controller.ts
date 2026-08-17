import { BadRequestException, Controller, Post, Req } from '@nestjs/common';
import { BillingService } from './billing.service';

interface RawBodyRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
}

@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(private readonly billingService: BillingService) {}

  @Post()
  handle(@Req() request: RawBodyRequest) {
    const signature = request.headers['stripe-signature'];
    const stripeSignature = Array.isArray(signature) ? signature[0] : signature;

    if (!request.rawBody) {
      throw new BadRequestException('Raw body missing');
    }

    return this.billingService.handleStripeWebhook(request.rawBody, stripeSignature);
  }
}
