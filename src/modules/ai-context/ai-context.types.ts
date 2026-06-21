import { ReflectiveProfile } from '../../domain/conversation/entities/reflective-profile.entity';

export type AIContextMessageRole = 'user' | 'assistant';

export interface AIContextMessage {
  role: AIContextMessageRole;
  content: string;
}

export interface AIUserIdentityContext {
  displayName: string;
}

export interface AIUserProfileSummary {
  goals?: string[];
  routineSummary?: string;
  sleepSummary?: string;
  recurringThemes?: string[];
  emotionalPatterns?: string[];
  helpfulStrategies?: string[];
  unhelpfulStrategies?: string[];
  declaredLimits?: string[];
  reportedFormalDiagnoses?: string[];
  reportedMedication?: string;
  professionalSupport?: string;
}

export interface AIConversationAdaptation {
  preferredTone?: string;
  instructions: string[];
}

export interface AIContext {
  userIdentityContext?: AIUserIdentityContext;
  userProfileSummary: AIUserProfileSummary;
  conversationAdaptation?: AIConversationAdaptation;
  conversationSummary?: string;
  recentMessages: AIContextMessage[];
}

export interface AIContextBuildResult {
  profileConfigured: boolean;
  context: AIContext;
  sourceProfile?: ReflectiveProfile;
}
