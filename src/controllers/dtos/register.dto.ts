import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsString,
  Matches,
  IsOptional,
  MaxLength,
  MinLength,
  IsNotEmpty
} from 'class-validator';
import { PlanType } from '../../domain/plans/plan-definition';
import { UserSex } from '../../domain/users/entities/user-profile.types';

const supportedLanguages = ['pt-BR', 'en-US', 'es-ES'] as const;

export class RegisterDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z]{2}$/)
  nationality: string;

  @IsOptional()
  @IsEnum(UserSex)
  sex?: UserSex;

  @IsString()
  @IsIn(supportedLanguages)
  language: (typeof supportedLanguages)[number];

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsEnum(PlanType)
  plan?: PlanType;

  @IsBoolean()
  acceptedTerms: boolean;
}
