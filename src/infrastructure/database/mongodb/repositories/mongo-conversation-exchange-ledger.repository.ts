import { randomUUID } from 'node:crypto';
import {
  CompleteConversationExchangeInput,
  ConversationExchangeClaimInput,
  ConversationExchangeClaimResult,
  ConversationExchangeLedgerPort
} from '../../../../use-cases/conversation/ports/conversation-exchange-ledger.port';
import { MongodbRepository } from '../mongodb.repository';
import { ConversationExchangeLedgerDocument } from '../schemas/conversation-exchange-ledger.schema';

export interface ConversationExchangeLedgerRetention {
  ttlHours: number;
  processingLeaseSeconds: number;
}

export class MongoConversationExchangeLedgerRepository implements ConversationExchangeLedgerPort {
  constructor(
    private readonly baseRepository: MongodbRepository<ConversationExchangeLedgerDocument>,
    private readonly retention: ConversationExchangeLedgerRetention
  ) {}

  async claim(input: ConversationExchangeClaimInput): Promise<ConversationExchangeClaimResult> {
    const claimId = randomUUID();
    const leaseExpiresAt = new Date(
      input.claimedAt.getTime() + this.retention.processingLeaseSeconds * 1000
    );
    const expiresAt = new Date(
      input.claimedAt.getTime() + this.retention.ttlHours * 60 * 60 * 1000
    );

    try {
      await this.baseRepository.add({
        _id: randomUUID(),
        user_id: input.userId,
        conversation_id: input.conversationId,
        source_message_id: input.sourceMessageId,
        request_fingerprint: input.requestFingerprint,
        status: 'processing',
        claim_id: claimId,
        lease_expires_at: leaseExpiresAt,
        created_at: input.claimedAt,
        updated_at: input.claimedAt,
        expires_at: expiresAt
      });
      return { status: 'claimed', claimId };
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }

    const ownership = {
      user_id: input.userId,
      conversation_id: input.conversationId,
      source_message_id: input.sourceMessageId
    };
    const existing = await this.baseRepository.findOne(ownership);
    if (!existing) return this.claim(input);
    if (existing.request_fingerprint !== input.requestFingerprint) {
      return { status: 'fingerprint_conflict' };
    }
    if (existing.status === 'completed') return { status: 'already_completed' };
    if (existing.lease_expires_at > input.claimedAt) return { status: 'in_progress' };

    const reclaimed = await this.baseRepository.findOneAndUpdate(
      {
        ...ownership,
        status: 'processing',
        request_fingerprint: input.requestFingerprint,
        lease_expires_at: { $lte: input.claimedAt }
      },
      {
        claim_id: claimId,
        lease_expires_at: leaseExpiresAt,
        updated_at: input.claimedAt,
        expires_at: expiresAt
      }
    );

    return reclaimed ? { status: 'claimed', claimId } : { status: 'in_progress' };
  }

  async complete(input: CompleteConversationExchangeInput): Promise<boolean> {
    const completed = await this.baseRepository.findOneAndUpdate(
      {
        user_id: input.userId,
        conversation_id: input.conversationId,
        source_message_id: input.sourceMessageId,
        status: 'processing',
        claim_id: input.claimId
      },
      {
        status: 'completed',
        risk_level: input.riskLevel,
        scope_status: input.scopeStatus,
        input_tokens: input.usage.inputTokens,
        output_tokens: input.usage.outputTokens,
        total_tokens: input.usage.totalTokens,
        updated_at: input.completedAt,
        lease_expires_at: input.completedAt
      }
    );
    return completed !== null;
  }

  async release(
    userId: string,
    conversationId: string,
    sourceMessageId: string,
    claimId: string
  ): Promise<void> {
    await this.baseRepository.deleteMany({
      user_id: userId,
      conversation_id: conversationId,
      source_message_id: sourceMessageId,
      status: 'processing',
      claim_id: claimId
    });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.baseRepository.deleteMany({ user_id: userId });
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}
