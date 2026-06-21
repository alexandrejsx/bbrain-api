import { ReflectiveProfileRepository } from '../../domain/conversation/repositories/reflective-profile.repository';
import { AIContextMessageRepository } from './ai-context-message.repository';
import {
  AIContext,
  AIContextBuildResult,
  AIContextMessage,
  AIUserProfileSummary
} from './ai-context.types';

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

export class AIContextService {
  constructor(
    private readonly profileRepository: ReflectiveProfileRepository,
    private readonly messageRepository: AIContextMessageRepository
  ) {}

  async build(userId: string, conversationId?: string): Promise<AIContextBuildResult> {
    const [profile, recentMessages] = await Promise.all([
      this.profileRepository.findByUserId(userId),
      conversationId
        ? this.messageRepository.findRecent(userId, conversationId, RECENT_MESSAGES_LIMIT)
        : Promise.resolve([])
    ]);

    if (!profile) {
      return {
        profileConfigured: false,
        context: { userProfileSummary: {}, recentMessages: [] }
      };
    }

    const raw = profile.toJson();
    const profileSummary = compactObject<AIUserProfileSummary>({
      preferredTone: cleanText(raw.preferredTone),
      routineSummary: cleanList(raw.routineNotes, PROFILE_COLLECTION_LIMIT)?.join('; '),
      recurringThemes: cleanList(raw.recurringThemes, PROFILE_COLLECTION_LIMIT),
      emotionalPatterns: cleanList(raw.emotionalPatterns, PROFILE_COLLECTION_LIMIT),
      helpfulStrategies: cleanList(raw.helpfulStrategies, PROFILE_COLLECTION_LIMIT),
      unhelpfulStrategies: cleanList(raw.unhelpfulStrategies, PROFILE_COLLECTION_LIMIT),
      declaredLimits: cleanList(raw.boundaries, PROFILE_COLLECTION_LIMIT)
    });

    const context: AIContext = compactObject({
      userProfileSummary: profileSummary,
      conversationSummary: cleanText(raw.currentContextSummary, CONVERSATION_SUMMARY_LIMIT),
      recentMessages: this.limitRecentMessages(recentMessages)
    });

    return { profileConfigured: true, context, sourceProfile: profile };
  }

  private limitRecentMessages(messages: AIContextMessage[]): AIContextMessage[] {
    return messages
      .filter((message) => cleanText(message.content))
      .slice(-RECENT_MESSAGES_LIMIT)
      .map((message) => ({
        ...message,
        content: cleanText(message.content, RECENT_MESSAGE_CONTENT_LIMIT)!
      }));
  }
}
