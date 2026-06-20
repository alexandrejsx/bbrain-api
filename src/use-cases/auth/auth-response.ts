import { User } from '../../domain/users/entities/user.entity';

export type PublicUser = ReturnType<User['toJson']>;

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
}
