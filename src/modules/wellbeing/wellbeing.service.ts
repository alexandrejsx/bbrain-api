import { Injectable } from '@nestjs/common';
import { MoodService } from '../mood/mood.service';
import { SleepService } from '../sleep/sleep.service';
import { WellbeingKind, WellbeingNotFoundError } from './wellbeing.types';

@Injectable()
export class WellbeingService {
  constructor(
    private readonly mood: MoodService,
    private readonly sleep: SleepService
  ) {}

  async list(userId: string, kinds?: WellbeingKind[]) {
    const wantsMood = !kinds?.length || kinds.some((kind) => kind.startsWith('mood_'));
    const wantsSleep = !kinds?.length || kinds.includes('sleep_record');
    const [mood, sleep] = await Promise.all([
      wantsMood
        ? this.mood.list(
            userId,
            kinds?.filter((kind) => kind.startsWith('mood_'))
          )
        : [],
      wantsSleep ? this.sleep.list(userId) : []
    ]);
    return [...mood, ...sleep].sort(
      (left, right) => right.capturedAt.getTime() - left.capturedAt.getTime()
    );
  }

  create(
    userId: string,
    input: {
      clientRequestId: string;
      kind: WellbeingKind;
      data: Record<string, unknown>;
      temporalReference: unknown;
    }
  ) {
    return input.kind === 'sleep_record'
      ? this.sleep.createManual({ userId, ...input })
      : this.mood.createManual({ userId, ...input, kind: input.kind });
  }

  async correct(
    userId: string,
    id: string,
    input: {
      expectedRevision: number;
      data: Record<string, unknown>;
      temporalReference?: unknown;
    }
  ) {
    try {
      return await this.mood.correct({ userId, id, ...input });
    } catch (error) {
      if (!(error instanceof WellbeingNotFoundError)) throw error;
      return this.sleep.correct({ userId, id, ...input });
    }
  }

  async remove(userId: string, id: string, revision: number): Promise<void> {
    try {
      await this.mood.remove(userId, id, revision);
    } catch (error) {
      if (!(error instanceof WellbeingNotFoundError)) throw error;
      await this.sleep.remove(userId, id, revision);
    }
  }
}
