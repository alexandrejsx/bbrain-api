import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChatAgent,
  ChatAgentRequest,
  ChatAgentResponse
} from '../../use-cases/conversation/chat-agent.port';
import {
  buildChatSystemInstruction,
  CHAT_RESPONSE_SCHEMA,
  parseChatAgentResponse
} from '../chat/chat-agent-support';
import { describeProviderError, describeProviderHttpError } from '../chat/ai-provider-error';

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiTextPart {
  text: string;
}

interface GeminiContent {
  role?: 'user' | 'model';
  parts: GeminiTextPart[];
}

interface GeminiGenerateContentRequest {
  systemInstruction: GeminiContent;
  contents: GeminiContent[];
  generationConfig: {
    maxOutputTokens: number;
    responseFormat: {
      text: {
        mimeType: 'APPLICATION_JSON';
        schema: typeof CHAT_RESPONSE_SCHEMA;
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
}

@Injectable()
export class GeminiChatAgent implements ChatAgent {
  private readonly logger = new Logger(GeminiChatAgent.name);

  constructor(private readonly config: ConfigService) {}

  async respond(request: ChatAgentRequest): Promise<ChatAgentResponse> {
    const apiKey = this.config.get<string>('gemini.apiKey');
    const model = this.config.get<string>('gemini.model');
    const timeoutMs = this.config.get<number>('gemini.timeoutMs') || 60_000;

    if (!apiKey || !model) {
      this.logger.error(
        `Gemini configuration is incomplete apiKeyConfigured=${Boolean(apiKey)} modelConfigured=${Boolean(model)}`
      );
      throw new Error('Gemini is not configured');
    }

    const startedAt = Date.now();
    this.logger.debug(`Sending chat request model=${model} timeoutMs=${timeoutMs}`);

    const payload: GeminiGenerateContentRequest = {
      systemInstruction: {
        parts: [{ text: buildChatSystemInstruction(request) }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: request.message }]
        }
      ],
      generationConfig: {
        maxOutputTokens: 1200,
        responseFormat: {
          text: {
            mimeType: 'APPLICATION_JSON',
            schema: CHAT_RESPONSE_SCHEMA
          }
        }
      }
    };

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
        throw new Error(`Gemini request failed ${await describeProviderHttpError(response)}`);
      }

      const body = (await response.json()) as GeminiGenerateContentResponse;
      const candidate = body.candidates?.[0];
      const outputText = candidate?.content?.parts.map((part) => part.text).join('');

      if (!outputText) {
        throw new Error(
          `Gemini returned no output finishReason=${candidate?.finishReason ?? 'none'} blockReason=${body.promptFeedback?.blockReason ?? 'none'}`
        );
      }

      let result: ChatAgentResponse;

      try {
        result = parseChatAgentResponse(outputText, 'Gemini');
      } catch (error) {
        this.logger.error(
          `Invalid structured output model=${model} finishReason=${candidate?.finishReason ?? 'none'} outputLength=${outputText.length}`
        );
        throw error;
      }

      this.logger.debug(
        `Chat request completed model=${model} durationMs=${Date.now() - startedAt}`
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Chat request failed model=${model} durationMs=${Date.now() - startedAt} ${describeProviderError(error)}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }
}
