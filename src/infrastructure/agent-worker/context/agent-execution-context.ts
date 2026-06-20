export interface AgentExecutionContext {
  readonly userId: string;
  readonly conversationId?: string;
  readonly sessionId?: string;
  readonly correlationId: string;
  readonly traceId?: string;
}
