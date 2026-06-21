import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';
import { UserSex } from '../../domain/users/entities/user-profile.types';

const communicationStyles = ['calm', 'direct', 'reflective', 'practical'] as const;
const formalDiagnosisAnswers = ['yes', 'no', 'not_sure', 'prefer_not_to_answer'] as const;
const yesNoPreferAnswers = ['yes', 'no', 'prefer_not_to_answer'] as const;

class BasicInfoDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  preferredName?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsEnum(UserSex)
  sex: UserSex;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  language?: string;
}

class GoalsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(12)
  mainGoals: string[];

  @IsOptional()
  @IsString()
  @MaxLength(160)
  otherGoal?: string;
}

class ConversationPreferencesDto {
  @IsOptional()
  @IsString()
  @IsIn(communicationStyles)
  communicationStyle?: (typeof communicationStyles)[number];
}

class DiagnosisDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  condition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  diagnosedBy?: string;

  @IsOptional()
  @IsString()
  @IsIn(yesNoPreferAnswers)
  currentlyInTreatment?: (typeof yesNoPreferAnswers)[number];
}

class ProfessionalContextDto {
  @IsOptional()
  @IsString()
  @IsIn(formalDiagnosisAnswers)
  hasFormalDiagnosis?: (typeof formalDiagnosisAnswers)[number];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiagnosisDto)
  @ArrayMaxSize(3)
  diagnoses?: DiagnosisDto[];

  @IsOptional()
  @IsString()
  @IsIn(yesNoPreferAnswers)
  isInTherapy?: (typeof yesNoPreferAnswers)[number];

  @IsOptional()
  @IsString()
  @IsIn(yesNoPreferAnswers)
  hasPsychiatricFollowUp?: (typeof yesNoPreferAnswers)[number];

  @IsOptional()
  @IsString()
  @IsIn(yesNoPreferAnswers)
  usesMedicationWithProfessionalFollowUp?: (typeof yesNoPreferAnswers)[number];
}

class PrivacySettingsDto {
  @IsBoolean()
  allowPersonalization: boolean;

  @IsBoolean()
  allowMemory: boolean;

  @IsBoolean()
  allowMoodInsights: boolean;

  @IsBoolean()
  allowSensitiveDataStorage: boolean;
}

export class UpdateUserProfileDto {
  @IsBoolean()
  profileCompleted: boolean;

  @IsObject()
  @ValidateNested()
  @Type(() => BasicInfoDto)
  basicInfo: BasicInfoDto;

  @IsObject()
  @ValidateNested()
  @Type(() => GoalsDto)
  goals: GoalsDto;

  @IsObject()
  @ValidateNested()
  @Type(() => ConversationPreferencesDto)
  conversationPreferences: ConversationPreferencesDto;

  @IsObject()
  @ValidateNested()
  @Type(() => ProfessionalContextDto)
  professionalContext: ProfessionalContextDto;

  @IsObject()
  @ValidateNested()
  @Type(() => PrivacySettingsDto)
  privacySettings: PrivacySettingsDto;
}
