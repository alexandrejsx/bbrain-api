import { Entity } from '../../core/entity';
import { Uuid } from '../../shared/uuid.vo';
import { ProgressStatus } from '../value-objects/support-plan.value-objects';

export interface PlanProgressProps {
  habitGoalId: string;
  status: ProgressStatus;
  trackedAt: Date;
  note?: string;
}

export class PlanProgress extends Entity<PlanProgressProps> {
  private constructor(
    private readonly props: PlanProgressProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: PlanProgressProps, id?: Uuid): PlanProgress {
    return new PlanProgress(props, id);
  }

  toJson() {
    return {
      id: this.id.value,
      habitGoalId: this.props.habitGoalId,
      status: this.props.status.value,
      trackedAt: this.props.trackedAt.toISOString(),
      note: this.props.note
    };
  }
}
