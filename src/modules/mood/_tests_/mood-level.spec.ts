import { moodLevelFromScore, moodScoreFromData, representativeMoodScore } from '../mood-level';

describe('mood level', () => {
  it.each([
    [0, 'very_low'],
    [2, 'very_low'],
    [3, 'low'],
    [4, 'low'],
    [5, 'middle'],
    [6, 'middle'],
    [7, 'good'],
    [8, 'good'],
    [9, 'very_good'],
    [10, 'very_good']
  ] as const)('maps historical score %s to %s', (score, expected) => {
    expect(moodLevelFromScore(score)).toBe(expected);
  });

  it('uses unbiased range midpoints for manually selected levels', () => {
    expect(representativeMoodScore('very_low')).toBe(1);
    expect(representativeMoodScore('low')).toBe(3.5);
    expect(representativeMoodScore('middle')).toBe(5.5);
    expect(representativeMoodScore('good')).toBe(7.5);
    expect(representativeMoodScore('very_good')).toBe(9.5);
  });

  it('normalizes a historical explicit rating only when both bounds are known', () => {
    expect(moodScoreFromData({ explicitRating: { value: 3, scaleMin: 1, scaleMax: 5 } })).toBe(5);
    expect(moodScoreFromData({ explicitRating: { value: 3, scaleMax: 5 } })).toBeNull();
  });
});
