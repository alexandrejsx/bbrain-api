import { InvalidWellbeingRecordError } from './wellbeing.types';

export const FIVE_LEVELS = ['very_low', 'low', 'middle', 'good', 'very_good'] as const;
export type FiveLevel = (typeof FIVE_LEVELS)[number];

const REPRESENTATIVE_SCORE: Record<FiveLevel, number> = {
  very_low: 1,
  low: 3.5,
  middle: 5.5,
  good: 7.5,
  very_good: 9.5
};

export function isFiveLevel(value: unknown): value is FiveLevel {
  return typeof value === 'string' && FIVE_LEVELS.includes(value as FiveLevel);
}

export function representativeFiveLevelScore(level: FiveLevel): number {
  return REPRESENTATIVE_SCORE[level];
}

export function fiveLevelFromScore(score: number): FiveLevel {
  if (!Number.isFinite(score) || score < 0 || score > 10) {
    throw new InvalidWellbeingRecordError();
  }
  if (score < 2.5) return 'very_low';
  if (score < 4.5) return 'low';
  if (score < 6.5) return 'middle';
  if (score < 8.5) return 'good';
  return 'very_good';
}
