import { EventDispatcher } from '../../domain/core/event-dispatcher';
import {
  AssistantResponseProducedEvent,
  ConversationPolicyViolatedEvent,
  MessageReceivedEvent
} from '../../domain/conversation/events/conversation.events';
import { ConversationStateRepository } from '../../domain/conversation/repositories/conversation-state.repository';
import {
  ConversationScopePolicy,
  ConversationScopeStatus
} from '../../domain/conversation/services/conversation-scope-policy.service';
import { ConversationStateUpdatePolicy } from '../../domain/conversation/services/conversation-state-update-policy.service';
import { UsageService } from '../../domain/usage/services/usage.service';
import { WellbeingObservationCaptureScheduler } from '../wellbeing-history/wellbeing-observation-capture.scheduler';
import { ChatAgent, ChatRiskLevel } from './chat-agent.port';
import { ConversationLanguageService } from './conversation-language.service';
import { ConversationReplyCatalog } from './conversation-reply-catalog';
import { ConversationSafetyReplyPolicy } from './conversation-safety-reply.policy';
import { ConversationAgentContextBuilderPort } from './ports/conversation-agent-context-builder.port';
import {
  ConversationExchangeLedgerPort,
  ConversationExchangeClaimResult
} from './ports/conversation-exchange-ledger.port';
import { SensitiveTextFingerprintPort } from './ports/sensitive-text-fingerprint.port';

export interface SendChatMessageInput {
  userId: string;
  conversationId?: string;
  clientMessageId?: string;
  message: string;
  acceptedLanguage?: string;
}

export interface SendChatMessageOutput {
  reply: string;
  riskLevel: ChatRiskLevel;
  scopeStatus: ConversationScopeStatus;
}

export class ChatProviderUnavailableError extends Error {
  constructor() {
    super('Chat provider unavailable');
    this.name = 'ChatProviderUnavailableError';
  }
}

export class ConversationMessageFingerprintConflictError extends Error {
  constructor() {
    super('Source message id was already used for different content');
    this.name = 'ConversationMessageFingerprintConflictError';
  }
}

export class ConversationMessageAlreadyProcessedError extends Error {
  constructor() {
    super('The conversation exchange was already processed');
    this.name = 'ConversationMessageAlreadyProcessedError';
  }
}

export class ConversationMessageInProgressError extends Error {
  constructor() {
    super('The conversation exchange is already being processed');
    this.name = 'ConversationMessageInProgressError';
  }
}

interface ActiveClaim {
  conversationId: string;
  sourceMessageId: string;
  claimId: string;
}

export class SendChatMessageUseCase {
  constructor(
    private readonly chatAgent: ChatAgent,
    private readonly scopePolicy: ConversationScopePolicy,
    private readonly contextBuilder: ConversationAgentContextBuilderPort,
    private readonly conversationStateRepository: ConversationStateRepository,
    private readonly conversationStateUpdatePolicy: ConversationStateUpdatePolicy,
    private readonly exchangeLedger: ConversationExchangeLedgerPort,
    private readonly fingerprintService: SensitiveTextFingerprintPort,
    private readonly usageService: UsageService,
    private readonly eventDispatcher: EventDispatcher,
    private readonly languageService: ConversationLanguageService,
    private readonly replyCatalog: ConversationReplyCatalog,
    private readonly safetyReplyPolicy: ConversationSafetyReplyPolicy,
    private readonly conversationStateTtlHours: number,
    private readonly wellbeingCapture?: WellbeingObservationCaptureScheduler
  ) {}

  async execute(input: SendChatMessageInput): Promise<SendChatMessageOutput> {
    const receivedAt = new Date();
    const contextResult = await this.contextBuilder.build(input.userId, input.conversationId);
    const language = this.languageService.resolve(
      contextResult.context.userIdentityContext?.preferredLanguage,
      input.acceptedLanguage
    );

    if (!contextResult.profileConfigured) {
      return {
        reply: this.replyCatalog.getProfileSetupReply(language.responseLanguage),
        riskLevel: 'none',
        scopeStatus: 'in_scope'
      };
    }

    const canPersistConversationState =
      contextResult.dataPolicy.allowPersonalization &&
      contextResult.dataPolicy.allowMemory &&
      contextResult.dataPolicy.allowSensitiveDataStorage;

    if (input.conversationId && !canPersistConversationState) {
      await this.conversationStateRepository.deleteByConversation(
        input.userId,
        input.conversationId
      );
    }

    const claim = await this.claimExchange(input, receivedAt);
    let usageReservation;
    try {
      usageReservation = await this.usageService.assertCanSendMessage(input.userId, input.message);
    } catch (error) {
      await this.releaseClaim(input.userId, claim);
      throw error;
    }

    let agentResponse;
    try {
      const untrustedAgentResponse = await this.chatAgent.respond({
        message: input.message,
        context: contextResult.context,
        preferredLanguage: language.preferredLanguage,
        responseLanguage: language.responseLanguage
      });
      agentResponse = this.safetyReplyPolicy.resolve({
        currentUserMessage: input.message,
        context: contextResult.context,
        responseLanguage: language.responseLanguage,
        response: untrustedAgentResponse
      });
    } catch {
      await Promise.all([
        this.usageService.releaseMessageReservation(usageReservation),
        this.releaseClaim(input.userId, claim)
      ]);
      throw new ChatProviderUnavailableError();
    }

    const reply = this.scopePolicy.resolveReply(
      agentResponse.scopeStatus,
      agentResponse.reply,
      language.responseLanguage
    );

    try {
      if (
        input.conversationId &&
        canPersistConversationState &&
        agentResponse.scopeStatus === 'in_scope'
      ) {
        const update = this.conversationStateUpdatePolicy.buildNext(
          input.userId,
          input.conversationId,
          contextResult.sourceConversationState ?? null,
          agentResponse.conversationStateUpdate,
          input.message,
          reply,
          receivedAt,
          this.conversationStateTtlHours
        );
        if (update) {
          await this.conversationStateRepository.save(update.state, update.expectedRevision);
        }
      }

      await this.usageService.registerReservedLlmUsage(usageReservation, agentResponse.usage);
      if (claim) {
        const completed = await this.exchangeLedger.complete({
          userId: input.userId,
          conversationId: claim.conversationId,
          sourceMessageId: claim.sourceMessageId,
          claimId: claim.claimId,
          completedAt: new Date(),
          riskLevel: agentResponse.riskLevel,
          scopeStatus: agentResponse.scopeStatus,
          usage: agentResponse.usage
        });
        if (!completed) throw new ConversationMessageInProgressError();
      }
    } catch (error) {
      await Promise.all([
        this.usageService.releaseMessageReservation(usageReservation),
        this.releaseClaim(input.userId, claim)
      ]);
      throw error;
    }

    await this.eventDispatcher.dispatch(
      input.conversationId
        ? [
            new MessageReceivedEvent(input.conversationId),
            new AssistantResponseProducedEvent(input.conversationId),
            ...(agentResponse.scopeStatus === 'out_of_scope'
              ? [new ConversationPolicyViolatedEvent(input.conversationId)]
              : [])
          ]
        : []
    );

    if (input.conversationId && input.clientMessageId) {
      this.wellbeingCapture?.schedule({
        userId: input.userId,
        conversationId: input.conversationId,
        sourceMessageId: input.clientMessageId,
        currentUserMessage: input.message,
        timezone: contextResult.dataPolicy.timezone,
        allowAutomaticCapture:
          contextResult.dataPolicy.allowMoodInsights &&
          contextResult.dataPolicy.allowSensitiveDataStorage,
        referenceAt: receivedAt
      });
    }

    return {
      reply,
      riskLevel: agentResponse.riskLevel,
      scopeStatus: agentResponse.scopeStatus
    };
  }

  private async claimExchange(
    input: SendChatMessageInput,
    claimedAt: Date
  ): Promise<ActiveClaim | undefined> {
    if (!input.conversationId || !input.clientMessageId) return undefined;

    const result: ConversationExchangeClaimResult = await this.exchangeLedger.claim({
      userId: input.userId,
      conversationId: input.conversationId,
      sourceMessageId: input.clientMessageId,
      requestFingerprint: this.fingerprintService.fingerprint({
        purpose: 'conversation_request',
        userId: input.userId,
        conversationId: input.conversationId,
        sourceMessageId: input.clientMessageId,
        text: input.message
      }),
      claimedAt
    });

    if (result.status === 'fingerprint_conflict') {
      throw new ConversationMessageFingerprintConflictError();
    }
    if (result.status === 'already_completed') {
      throw new ConversationMessageAlreadyProcessedError();
    }
    if (result.status === 'in_progress') {
      throw new ConversationMessageInProgressError();
    }

    return {
      conversationId: input.conversationId,
      sourceMessageId: input.clientMessageId,
      claimId: result.claimId
    };
  }

  private async releaseClaim(userId: string, claim?: ActiveClaim): Promise<void> {
    if (!claim) return;
    await this.exchangeLedger.release(
      userId,
      claim.conversationId,
      claim.sourceMessageId,
      claim.claimId
    );
  }
}
