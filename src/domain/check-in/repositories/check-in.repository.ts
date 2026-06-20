import {
  EnergyCheckin,
  MoodCheckin,
  MotivationCheckin,
  SleepCheckin,
  StressCheckin
} from '../entities/check-in.entities';

export type UserCheckin =
  | MoodCheckin
  | SleepCheckin
  | EnergyCheckin
  | StressCheckin
  | MotivationCheckin;

export interface CheckinRepository {
  findRecentByUserId(userId: string, limit?: number): Promise<UserCheckin[]>;
  findHistoryByUserId(userId: string, startsAt?: Date, endsAt?: Date): Promise<UserCheckin[]>;
  save(checkin: UserCheckin): Promise<void>;
}
