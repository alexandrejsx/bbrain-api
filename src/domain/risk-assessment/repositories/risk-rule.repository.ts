import { RuleId, RuleVersion } from '../value-objects/risk-assessment.value-objects';

export interface RiskRuleDefinition {
  id: RuleId;
  version: RuleVersion;
  enabled: boolean;
}

export interface RiskRuleRepository {
  findEnabledRules(): Promise<RiskRuleDefinition[]>;
}
