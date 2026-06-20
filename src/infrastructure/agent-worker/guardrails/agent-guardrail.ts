import { AgentExecutionContext } from '../context/agent-execution-context';

export interface AgentGuardrailResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly auditEventName?: string;
}

export interface AgentGuardrail<Input = unknown> {
  readonly name: string;
  evaluate(input: Input, context: AgentExecutionContext): Promise<AgentGuardrailResult>;
}
