import { BadRequestException, NotFoundException } from '@nestjs/common';
import parsePhoneNumberFromString from 'libphonenumber-js';
import { ReflectiveProfile } from '../../domain/conversation/entities/reflective-profile.entity';
import { ReflectiveProfileRepository } from '../../domain/conversation/repositories/reflective-profile.repository';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import type { PublicUser } from '../auth/auth-response';
import type { UserProfileSnapshot } from '../../domain/users/entities/user-profile.types';
import { normalizeUserProfileSnapshot } from '../profile/user-profile-snapshot.utils';
import { PlanType } from '../../domain/plans/plan-definition';

type YesNoPreferNotToSay = 'yes' | 'no' | 'prefer_not_to_answer';

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

const yesNoLabels: Record<YesNoPreferNotToSay, string> = {
  yes: 'sim',
  no: 'não',
  prefer_not_to_answer: 'prefere não informar'
};

export class UpdateUserProfileUseCase {
  constructor(
    private readonly profileRepository: ReflectiveProfileRepository,
    private readonly userRepository: UserRepository
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

    const profile =
      (await this.profileRepository.findByUserId(input.userId)) ??
      ReflectiveProfile.create(input.userId);

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

    profile.configureFromSetup(
      {
        preferredTone: profileSnapshot.conversationPreferences.communicationStyle,
        analysisGoals: this.buildAnalysisGoals(profileSnapshot.goals),
        reportedFormalDiagnoses: this.buildReportedDiagnoses(profileSnapshot.professionalContext),
        reportedMedication: this.buildMedicationSummary(profileSnapshot.professionalContext),
        professionalSupport: this.buildProfessionalSupportSummary(
          profileSnapshot.professionalContext
        )
      },
      now
    );

    await Promise.all([this.userRepository.save(user), this.profileRepository.save(profile)]);

    return {
      user: user.toJson(),
      profile: profileSnapshot
    };
  }

  private buildAnalysisGoals(input: UserProfileSnapshot['goals']): string[] {
    return [...input.mainGoals, input.otherGoal].filter(
      (goal): goal is string => typeof goal === 'string' && goal.trim().length > 0
    );
  }

  private buildReportedDiagnoses(
    input: UserProfileSnapshot['professionalContext']
  ): string[] | undefined {
    if (input.hasFormalDiagnosis !== 'yes') {
      return undefined;
    }

    return input.diagnoses
      ?.map((diagnosis) => diagnosis.condition)
      .filter((condition): condition is string => !!condition?.trim());
  }

  private buildMedicationSummary(
    input: UserProfileSnapshot['professionalContext']
  ): string | undefined {
    if (!input.usesMedicationWithProfessionalFollowUp) {
      return undefined;
    }

    return `Medicação com acompanhamento profissional: ${yesNoLabels[input.usesMedicationWithProfessionalFollowUp]}.`;
  }

  private buildProfessionalSupportSummary(
    input: UserProfileSnapshot['professionalContext']
  ): string | undefined {
    const diagnosis = input.diagnoses?.[0];
    const details = [
      this.describeAnswer('Diagnóstico formal', input.hasFormalDiagnosis),
      diagnosis?.diagnosedBy ? `Profissional do diagnóstico: ${diagnosis.diagnosedBy}` : undefined,
      diagnosis?.currentlyInTreatment
        ? `Acompanhamento do diagnóstico: ${yesNoLabels[diagnosis.currentlyInTreatment]}`
        : undefined,
      this.describeAnswer('Terapia atualmente', input.isInTherapy),
      this.describeAnswer('Acompanhamento psiquiátrico', input.hasPsychiatricFollowUp)
    ].filter((detail): detail is string => !!detail);

    return details.length ? details.join('; ') : undefined;
  }

  private describeAnswer(
    label: string,
    value?: YesNoPreferNotToSay | 'not_sure'
  ): string | undefined {
    if (!value) return undefined;
    if (value === 'not_sure') return `${label}: não tem certeza`;
    return `${label}: ${yesNoLabels[value]}`;
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
