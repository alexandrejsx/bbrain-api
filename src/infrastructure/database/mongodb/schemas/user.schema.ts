import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type {
  CommunicationStyle,
  FormalDiagnosisAnswer,
  UserSex,
  YesNoPreferNotToSay
} from '../../../../domain/users/entities/user-profile.types';
import { UserSex as UserSexEnum } from '../../../../domain/users/entities/user-profile.types';

export interface UserProfileMongo {
  profile_completed: boolean;
  basic_info: {
    preferred_name?: string;
    birth_date?: Date;
    sex?: UserSex;
    language?: string;
  };
  goals: {
    main_goals: string[];
    other_goal?: string;
  };
  conversation_preferences: {
    communication_style?: CommunicationStyle;
  };
  professional_context: {
    has_formal_diagnosis?: FormalDiagnosisAnswer;
    diagnoses?: Array<{
      condition?: string;
      diagnosed_by?: string;
      currently_in_treatment?: YesNoPreferNotToSay;
    }>;
    is_in_therapy?: YesNoPreferNotToSay;
    has_psychiatric_follow_up?: YesNoPreferNotToSay;
    uses_medication_with_professional_follow_up?: YesNoPreferNotToSay;
  };
  privacy_settings: {
    allow_personalization: boolean;
    allow_memory: boolean;
    allow_mood_insights: boolean;
    allow_sensitive_data_storage: boolean;
  };
}

const diagnosisSchemaDefinition = {
  _id: false,
  condition: { type: String, required: false },
  diagnosed_by: { type: String, required: false },
  currently_in_treatment: { type: String, required: false }
};

const userProfileSchemaDefinition = {
  profile_completed: { type: Boolean, required: true },
  basic_info: {
    preferred_name: { type: String, required: false },
    birth_date: { type: Date, required: false },
    sex: { type: String, enum: Object.values(UserSexEnum), required: false },
    language: { type: String, required: false }
  },
  goals: {
    main_goals: [{ type: String }],
    other_goal: { type: String, required: false }
  },
  conversation_preferences: {
    communication_style: { type: String, required: false }
  },
  professional_context: {
    has_formal_diagnosis: { type: String, required: false },
    diagnoses: [diagnosisSchemaDefinition],
    is_in_therapy: { type: String, required: false },
    has_psychiatric_follow_up: { type: String, required: false },
    uses_medication_with_professional_follow_up: { type: String, required: false }
  },
  privacy_settings: {
    allow_personalization: { type: Boolean, required: true },
    allow_memory: { type: Boolean, required: true },
    allow_mood_insights: { type: Boolean, required: true },
    allow_sensitive_data_storage: { type: Boolean, required: true }
  }
};

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

  @Prop({ type: String })
  phone?: string;

  @Prop({ type: String, required: true, default: 'America/Sao_Paulo' })
  timezone: string;

  @Prop(raw(userProfileSchemaDefinition))
  profile?: UserProfileMongo;

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
