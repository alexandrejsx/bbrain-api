import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export interface RecentMessageMongo {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: Date;
}

@Schema({
  collection: 'conversation_sessions',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
})
export class ChatSessionMongo {
  @Prop({ type: String, required: true }) _id: string;
  @Prop({ type: String, required: true, index: true }) user_id: string;
  @Prop({ type: String, required: true }) session_id: string;
  @Prop({
    type: [
      {
        _id: false,
        id: { type: String, required: true },
        role: { type: String, required: true, enum: ['user', 'assistant'] },
        content: { type: String, required: true, maxlength: 12000 },
        created_at: { type: Date, required: true }
      }
    ],
    required: true,
    default: []
  })
  recent_messages: RecentMessageMongo[];
  @Prop({ type: Date, required: true, index: { expires: 0 } }) expires_at: Date;
}

export type ChatSessionDocument = HydratedDocument<ChatSessionMongo>;
export const ChatSessionSchema = SchemaFactory.createForClass(ChatSessionMongo);
ChatSessionSchema.index({ user_id: 1, session_id: 1 }, { unique: true });

@Schema({ collection: 'chat_requests' })
export class ChatRequestMongo {
  @Prop({ type: String, required: true }) _id: string;
  @Prop({ type: String, required: true }) user_id: string;
  @Prop({ type: String, required: true }) session_id: string;
  @Prop({ type: String, required: true }) source_event_id: string;
  @Prop({ type: String, required: true }) request_fingerprint: string;
  @Prop({ type: String, required: true, enum: ['processing', 'completed'] }) status: string;
  @Prop({ type: Date, required: true }) claimed_at: Date;
  @Prop({ type: Date }) completed_at?: Date;
  @Prop({ type: Date, required: true, index: { expires: 0 } }) expires_at: Date;
}

export type ChatRequestDocument = HydratedDocument<ChatRequestMongo>;
export const ChatRequestSchema = SchemaFactory.createForClass(ChatRequestMongo);
ChatRequestSchema.index({ user_id: 1, session_id: 1, source_event_id: 1 }, { unique: true });
