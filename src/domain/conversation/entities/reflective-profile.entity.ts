import { Entity } from '../../core/entity';
import { Uuid } from '../../shared/uuid.vo';

export interface ReflectiveProfileProps {
  userId: string;
  preferredTone?: string;
  recurringThemes: string[];
  emotionalPatterns: string[];
  routineNotes: string[];
  helpfulStrategies: string[];
  unhelpfulStrategies: string[];
  boundaries: string[];
  currentContextSummary?: string;
  lastInteractionAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReflectiveProfileUpdate {
  currentContextSummary?: string;
  recurringThemesToAdd?: string[];
  emotionalPatternsToAdd?: string[];
  routineNotesToAdd?: string[];
  helpfulStrategiesToAdd?: string[];
  unhelpfulStrategiesToAdd?: string[];
  boundariesToAdd?: string[];
}

interface ReflectiveProfileCollections {
  recurringThemes: string[];
  emotionalPatterns: string[];
  routineNotes: string[];
  helpfulStrategies: string[];
  unhelpfulStrategies: string[];
  boundaries: string[];
}

const mergeUnique = (current: string[], additions?: string[]): string[] => {
  if (!additions?.length) {
    return current;
  }

  const values = new Map(current.map((value) => [value.trim().toLocaleLowerCase(), value]));

  for (const addition of additions) {
    const normalized = addition.trim();
    if (normalized) {
      values.set(
        normalized.toLocaleLowerCase(),
        values.get(normalized.toLocaleLowerCase()) ?? normalized
      );
    }
  }

  return [...values.values()];
};

const mergeCollections = (
  current: ReflectiveProfileCollections,
  update: ReflectiveProfileUpdate
): ReflectiveProfileCollections => ({
  recurringThemes: mergeUnique(current.recurringThemes, update.recurringThemesToAdd),
  emotionalPatterns: mergeUnique(current.emotionalPatterns, update.emotionalPatternsToAdd),
  routineNotes: mergeUnique(current.routineNotes, update.routineNotesToAdd),
  helpfulStrategies: mergeUnique(current.helpfulStrategies, update.helpfulStrategiesToAdd),
  unhelpfulStrategies: mergeUnique(current.unhelpfulStrategies, update.unhelpfulStrategiesToAdd),
  boundaries: mergeUnique(current.boundaries, update.boundariesToAdd)
});

export class ReflectiveProfile extends Entity<ReflectiveProfileProps> {
  private constructor(
    private readonly props: ReflectiveProfileProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(userId: string, now = new Date(), id?: Uuid): ReflectiveProfile {
    return new ReflectiveProfile(
      {
        userId,
        recurringThemes: [],
        emotionalPatterns: [],
        routineNotes: [],
        helpfulStrategies: [],
        unhelpfulStrategies: [],
        boundaries: [],
        createdAt: now,
        updatedAt: now
      },
      id
    );
  }

  static reconstitute(props: ReflectiveProfileProps, id: Uuid): ReflectiveProfile {
    return new ReflectiveProfile(props, id);
  }

  registerInteraction(at = new Date()): void {
    this.props.lastInteractionAt = at;
    this.props.updatedAt = at;
  }

  applyUpdate(update: ReflectiveProfileUpdate, at = new Date()): void {
    if (update.currentContextSummary !== undefined) {
      this.props.currentContextSummary = update.currentContextSummary;
    }

    Object.assign(this.props, mergeCollections(this.props, update));
    this.registerInteraction(at);
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.props.userId,
      preferredTone: this.props.preferredTone,
      recurringThemes: [...this.props.recurringThemes],
      emotionalPatterns: [...this.props.emotionalPatterns],
      routineNotes: [...this.props.routineNotes],
      helpfulStrategies: [...this.props.helpfulStrategies],
      unhelpfulStrategies: [...this.props.unhelpfulStrategies],
      boundaries: [...this.props.boundaries],
      currentContextSummary: this.props.currentContextSummary,
      lastInteractionAt: this.props.lastInteractionAt?.toISOString(),
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString()
    };
  }
}
