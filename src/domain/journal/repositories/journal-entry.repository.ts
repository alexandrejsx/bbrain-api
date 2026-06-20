import { JournalEntry } from '../entities/journal-entry.entity';

export interface JournalEntryRepository {
  findById(id: string): Promise<JournalEntry | null>;
  searchByUserId(userId: string, query: string): Promise<JournalEntry[]>;
  findTimelineByUserId(userId: string, startsAt?: Date, endsAt?: Date): Promise<JournalEntry[]>;
  save(entry: JournalEntry): Promise<void>;
}
