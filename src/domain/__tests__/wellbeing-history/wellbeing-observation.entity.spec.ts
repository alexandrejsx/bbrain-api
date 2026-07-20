import { Uuid } from '../../shared/uuid.vo';
import { WellbeingObservation } from '../../wellbeing-history/entities/wellbeing-observation.entity';
import {
  ConversationCorrectionProvenance,
  ConversationExtractionProvenance,
  TemporalReference
} from '../../wellbeing-history/value-objects/wellbeing-observation.types';

const OBSERVATION_ID = new Uuid('21f166b5-2e3d-49c1-8df8-a412b94f2042');
const CREATED_AT = new Date('2026-07-20T12:00:00.000Z');

function automaticProvenance(
  overrides: Partial<ConversationExtractionProvenance> = {}
): ConversationExtractionProvenance {
  return {
    source: 'conversation_extraction',
    sourceMessageId: 'message-1',
    conversationId: 'conversation-1',
    evidenceFingerprint: 'a'.repeat(64),
    confidence: 0.94,
    modelRef: 'model:opaque-ref',
    promptRef: 'prompt:opaque-ref',
    schemaRef: 'schema:opaque-ref',
    ...overrides
  };
}

function today(): TemporalReference {
  return {
    kind: 'specific_day',
    localDate: '2026-07-20',
    timezone: 'America/Sao_Paulo',
    precision: 'exact'
  };
}

function createMoodEvent() {
  return WellbeingObservation.create(
    {
      userId: 'user-1',
      idempotencyKey: 'message-1:mood:0',
      kind: 'mood_event',
      data: { descriptors: ['ansioso'] },
      temporalReference: today(),
      provenance: automaticProvenance(),
      createdAt: CREATED_AT
    },
    OBSERVATION_ID
  );
}

function createDerivedSummary() {
  return WellbeingObservation.create(
    {
      userId: 'user-1',
      idempotencyKey: 'summary:2026-07-20:v1',
      kind: 'mood_daily_summary',
      data: {
        descriptors: ['misto'],
        sourceObservationIds: ['observation-a', 'observation-b'],
        sourceObservationVersions: [
          { observationId: 'observation-a', revision: 1 },
          { observationId: 'observation-b', revision: 1 }
        ],
        coverage: 'partial',
        status: 'current',
        summarySource: 'derived'
      },
      temporalReference: today(),
      provenance: automaticProvenance({ evidenceFingerprint: 'b'.repeat(64) }),
      createdAt: CREATED_AT
    },
    OBSERVATION_ID
  );
}

describe('WellbeingObservation', () => {
  it('creates a typed mood event without deriving a numeric rating', () => {
    const observation = createMoodEvent();

    expect(observation.data).toEqual({ descriptors: ['ansioso'] });
    expect(observation.data).not.toHaveProperty('explicitRating');
    expect(observation.revision).toBe(1);
    expect(observation.toJson()).toMatchObject({
      kind: 'mood_event',
      provenance: {
        source: 'conversation_extraction',
        sourceMessageId: 'message-1',
        conversationId: 'conversation-1',
        evidenceFingerprint: 'a'.repeat(64),
        confidence: 0.94,
        modelRef: 'model:opaque-ref',
        promptRef: 'prompt:opaque-ref',
        schemaRef: 'schema:opaque-ref'
      },
      revision: 1,
      createdAt: '2026-07-20T12:00:00.000Z',
      updatedAt: '2026-07-20T12:00:00.000Z'
    });
    expect(observation.pullDomainEvents()).toEqual([
      expect.objectContaining({
        aggregateId: OBSERVATION_ID.value,
        name: 'wellbeing-history.observation.created'
      })
    ]);
  });

  it('accepts an explicit mood rating without inventing descriptors', () => {
    const observation = WellbeingObservation.create({
      userId: 'user-1',
      idempotencyKey: 'message-2:mood:0',
      kind: 'mood_event',
      data: { explicitRating: { value: 7, scaleMin: 0, scaleMax: 10 } },
      temporalReference: today(),
      provenance: automaticProvenance({ evidenceFingerprint: 'c'.repeat(64) }),
      createdAt: CREATED_AT
    });

    expect(observation.data).toEqual({
      explicitRating: { value: 7, scaleMin: 0, scaleMax: 10 }
    });
    expect(observation.data).not.toHaveProperty('descriptors');
  });

  it('rejects mood data with neither descriptors nor an explicit rating', () => {
    expect(() =>
      WellbeingObservation.create({
        userId: 'user-1',
        idempotencyKey: 'invalid-mood',
        kind: 'mood_event',
        data: {},
        temporalReference: today(),
        provenance: { source: 'manual' },
        createdAt: CREATED_AT
      })
    ).toThrow(
      'mood data requires descriptors, an explicit mixed report, an explicit rating and/or explicit intensity'
    );
  });

  it('keeps a partial approximate sleep report partial and approximate', () => {
    const observation = WellbeingObservation.create({
      userId: 'user-1',
      idempotencyKey: 'message-3:sleep:0',
      kind: 'sleep_record',
      data: {
        durationMinutes: { value: 300, precision: 'approximate' }
      },
      temporalReference: {
        kind: 'specific_night',
        localDate: '2026-07-19',
        timezone: 'America/Sao_Paulo',
        precision: 'exact'
      },
      provenance: automaticProvenance({ evidenceFingerprint: 'd'.repeat(64) }),
      createdAt: CREATED_AT
    });

    expect(observation.data).toEqual({
      durationMinutes: { value: 300, precision: 'approximate' }
    });
    expect(observation.data).not.toHaveProperty('quality');
    expect(observation.data).not.toHaveProperty('bedtime');
    expect(observation.data).not.toHaveProperty('wakeTime');
    expect(observation.data).not.toHaveProperty('awakeningCount');
    expect(observation.data).not.toHaveProperty('wakeFeeling');
  });

  it.each<TemporalReference>([
    {
      kind: 'moment',
      at: new Date('2026-07-20T12:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      precision: 'exact'
    },
    today(),
    {
      kind: 'specific_night',
      localDate: '2026-07-19',
      timezone: 'America/Sao_Paulo',
      precision: 'exact'
    },
    {
      kind: 'interval',
      startsAt: new Date('2026-07-20T09:00:00.000Z'),
      endsAt: new Date('2026-07-20T12:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      precision: 'approximate'
    },
    {
      kind: 'period',
      descriptor: 'últimas semanas',
      timezone: 'America/Sao_Paulo',
      precision: 'approximate'
    },
    { kind: 'unknown', timezone: 'America/Sao_Paulo' }
  ])('preserves the $kind temporal reference', (temporalReference) => {
    const observation = WellbeingObservation.create({
      userId: 'user-1',
      idempotencyKey: `temporal:${temporalReference.kind}`,
      kind: 'mood_event',
      data: { descriptors: ['bem'] },
      temporalReference,
      provenance: { source: 'manual' },
      createdAt: CREATED_AT
    });

    expect(observation.temporalReference).toEqual(temporalReference);
  });

  it('applies a manual correction as a new authoritative revision', () => {
    const observation = createMoodEvent();
    observation.pullDomainEvents();

    observation.correctManually(
      {
        kind: 'mood_event',
        data: { descriptors: ['frustrado'] },
        temporalReference: { kind: 'unknown', timezone: 'America/Sao_Paulo' }
      },
      new Date('2026-07-20T13:00:00.000Z')
    );

    expect(observation.data).toEqual({ descriptors: ['frustrado'] });
    expect(observation.temporalReference).toEqual({
      kind: 'unknown',
      timezone: 'America/Sao_Paulo'
    });
    expect(observation.revision).toBe(2);
    expect(observation.isManuallyControlled).toBe(true);
    expect(observation.currentProvenance).toEqual({
      source: 'manual_correction',
      correctedAt: new Date('2026-07-20T13:00:00.000Z')
    });
    expect(observation.provenanceHistory[0]).toMatchObject({
      source: 'conversation_extraction',
      evidenceFingerprint: 'a'.repeat(64)
    });
    expect(observation.revisionHistory).toEqual([
      expect.objectContaining({
        revision: 1,
        data: { descriptors: ['ansioso'] },
        operation: 'manual_correction',
        updatedAt: CREATED_AT,
        supersededAt: new Date('2026-07-20T13:00:00.000Z')
      })
    ]);
    expect(observation.pullDomainEvents()).toEqual([
      expect.objectContaining({ name: 'wellbeing-history.observation.corrected' })
    ]);
  });

  it('applies a later conversation correction without mislabeling it as manual', () => {
    const observation = createMoodEvent();
    observation.pullDomainEvents();
    const provenance: ConversationCorrectionProvenance = {
      ...automaticProvenance({
        sourceMessageId: 'message-2',
        evidenceFingerprint: 'e'.repeat(64)
      }),
      correctsObservationId: observation.id.value
    };

    observation.correctFromConversation(
      { kind: 'mood_event', data: { descriptors: ['frustração'] } },
      provenance,
      new Date('2026-07-20T13:00:00.000Z')
    );

    expect(observation.data).toEqual({ descriptors: ['frustração'] });
    expect(observation.revision).toBe(2);
    expect(observation.isManuallyControlled).toBe(false);
    expect(observation.currentProvenance).toMatchObject({
      source: 'conversation_extraction',
      sourceMessageId: 'message-2',
      correctsObservationId: observation.id.value
    });
  });

  it('never lets a later automatic correction overwrite a manual correction', () => {
    const observation = createMoodEvent();
    observation.correctManually(
      { kind: 'mood_event', data: { descriptors: ['calmo'] } },
      new Date('2026-07-20T13:00:00.000Z')
    );

    expect(() =>
      observation.correctFromConversation(
        { kind: 'mood_event', data: { descriptors: ['ansioso'] } },
        {
          ...automaticProvenance({ sourceMessageId: 'message-3' }),
          correctsObservationId: observation.id.value
        },
        new Date('2026-07-20T14:00:00.000Z')
      )
    ).toThrow('cannot overwrite a manual observation');
    expect(observation.data).toEqual({ descriptors: ['calmo'] });
    expect(observation.revision).toBe(2);
  });

  it('marks a derived summary stale when one of its source observations changes', () => {
    const summary = createDerivedSummary();
    summary.pullDomainEvents();

    expect(
      summary.markStale('source_observation_corrected', new Date('2026-07-20T13:00:00Z'))
    ).toBe(true);

    expect(summary.data).toMatchObject({
      status: 'stale',
      staleReason: 'source_observation_corrected',
      summarySource: 'derived',
      sourceObservationIds: ['observation-a', 'observation-b']
    });
    expect(summary.revision).toBe(2);
    expect(summary.pullDomainEvents()).toEqual([
      expect.objectContaining({ name: 'wellbeing-history.mood-summary.marked-stale' })
    ]);
  });

  it('turns an edited daily summary into a current manual override that cannot become stale', () => {
    const summary = createDerivedSummary();
    summary.pullDomainEvents();
    summary.markStale('source_observation_corrected', new Date('2026-07-20T13:00:00Z'));
    summary.pullDomainEvents();

    summary.correctManually(
      {
        kind: 'mood_daily_summary',
        data: {
          descriptors: ['misto'],
          sourceObservationIds: ['observation-a'],
          coverage: 'partial'
        }
      },
      new Date('2026-07-20T14:00:00Z')
    );

    expect(summary.data).toMatchObject({
      status: 'current',
      summarySource: 'manual_override',
      sourceObservationIds: ['observation-a']
    });
    expect(summary.data).not.toHaveProperty('staleReason');
    const revisionAfterOverride = summary.revision;
    summary.pullDomainEvents();

    expect(summary.markStale('source_observation_removed', new Date('2026-07-20T15:00:00Z'))).toBe(
      false
    );
    expect(summary.revision).toBe(revisionAfterOverride);
    expect(summary.pullDomainEvents()).toEqual([]);
  });

  it('emits a removal event without sensitive observation data', () => {
    const observation = createMoodEvent();
    observation.pullDomainEvents();

    observation.markRemoved(new Date('2026-07-20T13:00:00.000Z'));

    const [event] = observation.pullDomainEvents();
    expect(event).toMatchObject({
      aggregateId: observation.id.value,
      name: 'wellbeing-history.observation.removed'
    });
    expect(Object.keys(event).sort()).toEqual(['aggregateId', 'name', 'occurredOn']);
  });
});
