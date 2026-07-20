import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'conversation_exchange_ledgers' })
export class ConversationExchangeLedgerMongo {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, index: true })
  user_id: string;

  @Prop({ type: String, required: true })
  conversation_id: string;

  @Prop({ type: String, required: true, maxlength: 128 })
  source_message_id: string;

  @Prop({ type: String, required: true, minlength: 64, maxlength: 64 })
  request_fingerprint: string;

  @Prop({ type: String, required: true, enum: ['processing', 'completed'] })
  status: 'processing' | 'completed';

  @Prop({ type: String, required: true })
  claim_id: string;

  @Prop({ type: Date, required: true })
  lease_expires_at: Date;

  @Prop({ type: String, enum: ['none', 'low', 'medium', 'high'] })
  risk_level?: string;

  @Prop({ type: String, enum: ['in_scope', 'out_of_scope'] })
  scope_status?: string;

  @Prop({ type: Number, min: 0 })
  input_tokens?: number;

  @Prop({ type: Number, min: 0 })
  output_tokens?: number;

  @Prop({ type: Number, min: 0 })
  total_tokens?: number;

  @Prop({ type: Date, required: true })
  created_at: Date;

  @Prop({ type: Date, required: true })
  updated_at: Date;

  @Prop({ type: Date, required: true })
  expires_at: Date;
}

export type ConversationExchangeLedgerDocument = HydratedDocument<ConversationExchangeLedgerMongo>;
export const ConversationExchangeLedgerSchema = SchemaFactory.createForClass(
  ConversationExchangeLedgerMongo
);
ConversationExchangeLedgerSchema.index(
  { user_id: 1, conversation_id: 1, source_message_id: 1 },
  { unique: true, name: 'conversation_exchange_ledger_unique' }
);
ConversationExchangeLedgerSchema.index(
  { expires_at: 1 },
  { expireAfterSeconds: 0, name: 'conversation_exchange_ledger_expiry' }
);
