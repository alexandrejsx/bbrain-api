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
  todayCheckIn?: {
    localDate: string;
    mood: null | { score: number; note?: string };
    sleep: null | {
      durationMinutes: { value: number; precision: 'exact' | 'approximate' };
      wakeRestfulness: 'very_tired' | 'tired' | 'fairly_rested' | 'rested';
      awakeTimeDuringNight: 'under_15' | '15_to_29' | '30_to_59' | '60_or_more';
      sleepQuality: {
        score: number;
        classification: 'very_bad' | 'bad' | 'fair' | 'good' | 'very_good';
      };
      sleepLatency?: 'up_to_15' | '16_to_30' | '31_to_60' | 'over_60' | 'unknown';
      sleepOnsetTime?: { value: string; precision: 'exact' | 'approximate' };
      wakeTime?: { value: string; precision: 'exact' | 'approximate' };
      note?: string;
    };
  };
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
