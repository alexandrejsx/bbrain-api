import { randomUUID } from 'node:crypto';
import type { AIContextMessage } from '../../../../modules/ai-context/ai-context.types';
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

  static toDomain(raw: ConversationMessageMongo): AIContextMessage {
    return {
      role: raw.role,
      content: raw.content
    };
  }
}
