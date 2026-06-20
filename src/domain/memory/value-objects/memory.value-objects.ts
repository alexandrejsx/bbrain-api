import { ValueObject } from '../../core/value-object';
import { Uuid } from '../../shared/uuid.vo';

export class MemoryId extends Uuid {}

export type MemoryCategoryValue =
  | 'preference'
  | 'goal'
  | 'recurring_information'
  | 'relevant_event'
  | 'identified_trigger';

export class MemoryCategory extends ValueObject<MemoryCategoryValue> {}

export class MemoryContent extends ValueObject<string> {}

export class ConfidenceLevel extends ValueObject<number> {}

export class MemorySource extends ValueObject<string> {}

export class RelevanceScore extends ValueObject<number> {}

export type RetentionPolicyValue = 'retain' | 'review' | 'archive';

export class RetentionPolicy extends ValueObject<RetentionPolicyValue> {}
