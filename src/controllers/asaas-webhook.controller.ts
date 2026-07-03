import { BadRequestException, Controller, Post, Req } from '@nestjs/common';
import { BillingService } from '../use-cases/billing/billing.service';

interface RawBodyRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
}

@Controller('webhooks/asaas')
export class AsaasWebhookController {
  constructor(private readonly billingService: BillingService) {}

  @Post()
  handle(@Req() request: RawBodyRequest) {
    if (!request.rawBody) {
      throw new BadRequestException('Raw body missing');
    }

    return this.billingService.handleAsaasWebhook(request.rawBody, request.headers);
  }
}
