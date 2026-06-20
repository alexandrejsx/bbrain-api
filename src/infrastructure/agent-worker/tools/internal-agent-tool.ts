import { AgentExecutionContext } from '../context/agent-execution-context';

export interface InternalAgentTool<Input = unknown, Output = unknown> {
  readonly name: string;
  readonly description: string;
  execute(input: Input, context: AgentExecutionContext): Promise<Output>;
}
