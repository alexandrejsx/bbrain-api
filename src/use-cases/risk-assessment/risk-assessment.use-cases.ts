import { UseCase } from '../use-case.interface';

export interface CalculateRiskInput {
  userId: string;
  evidence: ReadonlyArray<string>;
}

export interface CalculateRiskOutput {
  score: number;
  level: string;
}

export type CalculateRiskUseCase = UseCase<CalculateRiskInput, CalculateRiskOutput>;

export interface GenerateRiskAssessmentInput {
  userId: string;
  evidence: ReadonlyArray<string>;
}

export interface GenerateRiskAssessmentOutput {
  riskAssessmentId: string;
}

export type GenerateRiskAssessmentUseCase = UseCase<
  GenerateRiskAssessmentInput,
  GenerateRiskAssessmentOutput
>;

export interface GetLatestRiskAssessmentInput {
  userId: string;
}

export interface GetLatestRiskAssessmentOutput {
  assessment: Record<string, unknown> | null;
}

export type GetLatestRiskAssessmentUseCase = UseCase<
  GetLatestRiskAssessmentInput,
  GetLatestRiskAssessmentOutput
>;
