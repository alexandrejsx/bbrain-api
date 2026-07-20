import { Entity } from '../../core/entity';
import { Uuid } from '../../shared/uuid.vo';

export const CONVERSATION_SUPPORT_CONTEXTS = ['unknown', 'available', 'none_reported'] as const;
export type ConversationSupportContext = (typeof CONVERSATION_SUPPORT_CONTEXTS)[number];

export const CONVERSATION_SAFETY_STATES = ['none', 'needs_check', 'immediate'] as const;
export type ConversationSafetyState = (typeof CONVERSATION_SAFETY_STATES)[number];

export const CONVERSATION_PENDING_QUESTION_CODES = [
  'none',
  'current_feeling',
  'routine_impact',
  'coping_strategy',
  'human_support_available',
  'immediate_safety',
  'next_step_preference',
  'clarification',
  'other'
] as const;
export type ConversationPendingQuestionCode = (typeof CONVERSATION_PENDING_QUESTION_CODES)[number];

export const CONVERSATION_ASSISTANT_INTENTS = [
  'listen',
  'explore_impact',
  'explore_coping',
  'check_human_support',
  'check_immediate_safety',
  'offer_next_step',
  'encourage_professional_support',
  'close_topic',
  'other'
] as const;
export type ConversationAssistantIntent = (typeof CONVERSATION_ASSISTANT_INTENTS)[number];

export interface ConversationStateSnapshot {
  currentTopic?: string;
  currentConcerns: string[];
  userNeeds: string[];
  supportContext: ConversationSupportContext;
  safetyState: ConversationSafetyState;
  pendingQuestionCode: ConversationPendingQuestionCode;
  lastAssistantIntent: ConversationAssistantIntent;
}

export interface ConversationStateProps extends ConversationStateSnapshot {
  userId: string;
  conversationId: string;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

const isValidDate = (value: Date): boolean =>
  value instanceof Date && Number.isFinite(value.getTime());

const assertText = (value: string | undefined, name: string, maxLength: number): void => {
  if (value === undefined) return;
  if (!value.trim() || value.length > maxLength || /[\r\n]/u.test(value)) {
    throw new Error(`${name} must be a single non-empty line with at most ${maxLength} characters`);
  }
};

const assertTextList = (values: string[], name: string): void => {
  if (!Array.isArray(values) || values.length > 5) {
    throw new Error(`${name} must contain at most 5 items`);
  }
  values.forEach((value) => assertText(value, name, 100));
};

const assertState = (props: ConversationStateProps): void => {
  if (!props.userId || !props.conversationId) {
    throw new Error('Conversation state ownership is required');
  }
  if (!Number.isInteger(props.revision) || props.revision < 1) {
    throw new Error('Conversation state revision must be a positive integer');
  }
  assertText(props.currentTopic, 'currentTopic', 100);
  assertTextList(props.currentConcerns, 'currentConcerns');
  assertTextList(props.userNeeds, 'userNeeds');
  if (!CONVERSATION_SUPPORT_CONTEXTS.includes(props.supportContext)) {
    throw new Error('Conversation state supportContext is invalid');
  }
  if (!CONVERSATION_SAFETY_STATES.includes(props.safetyState)) {
    throw new Error('Conversation state safetyState is invalid');
  }
  if (!CONVERSATION_PENDING_QUESTION_CODES.includes(props.pendingQuestionCode)) {
    throw new Error('Conversation state pendingQuestionCode is invalid');
  }
  if (!CONVERSATION_ASSISTANT_INTENTS.includes(props.lastAssistantIntent)) {
    throw new Error('Conversation state lastAssistantIntent is invalid');
  }
  if (![props.createdAt, props.updatedAt, props.expiresAt].every(isValidDate)) {
    throw new Error('Conversation state timestamps must be valid dates');
  }
  if (props.updatedAt < props.createdAt || props.expiresAt <= props.updatedAt) {
    throw new Error('Conversation state timestamps are inconsistent');
  }
};

const cloneProps = (props: ConversationStateProps): ConversationStateProps => ({
  ...props,
  currentConcerns: [...props.currentConcerns],
  userNeeds: [...props.userNeeds],
  createdAt: new Date(props.createdAt),
  updatedAt: new Date(props.updatedAt),
  expiresAt: new Date(props.expiresAt)
});

export class ConversationState extends Entity<ConversationStateProps> {
  private constructor(
    private readonly props: ConversationStateProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(
    ownership: Pick<ConversationStateProps, 'userId' | 'conversationId'>,
    snapshot: ConversationStateSnapshot,
    now: Date,
    expiresAt: Date,
    id?: Uuid
  ): ConversationState {
    const props: ConversationStateProps = {
      ...ownership,
      ...snapshot,
      currentConcerns: [...snapshot.currentConcerns],
      userNeeds: [...snapshot.userNeeds],
      revision: 1,
      createdAt: new Date(now),
      updatedAt: new Date(now),
      expiresAt: new Date(expiresAt)
    };
    assertState(props);
    return new ConversationState(props, id);
  }

  static reconstitute(props: ConversationStateProps, id: Uuid): ConversationState {
    const safeProps = cloneProps(props);
    assertState(safeProps);
    return new ConversationState(safeProps, id);
  }

  replace(snapshot: ConversationStateSnapshot, now: Date, expiresAt: Date): void {
    const next = {
      ...this.props,
      ...snapshot,
      currentConcerns: [...snapshot.currentConcerns],
      userNeeds: [...snapshot.userNeeds],
      revision: this.props.revision + 1,
      updatedAt: new Date(now),
      expiresAt: new Date(expiresAt)
    };
    assertState(next);
    Object.assign(this.props, next);
  }

  get userId(): string {
    return this.props.userId;
  }

  get conversationId(): string {
    return this.props.conversationId;
  }

  get revision(): number {
    return this.props.revision;
  }

  get expiresAt(): Date {
    return new Date(this.props.expiresAt);
  }

  toSnapshot(): ConversationStateSnapshot {
    return {
      currentTopic: this.props.currentTopic,
      currentConcerns: [...this.props.currentConcerns],
      userNeeds: [...this.props.userNeeds],
      supportContext: this.props.supportContext,
      safetyState: this.props.safetyState,
      pendingQuestionCode: this.props.pendingQuestionCode,
      lastAssistantIntent: this.props.lastAssistantIntent
    };
  }

  toJson(): ConversationStateProps & { id: string } {
    return { id: this.id.value, ...cloneProps(this.props) };
  }
}
