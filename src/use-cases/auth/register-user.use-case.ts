import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import parsePhoneNumberFromString from 'libphonenumber-js';
import { EventDispatcher } from '../../domain/core/event-dispatcher';
import { User } from '../../domain/users/entities/user.entity';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { Email } from '../../domain/users/value-objects/email.vo';
import { Password } from '../../domain/users/value-objects/password.vo';
import { UserName } from '../../domain/users/value-objects/user-name.vo';
import { JwtTokenService } from '../../shared/services/jwt-token.service';
import { PasswordHashService } from '../../shared/services/password-hash.service';
import { UseCase } from '../use-case.interface';
import { AuthResponse } from './auth-response';
import { createDefaultUserProfileSnapshot } from '../profile/user-profile-snapshot.utils';
import { UserSex } from '../../domain/users/entities/user-profile.types';
import { PlanType } from '../../domain/plans/plan-definition';

const supportedLanguages = new Set(['pt-BR', 'en-US', 'es-ES']);

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
  phone: string;
  nationality: string;
  language: string;
  sex?: UserSex;
  timezone?: string;
  plan?: PlanType;
  acceptedTerms: boolean;
}

@Injectable()
export class RegisterUserUseCase implements UseCase<RegisterUserInput, AuthResponse> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHashService: PasswordHashService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly eventDispatcher: EventDispatcher
  ) {}

  async execute(input: RegisterUserInput): Promise<AuthResponse> {
    if (input.acceptedTerms !== true) {
      throw new BadRequestException('Terms must be accepted');
    }

    if (!input.nationality?.trim()) {
      throw new BadRequestException('Nationality is required');
    }

    if (!/^[A-Za-z]{2}$/.test(input.nationality)) {
      throw new BadRequestException('Nationality is invalid');
    }

    if (!supportedLanguages.has(input.language)) {
      throw new BadRequestException('Language is invalid');
    }

    const email = new Email(input.email);
    const exists = await this.userRepository.findByEmail(email.value);

    if (exists) {
      throw new ConflictException('Email already registered');
    }

    const password = new Password(input.password);
    const passwordHash = await this.passwordHashService.hash(password.value);
    const acceptedTermsAt = new Date();
    if (!input.phone?.trim()) {
      throw new BadRequestException('Phone is required');
    }

    const phone = normalizeInternationalPhoneNumber(input.phone);

    if (input.plan !== undefined && input.plan !== PlanType.FREE) {
      throw new BadRequestException('Planos pagos devem ser ativados pelo checkout.');
    }

    const user = User.register({
      name: new UserName(input.name),
      email,
      passwordHash,
      phone,
      timezone: input.timezone,
      plan: input.plan,
      acceptedTermsAt
    });

    const profile = createDefaultUserProfileSnapshot({
      sex: input.sex,
      nationality: input.nationality,
      language: input.language
    });
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

function normalizeInternationalPhoneNumber(value?: string): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const parsedPhoneNumber = parsePhoneNumberFromString(value.trim(), {
    extract: false
  });

  if (!parsedPhoneNumber?.isValid()) {
    throw new BadRequestException('Informe um telefone internacional valido.');
  }

  return parsedPhoneNumber.number;
}
