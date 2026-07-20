import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';
import { WellbeingObservationKind } from '../../../../domain/wellbeing-history/value-objects/wellbeing-observation.types';

@Schema({ collection: 'wellbeing_observations' })
export class WellbeingObservationMongo {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, index: true, maxlength: 160 })
  user_id: string;

  @Prop({ type: String, required: true, maxlength: 512 })
  idempotency_key: string;

  @Prop({
    type: String,
    required: true,
    enum: ['mood_event', 'mood_daily_summary', 'sleep_record']
  })
  kind: WellbeingObservationKind;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  data: Record<string, unknown>;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  temporal_reference: Record<string, unknown>;

  @Prop({ type: [SchemaTypes.Mixed], required: true })
  provenance_history: Record<string, unknown>[];

  @Prop({ type: [SchemaTypes.Mixed], required: true, default: [] })
  revision_history: Record<string, unknown>[];

  @Prop({ type: Number, required: true, min: 1 })
  revision: number;

  @Prop({ type: Date, required: true })
  created_at: Date;

  @Prop({ type: Date, required: true })
  updated_at: Date;
}

export type WellbeingObservationDocument = HydratedDocument<WellbeingObservationMongo>;
export const WellbeingObservationSchema = SchemaFactory.createForClass(WellbeingObservationMongo);

WellbeingObservationSchema.index(
  { user_id: 1, idempotency_key: 1 },
  { unique: true, name: 'wellbeing_user_idempotency_unique' }
);
WellbeingObservationSchema.index({ user_id: 1, kind: 1, created_at: -1 });
WellbeingObservationSchema.index({
  user_id: 1,
  kind: 1,
  'data.source_observation_ids': 1
});
WellbeingObservationSchema.index(
  { user_id: 1, kind: 1, 'temporal_reference.local_date': 1 },
  {
    unique: true,
    name: 'wellbeing_current_derived_mood_day_unique',
    partialFilterExpression: {
      kind: 'mood_daily_summary',
      'data.summary_source': 'derived',
      'data.status': 'current',
      'temporal_reference.local_date': { $type: 'string' }
    }
  }
);
