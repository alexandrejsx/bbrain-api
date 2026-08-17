import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConversationAgent } from '../../ai/conversation-agent';
import {
  ConversationSafetyPolicy,
  resolveLanguage
} from '../../ai/safety/conversation-safety.policy';
import {
  UsageLimitError,
  UsageMessageReservation,
  UsageService
} from '../../domain/usage/services/usage.service';
import { ChatRequestRepository, ChatSessionRepository } from './chat-session.repository';
import { ContextBuilder } from './context-builder';
import { PostConversationScheduler } from './post-conversation.processor';

export class ChatProviderUnavailableError extends Error {}
export class ChatMessageConflictError extends Error {}
export class ChatMessageAlreadyProcessedError extends Error {}
export class ChatMessageInProgressError extends Error {}

@Injectable()
export class SendChatMessageService {
  constructor(
    private readonly agent: ConversationAgent,
    private readonly contextBuilder: ContextBuilder,
    private readonly safety: ConversationSafetyPolicy,
    private readonly sessions: ChatSessionRepository,
    private readonly requests: ChatRequestRepository,
    private readonly usage: UsageService,
    private readonly postConversation: PostConversationScheduler
  ) {}

  async execute(input: {
    userId: string;
    conversationId?: string;
    clientMessageId?: string;
    message: string;
    acceptedLanguage?: string;
  }) {
    const capturedAt = new Date();
    const sessionId = input.conversationId ?? randomUUID();
    const sourceEventId = input.clientMessageId ?? randomUUID();
    const context = await this.contextBuilder.build(input.userId, sessionId, input.message);
    const language = resolveLanguage(
      context.context.identity?.preferredLanguage,
      input.acceptedLanguage
    );
    if (!context.profileConfigured) return this.safety.profileSetup(language);

    if (!context.consent.canUseConversationData) {
      await this.sessions.deleteSession(input.userId, sessionId);
    }

    const claim = await this.requests.claim({
      userId: input.userId,
      sessionId,
      sourceEventId,
      message: input.message
    });
    if (claim === 'conflict') throw new ChatMessageConflictError();
    if (claim === 'completed') throw new ChatMessageAlreadyProcessedError();
    if (claim === 'in_progress') throw new ChatMessageInProgressError();

    let reservation: UsageMessageReservation | undefined;
    try {
      reservation = await this.usage.assertCanSendMessage(input.userId, input.message);
      const generated = await this.agent.respond({
        message: input.message,
        context: context.context,
        language,
        correlationId: sourceEventId
      });
      const output = this.safety.apply({
        message: input.message,
        context: context.context,
        language,
        output: generated
      });

      await this.usage.registerReservedLlmUsage(reservation, generated.usage);
      if (context.consent.canUseConversationData && output.scopeStatus === 'in_scope') {
        await this.sessions.appendExchange({
          userId: input.userId,
          sessionId,
          sourceEventId,
          userMessage: input.message,
          assistantReply: output.reply,
          createdAt: capturedAt
        });
      }
      await this.requests.complete(input.userId, sessionId, sourceEventId);

      if (output.scopeStatus === 'in_scope' && context.consent.canUseConversationData) {
        this.postConversation.schedule({
          userId: input.userId,
          sessionId,
          sourceEventId,
          userMessage: input.message,
          assistantReply: output.reply,
          capturedAt,
          timezone: context.consent.timezone
        });
      }
      return output;
    } catch (error) {
      if (reservation) await this.usage.releaseMessageReservation(reservation);
      await this.requests.release(input.userId, sessionId, sourceEventId);
      if (
        error instanceof ChatMessageConflictError ||
        error instanceof ChatMessageAlreadyProcessedError ||
        error instanceof ChatMessageInProgressError
      ) {
        throw error;
      }
      if (error instanceof UsageLimitError) throw error;
      throw new ChatProviderUnavailableError();
    }
  }
}
