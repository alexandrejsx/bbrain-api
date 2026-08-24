export const SLEEP_QUALITY_ALGORITHM_VERSION = 'bbrain-sleep-quality-v1' as const;

export const WAKE_RESTFULNESS_VALUES = ['very_tired', 'tired', 'fairly_rested', 'rested'] as const;
export type WakeRestfulness = (typeof WAKE_RESTFULNESS_VALUES)[number];

export const AWAKE_TIME_DURING_NIGHT_VALUES = [
  'under_15',
  '15_to_29',
  '30_to_59',
  '60_or_more'
] as const;
export type AwakeTimeDuringNight = (typeof AWAKE_TIME_DURING_NIGHT_VALUES)[number];

export const SLEEP_LATENCY_VALUES = [
  'up_to_15',
  '16_to_30',
  '31_to_60',
  'over_60',
  'unknown'
] as const;
export type SleepLatency = (typeof SLEEP_LATENCY_VALUES)[number];

export const SLEEP_QUALITY_CLASSIFICATIONS = [
  'very_bad',
  'bad',
  'fair',
  'good',
  'very_good'
] as const;
export type SleepQualityClassification = (typeof SLEEP_QUALITY_CLASSIFICATIONS)[number];

export type SleepQuality = {
  score: number;
  rawScore: number;
  classification: SleepQualityClassification;
  components: {
    duration: number;
    wakeRestfulness: number;
    awakeTimeDuringNight: number;
  };
  algorithmVersion: typeof SLEEP_QUALITY_ALGORITHM_VERSION;
};

const WAKE_RESTFULNESS_SCORES: Record<WakeRestfulness, number> = {
  very_tired: 0,
  tired: 3,
  fairly_rested: 7,
  rested: 10
};

const AWAKE_TIME_SCORES: Record<AwakeTimeDuringNight, number> = {
  under_15: 10,
  '15_to_29': 8,
  '30_to_59': 4,
  '60_or_more': 0
};

export function durationScore(durationMinutes: number): number {
  if (durationMinutes < 240 || durationMinutes > 720) return 0;
  if (durationMinutes <= 299 || durationMinutes >= 661) return 2;
  if (durationMinutes <= 359 || durationMinutes >= 601) return 5;
  if (durationMinutes <= 419 || durationMinutes >= 541) return 8;
  return 10;
}

export function wakeRestfulnessScore(value: WakeRestfulness): number {
  return WAKE_RESTFULNESS_SCORES[value];
}

export function awakeTimeDuringNightScore(value: AwakeTimeDuringNight): number {
  return AWAKE_TIME_SCORES[value];
}

export function sleepQualityClassification(score: number): SleepQualityClassification {
  if (score <= 2) return 'very_bad';
  if (score <= 4) return 'bad';
  if (score <= 6) return 'fair';
  if (score <= 8) return 'good';
  return 'very_good';
}

export function calculateSleepQuality(input: {
  durationMinutes: number;
  wakeRestfulness: WakeRestfulness;
  awakeTimeDuringNight: AwakeTimeDuringNight;
}): SleepQuality {
  const components = {
    duration: durationScore(input.durationMinutes),
    wakeRestfulness: wakeRestfulnessScore(input.wakeRestfulness),
    awakeTimeDuringNight: awakeTimeDuringNightScore(input.awakeTimeDuringNight)
  };
  const rawScore =
    (components.duration + components.wakeRestfulness + components.awakeTimeDuringNight) / 3;
  const score = Math.round(rawScore);
  return {
    score,
    rawScore,
    classification: sleepQualityClassification(score),
    components,
    algorithmVersion: SLEEP_QUALITY_ALGORITHM_VERSION
  };
}
