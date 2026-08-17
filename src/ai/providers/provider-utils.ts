import { AiUsage } from '../ai.types';
import { RecoverableAiProviderError } from '../ai-gateway';

export function normalizeUsage(input?: number, output?: number, total?: number): AiUsage {
  const inputTokens = Math.max(0, Math.floor(input ?? 0));
  const outputTokens = Math.max(0, Math.floor(output ?? 0));
  return {
    inputTokens,
    outputTokens,
    totalTokens: Math.max(inputTokens + outputTokens, Math.floor(total ?? 0))
  };
}

export function assertProviderResponse(response: Response, provider: string): void {
  if (response.ok) return;

  const recoverable = response.status === 408 || response.status === 429 || response.status >= 500;
  const error = recoverable
    ? new RecoverableAiProviderError(`${provider} request failed with status ${response.status}`)
    : new Error(`${provider} request failed with status ${response.status}`);
  throw error;
}

export function isRecoverableNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'))
  );
}
