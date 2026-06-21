import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength
} from 'class-validator';
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
  phone?: string;

  @IsOptional()
  @IsEnum(UserSex)
  sex?: UserSex;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsBoolean()
  acceptedTerms: boolean;
}
