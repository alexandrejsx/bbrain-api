import { ConversationScopeStatus } from '../../domain/conversation/services/conversation-scope-policy.service';
import { AIContext } from '../../modules/ai-context/ai-context.types';

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
}

export interface ChatAgentRequest {
  message: string;
  context: AIContext;
}

export interface ChatAgent {
  respond(request: ChatAgentRequest): Promise<ChatAgentResponse>;
}
