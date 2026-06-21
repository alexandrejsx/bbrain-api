import { AIContextMessageRepository } from '../../../../modules/ai-context/ai-context-message.repository';
import { AIContextMessage } from '../../../../modules/ai-context/ai-context.types';
import { MongoConversationMessageMapper } from '../mappers/conversation-message.mapper';
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

    return messages.reverse().map((message) => MongoConversationMessageMapper.toDomain(message));
  }

  async appendExchange(
    userId: string,
    conversationId: string,
    userMessage: string,
    assistantMessage: string,
    createdAt: Date
  ): Promise<void> {
    await this.baseRepository.insertMany([
      MongoConversationMessageMapper.toPersistence({
        userId,
        conversationId,
        role: 'user',
        content: userMessage,
        createdAt
      }),
      MongoConversationMessageMapper.toPersistence({
        userId,
        conversationId,
        role: 'assistant',
        content: assistantMessage,
        createdAt: new Date(createdAt.getTime() + 1)
      })
    ]);
  }
}
