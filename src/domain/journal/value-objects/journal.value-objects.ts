import { ValueObject } from '../../core/value-object';
import { Uuid } from '../../shared/uuid.vo';

export class JournalEntryId extends Uuid {}

export class JournalText extends ValueObject<string> {}

export type JournalVisibilityValue = 'private';

export class JournalVisibility extends ValueObject<JournalVisibilityValue> {}

export class TagName extends ValueObject<string> {}

export interface JournalPeriodValue {
  startsAt: Date;
  endsAt: Date;
}

export class JournalPeriod extends ValueObject<JournalPeriodValue> {}
