import { ConversationScopeStatus } from '../../../domain/conversation/services/conversation-scope-policy.service';
import { LlmUsage } from '../../../domain/usage/value-objects/llm-usage';
import { ChatRiskLevel } from '../chat-agent.port';

export interface ConversationExchangeClaimInput {
  userId: string;
  conversationId: string;
  sourceMessageId: string;
  requestFingerprint: string;
  claimedAt: Date;
}

export type ConversationExchangeClaimResult =
  | { status: 'claimed'; claimId: string }
  | { status: 'already_completed' }
  | { status: 'in_progress' }
  | { status: 'fingerprint_conflict' };

export interface CompleteConversationExchangeInput {
  userId: string;
  conversationId: string;
  sourceMessageId: string;
  claimId: string;
  completedAt: Date;
  riskLevel: ChatRiskLevel;
  scopeStatus: ConversationScopeStatus;
  usage: LlmUsage;
}

export interface ConversationExchangeLedgerPort {
  claim(input: ConversationExchangeClaimInput): Promise<ConversationExchangeClaimResult>;
  complete(input: CompleteConversationExchangeInput): Promise<boolean>;
  release(
    userId: string,
    conversationId: string,
    sourceMessageId: string,
    claimId: string
  ): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}
