import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({
  collection: 'mood_records',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
})
export class MoodMongo {
  @Prop({ type: String, required: true }) _id: string;
  @Prop({ type: String, required: true, index: true }) user_id: string;
  @Prop({ type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }) record_date: string;
  @Prop({ type: String, required: true, enum: ['mood_event', 'mood_daily_summary'], index: true })
  kind: 'mood_event' | 'mood_daily_summary';
  @Prop({ type: Object, required: true }) data: Record<string, unknown>;
  @Prop({ type: Object, required: true }) temporal_reference: Record<string, unknown>;
  @Prop({ type: Object, required: true }) provenance: Record<string, unknown>;
  @Prop({ type: [Object], required: true, default: [] }) provenance_history: Record<
    string,
    unknown
  >[];
  @Prop({ type: Number, required: true, min: 1, default: 1 }) revision: number;
  @Prop({ type: String }) client_request_id?: string;
  @Prop({ type: String }) session_id?: string;
  @Prop({ type: String }) source_event_id?: string;
  @Prop({ type: Date, required: true }) captured_at: Date;
  @Prop({ type: String }) extractor_version?: string;
  @Prop({ type: String }) prompt_version?: string;
  created_at: Date;
  updated_at: Date;
}

export type MoodDocument = HydratedDocument<MoodMongo>;
export const MoodSchema = SchemaFactory.createForClass(MoodMongo);
MoodSchema.index(
  { user_id: 1, client_request_id: 1 },
  { unique: true, partialFilterExpression: { client_request_id: { $type: 'string' } } }
);
MoodSchema.index(
  { user_id: 1, source_event_id: 1 },
  { unique: true, partialFilterExpression: { source_event_id: { $type: 'string' } } }
);
MoodSchema.index(
  { user_id: 1, record_date: 1 },
  { unique: true, name: 'unique_mood_record_per_user_day' }
);
MoodSchema.index({ user_id: 1, record_date: -1 });
