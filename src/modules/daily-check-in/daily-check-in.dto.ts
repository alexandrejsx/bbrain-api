import { Transform } from 'class-transformer';
import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

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
