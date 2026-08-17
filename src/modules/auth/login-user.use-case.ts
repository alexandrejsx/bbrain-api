import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { Email } from '../../domain/users/value-objects/email.vo';
import { JwtTokenService } from '../../shared/services/jwt-token.service';
import { PasswordHashService } from '../../shared/services/password-hash.service';
import { resolveUserProfileSnapshot } from '../users/profile-snapshot';
import { AccountLifecycleService } from './account-lifecycle.service';
import { AuthResponse } from './auth-response';

export interface LoginUserInput {
  email: string;
  password: string;
}

@Injectable()
export class LoginUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHashService: PasswordHashService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly accountLifecycleService: AccountLifecycleService
  ) {}

  async execute(input: LoginUserInput): Promise<AuthResponse> {
    const email = new Email(input.email);
    const user = await this.userRepository.findByEmail(email.value);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isDeletionDue()) {
      await this.accountLifecycleService.purgeUserAccount(user.id.value);
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await this.passwordHashService.compare(
      input.password,
      user.passwordHash
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.canBeReactivated()) {
      user.reactivate();
    }

    user.markLoggedIn();

    const profile = resolveUserProfileSnapshot(user, user.profile);
    user.updateProfile(profile);

    await this.userRepository.save(user);
    return {
      user: user.toJson(),
      profile,
      accessToken: await this.jwtTokenService.signUser(user)
    };
  }
}
