import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({
  collection: 'users',
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
})
export class UserMongo {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, required: true, unique: true, index: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: String, required: true })
  password_hash: string;

  @Prop({ type: Date })
  birth_date?: Date;

  @Prop({ type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] })
  gender?: string;

  @Prop({ type: String })
  phone?: string;

  @Prop({ type: String, required: true, default: 'America/Sao_Paulo' })
  timezone: string;

  @Prop({ type: Date, required: true })
  accepted_terms_at: Date;

  @Prop({ type: Date })
  created_at: Date;

  @Prop({ type: Date })
  updated_at: Date;

  @Prop({ type: Date })
  last_login_at?: Date;
}

export type UserDocument = HydratedDocument<UserMongo>;
export const UserSchema = SchemaFactory.createForClass(UserMongo);
