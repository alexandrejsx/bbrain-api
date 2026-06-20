import { AggregateRoot } from '../../core/aggregate-root';
import { Uuid } from '../../shared/uuid.vo';
import { InsightGeneratedEvent } from '../events/pattern-analysis.events';
import {
  EvidenceWindow,
  InsightConfidence,
  InsightStatus
} from '../value-objects/pattern-analysis.value-objects';

export interface PatternInsightProps {
  userId: string;
  title: string;
  description: string;
  evidenceWindow: EvidenceWindow;
  confidence: InsightConfidence;
  status: InsightStatus;
  createdAt: Date;
}

export class PatternInsight extends AggregateRoot<PatternInsightProps> {
  private constructor(
    private readonly props: PatternInsightProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: PatternInsightProps, id?: Uuid): PatternInsight {
    const insight = new PatternInsight(props, id);
    insight.addDomainEvent(new InsightGeneratedEvent(insight.id.value));
    return insight;
  }

  static reconstitute(props: PatternInsightProps, id: Uuid): PatternInsight {
    return new PatternInsight(props, id);
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.props.userId,
      title: this.props.title,
      description: this.props.description,
      evidenceWindow: this.props.evidenceWindow.value,
      confidence: this.props.confidence.value,
      status: this.props.status.value,
      createdAt: this.props.createdAt.toISOString()
    };
  }
}
