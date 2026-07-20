import { WellbeingObservation } from '../../wellbeing-history/entities/wellbeing-observation.entity';
import { MongoWellbeingObservationMapper } from '../../../infrastructure/database/mongodb/mappers/wellbeing-observation.mapper';

describe('MongoWellbeingObservationMapper', () => {
  it('centralizes camelCase to snake_case conversion and restores the aggregate', () => {
    const observation = WellbeingObservation.create({
      userId: 'user-id',
      idempotencyKey: 'message-1:0:v1',
      kind: 'sleep_record',
      data: {
        durationMinutes: { value: 300, precision: 'approximate' },
        wakeFeeling: { value: 'cansado', precision: 'exact' }
      },
      temporalReference: {
        kind: 'specific_night',
        localDate: '2026-07-19',
        timezone: 'America/Sao_Paulo',
        precision: 'approximate'
      },
      provenance: {
        source: 'conversation_extraction',
        sourceMessageId: 'message-1',
        conversationId: 'conversation-id',
        evidenceFingerprint: 'a'.repeat(64),
        confidence: 0.98,
        modelRef: 'openai:model',
        promptRef: 'prompt-v1',
        schemaRef: 'schema-v1'
      },
      createdAt: new Date('2026-07-20T12:00:00.000Z'),
      updatedAt: new Date('2026-07-20T12:00:00.000Z')
    });
    observation.pullDomainEvents();

    const persistence = MongoWellbeingObservationMapper.toPersistence(observation);

    expect(persistence).toMatchObject({
      user_id: 'user-id',
      idempotency_key: 'message-1:0:v1',
      data: {
        duration_minutes: { value: 300, precision: 'approximate' },
        wake_feeling: { value: 'cansado', precision: 'exact' }
      },
      temporal_reference: {
        kind: 'specific_night',
        local_date: '2026-07-19'
      },
      provenance_history: [
        expect.objectContaining({
          source_message_id: 'message-1',
          evidence_fingerprint: 'a'.repeat(64),
          prompt_ref: 'prompt-v1'
        })
      ]
    });

    const restored = MongoWellbeingObservationMapper.toDomain(persistence);
    expect(restored.toJson()).toEqual(observation.toJson());
    expect(restored.pullDomainEvents()).toEqual([]);
  });

  it('rejects a persisted revision number without its complete revision history', () => {
    const observation = WellbeingObservation.create({
      userId: 'user-id',
      idempotencyKey: 'manual:revision-corruption',
      kind: 'mood_event',
      data: { descriptors: ['calmo'] },
      temporalReference: { kind: 'unknown', timezone: 'UTC' },
      provenance: { source: 'manual' }
    });
    const persistence = MongoWellbeingObservationMapper.toPersistence(observation);

    expect(() =>
      MongoWellbeingObservationMapper.toDomain({
        ...persistence,
        revision: 2,
        revision_history: []
      })
    ).toThrow('revisionHistory must contain every superseded revision');
  });

  it('redacts a legacy evidence quote while reconstituting old documents', () => {
    const observation = WellbeingObservation.create({
      userId: 'user-id',
      idempotencyKey: 'legacy:evidence',
      kind: 'mood_event',
      data: { descriptors: ['preocupado'] },
      temporalReference: { kind: 'unknown', timezone: 'UTC' },
      provenance: { source: 'manual' }
    });
    const persistence = MongoWellbeingObservationMapper.toPersistence(observation);
    persistence.provenance_history = [
      {
        source: 'conversation_extraction',
        source_message_id: 'message-id',
        conversation_id: 'conversation-id',
        evidence_quote: 'conteúdo literal antigo',
        confidence: 0.9,
        model_ref: 'legacy-model',
        prompt_ref: 'legacy-prompt',
        schema_ref: 'legacy-schema'
      }
    ];

    const restored = MongoWellbeingObservationMapper.toDomain(persistence);

    expect(restored.currentProvenance).toMatchObject({
      source: 'conversation_extraction',
      evidenceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u)
    });
    expect(JSON.stringify(restored.toJson())).not.toContain('conteúdo literal antigo');
  });
});
