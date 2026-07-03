import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator';
import { PlanType } from '../../domain/plans/plan-definition';
import { UserSex } from '../../domain/users/entities/user-profile.types';

export class RegisterDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsEnum(UserSex)
  sex?: UserSex;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsEnum(PlanType)
  plan?: PlanType;

  @IsBoolean()
  acceptedTerms: boolean;
}
