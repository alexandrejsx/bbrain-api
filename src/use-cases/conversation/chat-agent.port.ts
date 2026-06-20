import { ReflectiveProfile } from '../../domain/conversation/entities/reflective-profile.entity';
import { ConversationScopeStatus } from '../../domain/conversation/services/conversation-scope-policy.service';

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
  profile: ReturnType<ReflectiveProfile['toJson']>;
}

export interface ChatAgent {
  respond(request: ChatAgentRequest): Promise<ChatAgentResponse>;
}
