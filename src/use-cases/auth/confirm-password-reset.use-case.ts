import { BadRequestException, Injectable } from '@nestjs/common';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { Email } from '../../domain/users/value-objects/email.vo';
import { Password } from '../../domain/users/value-objects/password.vo';
import { PasswordHashService } from '../../shared/services/password-hash.service';
import { AccountLifecycleService } from './account-lifecycle.service';

export interface ConfirmPasswordResetInput {
  email: string;
  code: string;
  newPassword: string;
}

@Injectable()
export class ConfirmPasswordResetUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHashService: PasswordHashService,
    private readonly accountLifecycleService: AccountLifecycleService
  ) {}

  async execute(input: ConfirmPasswordResetInput): Promise<{ message: string }> {
    const email = new Email(input.email);
    const user = await this.userRepository.findByEmail(email.value);

    if (!user) {
      throw new BadRequestException('Codigo invalido ou expirado.');
    }

    if (user.isDeletionDue()) {
      await this.accountLifecycleService.purgeUserAccount(user.id.value);
      throw new BadRequestException('Codigo invalido ou expirado.');
    }

    if (!user.passwordResetCodeHash || !user.hasActivePasswordReset()) {
      throw new BadRequestException('Codigo invalido ou expirado.');
    }

    const codeMatches = await this.passwordHashService.compare(
      input.code.trim(),
      user.passwordResetCodeHash
    );

    if (!codeMatches) {
      throw new BadRequestException('Codigo invalido ou expirado.');
    }

    const password = new Password(input.newPassword);
    const passwordHash = await this.passwordHashService.hash(password.value);
    user.updatePasswordHash(passwordHash);

    await this.userRepository.save(user);

    return {
      message: 'Sua senha foi redefinida. Voce ja pode entrar novamente.'
    };
  }
}
