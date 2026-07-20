import {
  buildObservationExtractionPrompt,
  OBSERVATION_EXTRACTION_PROMPT_VERSION
} from '../../../infrastructure/wellbeing-history/prompts/observation-extraction.prompt';
import {
  OBSERVATION_EXTRACTION_SCHEMA_VERSION,
  ObservationExtractionRequest
} from '../../../use-cases/wellbeing-history/ports/observation-extractor.port';

const request: ObservationExtractionRequest = {
  currentUserMessage: 'Na verdade, dormi umas cinco horas anteontem.',
  referenceAt: '2026-07-20T15:00:00.000-03:00',
  timezone: 'America/Sao_Paulo',
  sourceMessageId: 'message-current',
  conversationId: 'conversation-1',
  recentStructuredObservations: [
    {
      observationId: 'sleep-previous',
      sourceMessageId: 'message-previous',
      kind: 'sleep_record',
      temporal: {
        scope: 'night',
        precision: 'relative',
        startAt: '2026-07-18T00:00:00.000-03:00',
        endAt: '2026-07-18T23:59:59.999-03:00',
        originalExpression: 'ontem'
      },
      sleep: {
        durationMinutes: 420,
        durationIsApproximate: false
      }
    }
  ]
};

describe('observation extraction prompt', () => {
  it('is independently versioned and encodes conservative extraction rules', () => {
    const prompt = buildObservationExtractionPrompt(request);

    expect(prompt.instructions).toContain(
      `PROMPT_VERSION=${OBSERVATION_EXTRACTION_PROMPT_VERSION}`
    );
    expect(prompt.instructions).toContain(
      `SCHEMA_VERSION=${OBSERVATION_EXTRACTION_SCHEMA_VERSION}`
    );
    expect(prompt.instructions).toContain('Only currentUserMessage may provide new evidence');
    expect(prompt.instructions).toContain('Precision is more important than coverage.');
    expect(prompt.instructions).toContain('A report about another person does not create');
    expect(prompt.instructions).toContain('Do not convert an emotion into a numeric score');
    expect(prompt.instructions).toContain('one ongoing-period candidate, not many nights');
    expect(prompt.instructions).not.toContain(request.currentUserMessage);
  });

  it('serializes only the current message, temporal reference, source ids and structured observations', () => {
    const prompt = buildObservationExtractionPrompt(request);
    const input = JSON.parse(prompt.input) as Record<string, unknown>;

    expect(Object.keys(input).sort()).toEqual(
      [
        'conversationId',
        'currentUserMessage',
        'recentStructuredObservations',
        'referenceAt',
        'sourceMessageId',
        'timezone'
      ].sort()
    );
    expect(input.currentUserMessage).toBe(request.currentUserMessage);
    expect(input.recentStructuredObservations).toEqual(request.recentStructuredObservations);
    expect(input).not.toHaveProperty('userId');
    expect(input).not.toHaveProperty('profile');
    expect(input).not.toHaveProperty('assistantMessage');
    expect(input).not.toHaveProperty('conversationHistory');
  });
});
