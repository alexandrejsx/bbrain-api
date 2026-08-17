import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Req,
  UseGuards
} from '@nestjs/common';
import {
  AuthenticatedRequest,
  JwtAuthGuard
} from '../../infrastructure/http/guards/jwt-auth.guard';
import {
  InsightsProPlanRequiredError,
  InsightsUserNotFoundError,
  ListInsightsService
} from './list-insights.service';

@Controller('insights')
@UseGuards(JwtAuthGuard)
export class InsightsController {
  constructor(private readonly listInsights: ListInsightsService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    try {
      return await this.listInsights.execute(request.user!.id);
    } catch (error) {
      if (error instanceof InsightsProPlanRequiredError) {
        throw new ForbiddenException({
          code: error.code,
          message: 'An active Pro plan is required to access insights.'
        });
      }

      if (error instanceof InsightsUserNotFoundError) {
        throw new NotFoundException({
          code: error.code,
          message: 'User not found.'
        });
      }

      throw error;
    }
  }
}
