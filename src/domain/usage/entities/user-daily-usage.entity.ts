import { PlanType } from '../../plans/plan-definition';
import { Uuid } from '../../shared/uuid.vo';
import { LlmUsage, normalizeLlmUsage } from '../value-objects/llm-usage';

export interface UserDailyUsageProps {
  userId: string;
  plan: PlanType;
  dateKey: string;
  periodStart: Date;
  periodEnd: Date;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  messageCount: number;
  blockedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class UserDailyUsage {
  readonly id: Uuid;

  private constructor(
    private readonly props: UserDailyUsageProps,
    id?: Uuid
  ) {
    this.id = id ?? Uuid.create();
  }

  static create(
    props: Omit<
      UserDailyUsageProps,
      | 'inputTokens'
      | 'outputTokens'
      | 'totalTokens'
      | 'messageCount'
      | 'blockedCount'
      | 'createdAt'
      | 'updatedAt'
    > & {
      createdAt?: Date;
      updatedAt?: Date;
    },
    id?: Uuid
  ): UserDailyUsage {
    const now = new Date();

    return new UserDailyUsage(
      {
        ...props,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        messageCount: 0,
        blockedCount: 0,
        createdAt: props.createdAt ?? now,
        updatedAt: props.updatedAt ?? now
      },
      id
    );
  }

  static reconstitute(props: UserDailyUsageProps, id: Uuid): UserDailyUsage {
    return new UserDailyUsage(props, id);
  }

  updatePlan(plan: PlanType, date = new Date()): void {
    if (this.props.plan === plan) {
      return;
    }

    this.props.plan = plan;
    this.props.updatedAt = date;
  }

  incrementBlocked(date = new Date()): void {
    this.props.blockedCount += 1;
    this.props.updatedAt = date;
  }

  lockUntil(periodEnd: Date, date = new Date()): void {
    if (periodEnd.getTime() <= this.props.periodEnd.getTime()) {
      return;
    }

    this.props.periodEnd = periodEnd;
    this.props.updatedAt = date;
  }

  registerLlmUsage(usage: LlmUsage, date = new Date()): void {
    this.registerUsage(usage, true, date);
  }

  registerAuxiliaryLlmUsage(usage: LlmUsage, date = new Date()): void {
    this.registerUsage(usage, false, date);
  }

  releaseMessageReservation(date = new Date()): void {
    if (this.props.messageCount > 0) this.props.messageCount -= 1;
    this.props.updatedAt = date;
  }

  private registerUsage(usage: LlmUsage, incrementMessageCount: boolean, date: Date): void {
    const normalizedUsage = normalizeLlmUsage(usage);

    this.props.inputTokens += normalizedUsage.inputTokens;
    this.props.outputTokens += normalizedUsage.outputTokens;
    this.props.totalTokens += normalizedUsage.totalTokens;
    if (incrementMessageCount) this.props.messageCount += 1;
    this.props.updatedAt = date;
  }

  get userId(): string {
    return this.props.userId;
  }

  get plan(): PlanType {
    return this.props.plan;
  }

  get dateKey(): string {
    return this.props.dateKey;
  }

  get periodStart(): Date {
    return this.props.periodStart;
  }

  get periodEnd(): Date {
    return this.props.periodEnd;
  }

  get inputTokens(): number {
    return this.props.inputTokens;
  }

  get outputTokens(): number {
    return this.props.outputTokens;
  }

  get totalTokens(): number {
    return this.props.totalTokens;
  }

  get messageCount(): number {
    return this.props.messageCount;
  }

  get blockedCount(): number {
    return this.props.blockedCount;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.userId,
      plan: this.plan,
      dateKey: this.dateKey,
      periodStart: this.periodStart.toISOString(),
      periodEnd: this.periodEnd.toISOString(),
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      totalTokens: this.totalTokens,
      messageCount: this.messageCount,
      blockedCount: this.blockedCount,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}
