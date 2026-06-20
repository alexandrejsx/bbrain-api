import { Entity } from '../../core/entity';
import { Uuid } from '../../shared/uuid.vo';
import {
  GoalDescription,
  HabitFrequency,
  ProgressStatus
} from '../value-objects/support-plan.value-objects';

export interface HabitGoalProps {
  description: GoalDescription;
  frequency: HabitFrequency;
  status: ProgressStatus;
  createdAt: Date;
}

export class HabitGoal extends Entity<HabitGoalProps> {
  private constructor(
    private readonly props: HabitGoalProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: HabitGoalProps, id?: Uuid): HabitGoal {
    return new HabitGoal(props, id);
  }

  toJson() {
    return {
      id: this.id.value,
      description: this.props.description.value,
      frequency: this.props.frequency.value,
      status: this.props.status.value,
      createdAt: this.props.createdAt.toISOString()
    };
  }
}
