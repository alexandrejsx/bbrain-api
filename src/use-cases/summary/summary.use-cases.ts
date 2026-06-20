import { UseCase } from '../use-case.interface';

export interface GenerateSummaryInput {
  userId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface GenerateSummaryOutput {
  summaryId: string;
}

export type GenerateWeeklySummaryUseCase = UseCase<GenerateSummaryInput, GenerateSummaryOutput>;

export type GenerateMonthlySummaryUseCase = UseCase<GenerateSummaryInput, GenerateSummaryOutput>;

export type GeneratePeriodSummaryUseCase = UseCase<GenerateSummaryInput, GenerateSummaryOutput>;

export interface GetUserSummariesInput {
  userId: string;
}

export interface GetUserSummariesOutput {
  summaries: ReadonlyArray<Record<string, unknown>>;
}

export type GetUserSummariesUseCase = UseCase<GetUserSummariesInput, GetUserSummariesOutput>;
