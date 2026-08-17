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
  durationConfidence: number | null;
  durationApproximate: boolean;
  subjectiveQualityScore: number | null;
  subjectiveQualityConfidence: number | null;
  awakeningsCount: number | null;
  awakeningsConfidence: number | null;
  awakeningsApproximate: boolean;
  multipleAwakenings: boolean;
  awakeDuringNightMinutes: number | null;
  awakeDuringNightConfidence: number | null;
  awakeDuringNightApproximate: boolean;
  restfulnessScore: number | null;
  restfulnessConfidence: number | null;
  note: string | null;
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
    durationConfidence: null,
    durationApproximate: false,
    subjectiveQualityScore: null,
    subjectiveQualityConfidence: null,
    awakeningsCount: null,
    awakeningsConfidence: null,
    awakeningsApproximate: false,
    multipleAwakenings: false,
    awakeDuringNightMinutes: null,
    awakeDuringNightConfidence: null,
    awakeDuringNightApproximate: false,
    restfulnessScore: null,
    restfulnessConfidence: null,
    note: null
  }
};

export class DailyCheckInLockedError extends Error {}
export class DailyCheckInNotStartedError extends Error {}
export class DailyCheckInRequestConflictError extends Error {}
export class DailyCheckInRequestInProgressError extends Error {}
export class DailyCheckInProviderUnavailableError extends Error {}
