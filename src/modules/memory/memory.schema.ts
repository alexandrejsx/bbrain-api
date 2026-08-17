import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { MemoryKind, MemoryOrigin, MemoryRecordType } from './memory.types';

@Schema({
  collection: 'memories',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
})
export class MemoryMongo {
  @Prop({ type: String, required: true }) _id: string;
  @Prop({ type: String, required: true, index: true }) user_id: string;
  @Prop({ type: String, required: true, enum: ['memory', 'pattern'], index: true })
  record_type: MemoryRecordType;
  @Prop({ type: String, required: true, maxlength: 280 }) summary: string;
  @Prop({ type: String, required: true }) kind: MemoryKind | 'recurrence';
  @Prop({ type: [String], required: true, default: [], index: true }) topics: string[];
  @Prop({ type: Date }) event_date?: Date;
  @Prop({ type: Date, required: true }) first_observed_at: Date;
  @Prop({ type: Date, required: true, index: true }) last_observed_at: Date;
  @Prop({ type: Number, required: true, min: 0, max: 1 }) importance: number;
  @Prop({ type: Number, min: 0, max: 1 }) confidence?: number;
  @Prop({ type: Number, required: true, min: 1, default: 1 }) evidence_count: number;
  @Prop({ type: String, required: true, enum: ['chat', 'profile', 'manual'] }) origin: MemoryOrigin;
  @Prop({ type: Date, required: true }) captured_at: Date;
  @Prop({ type: String }) session_id?: string;
  @Prop({ type: String }) source_event_id?: string;
  @Prop({ type: String }) extractor_version?: string;
  @Prop({ type: String }) prompt_version?: string;
  @Prop({ type: String }) pattern_key?: string;
  created_at?: Date;
  updated_at?: Date;
}

export type MemoryDocument = HydratedDocument<MemoryMongo>;
export const MemorySchema = SchemaFactory.createForClass(MemoryMongo);
MemorySchema.index(
  { user_id: 1, source_event_id: 1, record_type: 1 },
  {
    unique: true,
    partialFilterExpression: { record_type: 'memory', source_event_id: { $type: 'string' } }
  }
);
MemorySchema.index(
  { user_id: 1, pattern_key: 1 },
  {
    unique: true,
    partialFilterExpression: { record_type: 'pattern', pattern_key: { $type: 'string' } }
  }
);

@Schema({
  collection: 'current_contexts',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
})
export class CurrentContextMongo {
  @Prop({ type: String, required: true }) _id: string;
  @Prop({ type: String, required: true, maxlength: 320 }) summary: string;
  @Prop({ type: [String], required: true, default: [] }) topics: string[];
  @Prop({ type: [String], required: true, default: [] }) pending_items: string[];
  @Prop({ type: Number, min: 0, max: 1 }) confidence?: number;
  @Prop({ type: String, required: true }) source_event_id: string;
  @Prop({ type: String, required: true }) session_id: string;
  @Prop({ type: Date, required: true }) captured_at: Date;
  created_at?: Date;
  updated_at?: Date;
}

export type CurrentContextDocument = HydratedDocument<CurrentContextMongo>;
export const CurrentContextSchema = SchemaFactory.createForClass(CurrentContextMongo);
