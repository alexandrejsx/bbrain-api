import { WellbeingCandidateValidationPolicy } from '../../wellbeing-history/services/wellbeing-candidate-validation.policy';
import { PT_BR_OBSERVATION_EXTRACTION_CASES } from './fixtures/pt-br-observation-extraction.cases';

function readPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (typeof current !== 'object' || current === null) return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function candidateEmotions(candidate: Record<string, unknown>): readonly string[] {
  const descriptors = readPath(candidate, 'data.descriptors');
  return Array.isArray(descriptors) ? (descriptors as string[]) : [];
}

function approximationMarkers(candidate: Record<string, unknown>): readonly string[] {
  const markers: string[] = [];

  if (readPath(candidate, 'temporalReference.precision') === 'approximate') {
    markers.push('temporalReference');
  }

  for (const field of [
    'durationMinutes',
    'quality',
    'bedtime',
    'wakeTime',
    'awakeningCount',
    'wakeFeeling'
  ]) {
    if (readPath(candidate, `data.${field}.precision`) === 'approximate') {
      markers.push(`data.${field}`);
    }
  }

  return markers;
}

describe('pt-BR wellbeing extraction precision cases', () => {
  const policy = new WellbeingCandidateValidationPolicy(0.8);

  it('contains exactly the 17 required Portuguese cases', () => {
    expect(PT_BR_OBSERVATION_EXTRACTION_CASES.map(({ message }) => message)).toEqual([
      'Dormi umas cinco horas.',
      'Acho que dormi mal.',
      'Não estou mais ansioso.',
      'Hoje estou melhor do que ontem.',
      'Minha mãe não dormiu nada.',
      'Queria conseguir dormir oito horas.',
      'Se eu dormir mal amanhã, vou ficar cansado.',
      'Tô morto hoje.',
      'Ultimamente tenho acordado sem energia.',
      'Na verdade isso aconteceu anteontem.',
      'Não era tristeza, era mais frustração.',
      'Estou agitado, mas não diria que estou mal.',
      'A prova foi difícil, mas estou aliviado.',
      'Minha psicóloga disse que eu parecia mais tranquilo.',
      'Hoje foi um dia misto.',
      'Hoje estou em 7 de 10.',
      'De manhã fiquei ansioso, mas agora estou bem.'
    ]);
  });

  it.each(PT_BR_OBSERVATION_EXTRACTION_CASES)(
    'validates "$message" without trading precision for coverage',
    ({ message, candidates, expected }) => {
      const results = candidates.map((candidate, index) =>
        policy.validate(candidate, {
          sourceMessage: message,
          sourceMessageId: `message-${index + 1}`,
          conversationId: 'conversation-pt-br-cases',
          modelRef: 'model:eval-fixture',
          promptRef: 'prompt:eval-fixture',
          schemaRef: 'schema:eval-fixture'
        })
      );
      const accepted = results.filter((result) => result.accepted);
      const rejectedReasons = results.flatMap((result) => (result.accepted ? [] : result.reasons));

      expect(accepted).toHaveLength(expected.acceptedCandidateCount);
      expect(candidates.map((candidate) => candidate.kind)).toEqual(expected.types);
      expect(candidates.map((candidate) => readPath(candidate, 'temporalReference.kind'))).toEqual(
        expected.temporalKinds.length === candidates.length ? expected.temporalKinds : []
      );
      expect(candidates.map(candidateEmotions)).toEqual(expected.emotions);
      expect(
        candidates.map((candidate) => readPath(candidate, 'data.intensityDescriptor'))
      ).toEqual(expected.intensities);
      expect(candidates.map(approximationMarkers)).toEqual(expected.approximationMarkers);
      expect(candidates.map((candidate) => candidate.confidence)).toEqual(expected.confidences);

      expected.fieldsThatMustRemainAbsent.forEach((paths, candidateIndex) => {
        const currentCandidate = candidates[candidateIndex];
        if (!currentCandidate) return;
        paths.forEach((path) => expect(readPath(currentCandidate, path)).toBeUndefined());
      });

      const expectedRejectionReasons =
        'rejectionReasons' in expected ? expected.rejectionReasons : undefined;
      if (expectedRejectionReasons) {
        expect(rejectedReasons).toEqual(expectedRejectionReasons);
      } else {
        expect(rejectedReasons).toEqual([]);
      }

      if (expected.disposition === 'create') {
        expect(expected.shouldCreateObservation).toBe(true);
        expect(accepted.length).toBeGreaterThan(0);
      } else {
        expect(expected.shouldCreateObservation).toBe(false);
      }

      expect(expected.dailySummaryImpact).toMatch(
        /^(none|include_event|invalidate_existing_summary|replace_with_user_explicit)$/
      );
    }
  );

  it('keeps mixed mood distinct from neutral mood', () => {
    const mixed = PT_BR_OBSERVATION_EXTRACTION_CASES.find(
      ({ message }) => message === 'Hoje foi um dia misto.'
    );

    expect(readPath(mixed?.candidates[0], 'data.isMixed')).toBe(true);
    expect(readPath(mixed?.candidates[0], 'data.descriptors')).toBeUndefined();
  });

  it('keeps a period sleep report as one period instead of fabricating nightly records', () => {
    const period = PT_BR_OBSERVATION_EXTRACTION_CASES.find(
      ({ message }) => message === 'Ultimamente tenho acordado sem energia.'
    );

    expect(period?.candidates).toHaveLength(1);
    expect(readPath(period?.candidates[0], 'temporalReference.kind')).toBe('period');
  });

  it('keeps morning anxiety and current wellbeing as two distinct moments', () => {
    const changingMood = PT_BR_OBSERVATION_EXTRACTION_CASES.find(
      ({ message }) => message === 'De manhã fiquei ansioso, mas agora estou bem.'
    );

    expect(changingMood?.candidates).toHaveLength(2);
    expect(changingMood?.expected.emotions).toEqual([['ansioso'], ['bem']]);
  });
});
