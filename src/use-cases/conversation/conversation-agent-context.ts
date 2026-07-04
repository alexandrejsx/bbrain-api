import { ReflectiveProfile } from '../../domain/conversation/entities/reflective-profile.entity';

export type RecentConversationMessageRole = 'user' | 'assistant';

export interface RecentConversationMessage {
  role: RecentConversationMessageRole;
  content: string;
}

export interface UserIdentityConversationContext {
  displayName: string;
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
  conversationSummary?: string;
  recentMessages: RecentConversationMessage[];
}

export interface ConversationAgentContextBuildResult {
  profileConfigured: boolean;
  context: ConversationAgentContext;
  sourceProfile?: ReflectiveProfile;
}
