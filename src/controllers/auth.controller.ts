import { Body, Controller, Post } from '@nestjs/common';
import { LoginUserUseCase } from '../use-cases/auth/login-user.use-case';
import { RegisterUserUseCase } from '../use-cases/auth/register-user.use-case';
import { LoginDto } from './dtos/login.dto';
import { RegisterDto } from './dtos/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.registerUserUseCase.execute(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.loginUserUseCase.execute(dto);
  }
}
