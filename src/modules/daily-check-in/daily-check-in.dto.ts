import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

export class StartDailyCheckInDto {
  @IsIn(['pt-BR', 'en-US', 'es-ES']) locale: 'pt-BR' | 'en-US' | 'es-ES';
}

export class AnswerDailyCheckInDto extends StartDailyCheckInDto {
  @IsUUID() clientRequestId: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;
}

export class SubmitDailyCheckInSleepDto extends StartDailyCheckInDto {
  @IsUUID() clientRequestId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/) recordDate: string;

  @IsInt() @Min(1) @Max(1440) durationMinutes: number;

  @IsIn(['very_tired', 'tired', 'fairly_rested', 'rested'])
  wakeRestfulness: 'very_tired' | 'tired' | 'fairly_rested' | 'rested';

  @IsIn(['under_15', '15_to_29', '30_to_59', '60_or_more'])
  awakeTimeDuringNight: 'under_15' | '15_to_29' | '30_to_59' | '60_or_more';

  @IsOptional()
  @IsIn(['up_to_15', '16_to_30', '31_to_60', 'over_60', 'unknown'])
  sleepLatency?: 'up_to_15' | '16_to_30' | '31_to_60' | 'over_60' | 'unknown';

  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) sleepOnsetTime?: string;

  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) wakeTime?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(240)
  note?: string;
}
