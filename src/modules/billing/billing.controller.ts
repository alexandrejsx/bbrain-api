import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  AuthenticatedRequest,
  JwtAuthGuard
} from '../../infrastructure/http/guards/jwt-auth.guard';
import { BillingService } from './billing.service';
import { CreateCheckoutSessionDto } from './create-checkout-session.dto';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('me')
  getMe(@Req() request: AuthenticatedRequest) {
    return this.billingService.getBillingSummary(request.user!.id);
  }

  @Post('checkout')
  createCheckoutSession(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateCheckoutSessionDto
  ) {
    return this.billingService.createCheckoutSession({
      userId: request.user!.id,
      plan: dto.plan,
      billingInterval: dto.billingInterval,
      requestedCurrency: dto.currency,
      paymentMethod: dto.paymentMethod
    });
  }

  @Post('portal')
  createPortalSession(@Req() request: AuthenticatedRequest) {
    return this.billingService.createCustomerPortalSession(request.user!.id);
  }

  @Get('payments/:paymentId')
  getPayment(@Req() request: AuthenticatedRequest, @Param('paymentId') paymentId: string) {
    return this.billingService.getPaymentOrder(request.user!.id, paymentId);
  }
}
