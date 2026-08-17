import { User } from '../user.entity';
import { PlanType } from '../../../plans/plan-definition';
import { UserSex, type UserProfileSnapshot } from '../user-profile.types';
import { Email } from '../../value-objects/email.vo';
import { UserName } from '../../value-objects/user-name.vo';

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
  it('starts new users on the free plan', () => {
    const user = createUser();

    expect(user.plan).toBe(PlanType.FREE);
    expect(user.toJson()).toMatchObject({
      plan: PlanType.FREE
    });
  });

  it('updates the account plan', () => {
    const user = createUser();
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');

    user.updatePlan(PlanType.STANDARD, updatedAt);

    expect(user.plan).toBe(PlanType.STANDARD);
    expect(user.toJson()).toMatchObject({
      plan: PlanType.STANDARD,
      updatedAt: '2026-01-02T00:00:00.000Z'
    });
  });

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

  it('schedules deletion and allows reactivation before the deadline', () => {
    const user = createUser();
    const deactivatedAt = new Date('2026-01-05T00:00:00.000Z');

    user.scheduleDeletion(7, deactivatedAt);

    expect(user.hasScheduledDeletion()).toBe(true);
    expect(user.canBeReactivated(new Date('2026-01-10T00:00:00.000Z'))).toBe(true);
    expect(user.isDeletionDue(new Date('2026-01-10T00:00:00.000Z'))).toBe(false);

    user.reactivate(new Date('2026-01-10T12:00:00.000Z'));

    expect(user.hasScheduledDeletion()).toBe(false);
    expect(user.accountScheduledDeletionAt).toBeUndefined();
  });

  it('tracks password reset expiration and clears the reset after a password change', () => {
    const user = createUser();
    const requestedAt = new Date('2026-01-05T00:00:00.000Z');
    const expiresAt = new Date('2026-01-05T00:15:00.000Z');

    user.schedulePasswordReset('hashed-code', expiresAt, requestedAt);

    expect(user.hasActivePasswordReset(new Date('2026-01-05T00:10:00.000Z'))).toBe(true);
    expect(user.hasActivePasswordReset(new Date('2026-01-05T00:16:00.000Z'))).toBe(false);

    user.updatePasswordHash('new-hash', new Date('2026-01-05T00:12:00.000Z'));

    expect(user.passwordHash).toBe('new-hash');
    expect(user.passwordResetCodeHash).toBeUndefined();
    expect(user.passwordResetCodeExpiresAt).toBeUndefined();
  });

  it('updates the phone number in the public payload', () => {
    const user = createUser();

    user.updatePhone('+442071838750', new Date('2026-01-06T00:00:00.000Z'));

    expect(user.phone).toBe('+442071838750');
    expect(user.toJson()).toMatchObject({
      phone: '+442071838750',
      updatedAt: '2026-01-06T00:00:00.000Z'
    });
  });
});
