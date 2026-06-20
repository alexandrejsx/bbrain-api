import { Memory } from '../entities/memory.entity';

export interface MemorySearchRepository {
  searchRelevant(userId: string, query: string, limit?: number): Promise<Memory[]>;
}
