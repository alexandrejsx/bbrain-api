import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min
} from 'class-validator';
import { WellbeingKind } from './wellbeing.types';

export class ListWellbeingDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined
  )
  @IsIn(['mood_event', 'mood_daily_summary', 'sleep_record'], { each: true })
  kinds?: WellbeingKind[];
}

export class MoodOverviewDto {
  @IsOptional()
  @IsIn(['7d', '30d', '1y'])
  period: '7d' | '30d' | '1y' = '7d';

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(20)
  pageSize = 9;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone = 'UTC';
}

export class SleepOverviewDto extends MoodOverviewDto {}

export class CreateWellbeingDto {
  @IsUUID() clientRequestId: string;
  @IsIn(['mood_event', 'mood_daily_summary', 'sleep_record']) kind: WellbeingKind;
  @IsObject() data: Record<string, unknown>;
  @IsObject() temporalReference: Record<string, unknown>;
}

export class CorrectWellbeingDto {
  @IsInt() @Min(1) expectedRevision: number;
  @IsObject() data: Record<string, unknown>;
  @IsOptional() @IsObject() temporalReference?: Record<string, unknown>;
}

export class DeleteWellbeingDto {
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  expectedRevision: number;
}
