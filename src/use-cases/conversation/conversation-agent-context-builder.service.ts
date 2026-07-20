import { ReflectiveProfileRepository } from '../../domain/conversation/repositories/reflective-profile.repository';
import { ConversationStateRepository } from '../../domain/conversation/repositories/conversation-state.repository';
import { User } from '../../domain/users/entities/user.entity';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import {
  ConversationAgentContext,
  ConversationAgentContextBuildResult,
  ConversationStyleContext,
  UserIdentityConversationContext,
  UserProfileContextSummary
} from './conversation-agent-context';
import { ConversationAgentContextBuilderPort } from './ports/conversation-agent-context-builder.port';

const PROFILE_COLLECTION_LIMIT = 8;

const cleanText = (value?: string, maxLength?: number): string | undefined => {
  const cleaned = value?.trim();
  if (!cleaned) return undefined;
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
};

const cleanList = (values: string[], limit: number): string[] | undefined => {
  const cleaned = values
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, limit);
  return cleaned.length ? cleaned : undefined;
};

const compactObject = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;

export class ConversationAgentContextBuilderService implements ConversationAgentContextBuilderPort {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly profileRepository: ReflectiveProfileRepository,
    private readonly conversationStateRepository: ConversationStateRepository
  ) {}

  async build(
    userId: string,
    conversationId?: string
  ): Promise<ConversationAgentContextBuildResult> {
    const [user, profile] = await Promise.all([
      this.userRepository.findById(userId),
      this.profileRepository.findByUserId(userId)
    ]);

    if (!user) {
      throw new Error(`User not found for conversation context: ${userId}`);
    }

    const dataPolicy = this.buildDataPolicy(user);
    const conversationState =
      conversationId &&
      dataPolicy.allowPersonalization &&
      dataPolicy.allowMemory &&
      dataPolicy.allowSensitiveDataStorage
        ? await this.conversationStateRepository.findActive(userId, conversationId)
        : null;
    const userIdentityContext = compactObject<UserIdentityConversationContext>({
      displayName: dataPolicy.allowPersonalization ? this.buildDisplayName(user) : undefined,
      preferredLanguage: cleanText(user.profile?.basicInfo.language)
    });

    if (!profile) {
      return {
        profileConfigured: false,
        context: {
          userIdentityContext,
          userProfileSummary: {},
          conversationState: conversationState?.toSnapshot()
        },
        dataPolicy,
        sourceConversationState: conversationState ?? undefined
      };
    }

    const raw = profile.toJson();
    const profileSummary = dataPolicy.allowPersonalization
      ? compactObject<UserProfileContextSummary>({
          goals: cleanList(raw.analysisGoals, PROFILE_COLLECTION_LIMIT),
          ...(dataPolicy.allowMemory
            ? {
                routineSummary: cleanList(raw.routineNotes, PROFILE_COLLECTION_LIMIT)?.join('; '),
                recurringThemes: cleanList(raw.recurringThemes, PROFILE_COLLECTION_LIMIT),
                emotionalPatterns: cleanList(raw.emotionalPatterns, PROFILE_COLLECTION_LIMIT),
                helpfulStrategies: cleanList(raw.helpfulStrategies, PROFILE_COLLECTION_LIMIT),
                unhelpfulStrategies: cleanList(raw.unhelpfulStrategies, PROFILE_COLLECTION_LIMIT),
                declaredLimits: cleanList(raw.boundaries, PROFILE_COLLECTION_LIMIT)
              }
            : {})
        })
      : {};
    const conversationStyle = dataPolicy.allowPersonalization
      ? this.buildConversationStyle(raw.preferredTone)
      : undefined;

    const context: ConversationAgentContext = compactObject({
      userIdentityContext,
      userProfileSummary: profileSummary,
      conversationStyle,
      conversationState: conversationState?.toSnapshot()
    });

    return {
      profileConfigured: true,
      context,
      dataPolicy,
      sourceProfile: profile,
      sourceConversationState: conversationState ?? undefined
    };
  }

  private buildDisplayName(user: User): string {
    return user.profile?.basicInfo.preferredName?.trim() || user.name.value;
  }

  private buildConversationStyle(preferredTone?: string): ConversationStyleContext | undefined {
    const tone = cleanText(preferredTone);
    return tone ? { preferredTone: tone } : undefined;
  }

  private buildDataPolicy(user: User) {
    const privacy = user.profile?.privacySettings;

    return {
      timezone: user.timezone || 'UTC',
      // General chat keeps legacy compatibility; sensitive automatic capture requires explicit opt-in.
      allowPersonalization: privacy?.allowPersonalization !== false,
      allowMemory: privacy?.allowMemory !== false,
      allowMoodInsights: privacy?.allowMoodInsights === true,
      allowSensitiveDataStorage: privacy?.allowSensitiveDataStorage === true
    };
  }
}
