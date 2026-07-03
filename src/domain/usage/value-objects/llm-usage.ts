export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export function normalizeLlmUsage(usage: LlmUsage): LlmUsage {
  const inputTokens = normalizeTokenCount(usage.inputTokens);
  const outputTokens = normalizeTokenCount(usage.outputTokens);
  const reportedTotal = normalizeTokenCount(usage.totalTokens);
  const computedTotal = inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens: reportedTotal > 0 ? reportedTotal : computedTotal
  };
}

export function estimateLlmUsageFromText(inputText: string, outputText: string): LlmUsage {
  const inputTokens = estimateTokensFromText(inputText);
  const outputTokens = estimateTokensFromText(outputText);

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens
  };
}

function estimateTokensFromText(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function normalizeTokenCount(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}
