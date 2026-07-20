import { parseObservationExtractionResponse } from '../../../infrastructure/wellbeing-history/structured-output/observation-extraction-response.parser';
import {
  OBSERVATION_EXTRACTION_SCHEMA_VERSION,
  ObservationExtractionRequest,
  ObservationTemporalReference
} from '../../../use-cases/wellbeing-history/ports/observation-extractor.port';

const request: ObservationExtractionRequest = {
  currentUserMessage: 'Dormi umas cinco horas. Hoje estou em 7 de 10. Hoje foi um dia misto.',
  referenceAt: '2026-07-20T15:00:00.000-03:00',
  timezone: 'America/Sao_Paulo',
  sourceMessageId: 'message-current',
  conversationId: 'conversation-1'
};

const emptyMoodData = {
  emotions: [],
  intensity: null,
  intensityScaleMax: null,
  score: null,
  scoreScaleMax: null,
  isMixed: null,
  coverage: null,
  summary: null
};

const emptySleepData = {
  durationMinutes: null,
  durationIsApproximate: null,
  fellAsleepAt: null,
  fellAsleepAtIsApproximate: null,
  wokeAt: null,
  wokeAtIsApproximate: null,
  awakenings: null,
  awakeningsIsApproximate: null,
  quality: null,
  qualityIsApproximate: null,
  restedness: null,
  restednessIsApproximate: null,
  periodDescription: null
};

const currentDayTemporal: ObservationTemporalReference = {
  scope: 'day',
  precision: 'relative',
  startAt: '2026-07-20T00:00:00.000-03:00',
  endAt: '2026-07-20T23:59:59.999-03:00',
  originalExpression: 'Hoje'
};

const baseMoodEvent = {
  kind: 'mood_event',
  subject: 'user',
  assertion: 'affirmed',
  reportingMode: 'specific_occurrence',
  evidenceMode: 'direct_self_report',
  sourceQuote: 'Hoje estou em 7 de 10.',
  correctsObservationId: null,
  temporal: currentDayTemporal,
  confidence: 0.98,
  removeFields: [],
  mood: {
    ...emptyMoodData,
    score: 7,
    scoreScaleMax: 10,
    coverage: 'single_moment'
  }
};

const serialize = (candidates: unknown[]): string =>
  JSON.stringify({
    schemaVersion: OBSERVATION_EXTRACTION_SCHEMA_VERSION,
    candidates
  });

describe('parseObservationExtractionResponse', () => {
  it('parses discriminated mood and partial sleep candidates without inventing absent fields', () => {
    const response = parseObservationExtractionResponse(
      serialize([
        baseMoodEvent,
        {
          kind: 'mood_daily_summary',
          subject: 'user',
          assertion: 'affirmed',
          reportingMode: 'daily_summary',
          evidenceMode: 'direct_self_report',
          sourceQuote: 'Hoje foi um dia misto.',
          correctsObservationId: null,
          temporal: currentDayTemporal,
          confidence: 0.95,
          removeFields: [],
          mood: {
            ...emptyMoodData,
            isMixed: true,
            coverage: 'full_day',
            summary: 'dia misto'
          }
        },
        {
          kind: 'sleep_record',
          subject: 'user',
          assertion: 'affirmed',
          reportingMode: 'specific_occurrence',
          evidenceMode: 'direct_self_report',
          sourceQuote: 'Dormi umas cinco horas.',
          correctsObservationId: null,
          temporal: {
            scope: 'night',
            precision: 'unknown',
            startAt: null,
            endAt: null,
            originalExpression: null
          },
          confidence: 0.97,
          removeFields: [],
          sleep: {
            ...emptySleepData,
            durationMinutes: 300,
            durationIsApproximate: true
          }
        }
      ]),
      'Provider',
      request
    );

    expect(response.schemaVersion).toBe(OBSERVATION_EXTRACTION_SCHEMA_VERSION);
    expect(response.candidates).toHaveLength(3);
    expect(response.candidates[0]).toMatchObject({
      kind: 'mood_event',
      mood: { score: 7, scoreScaleMax: 10, coverage: 'single_moment' }
    });
    expect(response.candidates[1]).toMatchObject({
      kind: 'mood_daily_summary',
      mood: { isMixed: true, coverage: 'full_day' }
    });
    expect(response.candidates[2]).toMatchObject({
      kind: 'sleep_record',
      sleep: { durationMinutes: 300, durationIsApproximate: true }
    });
    expect(response.candidates[2]).not.toHaveProperty('sleep.quality');
  });

  it('accepts one partial ongoing-period sleep observation instead of artificial nights', () => {
    const periodRequest: ObservationExtractionRequest = {
      ...request,
      currentUserMessage: 'Tenho dormido mal nas últimas semanas.'
    };
    const response = parseObservationExtractionResponse(
      serialize([
        {
          kind: 'sleep_record',
          subject: 'user',
          assertion: 'affirmed',
          reportingMode: 'period_summary',
          evidenceMode: 'direct_self_report',
          sourceQuote: 'Tenho dormido mal nas últimas semanas.',
          correctsObservationId: null,
          temporal: {
            scope: 'ongoing_period',
            precision: 'approximate',
            startAt: null,
            endAt: '2026-07-20T15:00:00.000-03:00',
            originalExpression: 'nas últimas semanas'
          },
          confidence: 0.93,
          removeFields: [],
          sleep: {
            ...emptySleepData,
            quality: 'poor',
            qualityIsApproximate: true,
            periodDescription: 'sono ruim nas últimas semanas'
          }
        }
      ]),
      'Provider',
      periodRequest
    );

    expect(response.candidates).toHaveLength(1);
    expect(response.candidates[0]).toMatchObject({
      kind: 'sleep_record',
      reportingMode: 'period_summary',
      temporal: { scope: 'ongoing_period' },
      sleep: { quality: 'poor', qualityIsApproximate: true }
    });
  });

  it('allows corrections only when they target a supplied recent structured observation', () => {
    const correctionRequest: ObservationExtractionRequest = {
      ...request,
      currentUserMessage: 'Na verdade, a frustração aconteceu anteontem.',
      recentStructuredObservations: [
        {
          observationId: 'mood-previous',
          sourceMessageId: 'message-previous',
          kind: 'mood_event',
          temporal: currentDayTemporal,
          mood: { emotions: ['frustração'] }
        }
      ]
    };
    const correction = {
      ...baseMoodEvent,
      sourceQuote: 'a frustração aconteceu anteontem',
      reportingMode: 'correction',
      correctsObservationId: 'mood-previous',
      temporal: {
        scope: 'day',
        precision: 'relative',
        startAt: '2026-07-18T00:00:00.000-03:00',
        endAt: '2026-07-18T23:59:59.999-03:00',
        originalExpression: 'anteontem'
      },
      mood: {
        ...emptyMoodData,
        emotions: ['frustração'],
        coverage: 'single_moment'
      }
    };

    expect(
      parseObservationExtractionResponse(serialize([correction]), 'Provider', correctionRequest)
        .candidates[0]
    ).toMatchObject({ reportingMode: 'correction', correctsObservationId: 'mood-previous' });

    expect(() =>
      parseObservationExtractionResponse(
        serialize([{ ...correction, correctsObservationId: 'unknown-observation' }]),
        'Provider',
        correctionRequest
      )
    ).toThrow('correction references an unknown observation');
  });

  it('preserves an explicit field-removal instruction for a known correction target', () => {
    const correctionRequest: ObservationExtractionRequest = {
      ...request,
      currentUserMessage: 'Na verdade, não acordei três vezes.',
      recentStructuredObservations: [
        {
          observationId: 'sleep-previous',
          sourceMessageId: 'message-previous',
          kind: 'sleep_record',
          temporal: {
            scope: 'night',
            precision: 'unknown'
          },
          sleep: { awakenings: 3, awakeningsIsApproximate: false }
        }
      ]
    };
    const correction = {
      kind: 'sleep_record',
      subject: 'user',
      assertion: 'affirmed',
      reportingMode: 'correction',
      evidenceMode: 'direct_self_report',
      sourceQuote: 'não acordei três vezes',
      correctsObservationId: 'sleep-previous',
      temporal: {
        scope: 'unknown',
        precision: 'unknown',
        startAt: null,
        endAt: null,
        originalExpression: null
      },
      confidence: 0.98,
      removeFields: ['awakenings'],
      sleep: emptySleepData
    };

    expect(
      parseObservationExtractionResponse(serialize([correction]), 'Provider', correctionRequest)
        .candidates[0]
    ).toMatchObject({ removeFields: ['awakenings'], sleep: {} });
  });

  it('accepts a temporal-only correction for a known observation', () => {
    const correctionRequest: ObservationExtractionRequest = {
      ...request,
      currentUserMessage: 'Na verdade isso aconteceu anteontem.',
      recentStructuredObservations: [
        {
          observationId: 'mood-previous',
          sourceMessageId: 'message-previous',
          kind: 'mood_event',
          temporal: currentDayTemporal,
          mood: { emotions: ['frustração'] }
        }
      ]
    };
    const correction = {
      ...baseMoodEvent,
      reportingMode: 'correction',
      sourceQuote: 'isso aconteceu anteontem',
      correctsObservationId: 'mood-previous',
      removeFields: [],
      temporal: {
        scope: 'day',
        precision: 'relative',
        startAt: '2026-07-18',
        endAt: null,
        originalExpression: 'anteontem'
      },
      mood: emptyMoodData
    };

    expect(
      parseObservationExtractionResponse(serialize([correction]), 'Provider', correctionRequest)
        .candidates[0]
    ).toMatchObject({
      reportingMode: 'correction',
      correctsObservationId: 'mood-previous',
      mood: {},
      temporal: { scope: 'day', startAt: '2026-07-18' }
    });
  });

  it('rejects temporal values without literal evidence and datetimes without an offset', () => {
    expect(() =>
      parseObservationExtractionResponse(
        serialize([
          {
            ...baseMoodEvent,
            temporal: { ...currentDayTemporal, originalExpression: null }
          }
        ]),
        'Provider',
        request
      )
    ).toThrow('resolved or relative temporal data requires literal evidence');

    expect(() =>
      parseObservationExtractionResponse(
        serialize([
          {
            ...baseMoodEvent,
            temporal: {
              scope: 'moment',
              precision: 'exact',
              startAt: '2026-07-20T15:00:00',
              endAt: null,
              originalExpression: 'Hoje'
            }
          }
        ]),
        'Provider',
        request
      )
    ).toThrow('temporal.startAt must be ISO-8601');

    expect(() =>
      parseObservationExtractionResponse(
        serialize([
          {
            ...baseMoodEvent,
            temporal: {
              scope: 'moment',
              precision: 'exact',
              startAt: '2026-02-30T15:00:00Z',
              endAt: null,
              originalExpression: 'Hoje'
            }
          }
        ]),
        'Provider',
        request
      )
    ).toThrow('temporal.startAt must be ISO-8601');
  });

  it('rejects quotes that are not exact excerpts of the current user message', () => {
    expect(() =>
      parseObservationExtractionResponse(
        serialize([{ ...baseMoodEvent, sourceQuote: 'O usuário está em sete de dez.' }]),
        'Provider',
        request
      )
    ).toThrow('candidate.sourceQuote is not an exact current-message quote');
  });

  it('rejects schema drift, extra properties and invalid confidence', () => {
    expect(() =>
      parseObservationExtractionResponse(
        JSON.stringify({ schemaVersion: 'v2', candidates: [] }),
        'Provider',
        request
      )
    ).toThrow('schemaVersion is unsupported');

    expect(() =>
      parseObservationExtractionResponse(
        serialize([{ ...baseMoodEvent, unexpected: true }]),
        'Provider',
        request
      )
    ).toThrow('candidate properties do not match the schema');

    expect(() =>
      parseObservationExtractionResponse(
        serialize([{ ...baseMoodEvent, confidence: 1.1 }]),
        'Provider',
        request
      )
    ).toThrow('candidate.confidence is outside 0..1');
  });
});
