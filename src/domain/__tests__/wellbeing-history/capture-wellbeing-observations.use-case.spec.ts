import { WellbeingCandidateValidationPolicy } from '../../wellbeing-history/services/wellbeing-candidate-validation.policy';
import { DailyMoodSummaryProjectorService } from '../../../use-cases/wellbeing-history/daily-mood-summary-projector.service';
import { CaptureWellbeingObservationsUseCase } from '../../../use-cases/wellbeing-history/capture-wellbeing-observations.use-case';
import {
  OBSERVATION_EXTRACTION_SCHEMA_VERSION,
  ObservationCandidate,
  ObservationExtractionResponse
} from '../../../use-cases/wellbeing-history/ports/observation-extractor.port';
import { InMemoryWellbeingObservationRepository } from './support/in-memory-wellbeing-observation.repository';

function response(
  sourceMessageId: string,
  candidates: ObservationCandidate[],
  conversationId = 'conversation-id'
): ObservationExtractionResponse {
  return {
    trust: 'untrusted_model_output',
    schemaVersion: OBSERVATION_EXTRACTION_SCHEMA_VERSION,
    source: { sourceMessageId, conversationId },
    candidates,
    metadata: {
      provider: 'openai',
      model: 'evaluated-model',
      promptVersion: 'prompt-v1',
      schemaVersion: OBSERVATION_EXTRACTION_SCHEMA_VERSION
    },
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 }
  };
}

function setup(persistEnabled = true) {
  const repository = new InMemoryWellbeingObservationRepository();
  const extract = jest.fn();
  const usageService = {
    registerAuxiliaryLlmUsage: jest.fn().mockResolvedValue(undefined)
  };
  const userRepository = {
    findById: jest.fn().mockResolvedValue({
      hasScheduledDeletion: () => false,
      profile: {
        privacySettings: { allowMoodInsights: true, allowSensitiveDataStorage: true }
      }
    })
  };
  const eventDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
  const projector = new DailyMoodSummaryProjectorService(repository, eventDispatcher);
  const useCase = new CaptureWellbeingObservationsUseCase(
    { extract },
    new WellbeingCandidateValidationPolicy(0.85),
    repository,
    userRepository as never,
    usageService as never,
    eventDispatcher,
    projector,
    { fingerprint: jest.fn().mockReturnValue('f'.repeat(64)) },
    persistEnabled
  );

  return { useCase, repository, extract, usageService, userRepository };
}

const baseInput = {
  userId: 'user-id',
  conversationId: 'conversation-id',
  currentUserMessage: 'Hoje estou em 7 de 10.',
  timezone: 'America/Sao_Paulo',
  allowAutomaticCapture: true,
  referenceAt: new Date('2026-07-20T15:00:00.000Z')
};

describe('CaptureWellbeingObservationsUseCase', () => {
  it('does not call a model or persist when privacy policy denies automatic capture', async () => {
    const { useCase, repository, extract } = setup();

    const result = await useCase.execute({
      ...baseInput,
      sourceMessageId: 'message-1',
      allowAutomaticCapture: false
    });

    expect(result.status).toBe('skipped_by_policy');
    expect(extract).not.toHaveBeenCalled();
    expect(repository.observations.size).toBe(0);
  });

  it('does not call a model for an account scheduled for deletion', async () => {
    const { useCase, repository, extract, userRepository } = setup();
    userRepository.findById.mockResolvedValue({
      hasScheduledDeletion: () => true,
      profile: {
        privacySettings: { allowMoodInsights: true, allowSensitiveDataStorage: true }
      }
    });

    const result = await useCase.execute({ ...baseInput, sourceMessageId: 'message-1' });

    expect(result.status).toBe('skipped_user_unavailable');
    expect(extract).not.toHaveBeenCalled();
    expect(repository.observations.size).toBe(0);
  });

  it('rechecks sensitive-data consent at the write boundary', async () => {
    const { useCase, repository, extract, userRepository } = setup();
    extract.mockResolvedValue(response('message-1', []));
    userRepository.findById
      .mockResolvedValueOnce({
        hasScheduledDeletion: () => false,
        profile: {
          privacySettings: { allowMoodInsights: true, allowSensitiveDataStorage: true }
        }
      })
      .mockResolvedValueOnce({
        hasScheduledDeletion: () => false,
        profile: {
          privacySettings: { allowMoodInsights: false, allowSensitiveDataStorage: true }
        }
      });

    const result = await useCase.execute({ ...baseInput, sourceMessageId: 'message-1' });

    expect(result.status).toBe('skipped_user_unavailable');
    expect(repository.observations.size).toBe(0);
  });

  it('evaluates accepted candidates in shadow mode without writing observations', async () => {
    const { useCase, repository, extract, usageService } = setup(false);
    extract.mockResolvedValue(
      response('message-shadow', [
        {
          kind: 'mood_event',
          subject: 'user',
          assertion: 'affirmed',
          reportingMode: 'specific_occurrence',
          sourceQuote: '7 de 10',
          temporal: {
            scope: 'moment',
            precision: 'exact',
            startAt: '2026-07-20T15:00:00.000Z'
          },
          confidence: 0.99,
          mood: { score: 7, scoreScaleMax: 10 }
        }
      ])
    );

    const result = await useCase.execute({ ...baseInput, sourceMessageId: 'message-shadow' });

    expect(result).toMatchObject({
      status: 'shadow_evaluated',
      accepted: 1,
      created: 0,
      corrected: 0,
      wouldCreate: 1,
      wouldCorrect: 0
    });
    expect(repository.observations.size).toBe(0);
    expect(usageService.registerAuxiliaryLlmUsage).toHaveBeenCalled();
  });

  it('persists only validated self-reports and preserves a rating without inventing scaleMin', async () => {
    const { useCase, repository, extract, usageService } = setup();
    extract.mockResolvedValue(
      response('message-1', [
        {
          kind: 'mood_event',
          subject: 'user',
          assertion: 'affirmed',
          reportingMode: 'specific_occurrence',
          sourceQuote: '7 de 10',
          temporal: {
            scope: 'moment',
            precision: 'exact',
            startAt: '2026-07-20T15:00:00.000Z'
          },
          confidence: 0.99,
          mood: { score: 7, scoreScaleMax: 10 }
        },
        {
          kind: 'sleep_record',
          subject: 'third_party',
          assertion: 'affirmed',
          reportingMode: 'specific_occurrence',
          sourceQuote: 'Hoje',
          temporal: { scope: 'night', precision: 'unknown' },
          confidence: 0.99,
          sleep: { quality: 'poor' }
        }
      ])
    );

    const result = await useCase.execute({ ...baseInput, sourceMessageId: 'message-1' });
    const observations = await repository.list('user-id');

    expect(result).toMatchObject({ extracted: 2, accepted: 1, created: 1, rejected: 1 });
    expect(observations).toHaveLength(1);
    expect(observations[0].data).toEqual({ explicitRating: { value: 7, scaleMax: 10 } });
    expect(observations[0].data).not.toHaveProperty('explicitRating.scaleMin');
    expect(observations[0].currentProvenance).toMatchObject({
      source: 'conversation_extraction',
      sourceMessageId: 'message-1',
      evidenceFingerprint: 'f'.repeat(64),
      modelRef: 'openai:evaluated-model'
    });
    expect(usageService.registerAuxiliaryLlmUsage).toHaveBeenCalledWith('user-id', {
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15
    });
  });

  it('keeps an explicit emotion intensity separate from an overall mood rating', async () => {
    const { useCase, repository, extract } = setup();
    extract.mockResolvedValue(
      response('message-1', [
        {
          kind: 'mood_event',
          subject: 'user',
          assertion: 'affirmed',
          reportingMode: 'specific_occurrence',
          sourceQuote: 'ansiedade está 9 de 10',
          temporal: {
            scope: 'moment',
            precision: 'exact',
            startAt: '2026-07-20T15:00:00.000Z'
          },
          confidence: 0.99,
          mood: { emotions: ['ansiedade'], intensity: 9, intensityScaleMax: 10 }
        }
      ])
    );

    await useCase.execute({
      ...baseInput,
      currentUserMessage: 'Minha ansiedade está 9 de 10.',
      sourceMessageId: 'message-1'
    });

    const observation = (await repository.list('user-id'))[0];
    expect(observation.data).toEqual({
      descriptors: ['ansiedade'],
      explicitIntensity: { value: 9, scaleMax: 10 }
    });
    expect(observation.data).not.toHaveProperty('explicitRating');
  });

  it('preserves mixed mood as a locale-neutral canonical signal', async () => {
    const { useCase, repository, extract } = setup();
    extract.mockResolvedValue(
      response('message-1', [
        {
          kind: 'mood_daily_summary',
          subject: 'user',
          assertion: 'affirmed',
          reportingMode: 'daily_summary',
          sourceQuote: 'mixed day',
          temporal: { scope: 'unknown', precision: 'unknown' },
          confidence: 0.98,
          mood: { isMixed: true, coverage: 'full_day' }
        }
      ])
    );

    await useCase.execute({
      ...baseInput,
      currentUserMessage: 'Today was a mixed day.',
      sourceMessageId: 'message-1'
    });

    expect((await repository.list('user-id'))[0].data).toMatchObject({
      isMixed: true,
      summarySource: 'user_explicit'
    });
    expect((await repository.list('user-id'))[0].data).not.toHaveProperty('descriptors');
  });

  it('deduplicates an identical extraction retry by source message and semantic fingerprint', async () => {
    const { useCase, repository, extract } = setup();
    const extraction = response('message-1', [
      {
        kind: 'sleep_record',
        subject: 'user',
        assertion: 'affirmed',
        reportingMode: 'specific_occurrence',
        sourceQuote: 'umas cinco horas',
        temporal: {
          scope: 'night',
          precision: 'relative',
          startAt: '2026-07-19'
        },
        confidence: 0.97,
        sleep: { durationMinutes: 300, durationIsApproximate: true }
      }
    ]);
    extract.mockResolvedValue(extraction);
    const input = {
      ...baseInput,
      currentUserMessage: 'Dormi umas cinco horas.',
      sourceMessageId: 'message-1'
    };

    const first = await useCase.execute(input);
    const retry = await useCase.execute(input);

    expect(first.created).toBe(1);
    expect(retry.created).toBe(0);
    expect(repository.observations.size).toBe(1);
    expect((await repository.list('user-id'))[0].data).toEqual({
      durationMinutes: { value: 300, precision: 'approximate' }
    });
  });

  it('does not duplicate an evidence slot when a retry varies normalized data', async () => {
    const { useCase, repository, extract } = setup();
    extract
      .mockResolvedValueOnce(
        response('message-1', [
          {
            kind: 'mood_event',
            subject: 'user',
            assertion: 'affirmed',
            reportingMode: 'specific_occurrence',
            sourceQuote: 'fiquei ansioso',
            temporal: { scope: 'day', precision: 'relative', startAt: '2026-07-20' },
            confidence: 0.97,
            mood: { emotions: ['ansiedade'] }
          }
        ])
      )
      .mockResolvedValueOnce(
        response('message-1', [
          {
            kind: 'mood_event',
            subject: 'user',
            assertion: 'affirmed',
            reportingMode: 'specific_occurrence',
            sourceQuote: 'fiquei ansioso',
            temporal: { scope: 'unknown', precision: 'unknown' },
            confidence: 0.96,
            mood: { emotions: ['ansioso'] }
          }
        ])
      );
    const input = {
      ...baseInput,
      currentUserMessage: 'Hoje fiquei ansioso.',
      sourceMessageId: 'message-1'
    };

    await useCase.execute(input);
    const retry = await useCase.execute(input);

    expect(retry).toMatchObject({ created: 0, deduplicated: 1 });
    expect(repository.observations.size).toBe(1);
  });

  it('does not collide when two conversations reuse the same client message id', async () => {
    const { useCase, repository, extract } = setup();
    const candidate: ObservationCandidate = {
      kind: 'mood_event',
      subject: 'user',
      assertion: 'affirmed',
      reportingMode: 'specific_occurrence',
      sourceQuote: 'fiquei ansioso',
      temporal: { scope: 'unknown', precision: 'unknown' },
      confidence: 0.97,
      mood: { emotions: ['ansioso'] }
    };
    extract
      .mockResolvedValueOnce(response('shared-message-id', [candidate], 'conversation-id'))
      .mockResolvedValueOnce(response('shared-message-id', [candidate], 'conversation-2'));

    await useCase.execute({
      ...baseInput,
      currentUserMessage: 'Eu fiquei ansioso.',
      sourceMessageId: 'shared-message-id'
    });
    await useCase.execute({
      ...baseInput,
      conversationId: 'conversation-2',
      currentUserMessage: 'Eu fiquei ansioso.',
      sourceMessageId: 'shared-message-id'
    });

    expect(repository.observations.size).toBe(2);
  });

  it('deduplicates repeated candidates before they can satisfy the daily-summary threshold', async () => {
    const { useCase, repository, extract } = setup();
    const duplicateCandidate: ObservationCandidate = {
      kind: 'mood_event',
      subject: 'user',
      assertion: 'affirmed',
      reportingMode: 'specific_occurrence',
      sourceQuote: 'fiquei ansioso',
      temporal: { scope: 'day', precision: 'relative', startAt: '2026-07-20' },
      confidence: 0.97,
      mood: { emotions: ['ansiedade'] }
    };
    extract.mockResolvedValue(response('message-1', [duplicateCandidate, duplicateCandidate]));

    const result = await useCase.execute({
      ...baseInput,
      currentUserMessage: 'Hoje fiquei ansioso.',
      sourceMessageId: 'message-1'
    });

    expect(result).toMatchObject({ created: 1, deduplicated: 1, accepted: 1 });
    expect((await repository.list('user-id')).map((item) => item.kind)).toEqual(['mood_event']);
  });

  it('updates the referenced automatic event for an explicit later correction', async () => {
    const { useCase, repository, extract } = setup();
    extract.mockResolvedValueOnce(
      response('message-1', [
        {
          kind: 'mood_event',
          subject: 'user',
          assertion: 'affirmed',
          reportingMode: 'specific_occurrence',
          sourceQuote: 'triste',
          temporal: { scope: 'day', precision: 'relative', startAt: '2026-07-20' },
          confidence: 0.96,
          mood: { emotions: ['tristeza'] }
        }
      ])
    );
    await useCase.execute({
      ...baseInput,
      currentUserMessage: 'Hoje fiquei triste.',
      sourceMessageId: 'message-1'
    });
    const original = (await repository.list('user-id'))[0];

    extract.mockResolvedValueOnce(
      response('message-2', [
        {
          kind: 'mood_event',
          subject: 'user',
          assertion: 'affirmed',
          reportingMode: 'correction',
          sourceQuote: 'Não era tristeza, era mais frustração.',
          correctsObservationId: original.id.value,
          temporal: { scope: 'day', precision: 'relative', startAt: '2026-07-20' },
          confidence: 0.98,
          mood: { emotions: ['frustração'] }
        }
      ])
    );
    const corrected = await useCase.execute({
      ...baseInput,
      currentUserMessage: 'Não era tristeza, era mais frustração.',
      sourceMessageId: 'message-2',
      referenceAt: new Date('2026-07-20T16:00:00.000Z')
    });
    const observations = await repository.list('user-id');

    expect(corrected.corrected).toBe(1);
    expect(observations).toHaveLength(1);
    expect(observations[0].data).toEqual({ descriptors: ['frustração'] });
    expect(observations[0].revision).toBe(2);
    expect(observations[0].currentProvenance).toMatchObject({
      sourceMessageId: 'message-2',
      correctsObservationId: original.id.value
    });
  });

  it('preserves the known date when a correction does not restate time', async () => {
    const { useCase, repository, extract } = setup();
    extract.mockResolvedValueOnce(
      response('message-1', [
        {
          kind: 'mood_event',
          subject: 'user',
          assertion: 'affirmed',
          reportingMode: 'specific_occurrence',
          sourceQuote: 'Hoje fiquei triste',
          temporal: { scope: 'day', precision: 'relative', startAt: '2026-07-20' },
          confidence: 0.96,
          mood: { emotions: ['tristeza'] }
        }
      ])
    );
    await useCase.execute({
      ...baseInput,
      currentUserMessage: 'Hoje fiquei triste.',
      sourceMessageId: 'message-1'
    });
    const original = (await repository.list('user-id'))[0];

    extract.mockResolvedValueOnce(
      response('message-2', [
        {
          kind: 'mood_event',
          subject: 'user',
          assertion: 'affirmed',
          reportingMode: 'correction',
          sourceQuote: 'Não era tristeza, era frustração',
          correctsObservationId: original.id.value,
          temporal: { scope: 'unknown', precision: 'unknown' },
          confidence: 0.98,
          mood: { emotions: ['frustração'] }
        }
      ])
    );
    await useCase.execute({
      ...baseInput,
      currentUserMessage: 'Não era tristeza, era frustração.',
      sourceMessageId: 'message-2',
      referenceAt: new Date('2026-07-20T16:00:00.000Z')
    });

    expect((await repository.list('user-id'))[0].temporalReference).toMatchObject({
      kind: 'specific_day',
      localDate: '2026-07-20'
    });
  });

  it('applies a temporal-only conversation correction without erasing mood data', async () => {
    const { useCase, repository, extract } = setup();
    extract.mockResolvedValueOnce(
      response('message-1', [
        {
          kind: 'mood_event',
          subject: 'user',
          assertion: 'affirmed',
          reportingMode: 'specific_occurrence',
          sourceQuote: 'fiquei frustrado',
          temporal: { scope: 'day', precision: 'relative', startAt: '2026-07-20' },
          confidence: 0.96,
          mood: { emotions: ['frustração'] }
        }
      ])
    );
    await useCase.execute({
      ...baseInput,
      currentUserMessage: 'Hoje fiquei frustrado.',
      sourceMessageId: 'message-1'
    });
    const original = (await repository.list('user-id'))[0];

    extract.mockResolvedValueOnce(
      response('message-2', [
        {
          kind: 'mood_event',
          subject: 'user',
          assertion: 'affirmed',
          reportingMode: 'correction',
          sourceQuote: 'isso aconteceu anteontem',
          correctsObservationId: original.id.value,
          temporal: { scope: 'day', precision: 'relative', startAt: '2026-07-18' },
          confidence: 0.98,
          mood: {}
        }
      ])
    );
    const result = await useCase.execute({
      ...baseInput,
      currentUserMessage: 'Na verdade isso aconteceu anteontem.',
      sourceMessageId: 'message-2'
    });

    const corrected = (await repository.list('user-id'))[0];
    expect(result.corrected).toBe(1);
    expect(corrected.data).toEqual({ descriptors: ['frustração'] });
    expect(corrected.temporalReference).toMatchObject({
      kind: 'specific_day',
      localDate: '2026-07-18'
    });
  });

  it('offers recent structured observations for an explicit correction in a later conversation', async () => {
    const { useCase, repository, extract } = setup();
    extract.mockResolvedValueOnce(
      response('message-1', [
        {
          kind: 'mood_event',
          subject: 'user',
          assertion: 'affirmed',
          reportingMode: 'specific_occurrence',
          sourceQuote: 'Foi misto e fiquei triste',
          temporal: { scope: 'unknown', precision: 'unknown' },
          confidence: 0.96,
          mood: { emotions: ['tristeza'], isMixed: true }
        }
      ])
    );
    await useCase.execute({
      ...baseInput,
      currentUserMessage: 'Foi misto e fiquei triste.',
      sourceMessageId: 'message-1'
    });
    const original = (await repository.list('user-id'))[0];

    extract.mockImplementationOnce((request) => {
      expect(request.recentStructuredObservations).toEqual([
        expect.objectContaining({
          observationId: original.id.value,
          kind: 'mood_event',
          mood: expect.objectContaining({ isMixed: true })
        })
      ]);
      return Promise.resolve(
        response(
          'message-2',
          [
            {
              kind: 'mood_event',
              subject: 'user',
              assertion: 'affirmed',
              reportingMode: 'correction',
              sourceQuote: 'não era tristeza, era frustração',
              correctsObservationId: original.id.value,
              removeFields: ['isMixed'],
              temporal: { scope: 'unknown', precision: 'unknown' },
              confidence: 0.98,
              mood: { emotions: ['frustração'] }
            }
          ],
          'conversation-2'
        )
      );
    });

    await useCase.execute({
      ...baseInput,
      conversationId: 'conversation-2',
      currentUserMessage: 'Na verdade não foi misto; não era tristeza, era frustração.',
      sourceMessageId: 'message-2'
    });

    expect((await repository.list('user-id'))[0].data).toEqual({
      descriptors: ['frustração']
    });
  });

  it('removes only an explicitly retracted sleep field during a conversation correction', async () => {
    const { useCase, repository, extract } = setup();
    extract.mockResolvedValueOnce(
      response('message-1', [
        {
          kind: 'sleep_record',
          subject: 'user',
          assertion: 'affirmed',
          reportingMode: 'specific_occurrence',
          sourceQuote: 'Dormi seis horas e acordei três vezes',
          temporal: { scope: 'night', precision: 'relative', startAt: '2026-07-19' },
          confidence: 0.97,
          sleep: {
            durationMinutes: 360,
            durationIsApproximate: false,
            awakenings: 3,
            awakeningsIsApproximate: false
          }
        }
      ])
    );
    await useCase.execute({
      ...baseInput,
      currentUserMessage: 'Dormi seis horas e acordei três vezes.',
      sourceMessageId: 'message-1'
    });
    const original = (await repository.list('user-id'))[0];

    extract.mockResolvedValueOnce(
      response('message-2', [
        {
          kind: 'sleep_record',
          subject: 'user',
          assertion: 'affirmed',
          reportingMode: 'correction',
          sourceQuote: 'não acordei três vezes',
          correctsObservationId: original.id.value,
          removeFields: ['awakenings'],
          temporal: { scope: 'unknown', precision: 'unknown' },
          confidence: 0.98,
          sleep: {}
        }
      ])
    );
    const result = await useCase.execute({
      ...baseInput,
      currentUserMessage: 'Na verdade, não acordei três vezes.',
      sourceMessageId: 'message-2'
    });

    expect(result.corrected).toBe(1);
    expect((await repository.list('user-id'))[0].data).toEqual({
      durationMinutes: { value: 360, precision: 'exact' }
    });
  });

  it('rejects a third-party report about the user at the domain validation boundary', async () => {
    const { useCase, repository, extract } = setup();
    extract.mockResolvedValue(
      response('message-1', [
        {
          kind: 'mood_event',
          subject: 'user',
          assertion: 'affirmed',
          reportingMode: 'specific_occurrence',
          evidenceMode: 'third_party_report',
          sourceQuote: 'Minha psicóloga disse que eu parecia mais tranquilo',
          temporal: { scope: 'unknown', precision: 'unknown' },
          confidence: 0.96,
          mood: { emotions: ['tranquilo'] }
        }
      ])
    );

    const result = await useCase.execute({
      ...baseInput,
      currentUserMessage: 'Minha psicóloga disse que eu parecia mais tranquilo.',
      sourceMessageId: 'message-1'
    });

    expect(result).toMatchObject({ accepted: 0, rejected: 1, created: 0 });
    expect(repository.observations.size).toBe(0);
  });
});
