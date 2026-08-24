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
import { InvalidWellbeingRecordError } from '../wellbeing/wellbeing.types';
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

const MAX_QUESTIONS = 2;

const firstQuestions: Record<DailyCheckInLocale, string> = {
  'pt-BR': 'Como você está se sentindo hoje? Pode me contar do seu jeito.',
  'en-US': 'How are you feeling today? You can describe it in your own words.',
  'es-ES': '¿Cómo te sientes hoy? Puedes contármelo con tus propias palabras.'
};

const followUpQuestions: Record<DailyCheckInLocale, string> = {
  'pt-BR': 'Se fosse descrever seu estado de hoje em poucas palavras, como ele está?',
  'en-US': 'If you described how you feel today in a few words, what would you say?',
  'es-ES': 'Si describieras cómo te sientes hoy en pocas palabras, ¿qué dirías?'
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
    if (!current.nextQuestion) return this.toResponse(context.access, current);
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
        missingFields: claimed.state.mood.score === null ? ['mood'] : [],
        currentQuestion: claimed.nextQuestion,
        questionCount: claimed.questionCount,
        maxQuestions: MAX_QUESTIONS,
        userMessage: input.message,
        correlationId: input.clientRequestId
      });
      const minimumConfidence = this.config.get<number>('ai.extractionMinimumConfidence') ?? 0.85;
      const state = mergeAcceptedState(claimed.state, generated, minimumConfidence);
      const limitReached = claimed.questionCount >= MAX_QUESTIONS;
      const safetyHandoff = generated.requiresSafetyHandoff;
      const moodStageFinished = safetyHandoff || limitReached || state.mood.score !== null;
      const completed = safetyHandoff;
      const nextQuestion = moodStageFinished ? null : followUpQuestions[input.locale];

      let moodRecordId: string | undefined;
      const completedAt = completed ? new Date() : undefined;
      if (completed) {
        moodRecordId = await this.persistMood(claimed, state, completedAt!);
      }

      const saved = await this.repository.finishTurn({
        sessionId: claimed.id,
        requestId: input.clientRequestId,
        fingerprint,
        state,
        questionCount: moodStageFinished ? claimed.questionCount : claimed.questionCount + 1,
        nextQuestion,
        completed,
        moodRecordId,
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

  async submitSleep(input: {
    userId: string;
    locale: DailyCheckInLocale;
    clientRequestId: string;
    recordDate: string;
    durationMinutes: number;
    wakeRestfulness: 'very_tired' | 'tired' | 'fairly_rested' | 'rested';
    awakeTimeDuringNight: 'under_15' | '15_to_29' | '30_to_59' | '60_or_more';
    sleepLatency?: 'up_to_15' | '16_to_30' | '31_to_60' | 'over_60' | 'unknown';
    sleepOnsetTime?: string;
    wakeTime?: string;
    note?: string;
  }) {
    const context = await this.resolveContext(input.userId);
    this.assertAvailable(context.access, context.canStoreWellbeing);
    if (input.recordDate > context.localDate) throw new InvalidWellbeingRecordError();
    const current = await this.repository.findByUserAndDate(input.userId, context.localDate);
    if (!current) throw new DailyCheckInNotStartedError();
    const payload = JSON.stringify({
      recordDate: input.recordDate,
      durationMinutes: input.durationMinutes,
      wakeRestfulness: input.wakeRestfulness,
      awakeTimeDuringNight: input.awakeTimeDuringNight,
      sleepLatency: input.sleepLatency,
      sleepOnsetTime: input.sleepOnsetTime,
      wakeTime: input.wakeTime,
      note: input.note
    });
    const fingerprint = this.fingerprint(input.userId, payload);
    const processed = current.processedRequests.find((item) => item.id === input.clientRequestId);
    if (processed) {
      if (processed.fingerprint !== fingerprint) throw new DailyCheckInRequestConflictError();
      return this.toResponse(context.access, current);
    }
    if (current.status === 'completed') return this.toResponse(context.access, current);
    if (current.nextQuestion) throw new DailyCheckInNotStartedError();

    const claimed = await this.repository.claimAnswer(
      current.id,
      input.clientRequestId,
      fingerprint
    );
    if (!claimed) throw new DailyCheckInRequestInProgressError();
    try {
      const capturedAt = new Date();
      const state: DailyCheckInState = {
        ...structuredClone(claimed.state),
        sleep: {
          durationMinutes: input.durationMinutes,
          wakeRestfulness: input.wakeRestfulness,
          awakeTimeDuringNight: input.awakeTimeDuringNight,
          sleepLatency: input.sleepLatency ?? null,
          sleepOnsetTime: input.sleepOnsetTime ?? null,
          wakeTime: input.wakeTime ?? null,
          note: cleanNote(input.note ?? null),
          recordDate: input.recordDate
        }
      };
      const [moodRecordId, sleepRecordId] = await Promise.all([
        this.persistMood(claimed, state, capturedAt),
        this.persistSleep(claimed, state, capturedAt)
      ]);
      const saved = await this.repository.finishTurn({
        sessionId: claimed.id,
        requestId: input.clientRequestId,
        fingerprint,
        state,
        questionCount: claimed.questionCount,
        nextQuestion: null,
        completed: true,
        moodRecordId,
        sleepRecordId,
        completedAt: capturedAt
      });
      if (!saved) throw new DailyCheckInRequestInProgressError();
      return this.toResponse(context.access, saved);
    } catch (error) {
      await this.repository.releaseAnswer(claimed.id, input.clientRequestId);
      throw error;
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

  private async persistMood(
    session: DailyCheckInSession,
    state: DailyCheckInState,
    capturedAt: Date
  ) {
    if (state.mood.score === null || state.mood.scoreConfidence === null) return undefined;
    const mood = await this.mood.createFromGuidedCheckIn({
      userId: session.userId,
      checkInId: session.id,
      sourceEventId: `daily-check-in:${session.id}:mood`,
      capturedAt,
      timezone: session.timezone,
      localDate: session.localDate,
      score: state.mood.score,
      scoreConfidence: state.mood.scoreConfidence,
      note: state.mood.note,
      promptVersion: promptVersions.dailyCheckIn
    });
    return mood.id;
  }

  private async persistSleep(
    session: DailyCheckInSession,
    state: DailyCheckInState,
    capturedAt: Date
  ) {
    if (!hasStructuredSleep(state.sleep)) throw new DailyCheckInNotStartedError();
    const sleep = await this.sleep.createFromGuidedCheckIn({
      userId: session.userId,
      checkInId: session.id,
      sourceEventId: `daily-check-in:${session.id}:sleep`,
      capturedAt,
      timezone: session.timezone,
      localDate: state.sleep.recordDate,
      data: {
        durationMinutes: state.sleep.durationMinutes,
        wakeRestfulness: state.sleep.wakeRestfulness,
        awakeTimeDuringNight: state.sleep.awakeTimeDuringNight,
        ...(state.sleep.sleepLatency ? { sleepLatency: state.sleep.sleepLatency } : {}),
        ...(state.sleep.sleepOnsetTime ? { sleepOnsetTime: state.sleep.sleepOnsetTime } : {}),
        ...(state.sleep.wakeTime ? { wakeTime: state.sleep.wakeTime } : {}),
        ...(state.sleep.note ? { note: state.sleep.note } : {})
      },
      promptVersion: promptVersions.dailyCheckIn
    });
    return sleep.id;
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
      localDate: session?.localDate ?? null,
      currentStep:
        session?.status === 'completed'
          ? 'completed'
          : session?.status === 'in_progress' && !session.nextQuestion
            ? 'sleep'
            : 'mood',
      nextQuestion: session?.status === 'in_progress' ? session.nextQuestion : null,
      completed: session?.status === 'completed',
      questionCount: session ? Math.min(session.questionCount, MAX_QUESTIONS) : 0,
      maxQuestions: MAX_QUESTIONS,
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
  return next;
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

function hasStructuredSleep(
  sleep: DailyCheckInState['sleep']
): sleep is DailyCheckInState['sleep'] & {
  durationMinutes: number;
  wakeRestfulness: NonNullable<DailyCheckInState['sleep']['wakeRestfulness']>;
  awakeTimeDuringNight: NonNullable<DailyCheckInState['sleep']['awakeTimeDuringNight']>;
  recordDate: string;
} {
  return (
    sleep.durationMinutes !== null &&
    sleep.wakeRestfulness !== null &&
    sleep.awakeTimeDuringNight !== null &&
    sleep.recordDate !== null
  );
}

function cleanNote(value: string | null): string | null {
  const clean = value?.trim();
  return clean ? clean.slice(0, 240) : null;
}

function publicState(state: DailyCheckInState) {
  return {
    mood: state.mood.score === null ? null : { score: state.mood.score, note: state.mood.note },
    sleep: hasStructuredSleep(state.sleep)
      ? {
          durationMinutes: state.sleep.durationMinutes,
          wakeRestfulness: state.sleep.wakeRestfulness,
          awakeTimeDuringNight: state.sleep.awakeTimeDuringNight,
          sleepLatency: state.sleep.sleepLatency,
          sleepOnsetTime: state.sleep.sleepOnsetTime,
          wakeTime: state.sleep.wakeTime,
          note: state.sleep.note,
          recordDate: state.sleep.recordDate
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
