import { RiskLevel, RiskScore } from '../value-objects/risk-assessment.value-objects';
import { RiskRuleEngineResult } from './risk-rule-engine.service';

export interface RiskEvaluationResult {
  score: RiskScore;
  level: RiskLevel;
}

export interface RiskEvaluator {
  calculate(ruleResults: RiskRuleEngineResult[]): RiskEvaluationResult;
}
