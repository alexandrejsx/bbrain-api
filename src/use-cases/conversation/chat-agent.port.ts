import { ConversationScopeStatus } from '../../domain/conversation/services/conversation-scope-policy.service';
import { LlmUsage } from '../../domain/usage/value-objects/llm-usage';
import { ConversationAgentContext } from './conversation-agent-context';

export type ChatRiskLevel = 'none' | 'low' | 'medium' | 'high';

export interface ChatProfileUpdate {
  shouldUpdate: boolean;
  currentContextSummary?: string;
  recurringThemesToAdd?: string[];
  emotionalPatternsToAdd?: string[];
  routineNotesToAdd?: string[];
  helpfulStrategiesToAdd?: string[];
  unhelpfulStrategiesToAdd?: string[];
  boundariesToAdd?: string[];
}

export interface ChatAgentResponse {
  reply: string;
  riskLevel: ChatRiskLevel;
  scopeStatus: ConversationScopeStatus;
  profileUpdate: ChatProfileUpdate;
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
