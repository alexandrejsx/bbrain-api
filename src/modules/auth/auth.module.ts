import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { JwtAuthGuard } from '../../infrastructure/http/guards/jwt-auth.guard';
import { JwtTokenService } from '../../shared/services/jwt-token.service';
import { EmailService } from '../../shared/services/email.service';
import { PasswordHashService } from '../../shared/services/password-hash.service';
import { USERS_REPOSITORY } from '../tokens';
import { UsersModule } from '../users/users.module';
import { ChatStorageModule } from '../chat/chat-storage.module';
import { ChatRequestRepository, ChatSessionRepository } from '../chat/chat-session.repository';
import { PostProcessingModule } from '../chat/post-processing.module';
import { PostConversationScheduler } from '../chat/post-conversation.processor';
import { MemoryModule } from '../memory/memory.module';
import { CurrentContextRepository, MemoryRepository } from '../memory/memory.repository';
import { MoodModule } from '../mood/mood.module';
import { MoodRepository } from '../mood/mood.repository';
import { SleepModule } from '../sleep/sleep.module';
import { SleepRepository } from '../sleep/sleep.repository';
import { AccountLifecycleService } from './account-lifecycle.service';
import { ChangePasswordUseCase } from './change-password.use-case';
import { ConfirmPasswordResetUseCase } from './confirm-password-reset.use-case';
import { DeactivateUserAccountUseCase } from './deactivate-user-account.use-case';
import { LoginUserUseCase } from './login-user.use-case';
import { RequestPasswordResetUseCase } from './request-password-reset.use-case';
import { RegisterUserUseCase } from './register-user.use-case';

@Module({
  imports: [
    UsersModule,
    ChatStorageModule,
    PostProcessingModule,
    MemoryModule,
    MoodModule,
    SleepModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const expiresIn = config.get<string>('auth.jwtExpiresIn') || '7d';
        const secret = config.get<string>('auth.jwtSecret');

        if (!secret) {
          throw new Error('auth.jwtSecret configuration is required');
        }

        return {
          secret,
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
        sessions: ChatSessionRepository,
        chatRequests: ChatRequestRepository,
        currentContexts: CurrentContextRepository,
        memories: MemoryRepository,
        moods: MoodRepository,
        sleep: SleepRepository,
        postConversation: PostConversationScheduler
      ) =>
        new AccountLifecycleService(
          configService,
          userRepository,
          sessions,
          chatRequests,
          currentContexts,
          memories,
          moods,
          sleep,
          postConversation
        ),
      inject: [
        ConfigService,
        USERS_REPOSITORY,
        ChatSessionRepository,
        ChatRequestRepository,
        CurrentContextRepository,
        MemoryRepository,
        MoodRepository,
        SleepRepository,
        PostConversationScheduler
      ]
    },
    {
      provide: RegisterUserUseCase,
      useFactory: (
        userRepository: UserRepository,
        passwordHashService: PasswordHashService,
        jwtTokenService: JwtTokenService
      ) => {
        return new RegisterUserUseCase(userRepository, passwordHashService, jwtTokenService);
      },
      inject: [USERS_REPOSITORY, PasswordHashService, JwtTokenService]
    },
    {
      provide: LoginUserUseCase,
      useFactory: (
        userRepository: UserRepository,
        passwordHashService: PasswordHashService,
        jwtTokenService: JwtTokenService,
        accountLifecycleService: AccountLifecycleService
      ) => {
        return new LoginUserUseCase(
          userRepository,
          passwordHashService,
          jwtTokenService,
          accountLifecycleService
        );
      },
      inject: [USERS_REPOSITORY, PasswordHashService, JwtTokenService, AccountLifecycleService]
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
