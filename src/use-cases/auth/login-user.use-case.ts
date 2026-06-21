import { Injectable, UnauthorizedException } from '@nestjs/common';
import { EventDispatcher } from '../../domain/core/event-dispatcher';
import { ReflectiveProfileRepository } from '../../domain/conversation/repositories/reflective-profile.repository';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { Email } from '../../domain/users/value-objects/email.vo';
import { JwtTokenService } from '../../shared/services/jwt-token.service';
import { PasswordHashService } from '../../shared/services/password-hash.service';
import { UseCase } from '../use-case.interface';
import { AuthResponse } from './auth-response';
import { resolveUserProfileSnapshot } from '../profile/user-profile-snapshot.utils';

export interface LoginUserInput {
  email: string;
  password: string;
}

@Injectable()
export class LoginUserUseCase implements UseCase<LoginUserInput, AuthResponse> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly reflectiveProfileRepository: ReflectiveProfileRepository,
    private readonly passwordHashService: PasswordHashService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly eventDispatcher: EventDispatcher
  ) {}

  async execute(input: LoginUserInput): Promise<AuthResponse> {
    const email = new Email(input.email);
    const user = await this.userRepository.findByEmail(email.value);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await this.passwordHashService.compare(
      input.password,
      user.passwordHash
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    user.markLoggedIn();

    const reflectiveProfile = await this.reflectiveProfileRepository.findByUserId(user.id.value);
    const profile = resolveUserProfileSnapshot(user, user.profile, reflectiveProfile);
    user.updateProfile(profile);

    await this.userRepository.save(user);
    await this.eventDispatcher.dispatch(user.pullDomainEvents());

    return {
      user: user.toJson(),
      profile,
      accessToken: await this.jwtTokenService.signUser(user)
    };
  }
}
