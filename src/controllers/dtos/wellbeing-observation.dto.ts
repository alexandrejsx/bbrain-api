import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min
} from 'class-validator';
import {
  WellbeingObservationKind,
  WELLBEING_OBSERVATION_KINDS
} from '../../domain/wellbeing-history/value-objects/wellbeing-observation.types';

export class ListWellbeingObservationsQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
      : String(value)
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
  )
  @IsArray()
  @IsIn(WELLBEING_OBSERVATION_KINDS, { each: true })
  kinds?: WellbeingObservationKind[];

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;
}

export class CreateWellbeingObservationDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  @MaxLength(128)
  clientRequestId?: string;

  @IsIn(WELLBEING_OBSERVATION_KINDS)
  kind: WellbeingObservationKind;

  @IsObject()
  data: Record<string, unknown>;

  @IsObject()
  temporalReference: Record<string, unknown>;
}

export class CorrectWellbeingObservationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision: number;

  @IsObject()
  data: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  temporalReference?: Record<string, unknown>;
}

export class DeleteWellbeingObservationQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision: number;
}
