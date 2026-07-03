import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PlanType } from '../../../../domain/plans/plan-definition';

@Schema({
  collection: 'user_daily_usages',
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
})
export class UserDailyUsageMongo {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, index: true })
  user_id: string;

  @Prop({ type: String, required: true, enum: Object.values(PlanType) })
  plan: PlanType;

  @Prop({ type: String, required: true, index: true })
  date_key: string;

  @Prop({ type: Date, required: true })
  period_start: Date;

  @Prop({ type: Date, required: true })
  period_end: Date;

  @Prop({ type: Number, required: true, default: 0 })
  input_tokens: number;

  @Prop({ type: Number, required: true, default: 0 })
  output_tokens: number;

  @Prop({ type: Number, required: true, default: 0 })
  total_tokens: number;

  @Prop({ type: Number, required: true, default: 0 })
  message_count: number;

  @Prop({ type: Number, required: true, default: 0 })
  blocked_count: number;

  @Prop({ type: Date })
  created_at: Date;

  @Prop({ type: Date })
  updated_at: Date;
}

export type UserDailyUsageDocument = HydratedDocument<UserDailyUsageMongo>;
export const UserDailyUsageSchema = SchemaFactory.createForClass(UserDailyUsageMongo);
UserDailyUsageSchema.index({ user_id: 1, date_key: 1 }, { unique: true });
