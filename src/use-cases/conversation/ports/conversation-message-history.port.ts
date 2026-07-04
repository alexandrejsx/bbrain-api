import { RecentConversationMessage } from '../conversation-agent-context';

export interface ConversationMessageHistoryPort {
  findRecent(
    userId: string,
    conversationId: string,
    limit: number
  ): Promise<RecentConversationMessage[]>;

  appendExchange(
    userId: string,
    conversationId: string,
    userMessage: string,
    assistantMessage: string,
    createdAt: Date
  ): Promise<void>;

  deleteByUserId(userId: string): Promise<void>;
}
