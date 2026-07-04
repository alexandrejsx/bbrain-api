import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { AuthController } from '../controllers/auth.controller';
import type { EventDispatcher } from '../domain/core/event-dispatcher';
import { ReflectiveProfileRepository } from '../domain/conversation/repositories/reflective-profile.repository';
import { UserRepository } from '../domain/users/repositories/user.repository';
import { JwtAuthGuard } from '../infrastructure/http/guards/jwt-auth.guard';
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
import { ConversationMessageHistoryPort } from '../use-cases/conversation/ports/conversation-message-history.port';
import { ConversationContextModule } from './conversation-context.module';
import { EventsModule } from './events.module';
import {
  CONVERSATION_MESSAGE_HISTORY_REPOSITORY,
  EVENT_DISPATCHER,
  REFLECTIVE_PROFILES_REPOSITORY,
  USERS_REPOSITORY
} from './tokens';
import { UsersModule } from './users.module';

@Module({
  imports: [
    UsersModule,
    EventsModule,
    ConversationContextModule,
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
        conversationMessageHistory: ConversationMessageHistoryPort
      ) =>
        new AccountLifecycleService(
          configService,
          userRepository,
          reflectiveProfileRepository,
          conversationMessageHistory
        ),
      inject: [
        ConfigService,
        USERS_REPOSITORY,
        REFLECTIVE_PROFILES_REPOSITORY,
        CONVERSATION_MESSAGE_HISTORY_REPOSITORY
      ]
    },
    {
      provide: RegisterUserUseCase,
      useFactory: (
        userRepository: UserRepository,
        passwordHashService: PasswordHashService,
        jwtTokenService: JwtTokenService,
        eventDispatcher: EventDispatcher
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
        eventDispatcher: EventDispatcher,
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
