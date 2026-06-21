export type AIContextMessageRole = 'user' | 'assistant';

export interface AIContextMessage {
  role: AIContextMessageRole;
  content: string;
}

export interface AIUserProfileSummary {
  preferredName?: string;
  preferredTone?: string;
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

export interface AIContext {
  userProfileSummary: AIUserProfileSummary;
  conversationSummary?: string;
  recentMessages: AIContextMessage[];
}

export interface AIContextBuildResult {
  profileConfigured: boolean;
  context: AIContext;
  sourceProfile?: ReflectiveProfile;
}
import { ReflectiveProfile } from '../../domain/conversation/entities/reflective-profile.entity';
