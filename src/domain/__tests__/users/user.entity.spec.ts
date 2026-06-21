import { User } from '../../users/entities/user.entity';
import { UserSex, type UserProfileSnapshot } from '../../users/entities/user-profile.types';
import { Email } from '../../users/value-objects/email.vo';
import { UserName } from '../../users/value-objects/user-name.vo';

function createUser() {
  return User.register({
    name: new UserName('Usuário Inicial'),
    email: new Email('usuario@bbrain.com'),
    passwordHash: 'hashed-password',
    timezone: 'America/Sao_Paulo',
    acceptedTermsAt: new Date('2026-01-01T00:00:00.000Z')
  });
}

function createProfileSnapshot(): UserProfileSnapshot {
  return {
    profileCompleted: true,
    basicInfo: {
      language: 'pt-BR',
      preferredName: 'Usuário Atualizado',
      sex: UserSex.OTHER
    },
    goals: {
      mainGoals: ['Entender emoções']
    },
    conversationPreferences: {
      communicationStyle: 'calm'
    },
    professionalContext: {},
    privacySettings: {
      allowPersonalization: true,
      allowMemory: true,
      allowMoodInsights: true,
      allowSensitiveDataStorage: true
    }
  };
}

describe('User entity', () => {
  it('updates basic information and public data', () => {
    const user = createUser();
    const updatedAt = new Date('2026-01-03T00:00:00.000Z');

    user.updateBasicInfo(
      {
        name: 'Nome Ajustado',
        timezone: 'UTC'
      },
      updatedAt
    );

    expect(user.toJson()).toMatchObject({
      name: 'Nome Ajustado',
      timezone: 'UTC',
      updatedAt: '2026-01-03T00:00:00.000Z'
    });
  });

  it('stores the profile snapshot without exposing it in the public user payload', () => {
    const user = createUser();
    const profile = createProfileSnapshot();

    user.updateProfile(profile, new Date('2026-01-04T00:00:00.000Z'));

    expect(user.profile).toEqual(profile);
    expect(user.toJson()).not.toHaveProperty('profile');
  });
});
