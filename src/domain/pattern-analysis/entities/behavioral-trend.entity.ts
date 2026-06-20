import { AggregateRoot } from '../../core/aggregate-root';
import { Uuid } from '../../shared/uuid.vo';
import { BehaviorChangeDetectedEvent } from '../events/pattern-analysis.events';
import { EvidenceWindow, TrendDirection } from '../value-objects/pattern-analysis.value-objects';

export interface BehavioralTrendProps {
  userId: string;
  metric: string;
  direction: TrendDirection;
  evidenceWindow: EvidenceWindow;
  detectedAt: Date;
}

export class BehavioralTrend extends AggregateRoot<BehavioralTrendProps> {
  private constructor(
    private readonly props: BehavioralTrendProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: BehavioralTrendProps, id?: Uuid): BehavioralTrend {
    const trend = new BehavioralTrend(props, id);
    trend.addDomainEvent(new BehaviorChangeDetectedEvent(trend.id.value));
    return trend;
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.props.userId,
      metric: this.props.metric,
      direction: this.props.direction.value,
      evidenceWindow: this.props.evidenceWindow.value,
      detectedAt: this.props.detectedAt.toISOString()
    };
  }
}
