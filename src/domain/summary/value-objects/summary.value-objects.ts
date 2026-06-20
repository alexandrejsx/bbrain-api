import { ValueObject } from '../../core/value-object';
import { Uuid } from '../../shared/uuid.vo';

export class SummaryId extends Uuid {}

export interface SummaryPeriodValue {
  startsAt: Date;
  endsAt: Date;
}

export class SummaryPeriod extends ValueObject<SummaryPeriodValue> {}

export type SummaryKindValue = 'weekly' | 'monthly' | 'period';

export class SummaryKind extends ValueObject<SummaryKindValue> {}

export class SummaryContent extends ValueObject<string> {}

export class SummarySource extends ValueObject<string> {}
