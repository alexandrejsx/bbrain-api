import { UseCase } from '../../../use-cases/use-case.interface';
import { AgentExecutionContext } from '../context/agent-execution-context';
import { InternalAgentTool } from './internal-agent-tool';

export class UseCaseAgentTool<Input, Output> implements InternalAgentTool<Input, Output> {
  constructor(
    readonly name: string,
    readonly description: string,
    private readonly useCase: UseCase<Input, Output>
  ) {}

  execute(input: Input, context: AgentExecutionContext): Promise<Output> {
    void context;
    return this.useCase.execute(input);
  }
}
