import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({
  collection: 'daily_check_ins',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
})
export class DailyCheckInMongo {
  @Prop({ type: String, required: true }) _id: string;
  @Prop({ type: String, required: true, index: true }) user_id: string;
  @Prop({ type: String, required: true }) local_date: string;
  @Prop({ type: String, required: true }) timezone: string;
  @Prop({ type: String, required: true, enum: ['pt-BR', 'en-US', 'es-ES'] }) locale: string;
  @Prop({ type: String, required: true, enum: ['in_progress', 'completed'] }) status: string;
  @Prop({ type: Number, required: true, min: 1, max: 5 }) question_count: number;
  @Prop({ type: Number, required: true, min: 1, max: 5 }) max_questions: number;
  @Prop({ type: Object, required: true }) state: Record<string, unknown>;
  @Prop({ type: String }) next_question?: string;
  @Prop({ type: [Object], required: true, default: [] }) processed_requests: Array<{
    id: string;
    fingerprint: string;
  }>;
  @Prop({ type: Object }) processing?: { id: string; fingerprint: string };
  @Prop({ type: String }) mood_record_id?: string;
  @Prop({ type: String }) sleep_record_id?: string;
  @Prop({ type: Date }) dismissed_at?: Date;
  @Prop({ type: Date }) completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export type DailyCheckInDocument = HydratedDocument<DailyCheckInMongo>;
export const DailyCheckInSchema = SchemaFactory.createForClass(DailyCheckInMongo);
DailyCheckInSchema.index({ user_id: 1, local_date: 1 }, { unique: true });
