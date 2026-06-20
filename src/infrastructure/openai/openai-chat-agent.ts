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

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

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
}

interface OpenAiResponsesRequest {
  model: string;
  store: false;
  instructions: string;
  input: string;
  max_output_tokens: number;
  text: {
    format: {
      type: 'json_schema';
      name: string;
      strict: true;
      schema: typeof CHAT_RESPONSE_SCHEMA;
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

@Injectable()
export class OpenAiChatAgent implements ChatAgent {
  private readonly logger = new Logger(OpenAiChatAgent.name);

  constructor(private readonly config: ConfigService) {}

  async respond(request: ChatAgentRequest): Promise<ChatAgentResponse> {
    const apiKey = this.config.get<string>('openAi.apiKey');
    const model = this.config.get<string>('openAi.models.chat');

    if (!apiKey || !model) {
      this.logger.error(
        `OpenAI configuration is incomplete apiKeyConfigured=${Boolean(apiKey)} modelConfigured=${Boolean(model)}`
      );
      throw new Error('OpenAI is not configured');
    }

    const startedAt = Date.now();
    this.logger.debug(`Sending chat request model=${model}`);

    const payload: OpenAiResponsesRequest = {
      model,
      store: false,
      instructions: buildChatSystemInstruction(request),
      input: request.message,
      max_output_tokens: 1200,
      text: {
        format: {
          type: 'json_schema',
          name: 'bbrain_chat_response',
          strict: true,
          schema: CHAT_RESPONSE_SCHEMA
        }
      }
    };

    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000)
      });

      if (!response.ok) {
        throw new Error(`OpenAI request failed ${await describeProviderHttpError(response)}`);
      }

      const body = (await response.json()) as OpenAiResponseBody;
      const outputText = extractOutputText(body);

      if (!outputText) {
        throw new Error('OpenAI returned no output');
      }

      const result = parseChatAgentResponse(outputText, 'OpenAI');
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
