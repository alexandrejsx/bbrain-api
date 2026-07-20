import {
  TemporalReference,
  WellbeingObservationKind
} from '../../../wellbeing-history/value-objects/wellbeing-observation.types';
import {
  WellbeingCandidateRejectionReason,
  WellbeingCandidateSubject
} from '../../../wellbeing-history/services/wellbeing-candidate-validation.policy';

export type ExpectedExtractionDisposition = 'create' | 'correct' | 'reject';
export type ExpectedDailySummaryImpact =
  | 'none'
  | 'include_event'
  | 'invalidate_existing_summary'
  | 'replace_with_user_explicit';

export interface PtBrObservationExtractionCase {
  message: string;
  candidates: readonly Record<string, unknown>[];
  expected: {
    shouldCreateObservation: boolean;
    disposition: ExpectedExtractionDisposition;
    types: readonly WellbeingObservationKind[];
    subject: WellbeingCandidateSubject;
    temporalKinds: readonly TemporalReference['kind'][];
    emotions: readonly (readonly string[])[];
    intensities: readonly (string | undefined)[];
    approximationMarkers: readonly (readonly string[])[];
    confidences: readonly number[];
    fieldsThatMustRemainAbsent: readonly (readonly string[])[];
    dailySummaryImpact: ExpectedDailySummaryImpact;
    acceptedCandidateCount: number;
    rejectionReasons?: readonly WellbeingCandidateRejectionReason[];
  };
}

const TIMEZONE = 'America/Sao_Paulo';

function candidate(
  input: Record<string, unknown> & {
    kind: WellbeingObservationKind;
    evidenceQuote: string;
  }
): Record<string, unknown> {
  return {
    subject: 'self',
    assertion: 'affirmed',
    reportingMode: 'direct_self_report',
    confidence: 0.9,
    ...input
  };
}

export const PT_BR_OBSERVATION_EXTRACTION_CASES = [
  {
    message: 'Dormi umas cinco horas.',
    candidates: [
      candidate({
        kind: 'sleep_record',
        evidenceQuote: 'umas cinco horas',
        confidence: 0.98,
        data: { durationMinutes: { value: 300, precision: 'approximate' } },
        temporalReference: {
          kind: 'specific_night',
          localDate: '2026-07-19',
          timezone: TIMEZONE,
          precision: 'exact'
        }
      })
    ],
    expected: {
      shouldCreateObservation: true,
      disposition: 'create',
      types: ['sleep_record'],
      subject: 'self',
      temporalKinds: ['specific_night'],
      emotions: [[]],
      intensities: [undefined],
      approximationMarkers: [['data.durationMinutes']],
      confidences: [0.98],
      fieldsThatMustRemainAbsent: [
        ['data.quality', 'data.bedtime', 'data.wakeTime', 'data.awakeningCount', 'data.wakeFeeling']
      ],
      dailySummaryImpact: 'none',
      acceptedCandidateCount: 1
    }
  },
  {
    message: 'Acho que dormi mal.',
    candidates: [
      candidate({
        kind: 'sleep_record',
        evidenceQuote: 'Acho que dormi mal',
        confidence: 0.86,
        data: { quality: { value: 'mal', precision: 'approximate' } },
        temporalReference: {
          kind: 'specific_night',
          localDate: '2026-07-19',
          timezone: TIMEZONE,
          precision: 'exact'
        }
      })
    ],
    expected: {
      shouldCreateObservation: true,
      disposition: 'create',
      types: ['sleep_record'],
      subject: 'self',
      temporalKinds: ['specific_night'],
      emotions: [[]],
      intensities: [undefined],
      approximationMarkers: [['data.quality']],
      confidences: [0.86],
      fieldsThatMustRemainAbsent: [
        [
          'data.durationMinutes',
          'data.bedtime',
          'data.wakeTime',
          'data.awakeningCount',
          'data.wakeFeeling'
        ]
      ],
      dailySummaryImpact: 'none',
      acceptedCandidateCount: 1
    }
  },
  {
    message: 'Não estou mais ansioso.',
    candidates: [
      candidate({
        kind: 'mood_event',
        evidenceQuote: 'Não estou mais ansioso',
        assertion: 'negated',
        confidence: 0.99,
        data: { descriptors: ['ansioso'] },
        temporalReference: {
          kind: 'moment',
          at: new Date('2026-07-20T15:00:00.000Z'),
          timezone: TIMEZONE,
          precision: 'exact'
        }
      })
    ],
    expected: {
      shouldCreateObservation: false,
      disposition: 'reject',
      types: ['mood_event'],
      subject: 'self',
      temporalKinds: ['moment'],
      emotions: [['ansioso']],
      intensities: [undefined],
      approximationMarkers: [[]],
      confidences: [0.99],
      fieldsThatMustRemainAbsent: [['data.explicitRating', 'data.intensityDescriptor']],
      dailySummaryImpact: 'none',
      acceptedCandidateCount: 0,
      rejectionReasons: ['assertion_not_affirmed']
    }
  },
  {
    message: 'Hoje estou melhor do que ontem.',
    candidates: [
      candidate({
        kind: 'mood_event',
        evidenceQuote: 'estou melhor do que ontem',
        confidence: 0.86,
        data: { descriptors: ['melhor'] },
        temporalReference: {
          kind: 'specific_day',
          localDate: '2026-07-20',
          timezone: TIMEZONE,
          precision: 'exact'
        }
      })
    ],
    expected: {
      shouldCreateObservation: true,
      disposition: 'create',
      types: ['mood_event'],
      subject: 'self',
      temporalKinds: ['specific_day'],
      emotions: [['melhor']],
      intensities: [undefined],
      approximationMarkers: [[]],
      confidences: [0.86],
      fieldsThatMustRemainAbsent: [['data.explicitRating', 'data.intensityDescriptor']],
      dailySummaryImpact: 'include_event',
      acceptedCandidateCount: 1
    }
  },
  {
    message: 'Minha mãe não dormiu nada.',
    candidates: [
      candidate({
        kind: 'sleep_record',
        evidenceQuote: 'Minha mãe não dormiu nada',
        subject: 'third_party',
        assertion: 'negated',
        reportingMode: 'third_party_report',
        confidence: 0.99,
        data: { quality: { value: 'não dormiu', precision: 'exact' } },
        temporalReference: {
          kind: 'specific_night',
          localDate: '2026-07-19',
          timezone: TIMEZONE,
          precision: 'exact'
        }
      })
    ],
    expected: {
      shouldCreateObservation: false,
      disposition: 'reject',
      types: ['sleep_record'],
      subject: 'third_party',
      temporalKinds: ['specific_night'],
      emotions: [[]],
      intensities: [undefined],
      approximationMarkers: [[]],
      confidences: [0.99],
      fieldsThatMustRemainAbsent: [['data.durationMinutes', 'data.wakeFeeling']],
      dailySummaryImpact: 'none',
      acceptedCandidateCount: 0,
      rejectionReasons: [
        'subject_not_self',
        'assertion_not_affirmed',
        'reporting_mode_not_direct_self_report'
      ]
    }
  },
  {
    message: 'Queria conseguir dormir oito horas.',
    candidates: [
      candidate({
        kind: 'sleep_record',
        evidenceQuote: 'Queria conseguir dormir oito horas',
        assertion: 'desired',
        confidence: 0.99,
        data: { durationMinutes: { value: 480, precision: 'exact' } },
        temporalReference: { kind: 'unknown', timezone: TIMEZONE }
      })
    ],
    expected: {
      shouldCreateObservation: false,
      disposition: 'reject',
      types: ['sleep_record'],
      subject: 'self',
      temporalKinds: ['unknown'],
      emotions: [[]],
      intensities: [undefined],
      approximationMarkers: [[]],
      confidences: [0.99],
      fieldsThatMustRemainAbsent: [['data.quality', 'data.bedtime', 'data.wakeTime']],
      dailySummaryImpact: 'none',
      acceptedCandidateCount: 0,
      rejectionReasons: ['assertion_not_affirmed']
    }
  },
  {
    message: 'Se eu dormir mal amanhã, vou ficar cansado.',
    candidates: [
      candidate({
        kind: 'sleep_record',
        evidenceQuote: 'Se eu dormir mal amanhã',
        assertion: 'hypothetical',
        confidence: 0.99,
        data: { quality: { value: 'mal', precision: 'exact' } },
        temporalReference: {
          kind: 'specific_night',
          localDate: '2026-07-21',
          timezone: TIMEZONE,
          precision: 'exact'
        }
      })
    ],
    expected: {
      shouldCreateObservation: false,
      disposition: 'reject',
      types: ['sleep_record'],
      subject: 'self',
      temporalKinds: ['specific_night'],
      emotions: [[]],
      intensities: [undefined],
      approximationMarkers: [[]],
      confidences: [0.99],
      fieldsThatMustRemainAbsent: [['data.durationMinutes', 'data.wakeFeeling']],
      dailySummaryImpact: 'none',
      acceptedCandidateCount: 0,
      rejectionReasons: ['assertion_not_affirmed']
    }
  },
  {
    message: 'Tô morto hoje.',
    candidates: [
      candidate({
        kind: 'mood_event',
        evidenceQuote: 'Tô morto hoje',
        confidence: 0.45,
        data: { descriptors: ['morto'] },
        temporalReference: {
          kind: 'specific_day',
          localDate: '2026-07-20',
          timezone: TIMEZONE,
          precision: 'exact'
        }
      })
    ],
    expected: {
      shouldCreateObservation: false,
      disposition: 'reject',
      types: ['mood_event'],
      subject: 'self',
      temporalKinds: ['specific_day'],
      emotions: [['morto']],
      intensities: [undefined],
      approximationMarkers: [[]],
      confidences: [0.45],
      fieldsThatMustRemainAbsent: [['data.explicitRating', 'data.intensityDescriptor']],
      dailySummaryImpact: 'none',
      acceptedCandidateCount: 0,
      rejectionReasons: ['confidence_below_threshold']
    }
  },
  {
    message: 'Ultimamente tenho acordado sem energia.',
    candidates: [
      candidate({
        kind: 'sleep_record',
        evidenceQuote: 'tenho acordado sem energia',
        confidence: 0.93,
        data: { wakeFeeling: { value: 'sem energia', precision: 'exact' } },
        temporalReference: {
          kind: 'period',
          descriptor: 'ultimamente',
          timezone: TIMEZONE,
          precision: 'approximate'
        }
      })
    ],
    expected: {
      shouldCreateObservation: true,
      disposition: 'create',
      types: ['sleep_record'],
      subject: 'self',
      temporalKinds: ['period'],
      emotions: [[]],
      intensities: [undefined],
      approximationMarkers: [['temporalReference']],
      confidences: [0.93],
      fieldsThatMustRemainAbsent: [
        [
          'data.durationMinutes',
          'data.quality',
          'data.bedtime',
          'data.wakeTime',
          'data.awakeningCount'
        ]
      ],
      dailySummaryImpact: 'none',
      acceptedCandidateCount: 1
    }
  },
  {
    message: 'Na verdade isso aconteceu anteontem.',
    candidates: [
      candidate({
        kind: 'mood_event',
        evidenceQuote: 'isso aconteceu anteontem',
        correctsObservationId: 'existing-mood-observation',
        confidence: 0.96,
        data: {},
        temporalReference: {
          kind: 'specific_day',
          localDate: '2026-07-18',
          timezone: TIMEZONE,
          precision: 'exact'
        }
      })
    ],
    expected: {
      shouldCreateObservation: false,
      disposition: 'correct',
      types: ['mood_event'],
      subject: 'self',
      temporalKinds: ['specific_day'],
      emotions: [[]],
      intensities: [undefined],
      approximationMarkers: [[]],
      confidences: [0.96],
      fieldsThatMustRemainAbsent: [['data.descriptors', 'data.explicitRating']],
      dailySummaryImpact: 'invalidate_existing_summary',
      acceptedCandidateCount: 1
    }
  },
  {
    message: 'Não era tristeza, era mais frustração.',
    candidates: [
      candidate({
        kind: 'mood_event',
        evidenceQuote: 'era mais frustração',
        correctsObservationId: 'existing-mood-observation',
        confidence: 0.96,
        data: { descriptors: ['frustração'] },
        temporalReference: { kind: 'unknown', timezone: TIMEZONE }
      })
    ],
    expected: {
      shouldCreateObservation: false,
      disposition: 'correct',
      types: ['mood_event'],
      subject: 'self',
      temporalKinds: ['unknown'],
      emotions: [['frustração']],
      intensities: [undefined],
      approximationMarkers: [[]],
      confidences: [0.96],
      fieldsThatMustRemainAbsent: [['data.explicitRating', 'data.intensityDescriptor']],
      dailySummaryImpact: 'invalidate_existing_summary',
      acceptedCandidateCount: 1
    }
  },
  {
    message: 'Estou agitado, mas não diria que estou mal.',
    candidates: [
      candidate({
        kind: 'mood_event',
        evidenceQuote: 'Estou agitado',
        confidence: 0.95,
        data: { descriptors: ['agitado'] },
        temporalReference: {
          kind: 'moment',
          at: new Date('2026-07-20T15:00:00.000Z'),
          timezone: TIMEZONE,
          precision: 'exact'
        }
      })
    ],
    expected: {
      shouldCreateObservation: true,
      disposition: 'create',
      types: ['mood_event'],
      subject: 'self',
      temporalKinds: ['moment'],
      emotions: [['agitado']],
      intensities: [undefined],
      approximationMarkers: [[]],
      confidences: [0.95],
      fieldsThatMustRemainAbsent: [['data.explicitRating', 'data.intensityDescriptor']],
      dailySummaryImpact: 'include_event',
      acceptedCandidateCount: 1
    }
  },
  {
    message: 'A prova foi difícil, mas estou aliviado.',
    candidates: [
      candidate({
        kind: 'mood_event',
        evidenceQuote: 'estou aliviado',
        confidence: 0.97,
        data: { descriptors: ['aliviado'] },
        temporalReference: {
          kind: 'moment',
          at: new Date('2026-07-20T15:00:00.000Z'),
          timezone: TIMEZONE,
          precision: 'exact'
        }
      })
    ],
    expected: {
      shouldCreateObservation: true,
      disposition: 'create',
      types: ['mood_event'],
      subject: 'self',
      temporalKinds: ['moment'],
      emotions: [['aliviado']],
      intensities: [undefined],
      approximationMarkers: [[]],
      confidences: [0.97],
      fieldsThatMustRemainAbsent: [['data.explicitRating', 'data.intensityDescriptor']],
      dailySummaryImpact: 'include_event',
      acceptedCandidateCount: 1
    }
  },
  {
    message: 'Minha psicóloga disse que eu parecia mais tranquilo.',
    candidates: [
      candidate({
        kind: 'mood_event',
        evidenceQuote: 'eu parecia mais tranquilo',
        reportingMode: 'third_party_report',
        confidence: 0.92,
        data: { descriptors: ['tranquilo'] },
        temporalReference: { kind: 'unknown', timezone: TIMEZONE }
      })
    ],
    expected: {
      shouldCreateObservation: false,
      disposition: 'reject',
      types: ['mood_event'],
      subject: 'self',
      temporalKinds: ['unknown'],
      emotions: [['tranquilo']],
      intensities: [undefined],
      approximationMarkers: [[]],
      confidences: [0.92],
      fieldsThatMustRemainAbsent: [['data.explicitRating', 'data.intensityDescriptor']],
      dailySummaryImpact: 'none',
      acceptedCandidateCount: 0,
      rejectionReasons: ['reporting_mode_not_direct_self_report']
    }
  },
  {
    message: 'Hoje foi um dia misto.',
    candidates: [
      candidate({
        kind: 'mood_daily_summary',
        evidenceQuote: 'Hoje foi um dia misto',
        confidence: 0.98,
        data: {
          isMixed: true,
          sourceObservationIds: [],
          coverage: 'unknown',
          status: 'current',
          summarySource: 'user_explicit'
        },
        temporalReference: {
          kind: 'specific_day',
          localDate: '2026-07-20',
          timezone: TIMEZONE,
          precision: 'exact'
        }
      })
    ],
    expected: {
      shouldCreateObservation: true,
      disposition: 'create',
      types: ['mood_daily_summary'],
      subject: 'self',
      temporalKinds: ['specific_day'],
      emotions: [[]],
      intensities: [undefined],
      approximationMarkers: [[]],
      confidences: [0.98],
      fieldsThatMustRemainAbsent: [
        ['data.descriptors', 'data.explicitRating', 'data.intensityDescriptor']
      ],
      dailySummaryImpact: 'replace_with_user_explicit',
      acceptedCandidateCount: 1
    }
  },
  {
    message: 'Hoje estou em 7 de 10.',
    candidates: [
      candidate({
        kind: 'mood_event',
        evidenceQuote: '7 de 10',
        confidence: 0.99,
        data: { explicitRating: { value: 7, scaleMax: 10 } },
        temporalReference: {
          kind: 'moment',
          at: new Date('2026-07-20T15:00:00.000Z'),
          timezone: TIMEZONE,
          precision: 'exact'
        }
      })
    ],
    expected: {
      shouldCreateObservation: true,
      disposition: 'create',
      types: ['mood_event'],
      subject: 'self',
      temporalKinds: ['moment'],
      emotions: [[]],
      intensities: [undefined],
      approximationMarkers: [[]],
      confidences: [0.99],
      fieldsThatMustRemainAbsent: [['data.descriptors', 'data.intensityDescriptor']],
      dailySummaryImpact: 'include_event',
      acceptedCandidateCount: 1
    }
  },
  {
    message: 'De manhã fiquei ansioso, mas agora estou bem.',
    candidates: [
      candidate({
        kind: 'mood_event',
        evidenceQuote: 'De manhã fiquei ansioso',
        confidence: 0.97,
        data: { descriptors: ['ansioso'] },
        temporalReference: {
          kind: 'interval',
          startsAt: new Date('2026-07-20T09:00:00.000Z'),
          endsAt: new Date('2026-07-20T14:59:59.000Z'),
          timezone: TIMEZONE,
          precision: 'approximate'
        }
      }),
      candidate({
        kind: 'mood_event',
        evidenceQuote: 'agora estou bem',
        confidence: 0.99,
        data: { descriptors: ['bem'] },
        temporalReference: {
          kind: 'moment',
          at: new Date('2026-07-20T15:00:00.000Z'),
          timezone: TIMEZONE,
          precision: 'exact'
        }
      })
    ],
    expected: {
      shouldCreateObservation: true,
      disposition: 'create',
      types: ['mood_event', 'mood_event'],
      subject: 'self',
      temporalKinds: ['interval', 'moment'],
      emotions: [['ansioso'], ['bem']],
      intensities: [undefined, undefined],
      approximationMarkers: [['temporalReference'], []],
      confidences: [0.97, 0.99],
      fieldsThatMustRemainAbsent: [
        ['data.explicitRating', 'data.intensityDescriptor'],
        ['data.explicitRating', 'data.intensityDescriptor']
      ],
      dailySummaryImpact: 'include_event',
      acceptedCandidateCount: 2
    }
  }
] as const satisfies readonly PtBrObservationExtractionCase[];
