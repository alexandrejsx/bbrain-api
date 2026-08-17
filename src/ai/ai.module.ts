import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiGateway, AI_PROVIDER } from './ai-gateway';
import { AiProvider } from './ai.types';
import { ModelRouter } from './model-router';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';

export function selectAiProvider(
  configured: string | undefined,
  openAi: OpenAiProvider,
  gemini: GeminiProvider
): AiProvider {
  return configured === 'openai' ? openAi : gemini;
}

@Module({
  providers: [
    ModelRouter,
    OpenAiProvider,
    GeminiProvider,
    {
      provide: AI_PROVIDER,
      useFactory: (
        config: ConfigService,
        openAi: OpenAiProvider,
        gemini: GeminiProvider
      ): AiProvider => selectAiProvider(config.get<string>('ai.provider'), openAi, gemini),
      inject: [ConfigService, OpenAiProvider, GeminiProvider]
    },
    AiGateway
  ],
  exports: [AiGateway, ModelRouter]
})
export class AiModule {}
