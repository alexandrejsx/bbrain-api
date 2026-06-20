import { UseCase } from '../use-case.interface';

export interface CreateJournalEntryInput {
  userId: string;
  text: string;
  tags?: string[];
}

export interface CreateJournalEntryOutput {
  journalEntryId: string;
}

export type CreateJournalEntryUseCase = UseCase<CreateJournalEntryInput, CreateJournalEntryOutput>;

export interface SearchJournalEntriesInput {
  userId: string;
  query: string;
}

export interface SearchJournalEntriesOutput {
  entries: ReadonlyArray<Record<string, unknown>>;
}

export type SearchJournalEntriesUseCase = UseCase<
  SearchJournalEntriesInput,
  SearchJournalEntriesOutput
>;

export interface GetJournalTimelineInput {
  userId: string;
  startsAt?: Date;
  endsAt?: Date;
}

export interface GetJournalTimelineOutput {
  entries: ReadonlyArray<Record<string, unknown>>;
}

export type GetJournalTimelineUseCase = UseCase<GetJournalTimelineInput, GetJournalTimelineOutput>;

export interface TagJournalEntryInput {
  journalEntryId: string;
  tags: string[];
}

export interface TagJournalEntryOutput {
  journalEntryId: string;
}

export type TagJournalEntryUseCase = UseCase<TagJournalEntryInput, TagJournalEntryOutput>;
