export type DailyCheckInLocale = 'pt-BR' | 'en-US' | 'es-ES';
export type DailyCheckInAccessReason = 'trial' | 'plan' | 'locked';
export type DailyCheckInStatus = 'in_progress' | 'completed';

export interface AcceptedMoodState {
  score: number | null;
  scoreConfidence: number | null;
  note: string | null;
}

export interface AcceptedSleepState {
  durationMinutes: number | null;
  wakeRestfulness: 'very_tired' | 'tired' | 'fairly_rested' | 'rested' | null;
  awakeTimeDuringNight: 'under_15' | '15_to_29' | '30_to_59' | '60_or_more' | null;
  sleepLatency: 'up_to_15' | '16_to_30' | '31_to_60' | 'over_60' | 'unknown' | null;
  sleepOnsetTime: string | null;
  wakeTime: string | null;
  note: string | null;
  recordDate: string | null;
}

export interface DailyCheckInState {
  mood: AcceptedMoodState;
  sleep: AcceptedSleepState;
}

export interface DailyCheckInSession {
  id: string;
  userId: string;
  localDate: string;
  timezone: string;
  locale: DailyCheckInLocale;
  status: DailyCheckInStatus;
  questionCount: number;
  maxQuestions: number;
  state: DailyCheckInState;
  nextQuestion: string | null;
  processedRequests: Array<{ id: string; fingerprint: string }>;
  processing?: { id: string; fingerprint: string };
  moodRecordId?: string;
  sleepRecordId?: string;
  dismissedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const EMPTY_CHECK_IN_STATE: DailyCheckInState = {
  mood: { score: null, scoreConfidence: null, note: null },
  sleep: {
    durationMinutes: null,
    wakeRestfulness: null,
    awakeTimeDuringNight: null,
    sleepLatency: null,
    sleepOnsetTime: null,
    wakeTime: null,
    note: null,
    recordDate: null
  }
};

export class DailyCheckInLockedError extends Error {}
export class DailyCheckInNotStartedError extends Error {}
export class DailyCheckInRequestConflictError extends Error {}
export class DailyCheckInRequestInProgressError extends Error {}
export class DailyCheckInProviderUnavailableError extends Error {}
