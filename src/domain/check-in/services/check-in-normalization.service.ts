import { CheckinScale } from '../value-objects/check-in.value-objects';

export interface CheckinNormalizationService {
  normalizeScale(value: number): CheckinScale;
}
