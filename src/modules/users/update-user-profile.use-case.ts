import { BadRequestException, NotFoundException } from '@nestjs/common';
import parsePhoneNumberFromString from 'libphonenumber-js';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import type { PublicUser } from '../auth/auth-response';
import type { UserProfileSnapshot } from '../../domain/users/entities/user-profile.types';
import { normalizeUserProfileSnapshot } from './profile-snapshot';
import { PlanType } from '../../domain/plans/plan-definition';

export interface UpdateUserProfileInput {
  userId: string;
  phone?: string;
  plan?: PlanType;
  profile: UserProfileSnapshot;
}

export interface UpdateUserProfileOutput {
  user: PublicUser;
  profile: UserProfileSnapshot;
}

export class UpdateUserProfileUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly syncConversationConsent: (userId: string, allowed: boolean) => Promise<void>
  ) {}

  async execute(input: UpdateUserProfileInput): Promise<UpdateUserProfileOutput> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const now = new Date();
    const profileSnapshot = normalizeUserProfileSnapshot(user, input.profile);

    if (profileSnapshot.profileCompleted) {
      if (!profileSnapshot.basicInfo.birthDate) {
        throw new BadRequestException('Birth date is required');
      }

      if (!profileSnapshot.basicInfo.sex) {
        throw new BadRequestException('Sex is required');
      }
    }

    if (input.phone !== undefined) {
      user.updatePhone(normalizeInternationalPhoneNumber(input.phone), now);
    }

    if (input.plan !== undefined) {
      if (input.plan !== PlanType.FREE) {
        throw new BadRequestException('Planos pagos devem ser ativados pelo checkout.');
      }

      user.updatePlan(input.plan, now);
    }

    user.updateProfile(profileSnapshot, now);

    const conversationDataAllowed =
      profileSnapshot.privacySettings.allowPersonalization &&
      profileSnapshot.privacySettings.allowMemory &&
      profileSnapshot.privacySettings.allowSensitiveDataStorage;

    await this.userRepository.save(user);

    await this.syncConversationConsent(input.userId, conversationDataAllowed);

    return {
      user: user.toJson(),
      profile: profileSnapshot
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
