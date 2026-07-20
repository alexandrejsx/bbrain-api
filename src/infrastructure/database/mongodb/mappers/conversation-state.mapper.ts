import { ConversationState } from '../../../../domain/conversation/entities/conversation-state.entity';
import { Uuid } from '../../../../domain/shared/uuid.vo';
import {
  ConversationStateDocument,
  ConversationStateMongo
} from '../schemas/conversation-state.schema';

export class MongoConversationStateMapper {
  static toPersistence(state: ConversationState): Partial<ConversationStateMongo> {
    const raw = state.toJson();
    return {
      _id: raw.id,
      user_id: raw.userId,
      conversation_id: raw.conversationId,
      current_topic: raw.currentTopic,
      current_concerns: raw.currentConcerns,
      user_needs: raw.userNeeds,
      support_context: raw.supportContext,
      safety_state: raw.safetyState,
      pending_question_code: raw.pendingQuestionCode,
      last_assistant_intent: raw.lastAssistantIntent,
      revision: raw.revision,
      created_at: raw.createdAt,
      updated_at: raw.updatedAt,
      expires_at: raw.expiresAt
    };
  }

  static toDomain(raw: ConversationStateDocument | ConversationStateMongo): ConversationState {
    return ConversationState.reconstitute(
      {
        userId: raw.user_id,
        conversationId: raw.conversation_id,
        currentTopic: raw.current_topic,
        currentConcerns: [...raw.current_concerns],
        userNeeds: [...raw.user_needs],
        supportContext: raw.support_context,
        safetyState: raw.safety_state,
        pendingQuestionCode: raw.pending_question_code,
        lastAssistantIntent: raw.last_assistant_intent,
        revision: raw.revision,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
        expiresAt: raw.expires_at
      },
      new Uuid(raw._id)
    );
  }
}
