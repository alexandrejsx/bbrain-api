import { MongoConversationExchangeLedgerRepository } from '../../../infrastructure/database/mongodb/repositories/mongo-conversation-exchange-ledger.repository';

const input = {
  userId: 'user-id',
  conversationId: 'conversation-id',
  sourceMessageId: 'message-id',
  requestFingerprint: 'f'.repeat(64),
  claimedAt: new Date('2026-07-20T10:00:00.000Z')
};

describe('MongoConversationExchangeLedgerRepository', () => {
  it('claims a new request while persisting no message content', async () => {
    const baseRepository = { add: jest.fn().mockResolvedValue(undefined) };
    const repository = new MongoConversationExchangeLedgerRepository(baseRepository as never, {
      ttlHours: 24,
      processingLeaseSeconds: 120
    });

    const result = await repository.claim(input);

    expect(result).toMatchObject({ status: 'claimed', claimId: expect.any(String) });
    const persistence = baseRepository.add.mock.calls[0][0];
    expect(persistence).toMatchObject({
      user_id: 'user-id',
      conversation_id: 'conversation-id',
      source_message_id: 'message-id',
      request_fingerprint: 'f'.repeat(64),
      status: 'processing'
    });
    expect(persistence).not.toHaveProperty('content');
    expect(persistence).not.toHaveProperty('user_message');
    expect(persistence).not.toHaveProperty('assistant_message');
  });

  it('detects source-id reuse with another HMAC without comparing literal content', async () => {
    const baseRepository = {
      add: jest.fn().mockRejectedValue({ code: 11000 }),
      findOne: jest.fn().mockResolvedValue({
        request_fingerprint: 'a'.repeat(64),
        status: 'completed'
      })
    };
    const repository = new MongoConversationExchangeLedgerRepository(baseRepository as never, {
      ttlHours: 24,
      processingLeaseSeconds: 120
    });

    await expect(repository.claim(input)).resolves.toEqual({ status: 'fingerprint_conflict' });
  });

  it('reclaims an expired processing lease atomically', async () => {
    const baseRepository = {
      add: jest.fn().mockRejectedValue({ code: 11000 }),
      findOne: jest.fn().mockResolvedValue({
        request_fingerprint: 'f'.repeat(64),
        status: 'processing',
        lease_expires_at: new Date('2026-07-20T09:59:00.000Z')
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'ledger-id' })
    };
    const repository = new MongoConversationExchangeLedgerRepository(baseRepository as never, {
      ttlHours: 24,
      processingLeaseSeconds: 120
    });

    const result = await repository.claim(input);

    expect(result).toMatchObject({ status: 'claimed', claimId: expect.any(String) });
    expect(baseRepository.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ lease_expires_at: { $lte: input.claimedAt } }),
      expect.objectContaining({ claim_id: expect.any(String) })
    );
  });

  it('completes only the active owner and stores technical metadata', async () => {
    const baseRepository = { findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'ledger-id' }) };
    const repository = new MongoConversationExchangeLedgerRepository(baseRepository as never, {
      ttlHours: 24,
      processingLeaseSeconds: 120
    });

    await expect(
      repository.complete({
        userId: 'user-id',
        conversationId: 'conversation-id',
        sourceMessageId: 'message-id',
        claimId: 'claim-id',
        completedAt: new Date('2026-07-20T10:00:10.000Z'),
        riskLevel: 'low',
        scopeStatus: 'in_scope',
        usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 }
      })
    ).resolves.toBe(true);

    const update = baseRepository.findOneAndUpdate.mock.calls[0][1];
    expect(update).toMatchObject({
      status: 'completed',
      risk_level: 'low',
      scope_status: 'in_scope',
      total_tokens: 7
    });
    expect(update).not.toHaveProperty('content');
  });
});
