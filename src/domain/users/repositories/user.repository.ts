import { User } from '../entities/user.entity';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findScheduledForDeletionDueBefore(date: Date): Promise<User[]>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}
