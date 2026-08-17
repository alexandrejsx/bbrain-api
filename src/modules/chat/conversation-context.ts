import { UserDataConsent } from '../users/data-consent.policy';

export interface ConversationContext {
  identity?: { preferredName?: string; preferredLanguage?: string };
  profile?: {
    goals?: string[];
    communicationStyle?: string;
    formalDiagnoses?: Array<{ condition: string; source: 'user_reported_formal_diagnosis' }>;
    professionalSupport?: {
      inTherapy?: string;
      psychiatricFollowUp?: string;
      medicationWithProfessionalFollowUp?: string;
    };
  };
  currentContext?: { summary: string; topics: string[]; pendingItems: string[] };
  memories: Array<{ summary: string; kind: string; topics: string[]; eventDate?: string }>;
  patterns: Array<{ summary: string; topics: string[]; evidenceCount: number }>;
  recentMessages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
  }>;
}

export interface ContextBuildResult {
  profileConfigured: boolean;
  context: ConversationContext;
  consent: UserDataConsent;
}
