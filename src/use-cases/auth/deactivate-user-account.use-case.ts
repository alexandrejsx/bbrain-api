import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { AccountLifecycleService } from './account-lifecycle.service';

export interface DeactivateUserAccountInput {
  userId: string;
}

@Injectable()
export class DeactivateUserAccountUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly accountLifecycleService: AccountLifecycleService
  ) {}

  async execute(input: DeactivateUserAccountInput) {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const now = new Date();
    user.scheduleDeletion(this.accountLifecycleService.getGracePeriodDays(), now);
    await this.userRepository.save(user);

    return {
      message:
        'Sua conta foi desativada. Se mudar de ideia, basta entrar novamente antes da data programada.',
      deactivatedAt: now.toISOString(),
      scheduledDeletionAt: user.accountScheduledDeletionAt?.toISOString()
    };
  }
}
