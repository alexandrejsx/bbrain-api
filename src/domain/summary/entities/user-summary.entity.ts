import { AggregateRoot } from '../../core/aggregate-root';
import { Uuid } from '../../shared/uuid.vo';
import { PeriodSummaryGeneratedEvent } from '../events/summary.events';
import {
  SummaryContent,
  SummaryKind,
  SummaryPeriod,
  SummarySource
} from '../value-objects/summary.value-objects';

export interface UserSummaryProps {
  userId: string;
  kind: SummaryKind;
  period: SummaryPeriod;
  content: SummaryContent;
  source: SummarySource;
  generatedAt: Date;
}

export class UserSummary extends AggregateRoot<UserSummaryProps> {
  private constructor(
    private readonly props: UserSummaryProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: UserSummaryProps, id?: Uuid): UserSummary {
    const summary = new UserSummary(props, id);
    summary.addDomainEvent(new PeriodSummaryGeneratedEvent(summary.id.value));
    return summary;
  }

  static reconstitute(props: UserSummaryProps, id: Uuid): UserSummary {
    return new UserSummary(props, id);
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.props.userId,
      kind: this.props.kind.value,
      period: this.props.period.value,
      content: this.props.content.value,
      source: this.props.source.value,
      generatedAt: this.props.generatedAt.toISOString()
    };
  }
}
