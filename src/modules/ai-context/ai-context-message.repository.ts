import { AIContextMessage } from './ai-context.types';

export interface AIContextMessageRepository {
  findRecent(userId: string, conversationId: string, limit: number): Promise<AIContextMessage[]>;
  appendExchange(
    userId: string,
    conversationId: string,
    userMessage: string,
    assistantMessage: string,
    createdAt: Date
  ): Promise<void>;
}
