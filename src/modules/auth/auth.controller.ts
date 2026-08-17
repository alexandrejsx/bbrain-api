import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  AuthenticatedRequest,
  JwtAuthGuard
} from '../../infrastructure/http/guards/jwt-auth.guard';
import { ChangePasswordUseCase } from './change-password.use-case';
import { ConfirmPasswordResetUseCase } from './confirm-password-reset.use-case';
import { DeactivateUserAccountUseCase } from './deactivate-user-account.use-case';
import { LoginUserUseCase } from './login-user.use-case';
import { RequestPasswordResetUseCase } from './request-password-reset.use-case';
import { RegisterUserUseCase } from './register-user.use-case';
import {
  ChangePasswordDto,
  ConfirmPasswordResetDto,
  LoginDto,
  RegisterDto,
  RequestPasswordResetDto
} from './auth.dto';

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
  async register(@Body() dto: RegisterDto) {
    return this.registerUserUseCase.execute(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.loginUserUseCase.execute(dto);
  }

  @Post('forgot-password/request')
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.requestPasswordResetUseCase.execute(dto);
  }

  @Post('forgot-password/confirm')
  async confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
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
