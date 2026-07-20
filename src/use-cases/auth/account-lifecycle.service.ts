import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReflectiveProfileRepository } from '../../domain/conversation/repositories/reflective-profile.repository';
import { ConversationStateRepository } from '../../domain/conversation/repositories/conversation-state.repository';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { WellbeingObservationRepository } from '../../domain/wellbeing-history/repositories/wellbeing-observation.repository';
import { ConversationExchangeLedgerPort } from '../conversation/ports/conversation-exchange-ledger.port';
import { WellbeingCaptureCoordinator } from '../wellbeing-history/wellbeing-capture-coordinator.service';

@Injectable()
export class AccountLifecycleService implements OnModuleInit, OnModuleDestroy {
  private sweepTimer?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository,
    private readonly reflectiveProfileRepository: ReflectiveProfileRepository,
    private readonly conversationStateRepository: ConversationStateRepository,
    private readonly conversationExchangeLedger: ConversationExchangeLedgerPort,
    private readonly wellbeingObservationRepository: WellbeingObservationRepository,
    private readonly wellbeingCaptureCoordinator: WellbeingCaptureCoordinator
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
    await this.wellbeingCaptureCoordinator.blockAndDrain(userId);

    await Promise.all([
      this.reflectiveProfileRepository.deleteByUserId(userId),
      this.conversationStateRepository.deleteByUserId(userId),
      this.conversationExchangeLedger.deleteByUserId(userId),
      this.wellbeingObservationRepository.deleteByUserId(userId)
    ]);

    await this.userRepository.delete(userId);
  }
}
