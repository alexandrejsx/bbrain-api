import { randomUUID } from 'node:crypto';
import { AIContextMessageRepository } from '../../../../modules/ai-context/ai-context-message.repository';
import { AIContextMessage } from '../../../../modules/ai-context/ai-context.types';
import { MongodbRepository } from '../mongodb.repository';
import { ConversationMessageDocument } from '../schemas/conversation-message.schema';

export class MongoAIContextMessageRepository implements AIContextMessageRepository {
  constructor(private readonly baseRepository: MongodbRepository<ConversationMessageDocument>) {}

  async findRecent(
    userId: string,
    conversationId: string,
    limit: number
  ): Promise<AIContextMessage[]> {
    const messages = await this.baseRepository.findAll(
      { user_id: userId, conversation_id: conversationId },
      { created_at: -1 },
      limit
    );

    return messages.reverse().map((message) => ({
      role: message.role,
      content: message.content
    }));
  }

  async appendExchange(
    userId: string,
    conversationId: string,
    userMessage: string,
    assistantMessage: string,
    createdAt: Date
  ): Promise<void> {
    await this.baseRepository.insertMany([
      {
        _id: randomUUID(),
        user_id: userId,
        conversation_id: conversationId,
        role: 'user',
        content: userMessage,
        created_at: createdAt
      },
      {
        _id: randomUUID(),
        user_id: userId,
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantMessage,
        created_at: new Date(createdAt.getTime() + 1)
      }
    ]);
  }
}
