import { DomainEvent } from '../../core/domain-event';

abstract class SupportPlanDomainEvent implements DomainEvent {
  readonly occurredOn = new Date();

  protected constructor(
    readonly aggregateId: string,
    readonly name: string
  ) {}
}

export class SupportPlanCreatedEvent extends SupportPlanDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'support-plan.created');
  }
}

export class HabitGoalAddedEvent extends SupportPlanDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'support-plan.habit-goal.added');
  }
}

export class ProgressTrackedEvent extends SupportPlanDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'support-plan.progress.tracked');
  }
}

export class PlanUpdatedEvent extends SupportPlanDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'support-plan.updated');
  }
}

export class GoalCompletedEvent extends SupportPlanDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'support-plan.goal.completed');
  }
}
