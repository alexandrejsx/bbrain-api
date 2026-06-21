import { Entity } from '../../core/entity';
import { Uuid } from '../../shared/uuid.vo';

export interface ReflectiveProfileProps {
  userId: string;
  preferredTone?: string;
  analysisGoals: string[];
  recurringThemes: string[];
  emotionalPatterns: string[];
  routineNotes: string[];
  helpfulStrategies: string[];
  unhelpfulStrategies: string[];
  boundaries: string[];
  reportedFormalDiagnoses: string[];
  reportedMedication?: string;
  professionalSupport?: string;
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

export interface ReflectiveProfileSetup {
  preferredTone?: string;
  analysisGoals?: string[];
  reportedFormalDiagnoses?: string[];
  reportedMedication?: string;
  professionalSupport?: string;
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

const cleanOptionalText = (value?: string, maxLength?: number): string | undefined => {
  const cleaned = value?.trim();
  if (!cleaned) return undefined;
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
};

const cleanTextList = (values?: string[], limit = 12): string[] =>
  [...new Map((values ?? []).map((value) => [value.trim().toLocaleLowerCase(), value.trim()]))]
    .map(([, value]) => value)
    .filter(Boolean)
    .slice(0, limit);

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
        analysisGoals: [],
        emotionalPatterns: [],
        routineNotes: [],
        helpfulStrategies: [],
        unhelpfulStrategies: [],
        boundaries: [],
        reportedFormalDiagnoses: [],
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

  configureFromSetup(setup: ReflectiveProfileSetup, at = new Date()): void {
    this.props.preferredTone = cleanOptionalText(setup.preferredTone, 80);
    this.props.analysisGoals = cleanTextList(setup.analysisGoals);
    this.props.reportedFormalDiagnoses = cleanTextList(setup.reportedFormalDiagnoses, 6);
    this.props.reportedMedication = cleanOptionalText(setup.reportedMedication, 180);
    this.props.professionalSupport = cleanOptionalText(setup.professionalSupport, 260);
    this.props.updatedAt = at;
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.props.userId,
      preferredTone: this.props.preferredTone,
      analysisGoals: [...this.props.analysisGoals],
      recurringThemes: [...this.props.recurringThemes],
      emotionalPatterns: [...this.props.emotionalPatterns],
      routineNotes: [...this.props.routineNotes],
      helpfulStrategies: [...this.props.helpfulStrategies],
      unhelpfulStrategies: [...this.props.unhelpfulStrategies],
      boundaries: [...this.props.boundaries],
      reportedFormalDiagnoses: [...this.props.reportedFormalDiagnoses],
      reportedMedication: this.props.reportedMedication,
      professionalSupport: this.props.professionalSupport,
      currentContextSummary: this.props.currentContextSummary,
      lastInteractionAt: this.props.lastInteractionAt?.toISOString(),
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString()
    };
  }
}
