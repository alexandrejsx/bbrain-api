import { DomainEvent } from '../../core/domain-event';

abstract class SafetyDomainEvent implements DomainEvent {
  readonly occurredOn = new Date();

  protected constructor(
    readonly aggregateId: string,
    readonly name: string
  ) {}
}

export class SafetyGuardrailTriggeredEvent extends SafetyDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'safety.guardrail.triggered');
  }
}

export class ProfessionalHelpRecommendedEvent extends SafetyDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'safety.professional-help.recommended');
  }
}

export class CrisisSignalDetectedEvent extends SafetyDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'safety.crisis-signal.detected');
  }
}

export class UnsafeOutputBlockedEvent extends SafetyDomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId, 'safety.unsafe-output.blocked');
  }
}
