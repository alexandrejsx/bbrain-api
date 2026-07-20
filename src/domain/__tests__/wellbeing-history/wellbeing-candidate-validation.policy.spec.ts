import {
  ConversationCandidateValidationContext,
  WellbeingCandidateValidationPolicy
} from '../../wellbeing-history/services/wellbeing-candidate-validation.policy';

const MESSAGE = 'Hoje estou ansioso, mas agora estou bem.';

function context(
  overrides: Partial<ConversationCandidateValidationContext> = {}
): ConversationCandidateValidationContext {
  return {
    sourceMessage: MESSAGE,
    sourceMessageId: 'message-1',
    conversationId: 'conversation-1',
    modelRef: 'model:opaque-ref',
    promptRef: 'prompt:opaque-ref',
    schemaRef: 'schema:opaque-ref',
    ...overrides
  };
}

function validCandidate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    subject: 'self',
    assertion: 'affirmed',
    reportingMode: 'direct_self_report',
    confidence: 0.9,
    evidenceQuote: 'estou ansioso',
    kind: 'mood_event',
    data: { descriptors: ['ansioso'] },
    temporalReference: {
      kind: 'specific_day',
      localDate: '2026-07-20',
      timezone: 'America/Sao_Paulo',
      precision: 'exact'
    },
    ...overrides
  };
}

describe('WellbeingCandidateValidationPolicy', () => {
  const policy = new WellbeingCandidateValidationPolicy(0.8);

  it.each([
    ['third-party subjects', { subject: 'third_party' }, 'subject_not_self'],
    ['negations', { assertion: 'negated' }, 'assertion_not_affirmed'],
    ['hypotheses', { assertion: 'hypothetical' }, 'assertion_not_affirmed'],
    ['desires', { assertion: 'desired' }, 'assertion_not_affirmed'],
    [
      'third-party reports about the user',
      { reportingMode: 'third_party_report' },
      'reporting_mode_not_direct_self_report'
    ],
    ['inferences', { reportingMode: 'inferred' }, 'reporting_mode_not_direct_self_report']
  ])('rejects %s', (_label, override, reason) => {
    const result = policy.validate(validCandidate(override), context());

    expect(result).toEqual(
      expect.objectContaining({ accepted: false, reasons: expect.arrayContaining([reason]) })
    );
  });

  it('accepts confidence exactly at the configured precision-first threshold', () => {
    const result = policy.validate(validCandidate({ confidence: 0.8 }), context());

    expect(result).toMatchObject({ accepted: true });
  });

  it('rejects a candidate below the confidence threshold', () => {
    const result = policy.validate(validCandidate({ confidence: 0.799 }), context());

    expect(result).toEqual({ accepted: false, reasons: ['confidence_below_threshold'] });
  });

  it('requires the evidence quote to be a literal substring of the source message', () => {
    const result = policy.validate(validCandidate({ evidenceQuote: 'Estou ansioso' }), context());

    expect(result).toEqual({ accepted: false, reasons: ['evidence_quote_not_literal'] });
  });

  it.each([
    ['an overall score', { explicitRating: { value: 7, scaleMax: 10 } }],
    ['an emotion intensity', { explicitIntensity: { value: 7, scaleMax: 10 } }]
  ])('rejects %s invented outside the literal evidence', (_label, data) => {
    const result = policy.validate(validCandidate({ data }), context());

    expect(result).toEqual({
      accepted: false,
      reasons: ['numeric_field_not_grounded_in_evidence']
    });
  });

  it('accepts an explicit score only when every numeric value is present in the quote', () => {
    const result = policy.validate(
      validCandidate({
        evidenceQuote: '7 de 10',
        data: { explicitRating: { value: 7, scaleMax: 10 } }
      }),
      context({ sourceMessage: 'Hoje estou em 7 de 10.' })
    );

    expect(result).toMatchObject({ accepted: true });
  });

  it.each([
    ['sleep duration', { durationMinutes: { value: 480, precision: 'exact' } }],
    ['awakening count', { awakeningCount: { value: 3, precision: 'exact' } }]
  ])('rejects an invented %s without matching field evidence', (_label, data) => {
    const result = policy.validate(
      validCandidate({
        kind: 'sleep_record',
        evidenceQuote: 'Dormi mal',
        data,
        temporalReference: {
          kind: 'specific_night',
          localDate: '2026-07-19',
          timezone: 'America/Sao_Paulo',
          precision: 'exact'
        }
      }),
      context({ sourceMessage: 'Dormi mal.' })
    );

    expect(result).toEqual({
      accepted: false,
      reasons: ['numeric_field_not_grounded_in_evidence']
    });
  });

  it('grounds duration and awakenings in Portuguese number words', () => {
    const quote = 'Dormi seis horas e acordei três vezes';
    const result = policy.validate(
      validCandidate({
        kind: 'sleep_record',
        evidenceQuote: quote,
        data: {
          durationMinutes: { value: 360, precision: 'exact' },
          awakeningCount: { value: 3, precision: 'exact' }
        },
        temporalReference: {
          kind: 'specific_night',
          localDate: '2026-07-19',
          timezone: 'America/Sao_Paulo',
          precision: 'exact'
        }
      }),
      context({ sourceMessage: `${quote}.` })
    );

    expect(result).toMatchObject({ accepted: true });
  });

  it('does not mistake a wake-up clock time for an awakening count', () => {
    const quote = 'Acordei às 3 da manhã';
    const result = policy.validate(
      validCandidate({
        kind: 'sleep_record',
        evidenceQuote: quote,
        data: { awakeningCount: { value: 3, precision: 'exact' } },
        temporalReference: {
          kind: 'specific_night',
          localDate: '2026-07-19',
          timezone: 'America/Sao_Paulo',
          precision: 'exact'
        }
      }),
      context({ sourceMessage: `${quote}.` })
    );

    expect(result).toEqual({
      accepted: false,
      reasons: ['numeric_field_not_grounded_in_evidence']
    });
  });

  it('does not mistake a compact clock time for a sleep duration', () => {
    const quote = 'Fui dormir às 5h';
    const result = policy.validate(
      validCandidate({
        kind: 'sleep_record',
        evidenceQuote: quote,
        data: { durationMinutes: { value: 300, precision: 'exact' } },
        temporalReference: {
          kind: 'specific_night',
          localDate: '2026-07-19',
          timezone: 'America/Sao_Paulo',
          precision: 'exact'
        }
      }),
      context({ sourceMessage: `${quote}.` })
    );

    expect(result).toEqual({
      accepted: false,
      reasons: ['numeric_field_not_grounded_in_evidence']
    });
  });

  it('rejects variant-specific invented and unknown fields', () => {
    const result = policy.validate(
      validCandidate({
        data: { descriptors: ['ansioso'], derivedScore: 3 }
      }),
      context()
    );

    expect(result).toEqual({ accepted: false, reasons: ['invalid_variant'] });
  });

  it('does not add absent mood fields to an accepted candidate', () => {
    const result = policy.validate(validCandidate(), context());

    expect(result.accepted).toBe(true);
    if (!result.accepted) throw new Error('Expected an accepted candidate');
    expect(result.candidate.data).toEqual({ descriptors: ['ansioso'] });
    expect(result.candidate.data).not.toHaveProperty('explicitRating');
    expect(result.candidate.data).not.toHaveProperty('intensityDescriptor');
    expect(result.candidate.provenance).toEqual({
      source: 'conversation_extraction',
      sourceMessageId: 'message-1',
      conversationId: 'conversation-1',
      evidenceQuote: 'estou ansioso',
      confidence: 0.9,
      modelRef: 'model:opaque-ref',
      promptRef: 'prompt:opaque-ref',
      schemaRef: 'schema:opaque-ref'
    });
  });

  it('preserves an explicit conversation correction target in automatic provenance', () => {
    const result = policy.validate(
      validCandidate({ correctsObservationId: 'observation-1' }),
      context()
    );

    expect(result).toMatchObject({
      accepted: true,
      candidate: {
        correctsObservationId: 'observation-1',
        provenance: {
          source: 'conversation_extraction',
          correctsObservationId: 'observation-1'
        }
      }
    });
  });

  it('rejects a manual override claimed by an automatic candidate', () => {
    const result = policy.validate(
      validCandidate({
        kind: 'mood_daily_summary',
        data: {
          descriptors: ['misto'],
          sourceObservationIds: [],
          coverage: 'unknown',
          status: 'current',
          summarySource: 'manual_override'
        }
      }),
      context()
    );

    expect(result).toEqual({ accepted: false, reasons: ['invalid_variant'] });
  });

  it('rejects malformed automatic provenance context', () => {
    const result = policy.validate(validCandidate(), context({ modelRef: '' }));

    expect(result).toEqual({ accepted: false, reasons: ['invalid_provenance_context'] });
  });
});
