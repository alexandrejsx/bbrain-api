import { WellbeingHistoryController } from '../../../controllers/wellbeing-history.controller';
import { WellbeingObservation } from '../../wellbeing-history/entities/wellbeing-observation.entity';

describe('WellbeingHistoryController provenance transparency', () => {
  it('returns the owner-visible provenance chain without internal model or prompt references', async () => {
    const observation = WellbeingObservation.create({
      userId: 'user-id',
      idempotencyKey: 'conversation:source:mood',
      kind: 'mood_event',
      data: { descriptors: ['ansioso'] },
      temporalReference: { kind: 'unknown', timezone: 'UTC' },
      provenance: {
        source: 'conversation_extraction',
        sourceMessageId: 'message-1',
        conversationId: 'conversation-1',
        evidenceFingerprint: 'a'.repeat(64),
        confidence: 0.97,
        modelRef: 'private-model-ref',
        promptRef: 'private-prompt-ref',
        schemaRef: 'private-schema-ref'
      },
      createdAt: new Date('2026-07-20T12:00:00.000Z')
    });
    observation.correctManually(
      { kind: 'mood_event', data: { descriptors: ['frustrado'] } },
      new Date('2026-07-20T13:00:00.000Z')
    );
    const service = { list: jest.fn().mockResolvedValue([observation]) };
    const controller = new WellbeingHistoryController(service as never);

    const result = await controller.list({ user: { id: 'user-id' } } as never, {});

    expect(result.items[0]).toMatchObject({
      provenance: { source: 'manual_correction' },
      provenanceHistory: [
        {
          source: 'conversation_extraction',
          sourceMessageId: 'message-1',
          conversationId: 'conversation-1',
          confidence: 0.97
        },
        { source: 'manual_correction' }
      ]
    });
    expect(JSON.stringify(result)).not.toContain('private-model-ref');
    expect(JSON.stringify(result)).not.toContain('private-prompt-ref');
    expect(JSON.stringify(result)).not.toContain('private-schema-ref');
    expect(JSON.stringify(result)).not.toContain('evidenceFingerprint');
  });
});
