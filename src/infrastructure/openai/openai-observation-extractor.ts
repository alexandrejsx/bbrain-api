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

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_OPENAI_EXTRACTION_TIMEOUT_MS = 30_000;

interface OpenAiContentItem {
  type?: string;
  text?: string;
}

interface OpenAiOutputItem {
  content?: OpenAiContentItem[];
}

interface OpenAiResponseBody {
  output_text?: string;
  output?: OpenAiOutputItem[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

interface OpenAiObservationExtractionRequest {
  model: string;
  store: false;
  instructions: string;
  input: Array<{
    role: 'user';
    content: string;
  }>;
  max_output_tokens: number;
  text: {
    format: {
      type: 'json_schema';
      name: string;
      strict: true;
      schema: typeof OBSERVATION_EXTRACTION_RESPONSE_SCHEMA;
    };
  };
}

const extractOutputText = (body: OpenAiResponseBody): string | undefined => {
  if (typeof body.output_text === 'string' && body.output_text) {
    return body.output_text;
  }

  return body.output
    ?.flatMap((item) => item.content ?? [])
    .find((content) => content.type === 'output_text' && typeof content.text === 'string')?.text;
};

const mapOpenAiUsage = (body: OpenAiResponseBody): LlmUsage | undefined => {
  if (!body.usage) {
    return undefined;
  }

  return normalizeLlmUsage({
    inputTokens: body.usage.input_tokens ?? body.usage.prompt_tokens ?? 0,
    outputTokens: body.usage.output_tokens ?? body.usage.completion_tokens ?? 0,
    totalTokens: body.usage.total_tokens ?? 0
  });
};

@Injectable()
export class OpenAiObservationExtractor implements ObservationExtractor {
  private readonly logger = new Logger(OpenAiObservationExtractor.name);

  constructor(private readonly config: ConfigService) {}

  async extract(request: ObservationExtractionRequest): Promise<ObservationExtractionResponse> {
    const apiKey = this.config.get<string>('openAi.apiKey');
    const model = this.config.get<string>('openAi.models.observationExtraction');
    const timeoutMs =
      this.config.get<number>('openAi.timeoutMs') || DEFAULT_OPENAI_EXTRACTION_TIMEOUT_MS;

    if (!apiKey || !model) {
      this.logger.error(
        `Observation extraction configuration incomplete provider=openai apiKeyConfigured=${Boolean(apiKey)} modelConfigured=${Boolean(model)}`
      );
      throw new Error('OpenAI observation extraction is not configured');
    }

    const startedAt = Date.now();
    const prompt = buildObservationExtractionPrompt(request);
    const payload: OpenAiObservationExtractionRequest = {
      model,
      store: false,
      instructions: prompt.instructions,
      input: [{ role: 'user', content: prompt.input }],
      max_output_tokens: 2400,
      text: {
        format: {
          type: 'json_schema',
          name: 'bbrain_wellbeing_observation_extraction_v1',
          strict: true,
          schema: OBSERVATION_EXTRACTION_RESPONSE_SCHEMA
        }
      }
    };

    this.logger.debug(
      `Sending observation extraction request provider=openai model=${model} timeoutMs=${timeoutMs} promptVersion=${OBSERVATION_EXTRACTION_PROMPT_VERSION}`
    );

    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!response.ok) {
        throw new Error(`OpenAI request failed httpStatus=${response.status}`);
      }

      const body = (await response.json()) as OpenAiResponseBody;
      const outputText = extractOutputText(body);

      if (!outputText) {
        throw new Error('OpenAI returned no observation extraction output');
      }

      const parsed = parseObservationExtractionResponse(outputText, 'OpenAI', request);
      const usage =
        mapOpenAiUsage(body) ??
        estimateLlmUsageFromText(`${prompt.instructions}\n${prompt.input}`, outputText);

      this.logger.debug(
        `Observation extraction completed provider=openai model=${model} durationMs=${Date.now() - startedAt} candidateCount=${parsed.candidates.length}`
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
          provider: 'openai',
          model,
          promptVersion: OBSERVATION_EXTRACTION_PROMPT_VERSION,
          schemaVersion: parsed.schemaVersion
        },
        usage
      };
    } catch (error) {
      this.logger.error(
        `Observation extraction failed provider=openai model=${model} durationMs=${Date.now() - startedAt} errorType=${error instanceof Error ? error.name : 'unknown'}`
      );
      throw error;
    }
  }
}
