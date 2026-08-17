import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProviderName, ModelRole } from './ai.types';

const roleKeys: Record<ModelRole, string> = {
  FAST: 'fast',
  CONVERSATION: 'conversation',
  REASONING: 'reasoning'
};

@Injectable()
export class ModelRouter {
  constructor(private readonly config: ConfigService) {}

  resolve(provider: AiProviderName, role: ModelRole): string {
    const namespace = provider === 'openai' ? 'openAi' : 'gemini';
    return this.config.getOrThrow<string>(`${namespace}.models.${roleKeys[role]}`);
  }
}
