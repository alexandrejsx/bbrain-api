import { Entity } from '../../core/entity';
import { Uuid } from '../../shared/uuid.vo';
import { GoalDescription, ProgressStatus } from '../value-objects/support-plan.value-objects';

export interface SmallStepProps {
  description: GoalDescription;
  status: ProgressStatus;
  createdAt: Date;
}

export class SmallStep extends Entity<SmallStepProps> {
  private constructor(
    private readonly props: SmallStepProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: SmallStepProps, id?: Uuid): SmallStep {
    return new SmallStep(props, id);
  }

  toJson() {
    return {
      id: this.id.value,
      description: this.props.description.value,
      status: this.props.status.value,
      createdAt: this.props.createdAt.toISOString()
    };
  }
}
