import { ValueObject } from '../../core/value-object';
import { Uuid } from '../../shared/uuid.vo';

export class SupportPlanId extends Uuid {}

export class GoalDescription extends ValueObject<string> {}

export type HabitFrequencyValue = 'daily' | 'weekly' | 'custom';

export class HabitFrequency extends ValueObject<HabitFrequencyValue> {}

export type ProgressStatusValue = 'not_started' | 'in_progress' | 'completed' | 'paused';

export class ProgressStatus extends ValueObject<ProgressStatusValue> {}

export interface PlanPeriodValue {
  startsAt: Date;
  endsAt?: Date;
}

export class PlanPeriod extends ValueObject<PlanPeriodValue> {}
