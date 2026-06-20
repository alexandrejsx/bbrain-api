import { ReflectiveProfile } from '../entities/reflective-profile.entity';

export interface ReflectiveProfileRepository {
  findByUserId(userId: string): Promise<ReflectiveProfile | null>;
  save(profile: ReflectiveProfile): Promise<void>;
}
