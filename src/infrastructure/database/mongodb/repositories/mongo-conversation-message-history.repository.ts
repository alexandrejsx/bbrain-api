import { RecentConversationMessage } from '../../../../use-cases/conversation/conversation-agent-context';
import { ConversationMessageHistoryPort } from '../../../../use-cases/conversation/ports/conversation-message-history.port';
import { MongoConversationMessageMapper } from '../mappers/conversation-message.mapper';
import { MongodbRepository } from '../mongodb.repository';
import { ConversationMessageDocument } from '../schemas/conversation-message.schema';

export class MongoConversationMessageHistoryRepository implements ConversationMessageHistoryPort {
  constructor(private readonly baseRepository: MongodbRepository<ConversationMessageDocument>) {}

  async findRecent(
    userId: string,
    conversationId: string,
    limit: number
  ): Promise<RecentConversationMessage[]> {
    const messages = await this.baseRepository.findAll(
      { user_id: userId, conversation_id: conversationId },
      { created_at: -1 },
      limit
    );

    return messages
      .reverse()
      .map((message) => MongoConversationMessageMapper.toRecentConversationMessage(message));
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

  async deleteByUserId(userId: string): Promise<void> {
    await this.baseRepository.deleteMany({ user_id: userId });
  }
}
