import { RetentionPolicy } from '../value-objects/memory.value-objects';

export interface MemoryRetentionService {
  determineRetentionPolicy(memoryId: string): Promise<RetentionPolicy>;
}
