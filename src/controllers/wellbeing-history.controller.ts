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
import { AuthenticatedRequest, JwtAuthGuard } from '../infrastructure/http/guards/jwt-auth.guard';
import {
  InvalidWellbeingObservationError,
  ManageWellbeingHistoryService,
  WellbeingObservationIdempotencyConflictError,
  WellbeingObservationNotFoundError,
  WellbeingObservationRevisionConflictError
} from '../use-cases/wellbeing-history/manage-wellbeing-history.service';
import {
  CorrectWellbeingObservationDto,
  CreateWellbeingObservationDto,
  DeleteWellbeingObservationQueryDto,
  ListWellbeingObservationsQueryDto
} from './dtos/wellbeing-observation.dto';
import { WellbeingObservation } from '../domain/wellbeing-history/entities/wellbeing-observation.entity';
import { WellbeingObservationProvenance } from '../domain/wellbeing-history/value-objects/wellbeing-observation.types';

function toPublicProvenance(provenance: WellbeingObservationProvenance) {
  return provenance.source === 'conversation_extraction'
    ? {
        source: provenance.source,
        sourceMessageId: provenance.sourceMessageId,
        conversationId: provenance.conversationId,
        confidence: provenance.confidence,
        ...('correctsObservationId' in provenance
          ? { correctsObservationId: provenance.correctsObservationId }
          : {})
      }
    : provenance;
}

function toPublicObservation(observation: WellbeingObservation) {
  const snapshot = observation.toJson();

  return {
    id: observation.id.value,
    kind: observation.kind,
    data: snapshot.data,
    temporalReference: snapshot.temporalReference,
    provenance: toPublicProvenance(observation.currentProvenance),
    provenanceHistory: observation.provenanceHistory.map(toPublicProvenance),
    revision: observation.revision,
    createdAt: observation.createdAt.toISOString(),
    updatedAt: observation.updatedAt.toISOString()
  };
}

@Controller('wellbeing-history/observations')
@UseGuards(JwtAuthGuard)
export class WellbeingHistoryController {
  constructor(private readonly service: ManageWellbeingHistoryService) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListWellbeingObservationsQueryDto
  ) {
    const observations = await this.service.list(request.user!.id, {
      kinds: query.kinds,
      createdFrom: query.createdFrom ? new Date(query.createdFrom) : undefined,
      createdTo: query.createdTo ? new Date(query.createdTo) : undefined
    });

    return { items: observations.map(toPublicObservation) };
  }

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() dto: CreateWellbeingObservationDto) {
    try {
      const observation = await this.service.createManual({
        userId: request.user!.id,
        clientRequestId: dto.clientRequestId,
        kind: dto.kind,
        data: dto.data,
        temporalReference: dto.temporalReference
      });
      return toPublicObservation(observation);
    } catch (error) {
      this.rethrowHttpError(error);
    }
  }

  @Patch(':observationId')
  async correct(
    @Req() request: AuthenticatedRequest,
    @Param('observationId') observationId: string,
    @Body() dto: CorrectWellbeingObservationDto
  ) {
    try {
      const observation = await this.service.correctManually({
        userId: request.user!.id,
        observationId,
        expectedRevision: dto.expectedRevision,
        data: dto.data,
        temporalReference: dto.temporalReference
      });
      return toPublicObservation(observation);
    } catch (error) {
      this.rethrowHttpError(error);
    }
  }

  @Delete(':observationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('observationId') observationId: string,
    @Query() query: DeleteWellbeingObservationQueryDto
  ): Promise<void> {
    try {
      await this.service.remove(request.user!.id, observationId, query.expectedRevision);
    } catch (error) {
      this.rethrowHttpError(error);
    }
  }

  private rethrowHttpError(error: unknown): never {
    if (error instanceof WellbeingObservationNotFoundError) {
      throw new NotFoundException('Registro não encontrado.');
    }
    if (error instanceof WellbeingObservationRevisionConflictError) {
      throw new ConflictException('O registro foi alterado. Atualize os dados e tente novamente.');
    }
    if (error instanceof WellbeingObservationIdempotencyConflictError) {
      throw new ConflictException(
        'Este identificador de requisição já foi usado para outro registro.'
      );
    }
    if (error instanceof InvalidWellbeingObservationError) {
      throw new BadRequestException('O registro contém dados inválidos ou incompletos.');
    }

    throw error;
  }
}
