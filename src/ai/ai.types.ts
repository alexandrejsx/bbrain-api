export type AiProviderName = 'openai' | 'gemini';
export type ModelRole = 'FAST' | 'CONVERSATION' | 'REASONING';

export type AiOperation = 'conversation.reply' | 'conversation.post_processing';

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AiGenerateRequest {
  operation: AiOperation;
  role: ModelRole;
  correlationId: string;
  systemPrompt: string;
  messages: AiMessage[];
  outputSchema: Record<string, unknown>;
  outputSchemaName: string;
  maxOutputTokens: number;
}

export interface AiProviderRequest extends AiGenerateRequest {
  model: string;
}

export interface AiGeneration {
  text: string;
  provider: AiProviderName;
  model: string;
  usage: AiUsage;
}

export interface AiProvider {
  readonly name: AiProviderName;
  generate(request: AiProviderRequest): Promise<AiGeneration>;
}
