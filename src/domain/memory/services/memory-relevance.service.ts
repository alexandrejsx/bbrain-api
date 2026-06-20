import { RelevanceScore } from '../value-objects/memory.value-objects';

export interface MemoryRelevanceService {
  calculateRelevance(input: string): RelevanceScore;
}
