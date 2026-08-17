import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import {
  AuthenticatedRequest,
  JwtAuthGuard
} from '../../infrastructure/http/guards/jwt-auth.guard';
import {
  InvalidWellbeingRecordError,
  toPublicWellbeingRecord,
  WellbeingIdempotencyConflictError,
  WellbeingNotFoundError,
  WellbeingRevisionConflictError
} from './wellbeing.types';
import {
  CorrectWellbeingDto,
  CreateWellbeingDto,
  DeleteWellbeingDto,
  ListWellbeingDto
} from './wellbeing.dto';
import { WellbeingService } from './wellbeing.service';

@Controller('wellbeing-history/observations')
@UseGuards(JwtAuthGuard)
export class WellbeingController {
  constructor(private readonly service: WellbeingService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest, @Query() query: ListWellbeingDto) {
    return {
      items: (await this.service.list(request.user!.id, query.kinds)).map(toPublicWellbeingRecord)
    };
  }

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() dto: CreateWellbeingDto) {
    try {
      return toPublicWellbeingRecord(await this.service.create(request.user!.id, dto));
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Patch(':id')
  async correct(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CorrectWellbeingDto
  ) {
    try {
      return toPublicWellbeingRecord(await this.service.correct(request.user!.id, id, dto));
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Query() query: DeleteWellbeingDto
  ) {
    try {
      await this.service.remove(request.user!.id, id, query.expectedRevision);
    } catch (error) {
      this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    if (error instanceof WellbeingNotFoundError)
      throw new NotFoundException('Registro não encontrado.');
    if (error instanceof WellbeingRevisionConflictError) {
      throw new ConflictException('O registro foi alterado. Atualize os dados e tente novamente.');
    }
    if (error instanceof WellbeingIdempotencyConflictError) {
      throw new ConflictException('Este identificador de requisição já foi usado.');
    }
    if (error instanceof InvalidWellbeingRecordError) {
      throw new BadRequestException('O registro contém dados inválidos ou incompletos.');
    }
    throw error;
  }
}
