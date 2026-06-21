import { ReflectiveProfile } from '../../domain/conversation/entities/reflective-profile.entity';
import { User } from '../../domain/users/entities/user.entity';
import type {
  CommunicationStyle,
  UserSex,
  UserProfileSnapshot
} from '../../domain/users/entities/user-profile.types';
import { isUserSex } from '../../domain/users/entities/user-profile.types';

const communicationStyles = new Set<CommunicationStyle>([
  'calm',
  'direct',
  'reflective',
  'practical'
]);

function trimOptional(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalDate(value?: Date | string) {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function trimList(values?: string[], limit = 12) {
  return (values ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeCommunicationStyle(value?: string): CommunicationStyle | undefined {
  if (!value || !communicationStyles.has(value as CommunicationStyle)) {
    return undefined;
  }

  return value as CommunicationStyle;
}

function normalizeUserSex(value?: UserSex | string): UserSex | undefined {
  return isUserSex(value) ? value : undefined;
}

function hasReflectiveSetupData(profile?: ReflectiveProfile | null) {
  if (!profile) {
    return false;
  }

  const data = profile.toJson();

  return Boolean(
    data.preferredTone ||
    data.analysisGoals.length ||
    data.reportedFormalDiagnoses.length ||
    data.reportedMedication ||
    data.professionalSupport
  );
}

function createProfileFromReflectiveData(
  profile: ReflectiveProfile
): Partial<UserProfileSnapshot> | null {
  if (!hasReflectiveSetupData(profile)) {
    return null;
  }

  const data = profile.toJson();
  const diagnoses = data.reportedFormalDiagnoses.map((condition) => ({ condition }));

  return {
    profileCompleted: true,
    goals: {
      mainGoals: trimList(data.analysisGoals)
    },
    conversationPreferences: {
      communicationStyle: normalizeCommunicationStyle(data.preferredTone)
    },
    professionalContext: {
      hasFormalDiagnosis: diagnoses.length ? 'yes' : undefined,
      diagnoses
    }
  };
}

export function createDefaultUserProfileSnapshot(
  initialBasicInfo: Partial<UserProfileSnapshot['basicInfo']> = {}
): UserProfileSnapshot {
  return {
    profileCompleted: false,
    basicInfo: {
      sex: normalizeUserSex(initialBasicInfo.sex),
      preferredName: trimOptional(initialBasicInfo.preferredName),
      birthDate: normalizeOptionalDate(initialBasicInfo.birthDate),
      language: 'pt-BR'
    },
    goals: {
      mainGoals: []
    },
    conversationPreferences: {},
    professionalContext: {},
    privacySettings: {
      allowPersonalization: true,
      allowMemory: true,
      allowMoodInsights: true,
      allowSensitiveDataStorage: true
    }
  };
}

export function normalizeUserProfileSnapshot(
  user: User,
  profile?: Partial<UserProfileSnapshot> | null
): UserProfileSnapshot {
  const fallback = createDefaultUserProfileSnapshot();

  return {
    basicInfo: {
      ...fallback.basicInfo,
      ...profile?.basicInfo,
      preferredName: trimOptional(profile?.basicInfo?.preferredName),
      birthDate: normalizeOptionalDate(
        profile?.basicInfo?.birthDate ?? fallback.basicInfo.birthDate
      ),
      sex: normalizeUserSex(profile?.basicInfo?.sex ?? fallback.basicInfo.sex),
      language: trimOptional(profile?.basicInfo?.language) ?? fallback.basicInfo.language
    },
    goals: {
      mainGoals: trimList(profile?.goals?.mainGoals),
      otherGoal: trimOptional(profile?.goals?.otherGoal)
    },
    conversationPreferences: {
      communicationStyle: normalizeCommunicationStyle(
        profile?.conversationPreferences?.communicationStyle
      )
    },
    professionalContext: {
      ...fallback.professionalContext,
      ...profile?.professionalContext,
      diagnoses: profile?.professionalContext?.diagnoses
        ?.map((diagnosis) => ({
          condition: trimOptional(diagnosis.condition),
          diagnosedBy: trimOptional(diagnosis.diagnosedBy),
          currentlyInTreatment: diagnosis.currentlyInTreatment
        }))
        .filter((diagnosis) =>
          Boolean(diagnosis.condition || diagnosis.diagnosedBy || diagnosis.currentlyInTreatment)
        )
        .slice(0, 3)
    },
    privacySettings: {
      ...fallback.privacySettings,
      ...profile?.privacySettings
    },
    profileCompleted: profile?.profileCompleted ?? fallback.profileCompleted
  };
}

export function resolveUserProfileSnapshot(
  user: User,
  storedProfile?: UserProfileSnapshot | null,
  reflectiveProfile?: ReflectiveProfile | null
): UserProfileSnapshot {
  if (storedProfile) {
    return normalizeUserProfileSnapshot(user, storedProfile);
  }

  const reflectiveSnapshot = reflectiveProfile
    ? createProfileFromReflectiveData(reflectiveProfile)
    : null;

  return normalizeUserProfileSnapshot(user, reflectiveSnapshot);
}
