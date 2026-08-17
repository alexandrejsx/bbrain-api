import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards
} from '@nestjs/common';
import {
  AuthenticatedRequest,
  JwtAuthGuard
} from '../../infrastructure/http/guards/jwt-auth.guard';
import { AnswerDailyCheckInDto, StartDailyCheckInDto } from './daily-check-in.dto';
import { DailyCheckInService } from './daily-check-in.service';
import {
  DailyCheckInLockedError,
  DailyCheckInNotStartedError,
  DailyCheckInProviderUnavailableError,
  DailyCheckInRequestConflictError,
  DailyCheckInRequestInProgressError
} from './daily-check-in.types';

@Controller('daily-check-in')
@UseGuards(JwtAuthGuard)
export class DailyCheckInController {
  constructor(private readonly service: DailyCheckInService) {}

  @Get('status')
  status(@Req() request: AuthenticatedRequest) {
    return this.service.getStatus(request.user!.id);
  }

  @Post('start')
  async start(@Req() request: AuthenticatedRequest, @Body() dto: StartDailyCheckInDto) {
    try {
      return await this.service.start(request.user!.id, dto.locale);
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Post('dismiss')
  async dismiss(@Req() request: AuthenticatedRequest, @Body() dto: StartDailyCheckInDto) {
    try {
      return await this.service.dismiss(request.user!.id, dto.locale);
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Post('answer')
  async answer(@Req() request: AuthenticatedRequest, @Body() dto: AnswerDailyCheckInDto) {
    try {
      return await this.service.answer({ userId: request.user!.id, ...dto });
    } catch (error) {
      this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    if (error instanceof DailyCheckInLockedError) {
      throw new ForbiddenException({
        code: 'DAILY_CHECK_IN_LOCKED',
        message: 'O check-in guiado não está disponível para esta conta.'
      });
    }
    if (error instanceof DailyCheckInNotStartedError) {
      throw new NotFoundException({
        code: 'DAILY_CHECK_IN_NOT_STARTED',
        message: 'Inicie o check-in antes de responder.'
      });
    }
    if (error instanceof DailyCheckInRequestConflictError) {
      throw new ConflictException({
        code: 'DAILY_CHECK_IN_REQUEST_REUSED',
        message: 'Este identificador já foi usado em outra resposta.'
      });
    }
    if (error instanceof DailyCheckInRequestInProgressError) {
      throw new ConflictException({
        code: 'DAILY_CHECK_IN_PROCESSING',
        message: 'Uma resposta do check-in já está sendo processada.'
      });
    }
    if (error instanceof DailyCheckInProviderUnavailableError) {
      throw new ServiceUnavailableException(
        'Não foi possível continuar o check-in agora. Tente novamente em instantes.'
      );
    }
    throw error;
  }
}
