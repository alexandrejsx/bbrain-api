import { AggregateRoot } from '../../core/aggregate-root';
import { Uuid } from '../../shared/uuid.vo';
import { SupportPlanCreatedEvent } from '../events/support-plan.events';
import { HabitGoal } from './habit-goal.entity';
import { PlanProgress } from './plan-progress.entity';
import { SmallStep } from './small-step.entity';
import { PlanPeriod } from '../value-objects/support-plan.value-objects';

export interface SupportPlanProps {
  userId: string;
  period: PlanPeriod;
  habitGoals: HabitGoal[];
  progress: PlanProgress[];
  smallSteps: SmallStep[];
  createdAt: Date;
  updatedAt: Date;
}

export class SupportPlan extends AggregateRoot<SupportPlanProps> {
  private constructor(
    private readonly props: SupportPlanProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: SupportPlanProps, id?: Uuid): SupportPlan {
    const plan = new SupportPlan(props, id);
    plan.addDomainEvent(new SupportPlanCreatedEvent(plan.id.value));
    return plan;
  }

  static reconstitute(props: SupportPlanProps, id: Uuid): SupportPlan {
    return new SupportPlan(props, id);
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.props.userId,
      period: this.props.period.value,
      habitGoals: this.props.habitGoals.map((goal) => goal.toJson()),
      progress: this.props.progress.map((item) => item.toJson()),
      smallSteps: this.props.smallSteps.map((step) => step.toJson()),
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString()
    };
  }
}
