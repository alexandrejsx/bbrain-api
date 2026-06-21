export type CommunicationStyle = 'calm' | 'direct' | 'reflective' | 'practical';

export type YesNoPreferNotToSay = 'yes' | 'no' | 'prefer_not_to_answer';

export type FormalDiagnosisAnswer = 'yes' | 'no' | 'not_sure' | 'prefer_not_to_answer';

export enum UserSex {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  PREFER_NOT_TO_ANSWER = 'prefer_not_to_answer'
}

export function isUserSex(value: unknown): value is UserSex {
  return Object.values(UserSex).includes(value as UserSex);
}

export interface UserProfileSnapshot {
  profileCompleted: boolean;
  basicInfo: {
    preferredName?: string;
    birthDate?: Date;
    sex?: UserSex;
    language?: string;
  };
  goals: {
    mainGoals: string[];
    otherGoal?: string;
  };
  conversationPreferences: {
    communicationStyle?: CommunicationStyle;
  };
  professionalContext: {
    hasFormalDiagnosis?: FormalDiagnosisAnswer;
    diagnoses?: Array<{
      condition?: string;
      diagnosedBy?: string;
      currentlyInTreatment?: YesNoPreferNotToSay;
    }>;
    isInTherapy?: YesNoPreferNotToSay;
    hasPsychiatricFollowUp?: YesNoPreferNotToSay;
    usesMedicationWithProfessionalFollowUp?: YesNoPreferNotToSay;
  };
  privacySettings: {
    allowPersonalization: boolean;
    allowMemory: boolean;
    allowMoodInsights: boolean;
    allowSensitiveDataStorage: boolean;
  };
}
