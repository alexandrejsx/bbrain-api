import { ValueObject } from '../../core/value-object';
import { Uuid } from '../../shared/uuid.vo';

export class CheckinId extends Uuid {}

export class CheckinScale extends ValueObject<number> {}

export class MoodLevel extends CheckinScale {}

export class SleepDuration extends ValueObject<number> {}

export class EnergyLevel extends CheckinScale {}

export class StressLevel extends CheckinScale {}

export class MotivationLevel extends CheckinScale {}

export interface CheckinPeriodValue {
  startsAt: Date;
  endsAt: Date;
}

export class CheckinPeriod extends ValueObject<CheckinPeriodValue> {}
