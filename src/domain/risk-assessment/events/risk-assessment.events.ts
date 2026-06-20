import { DomainEvent } from '../../core/domain-event';

abstract class RiskAssessmentDomainEvent implements DomainEvent {
  readonly occurredOn = new Date();

  protected constructor(
    readonly aggregateId: string,
    readonly name: string
  ) {}
}

export class RiskAssessmentGeneratedEvent extends RiskAssessmentDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'risk-assessment.generated');
  }
}

export class RiskSignalDetectedEvent extends RiskAssessmentDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'risk-assessment.signal.detected');
  }
}

export class HighRiskDetectedEvent extends RiskAssessmentDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'risk-assessment.high-risk.detected');
  }
}

export class SafetyEscalationRecommendedEvent extends RiskAssessmentDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'risk-assessment.safety-escalation.recommended');
  }
}
