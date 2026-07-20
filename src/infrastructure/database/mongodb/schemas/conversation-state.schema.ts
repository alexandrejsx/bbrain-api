import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  ConversationAssistantIntent,
  ConversationPendingQuestionCode,
  ConversationSafetyState,
  ConversationSupportContext
} from '../../../../domain/conversation/entities/conversation-state.entity';

@Schema({ collection: 'conversation_states' })
export class ConversationStateMongo {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, index: true })
  user_id: string;

  @Prop({ type: String, required: true })
  conversation_id: string;

  @Prop({ type: String, maxlength: 100, trim: true })
  current_topic?: string;

  @Prop({ type: [String], required: true, default: [] })
  current_concerns: string[];

  @Prop({ type: [String], required: true, default: [] })
  user_needs: string[];

  @Prop({ type: String, required: true })
  support_context: ConversationSupportContext;

  @Prop({ type: String, required: true })
  safety_state: ConversationSafetyState;

  @Prop({ type: String, required: true })
  pending_question_code: ConversationPendingQuestionCode;

  @Prop({ type: String, required: true })
  last_assistant_intent: ConversationAssistantIntent;

  @Prop({ type: Number, required: true, min: 1 })
  revision: number;

  @Prop({ type: Date, required: true })
  created_at: Date;

  @Prop({ type: Date, required: true })
  updated_at: Date;

  @Prop({ type: Date, required: true })
  expires_at: Date;
}

export type ConversationStateDocument = HydratedDocument<ConversationStateMongo>;
export const ConversationStateSchema = SchemaFactory.createForClass(ConversationStateMongo);
ConversationStateSchema.index(
  { user_id: 1, conversation_id: 1 },
  { unique: true, name: 'conversation_state_owner_unique' }
);
ConversationStateSchema.index(
  { expires_at: 1 },
  { expireAfterSeconds: 0, name: 'conversation_state_expiry' }
);
