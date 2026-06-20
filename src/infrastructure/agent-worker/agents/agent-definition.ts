import { PromptKey } from '../prompts/prompt-key';

export interface AgentDefinitionBase {
  readonly name: string;
  readonly toolNames: readonly string[];
  readonly guardrailNames: readonly string[];
  readonly handoffNames: readonly string[];
}

export type AgentDefinition = AgentDefinitionBase &
  (
    | {
        readonly promptStatus: 'available';
        readonly promptKey: PromptKey;
      }
    | {
        readonly promptStatus: 'not-implemented';
        readonly promptKey?: never;
      }
  );
