import { UseCase } from '../use-case.interface';

export type CheckinKind = 'mood' | 'sleep' | 'energy' | 'stress' | 'motivation';

export interface RegisterCheckinInput {
  userId: string;
  kind: CheckinKind;
  value: number;
  registeredAt?: Date;
  notes?: string;
}

export interface RegisterCheckinOutput {
  checkinId: string;
}

export type RegisterCheckinUseCase = UseCase<RegisterCheckinInput, RegisterCheckinOutput>;

export interface GetRecentCheckinsInput {
  userId: string;
  limit?: number;
}

export interface GetRecentCheckinsOutput {
  checkins: ReadonlyArray<Record<string, unknown>>;
}

export type GetRecentCheckinsUseCase = UseCase<GetRecentCheckinsInput, GetRecentCheckinsOutput>;

export interface GetCheckinHistoryInput {
  userId: string;
  startsAt?: Date;
  endsAt?: Date;
}

export interface GetCheckinHistoryOutput {
  checkins: ReadonlyArray<Record<string, unknown>>;
}

export type GetCheckinHistoryUseCase = UseCase<GetCheckinHistoryInput, GetCheckinHistoryOutput>;
