import { ConversationState } from '../../../../domain/conversation/entities/conversation-state.entity';
import { ConversationStateRepository } from '../../../../domain/conversation/repositories/conversation-state.repository';
import { MongoConversationStateMapper } from '../mappers/conversation-state.mapper';
import { MongodbRepository } from '../mongodb.repository';
import { ConversationStateDocument } from '../schemas/conversation-state.schema';

export class MongoConversationStateRepository implements ConversationStateRepository {
  constructor(private readonly baseRepository: MongodbRepository<ConversationStateDocument>) {}

  async findActive(
    userId: string,
    conversationId: string,
    referenceAt = new Date()
  ): Promise<ConversationState | null> {
    const document = await this.baseRepository.findOne({
      user_id: userId,
      conversation_id: conversationId,
      expires_at: { $gt: referenceAt }
    });
    return document ? MongoConversationStateMapper.toDomain(document) : null;
  }

  async save(state: ConversationState, expectedRevision: number): Promise<boolean> {
    const persistence = MongoConversationStateMapper.toPersistence(state);

    if (expectedRevision === 0) {
      try {
        await this.baseRepository.add(persistence);
        return true;
      } catch (error) {
        if (isDuplicateKeyError(error)) return false;
        throw error;
      }
    }

    const { _id: _ignoredId, ...update } = persistence;
    void _ignoredId;
    const saved = await this.baseRepository.findOneAndUpdate(
      {
        user_id: state.userId,
        conversation_id: state.conversationId,
        revision: expectedRevision
      },
      update
    );
    return saved !== null;
  }

  async deleteByConversation(userId: string, conversationId: string): Promise<void> {
    await this.baseRepository.deleteMany({ user_id: userId, conversation_id: conversationId });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.baseRepository.deleteMany({ user_id: userId });
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}
