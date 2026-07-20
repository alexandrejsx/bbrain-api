import { WellbeingObservation } from '../entities/wellbeing-observation.entity';
import { WellbeingObservationKind } from '../value-objects/wellbeing-observation.types';

export interface WellbeingObservationListCriteria {
  kinds?: readonly WellbeingObservationKind[];
  createdFrom?: Date;
  createdTo?: Date;
}

export interface SaveWellbeingObservationIfAbsentResult {
  created: boolean;
  observation: WellbeingObservation;
}

export interface WellbeingObservationRepository {
  saveIfAbsent(
    userId: string,
    idempotencyKey: string,
    observation: WellbeingObservation
  ): Promise<SaveWellbeingObservationIfAbsentResult>;
  findById(userId: string, observationId: string): Promise<WellbeingObservation | null>;
  list(
    userId: string,
    criteria?: WellbeingObservationListCriteria
  ): Promise<WellbeingObservation[]>;
  findMoodSummariesBySourceObservation(
    userId: string,
    sourceObservationId: string
  ): Promise<WellbeingObservation<'mood_daily_summary'>[]>;
  update(userId: string, observation: WellbeingObservation): Promise<void>;
  delete(userId: string, observationId: string, expectedRevision: number): Promise<boolean>;
  deleteByUserId(userId: string): Promise<void>;
}
