import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUserProfileDto } from '../profile.dto';
import { createDefaultUserProfileSnapshot } from '../profile-snapshot';

describe('UpdateUserProfileDto', () => {
  it('accepts an incomplete onboarding draft without sex', async () => {
    const dto = plainToInstance(UpdateUserProfileDto, {
      profileCompleted: false,
      basicInfo: { preferredName: 'Ana', language: 'pt-BR' },
      goals: { mainGoals: [] },
      conversationPreferences: {},
      professionalContext: {},
      privacySettings: {
        allowPersonalization: true,
        allowMemory: true,
        allowMoodInsights: false,
        allowSensitiveDataStorage: false
      }
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('starts new profiles with every privacy preference enabled', () => {
    expect(createDefaultUserProfileSnapshot().privacySettings).toEqual({
      allowPersonalization: true,
      allowMemory: true,
      allowMoodInsights: true,
      allowSensitiveDataStorage: true
    });
  });
});
