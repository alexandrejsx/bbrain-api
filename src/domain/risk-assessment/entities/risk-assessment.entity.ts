import { AggregateRoot } from '../../core/aggregate-root';
import { Uuid } from '../../shared/uuid.vo';
import { RiskAssessmentGeneratedEvent } from '../events/risk-assessment.events';
import { RiskSignal } from './risk-signal.entity';
import {
  RiskLevel,
  RiskScore,
  RuleId,
  RuleVersion
} from '../value-objects/risk-assessment.value-objects';

export interface RiskRuleEvaluation {
  ruleId: RuleId;
  ruleVersion: RuleVersion;
  matched: boolean;
}

export interface RiskAssessmentProps {
  userId: string;
  score: RiskScore;
  level: RiskLevel;
  signals: RiskSignal[];
  ruleEvaluations: RiskRuleEvaluation[];
  generatedAt: Date;
}

export class RiskAssessment extends AggregateRoot<RiskAssessmentProps> {
  private constructor(
    private readonly props: RiskAssessmentProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: RiskAssessmentProps, id?: Uuid): RiskAssessment {
    const assessment = new RiskAssessment(props, id);
    assessment.addDomainEvent(new RiskAssessmentGeneratedEvent(assessment.id.value));
    return assessment;
  }

  static reconstitute(props: RiskAssessmentProps, id: Uuid): RiskAssessment {
    return new RiskAssessment(props, id);
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.props.userId,
      score: this.props.score.value,
      level: this.props.level.value,
      signals: this.props.signals.map((signal) => signal.toJson()),
      ruleEvaluations: this.props.ruleEvaluations.map((evaluation) => ({
        ruleId: evaluation.ruleId.value,
        ruleVersion: evaluation.ruleVersion.value,
        matched: evaluation.matched
      })),
      generatedAt: this.props.generatedAt.toISOString()
    };
  }
}
