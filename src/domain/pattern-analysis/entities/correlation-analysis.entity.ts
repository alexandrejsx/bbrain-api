import { AggregateRoot } from '../../core/aggregate-root';
import { Uuid } from '../../shared/uuid.vo';
import { CorrelationDetectedEvent } from '../events/pattern-analysis.events';
import {
  CorrelationStrength,
  EvidenceWindow
} from '../value-objects/pattern-analysis.value-objects';

export interface CorrelationAnalysisProps {
  userId: string;
  sourceMetric: string;
  targetMetric: string;
  strength: CorrelationStrength;
  evidenceWindow: EvidenceWindow;
  detectedAt: Date;
}

export class CorrelationAnalysis extends AggregateRoot<CorrelationAnalysisProps> {
  private constructor(
    private readonly props: CorrelationAnalysisProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: CorrelationAnalysisProps, id?: Uuid): CorrelationAnalysis {
    const analysis = new CorrelationAnalysis(props, id);
    analysis.addDomainEvent(new CorrelationDetectedEvent(analysis.id.value));
    return analysis;
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.props.userId,
      sourceMetric: this.props.sourceMetric,
      targetMetric: this.props.targetMetric,
      strength: this.props.strength.value,
      evidenceWindow: this.props.evidenceWindow.value,
      detectedAt: this.props.detectedAt.toISOString()
    };
  }
}
