import { Entity } from '../../core/entity';
import { Uuid } from '../../shared/uuid.vo';
import { RiskEvidence, RiskSignalType } from '../value-objects/risk-assessment.value-objects';

export interface RiskSignalProps {
  type: RiskSignalType;
  evidence: RiskEvidence;
  detectedAt: Date;
}

export class RiskSignal extends Entity<RiskSignalProps> {
  private constructor(
    private readonly props: RiskSignalProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: RiskSignalProps, id?: Uuid): RiskSignal {
    return new RiskSignal(props, id);
  }

  toJson() {
    return {
      id: this.id.value,
      type: this.props.type.value,
      evidence: this.props.evidence.value,
      detectedAt: this.props.detectedAt.toISOString()
    };
  }
}
