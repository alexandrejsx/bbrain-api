import { RuleId, RuleVersion } from '../value-objects/risk-assessment.value-objects';

export interface RiskRuleDefinition {
  id: RuleId;
  version: RuleVersion;
  enabled: boolean;
}

export interface RiskRuleEngineResult {
  ruleId: string;
  ruleVersion: string;
  matched: boolean;
}

export interface RiskRuleEngine {
  evaluate(rules: RiskRuleDefinition[], evidence: ReadonlyArray<string>): RiskRuleEngineResult[];
}
