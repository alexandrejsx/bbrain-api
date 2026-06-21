import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'conversation_messages' })
export class ConversationMessageMongo {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, index: true })
  user_id: string;

  @Prop({ type: String, required: true, index: true })
  conversation_id: string;

  @Prop({ type: String, required: true, enum: ['user', 'assistant'] })
  role: 'user' | 'assistant';

  @Prop({ type: String, required: true, maxlength: 12000 })
  content: string;

  @Prop({ type: Date, required: true, index: true })
  created_at: Date;
}

export type ConversationMessageDocument = HydratedDocument<ConversationMessageMongo>;
export const ConversationMessageSchema = SchemaFactory.createForClass(ConversationMessageMongo);
ConversationMessageSchema.index({ user_id: 1, conversation_id: 1, created_at: -1 });
