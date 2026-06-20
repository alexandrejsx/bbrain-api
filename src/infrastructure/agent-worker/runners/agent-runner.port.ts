import { AgentExecutionContext } from '../context/agent-execution-context';

export interface AgentRunInput {
  readonly agentName: string;
  readonly input: string;
  readonly context: AgentExecutionContext;
}

export interface AgentRunOutput {
  readonly finalOutput: string;
  readonly metadata?: Record<string, unknown>;
}

export interface AgentRunner {
  run(input: AgentRunInput): Promise<AgentRunOutput>;
}
