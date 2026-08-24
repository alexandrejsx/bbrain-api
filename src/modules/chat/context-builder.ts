import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { USERS_REPOSITORY } from '../../modules/tokens';
import { CurrentContextRepository, MemoryRepository } from '../memory/memory.repository';
import { DataConsentPolicy } from '../users/data-consent.policy';
import { DailyCheckInRepository } from '../daily-check-in/daily-check-in.repository';
import { MoodRepository } from '../mood/mood.repository';
import { SleepRepository } from '../sleep/sleep.repository';
import {
  AWAKE_TIME_DURING_NIGHT_VALUES,
  SLEEP_QUALITY_CLASSIFICATIONS,
  WAKE_RESTFULNESS_VALUES
} from '../sleep/sleep-quality';
import { ChatSessionRepository } from './chat-session.repository';
import { ContextBuildResult, ConversationContext } from './conversation-context';

@Injectable()
export class ContextBuilder {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly users: UserRepository,
    private readonly sessions: ChatSessionRepository,
    private readonly currentContexts: CurrentContextRepository,
    private readonly memories: MemoryRepository,
    private readonly dailyCheckIns: DailyCheckInRepository,
    private readonly moods: MoodRepository,
    private readonly sleep: SleepRepository,
    private readonly consentPolicy: DataConsentPolicy
  ) {}

  async build(
    userId: string,
    sessionId: string,
    currentMessage: string
  ): Promise<ContextBuildResult> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const consent = this.consentPolicy.resolve(user);
    const profile = user.profile;

    const [recentMessages, currentContext, memories, patterns] = consent.canUseConversationData
      ? await Promise.all([
          this.sessions.getRecent(userId, sessionId),
          this.currentContexts.findByUserId(userId),
          this.memories.findRelevant(userId, 'memory', currentMessage, 6),
          this.memories.findRelevant(userId, 'pattern', currentMessage, 3)
        ])
      : [[], null, [], []];

    const formalDiagnoses =
      consent.allowPersonalization &&
      consent.allowSensitiveDataStorage &&
      profile?.professionalContext.hasFormalDiagnosis === 'yes'
        ? (profile.professionalContext.diagnoses ?? [])
            .map((diagnosis) => diagnosis.condition?.trim())
            .filter((condition): condition is string => Boolean(condition))
            .slice(0, 3)
            .map((condition) => ({
              condition,
              source: 'user_reported_formal_diagnosis' as const
            }))
        : undefined;

    const todayCheckInSession =
      consent.canUseConversationData && consent.canExtractWellbeing
        ? await this.dailyCheckIns.findByUserAndDate(
            userId,
            localDateAt(new Date(), consent.timezone)
          )
        : null;
    const [moodRecord, sleepRecord] =
      todayCheckInSession?.status === 'completed'
        ? await Promise.all([
            todayCheckInSession.moodRecordId
              ? this.moods.findById(userId, todayCheckInSession.moodRecordId)
              : null,
            todayCheckInSession.sleepRecordId
              ? this.sleep.findById(userId, todayCheckInSession.sleepRecordId)
              : null
          ])
        : [null, null];

    return {
      profileConfigured: profile?.profileCompleted === true,
      consent,
      context: {
        identity: {
          preferredName: consent.allowPersonalization
            ? profile?.basicInfo.preferredName?.trim() || user.name.value
            : undefined,
          preferredLanguage: profile?.basicInfo.language
        },
        ...(consent.allowPersonalization
          ? {
              profile: {
                goals: [...(profile?.goals.mainGoals ?? []), profile?.goals.otherGoal]
                  .filter((value): value is string => Boolean(value?.trim()))
                  .slice(0, 8),
                communicationStyle: profile?.conversationPreferences.communicationStyle,
                formalDiagnoses,
                ...(consent.allowSensitiveDataStorage
                  ? {
                      professionalSupport: {
                        inTherapy: profile?.professionalContext.isInTherapy,
                        psychiatricFollowUp: profile?.professionalContext.hasPsychiatricFollowUp,
                        medicationWithProfessionalFollowUp:
                          profile?.professionalContext.usesMedicationWithProfessionalFollowUp
                      }
                    }
                  : {})
              }
            }
          : {}),
        currentContext: currentContext
          ? {
              summary: currentContext.summary,
              topics: currentContext.topics,
              pendingItems: currentContext.pendingItems
            }
          : undefined,
        memories: memories.map((memory) => ({
          summary: memory.summary,
          kind: memory.kind,
          topics: memory.topics,
          eventDate: memory.eventDate?.toISOString()
        })),
        patterns: patterns.map((pattern) => ({
          summary: pattern.summary,
          topics: pattern.topics,
          evidenceCount: pattern.evidenceCount
        })),
        ...(todayCheckInSession?.status === 'completed'
          ? {
              todayCheckIn: {
                localDate: todayCheckInSession.localDate,
                mood: moodRecord ? publicMood(moodRecord.data) : null,
                sleep: sleepRecord ? publicSleep(sleepRecord.data) : null
              }
            }
          : {}),
        recentMessages: recentMessages.map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString()
        }))
      }
    };
  }
}

function localDateAt(referenceAt: Date, timezone: string): string {
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

function publicMood(data: Record<string, unknown>) {
  return typeof data.moodScore === 'number'
    ? {
        score: data.moodScore,
        ...(typeof data.note === 'string' ? { note: data.note } : {})
      }
    : null;
}

function publicSleep(
  data: Record<string, unknown>
): NonNullable<ConversationContext['todayCheckIn']>['sleep'] {
  const durationMinutes = preservedValue<number>(data.durationMinutes, 'number');
  const wakeRestfulness = enumValue(data.wakeRestfulness, WAKE_RESTFULNESS_VALUES);
  const awakeTimeDuringNight = enumValue(data.awakeTimeDuringNight, AWAKE_TIME_DURING_NIGHT_VALUES);
  const quality = data.sleepQuality;
  if (
    !durationMinutes ||
    !wakeRestfulness ||
    !awakeTimeDuringNight ||
    !quality ||
    typeof quality !== 'object' ||
    Array.isArray(quality)
  ) {
    return null;
  }
  const item = quality as Record<string, unknown>;
  const classification = enumValue(item.classification, SLEEP_QUALITY_CLASSIFICATIONS);
  if (typeof item.score !== 'number' || !classification) return null;
  return {
    durationMinutes,
    wakeRestfulness,
    awakeTimeDuringNight,
    sleepQuality: { score: item.score, classification },
    ...(typeof data.sleepLatency === 'string' ? { sleepLatency: data.sleepLatency as never } : {}),
    ...(data.sleepOnsetTime ? { sleepOnsetTime: data.sleepOnsetTime as never } : {}),
    ...(data.wakeTime ? { wakeTime: data.wakeTime as never } : {}),
    ...(typeof data.note === 'string' ? { note: data.note } : {})
  };
}

function enumValue<const T extends readonly string[]>(value: unknown, values: T) {
  return typeof value === 'string' && values.includes(value) ? (value as T[number]) : undefined;
}

function preservedValue<T>(value: unknown, kind: 'number' | 'string') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  if (typeof item.value !== kind) return undefined;
  return {
    value: item.value as T,
    precision: item.precision === 'approximate' ? ('approximate' as const) : ('exact' as const)
  };
}
