import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { Password } from '../../domain/users/value-objects/password.vo';
import { PasswordHashService } from '../../shared/services/password-hash.service';

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHashService: PasswordHashService
  ) {}

  async execute(input: ChangePasswordInput): Promise<{ message: string }> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const currentPasswordMatches = await this.passwordHashService.compare(
      input.currentPassword,
      user.passwordHash
    );

    if (!currentPasswordMatches) {
      throw new BadRequestException('A senha atual nao confere.');
    }

    const nextPassword = new Password(input.newPassword);
    const isSamePassword = await this.passwordHashService.compare(
      nextPassword.value,
      user.passwordHash
    );

    if (isSamePassword) {
      throw new BadRequestException('Escolha uma nova senha diferente da atual.');
    }

    const passwordHash = await this.passwordHashService.hash(nextPassword.value);
    user.updatePasswordHash(passwordHash);

    await this.userRepository.save(user);

    return {
      message: 'Sua senha foi atualizada com seguranca.'
    };
  }
}
