import { ConversationState } from '../entities/conversation-state.entity';

export interface ConversationStateRepository {
  findActive(
    userId: string,
    conversationId: string,
    referenceAt?: Date
  ): Promise<ConversationState | null>;
  save(state: ConversationState, expectedRevision: number): Promise<boolean>;
  deleteByConversation(userId: string, conversationId: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}
