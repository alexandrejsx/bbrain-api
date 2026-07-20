import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ObservationExtractionRequest,
  ObservationExtractionResponse,
  ObservationExtractor
} from '../../use-cases/wellbeing-history/ports/observation-extractor.port';
import {
  estimateLlmUsageFromText,
  LlmUsage,
  normalizeLlmUsage
} from '../../domain/usage/value-objects/llm-usage';
import {
  buildObservationExtractionPrompt,
  OBSERVATION_EXTRACTION_PROMPT_VERSION
} from '../wellbeing-history/prompts/observation-extraction.prompt';
import { OBSERVATION_EXTRACTION_RESPONSE_SCHEMA } from '../wellbeing-history/provider-schemas/observation-extraction.schema';
import { parseObservationExtractionResponse } from '../wellbeing-history/structured-output/observation-extraction-response.parser';

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_GEMINI_EXTRACTION_TIMEOUT_MS = 60_000;

interface GeminiTextPart {
  text: string;
}

interface GeminiContent {
  role?: 'user' | 'model';
  parts: GeminiTextPart[];
}

interface GeminiObservationExtractionRequest {
  store: false;
  systemInstruction: GeminiContent;
  contents: GeminiContent[];
  generationConfig: {
    maxOutputTokens: number;
    responseFormat: {
      text: {
        mimeType: 'APPLICATION_JSON';
        schema: typeof OBSERVATION_EXTRACTION_RESPONSE_SCHEMA;
      };
    };
  };
}

interface GeminiCandidate {
  content?: GeminiContent;
  finishReason?: string;
}

interface GeminiGenerateContentResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: {
    blockReason?: string;
  };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

const mapGeminiUsage = (body: GeminiGenerateContentResponse): LlmUsage | undefined => {
  if (!body.usageMetadata) {
    return undefined;
  }

  return normalizeLlmUsage({
    inputTokens: body.usageMetadata.promptTokenCount ?? 0,
    outputTokens: body.usageMetadata.candidatesTokenCount ?? 0,
    totalTokens: body.usageMetadata.totalTokenCount ?? 0
  });
};

@Injectable()
export class GeminiObservationExtractor implements ObservationExtractor {
  private readonly logger = new Logger(GeminiObservationExtractor.name);

  constructor(private readonly config: ConfigService) {}

  async extract(request: ObservationExtractionRequest): Promise<ObservationExtractionResponse> {
    const apiKey = this.config.get<string>('gemini.apiKey');
    const model = this.config.get<string>('gemini.observationExtractionModel');
    const timeoutMs =
      this.config.get<number>('gemini.timeoutMs') || DEFAULT_GEMINI_EXTRACTION_TIMEOUT_MS;

    if (!apiKey || !model) {
      this.logger.error(
        `Observation extraction configuration incomplete provider=gemini apiKeyConfigured=${Boolean(apiKey)} modelConfigured=${Boolean(model)}`
      );
      throw new Error('Gemini observation extraction is not configured');
    }

    const startedAt = Date.now();
    const prompt = buildObservationExtractionPrompt(request);
    const payload: GeminiObservationExtractionRequest = {
      store: false,
      systemInstruction: {
        parts: [{ text: prompt.instructions }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt.input }]
        }
      ],
      generationConfig: {
        maxOutputTokens: 2400,
        responseFormat: {
          text: {
            mimeType: 'APPLICATION_JSON',
            schema: OBSERVATION_EXTRACTION_RESPONSE_SCHEMA
          }
        }
      }
    };

    this.logger.debug(
      `Sending observation extraction request provider=gemini model=${model} timeoutMs=${timeoutMs} promptVersion=${OBSERVATION_EXTRACTION_PROMPT_VERSION}`
    );

    try {
      const response = await fetch(
        `${GEMINI_API_BASE_URL}/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs)
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini request failed httpStatus=${response.status}`);
      }

      const body = (await response.json()) as GeminiGenerateContentResponse;
      const candidate = body.candidates?.[0];
      const outputText = candidate?.content?.parts.map((part) => part.text).join('');

      if (!outputText) {
        throw new Error(
          `Gemini returned no observation extraction output finishReason=${candidate?.finishReason ?? 'none'} blockReason=${body.promptFeedback?.blockReason ?? 'none'}`
        );
      }

      const parsed = parseObservationExtractionResponse(outputText, 'Gemini', request);
      const usage =
        mapGeminiUsage(body) ??
        estimateLlmUsageFromText(`${prompt.instructions}\n${prompt.input}`, outputText);

      this.logger.debug(
        `Observation extraction completed provider=gemini model=${model} durationMs=${Date.now() - startedAt} candidateCount=${parsed.candidates.length}`
      );

      return {
        trust: 'untrusted_model_output',
        schemaVersion: parsed.schemaVersion,
        source: {
          sourceMessageId: request.sourceMessageId,
          conversationId: request.conversationId
        },
        candidates: parsed.candidates,
        metadata: {
          provider: 'gemini',
          model,
          promptVersion: OBSERVATION_EXTRACTION_PROMPT_VERSION,
          schemaVersion: parsed.schemaVersion
        },
        usage
      };
    } catch (error) {
      this.logger.error(
        `Observation extraction failed provider=gemini model=${model} durationMs=${Date.now() - startedAt} errorType=${error instanceof Error ? error.name : 'unknown'}`
      );
      throw error;
    }
  }
}
