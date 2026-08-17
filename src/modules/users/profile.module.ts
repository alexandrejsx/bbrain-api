import { Module } from '@nestjs/common';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { AuthModule } from '../auth/auth.module';
import { USERS_REPOSITORY } from '../tokens';
import { ChatStorageModule } from '../chat/chat-storage.module';
import { ChatSessionRepository } from '../chat/chat-session.repository';
import { PostConversationScheduler } from '../chat/post-conversation.processor';
import { PostProcessingModule } from '../chat/post-processing.module';
import { MemoryModule } from '../memory/memory.module';
import { CurrentContextRepository, MemoryRepository } from '../memory/memory.repository';
import { ProfileController } from './profile.controller';
import { UpdateUserProfileUseCase } from './update-user-profile.use-case';
import { UsersModule } from './users.module';

@Module({
  imports: [AuthModule, ChatStorageModule, PostProcessingModule, MemoryModule, UsersModule],
  controllers: [ProfileController],
  providers: [
    {
      provide: UpdateUserProfileUseCase,
      useFactory: (
        userRepository: UserRepository,
        sessions: ChatSessionRepository,
        currentContexts: CurrentContextRepository,
        memories: MemoryRepository,
        postConversation: PostConversationScheduler
      ) =>
        new UpdateUserProfileUseCase(userRepository, async (userId, allowed) => {
          if (allowed) {
            postConversation.allow(userId);
            return;
          }
          await postConversation.blockAndDrain(userId);
          await Promise.all([
            sessions.deleteByUserId(userId),
            currentContexts.deleteByUserId(userId),
            memories.deleteByUserId(userId)
          ]);
        }),
      inject: [
        USERS_REPOSITORY,
        ChatSessionRepository,
        CurrentContextRepository,
        MemoryRepository,
        PostConversationScheduler
      ]
    }
  ]
})
export class ProfileModule {}
