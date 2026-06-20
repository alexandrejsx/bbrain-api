import { UseCase } from '../use-case.interface';

export interface CreateSupportPlanInput {
  userId: string;
  startsAt: Date;
  endsAt?: Date;
}

export interface CreateSupportPlanOutput {
  supportPlanId: string;
}

export type CreateSupportPlanUseCase = UseCase<CreateSupportPlanInput, CreateSupportPlanOutput>;

export interface TrackProgressInput {
  supportPlanId: string;
  habitGoalId: string;
  status: string;
  note?: string;
}

export interface TrackProgressOutput {
  progressId: string;
}

export type TrackProgressUseCase = UseCase<TrackProgressInput, TrackProgressOutput>;

export interface UpdatePlanInput {
  supportPlanId: string;
}

export interface UpdatePlanOutput {
  supportPlanId: string;
}

export type UpdatePlanUseCase = UseCase<UpdatePlanInput, UpdatePlanOutput>;

export interface AddHabitGoalInput {
  supportPlanId: string;
  description: string;
  frequency: string;
}

export interface AddHabitGoalOutput {
  habitGoalId: string;
}

export type AddHabitGoalUseCase = UseCase<AddHabitGoalInput, AddHabitGoalOutput>;

export interface GetActivePlanInput {
  userId: string;
}

export interface GetActivePlanOutput {
  plan: Record<string, unknown> | null;
}

export type GetActivePlanUseCase = UseCase<GetActivePlanInput, GetActivePlanOutput>;
