import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { DailyCheckInAgent } from '../../ai/daily-check-in-agent';
import { promptVersions } from '../../ai/prompts/prompt-registry';
import { ConversationSafetyPolicy } from '../../ai/safety/conversation-safety.policy';
import { DailyCheckInOutput } from '../../ai/structured-output';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { USERS_REPOSITORY } from '../tokens';
import { MoodService } from '../mood/mood.service';
import { SleepService } from '../sleep/sleep.service';
import { DataConsentPolicy } from '../users/data-consent.policy';
import { DailyCheckInAccessPolicy } from './daily-check-in-access.policy';
import { DailyCheckInRepository } from './daily-check-in.repository';
import {
  DailyCheckInLocale,
  DailyCheckInLockedError,
  DailyCheckInNotStartedError,
  DailyCheckInProviderUnavailableError,
  DailyCheckInRequestConflictError,
  DailyCheckInRequestInProgressError,
  DailyCheckInSession,
  DailyCheckInState,
  EMPTY_CHECK_IN_STATE
} from './daily-check-in.types';

const MAX_QUESTIONS = 5;

const firstQuestions: Record<DailyCheckInLocale, string> = {
  'pt-BR': 'Como você está se sentindo hoje? Pode me contar do seu jeito.',
  'en-US': 'How are you feeling today? You can describe it in your own words.',
  'es-ES': '¿Cómo te sientes hoy? Puedes contármelo con tus propias palabras.'
};

const fallbackQuestions: Record<DailyCheckInLocale, Record<string, string>> = {
  'pt-BR': {
    mood: 'Se fosse descrever seu estado de hoje em poucas palavras, como ele está?',
    durationMinutes: 'E como foi sua noite? Quanto tempo você acha que dormiu?',
    subjectiveQualityScore: 'Como você percebeu a qualidade do seu sono?',
    restfulnessScore: 'Como você se sentiu ao acordar?',
    awakeningsCount: 'Você se lembra se acordou durante a noite?'
  },
  'en-US': {
    mood: 'If you described how you feel today in a few words, what would you say?',
    durationMinutes: 'And how was your night? About how long did you sleep?',
    subjectiveQualityScore: 'How did the quality of your sleep feel to you?',
    restfulnessScore: 'How did you feel when you woke up?',
    awakeningsCount: 'Do you remember waking up during the night?'
  },
  'es-ES': {
    mood: 'Si describieras cómo te sientes hoy en pocas palabras, ¿qué dirías?',
    durationMinutes: '¿Y cómo fue tu noche? ¿Cuánto tiempo crees que dormiste?',
    subjectiveQualityScore: '¿Cómo percibiste la calidad de tu sueño?',
    restfulnessScore: '¿Cómo te sentiste al despertar?',
    awakeningsCount: '¿Recuerdas si te despertaste durante la noche?'
  }
};

@Injectable()
export class DailyCheckInService {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly users: UserRepository,
    private readonly repository: DailyCheckInRepository,
    private readonly accessPolicy: DailyCheckInAccessPolicy,
    private readonly consentPolicy: DataConsentPolicy,
    private readonly agent: DailyCheckInAgent,
    private readonly mood: MoodService,
    private readonly sleep: SleepService,
    private readonly safety: ConversationSafetyPolicy,
    private readonly config: ConfigService
  ) {}

  async getStatus(userId: string) {
    const context = await this.resolveContext(userId);
    const session = await this.repository.findByUserAndDate(userId, context.localDate);
    return this.toResponse(context.access, session);
  }

  async start(userId: string, locale: DailyCheckInLocale) {
    const context = await this.resolveContext(userId);
    this.assertAvailable(context.access, context.canStoreWellbeing);
    const session = await this.repository.start({
      userId,
      localDate: context.localDate,
      timezone: context.timezone,
      locale,
      state: structuredClone(EMPTY_CHECK_IN_STATE),
      firstQuestion: firstQuestions[locale],
      maxQuestions: MAX_QUESTIONS
    });
    return this.toResponse(context.access, session);
  }

  async dismiss(userId: string, locale: DailyCheckInLocale) {
    const context = await this.resolveContext(userId);
    this.assertAvailable(context.access, context.canStoreWellbeing);
    const session = await this.repository.start({
      userId,
      localDate: context.localDate,
      timezone: context.timezone,
      locale,
      state: structuredClone(EMPTY_CHECK_IN_STATE),
      firstQuestion: firstQuestions[locale],
      maxQuestions: MAX_QUESTIONS
    });
    if (session.status === 'completed') return this.toResponse(context.access, session);
    const dismissed = await this.repository.dismissToday(session.id, new Date());
    const latest =
      dismissed ?? (await this.repository.findByUserAndDate(userId, context.localDate)) ?? session;
    return this.toResponse(context.access, latest);
  }

  async answer(input: {
    userId: string;
    locale: DailyCheckInLocale;
    clientRequestId: string;
    message: string;
  }) {
    const context = await this.resolveContext(input.userId);
    this.assertAvailable(context.access, context.canStoreWellbeing);
    const current = await this.repository.findByUserAndDate(input.userId, context.localDate);
    if (!current) throw new DailyCheckInNotStartedError();
    const fingerprint = this.fingerprint(input.userId, input.message);
    const processed = current.processedRequests.find(
      (request) => request.id === input.clientRequestId
    );
    if (processed) {
      if (processed.fingerprint !== fingerprint) throw new DailyCheckInRequestConflictError();
      return this.toResponse(context.access, current);
    }
    if (current.status === 'completed') return this.toResponse(context.access, current);
    if (current.processing?.id === input.clientRequestId) {
      if (current.processing.fingerprint !== fingerprint)
        throw new DailyCheckInRequestConflictError();
      throw new DailyCheckInRequestInProgressError();
    }

    const claimed = await this.repository.claimAnswer(
      current.id,
      input.clientRequestId,
      fingerprint
    );
    if (!claimed) throw new DailyCheckInRequestInProgressError();

    try {
      const generated = await this.agent.respond({
        locale: input.locale,
        currentState: claimed.state,
        missingFields: missingFields(claimed.state),
        currentQuestion: claimed.nextQuestion,
        questionCount: claimed.questionCount,
        maxQuestions: claimed.maxQuestions,
        userMessage: input.message,
        correlationId: input.clientRequestId
      });
      const minimumConfidence = this.config.get<number>('ai.extractionMinimumConfidence') ?? 0.85;
      const state = mergeAcceptedState(claimed.state, generated, minimumConfidence);
      const useful = hasUsefulState(state);
      const limitReached = claimed.questionCount >= claimed.maxQuestions;
      const safetyHandoff = generated.requiresSafetyHandoff;
      const completed = safetyHandoff || limitReached || (generated.completed && useful);
      const nextQuestion = completed
        ? null
        : (cleanQuestion(generated.nextQuestion) ?? nextFallbackQuestion(input.locale, state));

      let moodRecordId: string | undefined;
      let sleepRecordId: string | undefined;
      const completedAt = completed ? new Date() : undefined;
      if (completed) {
        const records = await this.persistAcceptedState(claimed, state, completedAt!);
        moodRecordId = records.moodRecordId;
        sleepRecordId = records.sleepRecordId;
      }

      const saved = await this.repository.finishTurn({
        sessionId: claimed.id,
        requestId: input.clientRequestId,
        fingerprint,
        state,
        questionCount: completed ? claimed.questionCount : claimed.questionCount + 1,
        nextQuestion,
        completed,
        moodRecordId,
        sleepRecordId,
        completedAt
      });
      if (!saved) throw new DailyCheckInRequestInProgressError();
      return {
        ...this.toResponse(context.access, saved),
        requiresSafetyHandoff: safetyHandoff,
        safetyMessage: safetyHandoff ? this.safety.dailyCheckInHandoff(input.locale) : null
      };
    } catch (error) {
      await this.repository.releaseAnswer(claimed.id, input.clientRequestId);
      if (
        error instanceof DailyCheckInRequestConflictError ||
        error instanceof DailyCheckInRequestInProgressError
      ) {
        throw error;
      }
      throw new DailyCheckInProviderUnavailableError();
    }
  }

  private async resolveContext(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const referenceAt = new Date();
    const consent = this.consentPolicy.resolve(user);
    const access = this.accessPolicy.resolve(user, referenceAt);
    return {
      timezone: consent.timezone,
      localDate: localDateAt(referenceAt, consent.timezone),
      canStoreWellbeing: consent.canExtractWellbeing,
      access: consent.canExtractWellbeing
        ? access
        : { available: false, accessReason: 'locked' as const }
    };
  }

  private assertAvailable(access: { available: boolean }, canStoreWellbeing: boolean): void {
    if (!access.available || !canStoreWellbeing) throw new DailyCheckInLockedError();
  }

  private async persistAcceptedState(
    session: DailyCheckInSession,
    state: DailyCheckInState,
    capturedAt: Date
  ) {
    const sourceEventId = `daily-check-in:${session.id}`;
    const [mood, sleep] = await Promise.all([
      state.mood.score === null || state.mood.scoreConfidence === null
        ? null
        : this.mood.createFromGuidedCheckIn({
            userId: session.userId,
            checkInId: session.id,
            sourceEventId,
            capturedAt,
            timezone: session.timezone,
            localDate: session.localDate,
            score: state.mood.score,
            scoreConfidence: state.mood.scoreConfidence,
            note: state.mood.note,
            promptVersion: promptVersions.dailyCheckIn
          }),
      hasSleepState(state.sleep)
        ? this.sleep.createFromGuidedCheckIn({
            userId: session.userId,
            checkInId: session.id,
            sourceEventId,
            capturedAt,
            timezone: session.timezone,
            localDate: session.localDate,
            data: state.sleep,
            promptVersion: promptVersions.dailyCheckIn
          })
        : null
    ]);
    return { moodRecordId: mood?.id, sleepRecordId: sleep?.id };
  }

  private toResponse(
    access: { available: boolean; accessReason: 'trial' | 'plan' | 'locked' },
    session: DailyCheckInSession | null
  ) {
    return {
      completedToday: session?.status === 'completed',
      available: access.available,
      accessReason: access.accessReason,
      inProgress: session?.status === 'in_progress',
      dismissedToday: Boolean(session?.dismissedAt),
      nextQuestion: session?.status === 'in_progress' ? session.nextQuestion : null,
      completed: session?.status === 'completed',
      questionCount: session?.questionCount ?? 0,
      maxQuestions: session?.maxQuestions ?? MAX_QUESTIONS,
      summary: session?.status === 'completed' ? publicState(session.state) : null,
      requiresSafetyHandoff: false,
      safetyMessage: null
    };
  }

  private fingerprint(userId: string, message: string): string {
    const secret = this.config.get<string>('conversation.fingerprintSecret') ?? 'local-secret';
    return createHmac('sha256', secret).update(`${userId}:${message}`).digest('hex');
  }
}

function mergeAcceptedState(
  current: DailyCheckInState,
  output: DailyCheckInOutput,
  minimum: number
): DailyCheckInState {
  const next = structuredClone(current);
  const mood = output.extracted.mood;
  if (mood && accepted(mood.score, mood.scoreConfidence, minimum)) {
    next.mood.score = mood.score;
    next.mood.scoreConfidence = mood.scoreConfidence;
    next.mood.note = cleanNote(mood.note);
  }
  const sleep = output.extracted.sleep;
  if (!sleep) return next;
  acceptSleepField(next.sleep, sleep, 'durationMinutes', 'durationConfidence', minimum);
  if (next.sleep.durationMinutes !== current.sleep.durationMinutes) {
    next.sleep.durationApproximate = sleep.durationApproximate;
  }
  acceptSleepField(
    next.sleep,
    sleep,
    'subjectiveQualityScore',
    'subjectiveQualityConfidence',
    minimum
  );
  acceptSleepField(next.sleep, sleep, 'awakeningsCount', 'awakeningsConfidence', minimum);
  if (next.sleep.awakeningsCount !== current.sleep.awakeningsCount) {
    next.sleep.awakeningsApproximate = sleep.awakeningsApproximate;
  }
  if (sleep.multipleAwakenings && confidenceAccepted(sleep.awakeningsConfidence, minimum)) {
    next.sleep.multipleAwakenings = true;
  }
  acceptSleepField(
    next.sleep,
    sleep,
    'awakeDuringNightMinutes',
    'awakeDuringNightConfidence',
    minimum
  );
  if (next.sleep.awakeDuringNightMinutes !== current.sleep.awakeDuringNightMinutes) {
    next.sleep.awakeDuringNightApproximate = sleep.awakeDuringNightApproximate;
  }
  acceptSleepField(next.sleep, sleep, 'restfulnessScore', 'restfulnessConfidence', minimum);
  if (hasSleepState(next.sleep)) next.sleep.note = cleanNote(sleep.note) ?? next.sleep.note;
  return next;
}

function acceptSleepField(
  target: DailyCheckInState['sleep'],
  source: NonNullable<DailyCheckInOutput['extracted']['sleep']>,
  valueKey:
    | 'durationMinutes'
    | 'subjectiveQualityScore'
    | 'awakeningsCount'
    | 'awakeDuringNightMinutes'
    | 'restfulnessScore',
  confidenceKey:
    | 'durationConfidence'
    | 'subjectiveQualityConfidence'
    | 'awakeningsConfidence'
    | 'awakeDuringNightConfidence'
    | 'restfulnessConfidence',
  minimum: number
) {
  if (accepted(source[valueKey], source[confidenceKey], minimum)) {
    target[valueKey] = source[valueKey];
    target[confidenceKey] = source[confidenceKey];
  }
}

function accepted(
  value: number | null,
  confidence: number | null,
  minimum: number
): value is number {
  return value !== null && confidenceAccepted(confidence, minimum);
}

function confidenceAccepted(confidence: number | null, minimum: number): confidence is number {
  return (
    confidence !== null && Number.isFinite(confidence) && confidence >= minimum && confidence <= 1
  );
}

function hasUsefulState(state: DailyCheckInState): boolean {
  return state.mood.score !== null || hasSleepState(state.sleep);
}

function hasSleepState(sleep: DailyCheckInState['sleep']): boolean {
  return (
    [
      sleep.durationMinutes,
      sleep.subjectiveQualityScore,
      sleep.awakeningsCount,
      sleep.awakeDuringNightMinutes,
      sleep.restfulnessScore
    ].some((value) => value !== null) || sleep.multipleAwakenings
  );
}

function missingFields(state: DailyCheckInState): string[] {
  const fields: string[] = [];
  if (state.mood.score === null) fields.push('mood');
  for (const key of [
    'durationMinutes',
    'subjectiveQualityScore',
    'awakeningsCount',
    'awakeDuringNightMinutes',
    'restfulnessScore'
  ] as const) {
    if (
      state.sleep[key] === null &&
      !(key === 'awakeningsCount' && state.sleep.multipleAwakenings)
    ) {
      fields.push(key);
    }
  }
  return fields;
}

function nextFallbackQuestion(locale: DailyCheckInLocale, state: DailyCheckInState): string {
  const next =
    missingFields(state).find((field) => field !== 'awakeDuringNightMinutes') ?? 'restfulnessScore';
  return fallbackQuestions[locale][next] ?? fallbackQuestions[locale].restfulnessScore;
}

function cleanQuestion(value: string | null): string | null {
  const clean = value?.trim();
  return clean ? clean.slice(0, 320) : null;
}

function cleanNote(value: string | null): string | null {
  const clean = value?.trim();
  return clean ? clean.slice(0, 240) : null;
}

function publicState(state: DailyCheckInState) {
  return {
    mood: state.mood.score === null ? null : { score: state.mood.score, note: state.mood.note },
    sleep: hasSleepState(state.sleep)
      ? {
          durationMinutes: state.sleep.durationMinutes,
          durationApproximate: state.sleep.durationApproximate,
          subjectiveQualityScore: state.sleep.subjectiveQualityScore,
          awakeningsCount: state.sleep.awakeningsCount,
          awakeningsApproximate: state.sleep.awakeningsApproximate,
          multipleAwakenings: state.sleep.multipleAwakenings,
          awakeDuringNightMinutes: state.sleep.awakeDuringNightMinutes,
          awakeDuringNightApproximate: state.sleep.awakeDuringNightApproximate,
          restfulnessScore: state.sleep.restfulnessScore,
          note: state.sleep.note
        }
      : null
  };
}

export function localDateAt(referenceAt: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(referenceAt);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    return referenceAt.toISOString().slice(0, 10);
  }
}
