import { RiskRuleDefinition } from '../repositories/risk-rule.repository';

export interface RiskRuleEngineResult {
  ruleId: string;
  ruleVersion: string;
  matched: boolean;
}

export interface RiskRuleEngine {
  evaluate(rules: RiskRuleDefinition[], evidence: ReadonlyArray<string>): RiskRuleEngineResult[];
}
