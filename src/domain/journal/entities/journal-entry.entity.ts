import { AggregateRoot } from '../../core/aggregate-root';
import { Uuid } from '../../shared/uuid.vo';
import { JournalEntryCreatedEvent } from '../events/journal.events';
import { JournalText, JournalVisibility, TagName } from '../value-objects/journal.value-objects';

export interface JournalEntryProps {
  userId: string;
  text: JournalText;
  visibility: JournalVisibility;
  tags: TagName[];
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}

export class JournalEntry extends AggregateRoot<JournalEntryProps> {
  private constructor(
    private readonly props: JournalEntryProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: JournalEntryProps, id?: Uuid): JournalEntry {
    const entry = new JournalEntry(props, id);
    entry.addDomainEvent(new JournalEntryCreatedEvent(entry.id.value));
    return entry;
  }

  static reconstitute(props: JournalEntryProps, id: Uuid): JournalEntry {
    return new JournalEntry(props, id);
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.props.userId,
      text: this.props.text.value,
      visibility: this.props.visibility.value,
      tags: this.props.tags.map((tag) => tag.value),
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      archivedAt: this.props.archivedAt?.toISOString()
    };
  }
}
