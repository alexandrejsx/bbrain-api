import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReflectiveProfileRepository } from '../../domain/conversation/repositories/reflective-profile.repository';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { ConversationMessageHistoryPort } from '../conversation/ports/conversation-message-history.port';

@Injectable()
export class AccountLifecycleService implements OnModuleInit, OnModuleDestroy {
  private sweepTimer?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository,
    private readonly reflectiveProfileRepository: ReflectiveProfileRepository,
    private readonly conversationMessageHistory: ConversationMessageHistoryPort
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
    await Promise.all([
      this.reflectiveProfileRepository.deleteByUserId(userId),
      this.conversationMessageHistory.deleteByUserId(userId)
    ]);

    await this.userRepository.delete(userId);
  }
}
