import { ReflectiveProfileRepository } from '../../domain/conversation/repositories/reflective-profile.repository';
import { User } from '../../domain/users/entities/user.entity';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import {
  ConversationAgentContext,
  ConversationAgentContextBuildResult,
  ConversationStyleContext,
  RecentConversationMessage,
  UserProfileContextSummary
} from './conversation-agent-context';
import { ConversationAgentContextBuilderPort } from './ports/conversation-agent-context-builder.port';
import { ConversationMessageHistoryPort } from './ports/conversation-message-history.port';

const PROFILE_COLLECTION_LIMIT = 8;
const RECENT_MESSAGES_LIMIT = 20;
const RECENT_MESSAGE_CONTENT_LIMIT = 4000;
const CONVERSATION_SUMMARY_LIMIT = 500;

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
    private readonly messageHistory: ConversationMessageHistoryPort
  ) {}

  async build(
    userId: string,
    conversationId?: string
  ): Promise<ConversationAgentContextBuildResult> {
    const [user, profile, recentMessages] = await Promise.all([
      this.userRepository.findById(userId),
      this.profileRepository.findByUserId(userId),
      conversationId
        ? this.messageHistory.findRecent(userId, conversationId, RECENT_MESSAGES_LIMIT)
        : Promise.resolve([])
    ]);

    if (!user) {
      throw new Error(`User not found for conversation context: ${userId}`);
    }

    const userIdentityContext = {
      displayName: this.buildDisplayName(user),
      preferredLanguage: cleanText(user.profile?.basicInfo.language)
    };

    if (!profile) {
      return {
        profileConfigured: false,
        context: { userIdentityContext, userProfileSummary: {}, recentMessages: [] }
      };
    }

    const raw = profile.toJson();
    const profileSummary = compactObject<UserProfileContextSummary>({
      goals: cleanList(raw.analysisGoals, PROFILE_COLLECTION_LIMIT),
      routineSummary: cleanList(raw.routineNotes, PROFILE_COLLECTION_LIMIT)?.join('; '),
      recurringThemes: cleanList(raw.recurringThemes, PROFILE_COLLECTION_LIMIT),
      emotionalPatterns: cleanList(raw.emotionalPatterns, PROFILE_COLLECTION_LIMIT),
      helpfulStrategies: cleanList(raw.helpfulStrategies, PROFILE_COLLECTION_LIMIT),
      unhelpfulStrategies: cleanList(raw.unhelpfulStrategies, PROFILE_COLLECTION_LIMIT),
      declaredLimits: cleanList(raw.boundaries, PROFILE_COLLECTION_LIMIT),
      reportedFormalDiagnoses: cleanList(raw.reportedFormalDiagnoses, PROFILE_COLLECTION_LIMIT),
      reportedMedication: cleanText(raw.reportedMedication),
      professionalSupport: cleanText(raw.professionalSupport)
    });
    const conversationStyle = this.buildConversationStyle(raw.preferredTone);

    const context: ConversationAgentContext = compactObject({
      userIdentityContext,
      userProfileSummary: profileSummary,
      conversationStyle,
      conversationSummary: cleanText(raw.currentContextSummary, CONVERSATION_SUMMARY_LIMIT),
      recentMessages: this.limitRecentMessages(recentMessages)
    });

    return { profileConfigured: true, context, sourceProfile: profile };
  }

  private buildDisplayName(user: User): string {
    return user.profile?.basicInfo.preferredName?.trim() || user.name.value;
  }

  private limitRecentMessages(messages: RecentConversationMessage[]): RecentConversationMessage[] {
    return messages
      .filter((message) => cleanText(message.content))
      .slice(-RECENT_MESSAGES_LIMIT)
      .map((message) => ({
        ...message,
        content: cleanText(message.content, RECENT_MESSAGE_CONTENT_LIMIT)!
      }));
  }

  private buildConversationStyle(preferredTone?: string): ConversationStyleContext | undefined {
    const tone = cleanText(preferredTone);
    return tone ? { preferredTone: tone } : undefined;
  }
}
