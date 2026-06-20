import { ValueObject } from '../../core/value-object';
import { Uuid } from '../../shared/uuid.vo';

export class ConversationId extends Uuid {}

export class MessageContent extends ValueObject<string> {}

export type MessageRoleValue = 'user' | 'assistant' | 'system' | 'tool';

export class MessageRole extends ValueObject<MessageRoleValue> {}

export type SessionStatusValue = 'active' | 'closed';

export class SessionStatus extends ValueObject<SessionStatusValue> {}

export interface ConversationPolicyValue {
  blocksDiagnosis: boolean;
  blocksMedicationPrescription: boolean;
  blocksOutcomePromises: boolean;
}

export class ConversationPolicy extends ValueObject<ConversationPolicyValue> {}
