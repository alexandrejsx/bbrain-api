import { User } from '../../domain/users/entities/user.entity';
import type { UserProfileSnapshot } from '../../domain/users/entities/user-profile.types';

export type PublicUser = ReturnType<User['toJson']>;

export interface AuthResponse {
  user: PublicUser;
  profile: UserProfileSnapshot;
  accessToken: string;
}
