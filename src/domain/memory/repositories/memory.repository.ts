import { Memory } from '../entities/memory.entity';

export interface MemoryRepository {
  findById(id: string): Promise<Memory | null>;
  findByUserId(userId: string): Promise<Memory[]>;
  save(memory: Memory): Promise<void>;
}
