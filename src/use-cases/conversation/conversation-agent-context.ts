import { ReflectiveProfile } from '../../domain/conversation/entities/reflective-profile.entity';
import { ConversationStateSnapshot } from '../../domain/conversation/entities/conversation-state.entity';
import { ConversationState } from '../../domain/conversation/entities/conversation-state.entity';

export interface UserIdentityConversationContext {
  displayName?: string;
  preferredLanguage?: string;
}

export interface UserProfileContextSummary {
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

export interface ConversationStyleContext {
  preferredTone?: string;
}

export interface ConversationAgentContext {
  userIdentityContext?: UserIdentityConversationContext;
  userProfileSummary: UserProfileContextSummary;
  conversationStyle?: ConversationStyleContext;
  conversationState?: ConversationStateSnapshot;
}

export interface ConversationDataPolicy {
  timezone: string;
  allowPersonalization: boolean;
  allowMemory: boolean;
  allowMoodInsights: boolean;
  allowSensitiveDataStorage: boolean;
}

export interface ConversationAgentContextBuildResult {
  profileConfigured: boolean;
  context: ConversationAgentContext;
  dataPolicy: ConversationDataPolicy;
  sourceProfile?: ReflectiveProfile;
  sourceConversationState?: ConversationState;
}
