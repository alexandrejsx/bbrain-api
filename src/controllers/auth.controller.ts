import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, JwtAuthGuard } from '../infrastructure/http/guards/jwt-auth.guard';
import { ChangePasswordUseCase } from '../use-cases/auth/change-password.use-case';
import { ConfirmPasswordResetUseCase } from '../use-cases/auth/confirm-password-reset.use-case';
import { DeactivateUserAccountUseCase } from '../use-cases/auth/deactivate-user-account.use-case';
import { LoginUserUseCase } from '../use-cases/auth/login-user.use-case';
import { RequestPasswordResetUseCase } from '../use-cases/auth/request-password-reset.use-case';
import { RegisterUserUseCase } from '../use-cases/auth/register-user.use-case';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { ConfirmPasswordResetDto } from './dtos/confirm-password-reset.dto';
import { LoginDto } from './dtos/login.dto';
import { RequestPasswordResetDto } from './dtos/request-password-reset.dto';
import { RegisterDto } from './dtos/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly confirmPasswordResetUseCase: ConfirmPasswordResetUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly deactivateUserAccountUseCase: DeactivateUserAccountUseCase
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.registerUserUseCase.execute(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.loginUserUseCase.execute(dto);
  }

  @Post('forgot-password/request')
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.requestPasswordResetUseCase.execute(dto);
  }

  @Post('forgot-password/confirm')
  confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
    return this.confirmPasswordResetUseCase.execute(dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@Req() request: AuthenticatedRequest, @Body() dto: ChangePasswordDto) {
    return this.changePasswordUseCase.execute({
      userId: request.user!.id,
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword
    });
  }

  @Post('deactivate-account')
  @UseGuards(JwtAuthGuard)
  deactivateAccount(@Req() request: AuthenticatedRequest) {
    return this.deactivateUserAccountUseCase.execute({
      userId: request.user!.id
    });
  }
}
