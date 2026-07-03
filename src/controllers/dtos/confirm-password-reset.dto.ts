import { IsEmail, IsString, MinLength } from 'class-validator';

export class ConfirmPasswordResetDto {
  @IsEmail()
  email: string;

  @IsString()
  code: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
