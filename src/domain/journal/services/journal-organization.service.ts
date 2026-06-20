import { TagName } from '../value-objects/journal.value-objects';

export interface JournalOrganizationService {
  suggestTags(text: string): Promise<TagName[]>;
}
