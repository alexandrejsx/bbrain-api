import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../infrastructure/http/guards/jwt-auth.guard';
import { AccountPlanService } from '../use-cases/plans/account-plan.service';

@Controller('plans')
@UseGuards(JwtAuthGuard)
export class PlansController {
  constructor(private readonly accountPlanService: AccountPlanService) {}

  @Get()
  listPlans() {
    return this.accountPlanService.listPlans();
  }
}
