import { WellbeingObservation } from '../../../wellbeing-history/entities/wellbeing-observation.entity';
import {
  SaveWellbeingObservationIfAbsentResult,
  WellbeingObservationListCriteria,
  WellbeingObservationRepository
} from '../../../wellbeing-history/repositories/wellbeing-observation.repository';

export class InMemoryWellbeingObservationRepository implements WellbeingObservationRepository {
  readonly observations = new Map<string, WellbeingObservation>();

  saveIfAbsent(
    userId: string,
    idempotencyKey: string,
    observation: WellbeingObservation
  ): Promise<SaveWellbeingObservationIfAbsentResult> {
    const existing = [...this.observations.values()].find(
      (item) => item.userId === userId && item.idempotencyKey === idempotencyKey
    );
    if (existing) return Promise.resolve({ created: false, observation: existing });

    this.observations.set(observation.id.value, observation);
    return Promise.resolve({ created: true, observation });
  }

  findById(userId: string, observationId: string): Promise<WellbeingObservation | null> {
    const observation = this.observations.get(observationId);
    return Promise.resolve(observation?.userId === userId ? observation : null);
  }

  list(
    userId: string,
    criteria: WellbeingObservationListCriteria = {}
  ): Promise<WellbeingObservation[]> {
    return Promise.resolve(
      [...this.observations.values()]
        .filter((observation) => observation.userId === userId)
        .filter(
          (observation) => !criteria.kinds?.length || criteria.kinds.includes(observation.kind)
        )
        .filter(
          (observation) => !criteria.createdFrom || observation.createdAt >= criteria.createdFrom
        )
        .filter((observation) => !criteria.createdTo || observation.createdAt <= criteria.createdTo)
        .sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime())
    );
  }

  findMoodSummariesBySourceObservation(
    userId: string,
    sourceObservationId: string
  ): Promise<WellbeingObservation<'mood_daily_summary'>[]> {
    const summaries = [...this.observations.values()].filter(
      (observation) => observation.userId === userId && observation.kind === 'mood_daily_summary'
    ) as WellbeingObservation<'mood_daily_summary'>[];

    return Promise.resolve(
      summaries.filter((observation) =>
        observation.data.sourceObservationIds.includes(sourceObservationId)
      )
    );
  }

  update(userId: string, observation: WellbeingObservation): Promise<void> {
    if (observation.userId !== userId || !this.observations.has(observation.id.value)) {
      throw new Error('Observation not found');
    }
    this.observations.set(observation.id.value, observation);
    return Promise.resolve();
  }

  delete(userId: string, observationId: string, expectedRevision: number): Promise<boolean> {
    const observation = this.observations.get(observationId);
    if (observation?.userId !== userId || observation.revision !== expectedRevision) {
      return Promise.resolve(false);
    }

    return Promise.resolve(this.observations.delete(observationId));
  }

  deleteByUserId(userId: string): Promise<void> {
    for (const [id, observation] of this.observations.entries()) {
      if (observation.userId === userId) this.observations.delete(id);
    }
    return Promise.resolve();
  }
}
