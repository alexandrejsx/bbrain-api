import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { ChatRequestRepository, ChatSessionRepository } from '../chat/chat-session.repository';
import { PostConversationScheduler } from '../chat/post-conversation.processor';
import { CurrentContextRepository, MemoryRepository } from '../memory/memory.repository';
import { MoodRepository } from '../mood/mood.repository';
import { SleepRepository } from '../sleep/sleep.repository';

@Injectable()
export class AccountLifecycleService implements OnModuleInit, OnModuleDestroy {
  private sweepTimer?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository,
    private readonly sessions: ChatSessionRepository,
    private readonly chatRequests: ChatRequestRepository,
    private readonly currentContexts: CurrentContextRepository,
    private readonly memories: MemoryRepository,
    private readonly moods: MoodRepository,
    private readonly sleep: SleepRepository,
    private readonly postConversation: PostConversationScheduler
  ) {}

  onModuleInit(): void {
    const intervalMs =
      this.configService.get<number>('auth.accountDeletionSweepIntervalMs') || 60 * 60 * 1000;

    void this.purgeExpiredAccounts();

    this.sweepTimer = setInterval(() => {
      void this.purgeExpiredAccounts();
    }, intervalMs);
    this.sweepTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
    }
  }

  getGracePeriodDays(): number {
    return this.configService.get<number>('auth.accountDeletionGraceDays') || 7;
  }

  async purgeExpiredAccounts(referenceDate = new Date()): Promise<number> {
    const dueUsers = await this.userRepository.findScheduledForDeletionDueBefore(referenceDate);

    for (const user of dueUsers) {
      await this.purgeUserAccount(user.id.value);
    }

    return dueUsers.length;
  }

  async purgeUserAccount(userId: string): Promise<void> {
    await this.postConversation.blockAndDrain(userId);

    await Promise.all([
      this.sessions.deleteByUserId(userId),
      this.chatRequests.deleteByUserId(userId),
      this.currentContexts.deleteByUserId(userId),
      this.memories.deleteByUserId(userId),
      this.moods.deleteByUserId(userId),
      this.sleep.deleteByUserId(userId)
    ]);

    await this.userRepository.delete(userId);
  }
}
