import { randomUUID } from 'node:crypto';
import type { RecentConversationMessage } from '../../../../use-cases/conversation/conversation-agent-context';
import type { ConversationMessageMongo } from '../schemas/conversation-message.schema';

type ConversationMessagePersistenceInput = {
  userId: string;
  conversationId: string;
  role: ConversationMessageMongo['role'];
  content: string;
  createdAt: Date;
};

export class MongoConversationMessageMapper {
  static toPersistence(input: ConversationMessagePersistenceInput): ConversationMessageMongo {
    return {
      _id: randomUUID(),
      user_id: input.userId,
      conversation_id: input.conversationId,
      role: input.role,
      content: input.content,
      created_at: input.createdAt
    };
  }

  static toRecentConversationMessage(raw: ConversationMessageMongo): RecentConversationMessage {
    return {
      role: raw.role,
      content: raw.content
    };
  }
}
