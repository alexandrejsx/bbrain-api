import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { AuthController } from '../controllers/auth.controller';
import { ReflectiveProfileRepository } from '../domain/conversation/repositories/reflective-profile.repository';
import { EventDispatcherAdapter } from '../domain/events/event-dispatcher.adapter';
import { UserRepository } from '../domain/users/repositories/user.repository';
import { JwtTokenService } from '../shared/services/jwt-token.service';
import { EmailService } from '../shared/services/email.service';
import { PasswordHashService } from '../shared/services/password-hash.service';
import { AccountLifecycleService } from '../use-cases/auth/account-lifecycle.service';
import { ChangePasswordUseCase } from '../use-cases/auth/change-password.use-case';
import { ConfirmPasswordResetUseCase } from '../use-cases/auth/confirm-password-reset.use-case';
import { DeactivateUserAccountUseCase } from '../use-cases/auth/deactivate-user-account.use-case';
import { LoginUserUseCase } from '../use-cases/auth/login-user.use-case';
import { RequestPasswordResetUseCase } from '../use-cases/auth/request-password-reset.use-case';
import { RegisterUserUseCase } from '../use-cases/auth/register-user.use-case';
import { JwtAuthGuard } from '../infrastructure/http/guards/jwt-auth.guard';
import { EventsModule } from './events.module';
import {
  AI_CONTEXT_MESSAGES_REPOSITORY,
  EVENT_DISPATCHER,
  REFLECTIVE_PROFILES_REPOSITORY,
  USERS_REPOSITORY
} from './tokens';
import { UsersModule } from './users.module';
import { AIContextModule } from './ai-context/ai-context.module';
import { AIContextMessageRepository } from './ai-context/ai-context-message.repository';

@Module({
  imports: [
    UsersModule,
    EventsModule,
    AIContextModule,
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
    EmailService,
    JwtAuthGuard,
    {
      provide: AccountLifecycleService,
      useFactory: (
        configService: ConfigService,
        userRepository: UserRepository,
        reflectiveProfileRepository: ReflectiveProfileRepository,
        aiContextMessageRepository: AIContextMessageRepository
      ) =>
        new AccountLifecycleService(
          configService,
          userRepository,
          reflectiveProfileRepository,
          aiContextMessageRepository
        ),
      inject: [
        ConfigService,
        USERS_REPOSITORY,
        REFLECTIVE_PROFILES_REPOSITORY,
        AI_CONTEXT_MESSAGES_REPOSITORY
      ]
    },
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
        reflectiveProfileRepository: ReflectiveProfileRepository,
        passwordHashService: PasswordHashService,
        jwtTokenService: JwtTokenService,
        eventDispatcher: EventDispatcherAdapter,
        accountLifecycleService: AccountLifecycleService
      ) => {
        return new LoginUserUseCase(
          userRepository,
          reflectiveProfileRepository,
          passwordHashService,
          jwtTokenService,
          eventDispatcher,
          accountLifecycleService
        );
      },
      inject: [
        USERS_REPOSITORY,
        REFLECTIVE_PROFILES_REPOSITORY,
        PasswordHashService,
        JwtTokenService,
        EVENT_DISPATCHER,
        AccountLifecycleService
      ]
    },
    {
      provide: RequestPasswordResetUseCase,
      useFactory: (
        configService: ConfigService,
        userRepository: UserRepository,
        passwordHashService: PasswordHashService,
        emailService: EmailService,
        accountLifecycleService: AccountLifecycleService
      ) =>
        new RequestPasswordResetUseCase(
          configService,
          userRepository,
          passwordHashService,
          emailService,
          accountLifecycleService
        ),
      inject: [
        ConfigService,
        USERS_REPOSITORY,
        PasswordHashService,
        EmailService,
        AccountLifecycleService
      ]
    },
    {
      provide: ConfirmPasswordResetUseCase,
      useFactory: (
        userRepository: UserRepository,
        passwordHashService: PasswordHashService,
        accountLifecycleService: AccountLifecycleService
      ) =>
        new ConfirmPasswordResetUseCase(
          userRepository,
          passwordHashService,
          accountLifecycleService
        ),
      inject: [USERS_REPOSITORY, PasswordHashService, AccountLifecycleService]
    },
    {
      provide: ChangePasswordUseCase,
      useFactory: (userRepository: UserRepository, passwordHashService: PasswordHashService) =>
        new ChangePasswordUseCase(userRepository, passwordHashService),
      inject: [USERS_REPOSITORY, PasswordHashService]
    },
    {
      provide: DeactivateUserAccountUseCase,
      useFactory: (
        userRepository: UserRepository,
        accountLifecycleService: AccountLifecycleService
      ) => new DeactivateUserAccountUseCase(userRepository, accountLifecycleService),
      inject: [USERS_REPOSITORY, AccountLifecycleService]
    }
  ],
  exports: [JwtModule, RegisterUserUseCase, LoginUserUseCase, JwtAuthGuard]
})
export class AuthModule {}
