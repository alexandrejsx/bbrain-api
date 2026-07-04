import { User } from '../../../../domain/users/entities/user.entity';
import type { UserProfileSnapshot } from '../../../../domain/users/entities/user-profile.types';
import { Email } from '../../../../domain/users/value-objects/email.vo';
import { UserName } from '../../../../domain/users/value-objects/user-name.vo';
import { Uuid } from '../../../../domain/shared/uuid.vo';
import {
  DEFAULT_PLAN,
  normalizePaymentProviderType,
  normalizePlanType,
  isSubscriptionStatus,
  SubscriptionStatus
} from '../../../../domain/plans/plan-definition';
import { UserDocument, UserMongo, UserProfileMongo } from '../schemas/user.schema';

function toProfilePersistence(profile?: UserProfileSnapshot): UserProfileMongo | undefined {
  if (!profile) {
    return undefined;
  }

  return {
    profile_completed: profile.profileCompleted,
    basic_info: {
      preferred_name: profile.basicInfo.preferredName,
      birth_date: profile.basicInfo.birthDate,
      sex: profile.basicInfo.sex,
      nationality: profile.basicInfo.nationality,
      language: profile.basicInfo.language
    },
    goals: {
      main_goals: profile.goals.mainGoals,
      other_goal: profile.goals.otherGoal
    },
    conversation_preferences: {
      communication_style: profile.conversationPreferences.communicationStyle
    },
    professional_context: {
      has_formal_diagnosis: profile.professionalContext.hasFormalDiagnosis,
      diagnoses: profile.professionalContext.diagnoses?.map((diagnosis) => ({
        condition: diagnosis.condition,
        diagnosed_by: diagnosis.diagnosedBy,
        currently_in_treatment: diagnosis.currentlyInTreatment
      })),
      is_in_therapy: profile.professionalContext.isInTherapy,
      has_psychiatric_follow_up: profile.professionalContext.hasPsychiatricFollowUp,
      uses_medication_with_professional_follow_up:
        profile.professionalContext.usesMedicationWithProfessionalFollowUp
    },
    privacy_settings: {
      allow_personalization: profile.privacySettings.allowPersonalization,
      allow_memory: profile.privacySettings.allowMemory,
      allow_mood_insights: profile.privacySettings.allowMoodInsights,
      allow_sensitive_data_storage: profile.privacySettings.allowSensitiveDataStorage
    }
  };
}

function toProfileDomain(profile?: UserProfileMongo): UserProfileSnapshot | undefined {
  if (!profile) {
    return undefined;
  }

  if ('profileCompleted' in profile) {
    return profile as unknown as UserProfileSnapshot;
  }

  return {
    profileCompleted: profile.profile_completed ?? false,
    basicInfo: {
      preferredName: profile.basic_info?.preferred_name,
      birthDate: profile.basic_info?.birth_date,
      sex: profile.basic_info?.sex,
      nationality: profile.basic_info?.nationality,
      language: profile.basic_info?.language
    },
    goals: {
      mainGoals: profile.goals?.main_goals ?? [],
      otherGoal: profile.goals?.other_goal
    },
    conversationPreferences: {
      communicationStyle: profile.conversation_preferences?.communication_style
    },
    professionalContext: {
      hasFormalDiagnosis: profile.professional_context?.has_formal_diagnosis,
      diagnoses: profile.professional_context?.diagnoses?.map((diagnosis) => ({
        condition: diagnosis.condition,
        diagnosedBy: diagnosis.diagnosed_by,
        currentlyInTreatment: diagnosis.currently_in_treatment
      })),
      isInTherapy: profile.professional_context?.is_in_therapy,
      hasPsychiatricFollowUp: profile.professional_context?.has_psychiatric_follow_up,
      usesMedicationWithProfessionalFollowUp:
        profile.professional_context?.uses_medication_with_professional_follow_up
    },
    privacySettings: {
      allowPersonalization: profile.privacy_settings?.allow_personalization ?? true,
      allowMemory: profile.privacy_settings?.allow_memory ?? true,
      allowMoodInsights: profile.privacy_settings?.allow_mood_insights ?? true,
      allowSensitiveDataStorage: profile.privacy_settings?.allow_sensitive_data_storage ?? true
    }
  };
}

export class MongoUserMapper {
  static toPersistence(user: User): Partial<UserMongo> {
    return {
      _id: user.id.value,
      name: user.name.value,
      email: user.email.value,
      password_hash: user.passwordHash,
      phone: user.phone,
      password_reset_code_hash: user.passwordResetCodeHash,
      password_reset_code_expires_at: user.passwordResetCodeExpiresAt,
      timezone: user.timezone,
      plan: user.plan,
      billing_provider: user.billingProvider,
      stripe_customer_id: user.stripeCustomerId,
      asaas_customer_id: user.asaasCustomerId,
      billing_status: user.billingStatus,
      plan_access_until: user.planAccessUntil,
      current_subscription_id: user.currentSubscriptionId,
      profile: toProfilePersistence(user.profile),
      accepted_terms_at: user.acceptedTermsAt,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      last_login_at: user.lastLoginAt,
      account_deactivated_at: user.accountDeactivatedAt,
      account_scheduled_deletion_at: user.accountScheduledDeletionAt
    };
  }

  static toDomain(raw: UserDocument | UserMongo): User {
    const legacyRaw = raw as UserMongo & { woovi_customer_id?: string };

    return User.create(
      {
        name: new UserName(raw.name),
        email: new Email(raw.email),
        passwordHash: raw.password_hash,
        phone: raw.phone,
        passwordResetCodeHash: raw.password_reset_code_hash,
        passwordResetCodeExpiresAt: raw.password_reset_code_expires_at,
        timezone: raw.timezone,
        plan: normalizePlanType(raw.plan) ?? DEFAULT_PLAN,
        billingProvider: normalizePaymentProviderType(raw.billing_provider),
        stripeCustomerId: raw.stripe_customer_id,
        asaasCustomerId: raw.asaas_customer_id ?? legacyRaw.woovi_customer_id,
        billingStatus: isSubscriptionStatus(raw.billing_status)
          ? raw.billing_status
          : SubscriptionStatus.NONE,
        planAccessUntil: raw.plan_access_until,
        currentSubscriptionId: raw.current_subscription_id,
        profile: toProfileDomain(raw.profile),
        acceptedTermsAt: raw.accepted_terms_at,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
        lastLoginAt: raw.last_login_at,
        accountDeactivatedAt: raw.account_deactivated_at,
        accountScheduledDeletionAt: raw.account_scheduled_deletion_at
      },
      new Uuid(raw._id)
    );
  }
}
