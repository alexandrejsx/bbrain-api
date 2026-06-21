import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({
  collection: 'reflective_profiles',
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
})
export class ReflectiveProfileMongo {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  user_id: string;

  @Prop({ type: String, trim: true })
  preferred_tone?: string;

  @Prop({ type: [String], required: true, default: [] })
  analysis_goals: string[];

  @Prop({ type: [String], required: true, default: [] })
  recurring_themes: string[];

  @Prop({ type: [String], required: true, default: [] })
  emotional_patterns: string[];

  @Prop({ type: [String], required: true, default: [] })
  routine_notes: string[];

  @Prop({ type: [String], required: true, default: [] })
  helpful_strategies: string[];

  @Prop({ type: [String], required: true, default: [] })
  unhelpful_strategies: string[];

  @Prop({ type: [String], required: true, default: [] })
  boundaries: string[];

  @Prop({ type: [String], required: true, default: [] })
  reported_formal_diagnoses: string[];

  @Prop({ type: String, maxlength: 180, trim: true })
  reported_medication?: string;

  @Prop({ type: String, maxlength: 260, trim: true })
  professional_support?: string;

  @Prop({ type: String, maxlength: 500, trim: true })
  current_context_summary?: string;

  @Prop({ type: Date })
  last_interaction_at?: Date;

  @Prop({ type: Date })
  created_at: Date;

  @Prop({ type: Date })
  updated_at: Date;
}

export type ReflectiveProfileDocument = HydratedDocument<ReflectiveProfileMongo>;
export const ReflectiveProfileSchema = SchemaFactory.createForClass(ReflectiveProfileMongo);
