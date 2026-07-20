import { ObservationExtractorRouter } from '../../../infrastructure/wellbeing-history/observation-extractor-router';
import {
  OBSERVATION_EXTRACTION_SCHEMA_VERSION,
  ObservationExtractionRequest,
  ObservationExtractionResponse,
  ObservationExtractor
} from '../../../use-cases/wellbeing-history/ports/observation-extractor.port';

const request: ObservationExtractionRequest = {
  currentUserMessage: 'Dormi umas cinco horas.',
  referenceAt: '2026-07-20T12:00:00.000Z',
  timezone: 'America/Sao_Paulo',
  sourceMessageId: 'message-id',
  conversationId: 'conversation-id'
};

const emptyResponse = (provider: 'openai' | 'gemini' | 'noop'): ObservationExtractionResponse => ({
  trust: 'untrusted_model_output',
  schemaVersion: OBSERVATION_EXTRACTION_SCHEMA_VERSION,
  source: {
    sourceMessageId: request.sourceMessageId,
    conversationId: request.conversationId
  },
  candidates: [],
  metadata: {
    provider,
    model: provider === 'noop' ? null : 'model',
    promptVersion: 'prompt-v1',
    schemaVersion: OBSERVATION_EXTRACTION_SCHEMA_VERSION
  },
  usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
});

describe('ObservationExtractorRouter', () => {
  it('returns the primary response without invoking fallback', async () => {
    const primary: ObservationExtractor = {
      extract: jest.fn().mockResolvedValue(emptyResponse('openai'))
    };
    const fallbackExtract = jest.fn().mockResolvedValue(emptyResponse('noop'));
    const fallback: ObservationExtractor = { extract: fallbackExtract };
    const router = new ObservationExtractorRouter(primary, 'openai', fallback, 'noop');

    await expect(router.extract(request)).resolves.toMatchObject({
      metadata: { provider: 'openai' }
    });
    expect(fallbackExtract).not.toHaveBeenCalled();
  });

  it('uses one configured fallback after a primary provider failure', async () => {
    const primary: ObservationExtractor = {
      extract: jest.fn().mockRejectedValue(new Error('provider unavailable'))
    };
    const fallbackExtract = jest.fn().mockResolvedValue(emptyResponse('gemini'));
    const fallback: ObservationExtractor = { extract: fallbackExtract };
    const router = new ObservationExtractorRouter(primary, 'openai', fallback, 'gemini');

    await expect(router.extract(request)).resolves.toMatchObject({
      metadata: { provider: 'gemini' }
    });
    expect(fallbackExtract).toHaveBeenCalledTimes(1);
  });
});
