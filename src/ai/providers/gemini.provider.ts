import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiGeneration, AiProvider, AiProviderRequest } from '../ai.types';
import { RecoverableAiProviderError } from '../ai-gateway';
import {
  assertProviderResponse,
  isRecoverableNetworkError,
  normalizeUsage
} from './provider-utils';

interface GeminiResponse {
  modelVersion?: string;
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

@Injectable()
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini' as const;

  constructor(private readonly config: ConfigService) {}

  async generate(request: AiProviderRequest): Promise<AiGeneration> {
    const apiKey = this.config.get<string>('gemini.apiKey');
    if (!apiKey) throw new Error('Gemini is not configured');

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: request.systemPrompt }] },
            contents: request.messages.map((message) => ({
              role: message.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: message.content }]
            })),
            generationConfig: {
              maxOutputTokens: request.maxOutputTokens,
              responseMimeType: 'application/json',
              responseJsonSchema: request.outputSchema,
              ...(request.role === 'FAST' ? { thinkingConfig: { thinkingLevel: 'MINIMAL' } } : {})
            }
          }),
          signal: AbortSignal.timeout(this.config.get<number>('gemini.timeoutMs') ?? 60_000)
        }
      );
      assertProviderResponse(response, 'Gemini');
      const body = (await response.json()) as GeminiResponse;
      const text = body.candidates?.[0]?.content?.parts?.find(
        (part) => typeof part.text === 'string'
      )?.text;
      if (!text) throw new Error('Gemini returned no structured output');

      return {
        text,
        provider: this.name,
        model: body.modelVersion ?? request.model,
        usage: normalizeUsage(
          body.usageMetadata?.promptTokenCount,
          body.usageMetadata?.candidatesTokenCount,
          body.usageMetadata?.totalTokenCount
        )
      };
    } catch (error) {
      if (isRecoverableNetworkError(error)) {
        throw new RecoverableAiProviderError('Gemini network request failed', { cause: error });
      }
      throw error;
    }
  }
}
