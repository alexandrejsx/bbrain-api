import { Injectable } from '@nestjs/common';
import {
  OBSERVATION_EXTRACTION_SCHEMA_VERSION,
  ObservationExtractionRequest,
  ObservationExtractionResponse,
  ObservationExtractor
} from '../../use-cases/wellbeing-history/ports/observation-extractor.port';
import { OBSERVATION_EXTRACTION_PROMPT_VERSION } from '../wellbeing-history/prompts/observation-extraction.prompt';

@Injectable()
export class NoopObservationExtractor implements ObservationExtractor {
  extract(request: ObservationExtractionRequest): Promise<ObservationExtractionResponse> {
    return Promise.resolve({
      trust: 'untrusted_model_output',
      schemaVersion: OBSERVATION_EXTRACTION_SCHEMA_VERSION,
      source: {
        sourceMessageId: request.sourceMessageId,
        conversationId: request.conversationId
      },
      candidates: [],
      metadata: {
        provider: 'noop',
        model: null,
        promptVersion: OBSERVATION_EXTRACTION_PROMPT_VERSION,
        schemaVersion: OBSERVATION_EXTRACTION_SCHEMA_VERSION
      },
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
      }
    });
  }
}
