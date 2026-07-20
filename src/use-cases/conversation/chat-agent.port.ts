import { ConversationScopeStatus } from '../../domain/conversation/services/conversation-scope-policy.service';
import { LlmUsage } from '../../domain/usage/value-objects/llm-usage';
import { ConversationAgentContext } from './conversation-agent-context';
import { ProposedConversationState } from '../../domain/conversation/services/conversation-state-update-policy.service';

export type ChatRiskLevel = 'none' | 'low' | 'medium' | 'high';

export type ChatConversationStateUpdate = ProposedConversationState;

export interface ChatAgentResponse {
  reply: string;
  riskLevel: ChatRiskLevel;
  scopeStatus: ConversationScopeStatus;
  conversationStateUpdate: ChatConversationStateUpdate;
  usage: LlmUsage;
}

export interface ChatAgentRequest {
  message: string;
  context: ConversationAgentContext;
  preferredLanguage?: string;
  responseLanguage?: string;
}

export interface ChatAgent {
  respond(request: ChatAgentRequest): Promise<ChatAgentResponse>;
}
