import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiGeneration, AiProvider, AiProviderRequest } from '../ai.types';
import { RecoverableAiProviderError } from '../ai-gateway';
import {
  assertProviderResponse,
  isRecoverableNetworkError,
  normalizeUsage
} from './provider-utils';

interface OpenAiResponse {
  model?: string;
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
}

@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai' as const;

  constructor(private readonly config: ConfigService) {}

  async generate(request: AiProviderRequest): Promise<AiGeneration> {
    const apiKey = this.config.get<string>('openAi.apiKey');
    if (!apiKey) throw new Error('OpenAI is not configured');

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: request.model,
          store: false,
          instructions: request.systemPrompt,
          input: request.messages,
          max_output_tokens: request.maxOutputTokens,
          text: {
            format: {
              type: 'json_schema',
              name: request.outputSchemaName,
              strict: true,
              schema: request.outputSchema
            }
          }
        }),
        signal: AbortSignal.timeout(this.config.get<number>('openAi.timeoutMs') ?? 30_000)
      });
      assertProviderResponse(response, 'OpenAI');
      const body = (await response.json()) as OpenAiResponse;
      const text =
        body.output_text ??
        body.output
          ?.flatMap((item) => item.content ?? [])
          .find((item) => item.type === 'output_text' && typeof item.text === 'string')?.text;
      if (!text) throw new Error('OpenAI returned no structured output');

      return {
        text,
        provider: this.name,
        model: body.model ?? request.model,
        usage: normalizeUsage(
          body.usage?.input_tokens,
          body.usage?.output_tokens,
          body.usage?.total_tokens
        )
      };
    } catch (error) {
      if (isRecoverableNetworkError(error)) {
        throw new RecoverableAiProviderError('OpenAI network request failed', { cause: error });
      }
      throw error;
    }
  }
}
