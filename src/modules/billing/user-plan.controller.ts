import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Patch,
  Req,
  UseGuards
} from '@nestjs/common';
import {
  AuthenticatedRequest,
  JwtAuthGuard
} from '../../infrastructure/http/guards/jwt-auth.guard';
import {
  UsageLimitError,
  UsageService,
  UsageUserNotFoundError
} from '../../domain/usage/services/usage.service';
import { AccountPlanService } from './account-plan.service';
import { UpdateMyPlanDto } from './update-my-plan.dto';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UserPlanController {
  constructor(
    private readonly accountPlanService: AccountPlanService,
    private readonly usageService: UsageService
  ) {}

  @Get('plan')
  getPlan(@Req() request: AuthenticatedRequest) {
    return this.accountPlanService.getCurrentPlan(request.user!.id);
  }

  @Patch('plan')
  updatePlan(@Req() request: AuthenticatedRequest, @Body() dto: UpdateMyPlanDto) {
    return this.accountPlanService.updatePlan(request.user!.id, dto.plan);
  }

  @Get('usage')
  async getUsage(@Req() request: AuthenticatedRequest) {
    try {
      return await this.usageService.getUsageSummary(request.user!.id);
    } catch (error) {
      if (error instanceof UsageLimitError) {
        throw new HttpException(
          {
            code: error.code,
            message: error.message,
            details: error.details
          },
          HttpStatus.FORBIDDEN
        );
      }

      if (error instanceof UsageUserNotFoundError) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      throw error;
    }
  }
}
