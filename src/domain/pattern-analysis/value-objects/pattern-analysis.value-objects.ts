import { ValueObject } from '../../core/value-object';
import { Uuid } from '../../shared/uuid.vo';

export class InsightId extends Uuid {}

export type TrendDirectionValue = 'increasing' | 'decreasing' | 'stable' | 'unknown';

export class TrendDirection extends ValueObject<TrendDirectionValue> {}

export class CorrelationStrength extends ValueObject<number> {}

export interface EvidenceWindowValue {
  startsAt: Date;
  endsAt: Date;
}

export class EvidenceWindow extends ValueObject<EvidenceWindowValue> {}

export class InsightConfidence extends ValueObject<number> {}

export type InsightStatusValue = 'active' | 'dismissed' | 'reviewed';

export class InsightStatus extends ValueObject<InsightStatusValue> {}
