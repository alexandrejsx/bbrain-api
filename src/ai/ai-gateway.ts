import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiGenerateRequest, AiGeneration, AiProvider } from './ai.types';
import { ModelRouter } from './model-router';

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export class RecoverableAiProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RecoverableAiProviderError';
  }
}

@Injectable()
export class AiGateway {
  private readonly logger = new Logger(AiGateway.name);

  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly modelRouter: ModelRouter,
    private readonly config: ConfigService
  ) {}

  async generate(request: AiGenerateRequest): Promise<AiGeneration> {
    const model = this.modelRouter.resolve(this.provider.name, request.role);
    const maxRetries = this.config.get<number>('ai.maxRetries') ?? 1;
    const startedAt = Date.now();

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const result = await this.provider.generate({ ...request, model });
        this.logger.log(
          `operation=${request.operation} provider=${result.provider} model=${result.model} role=${request.role} durationMs=${Date.now() - startedAt} success=true attempt=${attempt + 1} inputTokens=${result.usage.inputTokens} outputTokens=${result.usage.outputTokens} correlationId=${request.correlationId}`
        );
        return result;
      } catch (error) {
        const recoverable = error instanceof RecoverableAiProviderError;
        const finalAttempt = attempt >= maxRetries || !recoverable;
        this.logger[finalAttempt ? 'error' : 'warn'](
          `operation=${request.operation} provider=${this.provider.name} model=${model} role=${request.role} durationMs=${Date.now() - startedAt} success=false attempt=${attempt + 1} recoverable=${recoverable} errorType=${error instanceof Error ? error.name : 'unknown'} correlationId=${request.correlationId}`
        );
        if (finalAttempt) throw error;
      }
    }

    throw new Error('AI generation exhausted without result');
  }
}
