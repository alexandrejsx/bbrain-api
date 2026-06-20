import { UseCase } from '../use-case.interface';

export interface CreateMemoryInput {
  userId: string;
  category: string;
  content: string;
  source: string;
}

export interface CreateMemoryOutput {
  memoryId: string;
}

export type CreateMemoryUseCase = UseCase<CreateMemoryInput, CreateMemoryOutput>;

export interface UpdateMemoryInput {
  memoryId: string;
  content: string;
}

export interface UpdateMemoryOutput {
  memoryId: string;
}

export type UpdateMemoryUseCase = UseCase<UpdateMemoryInput, UpdateMemoryOutput>;

export interface SearchRelevantMemoriesInput {
  userId: string;
  query: string;
  limit?: number;
}

export interface SearchRelevantMemoriesOutput {
  memories: ReadonlyArray<Record<string, unknown>>;
}

export type SearchRelevantMemoriesUseCase = UseCase<
  SearchRelevantMemoriesInput,
  SearchRelevantMemoriesOutput
>;

export interface ArchiveMemoryInput {
  memoryId: string;
}

export interface ArchiveMemoryOutput {
  archived: boolean;
}

export type ArchiveMemoryUseCase = UseCase<ArchiveMemoryInput, ArchiveMemoryOutput>;

export interface LinkMemoryReferenceInput {
  memoryId: string;
  sourceId: string;
  sourceType: string;
}

export interface LinkMemoryReferenceOutput {
  referenceId: string;
}

export type LinkMemoryReferenceUseCase = UseCase<
  LinkMemoryReferenceInput,
  LinkMemoryReferenceOutput
>;
