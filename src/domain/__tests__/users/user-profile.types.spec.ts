import { isUserSex, UserSex } from '../../users/entities/user-profile.types';

describe('UserSex', () => {
  it('accepts valid values', () => {
    expect(isUserSex(UserSex.MALE)).toBe(true);
    expect(isUserSex(UserSex.FEMALE)).toBe(true);
    expect(isUserSex(UserSex.OTHER)).toBe(true);
    expect(isUserSex(UserSex.PREFER_NOT_TO_ANSWER)).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isUserSex('masculino')).toBe(false);
    expect(isUserSex('feminino')).toBe(false);
    expect(isUserSex('gender')).toBe(false);
    expect(isUserSex('')).toBe(false);
    expect(isUserSex(undefined)).toBe(false);
  });
});
