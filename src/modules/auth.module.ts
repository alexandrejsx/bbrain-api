import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { AuthController } from '../controllers/auth.controller';
import { EventDispatcherAdapter } from '../domain/events/event-dispatcher.adapter';
import { UserRepository } from '../domain/users/repositories/user.repository';
import { JwtTokenService } from '../shared/services/jwt-token.service';
import { PasswordHashService } from '../shared/services/password-hash.service';
import { LoginUserUseCase } from '../use-cases/auth/login-user.use-case';
import { RegisterUserUseCase } from '../use-cases/auth/register-user.use-case';
import { JwtAuthGuard } from '../infrastructure/http/guards/jwt-auth.guard';
import { EventsModule } from './events.module';
import { EVENT_DISPATCHER, USERS_REPOSITORY } from './tokens';
import { UsersModule } from './users.module';

@Module({
  imports: [
    UsersModule,
    EventsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const expiresIn = config.get<string>('auth.jwtExpiresIn') || '7d';

        return {
          secret: config.get<string>('auth.jwtSecret') || 'local-secret',
          signOptions: {
            expiresIn: expiresIn as NonNullable<JwtModuleOptions['signOptions']>['expiresIn']
          }
        };
      },
      inject: [ConfigService]
    })
  ],
  controllers: [AuthController],
  providers: [
    PasswordHashService,
    JwtTokenService,
    JwtAuthGuard,
    {
      provide: EVENT_DISPATCHER,
      useExisting: EventDispatcherAdapter
    },
    {
      provide: RegisterUserUseCase,
      useFactory: (
        userRepository: UserRepository,
        passwordHashService: PasswordHashService,
        jwtTokenService: JwtTokenService,
        eventDispatcher: EventDispatcherAdapter
      ) => {
        return new RegisterUserUseCase(
          userRepository,
          passwordHashService,
          jwtTokenService,
          eventDispatcher
        );
      },
      inject: [USERS_REPOSITORY, PasswordHashService, JwtTokenService, EVENT_DISPATCHER]
    },
    {
      provide: LoginUserUseCase,
      useFactory: (
        userRepository: UserRepository,
        passwordHashService: PasswordHashService,
        jwtTokenService: JwtTokenService,
        eventDispatcher: EventDispatcherAdapter
      ) => {
        return new LoginUserUseCase(
          userRepository,
          passwordHashService,
          jwtTokenService,
          eventDispatcher
        );
      },
      inject: [USERS_REPOSITORY, PasswordHashService, JwtTokenService, EVENT_DISPATCHER]
    }
  ],
  exports: [JwtModule, RegisterUserUseCase, LoginUserUseCase, JwtAuthGuard]
})
export class AuthModule {}
