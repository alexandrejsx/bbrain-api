import { ConversationAgentContextBuildResult } from '../conversation-agent-context';

export interface ConversationAgentContextBuilderPort {
  build(userId: string, conversationId?: string): Promise<ConversationAgentContextBuildResult>;
}
