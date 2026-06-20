import { UseCase } from '../use-case.interface';

export interface GenerateInsightsInput {
  userId: string;
  startsAt?: Date;
  endsAt?: Date;
}

export interface GenerateInsightsOutput {
  insights: ReadonlyArray<Record<string, unknown>>;
}

export type GenerateInsightsUseCase = UseCase<GenerateInsightsInput, GenerateInsightsOutput>;

export interface DetectBehaviorChangesInput {
  userId: string;
  startsAt?: Date;
  endsAt?: Date;
}

export interface DetectBehaviorChangesOutput {
  trends: ReadonlyArray<Record<string, unknown>>;
}

export type DetectBehaviorChangesUseCase = UseCase<
  DetectBehaviorChangesInput,
  DetectBehaviorChangesOutput
>;

export interface DetectCorrelationsInput {
  userId: string;
  startsAt?: Date;
  endsAt?: Date;
}

export interface DetectCorrelationsOutput {
  correlations: ReadonlyArray<Record<string, unknown>>;
}

export type DetectCorrelationsUseCase = UseCase<DetectCorrelationsInput, DetectCorrelationsOutput>;

export interface ReviewInsightInput {
  insightId: string;
}

export interface ReviewInsightOutput {
  reviewed: boolean;
}

export type ReviewInsightUseCase = UseCase<ReviewInsightInput, ReviewInsightOutput>;
