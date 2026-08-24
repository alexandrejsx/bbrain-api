import {
  awakeTimeDuringNightScore,
  calculateSleepQuality,
  durationScore,
  sleepQualityClassification,
  SLEEP_QUALITY_ALGORITHM_VERSION,
  wakeRestfulnessScore
} from '../sleep-quality';

describe('sleep quality', () => {
  it.each([
    [239, 0],
    [240, 2],
    [299, 2],
    [300, 5],
    [359, 5],
    [360, 8],
    [419, 8],
    [420, 10],
    [540, 10],
    [541, 8],
    [600, 8],
    [601, 5],
    [660, 5],
    [661, 2],
    [720, 2],
    [721, 0]
  ])('scores %i minutes as %i', (minutes, score) => {
    expect(durationScore(minutes)).toBe(score);
  });

  it('uses the three equally weighted semantic answers and preserves the raw result', () => {
    expect(
      calculateSleepQuality({
        durationMinutes: 450,
        wakeRestfulness: 'fairly_rested',
        awakeTimeDuringNight: '15_to_29'
      })
    ).toEqual({
      score: 8,
      rawScore: 25 / 3,
      classification: 'good',
      components: { duration: 10, wakeRestfulness: 7, awakeTimeDuringNight: 8 },
      algorithmVersion: SLEEP_QUALITY_ALGORITHM_VERSION
    });
  });

  it.each([
    ['very_tired', 0],
    ['tired', 3],
    ['fairly_rested', 7],
    ['rested', 10]
  ] as const)('scores wake restfulness %s as %i', (value, score) => {
    expect(wakeRestfulnessScore(value)).toBe(score);
  });

  it.each([
    ['under_15', 10],
    ['15_to_29', 8],
    ['30_to_59', 4],
    ['60_or_more', 0]
  ] as const)('scores awake time %s as %i', (value, score) => {
    expect(awakeTimeDuringNightScore(value)).toBe(score);
  });

  it.each([
    [0, 'very_bad'],
    [2, 'very_bad'],
    [3, 'bad'],
    [4, 'bad'],
    [5, 'fair'],
    [6, 'fair'],
    [7, 'good'],
    [8, 'good'],
    [9, 'very_good'],
    [10, 'very_good']
  ] as const)('classifies %i as %s', (score, classification) => {
    expect(sleepQualityClassification(score)).toBe(classification);
  });

  it.each([
    ['very_tired', '60_or_more', 0, 'very_bad'],
    ['tired', '30_to_59', 3, 'bad'],
    ['fairly_rested', '15_to_29', 7, 'good'],
    ['rested', 'under_15', 10, 'very_good']
  ] as const)('covers semantic mappings for %s and %s', (wake, awake, score, classification) => {
    const result = calculateSleepQuality({
      durationMinutes: score === 10 ? 480 : score === 7 ? 360 : score === 3 ? 300 : 180,
      wakeRestfulness: wake,
      awakeTimeDuringNight: awake
    });
    expect(result.classification).toBe(classification);
  });
});
