import { Module } from '@nestjs/common';
import { ProfileController } from '../controllers/profile.controller';
import { ReflectiveProfileRepository } from '../domain/conversation/repositories/reflective-profile.repository';
import { UserRepository } from '../domain/users/repositories/user.repository';
import { UpdateUserProfileUseCase } from '../use-cases/conversation/update-user-profile.use-case';
import { AuthModule } from './auth.module';
import { ConversationContextModule } from './conversation-context.module';
import { REFLECTIVE_PROFILES_REPOSITORY, USERS_REPOSITORY } from './tokens';
import { UsersModule } from './users.module';

@Module({
  imports: [AuthModule, ConversationContextModule, UsersModule],
  controllers: [ProfileController],
  providers: [
    {
      provide: UpdateUserProfileUseCase,
      useFactory: (
        profileRepository: ReflectiveProfileRepository,
        userRepository: UserRepository
      ) => new UpdateUserProfileUseCase(profileRepository, userRepository),
      inject: [REFLECTIVE_PROFILES_REPOSITORY, USERS_REPOSITORY]
    }
  ]
})
export class ProfileModule {}
