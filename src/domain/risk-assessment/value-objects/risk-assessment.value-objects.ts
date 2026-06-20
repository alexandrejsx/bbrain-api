import { ValueObject } from '../../core/value-object';
import { Uuid } from '../../shared/uuid.vo';

export class RiskAssessmentId extends Uuid {}

export class RiskScore extends ValueObject<number> {}

export type RiskLevelValue = 'low' | 'moderate' | 'high' | 'critical';

export class RiskLevel extends ValueObject<RiskLevelValue> {}

export class RiskSignalType extends ValueObject<string> {}

export class RiskEvidence extends ValueObject<string> {}

export class RuleId extends ValueObject<string> {}

export class RuleVersion extends ValueObject<string> {}
