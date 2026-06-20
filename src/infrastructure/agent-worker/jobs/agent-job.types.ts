export type AgentJobName =
  | 'process-user-message'
  | 'generate-summary'
  | 'generate-insights'
  | 'refresh-memory-relevance'
  | 'calculate-risk';

export interface AgentJob<Data = Record<string, unknown>> {
  readonly name: AgentJobName;
  readonly data: Data;
  readonly context: {
    readonly userId: string;
    readonly correlationId: string;
    readonly conversationId?: string;
    readonly traceId?: string;
  };
}
