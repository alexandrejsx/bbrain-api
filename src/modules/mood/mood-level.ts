import { WellbeingRecord } from '../wellbeing/wellbeing.types';
import {
  FIVE_LEVELS,
  FiveLevel,
  fiveLevelFromScore,
  isFiveLevel,
  representativeFiveLevelScore
} from '../wellbeing/five-level-score';

export const MOOD_LEVELS = FIVE_LEVELS;

export type MoodLevel = FiveLevel;
export type MoodPeriod = '7d' | '30d' | '1y';

export function isMoodLevel(value: unknown): value is MoodLevel {
  return isFiveLevel(value);
}

export function representativeMoodScore(level: MoodLevel): number {
  return representativeFiveLevelScore(level);
}

export function moodLevelFromScore(score: number): MoodLevel {
  return fiveLevelFromScore(score);
}

export function moodScoreFromData(data: Record<string, unknown>): number | null {
  if (isMoodLevel(data.moodLevel)) return representativeMoodScore(data.moodLevel);
  if (
    typeof data.moodScore === 'number' &&
    Number.isFinite(data.moodScore) &&
    data.moodScore >= 0 &&
    data.moodScore <= 10
  ) {
    return data.moodScore;
  }

  const rating = data.explicitRating;
  if (!rating || typeof rating !== 'object' || Array.isArray(rating)) return null;
  const { value, scaleMin, scaleMax } = rating as Record<string, unknown>;
  if (
    typeof value !== 'number' ||
    typeof scaleMin !== 'number' ||
    typeof scaleMax !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isFinite(scaleMin) ||
    !Number.isFinite(scaleMax) ||
    scaleMax <= scaleMin ||
    value < scaleMin ||
    value > scaleMax
  ) {
    return null;
  }
  return ((value - scaleMin) / (scaleMax - scaleMin)) * 10;
}

export function moodLevelFromRecord(record: WellbeingRecord): MoodLevel | null {
  const score = moodScoreFromData(record.data);
  return score === null ? null : moodLevelFromScore(score);
}
