import { Injectable } from '@nestjs/common';
import { User } from '../../domain/users/entities/user.entity';

export interface UserDataConsent {
  timezone: string;
  allowPersonalization: boolean;
  allowMemory: boolean;
  allowMoodInsights: boolean;
  allowSensitiveDataStorage: boolean;
  canUseConversationData: boolean;
  canExtractWellbeing: boolean;
}

@Injectable()
export class DataConsentPolicy {
  resolve(user: User): UserDataConsent {
    const settings = user.profile?.privacySettings;
    const allowPersonalization = settings?.allowPersonalization !== false;
    const allowMemory = settings?.allowMemory !== false;
    const allowMoodInsights = settings?.allowMoodInsights === true;
    const allowSensitiveDataStorage = settings?.allowSensitiveDataStorage === true;
    return {
      timezone: user.timezone || 'UTC',
      allowPersonalization,
      allowMemory,
      allowMoodInsights,
      allowSensitiveDataStorage,
      canUseConversationData: allowPersonalization && allowMemory && allowSensitiveDataStorage,
      canExtractWellbeing: allowMoodInsights && allowSensitiveDataStorage
    };
  }
}
