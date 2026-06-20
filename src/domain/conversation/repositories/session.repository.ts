import { Session } from '../entities/session.entity';

export interface SessionRepository {
  findById(id: string): Promise<Session | null>;
  findActiveByConversationId(conversationId: string): Promise<Session | null>;
  save(session: Session): Promise<void>;
}
