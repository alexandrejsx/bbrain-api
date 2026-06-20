import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EventDispatcher } from '../../domain/core/event-dispatcher';
import { User, UserGender } from '../../domain/users/entities/user.entity';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { Email } from '../../domain/users/value-objects/email.vo';
import { Password } from '../../domain/users/value-objects/password.vo';
import { UserName } from '../../domain/users/value-objects/user-name.vo';
import { JwtTokenService } from '../../shared/services/jwt-token.service';
import { PasswordHashService } from '../../shared/services/password-hash.service';
import { UseCase } from '../use-case.interface';
import { AuthResponse } from './auth-response';

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
  birthDate?: string;
  gender?: string;
  phone?: string;
  timezone?: string;
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

    const email = new Email(input.email);
    const exists = await this.userRepository.findByEmail(email.value);

    if (exists) {
      throw new ConflictException('Email already registered');
    }

    const password = new Password(input.password);
    const passwordHash = await this.passwordHashService.hash(password.value);
    const acceptedTermsAt = new Date();

    const user = User.register({
      name: new UserName(input.name),
      email,
      passwordHash,
      birthDate: input.birthDate ? this.parseDate(input.birthDate, 'birthDate') : undefined,
      gender: input.gender as UserGender | undefined,
      phone: input.phone,
      timezone: input.timezone,
      acceptedTermsAt
    });

    await this.userRepository.save(user);
    await this.eventDispatcher.dispatch(user.pullDomainEvents());

    return {
      user: user.toJson(),
      accessToken: await this.jwtTokenService.signUser(user)
    };
  }

  private parseDate(value: string, field: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }

    return date;
  }
}
