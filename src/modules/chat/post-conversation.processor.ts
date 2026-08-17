import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PostConversationExtractor,
  POST_CONVERSATION_EXTRACTOR_VERSION
} from '../../ai/post-conversation.extractor';
import { promptVersions } from '../../ai/prompts/prompt-registry';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { USERS_REPOSITORY } from '../../modules/tokens';
import { CurrentContextRepository } from '../memory/memory.repository';
import { MemoryService } from '../memory/memory.service';
import { DataConsentPolicy } from '../users/data-consent.policy';

export interface PostConversationInput {
  userId: string;
  sessionId: string;
  sourceEventId: string;
  userMessage: string;
  assistantReply: string;
  capturedAt: Date;
  timezone: string;
}

@Injectable()
export class PostConversationProcessor {
  constructor(
    private readonly extractor: PostConversationExtractor,
    @Inject(USERS_REPOSITORY) private readonly users: UserRepository,
    private readonly consentPolicy: DataConsentPolicy,
    private readonly currentContexts: CurrentContextRepository,
    private readonly memory: MemoryService,
    private readonly config: ConfigService
  ) {}

  async process(input: PostConversationInput): Promise<void> {
    const initialUser = await this.users.findById(input.userId);
    if (!initialUser || initialUser.hasScheduledDeletion()) return;
    const initialConsent = this.consentPolicy.resolve(initialUser);
    if (!initialConsent.canUseConversationData) return;

    const output = await this.extractor.extract({
      userMessage: input.userMessage,
      assistantReply: input.assistantReply,
      timezone: input.timezone,
      referenceAt: input.capturedAt,
      correlationId: input.sourceEventId
    });

    const currentUser = await this.users.findById(input.userId);
    if (!currentUser || currentUser.hasScheduledDeletion()) return;
    const consent = this.consentPolicy.resolve(currentUser);
    const minimumConfidence = this.config.get<number>('ai.extractionMinimumConfidence') ?? 0.85;
    const writes: Promise<unknown>[] = [];

    if (
      consent.canUseConversationData &&
      output.currentContext &&
      validConfidence(output.currentContext.confidence, minimumConfidence) &&
      validText(output.currentContext.summary, 320)
    ) {
      writes.push(
        this.currentContexts.replace({
          userId: input.userId,
          summary: output.currentContext.summary.trim(),
          topics: stringList(output.currentContext.topics),
          pendingItems: stringList(output.currentContext.pendingItems, 3),
          confidence: output.currentContext.confidence,
          sourceEventId: input.sourceEventId,
          sessionId: input.sessionId,
          capturedAt: input.capturedAt
        })
      );
    }

    if (
      consent.canUseConversationData &&
      output.memory &&
      validConfidence(output.memory.confidence, minimumConfidence) &&
      validText(output.memory.summary, 280)
    ) {
      writes.push(
        this.memory.consolidate({
          userId: input.userId,
          memory: output.memory,
          pattern: output.pattern,
          sessionId: input.sessionId,
          sourceEventId: input.sourceEventId,
          capturedAt: input.capturedAt,
          extractorVersion: POST_CONVERSATION_EXTRACTOR_VERSION,
          promptVersion: promptVersions.memory,
          patternPromptVersion: promptVersions.pattern
        })
      );
    }

    await Promise.all(writes);
  }
}

@Injectable()
export class PostConversationScheduler {
  private readonly logger = new Logger(PostConversationScheduler.name);
  private readonly blockedUsers = new Set<string>();
  private readonly activeByUser = new Map<string, Set<Promise<void>>>();

  constructor(private readonly processor: PostConversationProcessor) {}

  schedule(input: PostConversationInput): void {
    if (this.blockedUsers.has(input.userId)) return;
    setImmediate(() => {
      if (this.blockedUsers.has(input.userId)) return;
      const task = this.processor.process(input).catch((error) => {
        this.logger.warn(
          `Post-conversation processing failed userId=${input.userId} sessionId=${input.sessionId} sourceEventId=${input.sourceEventId} errorType=${error instanceof Error ? error.name : 'unknown'}`
        );
      });
      const active = this.activeByUser.get(input.userId) ?? new Set<Promise<void>>();
      active.add(task);
      this.activeByUser.set(input.userId, active);
      void task.finally(() => {
        active.delete(task);
        if (active.size === 0) this.activeByUser.delete(input.userId);
      });
    });
  }

  async blockAndDrain(userId: string): Promise<void> {
    this.blockedUsers.add(userId);
    await Promise.allSettled([...(this.activeByUser.get(userId) ?? [])]);
  }

  allow(userId: string): void {
    this.blockedUsers.delete(userId);
  }
}

function validConfidence(value: number, minimum: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= 1;
}

function validText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function stringList(value: unknown, limit = 8): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => validText(item, 120)).slice(0, limit)
    : [];
}
