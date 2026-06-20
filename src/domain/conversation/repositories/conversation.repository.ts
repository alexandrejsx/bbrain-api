import { Conversation } from '../entities/conversation.entity';

export interface ConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  findActiveByUserId(userId: string): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
}
