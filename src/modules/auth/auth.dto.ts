import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from 'class-validator';
import { PlanType } from '../../domain/plans/plan-definition';
import { UserSex } from '../../domain/users/entities/user-profile.types';

const supportedLanguages = ['pt-BR', 'en-US', 'es-ES'] as const;

export class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}

export class RegisterDto {
  @IsString() name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsString() @IsNotEmpty() @MaxLength(32) phone: string;
  @IsString() @IsNotEmpty() @Matches(/^[A-Za-z]{2}$/) nationality: string;
  @IsOptional() @IsEnum(UserSex) sex?: UserSex;
  @IsString() @IsIn(supportedLanguages) language: (typeof supportedLanguages)[number];
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsEnum(PlanType) plan?: PlanType;
  @IsBoolean() acceptedTerms: boolean;
}

export class RequestPasswordResetDto {
  @IsEmail() email: string;
}

export class ConfirmPasswordResetDto {
  @IsEmail() email: string;
  @IsString() code: string;
  @IsString() @MinLength(8) newPassword: string;
}

export class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString() @MinLength(8) newPassword: string;
}
